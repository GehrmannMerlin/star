import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createDb } from "../client.js";
import { migrateToLatest } from "../migrate.js";
import { startPostgres, type StartedPostgres } from "../testing/pg.js";
import { CrawlIntentRepository } from "./crawl-intent.js";
import { ReviewRepository } from "./review.js";
import { ResultRowRepository } from "./result-row.js";

let pg: StartedPostgres;
let db: ReturnType<typeof createDb>;
let t: string;
let inst: string;

beforeAll(async () => {
  pg = await startPostgres();
  db = createDb(pg.config);
  await migrateToLatest(db);
  const task = await db
    .insertInto("task_run")
    .values({
      idempotency_key: "repos-test-key",
      mode: "TARGETED",
      expand_level: "COUNTY",
      status: "PENDING",
      rule_version: "v1",
    })
    .returning("id")
    .executeTakeFirstOrThrow();
  t = task.id;
  const instRow = await db
    .insertInto("institution_snapshot")
    .values({
      task_run_id: t,
      region_code: "110000",
      official_name: "某某区人民政府",
      institution_type: "government",
      discovery_source: "user_specified",
      select_two_primary: true,
      frozen_at: new Date().toISOString(),
    })
    .returning("id")
    .executeTakeFirstOrThrow();
  inst = instRow.id;
}, 120_000);

afterAll(async () => {
  await db.destroy();
  await pg.stop();
});

describe("仓储层集成", () => {
  it("同任务同 canonical_key 同 purpose 的抓取意图只创建一条", async () => {
    const repo = new CrawlIntentRepository(db);
    const a = await repo.createIfAbsent({
      taskRunId: t,
      institutionSnapshotId: null,
      originalUrl: "https://a/",
      canonicalKey: "ck1",
      priority: 1,
      phase: "primary",
      purpose: "collector",
    });
    const b = await repo.createIfAbsent({
      taskRunId: t,
      institutionSnapshotId: null,
      originalUrl: "https://a/",
      canonicalKey: "ck1",
      priority: 1,
      phase: "primary",
      purpose: "collector",
    });
    expect(a.id).toBe(b.id);
  });

  it("review_job.unique_request_key 唯一约束生效", async () => {
    await expect(
      db
        .insertInto("review_job")
        .values({ task_run_id: t, url: "https://a/", status: "PENDING", unique_request_key: "same-key" })
        .execute(),
    ).resolves.toBeDefined();
    await expect(
      db
        .insertInto("review_job")
        .values({ task_run_id: t, url: "https://a/", status: "PENDING", unique_request_key: "same-key" })
        .execute(),
    ).rejects.toThrow();
  });

  it("同任务同机构同槽位只保留一个当前结果行", async () => {
    const repo = new ResultRowRepository(db);
    const row = {
      taskRunId: t,
      institutionSnapshotId: inst,
      regionCode: "110000",
      institutionName: "某某区人民政府",
      positionDisplay: "某某区人民政府 区长",
      personName: "张三",
      currentStatusZh: "正式在任",
      collectedAt: new Date().toISOString(),
    };
    // 两次都写空 URL + 中文终态原因（合法；第二次验证更新而非新增）。
    await repo.upsertCurrentResult({
      ...row,
      slot: "PRIMARY_1",
      positionUrl: null,
      pageTypeZh: null,
      resultZh: "完整搜索后无合格URL",
    });
    await repo.upsertCurrentResult({
      ...row,
      slot: "PRIMARY_1",
      positionUrl: null,
      pageTypeZh: null,
      resultZh: "当前人员未确认",
    });
    const rows = await repo.listByTask(t);
    const primary1 = rows.filter((r) => r.slot === "PRIMARY_1");
    expect(primary1).toHaveLength(1);
    expect(primary1[0]!.result_zh).toBe("当前人员未确认");
  });
});
