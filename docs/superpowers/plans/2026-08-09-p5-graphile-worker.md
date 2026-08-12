# P5「Graphile Worker 持久队列」模块 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 从进程内编排升级为持久队列（§18.2）。Graphile Worker 可靠投递/并发领取/指数退避/锁恢复；驱动改造为 worker 处理函数；作业幂等键符合 §18.3。

**Architecture:** 延续模块化单体。新增 worker 入口（`queue.ts`），Graphile Worker `run()` 监听 `stellaris_task` 任务，处理函数按 `task_run.mode` 路由到现有驱动；task-routes 从 `void runXxxPipeline()` 改为 `quickAddJob()` 投递；`recoverInterruptedTasks` 保留兜底。驱动内部逻辑不改。

**Tech Stack:** Graphile Worker 0.17.3（已在 backend 依赖，R-06）；TypeScript 6.0.3 / Node 24.18 / Vitest 4.1 / PostgreSQL 18。无新依赖。

## Global Constraints

- 驱动内部逻辑不改（replay/multi-institution/multi-region 作为 worker 处理函数体）。
- 永久业务状态保留在项目表中；不依赖完成作业常驻队列（§18.2）。
- 作业幂等键：任务级 = `taskId + mode + ruleVersion`（§18.3 任务级）。
- Worker 优雅关闭停止领取新作业；异常退出锁恢复（§18.2）。
- 暂停/取消：worker 处理函数接 AbortSignal（R-19 注册表），协作式中止；恢复=重新投递（幂等去重）。
- `recoverInterruptedTasks` 保留（队列未领取作业兜底）。
- 生产行为必须有先失败测试；禁止 `--passWithNoTests`。
- 无新依赖；不改数据合同/证据链。

---

## 文件结构映射

### 新建文件

| 文件 | 单一责任 |
|---|---|
| `apps/backend/src/workers/queue.ts` | Graphile Worker 入口：`runWorker()`（监听 stellaris_task）+ 处理函数（按 mode 路由驱动） |
| `apps/backend/src/workers/queue.test.ts` | worker 路由/投递/处理测试 |

### 修改文件

| 文件 | 修改内容 |
|---|---|
| `apps/backend/src/contracts/task-routes.ts` | `void runXxxPipeline()` → `quickAddJob("stellaris_task", ...)` 投递（含 jobKey 幂等） |
| `apps/backend/src/server.ts` | 启动 worker（`runWorker`）或支持 `STELLARIS_WORKER=1` 独立进程启动 |
| `apps/backend/src/workers/task-control.ts` | resume/relaunch 路径：投递队列作业而非直接调用驱动 |

### 复用（不修改）

- 3 个驱动（replay/multi-institution/multi-region）作为处理函数体；
- `task-signal.ts` AbortSignal 注册表（R-19）；
- `recovery.ts`（保留兜底）；
- `toControlDeps`/`TaskControlDeps`。

---

### Task 1: Worker 入口 + 驱动路由

**Files:**
- Create: `apps/backend/src/workers/queue.ts`
- Create: `apps/backend/src/workers/queue.test.ts`

**Interfaces:**
```ts
// queue.ts
export interface WorkerDeps {
  repos: Repositories;
  evidenceStore: EvidenceStore;
  policy: SafeEgressPolicy;
  adapter?: SiteAdapter;
  fixtureUrl?: string;
  evidenceRoot: string;
  exportRoot: string;
  browserPool?: BrowserPool;
}
export async function runWorker(deps: WorkerDeps, opts?: { concurrency?: number; pollInterval?: number }): Promise<() => Promise<void>>;
// 内部：run({ concurrency, taskList: ["stellaris_task"], pgPool })
// 处理函数 runTaskJob(taskId): 查 task_run → 按 mode 路由：
//   TARGETED → runTaskPipeline / FULL_INSTITUTION(单行政区) → runMultiInstitutionPipeline / FULL_INSTITUTION(regionCodes) → runMultiRegionPipeline
// 接 AbortSignal（task-signal 注册表）；异常 → 记录 + 重抛（Graphile Worker 重试/退避）
```

