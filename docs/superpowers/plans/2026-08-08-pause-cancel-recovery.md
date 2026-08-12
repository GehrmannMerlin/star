# 「暂停/继续/取消与崩溃恢复」模块 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为现有进程内编排（replay-driver / multi-institution-driver / multi-region-driver）补齐用户可控制的任务生命周期：**暂停/继续、取消（保留证据、可复制为新任务）、崩溃恢复**（未完成任务可恢复继续，已提交证据不重复写入）。

**Architecture:** 延续模块化单体 + 进程内编排。新增「任务控制 repository」（`pause`/`resume`/`cancel`/`duplicate`，条件更新 + 状态机）、「协作式取消信号 + 状态守卫」（驱动签名增加 `signal`，检查点 `throwIfAborted`）、「崩溃恢复入口」（启动扫描未完成任务 → 重新拉取驱动）。**不引入 Graphile Worker**（决策 D1，见设计输入 §4；Graphile Worker 列后续）。

**Tech Stack:** 复用第一闭环至多行政区模块全栈（TypeScript 6.0.3 / Node 24.18 / Vitest 4.1 / PostgreSQL 18 / Kysely 0.29.4 / Fastify 5.11.0）；`task_run` 表结构已含 `status/started_at/finished_at/error_message/processed_institutions`，**无新依赖、无 schema 变更**（复用既有 12 状态枚举与 `enums.ts` 中文映射）。

## Global Constraints

- 本模块不改变已批准的数据合同与证据链：`target_scope`、`institution_snapshot`、`result_row`、`review_decision`、`export_artifact` 结构不变；`task_run` 无 schema 变更。
- 数据存储根、PostgreSQL 参数、依赖精确版本、非 Git 边界均沿用（R-01/R-02/R-06/R-07/R-12/R-18）。
- 真实网络边界：本模块自动测试全部离线（fixture + 模拟崩溃/重启）；真实抓取仍属需用户逐项授权的 Canary。
- 安全边界沿用：DNS-pinned SSRF、逐跳重定向、脱敏、robots；不登录、不解验证码、不绕过访问控制。
- 生产行为必须有先失败测试；禁止 `--passWithNoTests`。
- 暂缓（不删除）：Graphile Worker 持久队列、行政区级并行、大规模性能目标、全国行政区数据。
- 状态机合法性（来自冻结 §5.3/5.4/18.1/18.4，全模块不变量）：
  - `PAUSED` 只能从非终态进入（`PENDING/PREPARING/CRAWLING/RECOVERING/REVIEWING`），且从 `PAUSED` 可 `resume`；
  - `CANCELLED` 只能从非终态进入，且为**终态**（不可 resume；可 duplicate）；
  - `CANCELLING` 是过渡态（取消信号已发，活动 Worker 检查点后到 `CANCELLED`）；
  - 终态集合：`COMPLETED/PARTIAL_COMPLETED/FAILED/CANCELLED`；终态不可 pause/cancel/resume。

---

## 文件结构映射

> 每个文件单一责任；按纵向可测试交付物拆任务。

### 新建文件

| 文件 | 单一责任 |
|---|---|
| `apps/backend/src/workers/task-signal.ts` | 每任务 AbortController 注册表（`getSignal`/`abort`/`reset`） |
| `apps/backend/src/workers/task-signal.test.ts` | 信号注册表测试 |
| `apps/backend/src/workers/task-control.ts` | 任务控制核心：`pauseTask`/`resumeTask`/`cancelTask`/`duplicateTask`（repository + 信号 + SSE + 重新拉起驱动） |
| `apps/backend/src/workers/task-control.test.ts` | 任务控制集成测试（真实 PostgreSQL + fixture + 模拟暂停/取消/崩溃恢复） |
| `apps/backend/src/workers/recovery.ts` | 崩溃恢复入口：`recoverInterruptedTasks`（启动扫描 + 重新拉取驱动） |

### 修改文件

| 文件 | 修改内容 |
|---|---|
| `packages/contracts/src/task.ts` | 新增 `TaskControlResponse`；`TaskRunSummary` 增加 `controlable` 字段（前端按钮可用性判断） |
| `packages/contracts/src/sse.ts` | 新增 `task.paused` / `task.resumed` / `task.cancelled` 事件（若现有 `TaskCompleted/TaskFailed` 不足以表达，则补） |
| `packages/contracts/src/index.ts` | 导出新合同 |
| `apps/backend/src/contracts/task-routes.ts` | 新增 4 路由：`POST /api/tasks/:id/pause`、`POST .../resume`、`POST .../cancel`、`POST .../duplicate` |
| `apps/backend/src/workers/replay-driver.ts` | 签名增加 `signal?: AbortSignal`；检查点 `signal.throwIfAborted()` |
| `apps/backend/src/workers/multi-institution-driver.ts` | 签名增加 `signal?: AbortSignal`；检查点 |
| `apps/backend/src/workers/multi-region-driver.ts` | 签名增加 `signal?: AbortSignal`；检查点 |
| `apps/backend/src/server.ts` | 调 `recoverInterruptedTasks`（启动扫描） |
| `apps/backend/src/contracts/region-routes.ts` | **不动**（无任务控制需求） |

