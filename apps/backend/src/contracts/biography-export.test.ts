import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ExcelJS from "exceljs";
import {
  createDb,
  createRepositories,
  migrateToLatest,
  type Repositories,
} from "@stellaris/db";
import { startPostgres, type StartedPostgres } from "@stellaris/db/testing/pg.js";
import type {
  InstitutionBiographyWorkflowPort,
  InstitutionBiographyWorkflowResult,
  InstitutionWorkPacket,
  SkillRuntime,
} from "@stellaris/agent-runtime";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../server.js";
import { BiographyTaskExecutionService } from "../workers/biography-task-service.js";
import {
  BIOGRAPHY_EXCEL_MIME,
  projectExportReadiness,
} from "./biography-export.js";

/**
 * STEP 18 — Biography Excel 导出端点定向测试。
 * 使用 Fake Workflow（不启动真实 Pi / DeepSeek / Bocha / Search），
 * 只验证：export readiness 门控、终态任务导出 .xlsx、文件回传、幂等、非终态拒绝。
 * TARGETED 模式不触发 Inventory Agent，故无需注入 inventoryRunner。
 */

let pg: StartedPostgres;
let db: ReturnType<typeof createDb>;
let repos: Repositories;
let app: FastifyInstance;
let exportDir: string;

const TEST_USER = { "x-ifc-user-id": "test-user" };

beforeAll(async () => {
  pg = await startPostgres();
  db = createDb(pg.config);
  await migrateToLatest(db);
  repos = createRepositories(db);
  exportDir = await mkdtemp(join(tmpdir(), "stellaris-bio-export-"));
  app = await buildApp({ db, exportRoot: exportDir });
}, 120_000);

afterAll(async () => {
  await app.close().catch(() => undefined);
  await db.destroy().catch(() => undefined);
  await pg.stop().catch(() => undefined);
  await rm(exportDir, { recursive: true, force: true });
}, 30_000);

let taskSeq = 0;

