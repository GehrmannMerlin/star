import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { join } from "node:path";
import { httpFetch } from "./http-fetch.js";
import { createFixtureServer } from "./testing/fixture-server.js";
import { createSafeEgressPolicy } from "./safe-egress.js";
import { PolitenessGate } from "./polite/politeness.js";
import { HttpCache } from "./http-cache.js";

describe("httpFetch FetchContext（P1 性能接入）", () => {
  let srv: Awaited<ReturnType<typeof createFixtureServer>>;
  let policy: ReturnType<typeof createSafeEgressPolicy>;
  let base: string;

  beforeAll(async () => {
    srv = await createFixtureServer([{ pathPrefix: "/golden", dir: join(import.meta.dirname, "golden") }]);
    policy = createSafeEgressPolicy({ mode: "offline-fixture", allowedTestPorts: new Set([srv.basePort]) });
    base = srv.url;
  }, 120_000);

  afterAll(async () => {
    await srv.close();
  });

  it("无 ctx 时行为不变（向后兼容）", async () => {
    const res = await httpFetch(`${base}/golden/collection.html`, policy);
    expect(res.status).toBe(200);
    expect(res.body.byteLength).toBeGreaterThan(0);
  });

  it("politeness 并发闸被 acquire（并发计数生效）", async () => {
    const gate = new PolitenessGate({ globalMaxConcurrency: 8, siteMaxConcurrency: 2 });
    const host = new URL(base).host;
    const release = await gate.acquire(host);
    // 已占用 1 槽；再 acquire 第二个成功（站点上限 2）。
    const release2 = await gate.acquire(host);
    let acquired3 = false;
    void gate.acquire(host).then((r) => { acquired3 = true; return r; });
    await new Promise((r) => setTimeout(r, 30));
    expect(acquired3).toBe(false); // 站点并发 2 已满
    release(); release2();
  });

  it("onFetch 回调触发（画像更新挂钩）", async () => {
    const calls: Array<{ ok: boolean; status: number }> = [];
    const res = await httpFetch(`${base}/golden/collection.html`, policy, {
      onFetch: (info) => calls.push(info),
    });
    expect(res.status).toBe(200);
    expect(calls.length).toBe(1);
    expect(calls[0]!.ok).toBe(true);
    expect(calls[0]!.status).toBe(200);
  });

  it("cacheBypass=false 命中缓存；bypass=true 绕过", async () => {
    const cache = new HttpCache({ maxEntries: 10, ttlMs: 60_000 });
    // 第一次：写入缓存。
    await httpFetch(`${base}/golden/collection.html`, policy, { cache });
    // 第二次：命中缓存（需能观察到——通过 onFetch 计数为 0 表示缓存命中）。
    let fetchCount = 0;
    const res = await httpFetch(`${base}/golden/collection.html`, policy, {
      cache,
      onFetch: () => { fetchCount += 1; },
    });
    expect(res.body.byteLength).toBeGreaterThan(0);
    expect(fetchCount).toBe(0); // 缓存命中，未触发网络
    // bypass=true：绕过缓存，重新抓取。
    fetchCount = 0;
    await httpFetch(`${base}/golden/collection.html`, policy, { cache, cacheBypass: true, onFetch: () => { fetchCount += 1; } });
    expect(fetchCount).toBe(1);
  });
});
