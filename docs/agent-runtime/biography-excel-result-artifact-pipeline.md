# Biography Excel Result and Artifact Pipeline

## Purpose

把 STEP 17 已持久化并审核通过的 `BiographyUrlResult` 转换为可下载的 `.xlsx` Excel Artifact，形成：

`Task → Persistent Biography Results → Deterministic Excel Projection → Workbook → Artifact Storage → Download API`

## Skill Scope

`BIOGRAPHY_URL_ONLY` —— 官员个人简历 / 个人信息页面 URL 搜集、审核、输出。

不包含：任前公示、代理任命、选举任命、离任、其它任免事件 Evidence、Multi Evidence Type。

## Excel Source of Truth

- Final Biography URL 唯一 SSoT = `LATEST_FROZEN_APPROVED_REVIEW`。
- 读取路径 = `BiographyUrlResultReader`（packet + latest frozen APPROVED review + composite candidate pool 纯确定性投影）。
- `task_run.result_summary` 仅用于取 packet identity 与 deterministic ordering，其缓存 URL 不凌驾 Reader。
- Excel **不**从 Search Result、Candidate Pool 第一条、或 result_summary 未经验证 URL 取 URL。

## Projection

`projectBiographyResultRows(BiographyUrlResult[]) → BiographyExcelRow[]`（纯函数，无 IO / Agent / LLM）：

- 严格保持输入顺序（= frozen inventory 顺序），不做排序；
- 每机构 `PRIMARY_1` 先、`PRIMARY_2` 后，各占一行；UNRESOLVED 槽位不 drop；
- `decisionStatus` 机械映射采集结果：`RESOLVED → 已找到并复核`，`UNRESOLVED → 完整搜索后无合格URL`。

## Canonical Workbook Contract

- Sheet 名称：`岗位信息采集结果`（复用 Web 规格 §21.2）。
- 5 列（§21.2 的 BIOGRAPHY_URL_ONLY 子集，只保留 `BiographyUrlResult` 能真实生产的字段）：

  1. 行政区划代码
  2. 机构
  3. 现任人员
  4. 岗位信息URL
  5. 采集结果

- URL 单元格为超链接；UNRESOLVED 的 URL 单元格留空（不伪造 / 不复制 / 不填占位符）。

## Ordering

- Institution 顺序 = `result_summary.results[]` 顺序（= frozen inventory 顺序），不随 agent completion order 变化。
- PRIMARY 顺序 = `PRIMARY_1` → `PRIMARY_2`（稳定，不按名称 / URL / 完成时间排序）。

## PARTIAL Export Semantics

- `PARTIAL_COMPLETED` 是合法业务终态，**允许导出**。
- 导出后 PARTIAL workbook 中 resolved 槽位写 URL、unresolved 槽位留空、所有行保留。

## UNRESOLVED Semantics

- UNRESOLVED 槽位仍保留业务行（不 drop）。
- URL 单元格留空；采集结果 = `完整搜索后无合格URL`。
- 绝不伪造 URL / 复制 PRIMARY_1 URL / 填 `#N/A`。

## Artifact Storage

- 复用 `export_artifact` 表 + `ExportArtifactRepository`。
- 文件落盘到 `exportRoot`，文件名 = `${taskRunId}-岗位信息采集结果-${YYYY-MM-DD}.xlsx`。
- 不把 Excel bytes 写进 `task_run.result_summary` JSON。

## Artifact Idempotency

- 同一 task 重复导出：`findLatestByTask` 命中则直接回传既有文件，不重复生成。

## Download API

- `GET /api/tasks/:id/export`（复用现有路由）：
  - 非终态 → `409 TASK_NOT_READY`；FAILED/CANCELLED → `409 TASK_NOT_EXPORTABLE`；
  - 终态 → 直接回传 `.xlsx` 文件（`Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`，`Content-Disposition: attachment`）。
- 不暴露服务器绝对路径；路由只接受 `taskId`（UUID），不接受用户提交的文件 path（无 path traversal）。

## Rebuildability

Excel 是 deterministic projection，**不是 source of truth**。只要 Task terminal + persistent Packet / Review / Candidate 仍存在，删除 Excel 后可重新生成。删除 Artifact 不影响 Review / Candidate / Packet / Task Result。

## Out of Scope

- 其它 Evidence Type（任前公示 / 代理任命 / 选举任命 / 离任）
- 导出期间调用 LLM / Search / Agent
- Excel 作为 Final Decision SSoT
- Frontend 绑定（STEP 19）
- Full Region 真实运行 / Production 部署
