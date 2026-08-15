# Frontend Task Result History and Excel Binding Implementation Plan

## Goal

把当前 `apps/web` 前端页面真正绑定到已完成的 STEP 17/18 后端（Task API / SSE / History / Export），形成用户可见闭环：选择行政区 → 点击开始采集 → 创建真实 Task → 实时任务进度 → 任务终态 → 历史记录 → 导出真实 Excel。

本轮是 **Frontend Integration Phase**，不是 Agent Development Phase。禁止新增 Agent / Tool / Reviewer / Recovery / Evidence Type / Search Provider / Model Provider / Skill Workflow；禁止 UI 重设计；禁止重新跑真实 Pi Agent / LLM / Search / Browser。

## Architecture

- 前端 `apps/web`（React 19 + TypeScript + Vite + @tanstack/react-query/react-table，Vitest/jsdom 测试）。
- 后端 `apps/backend`（Fastify 5 + Graphile Worker + PostgreSQL）。后端已由 STEP 17/18 完成，本轮**不改后端业务逻辑**。
- 数据流：`WorkspaceView` → `ApiClient`（`main.tsx` 的 `realApi`）→ `fetchAuthenticated` / `openAuthenticatedEvents` → 后端 REST/SSE。
- Task 状态 SSoT = 后端 `task_run` 行；前端只保存 `activeTaskId` 到 localStorage（不存完整 result/progress/History/Excel）。

## Tech Stack

- React 19.2.8, TypeScript 6.0.3, Vite 8.2.0, Vitest 4.1.10 + @testing-library/react 16.3.2（jsdom）。
- 后端 Fastify 5.11.0（已具备）。共享契约包 `@stellaris/contracts`（TypeBox）。

## Global Constraints

1. UI 布局冻结：不改页面结构、不加配置项、不加 Model/Provider/API Key 输入、不加高级设置。
2. 不新增第二套 Task API / Repository / SSE manager；复用现有 `ApiClient`、`repos.taskRun`、`openAuthenticatedEvents`。
3. 不伪造 progress / demo history / fake status；所有进度来自后端 SSE + snapshot。
4. 禁止真实 Agent / LLM / Search 运行；本轮 `NO LLM / NO SEARCH / NO BROWSER`。
5. `PARTIAL_COMPLETED` 是正常业务终态（部分岗位无 Biography URL），不是系统失败；不显示红色失败语义。
6. 非终态禁止导出；只有 `COMPLETED` / `PARTIAL_COMPLETED` 可导出。
7. 导出走现有 `GET /api/tasks/:id/export`（二进制 Blob 下载），后端 Artifact 幂等已具备。
8. Pause / Cancel：后端已有真实 endpoint（`pauseTask`/`resumeTask`/`cancelTask`），前端已绑定 `controlTask`，不新增 fake pause/cancel。
9. 不把测试 fixture 写进生产前端；测试数据只存在于 test 文件。
10. 生产环境（容器/DB/Nginx/deploy）一律不动。

## Current Frontend File Map

| 文件 | 职责 |
|---|---|
| `apps/web/src/app.tsx` | `ApiClient` 接口 + `App` + `WorkspaceView` + `DetailView` + `buildCreateRequest` |
| `apps/web/src/main.tsx` | `realApi`（fetch + 原生 EventSource 实现） |
| `apps/web/src/api-url.ts` | `apiUrl()` 子路径 helper |
| `apps/web/src/auth-http.ts` | `fetchAuthenticated` / `downloadAuthenticatedBlob` / `openAuthenticatedEvents` |
| `apps/web/src/components/TaskForm.tsx` | 模式选择 + 提交按钮（开始采集） |
| `apps/web/src/components/RegionPicker.tsx` | 省/地市/区县三级选择 |
| `apps/web/src/components/TaskDetail.tsx` | 任务状态栏（statusZh / 计数）+ 导出按钮 |
| `apps/web/src/components/TaskControlButtons.tsx` | 暂停/继续/取消（`task.controlable` 显隐） |
| `apps/web/src/components/TaskHistory.tsx` | 历史列表（分页/筛选，`listTasks`） |
| `apps/web/src/components/ResultsTable.tsx` | 结果行表 |

**已绑定（本轮不动）**：`createTask`、`getTask`、`getResults`（单次）、`getEvidence`、`listTasks`、`controlTask`、`listProvinces`、`listChildren`、`downloadExport` 均已通过 `realApi` 接到对应路由。

**未绑定 / 缺口（本轮工作）**：
1. `openEvents`（SSE）在接口与 `main.tsx` 中已声明/实现，但 `app.tsx` **从未消费** —— 无实时进度更新。
2. 无 `activeTaskId` 持久化 + 刷新/返回重灌（rehydration）。
3. 导出按钮未按终态 gating（`TaskDetail.tsx` 恒 enabled）。
4. `downloadAuthenticatedBlob` 用空 `download` 属性丢失后端文件名，且未处理 409/404/500 非 OK 响应（会把错误 JSON 当 Blob 下载）。

