# STEP 19.3 — Agent 主链纠偏 + 真实运行诊断 + 前端 Agent 进度闭环

日期：2026-08-18 · Branch `refactor/pi-agent-runtime-server-20260813`

## 背景

本轮不是新功能开发，而是**主链纠偏**。底层能力（Pi Agent Runtime、official-biography-evidence Skill、
Provider-neutral Model Runtime + DeepSeek、Provider-neutral Search Runtime + Bocha、Inventory/Investigator/
Evidence/Reviewer/Recovery、MultiInstitutionBiographyCoordinator、InstitutionBiographyWorkflowRunner、
Graphile Worker、Task SSE、History、Excel、Frontend Binding、Real Cancellation）已存在，禁止再造第二套 Agent 架构。

## 一、现状调查（真实源码 + 生产实证）

### Current Flow（POST /api/tasks → Dispatcher）

```
POST /api/tasks
  → apps/backend/src/contracts/task-routes.ts POST handler
    useMultiRegion = mode==="FULL_INSTITUTION" && body.regionCodes?.length>0
    前端 FULL 模式总传 regionCodes:[target.code]（单 code）→ useMultiRegion=true
    → expandRegions([省], "COUNTY") → 省+所有市+所有区县（多行 scope）
    → enqueueTask(task)
  → Graphile Worker runTaskJob（apps/backend/src/workers/queue.ts）
    case TARGETED:
      biographyExecutor? → BiographyTaskExecutionService.run  OK（单 scope）
      else → legacy runTaskPipeline
    case FULL_INSTITUTION:
      hasRegionCodes = scopes.length>1
      biographyExecutor && !hasRegionCodes → BiographyTaskExecutionService.run  OK
      hasRegionCodes && runMultiRegionPipeline → runMultiRegionPipeline（LEGACY multi-region）BAD
      else → runMultiInstitutionPipeline（legacy）
```

### 关键源码事实

1. **前端单选行政区被错误编码成 multi-regionCodes**
   - `apps/web/src/app.tsx` `buildCreateRequest`：FULL 模式返回 `regionCodes:[target.code]`（单选树的最后选中节点）。
   - `packages/contracts/src/region.ts` `expandRegions`：选一个省 → 省 + 所有市 + 其下所有区县。
2. **POST handler 以 regionCodes 存在判定 multi-region**
   - `useMultiRegion = FULL && regionCodes.length>0`，前端必传 → 恒为 true。
3. **queue.ts 以 scope 数判定 Biography / Legacy**
   - `if (deps.biographyExecutor && !hasRegionCodes)`：多 scope FULL 被排除出 Biography 运行时。
4. **BiographyTaskExecutionService.execute 只取 scopes[0]**（FULL 模式）；多 scope 会丢 scope。
5. **Investigator 真实可跑**：DeepSeek smoke PASS（session_created=YES、get_region_context 真实调用、
   ToolGateway RECEIVED+SUCCESS、output_marker OK、coding_tools=0）。
6. **ToolEvent 未持久化**：真实 workflow 的 Investigator/Evidence/Reviewer/Recovery 阶段全部使用
   `MemoryToolEventSink`（session 结束即丢）；`PostgresToolEventJournal` 只在 persistence-smoke 使用。
   生产 `tool_event` 表为空（0 行）——「tool_event_count=0」的直接原因。
7. **INVESTIGATION_NOT_SUBMITTED 真实发生**：生产 `institution_work_packet` 有 4 条
   failure_code=INVESTIGATION_NOT_SUBMITTED。
8. **TaskRunSummary 无 stage / currentInstitution**：`packages/contracts/src/task.ts`。
9. **前端无 polling 兜底**：`apps/web/src/app.tsx` `handleSubmit` POST 后仅 setTask + writeActiveTaskId
   + getResults，不立即 GET snapshot；SSE 依赖 buffer 回放，无快速终态兜底；无 fallback polling。

### 生产 DB 实证（只读查询）

- FULL 任务：18/19 行 target_scope、0 institution_snapshot、result_summary=NULL、秒级 COMPLETED
  → 全部走 **legacy multi-region**，绕过 Biography Runtime（问题 A 实证）。
- TARGETED 任务：1 scope + 1 snapshot、FAILED、result_summary failedPackets=1、packetState=PENDING
  （构建时初始快照）、packet failure_code=INVESTIGATION_NOT_SUBMITTED（问题 B 实证）。
- `tool_event` 表 0 行（问题 B 的 tool_event_count=0 实证）。

## 二、目标（统一主链）

