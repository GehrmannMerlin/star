import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createDb, migrateToLatest, createRepositories } from "@stellaris/db";
import { startPostgres, type StartedPostgres } from "@stellaris/db/testing/pg.js";
import { createSafeEgressPolicy } from "@stellaris/crawler/safe-egress.js";
import { FixtureSearchProvider } from "@stellaris/crawler";
import { runRecovery } from "./recovery-executor.js";

describe("Recovery 策略执行器", () => {
  let pg: StartedPostgres;
  let db: ReturnType<typeof createDb>;
  let repos: ReturnType<typeof createRepositories>;
  let taskId: string;
  let instId: string;

  beforeAll(async () => {
    pg = await startPostgres();
    db = createDb(pg.config);
    await migrateToLatest(db);
    repos = createRepositories(db);
    const task = await repos.taskRun.createWithIdempotency({
      ownerUserId: "test-user",
      idempotencyKey: "recovery-exec-key",
      mode: "TARGETED",
      expandLevel: "COUNTY",
      ruleVersion: "v1",
    });
    taskId = task.id;
    await repos.institutionSnapshot.addMany(taskId, [
      { regionCode: "340000", officialName: "安徽省人民政府", commonName: null, institutionType: "government", officialEntryUrl: null, discoverySource: "user_specified", selectTwoPrimary: true },
    ]);
    instId = (await repos.institutionSnapshot.listByTask(taskId))[0]!.id;
  }, 120_000);

  afterAll(async () => {
    await db.destroy();
    await pg.stop();
  });

  it("搜索命中合格候选 → 返回 URL（走 Fixture 提供器）", async () => {
    const policy = createSafeEgressPolicy({ mode: "offline-fixture" });
    const res = await runRecovery({
      taskRunId: taskId,
      institutionSnapshotId: instId,
      personName: "王清宪",
      institutionName: "安徽省人民政府",
      repos,
      policy,
      searchProvider: new FixtureSearchProvider(),
      emit: () => {},
    });
    // Fixture 搜索返回 ah.gov.cn 结果 → 命中候选 URL。
    expect(res.candidateUrl).toBeTruthy();
    expect(res.strategiesUsed.length).toBeGreaterThan(0);
    // recovery_attempt 已记录。
    const attempts = await repos.recoveryAttempt.listByTask(taskId);
    expect(attempts.length).toBeGreaterThan(0);
  }, 120_000);

  it("无可用入口（无 searchProvider + 无画像）→ candidateUrl=null", async () => {
    const policy = createSafeEgressPolicy({ mode: "offline-fixture" });
    const res = await runRecovery({
      taskRunId: taskId,
      institutionSnapshotId: instId,
      personName: "不存在的人",
      institutionName: "不存在机构",
      repos,
      policy,
      emit: () => {},
    });
    expect(res.candidateUrl).toBeNull();
  }, 120_000);

  it("预算超限停止", async () => {
    const policy = createSafeEgressPolicy({ mode: "offline-fixture" });
    const res = await runRecovery({
      taskRunId: taskId,
      institutionSnapshotId: instId,
      personName: "王清宪",
      institutionName: "安徽省人民政府",
      repos,
      policy,
      searchProvider: new FixtureSearchProvider(),
      maxBudget: 0, // 预算 0 → 立即停止。
      emit: () => {},
    });
    expect(res.candidateUrl).toBeNull();
    expect(res.strategiesUsed).toEqual([]);
  }, 120_000);
});