## Current Backend Contract Map（已从源码逐条读取确认）

所有路由已在 `apps/backend/src/contracts/task-routes.ts`、`region-routes.ts`、`biography-export.ts` 实装，前端接口 1:1 对应：

| 前端方法 | 路由 | 请求 | 响应 |
|---|---|---|---|
| `createTask` | `POST /api/tasks` | `CreateTaskRequest`（幂等 key + mode + regionCode/Name + institution…） | `{ task: TaskRunSummary, idempotencyResult }` |
| `listTasks` | `GET /api/tasks` | query `limit/offset/status/mode` | `{ tasks: TaskRunSummary[], total }` |
| `getTask` | `GET /api/tasks/:id` | — | `TaskDetail { task, scopes, institution }` |
| `getResults` | `GET /api/tasks/:id/results` | — | `ResultRowView[]` |
| `getEvidence` | `GET /api/tasks/:id/evidence/:resultRowId` | — | `EvidenceDetail` |
| `downloadExport` | `GET /api/tasks/:id/export` | — | `.xlsx`（COMPLETED/PARTIAL_COMPLETED→200；FAILED/CANCELLED→409 NOT_FINAL_EXPORTABLE；其余→409 NOT_TERMINAL） |
| `openEvents` | `GET /api/tasks/:id/events` | — | SSE（task.state_changed / task.progress_changed / task.completed / task.failed / task.cancelled / task.paused / task.resumed …） |
| `controlTask` | `POST /api/tasks/:id/pause\|resume\|cancel` | — | `TaskControlResponse { ok, task?, error? }` |
| `listProvinces` | `GET /api/regions/provinces` | — | `RegionNode[]` |
| `listChildren` | `GET /api/regions/children?parent=` | — | `RegionNode[]` |

**Task 状态枚举**（`@stellaris/contracts` `TaskRunStatus`，12 项）：`PENDING / PREPARING / CRAWLING / RECOVERING / REVIEWING / GENERATING / PAUSED / CANCELLING / CANCELLED / COMPLETED / PARTIAL_COMPLETED / FAILED`。终态集合 = `COMPLETED / PARTIAL_COMPLETED / FAILED / CANCELLED`；可导出集合 = `COMPLETED / PARTIAL_COMPLETED`。`statusZh` 已由后端 `toTaskSummary` 提供，前端**不重复造中文映射**。

**History List API 已存在**（`GET /api/tasks`），复用 `repos.taskRun.listRecent/count` —— 本轮**不需要新增后端路由**。

## Tasks

### Task 1 — Audit current frontend + backend contracts（已完成，本轮记录）

**Files**：`apps/web/src/*`、`apps/backend/src/contracts/*`（只读）。
**结果**：见上文 File Map / Contract Map。结论：后端已完备，前端缺口 = SSE 消费 + rehydration + 导出 gating/文件名/错误处理。
**Verification**：无需改动；结论已写入本 Plan。
**Commit**：无（纯审计）。

### Task 2 — Add task-status helpers

**Files**：`apps/web/src/task-status.ts`（新建）。

**Interfaces**：
```ts
import type { TaskRunStatus } from "@stellaris/contracts";
export const TERMINAL_STATUSES: ReadonlySet<string>;
export const EXPORTABLE_STATUSES: ReadonlySet<string>;
export function isTerminalStatus(status: string): boolean;
export function isExportableStatus(status: string): boolean;
```

**Steps**：以 `TaskRunStatus` 字符串字面量定义集合，导出两个纯函数（未知状态安全 fallback 到 `false`）。

**Targeted Verification**：`apps/web/src/task-status.test.ts`（vitest 断言终态/可导出/未知状态）。

**Commit**：并入最终 commit。

### Task 3 — Bind SSE progress + snapshot rehydration in WorkspaceView

**Files**：`apps/web/src/app.tsx`（`WorkspaceView`）。

**Interfaces**（内部，不改 `ApiClient`）：
- `readActiveTaskId(): string | null` / `writeActiveTaskId(id): void` / `clearActiveTaskId(): void`（localStorage 薄封装，仅存 taskId）。
- SSE 事件监听：`task.state_changed`（更新 status/statusZh）、`task.progress_changed`（更新 processed/total）、`task.completed`/`task.failed`/`task.cancelled`（终态 → close SSE + 拉最终 snapshot+results 对齐）、`task.paused`/`task.resumed`（更新 status）。