```
POST /api/tasks
  → BiographyTaskExecutionService
       mode → FULL=InventoryAgentRunner / TARGETED=buildTargetedFrozenInventory
  → Frozen Institution Inventory
  → MultiInstitutionBiographyCoordinator
  → InstitutionBiographyWorkflowRunner
  → Pi Agent（Investigator→Evidence→Reviewer→Recovery）
  → BiographyUrlResult
```

FULL 与 TARGETED 只允许在 **Frozen Inventory 如何形成**阶段不同；之后必须共用同一个 Biography Runtime。
旧 Crawler 只作为 HTTP fetch utility / Browser utility / HTML parser 等机械工具存在，禁止作为 FULL
政务简历任务的业务主流程。Agent decides，Crawler assists。

## 三、实施步骤（6 个 Task）

### Task 1 — Dispatcher 统一（FULL 不再走 Legacy 业务主流程）

修改：
1. `apps/web/src/app.tsx` `buildCreateRequest`：FULL 模式**去掉 `regionCodes`**，只传
   `regionCode/regionName`（单选行政区树语义 = 任务行政区；省=省级、省+市=地市级、省+市+区县=区县级）。
2. `apps/backend/src/workers/queue.ts` `runTaskJob`：FULL_INSTITUTION 只要 `biographyExecutor` 存在就
   统一进 Biography 运行时（删除 `!hasRegionCodes` 排除）；legacy 分支（multi-region / multi-institution）
   保留给「无 biographyExecutor」配置（测试/离线/旧环境）。
3. `apps/backend/src/workers/biography-task-service.ts` `execute`：FULL 模式支持多 scope（对每个
   included scope 运行 InventoryAgentRunner，合并去重 inventory 为 Frozen Inventory）——防御性支持
   API 直传多行政区；同时保证单 scope 行为不变。
4. `apps/backend/src/workers/task-control.ts` `relaunchPipeline`：resume 路径补 biographyExecutor
   分支（TARGETED/FULL 统一经 biographyExecutor；无 executor 时回退 legacy）。

验证：
- 新 Dispatcher 测试（3-5 个）：FULL multi-scope → biographyExecutor；FULL single-scope →
  biographyExecutor；TARGETED → biographyExecutor；无 biographyExecutor → legacy 不变；legacy
  unrelated flow 不受影响。
- 复用 disposable PG e2e 模式（`web-task-graphile.e2e.test.ts` / `biography-task-service.test.ts`）。

### Task 2 — 真实 Targeted Smoke 复现 + Investigator 根因诊断（reproduces-first）

方法：
1. 启动独立 dev PostgreSQL（`docker run` postgres:17，挂 `stellaris-zhengwujianli_default` 网络）。
2. 宿主机启动 dev backend（`STELLARIS_TASK_RUNTIME=biography`、`STELLARIS_WORKER=1`、
   `AGENT_MODEL_PROVIDER=deepseek`、`AGENT_MODEL_ID=deepseek-v4-flash`、`WEB_SEARCH_PROVIDER=bocha`、
   `PGHOST=stellaris-dev-db`）。
3. 先跑受控复现：构造 TARGETED 任务，真实 POST，完整追踪：
   `InvestigatorAgentRunner → AgentSessionFactory → ModelPolicy → Pi Session → Role Tool Allowlist
   → ToolGateway → submit_investigation → ToolEventSink`。
4. 输出 Investigator Runtime Diagnostic（investigator_role/provider/model/skill_loaded/
   registered_tools/allowed_tools/session_created/model_request_started/model_response_received/
   response_kind/tool_calls_count/submit_investigation_called/session_end_reason）。
5. 根因定位与修复（按证据，不允许「加 prompt 再试」）：
   - A. tools 未注册 / allowlist 不含 → 修 registry/policy；
   - B. Pi SDK 未收到 tools → 修 session factory；
   - C. DeepSeek 无 tool_calls → 修 provider adapter / model policy / tool choice；
   - D. tool_calls 有但 adapter 未解析 → 修 pi-tool-adapter；
   - E. ToolGateway 收到但 sink 未记录 → 修 event sink；
   - F. Agent 在 tool call 前结束 → 修 prompt contract（收紧「必须调用 submit_investigation」）；
   - G. 真实网络工具失败（search/fetch/render/inspect）→ 修工具或超时。

验证：
- 真实 TARGETED smoke 必须：model_request=YES、model_response=YES、tool_calls_count>0、
  search_web CALLED、fetch_page 或 render_page CALLED、inspect_page CALLED、
  submit_investigation CALLED、submission valid。
- INVESTIGATION_NOT_SUBMITTED 修复为真实提交。

### Task 3 — ToolEvent 持久化接线 + Investigator Tool Calling 测试

