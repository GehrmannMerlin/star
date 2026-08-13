import { describe, expect, it } from "vitest";
import { ToolFailureCode } from "../../contracts/tool-failure-codes.js";
import { BochaSearchProvider, normalizeBochaWebPages } from "./bocha-search-provider.js";

function mockResponse(status: number, body?: unknown): Response {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: async () => body,
  } as unknown as Response;
}

describe("BochaSearchProvider", () => {
  it("normalizes a Bing-style webPages.value response into SearchResults", () => {
    const results = normalizeBochaWebPages({
      webPages: {
        value: [
          {
            name: "安徽省人民政府",
            url: "https://www.ah.gov.cn/",
            summary: "安徽省人民政府门户网站。",
            siteName: "安徽省人民政府",
            datePublished: "2026-08-01T00:00:00.000Z",
          },
          { name: "Second", url: "https://example.com/page", snippet: "fallback snippet" },
          { url: "" },
        ],
      },
    });
    expect(results).toHaveLength(2);
    expect(results[0]).toEqual({
      title: "安徽省人民政府",
      url: "https://www.ah.gov.cn/",
      snippet: "安徽省人民政府门户网站。",
      domain: "www.ah.gov.cn",
      rank: 1,
      siteName: "安徽省人民政府",
      publishedAt: "2026-08-01T00:00:00.000Z",
    });
    expect(results[1]).toMatchObject({
      title: "Second",
      snippet: "fallback snippet",
      rank: 2,
    });
  });

  it("prefers summary over snippet and tolerates missing optional fields", async () => {
    const provider = new BochaSearchProvider({
      apiKey: "test-key",
      fetchImpl: async () =>
        mockResponse(200, {
          webPages: {
            value: [{ name: "X", url: "https://x.example/", summary: "long", snippet: "short" }],
          },
        }),
    });
    const results = await provider.search({ query: "x", limit: 1 }, new AbortController().signal);
    expect(results[0]?.snippet).toBe("long");
    expect(results[0]?.siteName).toBeUndefined();
    expect(results[0]?.domain).toBe("x.example");
  });

  it("maps 401 and 403 to SEARCH_AUTH_FAILED", async () => {
    for (const status of [401, 403]) {
      const provider = new BochaSearchProvider({
        apiKey: "test-key",
        fetchImpl: async () => mockResponse(status),
      });
      await expect(
        provider.search({ query: "x" }, new AbortController().signal),
      ).rejects.toMatchObject({ code: ToolFailureCode.SEARCH_AUTH_FAILED });
    }
  });

  it("maps 429 to SEARCH_RATE_LIMITED", async () => {
    const provider = new BochaSearchProvider({
      apiKey: "test-key",
      fetchImpl: async () => mockResponse(429),
    });
    await expect(
      provider.search({ query: "x" }, new AbortController().signal),
    ).rejects.toMatchObject({ code: ToolFailureCode.SEARCH_RATE_LIMITED });
  });

  it("maps an unexpected HTTP failure to SEARCH_REQUEST_FAILED", async () => {
    const provider = new BochaSearchProvider({
      apiKey: "test-key",
      fetchImpl: async () => mockResponse(500),
    });
    await expect(
      provider.search({ query: "x" }, new AbortController().signal),
    ).rejects.toMatchObject({ code: ToolFailureCode.SEARCH_REQUEST_FAILED });
  });

  it("fails closed with SEARCH_PROVIDER_NOT_CONFIGURED without an api key", async () => {
    const provider = new BochaSearchProvider({ apiKey: "" });
    expect(provider.isConfigured).toBe(false);
    await expect(
      provider.search({ query: "x" }, new AbortController().signal),
    ).rejects.toMatchObject({ code: ToolFailureCode.SEARCH_PROVIDER_NOT_CONFIGURED });
  });
});
