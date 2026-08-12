import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { join } from "node:path";
import { makeRequestKey, runReviewer } from "./reviewer.js";
import { createFixtureServer } from "@stellaris/crawler/testing/fixture-server.js";
import { createSafeEgressPolicy, type SafeEgressPolicy } from "@stellaris/crawler/safe-egress.js";
import { createDb, migrateToLatest, FetchAttemptRepository, ReviewRepository } from "@stellaris/db";
import { startPostgres, type StartedPostgres } from "@stellaris/db/testing/pg.js";

describe("隔离 Reviewer", () => {
  let pg: StartedPostgres;
  let srv: Awaited<ReturnType<typeof createFixtureServer>>;
  let policy: SafeEgressPolicy;
  let deps: { fetchAttempts: FetchAttemptRepository; reviews: ReviewRepository };
  let db: ReturnType<typeof createDb>;
  let taskId: string;
  let instId: string;

  beforeAll(async () => {
    pg = await startPostgres();
    db = createDb(pg.config);
    await migrateToLatest(db);
    deps = { fetchAttempts: new FetchAttemptRepository(db), reviews: new ReviewRepository(db) };
    const task = await db
      .insertInto("task_run")
      .values({
        idempotency_key: "reviewer-test-key",
        mode: "TARGETED",
        expand_level: "COUNTY",
        status: "CRAWLING",
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
    srv = await createFixtureServer([{ pathPrefix: "/golden", dir: join(import.meta.dirname, "../../crawler/src/golden") }]);
    policy = createSafeEgressPolicy({ mode: "offline-fixture", allowedTestPorts: new Set([srv.basePort]) });
  }, 120_000);

  afterAll(async () => {
    await srv.close();
    await db.destroy();
    await pg.stop();
  });

  it("Collector 与 Reviewer 请求键不同", () => {
    expect(makeRequestKey(taskId, "collector", "ck")).not.toBe(makeRequestKey(taskId, "reviewer", "ck"));
  });

  it("六方面一致返回 MATCH；页面类型分歧返回 CONFLICT", async () => {
    const base = {
      taskRunId: taskId,
      institutionSnapshotId: instId,
      personName: "张三",
      institutionName: "某某区人民政府",
      officialRole: "区长",
      policy,
    };
    const match = await runReviewer(
      {
        ...base,
        urlToReview: `${srv.url}/golden/leader-detail-1.html`,
        upstreamUrls: [`${srv.url}/golden/collection.html`],
      },
      deps,
    );
    expect(match.decision).toBe("MATCH");
    expect(match.reviewerRequestKey).toMatch(/^[0-9a-f]{64}$/);
    expect(match.reviewerRequestKey).not.toBe(makeRequestKey(taskId, "collector", match.reviewerRequestKey));

    // 分歧：复抓页被判定为禁止/错误页面（用新闻页） -> CONFLICT
    const conflict = await runReviewer(
      {
        ...base,
        urlToReview: `${srv.url}/golden/forbidden-news.html`,
        upstreamUrls: [`${srv.url}/golden/collection.html`],
      },
      deps,
    );
    expect(conflict.decision).toBe("CONFLICT");
    expect(conflict.conflictReason).toBeTruthy();
  });
});
