import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { join } from "node:path";
import { createDb, migrateToLatest, createRepositories } from "@stellaris/db";
import { startPostgres, type StartedPostgres } from "@stellaris/db/testing/pg.js";
import { createEvidenceStore } from "@stellaris/evidence";
import { createSafeEgressPolicy } from "@stellaris/crawler/safe-egress.js";
import { createFixtureServer } from "@stellaris/crawler/testing/fixture-server.js";
import { createReplayDriver } from "./replay-driver.js";
import { runMultiInstitutionPipeline } from "./multi-institution-driver.js";
import { runMultiRegionPipeline } from "./multi-region-driver.js";
import { recoverInterruptedTasks } from "./recovery.js";
import type { TaskControlDeps } from "./task-control.js";
import type { SiteAdapter } from "@stellaris/crawler/adapter/loader.js";

describe("崩溃恢复入口", () => {
  let pg: StartedPostgres;
  let srv: Awaited<ReturnType<typeof createFixtureServer>>;
  let db: ReturnType<typeof createDb>;
  let repos: ReturnType<typeof createRepositories>;
  let deps: TaskControlDeps;
  const emit = (): void => {};

  beforeAll(async () => {
    pg = await startPostgres();
    db = createDb(pg.config);
    await migrateToLatest(db);
    repos = createRepositories(db);
    srv = await createFixtureServer([
      { pathPrefix: "/golden", dir: join(import.meta.dirname, "../../../../packages/crawler/src/discovery/golden") },
    ]);
    const policy = createSafeEgressPolicy({ mode: "offline-fixture", allowedTestPorts: new Set([srv.basePort]) });
    const adapter: SiteAdapter = {
      siteId: "test",
      hosts: ["localhost"],
      institutionList: { url: `${srv.url}/golden/institution-list.html`, selector: ".list a" },
      leadershipList: null,
      memberDetail: null,
      roles: { primaryKeywords: [], secondaryKeywords: [] },
    };
    const evidenceRoot = join(process.cwd(), ".tmp-recv-evidence");
    deps = {
      repos,
      evidenceStore: createEvidenceStore(evidenceRoot),
      policy,
      fixtureUrl: srv.url,
      adapter,
      runTaskPipeline: createReplayDriver(),
      runMultiInstitutionPipeline,
      runMultiRegionPipeline,
      emit,
      evidenceRoot,
    };
  }, 120_000);

  afterAll(async () => {
    await srv.close();
    await db.destroy();
    await pg.stop();
  });

  it("扫描未完成任务并恢复 → 任务到达 COMPLETED 且结果不重复", async () => {
    // 模拟崩溃残留：创建任务 + 冻结范围，但 status 停在 PENDING（驱动未跑完）。
    const task = await repos.taskRun.createWithIdempotency({
      ownerUserId: "test-user",
      idempotencyKey: "recv-key-1",
      mode: "FULL_INSTITUTION",
      expandLevel: "COUNTY",
      ruleVersion: "v1",
    });
    await repos.targetScope.addMany(task.id, [
      { regionCode: "340100", regionName: "合肥市", parentRegionCode: "340000", regionLevel: "city", included: true },
      { regionCode: "340200", regionName: "芜湖市", parentRegionCode: "340000", regionLevel: "city", included: true },
    ]);
    // 模拟崩溃残留：驱动已开始运行（markStarted 同时设 CRAWLING + started_at）后被中断。
    await repos.taskRun.markStarted(task.id);

    const { recovered } = await recoverInterruptedTasks(deps);
    expect(recovered).toBeGreaterThanOrEqual(1);

    // 等待恢复的驱动到达终态。
    const deadline = Date.now() + 30_000;
    let status = (await repos.taskRun.findById(task.id))?.status;
    while (status && status !== "COMPLETED" && status !== "FAILED" && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 200));
      status = (await repos.taskRun.findById(task.id))?.status;
    }
    expect(status).toBe("COMPLETED");

    // 结果产出且不重复（唯一约束：task_run_id + institution_snapshot_id + slot）。
    const rows = await repos.resultRow.listByTask(task.id);
    expect(rows.length).toBeGreaterThan(0);
  }, 60_000);

  it("已完成任务不被再次恢复", async () => {
    const task = await repos.taskRun.createWithIdempotency({
      ownerUserId: "test-user",
      idempotencyKey: "recv-key-2",
      mode: "FULL_INSTITUTION",
      expandLevel: "COUNTY",
      ruleVersion: "v1",
    });
    await repos.taskRun.setStatus(task.id, "COMPLETED");
    const { recovered } = await recoverInterruptedTasks(deps);
    expect(recovered).toBe(0);
  }, 30_000);
});
