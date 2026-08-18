import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, createRepositories, migrateToLatest, type Repositories } from "@stellaris/db";
import type { InstitutionWorkPacket } from "@stellaris/agent-runtime";
import {
  BiographyTaskExecutionService,
  buildTargetedFrozenInventory,
  projectTaskTerminalStatus,
} from "./biography-task-service.js";
import type { InstitutionBiographyWorkflowPort } from "@stellaris/agent-runtime";
import type { InstitutionBiographyWorkflowResult } from "@stellaris/agent-runtime";
import type { SkillRuntime } from "@stellaris/agent-runtime";
import { startPostgres, type StartedPostgres } from "@stellaris/db/testing/pg.js";
import type { InventoryAgentRunner } from "@stellaris/agent-runtime";
import type { SseEvent } from "@stellaris/contracts";

/**
 * STEP 17 — Biography Task Execution Service 定向测试。
 * 全部使用 Fake Inventory + Fake Workflow（不启动真实 Pi Session / DeepSeek / Bocha），
 * 只验证 Web Task 编排：Inventory 冻结 → Coordinator → 进度投影 → 确定性终态投影 → Task Result 投影。
 */

let pg: StartedPostgres;
let repos: Repositories;
let db: ReturnType<typeof createDb>;

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

type FakeWorkflowSpec = {
  status: "RESOLVED" | "PARTIAL" | "UNRESOLVED" | "FAILED";
  urls: [string | null, string | null];
};

function workflowResult(
  packet: InstitutionWorkPacket,
  spec: FakeWorkflowSpec,
): InstitutionBiographyWorkflowResult {
  const primary1Url = spec.urls[0];
  const primary2Url = spec.urls[1];
  const resolvedCount =
    (primary1Url ? 1 : 0) + (primary2Url ? 1 : 0);
  const bioStatus =
    spec.status === "FAILED" ? null : resolvedCount === 2 ? "RESOLVED" : resolvedCount === 1 ? "PARTIAL" : "UNRESOLVED";
  return {
    packetId: packet.packetId,
    institutionId: packet.institutionId,
    institutionName: packet.institutionName,
    status: spec.status,
    packetState: spec.status === "FAILED" ? "FAILED" : "POSITION_DECIDED",
    stages: {
      investigation: { status: "COMPLETED", toolCalls: {}, bochaCalled: false },
      evidence: { status: "COMPLETED", toolCalls: {}, bochaCalled: false },
      review: { status: "COMPLETED", toolCalls: {}, bochaCalled: false, reviewRound: 1 },
    },
    biographyResult:
      bioStatus === null
        ? null
        : {
            packetId: packet.packetId,
            regionCode: packet.regionCode ?? null,
            institutionId: packet.institutionId,
            institutionName: packet.institutionName,
            status: bioStatus,
            sourceOfTruth: "LATEST_FROZEN_APPROVED_REVIEW",
            primary1: {
              primarySlot: "PRIMARY_1",
              targetId: "t1",
              personId: "p1",
              personName: "张三",
              biographyUrl: primary1Url,
              decisionStatus: primary1Url ? "RESOLVED" : "UNRESOLVED",
              reviewRound: 1,
              sourceReviewId: "r1",
            },
            primary2: {
              primarySlot: "PRIMARY_2",
              targetId: "t2",
              personId: "p2",
              personName: "李四",
              biographyUrl: primary2Url,
              decisionStatus: primary2Url ? "RESOLVED" : "UNRESOLVED",
              reviewRound: 1,
              sourceReviewId: "r1",
            },
          },
    durationMs: 1,
  };
}

/** Fake Workflow：按机构名返回确定性结果（不启动真实 Agent）。 */
function fakeWorkflow(
  byInstitution: (packet: InstitutionWorkPacket) => FakeWorkflowSpec,
): InstitutionBiographyWorkflowPort & { called: number } {
  const state = { called: 0 };
  return {
    get called() {
      return state.called;
    },
    run: async (packet: InstitutionWorkPacket) => {
      state.called += 1;
      return workflowResult(packet, byInstitution(packet));
    },
  } as unknown as InstitutionBiographyWorkflowPort & { called: number };
}

/** Fake Inventory Runner：FULL 模式直接返回冻结清单。 */
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

let taskSeq = 0;

