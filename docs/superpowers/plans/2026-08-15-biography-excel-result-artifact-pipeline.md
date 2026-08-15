# Biography Excel Result and Artifact Pipeline Implementation Plan

## Goal

把 STEP 17 已持久化并审核通过的 `BiographyUrlResult` 转换成可下载的 `.xlsx` Excel Artifact，形成：

`Task → Persistent Biography Results → Deterministic Excel Projection → Workbook → Artifact Storage → Download API`

严格限定 Skill Scope = `BIOGRAPHY_URL_ONLY`（官员个人简历/个人信息页面 URL 采集、审核、输出），不增加任前公示/代理任命/选举任命/离任等其它任免事件。

## Architecture

新增一条**纯确定性、无 Agent/LLM/Search 的 artifact 投影管线**，串接三个既有组件 + 三个新组件：

- 已有：`BiographyUrlResultReader`（URL SSoT = LATEST_FROZEN_APPROVED_REVIEW）、`export_artifact` 表 + `ExportArtifactRepository`（幂等）、`packages/exporter`（exceljs 4.4.0）。
- 新增：`BiographyTaskResultReader`（薄 batch 读取）、`projectBiographyResultRows` + `renderBiographyResultRows`（投影 + 渲染）、`biography-export.ts`（backend 编排 + export readiness）。

数据流：

```
task_run.result_summary (frozen terminal projection, 仅取 packetId + 顺序)
  → BiographyTaskResultReader (per packetId → BiographyUrlResultReader.read)
  → BiographyUrlResult[] (inventory 顺序)
  → projectBiographyResultRows (纯函数, 每 PRIMARY slot 一行)
  → renderBiographyResultRows (exceljs 单 Sheet, hyperlink URL, blank unresolved)
  → export_artifact.save (幂等)
  → GET /api/tasks/:id/export 直接回传 .xlsx 文件
```

## Tech Stack

- exceljs 4.4.0（已有 `@stellaris/exporter` 依赖，复用，不新增 Excel 库）
- Kysely + `@stellaris/db` repositories（已有）
- Fastify 路由（已有）
- node:crypto sha256（结果指纹，已有）
- Testcontainers PostgreSQL 18（已有 `@stellaris/db/testing/pg.js`，仅 smoke 用）

## Global Constraints

- Skill Scope 硬约束 = `BIOGRAPHY_URL_ONLY`；不新增任何其它证据类型字段。
- Final Biography URL 唯一 SSoT = `LATEST_FROZEN_APPROVED_REVIEW`（经 `BiographyUrlResultReader`）。
- `result_summary` 只用于 packet identity + deterministic ordering，其缓存 URL 不凌驾 `BiographyUrlResultReader`。
- 不调用 LLM / Search / Agent；不新增 Graphile job；不修改 Skill / Agent Runtime 业务逻辑 / Frontend / Production。
- 不新建第二套 artifact 系统 / 第二套 Final Decision SSoT / 第二套 Excel 库。
- Excel 是 deterministic projection，不是 source of truth；删除后可重建。
- 不返回服务器绝对路径；下载端点不接受用户提交文件 path。

## 现状调查结论（CURRENT CANONICAL vs LEGACY）

1. **LEGACY**：`result_row` 表 + `ResultRowView`(13 列) + `exportResultRows` + `GET /api/tasks/:id/export`(读 `repos.resultRow`)。这是旧爬虫设计（spec §21.1/§21.2），**新 Agent Runtime 不写这张表**（STEP 17 写 `task_run.result_summary`）。该导出路径对 Biography 任务是死路径。
2. **CURRENT**：`BiographyUrlResult` 域（`packages/agent-runtime/src/results/biography-url-result.ts`）+ `task_run.result_summary`（frozen terminal projection `RegionBiographyBatchResult`）。`BiographyUrlResultReader.read(packetId)` 从 packet + latest frozen APPROVED review + composite candidate pool 纯确定性重建完整结果（含 personName）。
3. **Skill 3.1.0 canonical export**（`render_single_level_output.py` + `assets/level-templates/*.xlsx`）：省级 9 列 / 地市级 10 列 / 区县级 11 列，sheet 名分别为「省级/地市级/区县级目标官员采集信息」。列 = 省/[地市]/[区县] + 岗位 + 现任人员 + 当前状态 + 岗位信息采集 + 4 个**超出 BIOGRAPHY_URL_ONLY 的空白列**（任前公示/代理任命/选举任命/离任信息采集）。其 region 三列与 status/position 列要求 Web Runtime 不生产的数据。

**Contract mismatch 判定**：Skill 模板含 4 个 out-of-scope 证据列，且其 region 拆列/岗位 role/当前状态 字段 Web Runtime（`BiographyUrlResult`）不持久化。Web spec §21.2 的 13 列中 8 列（省/地市/区县/乡镇拆列、岗位 role、当前状态、页面类型、采集时间）同样超出 `BiographyUrlResult` 能真实生产的范围。

