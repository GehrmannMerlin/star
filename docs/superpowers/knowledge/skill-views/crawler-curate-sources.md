# `crawler-curate-sources` 知识视图

> 本视图是 `crawler-curate-sources` Skill 的独立知识视图，只选择与该 Skill 职责边界相关的来源治理知识。来源身份、固定版本、ref、Commit、许可证等事实只在共享证据层维护（`docs/superpowers/knowledge/evidence-cards/source-governance.md` 与 `third-party/crawler-knowledge-sources/manifest.md`），本视图不复制这些元数据，只通过稳定证据引用关联卡片。
>
> 所有 `SG-*` 引用指向共享证据层卡片。

## 触发与模式

- `crawler-curate-sources` 只在以下三种模式之一触发：
  1. 首次资料基线：为本项目或新技能建立第一份来源资料库。
  2. 按需增量更新：因项目依赖版本变化、故障资料不足或重要计划准备而检查并增量更新既有资料。
  3. 针对故障或知识缺口定向补充：只补充与一个已命名知识缺口直接相关的来源。
- 本 Skill 不处理项目故障诊断、代码修复或爬虫运行问题；那些触发由 `crawler-triage-incidents` 等 Skill 处理。

## 最低输入

- 目标 Skill 或知识缺口（缺口需要名称与直接相关性说明）。
- 预期版本范围或锁定的依赖版本上下文。
- 当前来源清单 `third-party/crawler-knowledge-sources/manifest.md`。
- 用户批准的约束（准入标准、容量边界、安全边界）。
- E 盘可用空间与第三方资料库当前累计容量。
- 任何既有的 accepted／candidate／rejected 记录。

## 知识主题

- 来源权威：如何识别与核验权威上游（`SG-AUTHORITY-001`）。
- 维护状态：如何观察与记录仓库维护活跃度（`SG-AUTHORITY-002`）。
- 许可证：许可证识别、冲突与置信度处理（`SG-LICENSE-001`、`SG-LICENSE-002`）。
- 规范来源：REUSE 合规规则（`SG-REUSE-001`）。
- 收割与 curated 元数据：区分带来源出处的元数据与权威事实（`SG-CURATION-001`）。
- 规范来源证明：ScanCode 结构化结果定位（`SG-SCANCODE-001`）。
- 版本冻结：固定 ref 与 Commit（`SG-VERSION-001`）。
- 去重与分类：accepted／candidate／rejected 分离（`SG-ADMISSION-001`）。
- 证据等级：分级证据准入，不机械要求多来源（`SG-CAPACITY-001` 配套）。
- 容量与执行安全：50 GB／120 GB 边界与禁止执行（`SG-CAPACITY-001`、`SG-SAFETY-001`）。

## 判断规则

- 准入判断必须覆盖：相关性、权威来源、维护状态、许可证、适用版本、canonical 上游、去重、预计体积与分类（`SG-ADMISSION-001`）。
- 权威判断：Scorecard 分数只是自动安全启发式信号之一，不是来源总权威或正确性判定（`SG-AUTHORITY-001`）；单个未检测检查不能单独拒绝或接受来源（`SG-AUTHORITY-002`）。
- 许可证判断：Licensee 的匹配是检测证据而非法律意见（`SG-LICENSE-001`）；多个匹配与置信度必须保留，不得折叠成虚假确定性（`SG-LICENSE-002`）。
- 扫描与元数据判断：ScanCode 结构化结果可以读取，但未经单独批准不得运行（`SG-SCANCODE-001`）；curated 元数据是带出处的证据，不替代上游事实（`SG-CURATION-001`）。
- 规范判断：REUSE 合规要求许可证文本与 SPDX 标注，本 Skill 只读取规则不执行 `reuse lint`（`SG-REUSE-001`）。
- 版本判断：获准入来源必须固定到权威 ref 与 manifest 的精确 Commit；移动分支在冻结前不作为基线（`SG-VERSION-001`）。
- 容量与安全判断：达到 50 GB 软上限或 E 盘可用空间低于 120 GB 必须停止新增下载（`SG-CAPACITY-001`）；任何第三方程序执行都需要单独批准与不同计划（`SG-SAFETY-001`）。
- 明确声明：Scorecard、Stars、许可证检测器、收割元数据和案例是不同角色的信号，不是可互换的批准投票。

