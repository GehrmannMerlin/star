import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createDb } from "../client.js";
import { migrateToLatest } from "../migrate.js";
import { startPostgres, type StartedPostgres } from "../testing/pg.js";
import { SearchCacheRepository } from "./search-cache.js";

let pg: StartedPostgres;
let db: ReturnType<typeof createDb>;
let repo: SearchCacheRepository;

beforeAll(async () => {
  pg = await startPostgres();
  db = createDb(pg.config);
  await migrateToLatest(db);
  repo = new SearchCacheRepository(db);
}, 120_000);

afterAll(async () => {
  await db.destroy();
  await pg.stop();
});

describe("search_result_cache 仓储", () => {
  it("upsert 后 findByQuery 返回（query+provider 唯一）", async () => {
    await repo.upsert({ query: "王清宪 省长", provider: "fixture", results: [], cachedAt: new Date().toISOString() });
    const found = await repo.findByQuery("王清宪 省长", "fixture");
    expect(found?.query).toBe("王清宪 省长");
    expect(found?.provider).toBe("fixture");
    // 再次 upsert 同 query+provider 更新而非报错。
    await repo.upsert({ query: "王清宪 省长", provider: "fixture", results: [{ url: "https://a/" }], cachedAt: new Date().toISOString() });
    const found2 = await repo.findByQuery("王清宪 省长", "fixture");
    expect(found2?.results).toEqual([{ url: "https://a/" }]);
  });

  it("不同 provider 同 query 互不覆盖", async () => {
    await repo.upsert({ query: "q1", provider: "brave", results: [{ provider: "brave" }], cachedAt: new Date().toISOString() });
    await repo.upsert({ query: "q1", provider: "fixture", results: [{ provider: "fixture" }], cachedAt: new Date().toISOString() });
    const brave = await repo.findByQuery("q1", "brave");
    const fixture = await repo.findByQuery("q1", "fixture");
    expect(brave?.results).toEqual([{ provider: "brave" }]);
    expect(fixture?.results).toEqual([{ provider: "fixture" }]);
  });
});