async function createTask(mode: "TARGETED" | "FULL_INSTITUTION") {
  taskSeq += 1;
  const task = await repos.taskRun.createWithIdempotency({
    ownerUserId: "test-user",
    idempotencyKey: `step17-${taskSeq}-${Date.now()}`,
    mode,
    expandLevel: "COUNTY",
    ruleVersion: "v1",
  });
  await repos.targetScope.addMany(task.id, [
    {
      regionCode: REGION.regionCode,
      regionName: REGION.regionName,
      parentRegionCode: null,
      regionLevel: REGION.regionLevel,
      included: true,
    },
  ]);
  if (mode === "TARGETED") {
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
  }
  return task;
}

function makeExecutor(overrides: {
  workflow?: InstitutionBiographyWorkflowPort;
  inventoryRunner?: Pick<InventoryAgentRunner, "run">;
  events?: SseEvent[];
} = {}) {
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
  });
}

describe("projectTaskTerminalStatus（确定性终态投影）", () => {
  it("全部 RESOLVED → COMPLETED；混合/UNRESOLVED → PARTIAL_COMPLETED；全部失败 → FAILED", () => {
    const batch = (counts: { resolved: number; partial: number; unresolved: number; failed: number; total: number }) => ({
      regionCode: "320106",
      totalPackets: counts.total,
      resolvedPackets: counts.resolved,
      partialPackets: counts.partial,
      unresolvedPackets: counts.unresolved,
      failedPackets: counts.failed,
      results: [],
    });
    expect(projectTaskTerminalStatus(batch({ resolved: 2, partial: 0, unresolved: 0, failed: 0, total: 2 }))).toBe("COMPLETED");
    expect(projectTaskTerminalStatus(batch({ resolved: 1, partial: 0, unresolved: 1, failed: 0, total: 2 }))).toBe("PARTIAL_COMPLETED");
    expect(projectTaskTerminalStatus(batch({ resolved: 1, partial: 0, unresolved: 0, failed: 1, total: 2 }))).toBe("PARTIAL_COMPLETED");
    expect(projectTaskTerminalStatus(batch({ resolved: 0, partial: 0, unresolved: 2, failed: 0, total: 2 }))).toBe("PARTIAL_COMPLETED");
    expect(projectTaskTerminalStatus(batch({ resolved: 0, partial: 0, unresolved: 0, failed: 2, total: 2 }))).toBe("FAILED");
    expect(projectTaskTerminalStatus(batch({ resolved: 0, partial: 0, unresolved: 0, failed: 0, total: 0 }))).toBe("FAILED");
  });
});

describe("buildTargetedFrozenInventory", () => {
  it("机构快照 → 1 条 INCLUDE Inventory（decision=INCLUDE，administrative_level 映射）", async () => {
    const task = await createTask("TARGETED");
    const snapshot = (await repos.institutionSnapshot.listByTask(task.id))[0]!;
    const frozen = buildTargetedFrozenInventory(snapshot, "county");
    expect(frozen.inventory).toHaveLength(1);
    expect(frozen.inventory[0]).toMatchObject({
      institution_id: snapshot.id,
      standard_name: "鼓楼区人民政府",
      administrative_level: "COUNTY",
      decision: "INCLUDE",
      core_institution_type: "government",
    });
  });
});

