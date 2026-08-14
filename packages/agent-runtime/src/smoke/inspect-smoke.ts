import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createAgentToolRegistry,
  MemoryToolEventSink,
  ToolGateway,
  type ToolResult,
} from "@stellaris/agent-tools";
import type { PageFetchResponse, PageInspectionResult } from "@stellaris/agent-tools";

export const INSPECT_URL_REQUIRED = "INSPECT_URL_REQUIRED" as const;
export const INSPECT_SMOKE_FAILED = "INSPECT_SMOKE_FAILED" as const;

export type InspectSmokeStatus = "OK" | typeof INSPECT_URL_REQUIRED | typeof INSPECT_SMOKE_FAILED;

export type InspectSmokeResult = {
  status: InspectSmokeStatus;
  fetch_status?: string;
  inspect_status?: string;
  final_url?: string;
  title?: string | null;
  title_present?: boolean;
  links_count?: number;
  headings_equivalent?: boolean;
  text_present?: boolean;
  fetch_start_events?: number;
  fetch_success_events?: number;
  inspect_start_events?: number;
  inspect_success_events?: number;
  detail?: string;
};

export function parseInspectSmokeArgs(argv: string[]): { url?: string } {
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
 * Run one real chain: fetch_page -> ToolGateway -> CrawlerHttpAdapter -> crawler
 * httpFetch, then inspect_page -> ToolGateway -> CrawlerPageInspectionAdapter ->
 * extractPageFacts. No Pi LLM and no Browser involved.
 */
export async function runInspectSmoke(url: string): Promise<InspectSmokeResult> {
  const registry = createAgentToolRegistry();
  const sink = new MemoryToolEventSink();
  const gateway = new ToolGateway(registry, sink);
  const context = {
    taskRunId: "smoke-inspect",
    agentSessionId: "smoke-inspect-session",
    agentRole: "INVESTIGATOR" as const,
    signal: new AbortController().signal,
  };

  const fetchResult: ToolResult = await gateway.execute("fetch_page", { url }, context);
  if (fetchResult.status !== "SUCCESS") {
    return {
      status: INSPECT_SMOKE_FAILED,
      fetch_status: fetchResult.status,
      detail: fetchResult.failure.message,
    };
  }
  const fetchData = fetchResult.data as PageFetchResponse;

  const inspectResult: ToolResult = await gateway.execute(
    "inspect_page",
    { url: fetchData.finalUrl, content: fetchData.content },
    context,
  );
  if (inspectResult.status !== "SUCCESS") {
    return {
      status: INSPECT_SMOKE_FAILED,
      inspect_status: inspectResult.status,
      detail: inspectResult.failure.message,
    };
  }
  const inspectData = inspectResult.data as PageInspectionResult;

  const fetchStart = sink.starts.filter((e) => e.toolName === "fetch_page").length;
  const fetchSuccess = sink.successes.filter((e) => e.toolName === "fetch_page").length;
  const inspectStart = sink.starts.filter((e) => e.toolName === "inspect_page").length;
  const inspectSuccess = sink.successes.filter((e) => e.toolName === "inspect_page").length;
  // headings: array, or an existing equivalent structural observation. A portal
  // homepage like gov.cn has no leadership table, so links are the equivalent.
  const headingsEquivalent =
    Array.isArray(inspectData.headings) ||
    inspectData.leadershipMembers.length > 0 ||
    inspectData.links.length > 0;
  const ok =
    (inspectData.title ?? "").length > 0 &&
    Array.isArray(inspectData.links) &&
    headingsEquivalent &&
    inspectData.textPreview.length > 0 &&
    fetchStart === 1 &&
    fetchSuccess === 1 &&
    inspectStart === 1 &&
    inspectSuccess === 1;

  return {
    status: ok ? "OK" : INSPECT_SMOKE_FAILED,
    fetch_status: "SUCCESS",
    inspect_status: "SUCCESS",
    final_url: fetchData.finalUrl,
    title: inspectData.title,
    title_present: (inspectData.title ?? "").length > 0,
    links_count: inspectData.linkCount,
    headings_equivalent: headingsEquivalent,
    text_present: inspectData.textPreview.length > 0,
    fetch_start_events: fetchStart,
    fetch_success_events: fetchSuccess,
    inspect_start_events: inspectStart,
    inspect_success_events: inspectSuccess,
  };
}

export function formatInspectSmokeResult(result: InspectSmokeResult): string {
  const lines = ["INSPECT_SMOKE", `status: ${result.status}`];
  if (result.fetch_status) lines.push(`fetch_status: ${result.fetch_status}`);
  if (result.inspect_status) lines.push(`inspect_status: ${result.inspect_status}`);
  if (result.final_url) lines.push(`final_url: ${result.final_url}`);
  if (result.title_present !== undefined) lines.push(`title_present: ${result.title_present ? "YES" : "NO"}`);
  if (result.title !== undefined) lines.push(`title: ${result.title}`);
  if (result.links_count !== undefined) lines.push(`links_count: ${result.links_count}`);
  if (result.headings_equivalent !== undefined) lines.push(`headings_equivalent: ${result.headings_equivalent ? "YES" : "NO"}`);
  if (result.text_present !== undefined) lines.push(`text_present: ${result.text_present ? "YES" : "NO"}`);
  if (result.fetch_start_events !== undefined) lines.push(`fetch_start_events: ${result.fetch_start_events}`);
  if (result.fetch_success_events !== undefined) lines.push(`fetch_success_events: ${result.fetch_success_events}`);
  if (result.inspect_start_events !== undefined) lines.push(`inspect_start_events: ${result.inspect_start_events}`);
  if (result.inspect_success_events !== undefined) lines.push(`inspect_success_events: ${result.inspect_success_events}`);
  if (result.detail) lines.push(`detail: ${result.detail}`);
  return lines.join("\n");
}

async function main(): Promise<void> {
  const { url } = parseInspectSmokeArgs(process.argv.slice(2));
  if (!url) {
    process.stdout.write(INSPECT_URL_REQUIRED + "\n");
    process.exitCode = 2;
    return;
  }
  const result = await runInspectSmoke(url);
  process.stdout.write(formatInspectSmokeResult(result) + "\n");
  process.exitCode = result.status === "OK" ? 0 : 1;
}

const entryArg = process.argv[1];
const isEntryPoint = entryArg !== undefined && path.resolve(entryArg) === fileURLToPath(import.meta.url);

if (isEntryPoint) {
  void main();
}