修改：
1. 真实 workflow（`apps/backend/src/workers/biography-task-service.ts` 的 `buildPersistence` /
   `InstitutionBiographyWorkflowRunner`）为 Investigator/Evidence 阶段注入
   `PostgresToolEventJournal`（`createPostgresToolEventJournal(db)`），使 ToolEvent 作为 Agent
   provenance 持久化到 `tool_event` 表；每 packet 独立 journal identity（agent_session_id 隔离）。
2. 保持 ToolEvent（Agent provenance）与 Task Progress（用户业务进度）分离：不混成前端工具日志。

验证（新增 Investigator Tool Calling 测试，4-6 个）：
- INVESTIGATOR role allowlist 正确（含 submit_investigation，不含 coding tools）；
- submit_investigation 注册进 registry；
- 纯文本回答（无 submit）→ INVESTIGATION_NOT_SUBMITTED（结构化失败，不是 COMPLETED）；
- 工具调用 → ToolEvent 记录（start/success）；
- submission gate（schema 校验 + 双人 distinct + 单次 freeze）；
- observation gate（无 fetch/render + inspect 成功 → INVESTIGATION_OBSERVATION_REQUIRED）。

### Task 4 — Task Progress Domain（后端）

修改：
1. `packages/contracts/src/task.ts`：TaskRunSummary 增加 `stage?: TaskStage`、
   `currentInstitution?: string`；新增 TaskStage 联合类型（QUEUED/PREPARING/INVENTORY_DISCOVERY/
   INVENTORY_FROZEN/INVESTIGATING/EVIDENCE_GATHERING/REVIEWING/RECOVERING/FINALIZING/COMPLETED/
   PARTIAL_COMPLETED/FAILED/CANCELLED——具体枚举服从当前代码，不造第二套状态机）。
2. `packages/contracts/src/sse.ts`：`task.state_changed` 事件可选携带 `stage`。
3. `apps/backend/src/workers/biography-task-service.ts`：在业务边界更新 stage（Inventory Start、
   Inventory Frozen、Investigator Start、Evidence Start、Review Start、Recovery Start、Finalizing）
  与 currentInstitution（coordinator 开始 packet 时更新）、processedInstitutions（packet 完成自增）；
   stage/currentInstitution 通过 task_run 进度列 + result 投影读取，不新增 DB enum。
4. `apps/backend/src/contracts/task-routes.ts` `toTaskSummary`：投影 stage/currentInstitution。

验证（Progress Projection 测试，3-5 个）：Inventory/Investigating/Review/Recovery/Terminal 各阶段
stage 正确、计数真实（不使用时间模拟/随机增长）。

### Task 5 — 前端 Fast Terminal 一致性 + Agent 进度展示

修改（`apps/web/src/app.tsx` + `TaskDetail.tsx`）：
1. `handleSubmit`：POST 成功 → 保存 activeTaskId → **立即 GET /api/tasks/:id snapshot** →
   建立 SSE → 再 GET 一次 snapshot reconciliation → 进入 active loop（SSoT=snapshot）。
2. SSE 只作为「有变化了」的增量通知；真正页面状态以最新 Task Snapshot 为准。
3. 增加轻量 snapshot polling（3-5s，仅 PENDING/RUNNING 期间）；收到 terminal 事件
   （task.completed/partial/failed/cancelled）→ 立即 GET snapshot → 更新 store → 关闭 SSE →
   停止 polling。
4. `TaskDetail.tsx`：在保持整体卡片布局基础上显示：状态、当前阶段（stage 中文映射）、
   当前机构、机构进度 processed/total、已复核岗位、Recovery、官网受限、运行时间（前端由
   startedAt derive）。stage 用简单文本指示（不重建页面、不展示模型内部内容）。
5. 终端按钮：terminal 状态 → disabled（后端 `controlable` 已保证；前端保持）。
6. `runtime-status`：「本机运行」→ 运行时真实文案（在线服务 / 运行中），最小改动 Header。

验证（Frontend Fast Terminal 测试，4-6 个）：
- POST 后任务极快 COMPLETED 且 SSE 未建立 → 前端显示「已完成」；
- snapshot reconciliation 覆盖 SSE 丢失；
- poll fallback 覆盖浏览器休眠/短断；
- terminal 关闭 SSE + 停止 poll；
- terminal 状态取消按钮 disabled；
- 刷新页面恢复终态（localStorage activeTaskId → GET snapshot）。

### Task 6 — Real Smoke + 文档 + Typecheck + Build + Commit

1. **FULL controlled smoke**：Fake Inventory（受控）+ 真实 Dispatcher，证明 FULL → InventoryAgentRunner
   → Frozen Inventory → MultiInstitutionBiographyCoordinator，**绝不进入 runMultiRegionPipeline**。
