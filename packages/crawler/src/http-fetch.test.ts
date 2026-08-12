import { describe, it, expect } from "vitest";
import { join } from "node:path";
import { createFixtureServer } from "./testing/fixture-server.js";
import { httpFetch, OversizedResponseError } from "./http-fetch.js";
import { createSafeEgressPolicy } from "./safe-egress.js";

describe("http-fetch 离线抓取", () => {
  it("离线 fixture 抓取成功并保留 originalUrl/fetchUrl/canonicalKey", async () => {
    const srv = await createFixtureServer([{ pathPrefix: "/golden", dir: join(import.meta.dirname, "golden") }]);
    const policy = createSafeEgressPolicy({ mode: "offline-fixture", allowedTestPorts: new Set([srv.basePort]) });
    const res = await httpFetch(`${srv.url}/golden/collection.html`, policy);
    expect(res.status).toBe(200);
    expect(res.originalUrl).toBe(`${srv.url}/golden/collection.html`);
    expect(res.fetchUrl).toBe(res.originalUrl);
    expect(res.canonicalKey).toBeTruthy();
    await srv.close();
  });

  it("重定向被逐跳复核，最终 URL 与 redirectChain 记录", async () => {
    // fixture 提供 /golden/redirect -> 302 -> /golden/collection.html
    const srv = await createFixtureServer([{ pathPrefix: "/golden", dir: join(import.meta.dirname, "golden") }]);
    const policy = createSafeEgressPolicy({ mode: "offline-fixture", allowedTestPorts: new Set([srv.basePort]) });
    const res = await httpFetch(`${srv.url}/golden/redirect`, policy);
    expect(res.status).toBe(200);
    expect(res.redirectChain.length).toBeGreaterThan(0);
    expect(res.fetchUrl).toContain("collection.html");
    await srv.close();
  });

  it("超过重定向上限被拒绝", async () => {
    const srv = await createFixtureServer([{ pathPrefix: "/golden", dir: join(import.meta.dirname, "golden") }]);
    const policy = createSafeEgressPolicy({
      mode: "offline-fixture",
      allowedTestPorts: new Set([srv.basePort]),
      maxRedirects: 2,
    });
    // redirect-loop: /golden/loop -> 302 -> /golden/loop
    await expect(httpFetch(`${srv.url}/golden/loop`, policy)).rejects.toThrow(/重定向|redirect/i);
    await srv.close();
  });

  it("超限响应被截断拒绝", async () => {
    const srv = await createFixtureServer([{ pathPrefix: "/golden", dir: join(import.meta.dirname, "golden") }]);
    const policy = createSafeEgressPolicy({
      mode: "offline-fixture",
      allowedTestPorts: new Set([srv.basePort]),
      maxBytes: 1024,
    });
    // collection.html 小于 1KB？用一个超大文件：golden/big.txt
    await expect(httpFetch(`${srv.url}/golden/big.txt`, policy)).rejects.toThrow(OversizedResponseError);
    await srv.close();
  });
});

describe("P6-T3 爬虫陷阱防护", () => {
  it("URL 路径深度超限 → 拒绝（分页陷阱）", async () => {
    const srv = await createFixtureServer([{ pathPrefix: "/golden", dir: join(import.meta.dirname, "golden") }]);
    const policy = createSafeEgressPolicy({ mode: "offline-fixture", allowedTestPorts: new Set([srv.basePort]) });
    // 构造超深路径（>/8 段）。
    const deep = `${srv.url}/a/b/c/d/e/f/g/h/i/j/collection.html`;
    await expect(httpFetch(deep, policy)).rejects.toThrow(/分页陷阱/);
    await srv.close();
  });

  it("正常深度的 URL 正常抓取", async () => {
    const srv = await createFixtureServer([{ pathPrefix: "/golden", dir: join(import.meta.dirname, "golden") }]);
    const policy = createSafeEgressPolicy({ mode: "offline-fixture", allowedTestPorts: new Set([srv.basePort]) });
    const res = await httpFetch(`${srv.url}/golden/collection.html`, policy);
    expect(res.status).toBe(200);
    await srv.close();
  });
});
