import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createAgentToolRegistry,
  createSearchProviderRegistryFromEnv,
  MemoryToolEventSink,
  resolveSearchRuntimeConfig,
  ToolGateway,
  type ToolResult,
} from "@stellaris/agent-tools";
import type { SearchWebOutput } from "@stellaris/agent-tools";

export const SEARCH_QUERY_REQUIRED = "SEARCH_QUERY_REQUIRED" as const;
export const SEARCH_SMOKE_FAILED = "SEARCH_SMOKE_FAILED" as const;
export const BOCHA_API_KEY_REQUIRED_FOR_REAL_SMOKE = "BOCHA_API_KEY_REQUIRED_FOR_REAL_SMOKE" as const;

export type SearchSmokeStatus =
  | "OK"
  | typeof SEARCH_QUERY_REQUIRED
  | typeof SEARCH_SMOKE_FAILED
  | typeof BOCHA_API_KEY_REQUIRED_FOR_REAL_SMOKE;

export type SearchSmokeResult = {
  status: SearchSmokeStatus;
  tool_status?: string;
  provider?: string;
  results?: number;
  first_title?: string;
  first_url?: string;
  detail?: string;
};

export function parseSearchSmokeArgs(argv: string[]): { query?: string } {
  const eq = argv.find((arg) => arg.startsWith("--query="));
  if (eq) {
    const value = eq.slice("--query=".length);
    if (value) return { query: value };
  }
  const index = argv.indexOf("--query");
  const value = index !== -1 ? argv[index + 1] : undefined;
  if (value) return { query: value };
  return {};
}

/**
 * Run one real web search through the full chain: search_web -> ToolGateway ->
 * SearchProviderRegistry -> Bocha. No Pi LLM and no DeepSeek are involved.
 */
export async function runSearchSmoke(query: string): Promise<SearchSmokeResult> {
  const searchConfig = resolveSearchRuntimeConfig();
  const searchRegistry = createSearchProviderRegistryFromEnv();
  const providerReady = searchConfig
    ? (searchRegistry.get(searchConfig.provider)?.isConfigured ?? false)
    : false;
  if (!providerReady) {
    return {
      status: BOCHA_API_KEY_REQUIRED_FOR_REAL_SMOKE,
      detail: "BOCHA_API_KEY required for a real Bocha smoke",
    };
  }

  const registry = createAgentToolRegistry();
  const sink = new MemoryToolEventSink();
  const gateway = new ToolGateway(registry, sink);
  const result: ToolResult = await gateway.execute(
    "search_web",
    { query },
    {
      taskRunId: "smoke-search",
      agentSessionId: "smoke-search-session",
      agentRole: "INVESTIGATOR",
      signal: new AbortController().signal,
    },
  );

  if (result.status !== "SUCCESS") {
    return {
      status: SEARCH_SMOKE_FAILED,
      tool_status: result.status,
      detail: result.failure.message,
    };
  }

  const data = result.data as SearchWebOutput;
  const first = data.results[0];
  const ok =
    data.provider.length > 0 && data.results.length > 0 && Boolean(first?.title) && Boolean(first?.url);
  const outcome: SearchSmokeResult = {
    status: ok ? "OK" : SEARCH_SMOKE_FAILED,
    tool_status: "SUCCESS",
    provider: data.provider,
    results: data.results.length,
  };
  if (first?.title) outcome.first_title = first.title;
  if (first?.url) outcome.first_url = first.url;
  return outcome;
}

export function formatSearchSmokeResult(result: SearchSmokeResult): string {
  const lines = ["SEARCH_SMOKE", `status: ${result.status}`];
  if (result.tool_status) lines.push(`tool_status: ${result.tool_status}`);
  if (result.provider) lines.push(`provider: ${result.provider}`);
  if (result.results !== undefined) lines.push(`results: ${result.results}`);
  if (result.first_title) lines.push(`first_title: ${result.first_title}`);
  if (result.first_url) lines.push(`first_url: ${result.first_url}`);
  if (result.detail) lines.push(`detail: ${result.detail}`);
  return lines.join("\n");
}

async function main(): Promise<void> {
  const { query } = parseSearchSmokeArgs(process.argv.slice(2));
  if (!query) {
    process.stdout.write(SEARCH_QUERY_REQUIRED + "\n");
    process.exitCode = 2;
    return;
  }
  const result = await runSearchSmoke(query);
  process.stdout.write(formatSearchSmokeResult(result) + "\n");
  process.exitCode = result.status === "OK" ? 0 : 1;
}

const entryArg = process.argv[1];
const isEntryPoint = entryArg !== undefined && path.resolve(entryArg) === fileURLToPath(import.meta.url);

if (isEntryPoint) {
  void main();
}
