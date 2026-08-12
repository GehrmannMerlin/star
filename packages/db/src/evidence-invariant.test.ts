import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createDb } from "./client.js";
import { migrateToLatest } from "./migrate.js";
import { startPostgres, type StartedPostgres } from "./testing/pg.js";
import type { Slot } from "@stellaris/contracts";

let pg: StartedPostgres;
let db: ReturnType<typeof createDb>;
let taskId: string;
let instId: string;

beforeAll(async () => {
  pg = await startPostgres();
  db = createDb(pg.config);
  await migrateToLatest(db);
  const task = await db
    .insertInto("task_run")
    .values({
      owner_user_id: "test-user",
      idempotency_key: "invariant-test-key",
      mode: "TARGETED",
      expand_level: "COUNTY",
      status: "PENDING",
      rule_version: "v1",
    })
    .returning("id")
    .executeTakeFirstOrThrow();
  taskId = task.id;
  const inst = await db
    .insertInto("institution_snapshot")
    .values({
      task_run_id: taskId,
      region_code: "110000",
      official_name: "某某区人民政府",
      institution_type: "government",
      discovery_source: "user_specified",
      select_two_primary: true,
      frozen_at: new Date().toISOString(),
    })
    .returning("id")
    .executeTakeFirstOrThrow();
  instId = inst.id;
}, 120_000);

afterAll(async () => {
  await db.destroy();
  await pg.stop();
});

describe("result_row 不变量（DB 层触发器）", () => {
  // 延迟构造：taskId/instId 在 beforeAll 中赋值，若在模块加载时求值则为 undefined。
  const baseResult = (): {
    task_run_id: string;
    institution_snapshot_id: string;
    slot: Slot;
    region_code: string;
    institution_name: string;
    position_display: string;
    current_status_zh: string;
    collected_at: string;
  } => ({
    task_run_id: taskId,
    institution_snapshot_id: instId,
    slot: "PRIMARY_1",
    region_code: "110000",
    institution_name: "机构",
    position_display: "机构 岗位",
    current_status_zh: "正式在任",
    collected_at: new Date().toISOString(),
  });

  it("position_url 非空但不引用 MATCH 的 review_decision 被拒绝", async () => {
    await expect(
      db
        .insertInto("result_row")
        .values({
          ...baseResult(),
          position_url: "https://official.example/leader",
          result_zh: "已找到并复核",
        })
        .execute(),
    ).rejects.toThrow(/必须引用通过的 Reviewer 决策/);
  });

  it("空 position_url 但无中文终态原因被拒绝", async () => {
    await expect(
      db
        .insertInto("result_row")
        .values({ ...baseResult(), position_url: null, result_zh: "" })
        .execute(),
    ).rejects.toThrow(/必须有中文终态原因/);
  });

  it("空 position_url 且带中文终态原因允许写入", async () => {
    const row = await db
      .insertInto("result_row")
      .values({
        ...baseResult(),
        position_url: null,
        result_zh: "完整搜索后无合格URL",
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    expect(row.result_zh).toBe("完整搜索后无合格URL");
  });
});