- [ ] **Step 1: 写失败测试**
queue.test.ts：mock repos + 驱动，断言「投递 stellaris_task → worker 领取 → 按 mode 路由到对应驱动」；AbortSignal 中止路径。
Expected: FAIL（queue.ts 不存在）。

- [ ] **Step 2: 运行确认先失败**
- [ ] **Step 3: 最小实现**
- [ ] **Step 4: 运行通过**
- [ ] **Step 5: 相关全量验证**
Run: `pnpm --filter @stellaris/backend test`
- [ ] **Step 6: 独立验证检查点**

---

### Task 2: task-routes 改为投递队列

**Files:**
- Modify: `apps/backend/src/contracts/task-routes.ts`
- Modify: `apps/backend/src/server.ts`
- Modify: `apps/backend/src/workers/task-control.ts`

**Interfaces:**
```ts
// task-routes.ts：创建任务后
// 原: void runTaskPipeline({...})
// 新: await quickAddJob({}, "stellaris_task", { taskRunId: task.id })
//    （quickAddJob 需 pgPool 或 connectionString——从 TaskRoutesDeps 注入）
// jobKey 幂等：quickAddJob 的 jobKey = `task:${task.id}:${mode}:${ruleVersion}`
// server.ts：构建 db → createWorker if STELLARIS_WORKER=1（或默认启动单 worker）
// task-control.ts：resume/relaunch → quickAddJob 投递（替代直接调驱动）
```

- [ ] **Step 1: 写失败测试**
app.test.ts：创建任务 → 断言 `quickAddJob` 被调用（mock）或 DB 有 graphile_worker.jobs 记录；resume 后重投递。
Expected: FAIL（仍直接调驱动）。

- [ ] **Step 2: 运行确认先失败**
- [ ] **Step 3: 最小实现**
- [ ] **Step 4: 运行通过**
- [ ] **Step 5: 相关全量验证**
Run: `pnpm --filter @stellaris/backend test`
- [ ] **Step 6: 独立验证检查点**

---

### Task 3: 端到端集成验证 + 全量终验

- [ ] **Step 1: 端到端集成验证**
本地真实 PG：启动 worker（`STELLARIS_WORKER=1 node dist/server.js`）+ API，创建任务 → 队列投递 → worker 领取 → 驱动执行 → 结果落库；暂停/取消语义验证。
- [ ] **Step 2: 全量验证**
Run: `pnpm typecheck && pnpm test && pnpm build`
Expected: 全部 PASS。
- [ ] **Step 3: 合同一致性自查**
  - 创建任务走 `quickAddJob`，jobKey 含 `taskId+mode+ruleVersion`；
  - worker 路由到 3 驱动正确；AbortSignal 暂停/取消生效；
  - recovery 保留兜底；无 `--passWithNoTests`；无新依赖。

---

## 自审记录

1. **规格覆盖**：D1-D5 全部映射（worker 入口→T1、投递改造→T2、集成终验→T3）；冻结 §18.2/18.3/18.1 覆盖。
2. **占位符扫描**：无 TBD/TODO；关键接口含实际签名。
3. **接口一致性**：`WorkerDeps`/`runWorker` 跨任务一致；复用驱动/`task-signal`/`recovery`/`TaskControlDeps`。
4. **依赖顺序**：worker 入口→投递改造→集成终验。
5. **先失败测试**：每任务含"写失败→确认失败→最小实现→通过→全量验证→独立检查点"。
6. **无越权动作**：驱动内部不改；无新依赖；无真实抓取。
7. **风险**：Graphile Worker 0.17.3 API 差异（quickAddJob vs addJob）——已核验 `run`/`quickAddJob` 可用；端到端集成需真实 PG——用本地 Testcontainers。

### 设计输入 → 计划任务映射

| 设计输入章节 | 计划任务 |
|---|---|
| D2 worker 入口 + D1 按任务路由 | Task 1 |
| D3 投递改造 + 暂停/取消 | Task 2 |
| D4 幂等键 + D5 边界 + 集成终验 | Task 3 |
