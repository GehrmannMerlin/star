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
import { pauseTask, resumeTask, cancelTask, duplicateTask } from "./task-control.js";
import type { TaskControlDeps } from "./task-control.js";
import type { SiteAdapter } from "@stellaris/crawler/adapter/loader.js";

describe("任务控制核心", () => {
  let pg: StartedPostgres;
  let srv: Awaited<ReturnType<typeof createFixtureServer>>;
  let db: ReturnType<typeof createDb>;
  let repos: ReturnType<typeof createRepositories>;
  let deps: TaskControlDeps;
  let adapter: SiteAdapter;

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
    adapter = {
      siteId: "test",
      hosts: ["localhost"],
      institutionList: { url: `${srv.url}/golden/institution-list.html`, selector: ".list a" },
      leadershipList: null,
      memberDetail: null,
      roles: { primaryKeywords: [], secondaryKeywords: [] },
    };
    const evidenceRoot = join(process.cwd(), ".tmp-tc-evidence");
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

  async function createMultiRegionTask(idempotencyKey: string): Promise<string> {
    const task = await repos.taskRun.createWithIdempotency({
      idempotencyKey,
      mode: "FULL_INSTITUTION",
      expandLevel: "COUNTY",
      ruleVersion: "v1",
    });
    await repos.targetScope.addMany(task.id, [
      { regionCode: "340100", regionName: "合肥市", parentRegionCode: "340000", regionLevel: "city", included: true },
      { regionCode: "340200", regionName: "芜湖市", parentRegionCode: "340000", regionLevel: "city", included: true },
    ]);
    return task.id;
  }

  it("暂停已创建任务 → PAUSED；继续 → 任务最终完成", async () => {
    const taskId = await createMultiRegionTask("tc-pause-key");
    const paused = await pauseTask(taskId, deps);
    expect(paused.ok).toBe(true);
    expect((await repos.taskRun.findById(taskId))?.status).toBe("PAUSED");

    const resumed = await resumeTask(taskId, deps);
    expect(resumed.ok).toBe(true);
    expect((await repos.taskRun.findById(taskId))?.status).toBe("CRAWLING");

    // 等待任务到达终态（多行政区驱动完成）。
    const deadline = Date.now() + 30_000;
    let status = (await repos.taskRun.findById(taskId))?.status;
    while (status && status !== "COMPLETED" && status !== "FAILED" && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 200));
      status = (await repos.taskRun.findById(taskId))?.status;
    }
    expect(status).toBe("COMPLETED");

    // 两行政区都产出结果。
    const rows = await repos.resultRow.listByTask(taskId);
    const regionCodes = new Set(rows.map((r) => r.region_code));
    expect(regionCodes.has("340100")).toBe(true);
    expect(regionCodes.has("340200")).toBe(true);
  }, 60_000);

  it("取消已创建任务 → CANCELLED 终态，不可继续，可复制新任务", async () => {
    const taskId = await createMultiRegionTask("tc-cancel-key");
    const cancelled = await cancelTask(taskId, deps);
    expect(cancelled.ok).toBe(true);
    expect((await repos.taskRun.findById(taskId))?.status).toBe("CANCELLED");

    // 取消后不可继续（resume 拒绝）。
    const resumed = await resumeTask(taskId, deps);
    expect(resumed.ok).toBe(false);

    // 可复制为新任务：范围 + 机构快照复制，独立任务。
    const dup = await duplicateTask(taskId, deps);
    expect(dup.ok).toBe(true);
    const newId = dup.newTaskId;
    expect(newId).toBeTruthy();
    expect(newId).not.toBe(taskId);
    const newTask = await repos.taskRun.findById(newId!);
    expect(newTask?.status).toBe("PENDING");
    const newScopes = await repos.targetScope.listByTask(newId!);
    expect(newScopes.length).toBe(2);
  }, 30_000);

  it("对不存在/终态任务的控制操作返回 error", async () => {
    // 合法 UUID 但不存在（id 列是 uuid 类型，非法 uuid 会被 PG 拒绝而非返回空）。
    const res = await pauseTask("00000000-0000-0000-0000-000000000000", deps);
    expect(res.ok).toBe(false);
    expect(res.error).toBeTruthy();

    // 已完成任务不可再暂停。
    const taskId = await createMultiRegionTask("tc-finished-key");
    // 正确时序：先暂停（PENDING 可暂停）→ 再继续启动驱动。
    const p1 = await pauseTask(taskId, deps);
    expect(p1.ok).toBe(true);
    expect((await repos.taskRun.findById(taskId))?.status).toBe("PAUSED");
    const r1 = await resumeTask(taskId, deps);
    expect(r1.ok).toBe(true);
    const deadline = Date.now() + 30_000;
    let status = (await repos.taskRun.findById(taskId))?.status;
    while (status && status !== "COMPLETED" && status !== "FAILED" && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 200));
      status = (await repos.taskRun.findById(taskId))?.status;
    }
    expect(status).toBe("COMPLETED");
    const pauseFinished = await pauseTask(taskId, deps);
    expect(pauseFinished.ok).toBe(false);
  }, 60_000);
});