## 故障模式

- 权威上游不明确：标记为候选元数据，请求用户确认 canonical 上游；不自动选一个。
- 许可证缺失：拒绝下载，保留元数据（`SG-LICENSE-001`、`SG-ADMISSION-001`）。
- 已归档或停止维护：保留为候选元数据，不下载源码（`SG-AUTHORITY-002`）。
- 审查后分支移动：版本基线冻结后不得随移动分支漂移（`SG-VERSION-001`）。
- 镜像不匹配：以权威 origin 为准，镜像比较单独记录（`SG-REUSE-001` 配套、`SG-VERSION-001`）。
- 许可证检测冲突：保留多匹配与置信度，标记为待确认，不自行消除（`SG-LICENSE-002`）。
- 容量边界：停止下载，输出停止报告，请求用户扩容或清理决策（`SG-CAPACITY-001`）。
- 历史草案冲突：历史草案标注为历史，不得覆盖主决策日志或固定清单，冲突保持可见（`SG-SAFETY-001` 配套）。
- 请求运行收集的代码：拒绝，指出需要单独批准与不同计划（`SG-SAFETY-001`）。

## 证据不足与冲突

- 证据不足时不得把来源判定为确定结论；保留候选状态并标记未知项。
- 证据冲突（如许可证检测冲突、权威上游不明确）保持可见，不静默覆盖任一来源。
- 未解决的声明标记为不确定（非确定性），不得伪装成确定结论。
- 固定版本证据卡不得被静默改写；更新只通过新增修订进行。
- Scorecard、Stars、许可证检测器、收割元数据、案例各保留其证据角色，不互相替换（`SG-AUTHORITY-001`、`SG-LICENSE-001`、`SG-CURATION-001`）。

## 输出与交接

- 输出 accepted／candidate／rejected 三份分离清单及合计（`SG-ADMISSION-001`）。
- 已获准来源输出快照记录：canonical URL、selected ref、40 位 Commit、本地 E 盘路径、浅克隆状态、origin、洁净状态、许可证证据、实际字节与采集时间（`SG-VERSION-001`、`SG-CAPACITY-001`）。
- 容量或安全边界触发时输出停止报告（`SG-CAPACITY-001`、`SG-SAFETY-001`）。
- 交接目标：下游诊断、规划和领域 Skill 通过证据卡引用读取本视图结论；不向其他 Skill 传递未记录推测。
- 任何交接都区分：已确认决策、当前事实、历史草案与 Agent 推荐。

## 修正与验证方向

- 修正范围仅限：来源元数据、分类、版本固定、证据卡状态与再验证。
- 不诊断爬虫运行故障，不提出爬虫代码修复建议（交 `crawler-triage-incidents` 等）。
- 再验证方向：重新核验 ref 与 Commit、许可证证据、容量与可用空间、行为案例。
- 验证通过后更新本地进度总账，不自行标记“已完成”。

## 排除项

- 不建立或运行下载服务、RAG、向量数据库、索引服务、扫描器、代理或爬虫运行组件。
- 不安装、构建、执行、测试、启动或运行任何第三方仓库程序（`SG-SAFETY-001`）。
- 不诊断项目故障，不提出代码修复，不生成 Superpowers `writing-plans`。
- 不修改其他 18 个 Skill、`manifest.md` 或任何第三方仓库。
- 不把 Stars、分数、单一检查、检测结果或案例当作充分权威（`SG-AUTHORITY-001`、`SG-AUTHORITY-002`）。

## 验收

- 能正确识别三种模式并执行对应流程（`SG-ADMISSION-001`）。
- 能输出分离的 accepted／candidate／rejected 记录（`SG-ADMISSION-001`）。
- 能固定权威 ref 与 40 位 Commit 并核验（`SG-VERSION-001`）。
- 能在 50 GB／120 GB 边界停止下载并输出停止报告（`SG-CAPACITY-001`）。
- 能阻止所有第三方程序执行（`SG-SAFETY-001`）。
- 能保留证据冲突与证据等级，不静默覆盖（`SG-LICENSE-002`、`SG-CURATION-001`）。
- 通过 8 个固定行为案例（CS-01 至 CS-08）且无安全或边界失败。