### 复用（不修改）

- `task_run` 表 + `TaskRunStatus`/`TaskRunStatusZh`（12 状态枚举已含 PAUSED/CANCELLING/CANCELLED）；
- `createWithIdempotency`（duplicate 生成新任务 ID）；
- `result_row`/`institution_snapshot` 唯一约束（幂等防重写）；
- 三套驱动（跑纵向链路）。

---

### Task 1: 每任务 AbortSignal 注册表 + 驱动检查点

**Files:**
- Create: `apps/backend/src/workers/task-signal.ts`
- Create: `apps/backend/src/workers/task-signal.test.ts`
- Modify: `apps/backend/src/workers/replay-driver.ts`、`multi-institution-driver.ts`、`multi-region-driver.ts`

**Interfaces:**
- Consumes: 无
- Produces:
```ts
// task-signal.ts
export function getTaskSignal(taskRunId: string): AbortSignal;
export function abortTask(taskRunId: string, reason: "pause" | "cancel"): void;
export function resetTaskSignal(taskRunId: string): void;  // resume 时清掉已 abort 信号
```

三个驱动的 `*PipelineInput` 增加 `signal?: AbortSignal`；在检查点（任务启动后、每机构处理前 `processSingleInstitution`、每行政区处理前、网络请求前）调用 `signal?.throwIfAborted()`。

- [ ] **Step 1: 写失败测试**
`task-signal.test.ts`：
```ts
describe("task-signal 注册表", () => {
  it("getTaskSignal 返回同一任务同一信号；abort 后 throwIfAborted 抛错", () => {
    const s1 = getTaskSignal("t1");
    abortTask("t1", "pause");
    expect(() => s1.throwIfAborted()).toThrow();
  });
  it("resetTaskSignal 清掉已 abort 信号，新信号可继续", () => {
    resetTaskSignal("t1");
    const s2 = getTaskSignal("t1");
    expect(() => s2.throwIfAborted()).not.toThrow();
  });
});
```
Expected: FAIL（task-signal.ts 不存在）。

- [ ] **Step 2: 运行确认先失败**
Run: `pnpm --filter @stellaris/backend exec vitest run src/workers/task-signal.test.ts`
Expected: FAIL。

- [ ] **Step 3: 最小实现**
`task-signal.ts`（Map<taskRunId, AbortController>）；三个驱动签名增加 `signal?: AbortSignal`，检查点插入 `signal?.throwIfAborted()`。

- [ ] **Step 4: 运行通过**
Expected: PASS。

- [ ] **Step 5: 相关全量验证**
Run: `pnpm --filter @stellaris/backend typecheck && pnpm test`
Expected: PASS（既有驱动测试必须保持绿——检查点为可选，不传 signal 时行为不变）。

- [ ] **Step 6: 独立验证检查点**
Run: `pnpm --filter @stellaris/backend test`
Expected: 退出码 0。

---

### Task 2: 任务控制核心（pause/resume/cancel/duplicate）

**Files:**
- Create: `apps/backend/src/workers/task-control.ts`
- Create: `apps/backend/src/workers/task-control.test.ts`

**Interfaces:**
- Consumes: `getTaskSignal`/`abortTask`/`resetTaskSignal`、三套驱动、`createWithIdempotency`、`pushSseEvent`、`Repositories`
- Produces:
```ts
export interface TaskControlDeps {
  repos: Repositories;
  evidenceStore: EvidenceStore;
  policy: SafeEgressPolicy;
  fixtureUrl?: string;
  adapter?: SiteAdapter;
  runTaskPipeline: RunTaskPipeline;
  runMultiInstitutionPipeline?: RunMultiInstitutionPipeline;
  runMultiRegionPipeline?: RunMultiRegionPipeline;
  emit: (taskId: string, e: SseEvent) => void;  // 即 pushSseEvent
  evidenceRoot: string;
}
export async function pauseTask(taskRunId: string, deps: TaskControlDeps): Promise<{ ok: boolean; task?: TaskRunRow; error?: string }>;
export async function resumeTask(taskRunId: string, deps: TaskControlDeps): Promise<{ ok: boolean; task?: TaskRunRow; error?: string }>;
export async function cancelTask(taskRunId: string, deps: TaskControlDeps): Promise<{ ok: boolean; task?: TaskRunRow; error?: string }>;
export async function duplicateTask(taskRunId: string, deps: TaskControlDeps): Promise<{ ok: boolean; newTaskId?: string; error?: string }>;
```
状态机逻辑（全模块不变量）：
- `pauseTask`：`task.status` 在可暂停集 → `setStatus(PAUSED)` + `abortTask(reason:"pause")` + 发 `task.paused`；
- `resumeTask`：`task.status === "PAUSED"` → `resetTaskSignal` + `setStatus(CRAWLING)` + 按 mode 重新拉起对应驱动（TARGETED→`runTaskPipeline`；FULL_INSTITUTION 多行政区→`runMultiRegionPipeline`；FULL_INSTITUTION 单行政区→`runMultiInstitutionPipeline`）+ 发 `task.resumed`；
- `cancelTask`：可取消集（非终态）→ `setStatus(CANCELLING)` + `abortTask(reason:"cancel")` → 活动 Worker 检查点中止后 `setStatus(CANCELLED)`（保留证据，不 complete）+ 发 `task.cancelled`；若任务本无活动 Worker（PENDING）→ 直接 `CANCELLED`；
- `duplicateTask`：复制 target_scope + institution_snapshot + 规则版本到新任务（新 idempotency_key `duplicate-<uuid>`）→ 返回新任务 ID。