2. **真实 TARGETED 正常完成 smoke**：POST /api/tasks → Graphile → Biography → Pi → search/fetch/render/
   inspect → submit_investigation → Evidence → Reviewer → Biography Result；必须
   model_requests>0、tool_calls>0、search_web>0、page_observation>0、submit_investigation=YES、
   review_submission=YES、至少 1 个 Biography URL RESOLVED 或合法 PARTIAL。禁止「2 秒假完成」。
3. **真实 TARGETED running cancel smoke**：等待 Pi session 建立 + 至少一个 tool call → POST cancel
   → CANCELLED、Pi aborted、无新 tool call、无 late COMPLETED、Graphile 不 retry。
4. 文档：`docs/agent-runtime/agent-mainline-and-progress-closure.md`（中文）。
5. Typecheck：只跑实际修改的 package（contracts/agent-tools/agent-runtime/backend/web）。
6. Build：前端 production build + 实际修改的 runtime/backend package build。
7. Commit：1-3 个（fix(agent): route biography tasks through unified runtime /
   fix(agent): enforce investigator tool submission / fix(web): reconcile agent task progress and
   terminal state，按真实修改合并）。不 push、不 merge Production。

## 四、Self Review（写完后自查）

- FULL 不再走 Legacy business pipeline
- TARGETED 保留
- FULL/TARGETED 后半段只有一个 Biography Runtime
- 没有地区-specific adapter、没有新增全国逐地区适配
- Pi Agent 仍然模型无关（无 `if provider==="deepseek"` 业务代码）
- Search Provider 仍然 provider-neutral
- Tool registration 有唯一来源
- Investigator 必须产生工具调用
- submit_investigation 有确定性 Gate
- 没有让 LLM 自己写最终数据库
- 前端 Snapshot 是 SSoT，SSE 只是增量通知
- 快速 terminal 不会丢
- 前端允许展示真正 Agent Stage
- 不重新设计整个页面
- Cancel 仍使用 Step 19.1 runtime
- 不全量测试（只跑 targeted）

## 五、测试策略（TARGETED ONLY，不重新全测）

- 必测 1 Dispatcher：3-5 个（FULL→Biography、TARGETED→Biography、FULL multi-scope 不再 Legacy、
  legacy unrelated flow 不受影响）。
- 必测 2 Investigator Tool Calling：4-6 个（allowlist、submit registered、pure-text-not-success、
  tool call→ToolEvent、submission gate）。
- 必测 3 Frontend Fast Terminal：4-6 个（POST 后极快 COMPLETED、SSE 前 terminal、snapshot
  reconciliation、poll fallback、terminal closes SSE、cancel disabled terminal）。
- 必测 4 Progress Projection：3-5 个（Inventory/Investigating/Review/Recovery/Terminal）。
- 不跑：Full Workspace Tests、Crawler Full Tests、Backend Full Tests、Playwright Full Suite、
  所有历史 Agent Smoke、Full Region Smoke、全国测试。
- Typecheck：只跑实际修改 package；Build：前端 + 实际修改的 runtime/backend package。

## 六、风险与保护

- dev 验证使用**独立 dev PostgreSQL**（`stellaris-dev-db` 容器），不污染生产 DB；生产 worker 不接
  dev 队列（不同 DB）。
- 不 push、不 merge、不部署生产（本轮完成后停止，等待下一轮 Production Cutover）。
- 若 Backend 与 Worker 实际已拆进程 → 升级诊断并停止 Cancel 部分，报告架构冲突。
- Secret 只使用服务器已有配置，不写 Git/日志/Prompt；结构化诊断只记 metadata。

## 七、完成门槛（Completion Gate）

FULL Legacy Business Route: REMOVED_FROM_BIOGRAPHY_TASKS、FULL/TARGETED Runtime:
BiographyTaskExecutionService、Frozen Inventory Shared Boundary: YES、Duplicate Biography Pipeline: NO、
Investigator Pi Session: REAL、Model Request: REAL、Tool Calls: >0、search_web: CALLED、
fetch_page/render_page: CALLED、inspect_page: CALLED、submit_investigation: CALLED、
INVESTIGATION_NOT_SUBMITTED: FIXED、Task Success Gate: STRICT、Empty Inventory Fake Completion: NO、
Frontend Snapshot SSoT: YES、SSE: INCREMENTAL ONLY、Fallback Polling: YES、Fast Terminal Race: FIXED、
Terminal Cancel Button: DISABLED、Agent Stage: VISIBLE、Real Progress: YES、Fake Progress: NO、
Real TARGETED Agent Smoke: PASS、至少 1 Biography URL: RESOLVED OR VALID PARTIAL、
2-second False Completion: NO、Running Cancel Smoke: PASS、Targeted Tests: PASS、
Affected Typecheck: PASS、Frontend Build: PASS、Skill: UNCHANGED、Production: UNCHANGED
