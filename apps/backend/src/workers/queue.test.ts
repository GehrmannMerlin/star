import { describe, it, expect, vi } from "vitest";
import { runTaskJob, taskJobKey, type WorkerDeps } from "./queue.js";
import type { Repositories, TaskRunRow } from "@stellaris/db";
import type { EvidenceStore } from "@stellaris/evidence";
import { createSafeEgressPolicy } from "@stellaris/crawler/safe-egress.js";

function makeTask(overrides: Partial<TaskRunRow> = {}): TaskRunRow {
  return {
    id: "task-1",
    owner_user_id: "test-user",
    idempotency_key: "k1",
    mode: "TARGETED",
    status: "PENDING",
    expand_level: "COUNTY",
    rule_version: "v1",
    created_at: new Date().toISOString(),
    requested_at: new Date().toISOString(),
    started_at: null,
    finished_at: null,
    error_message: null,
    total_institutions: 0,
    processed_institutions: 0,
    reviewed_slots: 0,
    recovery_count: 0,
    blocked_count: 0,
    result_summary: null,
    ...overrides,
  };
}

function makeDeps(overrides: Partial<WorkerDeps> = {}): WorkerDeps {
  const runTaskPipeline = vi.fn(async () => {});
  const runMultiInstitutionPipeline = vi.fn(async () => {});
  const runMultiRegionPipeline = vi.fn(async () => {});
  const repos = {
    taskRun: {
      findById: vi.fn(async () => makeTask()),
    },
    targetScope: { listByTask: vi.fn(async () => []) },
  } as unknown as Repositories;
  return {
    pgPool: {} as never,
    repos,
    evidenceStore: {} as EvidenceStore,
    policy: createSafeEgressPolicy({ mode: "offline-fixture", allowedTestPorts: new Set([1]) }),
    fixtureUrl: "http://fixture",
    evidenceRoot: "/tmp",
    exportRoot: "/tmp",
    emit: vi.fn(),
    runTaskPipeline,
    runMultiInstitutionPipeline,
    runMultiRegionPipeline,
    ...overrides,
  };
}

describe("P5-T1 Worker 任务路由", () => {
  it("TARGETED 任务路由到 runTaskPipeline", async () => {
    const deps = makeDeps();
    const findById = deps.repos.taskRun.findById as ReturnType<typeof vi.fn>;
    findById.mockResolvedValue(makeTask({ mode: "TARGETED" }));
    await runTaskJob(deps, "task-1");
    expect(deps.runTaskPipeline).toHaveBeenCalledOnce();
    expect(deps.runMultiInstitutionPipeline).not.toHaveBeenCalled();
    expect(deps.runMultiRegionPipeline).not.toHaveBeenCalled();
  });

  it("FULL_INSTITUTION 单行政区路由到 runMultiInstitutionPipeline", async () => {
    const deps = makeDeps();
    const findById = deps.repos.taskRun.findById as ReturnType<typeof vi.fn>;
    findById.mockResolvedValue(makeTask({ mode: "FULL_INSTITUTION" }));
    // 单行政区：targetScope 1 行。
    (deps.repos.targetScope.listByTask as ReturnType<typeof vi.fn>).mockResolvedValue([
      { region_code: "340000" },
    ]);
    await runTaskJob(deps, "task-1");
    expect(deps.runMultiInstitutionPipeline).toHaveBeenCalledOnce();
    expect(deps.runTaskPipeline).not.toHaveBeenCalled();
  });

  it("FULL_INSTITUTION 多行政区（regionCodes）路由到 runMultiRegionPipeline", async () => {
    const deps = makeDeps();
    const findById = deps.repos.taskRun.findById as ReturnType<typeof vi.fn>;
    findById.mockResolvedValue(makeTask({ mode: "FULL_INSTITUTION" }));
    (deps.repos.targetScope.listByTask as ReturnType<typeof vi.fn>).mockResolvedValue([
      { region_code: "340000" },
      { region_code: "340100" },
    ]);
    await runTaskJob(deps, "task-1");
    expect(deps.runMultiRegionPipeline).toHaveBeenCalledOnce();
    expect(deps.runMultiInstitutionPipeline).not.toHaveBeenCalled();
  });

  it("终态任务（CANCELLED）不执行驱动", async () => {
    const deps = makeDeps();
    const findById = deps.repos.taskRun.findById as ReturnType<typeof vi.fn>;
    findById.mockResolvedValue(makeTask({ status: "CANCELLED" }));
    await runTaskJob(deps, "task-1");
    expect(deps.runTaskPipeline).not.toHaveBeenCalled();
  });

  it("任务不存在抛错（Graphile Worker 重试）", async () => {
    const deps = makeDeps();
    const findById = deps.repos.taskRun.findById as ReturnType<typeof vi.fn>;
    findById.mockResolvedValue(undefined);
    await expect(runTaskJob(deps, "nope")).rejects.toThrow(/任务不存在/);
  });

  it("taskJobKey 含任务ID+模式+规则版本", () => {
    const key = taskJobKey(makeTask({ id: "t", mode: "FULL_INSTITUTION", rule_version: "v2" }));
    expect(key).toBe("task:t:FULL_INSTITUTION:v2");
  });
});

