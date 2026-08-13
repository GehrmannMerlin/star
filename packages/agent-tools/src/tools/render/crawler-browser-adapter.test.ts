import { describe, expect, it } from "vitest";
import { ToolFailureCode } from "../../contracts/tool-failure-codes.js";
import { FETCH_PAGE_MAX_BYTES } from "../fetch/crawler-http-adapter.js";
import { CrawlerBrowserAdapter, type RenderPoolLike } from "./crawler-browser-adapter.js";

const fakeResult = {
  fetchUrl: "https://www.gov.cn/",
  title: "中国政府网",
  bodyText: "hello",
  html: new TextEncoder().encode("<html><body>hi</body></html>"),
  waitSignals: [],
  statusCode: 200,
};

const ctrl = () => new AbortController();

describe("CrawlerBrowserAdapter", () => {
  it("passes url + signal into the injected pool and normalizes the result", async () => {
    const controller = ctrl();
    const pool: RenderPoolLike = {
      async render(url, opts) {
        expect(url).toBe("https://www.gov.cn/");
        expect(opts.signal).toBe(controller.signal);
        return fakeResult;
      },
      async close() {
        throw new Error("an injected pool must not be closed by the adapter");
      },
    };
    const adapter = new CrawlerBrowserAdapter({ pool, verifyUrl: async () => {} });
    const out = await adapter.renderPage({ url: "https://www.gov.cn/", signal: controller.signal });
    expect(out).toMatchObject({
      requestedUrl: "https://www.gov.cn/",
      finalUrl: "https://www.gov.cn/",
      statusCode: 200,
      title: "中国政府网",
      truncated: false,
    });
    expect(out.content).toContain("<html>");
  });

  it("truncates content over the shared cap", async () => {
    const big = new TextEncoder().encode("<html>" + "x".repeat(3 * 1024 * 1024) + "</html>");
    const pool: RenderPoolLike = {
      async render() {
        return { ...fakeResult, html: big };
      },
      async close() {},
    };
    const adapter = new CrawlerBrowserAdapter({ pool, verifyUrl: async () => {} });
    const out = await adapter.renderPage({ url: "https://www.gov.cn/", signal: ctrl().signal });
    expect(out.truncated).toBe(true);
    expect(out.bytes).toBe(FETCH_PAGE_MAX_BYTES);
  });

  it("returns ABORTED when the signal is aborted mid-render", async () => {
    const controller = ctrl();
    const pool: RenderPoolLike = {
      async render() {
        controller.abort();
        throw new Error("Target closed");
      },
      async close() {},
    };
    const adapter = new CrawlerBrowserAdapter({ pool, verifyUrl: async () => {} });
    await expect(
      adapter.renderPage({ url: "https://www.gov.cn/", signal: controller.signal }),
    ).rejects.toMatchObject({ code: ToolFailureCode.ABORTED });
  });

  it("maps a goto timeout to TIMEOUT", async () => {
    const pool: RenderPoolLike = {
      async render() {
        throw new Error("Navigation Timeout Exceeded");
      },
      async close() {},
    };
    const adapter = new CrawlerBrowserAdapter({ pool, verifyUrl: async () => {} });
    await expect(
      adapter.renderPage({ url: "https://www.gov.cn/", signal: ctrl().signal }),
    ).rejects.toMatchObject({ code: ToolFailureCode.TIMEOUT });
  });

  it("blocks a private/blocked top-level URL with ACCESS_DENIED", async () => {
    const pool: RenderPoolLike = {
      async render() {
        throw new Error("must not launch for a blocked url");
      },
      async close() {},
    };
    const adapter = new CrawlerBrowserAdapter({
      pool,
      verifyUrl: async () => {
        throw new Error("禁止 localhost");
      },
    });
    await expect(
      adapter.renderPage({ url: "http://localhost/", signal: ctrl().signal }),
    ).rejects.toMatchObject({ code: ToolFailureCode.ACCESS_DENIED });
  });
});
