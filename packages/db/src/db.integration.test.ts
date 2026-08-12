import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createDb } from "./client.js";
import { migrateToLatest } from "./migrate.js";
import { startPostgres, type StartedPostgres } from "./testing/pg.js";

let pg: StartedPostgres;

beforeAll(async () => {
  pg = await startPostgres();
}, 120_000);

afterAll(async () => {
  await pg.stop();
});

describe("PostgreSQL 18 真实集成", () => {
  it("迁移全部执行且幂等", async () => {
    const db = createDb(pg.config);
    const r1 = await migrateToLatest(db);
    expect(r1.ok).toBe(true);
    expect(r1.all).toContain("2026-08-03-initial-schema");
    expect(r1.all).toContain("2026-08-03-invariants");

    const r2 = await migrateToLatest(db);
    expect(r2.ok).toBe(true);
    expect(r2.executed).toEqual([]); // 幂等：已执行的迁移跳过

    await db.destroy();
  });
});
