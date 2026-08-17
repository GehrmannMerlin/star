import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { join } from "node:path";
import { createDb, createRepositories, migrateToLatest, type Repositories } from "@stellaris/db";
import { startPostgres, type StartedPostgres } from "@stellaris/db/testing/pg.js";
import { createEvidenceStore } from "@stellaris/evidence";
import { createSafeEgressPolicy } from "@stellaris/crawler/safe-egress.js";
import { createReplayDriver } from "./replay-driver.js";
import { cancelTask } from "./task-control.js";
import type { TaskControlDeps } from "./task-control.js";
import { abortTask, getTaskSignal, resetTaskSignal } from "./task-signal.js";
import { BiographyTaskExecutionService } from "./biography-task-service.js";
import type { SseEvent } from "@stellaris/contracts";
import type {
  InstitutionBiographyWorkflowPort,
  InstitutionBiographyWorkflowResult,
  InstitutionWorkPacket,
  InventoryAgentRunner,
  SkillRuntime,
} from "@stellaris/agent-runtime";

/**
 * STEP 19.1 — Real Task Cancellation Propagation 定向测试。
 * 全部使用 Fake Workflow（不启动真实 Pi Session / DeepSeek / Bocha）。
 * 验证取消信号从 task-signal 注册表 → BiographyTaskExecutionService → Coordinator → 停止调度，
 * 以及终态保护（CANCELLED 不被后续 complete/setStatus/setProgress 覆盖）。
 */

let pg: StartedPostgres;
let db: ReturnType<typeof createDb>;
let repos: Repositories;

beforeAll(async () => {
  pg = await startPostgres();
  db = createDb(pg.config);
  const migration = await migrateToLatest(db);
  if (!migration.ok) throw new Error(`migration failed: ${String(migration.error)}`);
  repos = createRepositories(db);
}, 120_000);

afterAll(async () => {
  await db?.destroy().catch(() => undefined);
  await pg?.stop();
}, 30_000);

const REGION = { regionCode: "320106", regionName: "南京市鼓楼区", regionLevel: "county" };

async function waitFor(cond: () => boolean, timeoutMs = 5000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (cond()) return;
    await new Promise((r) => setTimeout(r, 10));
  }
  throw new Error(`waitFor 超时（${timeoutMs}ms）`);
}

async function createTargetedTask(): Promise<string> {
  const task = await repos.taskRun.createWithIdempotency({
    ownerUserId: "test-user",
    idempotencyKey: `cancel-targeted-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    mode: "TARGETED",
    expandLevel: "COUNTY",
    ruleVersion: "v1",
  });
  await repos.targetScope.addMany(task.id, [
    { regionCode: REGION.regionCode, regionName: REGION.regionName, parentRegionCode: null, regionLevel: REGION.regionLevel, included: true },
  ]);
  await repos.institutionSnapshot.addMany(task.id, [
    {
      regionCode: REGION.regionCode,
      officialName: "鼓楼区人民政府",
      commonName: null,
      institutionType: "government",
      officialEntryUrl: null,
      discoverySource: "user_specified",
      selectTwoPrimary: true,
    },
  ]);
  return task.id;
}

async function createFullTask(): Promise<string> {
  const task = await repos.taskRun.createWithIdempotency({
    ownerUserId: "test-user",
    idempotencyKey: `cancel-full-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    mode: "FULL_INSTITUTION",
    expandLevel: "COUNTY",
    ruleVersion: "v1",
  });
  await repos.targetScope.addMany(task.id, [
    { regionCode: REGION.regionCode, regionName: REGION.regionName, parentRegionCode: null, regionLevel: REGION.regionLevel, included: true },
  ]);
  return task.id;
}

function minimalResult(packet: InstitutionWorkPacket): InstitutionBiographyWorkflowResult {
  return {
    packetId: packet.packetId,
    institutionId: packet.institutionId,
    institutionName: packet.institutionName,
    status: "RESOLVED",
    packetState: "POSITION_DECIDED",
    stages: {
      investigation: { status: "COMPLETED", toolCalls: {}, bochaCalled: false },
      evidence: { status: "COMPLETED", toolCalls: {}, bochaCalled: false },
      review: { status: "COMPLETED", toolCalls: {}, bochaCalled: false, reviewRound: 1 },
    },
    biographyResult: null,
    durationMs: 1,
  };
}

/** Fake Workflow：每个 packet 阻塞在一个手动 resolve 的 promise 上，模拟运行中的慢 workflow。 */
function blockingWorkflow() {
  let called = 0;
  const resolvers: Array<() => void> = [];
  const workflow: InstitutionBiographyWorkflowPort = {
    run: async (packet: InstitutionWorkPacket) => {
      called += 1;
      await new Promise<void>((resolve) => resolvers.push(resolve));
      return minimalResult(packet);
    },
  };
  return {
    workflow,
    get called() {
      return called;
    },
    get pending() {
      return resolvers.length;
    },
    release(n = resolvers.length): void {
      const batch = resolvers.splice(0, n);
      for (const resolve of batch) resolve();
    },
  };
}

function fakeInventoryRunner(records: Array<Record<string, unknown>>): Pick<InventoryAgentRunner, "run"> {
  return {
    run: async (req) => ({
      status: "COMPLETED",
      regionCode: req.regionCode,
      mode: "FULL",
      inventory: records as never,
      frozen: true,
      agentSessionId: "fake-inv",
      skill: { name: "official-biography-evidence", version: "3.1.0" },
      model: { provider: "deepseek", model: "deepseek-chat" },
      toolCalls: [],
      receipt: { frozen: true, itemCount: records.length, payloadHash: "h" },
    }),
  };
}

