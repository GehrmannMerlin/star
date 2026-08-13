import { httpFetch, OversizedResponseError, type HttpResponse } from "@stellaris/crawler/http-fetch.js";
import { createSafeEgressPolicy } from "@stellaris/crawler/safe-egress.js";
import { ToolFailureCode, ToolFailureError } from "../../contracts/tool-failure-codes.js";
import type { PageFetcher, PageFetchRequest, PageFetchResponse } from "./page-fetcher.js";

/** 集中配置的 Agent Tool 安全上限（不散落 magic number）。 */
export const FETCH_PAGE_MAX_BYTES = 2 * 1024 * 1024;

const FETCH_PAGE_TIMEOUT_MS = 30_000;

function decodeBody(body: Uint8Array, contentType: string): string {
  const match = /charset=([\w-]+)/i.exec(contentType);
  const encoding = match?.[1];
  try {
    return new TextDecoder(encoding || "utf-8").decode(body);
  } catch {
    return new TextDecoder("utf-8").decode(body);
  }
}

/** Cheap protocol pre-check for a clean INVALID_INPUT; the authoritative guard
 *  (assertAllowedUrl + DNS-pinned lookup) stays inside the crawler and is never
 *  bypassed. */
function assertPublicHttpUrl(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new ToolFailureError({
      code: ToolFailureCode.INVALID_INPUT,
      message: `Invalid URL: ${url}`,
      retryable: false,
    });
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new ToolFailureError({
      code: ToolFailureCode.INVALID_INPUT,
      message: `Only http/https URLs are allowed: ${parsed.protocol}`,
      retryable: false,
    });
  }
}

/** Map a crawler HTTP transport error onto the shared tool failure taxonomy. */
function classifyHttpError(error: unknown, signal: AbortSignal): ToolFailureError {
  if (signal.aborted) {
    return new ToolFailureError({
      code: ToolFailureCode.ABORTED,
      message: "Page fetch aborted",
      retryable: false,
    });
  }
  if (error instanceof OversizedResponseError) {
    return new ToolFailureError({
      code: ToolFailureCode.INTERNAL_ERROR,
      message: error.message,
      retryable: false,
    });
  }
  const rawCode = error instanceof Error ? (error as { code?: unknown }).code : undefined;
  const code = typeof rawCode === "string" ? rawCode : "";
  const message = error instanceof Error ? error.message : String(error);

  if (code === "ETIMEDOUT" || /超时|timed ?out/i.test(message)) {
    return new ToolFailureError({ code: ToolFailureCode.TIMEOUT, message, retryable: true });
  }
  if (code === "ENOTFOUND" || code === "EAI_AGAIN" || /DNS 解析失败|DNS 解析无可用地址/i.test(message)) {
    return new ToolFailureError({ code: ToolFailureCode.DNS_ERROR, message, retryable: true });
  }
  if (/CERT|TLS|SSL/i.test(code) || /SSL|TLS|证书|CERT/i.test(message)) {
    return new ToolFailureError({ code: ToolFailureCode.TLS_ERROR, message, retryable: false });
  }
  if (/非法 URL|仅允许 http|禁止的协议|用户名|密码|非默认端口|禁止的端口/i.test(message)) {
    return new ToolFailureError({ code: ToolFailureCode.INVALID_INPUT, message, retryable: false });
  }
  if (/解析到禁止地址|禁止 localhost|禁止的地址段|禁止保留主机名|回环/i.test(message)) {
    return new ToolFailureError({ code: ToolFailureCode.ACCESS_DENIED, message, retryable: false });
  }
  return new ToolFailureError({ code: ToolFailureCode.INTERNAL_ERROR, message, retryable: false });
}

/**
 * Thin adapter exposing the crawler's httpFetch to the generic Agent Tool layer.
 *
 * Reuses the crawler's SSRF/egress guard (assertAllowedUrl + DNS-pinned lookup)
 * as the single authoritative safety boundary — it is never bypassed. HTTP 403
 * and 412 are surfaced as dedicated failure codes (future Browser fallback
 * signal); all other obtained responses are returned with their statusCode.
 */
export class CrawlerHttpAdapter implements PageFetcher {
  async fetchPage(request: PageFetchRequest): Promise<PageFetchResponse> {
    if (request.signal.aborted) {
      throw new ToolFailureError({
        code: ToolFailureCode.ABORTED,
        message: "Page fetch aborted",
        retryable: false,
      });
    }
    assertPublicHttpUrl(request.url);

    const policy = createSafeEgressPolicy({
      maxBytes: FETCH_PAGE_MAX_BYTES,
      maxTimeoutMs: FETCH_PAGE_TIMEOUT_MS,
    });

    let response: HttpResponse;
    try {
      response = await httpFetch(request.url, policy, { signal: request.signal });
    } catch (error) {
      throw classifyHttpError(error, request.signal);
    }

    if (response.status === 403) {
      throw new ToolFailureError({
        code: ToolFailureCode.HTTP_403,
        message: `Page fetch returned HTTP 403: ${request.url}`,
        retryable: false,
      });
    }
    if (response.status === 412) {
      throw new ToolFailureError({
        code: ToolFailureCode.HTTP_412,
        message: `Page fetch returned HTTP 412: ${request.url}`,
        retryable: false,
      });
    }

    const contentType = response.headers["content-type"] ?? "";
    return {
      requestedUrl: response.originalUrl,
      finalUrl: response.fetchUrl,
      statusCode: response.status,
      contentType,
      content: decodeBody(response.body, contentType),
      bytes: response.body.byteLength,
    };
  }
}
