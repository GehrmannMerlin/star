# Frontend Task Result History and Excel Binding

## Purpose

STEP 19：把 `apps/web` 前端绑定到已完成的 STEP 17/18 后端，形成用户可见闭环（选行政区 → 开始采集 → 实时进度 → 终态 → 历史 → 导出 Excel）。本轮只做 **Data / State / API binding**，不改后端业务逻辑、不改 UI 布局、不跑真实 Agent。

## Current UI Preserved

- 保留既有页面结构：`政务简历采集` Header + 任务台 / 历史记录 两视图。
- 保留 `TaskForm`（完整机构模式 + 指定机构）、`RegionPicker`（省/地市/区县三级）、`TaskDetail`（状态栏 + 计数）、`TaskControlButtons`（暂停/继续/取消）、`TaskHistory`（列表 + 分页/筛选）、`ResultsTable`（结果行）。
- 未新增 Model / Provider / API Key / 高级设置配置项。

## Region Selection Binding

- `RegionPicker` 继续通过 `listProvinces`（`GET /api/regions/provinces`）与 `listChildren`（`GET /api/regions/children?parent=`）级联加载。
- 三级语义保持：仅省 → 省级；省+地市 → 地市级；省+地市+区县 → 区县级（`RegionSelection.finalRegion`）。

## POST /api/tasks Binding

- `TaskForm` 提交 → `WorkspaceView.handleSubmit` → `buildCreateRequest` → `api.createTask`（`POST /api/tasks`）。
- 提交成功后保存 `activeTaskId`（仅 ID）并立即 `getResults`。

## Active Task State

- `WorkspaceView` 以 `task` state 持有当前 `TaskRunSummary`；状态 SSoT 是后端 `task_run` 行。
- 前端只把 `activeTaskId` 持久化到 `localStorage`（key `stellaris.activeTaskId`），不存完整 result / progress / History / Excel。

## SSE Progress Binding

- `openEvents`（`GET /api/tasks/:id/events`）由 `WorkspaceView` 消费；活动任务订阅，终态任务不订阅。
- 事件处理：
  - `task.state_changed` → 更新 status/statusZh；
  - `task.progress_changed` → 更新 processedInstitutions/totalInstitutions；
  - `task.completed` / `task.failed` / `task.cancelled` → 关闭 SSE + 拉最终快照对齐；
  - `task.paused` / `task.resumed` → 更新 status。
- 组件 unmount 关闭 EventSource，避免泄漏；SSE 仅更新展示，终态后由 snapshot 对齐。

## Task Snapshot Rehydration

- 挂载时读 `activeTaskId` → `getTask` + `getResults` 恢复；后端 404 则清除本地 ID，回到待开始。
- 活动任务重新订阅 SSE；终态任务直接恢复终态 UI（不再订阅）。

## COMPLETED Semantics

- 终态，导出可用，`controlable=false`（后端提供）；显示 `statusZh=已完成`。

## PARTIAL_COMPLETED Semantics

- 正常业务终态（部分岗位无 Reviewer 接受的 Biography URL），非系统失败；显示 `statusZh=部分完成`，导出可用。

## FAILED Semantics

- 系统失败终态；仅展示后端 safe user-facing message（`errorMessage`），不展示 stack / 内部错误 / Prompt。

## History Binding

- `TaskHistory` 通过 `listTasks`（`GET /api/tasks`）读取后端任务列表；分页/筛选由后端 query 决定。
- 点击行 → `DetailView`（`getTask` + `getResults` 回看）。
- 无 demo history data；后端 TaskRun Repository 是历史 SSoT。

## Excel Export Binding

- `TaskDetail` 的 `导出 Excel` 按钮 → `downloadExport`（`GET /api/tasks/:id/export`）。
- 下载走二进制 Blob（`URL.createObjectURL` → 点击 → `revokeObjectURL`）；解析 `Content-Disposition` 的 `filename*`（RFC 5987）/`filename=` 得到后端文件名，fallback `export.xlsx`。
- 非 OK（409/404/500）响应映射为中文错误（`TASK_NOT_READY` / `TASK_NOT_EXPORTABLE` / `ARTIFACT_GENERATION_FAILED` / `TASK_NOT_FOUND`），不把错误 JSON 当文件下载。

## Export Readiness

- 只有 `COMPLETED` / `PARTIAL_COMPLETED` 可导出（按钮 enabled）；其余状态按钮 disabled。
- 后端 `projectExportReadiness` 仍为最终 Authority（非终态返回 409）。

## Pause / Cancel Current Support

- 后端已有真实 `pauseTask` / `resumeTask` / `cancelTask`；前端 `TaskControlButtons` 通过 `controlTask`（`POST /api/tasks/:id/pause|resume|cancel`）绑定，按 `task.controlable` 显隐。未新增 fake pause / frontend-only cancel。

## No Frontend Model Configuration

- 创建任务请求不携带 model / provider / apiKey / searchProvider / concurrency 等字段；模型与搜索由服务器端 `ModelPolicy` + 环境配置决定。

## No Demo Data in Production

- 测试 fixture（`taskSummary` / `resultRows` / `runningTask` / `FakeEventSource`）仅存在于 test 文件；生产代码无 mock/demo 数据。

## Deferred

- `retry_resume`：检查点式断点续跑未做（当前 resume 依赖 legacy 驱动的协作式重启）。
- `full_region_real_acceptance`：全行政区真实验收（下一阶段）。
- `production_integration`：生产部署/DB/容器（下一阶段）。
- `cancel_integration`：取消在 Biography Agent Runtime 下的运行时取消链路未验证（路由已绑定）。
- `pause_resume`：pause/resume 对新 Biography Agent Runtime 的运行时支持未验证（路由已绑定）。