describe("P5-T2 STEP 17 — Biography Task Runtime 路由（biographyExecutor 注入时）", () => {
  it("TARGETED 路由到 biographyExecutor（不跑 legacy 回放）", async () => {
    const biographyExecutor = { run: vi.fn(async () => {}) };
    const deps = makeDeps({ biographyExecutor });
    const findById = deps.repos.taskRun.findById as ReturnType<typeof vi.fn>;
    findById.mockResolvedValue(makeTask({ mode: "TARGETED" }));
    await runTaskJob(deps, "task-1");
    expect(biographyExecutor.run).toHaveBeenCalledOnce();
    expect(biographyExecutor.run).toHaveBeenCalledWith("task-1");
    expect(deps.runTaskPipeline).not.toHaveBeenCalled();
  });

  it("FULL_INSTITUTION 单行政区路由到 biographyExecutor（不跑 legacy 多机构）", async () => {
    const biographyExecutor = { run: vi.fn(async () => {}) };
    const deps = makeDeps({ biographyExecutor });
    const findById = deps.repos.taskRun.findById as ReturnType<typeof vi.fn>;
    findById.mockResolvedValue(makeTask({ mode: "FULL_INSTITUTION" }));
    (deps.repos.targetScope.listByTask as ReturnType<typeof vi.fn>).mockResolvedValue([
      { region_code: "320106" },
    ]);
    await runTaskJob(deps, "task-1");
    expect(biographyExecutor.run).toHaveBeenCalledOnce();
    expect(deps.runMultiInstitutionPipeline).not.toHaveBeenCalled();
  });

  it("FULL_INSTITUTION 多行政区（regionCodes）仍路由到 runMultiRegionPipeline", async () => {
    const biographyExecutor = { run: vi.fn(async () => {}) };
    const deps = makeDeps({ biographyExecutor });
    const findById = deps.repos.taskRun.findById as ReturnType<typeof vi.fn>;
    findById.mockResolvedValue(makeTask({ mode: "FULL_INSTITUTION" }));
    (deps.repos.targetScope.listByTask as ReturnType<typeof vi.fn>).mockResolvedValue([
      { region_code: "340000" },
      { region_code: "340100" },
    ]);
    await runTaskJob(deps, "task-1");
    expect(deps.runMultiRegionPipeline).toHaveBeenCalledOnce();
    expect(biographyExecutor.run).not.toHaveBeenCalled();
  });

  it("无 biographyExecutor（legacy 配置）保持既有路由", async () => {
    const deps = makeDeps();
    const findById = deps.repos.taskRun.findById as ReturnType<typeof vi.fn>;
    findById.mockResolvedValue(makeTask({ mode: "TARGETED" }));
    await runTaskJob(deps, "task-1");
    expect(deps.runTaskPipeline).toHaveBeenCalledOnce();
  });
});