`task-control.test.ts`（真实 PostgreSQL + fixture，模拟驱动为慢驱动或真实驱动 + 快速暂停）：
```ts
it("暂停 → 任务 PAUSED，继续 → 重新拉起驱动直至完成", async () => { ... });
it("取消 → CANCELLING → CANCELLED，证据保留，不可继续，可复制新任务", async () => { ... });
it("暂停/继续期间已提交 result_row 不重复写入", async () => { ... });
```

- [ ] **Step 1: 写失败测试**
Expected: FAIL（task-control.ts 不存在）。

- [ ] **Step 2: 运行确认先失败**
Expected: FAIL。

- [ ] **Step 3: 最小实现**
task-control.ts（状态机 + 信号 + 驱动拉起 + SSE）。

- [ ] **Step 4: 运行通过**
Expected: PASS。

- [ ] **Step 5: 相关全量验证**
Run: `pnpm --filter @stellaris/backend typecheck && pnpm test`
Expected: PASS。

- [ ] **Step 6: 独立验证检查点**
Run: `pnpm --filter @stellaris/backend test`
Expected: 退出码 0。

---

### Task 3: 任务控制 API（pause/resume/cancel/duplicate 路由）

**Files:**
- Modify: `packages/contracts/src/task.ts`（新增 `TaskControlResponse`；`TaskRunSummary` 增加 `controlable`）
- Modify: `packages/contracts/src/sse.ts`（新增 `task.paused`/`task.resumed`/`task.cancelled` 事件）
- Modify: `packages/contracts/src/index.ts`
- Modify: `apps/backend/src/contracts/task-routes.ts`

**Interfaces:**
- Consumes: `TaskControlDeps`、`pauseTask`/`resumeTask`/`cancelTask`/`duplicateTask`
- Produces:
```ts
// task.ts
export const TaskControlResponse = Type.Object({
  ok: Type.Boolean(),
  task: Type.Optional(TaskRunSummary),
  newTaskId: Type.Optional(Type.String()),
  error: Type.Optional(Type.String()),
});
// TaskRunSummary 增加 controlable: Type.Boolean()  // 前端按钮可用性
// sse.ts 新增（判别字段 type）
// { type: "task.paused", taskRunId, statusZh: "已暂停", seq }
// { type: "task.resumed", taskRunId, statusZh: "正在抓取", seq }
// { type: "task.cancelled", taskRunId, statusZh: "已取消", seq }
```
`task-routes.ts` 新增 4 路由，各返回 `TaskControlResponse`。`task-routes` 需注入 `TaskControlDeps`（或复用现有 deps + signal registry）。注意 `controlable` 在创建/详情响应的 `taskView` 中计算（状态不在终态）。

- [ ] **Step 1: 写失败测试**
`app.test.ts` 新增：
```ts
it("POST /api/tasks/:id/pause → 任务 PAUSED（或已终态返回 error）", async () => { ... });
it("POST /api/tasks/:id/cancel → 任务 CANCELLED，结果保留，/duplicate 返回新任务 id", async () => { ... });
```
Expected: FAIL（路由未实现 + 合同未导出）。

- [ ] **Step 2: 运行确认先失败**
Expected: FAIL。

- [ ] **Step 3: 最小实现**
contracts 新增合同并导出；task-routes 新增 4 路由，注入 `TaskControlDeps`。

- [ ] **Step 4: 运行通过**
Expected: PASS。

- [ ] **Step 5: 相关全量验证**
Run: `pnpm --filter @stellaris/contracts typecheck && pnpm test && pnpm --filter @stellaris/backend typecheck && pnpm test`
Expected: PASS。

