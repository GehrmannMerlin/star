# Real Task Cancellation Propagation

STEP 19.1 — 让「用户点击取消」真正终止正在执行的 Biography Agent Task。

## 问题

前端「取消」按钮已绑定真实 `POST /api/tasks/:id/cancel`，但用户点击取消后，
正在 Graphile Worker 中执行的 Pi Agent / Biography Workflow 仍然持续运行。

根因：Graphile Worker 的任务处理函数（`runTaskJob`）在把任务路由到
`biographyExecutor.run(taskRunId)` 时，**从未获取或传入任何 per-task `AbortSignal`**。
取消信号在「Worker 领取作业」这一层就断掉了。

## Cancellation Architecture

```
Frontend Cancel
  → POST /api/tasks/:id/cancel
  → task-control.cancelTask：setStatus(CANCELLED)（durable）+ abortTask(taskId, "cancel")
  → task-signal 注册表（进程内 Map<taskId, AbortController>）
  → runTaskJob：getTaskSignal(taskRunId) → biographyExecutor.run(taskRunId, { signal })
  → BiographyTaskExecutionService.execute(signal)
  → MultiInstitutionBiographyCoordinator(signal)：signal.aborted 后不再领取剩余 packet
  → InstitutionBiographyWorkflowRunner(signal)：阶段边界 checkAbort() + 阶段 Runner session.abort()
  → AgentSession.abort() → 中止 model / search / fetch / browser
```

## Cross-process Boundary

当前部署（`compose.yml` 的 `backend` 服务，`STELLARIS_WORKER=1`）中，
Fastify HTTP 进程与 Graphile Worker 运行在**同一个 Node 进程**（`server.ts` 的
`buildApp` 内调用 `runWorker`）。因此 HTTP 侧的 `abortTask` 与 Worker 侧的
`getTaskSignal` 命中同一个进程内 `AbortController` 注册表，天然跨边界。

仓库中不存在 `LISTEN/NOTIFY` 或任何跨进程机制，因此本轮**未引入** PostgreSQL
NOTIFY / Redis / MQ。取消的 durable 状态（`task_run.status = CANCELLED`）由
`cancelTask` 持久化，进程内 signal 作为 fast-path 中止正在执行的作业。

> 若未来 HTTP 与 Worker 拆分为两个进程，需补 PostgreSQL `LISTEN/NOTIFY`（fast-path）
> + 以 `task_run.status = CANCELLED` 作为 durable fallback（本轮未需要）。

## Durable Cancel State

复用既有 `task_run.status`。`cancelTask` 直接 `status → CANCELLED`（终态），
不新增 Cancellation 表。

## Worker AbortController

真正执行作业的进程（当前 = 同一进程）通过 `task-signal.ts` 的
`Map<taskId, AbortController>` 拥有每个正在运行 task 的 `AbortController`：

- `getTaskSignal(taskId)`：取/建信号。
- `abortTask(taskId, "cancel")`：`controller.abort(reason)`；信号尚未创建时先建后 abort。
- `resetTaskSignal(taskId)`：resume / 崩溃恢复时清掉已 abort 信号。

`runTaskJob` 在领取作业后调用 `getTaskSignal(taskRunId)` 并把该信号传入执行器，
从而与 `cancelTask` 的 `abortTask` 命中同一控制器。

## AbortSignal Propagation

信号以 `signal?: AbortSignal` 连续贯穿（不重建无父关系的 signal）：

- `runTaskJob` → `biographyExecutor.run(taskRunId, { signal })`
- `BiographyTaskExecutionService.run(taskRunId, { signal })` → `execute(task, emit, signal)`
- `MultiInstitutionBiographyCoordinator.run(frozen, { signal })`
  → `runWithBoundedConcurrency(packets, run, limit, signal)`
- `createBiographyPacketWorkflowRunner(workflow, onResult, signal)`
- `InstitutionBiographyWorkflowRunner`（构造期 `deps.abortSignal`）→ 阶段 Runner

## Pi Cancellation

Pi SDK 已支持 `session.abort()`。阶段 Runner（Investigator/Evidence/Reviewer/Recovery）
在收到 `abortSignal` 时注册 `abort` 监听并调用 `session.abort()`，中止当前
`session.prompt()` 的 model call；`pi-tool-adapter.ts` 把 Pi tool-call 的 `signal`
传入 `ToolGateway`，从而中止 search/fetch/render/inspect。

## Tool Cancellation

- `search_web` / `fetch_page` / `render_page` / `inspect_page`：经 `ToolGateway`
  的 `ToolInvocationContext.signal` 中止对应 HTTP / browser 操作。
- 纯同步 `inspect_page`：在调用前 `signal.throwIfAborted()` 检查即可。

## Terminal State Protection

`TaskRunRepository` 所有状态推进/进度/结果投影方法统一增加
`WHERE status NOT IN (COMPLETED, PARTIAL_COMPLETED, FAILED, CANCELLED)` 守卫，
使「取消后迟到的 complete/setStatus/markStarted/setProgress/setResultSummary/
incrementProcessed」无法覆盖 `CANCELLED`（原子 CAS，非 TS 先读后写）。

## Graphile Retry Semantics

取消是 control-flow，不是失败：Worker 捕获 signal.aborted 后**正常返回**（不抛错、
不 `complete(FAILED)`），Graphile 将 job 标记完成、不重试。若因竞态重投递，
`runTaskJob` 的终态检查与 `BiographyTaskExecutionService.run` 的终态 fast-path 都会 no-op。

## Queued Cancellation

`PENDING` 任务在 Worker claim 前被取消：`cancelTask` 置 `CANCELLED`，后续 Worker
即使收到 job，`runTaskJob` 的终态检查直接返回，绝不启动 Pi Agent。

## Running Cancellation

运行中（PREPARING/CRAWLING）任务被取消：`abortTask` 中止 signal → 阶段 Runner
`session.abort()` 中止当前 model/tool call → workflow 阶段边界 `checkAbort()` 抛错
向上传播 → coordinator 不再领取剩余 packet → service 早退、不聚合不写终态，
任务保持 `CANCELLED`。

## Frontend SSE Behavior

`cancelTask` 成功即推送 `task.cancelled` SSE 事件；前端据此关闭 EventSource，
History 显示「已取消」；`CANCELLED` 为终态，Export 按钮保持不可用。
