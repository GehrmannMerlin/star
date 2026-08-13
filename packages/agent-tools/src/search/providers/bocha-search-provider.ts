import { ToolFailureCode, ToolFailureError } from "../../contracts/tool-failure-codes.js";
import type { SearchProvider, SearchRequest, SearchResult } from "../search-provider.js";

/** Bocha Web Search API endpoint (Web Search only, not AI Search). */
export const BOCHA_SEARCH_ENDPOINT = "https://api.bochaai.com/v1/web-search";

/** Runtime environment key holding the Bocha API secret. */
export const BOCHA_API_KEY_ENV = "BOCHA_API_KEY";

export type BochaSearchProviderConfig = {
  apiKey: string;
  endpoint?: string;
  fetchImpl?: typeof fetch;
};

type BochaWebPage = {
  name?: unknown;
  url?: unknown;
  summary?: unknown;
  snippet?: unknown;
  siteName?: unknown;
  datePublished?: unknown;
};

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function domainOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

function extractWebPages(payload: unknown): BochaWebPage[] {
  if (!payload || typeof payload !== "object") return [];
  const root = payload as {
    webPages?: { value?: unknown };
    data?: { webPages?: { value?: unknown } };
  };
  const sections = [root.webPages, root.data?.webPages];
  for (const section of sections) {
    if (section && Array.isArray(section.value)) {
      return section.value as BochaWebPage[];
    }
  }
  return [];
}

/**
 * Normalize a Bocha (Bing-compatible) response into Stellaris SearchResults.
 *
 * Missing fields fall back safely and entries without a URL are dropped; a
 * single malformed result never fails the whole search.
 */
export function normalizeBochaWebPages(payload: unknown): SearchResult[] {
  return extractWebPages(payload).flatMap((page, index) => {
    const url = stringValue(page.url);
    if (!url) return [];
    const result: SearchResult = {
      title: stringValue(page.name) ?? "(untitled)",
      url,
      snippet: stringValue(page.summary) ?? stringValue(page.snippet) ?? "",
      domain: domainOf(url),
      rank: index + 1,
    };
    const siteName = stringValue(page.siteName);
    const publishedAt = stringValue(page.datePublished);
    if (siteName) result.siteName = siteName;
    if (publishedAt) result.publishedAt = publishedAt;
    return [result];
  });
}

/**
 * Bocha Web Search adapter.
 *
 * All Bocha-specific knowledge (endpoint, request body, response shape, and
 * the BOCHA_API_KEY secret) is confined to this file and the composition root
 * that constructs it. The search_web tool and ToolGateway never see Bocha.
 */
export class BochaSearchProvider implements SearchProvider {
  readonly name = "bocha";

  private readonly apiKey: string;
  private readonly endpoint: string;
  private readonly fetchImpl: typeof fetch;

  constructor(config: BochaSearchProviderConfig) {
    this.apiKey = config.apiKey;
    this.endpoint = config.endpoint ?? BOCHA_SEARCH_ENDPOINT;
    this.fetchImpl = config.fetchImpl ?? fetch;
  }

  get isConfigured(): boolean {
    return this.apiKey.length > 0;
  }

  async search(request: SearchRequest, signal: AbortSignal): Promise<SearchResult[]> {
    if (!this.isConfigured) {
      throw new ToolFailureError({
        code: ToolFailureCode.SEARCH_PROVIDER_NOT_CONFIGURED,
        message: "Bocha search provider is not configured (BOCHA_API_KEY missing)",
        retryable: false,
      });
    }

    const body = {
      query: request.query,
      freshness: request.freshness ?? "noLimit",
      summary: true,
      count: request.limit ?? 8,
    };

    let response: Response;
    try {
      response = await this.fetchImpl(this.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(body),
        signal,
      });
    } catch (error) {
      if (signal.aborted) {
        throw new ToolFailureError({
          code: ToolFailureCode.ABORTED,
          message: "Search aborted",
          retryable: false,
        });
      }
      throw new ToolFailureError({
        code: ToolFailureCode.SEARCH_REQUEST_FAILED,
        message:
          error instanceof Error
            ? `Bocha search request failed: ${error.message}`
            : "Bocha search request failed",
        retryable: true,
      });
    }

    if (response.status === 401 || response.status === 403) {
      throw new ToolFailureError({
        code: ToolFailureCode.SEARCH_AUTH_FAILED,
        message: `Bocha search authentication failed (HTTP ${response.status})`,
        retryable: false,
      });
    }
    if (response.status === 429) {
      throw new ToolFailureError({
        code: ToolFailureCode.SEARCH_RATE_LIMITED,
        message: "Bocha search rate limit exceeded (HTTP 429)",
        retryable: true,
      });
    }
    if (!response.ok) {
      throw new ToolFailureError({
        code: ToolFailureCode.SEARCH_REQUEST_FAILED,
        message: `Bocha search request failed (HTTP ${response.status})`,
        retryable: response.status >= 500,
      });
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new ToolFailureError({
        code: ToolFailureCode.SEARCH_REQUEST_FAILED,
        message: "Bocha search returned an unparseable response body",
        retryable: false,
      });
    }
    return normalizeBochaWebPages(payload);
  }
}