- [ ] **Step 6: 独立验证检查点**
Run: `pnpm --filter @stellaris/backend test`
Expected: 退出码 0。

---

### Task 4: 崩溃恢复入口

**Files:**
- Create: `apps/backend/src/workers/recovery.ts`
- Modify: `apps/backend/src/server.ts`

**Interfaces:**
- Consumes: 三套驱动、`Repositories`、`createWithIdempotency`
- Produces:
```ts
export async function recoverInterruptedTasks(deps: TaskControlDeps): Promise<{ recovered: number }>;
// 扫描 task_run 中 status IN (PENDING, PREPARING, CRAWLING, RECOVERING, REVIEWING, CANCELLING) 的任务；
// 对每个：resetTaskSignal + 按 mode 重新拉起对应驱动（TARGETED→runTaskPipeline；FULL_INSTITUTION→runMultiRegionPipeline/runMultiInstitutionPipeline）。
// institution_snapshot/result_row 幂等 upsert 保证不重复写入已提交证据。
```
`server.ts`：`buildApp` 末尾调 `recoverInterruptedTasks`（传入与 task-routes 相同的 deps）。注意：`PENDING` 且 `started_at IS NULL` 的任务（创建后驱动未启动，如 fixtureUrl 缺失）不恢复（避免空转）。

`recovery.test.ts`（可选并入 task-control.test.ts）：创建任务 → 跑驱动中途 `process.exit` 模拟崩溃 → 重启 → `recoverInterruptedTasks` → 任务继续到 COMPLETED 且 result_row 不重复。

- [ ] **Step 1: 写失败测试**
Expected: FAIL（recovery.ts 不存在）。

- [ ] **Step 2: 运行确认先失败**
Expected: FAIL。

- [ ] **Step 3: 最小实现**
recovery.ts + server.ts 接入。

- [ ] **Step 4: 运行通过**
Expected: PASS。

- [ ] **Step 5: 相关全量验证**
Run: `pnpm --filter @stellaris/backend typecheck && pnpm test`
Expected: PASS。

- [ ] **Step 6: 独立验证检查点**
Run: `pnpm --filter @stellaris/backend test`
Expected: 退出码 0。

---

### Task 5: 全量终验

- [ ] **Step 1: 全量验证**
Run: `pnpm typecheck && pnpm test && pnpm build`
Expected: 全部 PASS（8 工作区全绿；新增测试计入 backend）。

- [ ] **Step 2: 独立验证检查点**
Run: `pnpm typecheck && pnpm test && pnpm build`
Expected: 退出码 0。

- [ ] **Step 3: 合同一致性自查**
- `TaskControlResponse`/`controlable` 已从 contracts 导出且 `index.ts` 可见；
- `task.paused/resumed/cancelled` 已加入 `SseEvent` Union；
- 三套驱动签名与调用点（task-routes、server、recovery）一致；
- 无 `--passWithNoTests`；每个新交付物有先失败测试。

---

## 自审记录

1. **规格覆盖**：设计输入 §5 五项任务全部映射（信号注册表→T1、任务控制核心→T2、API→T3、崩溃恢复→T4、终验→T5）；冻结 §5.3/5.4/18.1/18.2/18.3/18.4/19.1 全覆盖。
2. **占位符扫描**：无 TBD/TODO/"类似前一任务"；所有代码步骤含实际代码或 Schema 形状。
3. **接口一致性**：`getTaskSignal`/`abortTask`/`resetTaskSignal`、`pauseTask`/`resumeTask`/`cancelTask`/`duplicateTask`、`recoverInterruptedTasks` 跨任务签名一致；复用 `createWithIdempotency`、`pushSseEvent`、三套驱动。
4. **依赖顺序**：信号注册表 → 任务控制核心 → API → 崩溃恢复 → 终验，形成连续纵向闭环。
5. **先失败测试**：每任务含"写失败→确认失败→最小实现→通过→全量验证→独立检查点"。
6. **无越权动作**：无 schema 变更、无新依赖、无真实网络；崩溃恢复测试用模拟崩溃（进程内仿真）而非真实容器重启。
7. **风险处理**：设计输入 §4 风险 A（崩溃丢驱动）由 T4 崩溃恢复覆盖；风险 B（并发防重）由状态守卫 + 条件更新覆盖；风险 C（取消信号时机）按冻结 §5.3 宽限期语义接受。

### 设计输入 → 计划任务映射

| 设计输入章节 | 计划任务 |
|---|---|
| 决策 D2 协作式取消 + 状态守卫 | Task 1 |
| 决策 D3 四类控制 | Task 2（核心）+ Task 3（API） |
| 决策 D4 崩溃恢复入口 | Task 4 |
| 全量终验 | Task 5 |
