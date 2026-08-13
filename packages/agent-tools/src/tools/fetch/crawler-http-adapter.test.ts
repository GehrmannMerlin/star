import { afterEach, describe, expect, it, vi } from "vitest";
import { ToolFailureCode } from "../../contracts/tool-failure-codes.js";
import { CrawlerHttpAdapter } from "./crawler-http-adapter.js";

const mocks = vi.hoisted(() => {
  class OversizedResponseError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "OversizedResponseError";
    }
  }
  return { httpFetch: vi.fn(), OversizedResponseError };
});

vi.mock("@stellaris/crawler/http-fetch.js", () => ({
  httpFetch: mocks.httpFetch,
  OversizedResponseError: mocks.OversizedResponseError,
}));

function responseFixture(overrides: Record<string, unknown> = {}) {
  return {
    fetchUrl: "https://final.example/page",
    originalUrl: "https://original.example/page",
    canonicalKey: "k",
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8" },
    body: new Uint8Array(Buffer.from("<h1>首页</h1>")),
    redirectChain: [],
    ...overrides,
  };
}

describe("CrawlerHttpAdapter", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("calls httpFetch with url + signal + production policy and maps a normal response with charset decode", async () => {
    const signal = new AbortController().signal;
    mocks.httpFetch.mockResolvedValue(responseFixture());
    const adapter = new CrawlerHttpAdapter();
    const out = await adapter.fetchPage({ url: "https://original.example/page", signal });

    expect(mocks.httpFetch).toHaveBeenCalledTimes(1);
    const [url, policy, ctx] = mocks.httpFetch.mock.calls[0] as unknown as [
      string,
      { mode: string; maxBytes: number },
      { signal: AbortSignal },
    ];
    expect(url).toBe("https://original.example/page");
    expect(policy.mode).toBe("production");
    expect(policy.maxBytes).toBe(2 * 1024 * 1024);
    expect(ctx.signal).toBe(signal);

    expect(out).toMatchObject({
      requestedUrl: "https://original.example/page",
      finalUrl: "https://final.example/page",
      statusCode: 200,
      contentType: "text/html; charset=utf-8",
      content: "<h1>首页</h1>",
      bytes: Buffer.byteLength("<h1>首页</h1>", "utf8"),
    });
  });

  it("maps a crawler timeout to TIMEOUT", async () => {
    mocks.httpFetch.mockRejectedValue(new Error("请求超时: https://x.example"));
    const adapter = new CrawlerHttpAdapter();
    await expect(
      adapter.fetchPage({ url: "https://x.example", signal: new AbortController().signal }),
    ).rejects.toMatchObject({ code: ToolFailureCode.TIMEOUT });
  });

  it("maps anti-bot statuses 403 and 412 to their dedicated failure codes", async () => {
    for (const [status, code] of [
      [403, ToolFailureCode.HTTP_403],
      [412, ToolFailureCode.HTTP_412],
    ] as const) {
      mocks.httpFetch.mockResolvedValue(responseFixture({ status }));
      const adapter = new CrawlerHttpAdapter();
      await expect(
        adapter.fetchPage({ url: "https://x.example", signal: new AbortController().signal }),
      ).rejects.toMatchObject({ code });
    }
  });

  it("fails closed with ABORTED for a pre-aborted signal without calling httpFetch", async () => {
    const controller = new AbortController();
    controller.abort();
    const adapter = new CrawlerHttpAdapter();
    await expect(
      adapter.fetchPage({ url: "https://x.example", signal: controller.signal }),
    ).rejects.toMatchObject({ code: ToolFailureCode.ABORTED });
    expect(mocks.httpFetch).not.toHaveBeenCalled();
  });

  it("rejects a non-http(s) url with INVALID_INPUT without calling httpFetch", async () => {
    const adapter = new CrawlerHttpAdapter();
    await expect(
      adapter.fetchPage({ url: "ftp://example.com/file", signal: new AbortController().signal }),
    ).rejects.toMatchObject({ code: ToolFailureCode.INVALID_INPUT });
    expect(mocks.httpFetch).not.toHaveBeenCalled();
  });

  it("maps an oversized response to INTERNAL_ERROR", async () => {
    mocks.httpFetch.mockRejectedValue(new mocks.OversizedResponseError("响应超过 2097152 字节上限"));
    const adapter = new CrawlerHttpAdapter();
    await expect(
      adapter.fetchPage({ url: "https://x.example", signal: new AbortController().signal }),
    ).rejects.toMatchObject({ code: ToolFailureCode.INTERNAL_ERROR });
  });
});
