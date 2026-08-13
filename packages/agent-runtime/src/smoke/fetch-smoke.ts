import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createAgentToolRegistry,
  MemoryToolEventSink,
  ToolGateway,
  type ToolResult,
} from "@stellaris/agent-tools";
import type { PageFetchResponse } from "@stellaris/agent-tools";

export const FETCH_URL_REQUIRED = "FETCH_URL_REQUIRED" as const;
export const FETCH_SMOKE_FAILED = "FETCH_SMOKE_FAILED" as const;

export type FetchSmokeStatus = "OK" | typeof FETCH_URL_REQUIRED | typeof FETCH_SMOKE_FAILED;

export type FetchSmokeResult = {
  status: FetchSmokeStatus;
  tool_status?: string;
  status_code?: number;
  final_url?: string;
  content_present?: boolean;
  content_bytes?: number;
  start_events?: number;
  success_events?: number;
  detail?: string;
};

export function parseFetchSmokeArgs(argv: string[]): { url?: string } {
  const eq = argv.find((arg) => arg.startsWith("--url="));
  if (eq) {
    const value = eq.slice("--url=".length);
    if (value) return { url: value };
  }
  const index = argv.indexOf("--url");
  const value = index !== -1 ? argv[index + 1] : undefined;
  if (value) return { url: value };
  return {};
}

/**
 * Run one real HTTP fetch through the full chain: fetch_page -> ToolGateway ->
 * CrawlerHttpAdapter -> crawler httpFetch. No Pi LLM and no DeepSeek involved.
 */
export async function runFetchSmoke(url: string): Promise<FetchSmokeResult> {
  const registry = createAgentToolRegistry();
  const sink = new MemoryToolEventSink();
  const gateway = new ToolGateway(registry, sink);
  const result: ToolResult = await gateway.execute(
    "fetch_page",
    { url },
    {
      taskRunId: "smoke-fetch",
      agentSessionId: "smoke-fetch-session",
      agentRole: "INVESTIGATOR",
      signal: new AbortController().signal,
    },
  );

  if (result.status !== "SUCCESS") {
    return {
      status: FETCH_SMOKE_FAILED,
      tool_status: result.status,
      detail: result.failure.message,
    };
  }

  const data = result.data as PageFetchResponse;
  const startEvents = sink.starts.filter((event) => event.toolName === "fetch_page").length;
  const successEvents = sink.successes.filter((event) => event.toolName === "fetch_page").length;
  const ok =
    data.statusCode > 0 &&
    data.finalUrl.length > 0 &&
    data.content.length > 0 &&
    startEvents === 1 &&
    successEvents === 1;
  return {
    status: ok ? "OK" : FETCH_SMOKE_FAILED,
    tool_status: "SUCCESS",
    status_code: data.statusCode,
    final_url: data.finalUrl,
    content_present: data.content.length > 0,
    content_bytes: data.bytes,
    start_events: startEvents,
    success_events: successEvents,
  };
}

export function formatFetchSmokeResult(result: FetchSmokeResult): string {
  const lines = ["FETCH_SMOKE", `status: ${result.status}`];
  if (result.tool_status) lines.push(`tool_status: ${result.tool_status}`);
  if (result.status_code !== undefined) lines.push(`status_code: ${result.status_code}`);
  if (result.final_url) lines.push(`final_url: ${result.final_url}`);
  if (result.content_present !== undefined) lines.push(`content_present: ${result.content_present ? "YES" : "NO"}`);
  if (result.content_bytes !== undefined) lines.push(`content_bytes: ${result.content_bytes}`);
  if (result.start_events !== undefined) lines.push(`start_events: ${result.start_events}`);
  if (result.success_events !== undefined) lines.push(`success_events: ${result.success_events}`);
  if (result.detail) lines.push(`detail: ${result.detail}`);
  return lines.join("\n");
}

async function main(): Promise<void> {
  const { url } = parseFetchSmokeArgs(process.argv.slice(2));
  if (!url) {
    process.stdout.write(FETCH_URL_REQUIRED + "\n");
    process.exitCode = 2;
    return;
  }
  const result = await runFetchSmoke(url);
  process.stdout.write(formatFetchSmokeResult(result) + "\n");
  process.exitCode = result.status === "OK" ? 0 : 1;
}

const entryArg = process.argv[1];
const isEntryPoint = entryArg !== undefined && path.resolve(entryArg) === fileURLToPath(import.meta.url);

if (isEntryPoint) {
  void main();
}
