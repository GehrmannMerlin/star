import { BrowserPool, type RenderResult } from "@stellaris/crawler/browser/render.js";
import { dnsLookup } from "@stellaris/crawler/dns-lookup.js";
import { assertAllowedUrl, createSafeEgressPolicy } from "@stellaris/crawler/safe-egress.js";
import { ToolFailureCode, ToolFailureError } from "../../contracts/tool-failure-codes.js";
import {
  assertPublicHttpUrl,
  FETCH_PAGE_MAX_BYTES,
} from "../fetch/crawler-http-adapter.js";
import type { PageRenderRequest, PageRenderResponse, PageRenderer } from "./page-renderer.js";

/** Rendered DOM is always HTML text; charset is normalized by page.content(). */
const RENDER_CONTENT_TYPE = "text/html; charset=utf-8";

/** The BrowserPool surface used by the adapter (injectable in tests). */
export type RenderPoolLike = {
  render(url: string, opts: { signal?: AbortSignal }): Promise<RenderResult>;
  close(): Promise<void>;
};

export type CrawlerBrowserAdapterDeps = {
  pool?: RenderPoolLike;
  /** Authoritative top-level URL check. Tests inject a stub; default is the real guard. */
  verifyUrl?: (url: string) => Promise<void>;
};

/** Reuses the crawler SSRF/egress guard (assertAllowedUrl + DNS-pinned lookup) as the
 *  single authoritative boundary for the top-level URL — never bypassed. */
const defaultVerifyUrl = async (url: string): Promise<void> => {
  assertPublicHttpUrl(url);
  const policy = createSafeEgressPolicy();
  assertAllowedUrl(url, policy);
  await dnsLookup(new URL(url).hostname, policy);
};

/** Map a crawler browser error onto the shared tool failure taxonomy. */
function classifyBrowserError(error: unknown, signal: AbortSignal): ToolFailureError {
  if (signal.aborted) {
    return new ToolFailureError({
      code: ToolFailureCode.ABORTED,
      message: "Page render aborted",
      retryable: false,
    });
  }
  const message = error instanceof Error ? error.message : String(error);

  if (
    /Executable doesn't exist|Executable path doesn't exist|Failed to launch|Missing X server|spawn .* ENOENT/i.test(
      message,
    )
  ) {
    return new ToolFailureError({
      code: ToolFailureCode.BROWSER_LAUNCH_FAILED,
      message,
      retryable: false,
    });
  }
  if (/DNS 解析失败|net::ERR_NAME_NOT_RESOLVED|net::ERR_ADDRESS_UNREACHABLE/i.test(message)) {
    return new ToolFailureError({ code: ToolFailureCode.DNS_ERROR, message, retryable: true });
  }
  if (/Timeout|timed ?out|net::ERR_TIMED_OUT|net::ERR_CONNECTION_TIMED_OUT/i.test(message)) {
    return new ToolFailureError({ code: ToolFailureCode.TIMEOUT, message, retryable: true });
  }
  if (/非法 URL|仅允许 http|禁止的协议|非默认端口|测试端口未登记/i.test(message)) {
    return new ToolFailureError({ code: ToolFailureCode.INVALID_INPUT, message, retryable: false });
  }
  if (/禁止|localhost|回环|禁止的地址段|禁止保留主机名/i.test(message)) {
    return new ToolFailureError({ code: ToolFailureCode.ACCESS_DENIED, message, retryable: false });
  }
  if (/net::ERR_|Target closed|Navigation failed/i.test(message)) {
    return new ToolFailureError({
      code: ToolFailureCode.BROWSER_NAVIGATION_FAILED,
      message,
      retryable: false,
    });
  }
  return new ToolFailureError({ code: ToolFailureCode.INTERNAL_ERROR, message, retryable: false });
}

function normalizeRenderResult(requestedUrl: string, result: RenderResult): PageRenderResponse {
  const totalBytes = result.html.byteLength;
  const truncated = totalBytes > FETCH_PAGE_MAX_BYTES;
  const bytes = truncated ? FETCH_PAGE_MAX_BYTES : totalBytes;
  const content = new TextDecoder("utf-8").decode(result.html.subarray(0, FETCH_PAGE_MAX_BYTES));
  return {
    requestedUrl,
    finalUrl: result.fetchUrl,
    statusCode: result.statusCode,
    contentType: RENDER_CONTENT_TYPE,
    content,
    bytes,
    truncated,
    title: result.title,
  };
}

/**
 * Thin adapter exposing the crawler BrowserPool to the generic Agent Tool layer.
 *
 * Reuses the existing BrowserPool lifecycle — no second chromium.launch. The
 * top-level URL goes through the crawler's authoritative egress guard, and the
 * caller AbortSignal is passed into the pool so an abort closes the context.
 */
export class CrawlerBrowserAdapter implements PageRenderer {
  constructor(private readonly deps: CrawlerBrowserAdapterDeps = {}) {}

  async renderPage(request: PageRenderRequest): Promise<PageRenderResponse> {
    if (request.signal.aborted) {
      throw new ToolFailureError({
        code: ToolFailureCode.ABORTED,
        message: "Page render aborted",
        retryable: false,
      });
    }

    const verifyUrl = this.deps.verifyUrl ?? defaultVerifyUrl;
    try {
      await verifyUrl(request.url);
    } catch (error) {
      throw classifyBrowserError(error, request.signal);
    }

    const ownsPool = this.deps.pool === undefined;
    const pool = this.deps.pool ?? new BrowserPool();
    try {
      const result = await pool.render(request.url, { signal: request.signal });
      if (request.signal.aborted) {
        // Deterministic ABORTED even when navigation raced ahead of the abort listener.
        throw new ToolFailureError({
          code: ToolFailureCode.ABORTED,
          message: "Page render aborted",
          retryable: false,
        });
      }
      return normalizeRenderResult(request.url, result);
    } catch (error) {
      throw classifyBrowserError(error, request.signal);
    } finally {
      if (ownsPool) await pool.close().catch(() => {});
    }
  }
}
