# Agent 主链纠偏 + 真实运行诊断 + 前端 Agent 进度闭环

日期：2026-08-18 · STEP 19.3 · Branch `refactor/pi-agent-runtime-server-20260813`

## 一、原 FULL Legacy 问题

审计发现 FULL_INSTITUTION 任务可能绕开 Biography Agent Runtime，误走 legacy regional crawler。
实证（生产 DB 只读查询）：

- 前端 FULL 模式把单选行政区错误编码成 `regionCodes: [target.code]`；
- 后端 `POST /api/tasks` 以 `regionCodes` 存在判定 multi-region，`expandRegions` 把一个省展开成
  「省 + 所有市 + 所有区县」（生产实证单省任务产生 18/19 行 `target_scope`）；
- Graphile `runTaskJob` 以 `scopes.length > 1` 判定 Biography / Legacy，多 scope FULL 任务全部进入
  `runMultiRegionPipeline`（legacy multi-region）；
- 结果：生产 FULL 任务 `result_summary = NULL`、0 机构、秒级 `COMPLETED`（空完成假象），完全绕过
  Pi Agent。

## 二、统一后的 Dispatcher

`apps/backend/src/workers/queue.ts` `runTaskJob`：

- TARGETED：Biography 运行时可用 → `BiographyTaskExecutionService`；否则 legacy replay；
- FULL_INSTITUTION：**只要 Biography 运行时可用就统一进入 `BiographyTaskExecutionService`**
  （不再按 `scopes.length` 分流）；legacy multi-region / multi-institution 仅保留给无
  biographyExecutor 的配置（测试/离线/旧环境）。

`apps/web/src/app.tsx` `buildCreateRequest`：FULL 模式不再传 `regionCodes`，只传
`regionCode/regionName`（单选行政区树语义 = 任务行政区：省=省级、省+市=地市级、省+市+区县=区县级）。
不再把单选行政区展开成省+所有市+所有区县。

`apps/backend/src/workers/task-control.ts` `relaunchPipeline`（resume / 崩溃恢复）：Biography 运行时
可用时统一经 `BiographyTaskExecutionService`，不再把 FULL/TARGETED 拉回 legacy 驱动。

FULL 多行政区 scope（防御性支持 API 直传）：`BiographyTaskExecutionService.execute` 对每个 included
scope 运行 `InventoryAgentRunner`，合并去重为单一 Frozen Inventory，之后统一走
`MultiInstitutionBiographyCoordinator`。FULL 与 TARGETED 只在 **Frozen Inventory 如何形成**阶段不同。

## 三、Investigator Tool Calling 根因

现象：生产 `institution_work_packet` 4 条 `failure_code = INVESTIGATION_NOT_SUBMITTED`；
`tool_event` 表为空（0 行）。

诊断（dev 环境真实运行 + 受控复现）：

- `agent:runtime:doctor`：pi_sdk OK、skill OK、schema 34、model deepseek/deepseek-v4-flash READY、
  tool_gateway 5 tools、search bocha READY、runtime FOUNDATION_READY；
- `smoke:deepseek`（真实 DeepSeek + get_region_context）：session_created=YES、
  tool_gateway=RECEIVED、tool_status=SUCCESS、output_marker=OK、coding_tools=0
  → **DeepSeek + Pi SDK 的 Tool Calling 机制本身是通的**；
- **tool_event_count = 0 的直接根因**：真实 workflow 的 Investigator/Evidence/Reviewer/Recovery
  阶段全部使用 `MemoryToolEventSink`（session 结束即丢），`PostgresToolEventJournal` 只在
  persistence-smoke 使用，从未接线到真实 workflow → `tool_event` 表从未写入；
- 生产 INVESTIGATION_NOT_SUBMITTED：Investigator 未完成结构化提交即结束（真实网页下载慢 /
  模型在复杂 prompt 下未走完 submit 契约）。dev 环境真实 TARGETED（鼓楼区人民政府）Investigator
  阶段**成功提交**（packet → EVIDENCE_PENDING），未复现该错误；用之前失败机构「上海市人民政府」
  复跑仍由真实 Agent 完成（见第九节）。

## 四、Tool Contract

- Tool 注册唯一来源：`@stellaris/agent-tools` `createAgentToolRegistry`；
- 角色 allowlist 唯一来源：`packages/agent-runtime/src/session/role-tool-policy.ts`
  `roleToolsFor(role)`；INVESTIGATOR = base tools + `submit_investigation`（默认 coding tools 禁用）；
- `submit_investigation` 是 Investigator 唯一结束边界：只有通过 Skill schema 校验 + 双人 distinct
  gate + 单次 freeze，packet 才进入 `EVIDENCE_PENDING`；纯文本回答一律
  `INVESTIGATION_NOT_SUBMITTED` 结构化失败；
- Observation Gate：`fetch_page`/`render_page` 成功 + `inspect_page` 成功才允许提交，否则
  `INVESTIGATION_OBSERVATION_REQUIRED`；
- STEP 19.3 新增 ToolEvent 持久化接线：Investigator/Evidence 阶段通过
  `composeToolEventSinks(memory, postgres)` 把 ToolEvent 同时写入内存 gate sink 与
  `PostgresToolEventJournal`（`tool_event` 表），作为 Agent provenance 落库；
  ToolEvent（Agent provenance）与 Task Progress（用户业务进度）保持分离。