async function createTask(mode: "TARGETED" | "FULL_INSTITUTION" = "TARGETED") {
  taskSeq += 1;
  const task = await repos.taskRun.createWithIdempotency({
    ownerUserId: "test-user",
    idempotencyKey: `step18-${taskSeq}-${Date.now()}`,
    mode,
    expandLevel: "COUNTY",
    ruleVersion: "v1",
  });
  await repos.targetScope.addMany(task.id, [
    {
      regionCode: "320106",
      regionName: "南京市鼓楼区",
      parentRegionCode: null,
      regionLevel: "county",
      included: true,
    },
  ]);
  if (mode === "TARGETED") {
    await repos.institutionSnapshot.addMany(task.id, [
      {
        regionCode: "320106",
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

/** 构造一个 RESOLVED/PARTIAL 的 workflow result（in-memory）。 */
function workflowResult(
  packet: InstitutionWorkPacket,
  urls: [string | null, string | null],
): InstitutionBiographyWorkflowResult {
  const resolvedCount = urls.filter(Boolean).length;
  const bioStatus =
    resolvedCount === 2 ? "RESOLVED" : resolvedCount === 1 ? "PARTIAL" : "UNRESOLVED";
  return {
    packetId: packet.packetId,
    institutionId: packet.institutionId,
    institutionName: packet.institutionName,
    status: bioStatus,
    packetState: "POSITION_DECIDED",
    stages: {
      investigation: { status: "COMPLETED", toolCalls: {}, bochaCalled: false },
      evidence: { status: "COMPLETED", toolCalls: {}, bochaCalled: false },
      review: { status: "COMPLETED", toolCalls: {}, bochaCalled: false, reviewRound: 1 },
    },
    biographyResult: {
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
        biographyUrl: urls[0],
        decisionStatus: urls[0] ? "RESOLVED" : "UNRESOLVED",
        reviewRound: 1,
        sourceReviewId: "r1",
      },
      primary2: {
        primarySlot: "PRIMARY_2",
        targetId: "t2",
        personId: "p2",
        personName: "李四",
        biographyUrl: urls[1],
        decisionStatus: urls[1] ? "RESOLVED" : "UNRESOLVED",
        reviewRound: 1,
        sourceReviewId: "r1",
      },
    },
    durationMs: 1,
  } as InstitutionBiographyWorkflowResult;
}

function fakeWorkflow(
  urls: [string | null, string | null],
): InstitutionBiographyWorkflowPort {
  return {
    run: async (packet: InstitutionWorkPacket) => workflowResult(packet, urls),
  } as InstitutionBiographyWorkflowPort;
}

function runToTerminal(
  taskId: string,
  urls: [string | null, string | null],
): Promise<void> {
  const executor = new BiographyTaskExecutionService({
    db,
    repos,
    emit: () => undefined,
    skillRuntime: {} as unknown as SkillRuntime,
    workflow: fakeWorkflow(urls),
  });
  return executor.run(taskId);
}

describe("projectExportReadiness（确定性 readiness 投影）", () => {
  it("COMPLETED/PARTIAL_COMPLETED → EXPORTABLE；非终态 → NOT_TERMINAL；FAILED → NOT_FINAL_EXPORTABLE", () => {
    expect(projectExportReadiness("COMPLETED")).toBe("EXPORTABLE");
    expect(projectExportReadiness("PARTIAL_COMPLETED")).toBe("EXPORTABLE");
    expect(projectExportReadiness("PENDING")).toBe("NOT_TERMINAL");
    expect(projectExportReadiness("CRAWLING")).toBe("NOT_TERMINAL");
    expect(projectExportReadiness("FAILED")).toBe("NOT_FINAL_EXPORTABLE");
    expect(projectExportReadiness("CANCELLED")).toBe("NOT_FINAL_EXPORTABLE");
  });
});

describe("GET /api/tasks/:id/export — Biography Excel 导出", () => {
  it("COMPLETED 任务 → 200 + 正确 Content-Type/Content-Disposition + 非空字节 + 可重开", async () => {
    const task = await createTask("TARGETED");
    await runToTerminal(task.id, [
      "https://www.gulou.gov.cn/a",
      "https://www.gulou.gov.cn/b",
    ]);

    const res = await app.inject({
      method: "GET",
      url: `/api/tasks/${task.id}/export`,
      headers: TEST_USER,
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toContain(BIOGRAPHY_EXCEL_MIME);
    expect(res.headers["content-disposition"]).toContain("attachment");
    expect(res.rawPayload.byteLength).toBeGreaterThan(0);

    // 重开 workbook 校验：1 sheet、5 表头、2 数据行（两 PRIMARY 均保留）。
    const artifact = await repos.exportArtifact.findLatestByTask(task.id);
    expect(artifact).toBeDefined();
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(join(exportDir, artifact!.filename));
    expect(wb.worksheets).toHaveLength(1);
    const sheet = wb.worksheets[0]!;
    expect(sheet.name).toBe("岗位信息采集结果");
    expect(sheet.getRow(1).cellCount).toBe(5);
    expect(sheet.rowCount).toBe(3); // 表头 + 2 数据行
  });

  it("PARTIAL_COMPLETED 任务 → 200（PARTIAL 允许导出）", async () => {
    const task = await createTask("TARGETED");
    await runToTerminal(task.id, ["https://www.gulou.gov.cn/c", null]);
    const res = await app.inject({
      method: "GET",
      url: `/api/tasks/${task.id}/export`,
      headers: TEST_USER,
    });
    expect(res.statusCode).toBe(200);
  });

  it("非终态任务 → 409 TASK_NOT_READY", async () => {
    const task = await createTask("TARGETED"); // 仍为 PENDING
    const res = await app.inject({
      method: "GET",
      url: `/api/tasks/${task.id}/export`,
      headers: TEST_USER,
    });
    expect(res.statusCode).toBe(409);
    expect(res.json()).toEqual({ error: "TASK_NOT_READY" });
  });

  it("FAILED 任务 → 409 TASK_NOT_EXPORTABLE", async () => {
    const task = await createTask("TARGETED");
    await repos.taskRun.complete(task.id, "FAILED", "boom");
    const res = await app.inject({
      method: "GET",
      url: `/api/tasks/${task.id}/export`,
      headers: TEST_USER,
    });
    expect(res.statusCode).toBe(409);
    expect(res.json()).toEqual({ error: "TASK_NOT_EXPORTABLE" });
  });

  it("重复导出 → 幂等（同任务不重复生成新 artifact）", async () => {
    const task = await createTask("TARGETED");
    await runToTerminal(task.id, [
      "https://www.gulou.gov.cn/a",
      "https://www.gulou.gov.cn/b",
    ]);

    const first = await app.inject({
      method: "GET",
      url: `/api/tasks/${task.id}/export`,
      headers: TEST_USER,
    });
    const second = await app.inject({
      method: "GET",
      url: `/api/tasks/${task.id}/export`,
      headers: TEST_USER,
    });
    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(200);
    // 同任务幂等：字节一致（既有 artifact 直接回传）。
    expect(second.rawPayload.toString("hex")).toBe(first.rawPayload.toString("hex"));
  });
});