**选择最薄 Adapter**（不修改 Skill、不拍脑袋改模板）：复用 Web §21.2 的 sheet 名与列名，输出**严格 BIOGRAPHY_URL_ONLY 子集**（见 Task 2 列契约），只填 `BiographyUrlResult` 能真实生产的字段，其余诚实留空/不输出，绝不伪造。

## File Structure

新增：
- `packages/exporter/src/biography-excel.ts`
- `packages/exporter/src/biography-excel.test.ts`
- `packages/agent-runtime/src/results/biography-task-result-reader.ts`
- `packages/agent-runtime/src/results/biography-task-result-reader.test.ts`
- `apps/backend/src/contracts/biography-export.ts`
- `apps/backend/src/contracts/biography-export.test.ts`
- `docs/agent-runtime/biography-excel-result-artifact-pipeline.md`

修改：
- `packages/exporter/src/index.ts`（导出新函数）
- `packages/agent-runtime/src/index.ts`（导出 batch reader）
- `apps/backend/src/contracts/task-routes.ts`（`/export` 路由改接 Biography 投影 + 回传文件）

## Tasks

### Task 1 — Inspect current export contract（已完成，结论见上）

**Files**：`packages/exporter/src/excel.ts`、`packages/contracts/src/{result,export-status,enums}.ts`、`packages/db/src/{result-projection,repos/export-artifact,schema}.ts`、`packages/agent-runtime/src/{results/biography-url-result,batch/biography-batch-wiring,batch/institution-biography-workflow-runner,work-packet/institution-work-packet}.ts`、`apps/backend/src/{contracts/task-routes,workers/biography-task-service,server}.ts`、Skill `scripts/render_single_level_output.py` + `assets/level-templates/*.xlsx` + `schemas/final-row.schema.json`。

**Commit**：无（调查）。

### Task 2 — Deterministic BiographyUrlResult → Excel row projection + workbook renderer

**Files**：`packages/exporter/src/biography-excel.ts`（新增）、`biography-excel.test.ts`（新增）、`index.ts`（修改）。

**Interfaces**（纯函数，无 IO）：

```ts
export const BIOGRAPHY_EXCEL_SHEET_NAME = "岗位信息采集结果"; // 复用 §21.2
export const BIOGRAPHY_EXCEL_COLUMNS = ["行政区划代码","机构","现任人员","岗位信息URL","采集结果"] as const;
export const BIOGRAPHY_RESOLVED_RESULT_ZH = "已找到并复核";
export const BIOGRAPHY_UNRESOLVED_RESULT_ZH = "完整搜索后无合格URL";

// 结构化输入（BiographyUrlResult 结构兼容，避免 exporter 依赖 agent-runtime）
export type BiographyExcelSlot = {
  personName: string | null;
  biographyUrl: string | null;
  decisionStatus: "RESOLVED" | "UNRESOLVED";
} | null;
export type BiographyExcelResult = {
  regionCode: string | null;
  institutionName: string;
  primary1: BiographyExcelSlot;
  primary2: BiographyExcelSlot;
};

export type BiographyExcelRow = {
  regionCode: string;
  institutionName: string;
  personName: string;
  biographyUrl: string | null;   // unresolved = null（不伪造）
  resultZh: string;              // RESOLVED→已找到并复核 / UNRESOLVED→完整搜索后无合格URL
};

export function projectBiographyResultRows(results: BiographyExcelResult[]): BiographyExcelRow[];
export function renderBiographyResultRows(input: {
  taskRunId: string; rows: BiographyExcelRow[]; exportDir: string;
}): Promise<{ filename; filePath; rowCount; contentHash; generatedAt }>;
```

**实现步骤**：
1. `projectBiographyResultRows`：对每个 result（严格保持输入顺序 = inventory 顺序），先 `primary1` 后 `primary2` 各产一行。`regionCode ?? ""`；`institutionName` 原样；`personName ?? ""`；`biographyUrl` 原样（null 时留空）；`resultZh` 由 `decisionStatus` 机械映射。UNRESOLVED slot 仍产一行（不 drop），URL 为 null。不做业务判断。
2. `renderBiographyResultRows`：`new ExcelJS.Workbook()` → `addWorksheet(BIOGRAPHY_EXCEL_SHEET_NAME)` → 表头一行 → 逐行写入；URL 非空时写 `{ text, hyperlink }`，空时 `undefined`（留空）；文本单元格经最小 `neutralizeCellText`（仅前缀 `= + - @` 的文本加前导 `'`）。写 `exportDir`，`filename = ${taskRunId}-岗位信息采集结果-${YYYY-MM-DD}.xlsx`，`contentHash = sha256(bytes)`。
3. `index.ts` 增加 `export * from "./biography-excel.js"`。

**Targeted Verification**：Task 4-A/B。

### Task 3 — Reuse workbook renderer + artifact storage + download API

**Files**：`packages/agent-runtime/src/results/biography-task-result-reader.ts`（新增）+ `.test.ts`、`packages/agent-runtime/src/index.ts`、`apps/backend/src/contracts/biography-export.ts`（新增）、`apps/backend/src/contracts/task-routes.ts`。

**Interfaces**：

