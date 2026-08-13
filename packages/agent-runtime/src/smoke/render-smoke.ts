import path from "node:path";
import { fileURLToPath } from "node:url";
import { BrowserPool } from "@stellaris/crawler/browser/render.js";
import {
  createAgentToolRegistry,
  createRenderPageTool,
  CrawlerBrowserAdapter,
  MemoryToolEventSink,
  ToolGateway,
  type ToolResult,
} from "@stellaris/agent-tools";
import type { PageRenderResponse } from "@stellaris/agent-tools";

export const RENDER_URL_REQUIRED = "RENDER_URL_REQUIRED" as const;
export const RENDER_SMOKE_FAILED = "RENDER_SMOKE_FAILED" as const;

export type RenderSmokeStatus = "OK" | typeof RENDER_URL_REQUIRED | typeof RENDER_SMOKE_FAILED;

export type RenderSmokeResult = {
  status: RenderSmokeStatus;
  tool_status?: string;
  final_url?: string;
  status_code?: number;
  title?: string | null;
  content_present?: boolean;
  content_bytes?: number;
  truncated?: boolean;
  start_events?: number;
  success_events?: number;
  browser_released?: boolean;
  detail?: string;
};

export function parseRenderSmokeArgs(argv: string[]): { url?: string } {
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
 * Run one real browser render through the full chain: render_page -> ToolGateway ->
 * CrawlerBrowserAdapter -> existing BrowserPool -> Chromium. No Pi LLM involved.
 * The caller-owned pool is closed here and its release is verified via isOpen().
 */
export async function runRenderSmoke(url: string): Promise<RenderSmokeResult> {
  const pool = new BrowserPool();
  const renderer = new CrawlerBrowserAdapter({ pool });
  const registry = createAgentToolRegistry({ renderPageTool: createRenderPageTool({ renderer }) });
  const sink = new MemoryToolEventSink();
  const gateway = new ToolGateway(registry, sink);
  const result: ToolResult = await gateway.execute(
    "render_page",
    { url },
    {
      taskRunId: "smoke-render",
      agentSessionId: "smoke-render-session",
      agentRole: "INVESTIGATOR",
      signal: new AbortController().signal,
    },
  );
  await pool.close();
  const browserReleased = !pool.isOpen();

  if (result.status !== "SUCCESS") {
    return {
      status: RENDER_SMOKE_FAILED,
      tool_status: result.status,
      detail: result.failure.message,
      browser_released: browserReleased,
    };
  }

  const data = result.data as PageRenderResponse;
  const startEvents = sink.starts.filter((event) => event.toolName === "render_page").length;
  const successEvents = sink.successes.filter((event) => event.toolName === "render_page").length;
  const ok =
    data.statusCode > 0 &&
    data.finalUrl.length > 0 &&
    data.content.length > 0 &&
    startEvents === 1 &&
    successEvents === 1 &&
    browserReleased;
  return {
    status: ok ? "OK" : RENDER_SMOKE_FAILED,
    tool_status: "SUCCESS",
    final_url: data.finalUrl,
    status_code: data.statusCode,
    title: data.title,
    content_present: data.content.length > 0,
    content_bytes: data.bytes,
    truncated: data.truncated,
    start_events: startEvents,
    success_events: successEvents,
    browser_released: browserReleased,
  };
}

export function formatRenderSmokeResult(result: RenderSmokeResult): string {
  const lines = ["RENDER_SMOKE", `status: ${result.status}`];
  if (result.tool_status) lines.push(`tool_status: ${result.tool_status}`);
  if (result.final_url) lines.push(`final_url: ${result.final_url}`);
  if (result.status_code !== undefined) lines.push(`status_code: ${result.status_code}`);
  if (result.title !== undefined) lines.push(`title: ${result.title}`);
  if (result.content_present !== undefined) lines.push(`content_present: ${result.content_present ? "YES" : "NO"}`);
  if (result.content_bytes !== undefined) lines.push(`content_bytes: ${result.content_bytes}`);
  if (result.truncated !== undefined) lines.push(`truncated: ${result.truncated ? "YES" : "NO"}`);
  if (result.start_events !== undefined) lines.push(`start_events: ${result.start_events}`);
  if (result.success_events !== undefined) lines.push(`success_events: ${result.success_events}`);
  if (result.browser_released !== undefined) lines.push(`browser_released: ${result.browser_released ? "YES" : "NO"}`);
  if (result.detail) lines.push(`detail: ${result.detail}`);
  return lines.join("\n");
}

async function main(): Promise<void> {
  const { url } = parseRenderSmokeArgs(process.argv.slice(2));
  if (!url) {
    process.stdout.write(RENDER_URL_REQUIRED + "\n");
    process.exitCode = 2;
    return;
  }
  const result = await runRenderSmoke(url);
  process.stdout.write(formatRenderSmokeResult(result) + "\n");
  process.exitCode = result.status === "OK" ? 0 : 1;
}

const entryArg = process.argv[1];
const isEntryPoint = entryArg !== undefined && path.resolve(entryArg) === fileURLToPath(import.meta.url);

if (isEntryPoint) {
  void main();
}
