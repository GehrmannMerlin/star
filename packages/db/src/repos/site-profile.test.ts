import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createDb } from "../client.js";
import { migrateToLatest } from "../migrate.js";
import { startPostgres, type StartedPostgres } from "../testing/pg.js";
import { SiteProfileRepository } from "./site-profile.js";

let pg: StartedPostgres;
let db: ReturnType<typeof createDb>;
let repo: SiteProfileRepository;

beforeAll(async () => {
  pg = await startPostgres();
  db = createDb(pg.config);
  await migrateToLatest(db);
  repo = new SiteProfileRepository(db);
}, 120_000);

afterAll(async () => {
  await db.destroy();
  await pg.stop();
});

describe("site_profile 仓储", () => {
  it("upsert 后 findByHost 返回画像（host 唯一）", async () => {
    await repo.upsert({ host: "example.com", fetchMode: "HTTP" });
    const found = await repo.findByHost("example.com");
    expect(found?.host).toBe("example.com");
    expect(found?.fetch_mode).toBe("HTTP");
    // 再次 upsert 同 host 更新而非报错。
    await repo.upsert({ host: "example.com", fetchMode: "PLAYWRIGHT", domFingerprint: "fp-1" });
    const found2 = await repo.findByHost("example.com");
    expect(found2?.fetch_mode).toBe("PLAYWRIGHT");
    expect(found2?.dom_fingerprint).toBe("fp-1");
  });

  it("recordFetch 更新 success_rate 与 avg_duration_ms", async () => {
    await repo.upsert({ host: "perf.example", fetchMode: "HTTP" });
    await repo.recordFetch("perf.example", { ok: true, durationMs: 100, fetchMode: "HTTP" });
    await repo.recordFetch("perf.example", { ok: true, durationMs: 300, fetchMode: "HTTP" });
    const p = await repo.findByHost("perf.example");
    expect(Number(p?.success_rate)).toBe(1);
    expect(p?.avg_duration_ms).toBe(200); // 滚动平均 (100+300)/2
    expect(p?.last_verified_at).toBeTruthy();
  });

  it("recordFetch 失败降低 success_rate，429 记入 failure_signals", async () => {
    await repo.upsert({ host: "fail.example", fetchMode: "HTTP" });
    await repo.recordFetch("fail.example", { ok: false, durationMs: 50, fetchMode: "HTTP", retryAfterMs: 5000 });
    const p = await repo.findByHost("fail.example");
    expect(Number(p?.success_rate)).toBe(0);
    expect(p?.failure_signals).toMatchObject({ status: 429, retry_after_ms: 5000 });
  });
});