describe("BiographyTaskExecutionService — FULL 集成（Fake Inventory + Fake Workflow）", () => {
  it("2 机构：RESOLVED + PARTIAL → Task PARTIAL_COMPLETED，result_summary 可读", async () => {
    const task = await createTask("FULL_INSTITUTION");
    const events: SseEvent[] = [];
    const workflow = fakeWorkflow((packet) =>
      packet.institutionId === "glq-people-gov"
        ? { status: "RESOLVED", urls: ["https://www.gulou.gov.cn/a", "https://www.gulou.gov.cn/b"] }
        : { status: "PARTIAL", urls: ["https://www.gulou.gov.cn/c", null] },
    );
    const executor = makeExecutor({
      workflow,
      inventoryRunner: fakeInventoryRunner([
        { institution_id: "glq-people-gov", standard_name: "鼓楼区人民政府", administrative_level: "COUNTY", decision: "INCLUDE" },
        { institution_id: "glq-education-bureau", standard_name: "鼓楼区教育局", administrative_level: "COUNTY", decision: "INCLUDE" },
      ]),
      events,
    });
    await executor.run(task.id);

    const row = (await repos.taskRun.findById(task.id))!;
    expect(row.status).toBe("PARTIAL_COMPLETED");
    expect(row.processed_institutions).toBe(2);
    expect(row.total_institutions).toBe(2);
    expect(row.reviewed_slots).toBe(3);
    expect(row.result_summary).not.toBeNull();

    const summary = row.result_summary as {
      taskId: string;
      totalPackets: number;
      resolvedPackets: number;
      partialPackets: number;
      results: Array<{ institutionName: string; primary1: { biographyUrl: string | null }; primary2: { biographyUrl: string | null } }>;
    };
    expect(summary.taskId).toBe(task.id);
    expect(summary.totalPackets).toBe(2);
    expect(summary.resolvedPackets).toBe(1);
    expect(summary.partialPackets).toBe(1);
    const gov = summary.results.find((r) => r.institutionName === "鼓楼区人民政府")!;
    expect(gov.primary1.biographyUrl).toMatch(/^https:\/\//);
    expect(gov.primary2.biographyUrl).toMatch(/^https:\/\//);
    const edu = summary.results.find((r) => r.institutionName === "鼓楼区教育局")!;
    expect(edu.primary1.biographyUrl).toMatch(/^https:\/\//);
    expect(edu.primary2.biographyUrl).toBeNull();

    const completed = events.find((e) => e.type === "task.completed");
    expect(completed).toBeDefined();
    expect((completed as { statusZh: string }).statusZh).toBe("部分完成");
  });

  it("2 机构全部 RESOLVED → Task COMPLETED", async () => {
    const task = await createTask("FULL_INSTITUTION");
    const workflow = fakeWorkflow(() => ({
      status: "RESOLVED",
      urls: ["https://www.gulou.gov.cn/a", "https://www.gulou.gov.cn/b"],
    }));
    const executor = makeExecutor({
      workflow,
      inventoryRunner: fakeInventoryRunner([
        { institution_id: "i1", standard_name: "机构一", administrative_level: "COUNTY", decision: "INCLUDE" },
        { institution_id: "i2", standard_name: "机构二", administrative_level: "COUNTY", decision: "INCLUDE" },
      ]),
    });
    await executor.run(task.id);
    expect((await repos.taskRun.findById(task.id))!.status).toBe("COMPLETED");
  });

  it("全部 Packet 运行失败 → Task FAILED（error_message 结构化）", async () => {
    const task = await createTask("FULL_INSTITUTION");
    const workflow = fakeWorkflow(() => ({ status: "FAILED", urls: [null, null] }));
    const executor = makeExecutor({
      workflow,
      inventoryRunner: fakeInventoryRunner([
        { institution_id: "i1", standard_name: "机构一", administrative_level: "COUNTY", decision: "INCLUDE" },
      ]),
    });
    await executor.run(task.id);
    const row = (await repos.taskRun.findById(task.id))!;
    expect(row.status).toBe("FAILED");
    expect(row.error_message).toContain("全部机构采集失败");
  });

  it("Inventory 未冻结（非 COMPLETED）→ Task FAILED（不抛错、不运行 workflow）", async () => {
    const task = await createTask("FULL_INSTITUTION");
    const workflow = fakeWorkflow(() => ({ status: "RESOLVED", urls: [null, null] }));
    const executor = makeExecutor({
      workflow,
      inventoryRunner: { run: async () => ({ status: "MODEL_NOT_CONFIGURED" }) },
    });
    await executor.run(task.id);
    const row = (await repos.taskRun.findById(task.id))!;
    expect(row.status).toBe("FAILED");
    expect(row.error_message).toContain("MODEL_NOT_CONFIGURED");
    expect(workflow.called).toBe(0);
  });
});

describe("BiographyTaskExecutionService — TARGETED 集成（机构快照）", () => {
  it("指定机构 → 1 Packet RESOLVED → Task COMPLETED，result 可读（无需 LLM）", async () => {
    const task = await createTask("TARGETED");
    const workflow = fakeWorkflow(() => ({
      status: "RESOLVED",
      urls: ["https://www.gulou.gov.cn/a", "https://www.gulou.gov.cn/b"],
    }));
    const executor = makeExecutor({ workflow });
    await executor.run(task.id);

    const row = (await repos.taskRun.findById(task.id))!;
    expect(row.status).toBe("COMPLETED");
    expect(row.total_institutions).toBe(1);
    expect(row.processed_institutions).toBe(1);
    const summary = row.result_summary as { results: Array<{ primary1: { biographyUrl: string } }> };
    expect(summary.results[0]!.primary1.biographyUrl).toMatch(/^https:\/\//);
    expect(workflow.called).toBe(1);
  });
});

describe("BiographyTaskExecutionService — 进度投影", () => {
  it("0/2 → 1/2 → 2/2（processed 原子自增 + SSE task.progress_changed）", async () => {
    const task = await createTask("FULL_INSTITUTION");
    const events: SseEvent[] = [];
    const workflow = fakeWorkflow(() => ({ status: "RESOLVED", urls: ["https://x.gov.cn/a", "https://x.gov.cn/b"] }));
    const executor = makeExecutor({
      workflow,
      inventoryRunner: fakeInventoryRunner([
        { institution_id: "i1", standard_name: "机构一", administrative_level: "COUNTY", decision: "INCLUDE" },
        { institution_id: "i2", standard_name: "机构二", administrative_level: "COUNTY", decision: "INCLUDE" },
      ]),
      events,
    });
    await executor.run(task.id);

    const row = (await repos.taskRun.findById(task.id))!;
    expect(row.processed_institutions).toBe(2);
    expect(row.total_institutions).toBe(2);
    const progressEvents = events.filter((e) => e.type === "task.progress_changed") as Array<{
      processedInstitutions: number;
      totalInstitutions: number;
    }>;
    const seenProcessed = progressEvents.map((e) => e.processedInstitutions).sort((a, b) => a - b);
    expect(seenProcessed).toEqual([1, 2]);
    for (const e of progressEvents) expect(e.totalInstitutions).toBe(2);
  });

  it("STEP 19.3：业务边界 stage 投影（SSE 事件序列 + task_run.agent_stage 持久化）", async () => {
    const task = await createTask("FULL_INSTITUTION");
    const events: SseEvent[] = [];
    const workflow = fakeWorkflow(() => ({ status: "RESOLVED", urls: ["https://x.gov.cn/a", "https://x.gov.cn/b"] }));
    const executor = makeExecutor({
      workflow,
      inventoryRunner: fakeInventoryRunner([
        { institution_id: "i1", standard_name: "机构一", administrative_level: "COUNTY", decision: "INCLUDE" },
      ]),
      events,
    });
    await executor.run(task.id);

    // agent_stage 持久化为终态 stage。
    const row = (await repos.taskRun.findById(task.id))!;
    expect(row.agent_stage).toBe("COMPLETED");

    // SSE task.state_changed 按业务边界携带稳定 stage（PREPARING → INVENTORY_DISCOVERY →
    // INVENTORY_FROZEN → INVESTIGATING → FINALIZING）。
    const stageEvents = events.filter(
      (e): e is SseEvent & { stage?: string } => e.type === "task.state_changed" && "stage" in e,
    );
    const stages = stageEvents.map((e) => e.stage);
    expect(stages).toEqual(["PREPARING", "INVENTORY_DISCOVERY", "INVENTORY_FROZEN", "INVESTIGATING", "FINALIZING"]);
  });
});

describe("BiographyTaskExecutionService — 重复执行保护（Claim Gate）", () => {
  it("并发两次 run 同一 taskId → 只有一次 workflow 执行", async () => {
    const task = await createTask("TARGETED");
    let startedResolve!: () => void;
    const started = new Promise<void>((resolve) => {
      startedResolve = resolve;
    });
    let releaseResolve!: () => void;
    const release = new Promise<void>((resolve) => {
      releaseResolve = resolve;
    });
    let called = 0;
    const workflow: InstitutionBiographyWorkflowPort = {
      run: async (packet) => {
        called += 1;
        startedResolve();
        await release;
        return workflowResult(packet, { status: "RESOLVED", urls: ["https://x.gov.cn/a", "https://x.gov.cn/b"] });
      },
    };
    const executor = makeExecutor({ workflow });

    const first = executor.run(task.id);
    await started; // 第一次已 claim 并在 workflow 中执行
    const second = executor.run(task.id); // 第二次投递：claimTask 应返回 undefined
    releaseResolve();
    await Promise.all([first, second]);

    expect(called).toBe(1);
    expect((await repos.taskRun.findById(task.id))!.status).toBe("COMPLETED");
  });
});