function makeExecutor(overrides: {
  workflow?: InstitutionBiographyWorkflowPort;
  inventoryRunner?: Pick<InventoryAgentRunner, "run">;
  concurrency?: number;
  events?: SseEvent[];
} = {}): BiographyTaskExecutionService {
  const events = overrides.events ?? [];
  return new BiographyTaskExecutionService({
    db,
    repos,
    emit: (taskId, e) => {
      events.push({ ...e, taskRunId: taskId });
    },
    skillRuntime: {} as unknown as SkillRuntime,
    ...(overrides.workflow ? { workflow: overrides.workflow } : {}),
    ...(overrides.inventoryRunner ? { inventoryRunner: overrides.inventoryRunner } : {}),
    ...(overrides.concurrency !== undefined ? { concurrency: overrides.concurrency } : {}),
  });
}

function makeControlDeps(): TaskControlDeps {
  const evidenceRoot = join(process.cwd(), ".tmp-cancel-evidence");
  return {
    repos,
    evidenceStore: createEvidenceStore(evidenceRoot),
    policy: createSafeEgressPolicy({ mode: "offline-fixture" }),
    runTaskPipeline: createReplayDriver(),
    emit: () => {},
    evidenceRoot,
  };
}

describe("STEP 19.1 — Real Task Cancellation Propagation", () => {
  it("queued cancel → workflow never starts（终态 no-op）", async () => {
    const taskId = await createTargetedTask();
    const wf = blockingWorkflow();
    const executor = makeExecutor({ workflow: wf.workflow });

    // 模拟「Worker claim 前已取消」：任务已 CANCELLED。
    await repos.taskRun.setStatus(taskId, "CANCELLED");
    await executor.run(taskId);

    expect(wf.called).toBe(0);
    const row = (await repos.taskRun.findById(taskId))!;
    expect(row.status).toBe("CANCELLED");
  });

  it("running slow fake workflow cancel → AbortSignal 触发 → workflow 退出且不完成", async () => {
    const taskId = await createTargetedTask();
    const wf = blockingWorkflow();
    const executor = makeExecutor({ workflow: wf.workflow, concurrency: 1 });

    // 生产等价：runTaskJob 经 getTaskSignal 传入信号；cancelTask 经 abortTask 中止同一控制器。
    const signal = getTaskSignal(taskId);
    const runPromise = executor.run(taskId, { signal });
    await waitFor(() => wf.called === 1);

    await repos.taskRun.setStatus(taskId, "CANCELLED");
    abortTask(taskId, "cancel");
    wf.release(1);

    await runPromise; // 应干净返回（不抛、不 complete、不重试）。

    const row = (await repos.taskRun.findById(taskId))!;
    expect(row.status).toBe("CANCELLED");
    expect(wf.called).toBe(1);
    resetTaskSignal(taskId);
  });

  it("concurrent：两个 active workflow 被中止，剩余 packet 不再启动", async () => {
    const taskId = await createFullTask();
    const wf = blockingWorkflow();
    const executor = makeExecutor({
      workflow: wf.workflow,
      concurrency: 2,
      inventoryRunner: fakeInventoryRunner([
        { institution_id: "inst-1", standard_name: "机构1", administrative_level: "COUNTY", core_institution_type: "GOVERNMENT", decision: "INCLUDE" },
        { institution_id: "inst-2", standard_name: "机构2", administrative_level: "COUNTY", core_institution_type: "GOVERNMENT", decision: "INCLUDE" },
        { institution_id: "inst-3", standard_name: "机构3", administrative_level: "COUNTY", core_institution_type: "GOVERNMENT", decision: "INCLUDE" },
      ]),
    });

    const signal = getTaskSignal(taskId);
    const runPromise = executor.run(taskId, { signal });
    await waitFor(() => wf.called >= 2);

    await repos.taskRun.setStatus(taskId, "CANCELLED");
    abortTask(taskId, "cancel");
    wf.release(); // 释放两个 active packet

    await runPromise;

    expect(wf.called).toBe(2); // 第 3 个 institution 未启动
    const row = (await repos.taskRun.findById(taskId))!;
    expect(row.status).toBe("CANCELLED");
    resetTaskSignal(taskId);
  });

  it("cancelled terminal state 不被 complete / markStarted / setProgress / setResultSummary 覆盖", async () => {
    const taskId = await createTargetedTask();
    await repos.taskRun.setStatus(taskId, "CANCELLED");

    await repos.taskRun.complete(taskId, "COMPLETED");
    await repos.taskRun.markStarted(taskId);
    await repos.taskRun.setProgress(taskId, { totalInstitutions: 5, reviewedSlots: 3 });
    await repos.taskRun.setResultSummary(taskId, { totalPackets: 1, resolvedPackets: 1 });

    const row = (await repos.taskRun.findById(taskId))!;
    expect(row.status).toBe("CANCELLED");
    expect(row.finished_at).toBeNull();
    expect(row.result_summary).toBeNull();
  });

  it("duplicate cancel idempotent（再次 cancel 安全返回，不抛错）", async () => {
    const taskId = await createTargetedTask();
    const deps = makeControlDeps();

    const first = await cancelTask(taskId, deps);
    expect(first.ok).toBe(true);

    const second = await cancelTask(taskId, deps);
    expect(second.ok).toBe(false); // 已终态 → 安全 no-op（非 500 / 非 throw）。
    expect(second.error).toMatch(/终态/);

    const row = (await repos.taskRun.findById(taskId))!;
    expect(row.status).toBe("CANCELLED");
  });
});