**Steps**：
1. `WorkspaceView` 增加 `useRef<EventSource | null>` 管理连接。
2. `handleSubmit` 成功后 `writeActiveTaskId(task.id)`。
3. 挂载 `useEffect`：读 `activeTaskId` → `getTask` → 终态则恢复 UI，活动态则 `openEvents` 订阅；404 则 `clearActiveTaskId`。
4. SSE effect 按 `task.id` + 是否终态订阅/关闭；terminal event → close + `getTask`/`getResults` 最终对齐。
5. unmount 关闭 EventSource（防泄漏）。

**Targeted Verification**：`apps/web/src/app.test.tsx` 新增用例：非终态 createTask 后 `openEvents` 被调用；触发 `task.completed` 后 `getTask`/`getResults` 重拉；终态任务不订阅 SSE；localStorage 存在 activeTaskId 时挂载即 `getTask` 恢复；404 时清除 activeTaskId。

**Commit**：并入最终 commit。

### Task 4 — Export gating + Content-Disposition filename + error handling

**Files**：`apps/web/src/components/TaskDetail.tsx`、`apps/web/src/auth-http.ts`。

**Interfaces**：
- `TaskDetail.tsx`：导出按钮 `disabled={!isExportableStatus(task.status)}`。
- `auth-http.ts`：`downloadAuthenticatedBlob` 先判 `response.ok`（非 OK → 读后端 `{error}` 映射中文并 `throw`），再解析 `Content-Disposition` 的 `filename*`（RFC 5987）或 `filename=`，fallback `export.xlsx`，赋给 `link.download`。
- 新增纯函数 `filenameFromContentDisposition(header: string | null): string | null`（可测）。

**Steps**：见上。`WorkspaceView`/`DetailView` 的 `handleExport` 加 try/catch 把错误写入既有 `error` state（复用现有 `<p className="error">`）。

**Targeted Verification**：`auth-http.test.ts` 新增 `filenameFromContentDisposition` 解析 + 非 OK 抛错；`app.test.tsx` 断言非终态导出按钮 disabled、COMPLETED/PARTIAL_COMPLETED enabled。

**Commit**：并入最终 commit。

### Task 5 — Targeted tests + typecheck + build + docs + commit

**Files**：`apps/web/src/task-status.test.ts`（新）、`apps/web/src/app.test.tsx`（扩）、`apps/web/src/auth-http.test.ts`（扩）、`docs/agent-runtime/frontend-task-result-history-excel-binding.md`（新）。

**Steps**：
1. 补 5–8 个高价值前端单测（status mapping / SSE 订阅与终态 / rehydration / 导出 gating / filename 解析）。
2. `pnpm --filter @stellaris/web typecheck`。
3. `pnpm --filter @stellaris/web build`（只 build web app）。
4. 写实现文档 `docs/agent-runtime/frontend-task-result-history-excel-binding.md`。
5. `git add` + commit：`feat(web): bind frontend to biography task runtime`（docs 若独立最多两个 commit）。

**Targeted Verification**：见上 + `pnpm --filter @stellaris/web test`（web 包内 targeted，不跑全仓）。

**Commit**：见上。

> 后端本轮零改动（History List API 已存在，无需新增）。若 `git status` 显示后端文件无改动即符合预期。

## Self Review（写 Plan 后自检）

- [x] 页面布局没有重新设计
- [x] 没增加用户模型配置 / API Key 配置 / Provider 配置
- [x] 省市区三级选择保留
- [x] 开始采集绑定真实 `POST /api/tasks`（已绑定，不动）
- [x] 没有第二套 Task API
- [x] Task Status / Progress 来自后端（SSE + snapshot），不伪造
- [x] COMPLETED / PARTIAL_COMPLETED / FAILED 正确展示（后端 statusZh）
- [x] PARTIAL_COMPLETED 不当 FAILED（沿用后端 statusZh「部分完成」）
- [x] History 来自后端（`GET /api/tasks`），无 demo data
- [x] Export 使用现有 `GET /api/tasks/:id/export`；COMPLETED/PARTIAL 可导出；非终态禁用
- [x] Refresh 后可恢复 Active Task（localStorage 存 taskId + getTask snapshot）
- [x] Frontend 不成为 Task 状态 SSoT
- [x] 不重新跑 Agent / 不改 Skill / 不改 Excel Renderer / 不改 Graphile workflow / 不改 Production
- [x] 不跑 Full Tests（仅 web targeted + typecheck + build）

SELF_REVIEW: PASS
ARCHITECTURE_CONFLICT: NONE
EXECUTION_PREAUTHORIZED_BY_USER: YES
EXECUTION_MODE: INLINE_FAST
TEST_POLICY: TARGETED_ONLY
UI_REDESIGN_ALLOWED: NO
SKILL_SCOPE: BIOGRAPHY_URL_ONLY
LLM_REQUIRED: NO
PRODUCTION_CHANGE_ALLOWED: NO
