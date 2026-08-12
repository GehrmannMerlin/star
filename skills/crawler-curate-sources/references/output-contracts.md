# `crawler-curate-sources` 输出契约

> 所有输出使用分离且显式标签的记录：已确认决策（confirmed decision）、当前事实（current fact）、历史草案（historical draft）、Agent 推荐（Agent recommendation）。来源事实只在 `third-party/crawler-knowledge-sources/manifest.md` 维护，本 Skill 输出不得复制成冲突副本。

## 准入清单（accepted）

字段：
- source ID（来源身份标识）
- title／repository（标题／仓库）
- canonical URL（权威来源地址）
- official status（官方性）
- maintenance observation（维护状态观察）
- license（许可证，从 `manifest.md` 读取）
- version scope（适用版本范围）
- size estimate（预计体积）
- target Skill（目标 Skill）
- evidence tier（证据等级）
- classification（分类）
- reason（准入原因）

## 候选清单（candidate）

字段（同准入清单）：source ID、title／repository、canonical URL、official status、maintenance observation、license（如可核实）、version scope、size estimate、target Skill、evidence tier、classification=candidate、reason（保留原因与缺口）。

## 拒绝清单（rejected）

字段：source ID、title／repository、canonical URL、official status、license（如有）、version scope、target Skill、evidence tier、classification=rejected、reason（拒绝原因，如许可证缺失、权威不明确、维护停滞、容量越界、安全风险）。

## 批准包（approval packet）

字段：accepted／candidate／rejected 三份清单及合计；重复项说明；版本阻塞项；许可证阻塞项；预计容量变化（对照 50 GB 软上限与 120 GB 可用空间）。

## 快照清单（snapshot manifest）

字段：
- canonical URL（权威来源地址）
- selected ref（选中 ref）
- commit_sha（40 位 Commit）
- local E-drive path（E 盘本地相对路径）
- shallow status（浅克隆状态）
- origin check（origin 与权威上游一致性）
- clean status（工作区洁净状态）
- license evidence（许可证证据位置）
- actual bytes（实际字节数）
- collection time（采集时间）

## 证据卡（evidence card）

字段：stable ID、claim（声明）、tier（证据等级）、source/version（来源身份与版本）、locator（原始位置）、support（支持说明）、applicability（适用条件）、limitations（限制）、related Skills（关联 Skill）、status（状态）。

## 停止报告（stop report）

字段：
- triggering boundary（触发边界：50 GB／120 GB／许可证／canonical／安全）
- affected sources（受影响来源）
- completed safe work（已完成的未受影响工作）
- untouched work（未触碰工作）
- E-drive free space（E 盘可用空间）
- required user decision（所需用户决策：扩容、清理、调整保留策略或单独授权执行）

## 标签规则

- 已确认决策：来自主决策日志或用户明确批准，可作硬约束。
- 当前事实：来自现场只读核验或 `manifest.md`。
- 历史草案：来自 2026-07-30 等历史文档，仅作背景，不得覆盖当前硬约束。
- Agent 推荐：Agent 的分析建议，非既定事实，须用户批准后方可执行。

## 提交要求

- 分类互斥：同一来源只能属于 accepted／candidate／rejected 之一。
- 每个输出都保留来源身份与证据引用。
- 更新只追加修订，不静默覆盖既有记录。