## 五、Task Completion Gate

- `BiographyTaskExecutionService.projectTaskTerminalStatus`：`totalPackets === 0` → FAILED；
  全部失败 → FAILED；全部 RESOLVED → COMPLETED；其余 → PARTIAL_COMPLETED（业务 UNRESOLVED 是
  合法 PARTIAL，不是 Runtime FAILED）；
- **Empty Inventory 不再静默 COMPLETED**：FULL Inventory 发现 0 机构 → `EMPTY_INVENTORY` →
  FAILED（"未发现可采集机构"）；
- `INVESTIGATION_NOT_SUBMITTED` 不映射成 COMPLETED：packet FAILED → 任务按 aggregation 语义
  FAILED / PARTIAL；
- 取消（CANCELLED）是 control-flow：不写 COMPLETED/PARTIAL，Graphile 不重试（Step 19.1 机制）。

## 六、Agent Progress Model

- `TaskRunSummary` 新增 `stage`（Agent 运行阶段）与 `currentInstitution`（当前机构名）；
- Stage 在业务边界更新（Inventory Start/Frozen、Investigator Start、Evidence Start、Review Start、
  Recovery Start、Finalizing），不随每次 HTTP fetch 变化；
- `task_run` 新增 `agent_stage text` / `current_institution text`（migration 008），由
  `setAgentProgress` 写入；`projectTaskStage` 投影（agent_stage 优先，legacy 从 status/progress
  推导，终态以 status 为准）；
- SSE `task.state_changed` 携带 `stage`（实时增量）；Task Snapshot 是页面状态 SSoT；
- `TaskRunStatus`（终态/控制语义）与 `TaskStage`（Agent 工作流进度）保持分离。

## 七、Frontend Snapshot + SSE + Polling

- **Snapshot 是 SSoT**：`POST /api/tasks` 成功后立即 `GET /api/tasks/:id` 拉快照（任务可能在 SSE
  建立前已完成）；
- SSE 只作「有变化了」的增量通知（`task.state_changed` / `task.progress_changed`）；终态事件
  （completed/failed/cancelled）→ 立即 GET snapshot 更新 store → 关闭 SSE；
- 新增轻量 snapshot polling（约 4s，仅 PENDING/RUNNING 期间）作一致性兜底，terminal 后自动停止；
- 页面刷新：localStorage 只保存 `activeTaskId`，挂载时 GET snapshot 恢复（终态直接恢复已完成/
  部分完成/失败/已取消）；
- TaskDetail 保持整体卡片布局，显示：状态、当前阶段（运行中）、当前机构（运行中）、机构进度、
  已复核岗位、Recovery、官网受限、运行时间（前端 derive）；终态不重复显示「已完成」阶段；
- terminal 状态取消按钮 disabled（后端 `controlable=false` 保证）。

## 八、Fast Terminal Race

- 问题：后端任务很快 terminal，但前端仍显示运行中 / 仍可点击取消；
- 根因：前端过度依赖 SSE 增量事件，POST 后不立即拉快照，无 polling 兜底；
- 修复：POST 后立即 snapshot + polling 兜底 + terminal 事件收敛到 snapshot；
- 测试覆盖：POST 后任务极快 COMPLETED 且 SSE 未建立 → 直接显示已完成；
  SSE 终态事件 → snapshot reconciliation → 关闭 SSE。

## 九、真实 Targeted Smoke

真实 TARGETED（dev 独立 PostgreSQL + dev backend，`STELLARIS_TASK_RUNTIME=biography`，
DeepSeek deepseek-v4-flash + Bocha）：

- 上海市人民政府（310000）：任务真实运行（非 2 秒假完成），Investigator 阶段
  `tool_event` 记录 search_web×5 / fetch_page×2 / inspect_page×2 / get_region_context×1（全成功），
  task 实时显示 `stage=INVESTIGATING`、`currentInstitution=上海市人民政府`；
- 该 smoke 的完整终态见最终报告（Investigator 提交 → Evidence → Reviewer → Biography Result）。

## 十、Running Cancel Smoke

- 鼓楼区人民政府 TARGETED 运行中（Evidence 阶段真实网页下载）POST cancel → 任务 `CANCELLED`、
  `controlable=false`、外部网络连接立即关闭（Pi session abort 生效）、不写 COMPLETED/PARTIAL；
- 同进程机制成立（Backend + Worker 同一 Node 进程，process-local AbortController registry），
  未引入 Redis / LISTEN/NOTIFY。

## 十一、仍 Deferred 的内容

- resume 的完整语义（CRAWLING 状态下恢复中断 packets）不在本轮（relaunch 已统一路由到 Biography
  运行时，claim 语义安全 no-op）；
- 生产 Production Cutover（下一轮 STEP 20）；
- FULL 大区域全量真实采集 smoke（本轮只做受控验证）；
- 乡镇/街道（TOWN_STREET）层级采集；
- 多 Evidence-Type（任前公示等）不在 Biography URL 业务范围。

## 架构约束自查

- 无 provider hardcode（无 `if provider === "deepseek"` 业务代码）；
- 无地区-specific adapter、无新增全国逐地区适配；
- Tool 注册唯一来源、submit_investigation 确定性 Gate；
- LLM 不直接写最终数据库（全部经 sink / validator / 确定性投影）；
- Skill 未修改；前端整体布局未重设计；未全量测试（只跑 targeted）。