```ts
// agent-runtime
export class BiographyTaskResultReader {
  constructor(private readonly single: BiographyUrlResultReader) {}
  async readMany(packetIds: string[]): Promise<BiographyUrlResult[]>; // 保持顺序, 过滤 null
}

// backend biography-export.ts
export type ExportReadiness = "EXPORTABLE" | "NOT_TERMINAL" | "NOT_FINAL_EXPORTABLE";
export function projectExportReadiness(status: string): ExportReadiness;
export const BIOGRAPHY_EXCEL_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
export function buildBiographyResultReader(repos: Repositories): {
  taskReader: BiographyTaskResultReader;
  readForTask(taskId: string): Promise<BiographyUrlResult[] | null>;
};
```

**实现步骤**：
1. `BiographyTaskResultReader`：薄 batch，逐个 `single.read(id)`，保持顺序，过滤 null。
2. `buildBiographyResultReader(repos)`：从 `repos` 直接装配（无需裸 db）：`PostgresInstitutionWorkPacketStore(repos.institutionWorkPacket)`、`PostgresReviewDecisionReader(repos.reviewDecisionSubmission)`、`CompositeCandidateViewRehydrator({ evidenceReader: new PostgresEvidenceReader(repos.investigatorEvidence), recoveryRepo: repos.recoverySubmission, reviewRepo: repos.reviewDecisionSubmission })` → `BiographyUrlResultReader`。`readForTask(taskId)`：`repos.taskRun.findById(taskId)` → `result_summary` → `results[].packetId`（inventory 顺序）→ `readMany`。
3. 重写 `GET /api/tasks/:id/export`（复用现有路由，不新增 API）：
   - `requireOwnedTask`（沿用 auth/ownership）。
   - `projectExportReadiness(task.status)`：非 EXPORTABLE → 409（NOT_TERMINAL → `{error:"TASK_NOT_READY"}`；NOT_FINAL_EXPORTABLE → `{error:"TASK_NOT_EXPORTABLE"}`）。
   - 幂等：`repos.exportArtifact.findLatestByTask(taskId)` → 存在则直接回传该文件。
   - 生成：`readForTask(taskId)` → `projectBiographyResultRows` → `renderBiographyResultRows({taskRunId, rows, exportDir: exportRoot})` → `repos.exportArtifact.save(...)`。
   - 回传：`reply.header("Content-Type", MIME).header("Content-Disposition", attachment 文件名).send(await readFile(filePath))`。
   - 失败：结构化 500 `{error:"ARTIFACT_GENERATION_FAILED"}`，不修改 Task 终态。
4. `server.ts` 无需改（`exportRoot` 已注入）。

**Targeted Verification**：Task 4-C/D/E。

### Task 4 — Targeted tests + real XLSX artifact smoke

- A. `packages/exporter/src/biography-excel.test.ts`（Projector + Renderer）：resolved→正确行；unresolved→URL null + 完整搜索后无合格URL；PRIMARY 顺序；institution 顺序（completion-order ≠ inventory-order fixture）；workbook reopen（1 sheet/名/5 表头/行数）；URL hyperlink / 空 URL null。
- B. `packages/agent-runtime/src/results/biography-task-result-reader.test.ts`：readMany 顺序 + 过滤 null（in-memory fake）。
- C. `apps/backend/src/contracts/biography-export.test.ts`：`projectExportReadiness` 三分支；`readForTask`（真实 Postgres + fake workflow 落库）。
- D. Export endpoint 定向测试（Testcontainers Postgres + fake workflow）：COMPLETED→200+Content-Type+Content-Disposition+bytes>0；PARTIAL_COMPLETED→200；非终态→409；重复 export→幂等。
- E. 一次真实 `.xlsx` Artifact Smoke：terminal Task fixture → `BiographyUrlResultReader` → `.xlsx` → HTTP download → exceljs reopen 校验。临时 exportDir 用后清理。

**不跑**：monorepo 全量 typecheck、旧 crawler/replay/playwright/Graphile 全套、真实 Agent E2E。

### Task 5 — Docs + architecture self-review + commit

**Files**：`docs/agent-runtime/biography-excel-result-artifact-pipeline.md`（新增）。内容：Purpose；Skill Scope；Excel Source of Truth；Projection；Canonical Workbook Contract；Institution/PRIMARY Ordering；PARTIAL/UNRESOLVED Semantics；Artifact Storage/Idempotency；Download API；Rebuildability；「Excel is a deterministic projection, NOT a source of truth；Final URL source = LATEST_FROZEN_APPROVED_REVIEW」；Out of Scope。

**Commit**：最多两个 commit（代码 + docs）。

---

SELF_REVIEW: PASS
ARCHITECTURE_CONFLICT: NONE
EXECUTION_PREAUTHORIZED_BY_USER: YES
EXECUTION_MODE: INLINE_FAST
TEST_POLICY: TARGETED_ONLY
SKILL_SCOPE: BIOGRAPHY_URL_ONLY
LLM_REQUIRED: NO
WEB_SEARCH_REQUIRED: NO
PRODUCTION_CHANGE_ALLOWED: NO
