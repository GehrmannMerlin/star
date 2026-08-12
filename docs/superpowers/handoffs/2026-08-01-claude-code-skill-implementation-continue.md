# Claude Code 新会话交接：继续 19 个 Skill 逐项实施（Skill 4 待验证 → Skill 5 起）

用途：在 Claude Code 的新会话中恢复"爬虫知识资料库与故障修复 Skills"的逐项实施任务。该文档是自包含执行合同；不得依赖旧会话摘要或模型记忆，必须按以下顺序完整读取权威文件后从当前断点继续。

## 给 Claude Code 的完整任务

```text
你现在负责在 E:\Stellaris 中继续 19 个爬虫知识 Skills 的逐项规划与实施。当前断点在第 4 个 Skill `crawler-review-architecture` 的"待验证"状态。

本任务遵循已批准的逐 Skill 流程：每次只处理一个 Skill，一个 Skill 完成独立设计（brainstorming）→ 书面规格 → 用户审阅批准 → 单 Skill 计划（writing-plans）→ 用户批准 → Claude Code 实施 → 用户/独立 reviewer 验证通过 → 更新为"已完成" → 才进入下一个 Skill。禁止并行处理多个 Skill，禁止一次规划多个 Skill。

一、启动前必须完整读取（顺序固定，不得跳过）

1. E:\Stellaris\docs\superpowers\brainstorming\2026-07-31-crawler-knowledge-skills-decision-log.md
2. E:\Stellaris\docs\superpowers\specs\2026-07-31-crawler-knowledge-skills-knowledge-design.md
3. E:\Stellaris\third-party\crawler-knowledge-sources\manifest.md
4. E:\Stellaris\docs\superpowers\progress\crawler-knowledge-skills-progress.md
5. 当前 Skill 的独立计划文档（见第 4 项总账"当前设计／计划文档"）
6. 当前 Skill 的设计规格与测试产物（总账所列路径）

二、当前状态（截至 2026-08-01T01:40，从进度总账权威读取）

- Skill 1 `crawler-curate-sources`：已完成（独立 reviewer ALL PASS）。
- Skill 2 `stellaris-crawler-context`：已完成（用户验收实施结果）。
- Skill 3 `crawler-triage-incidents`：已完成（用户验证实施结果通过）。
- Skill 4 `crawler-review-architecture`：待验证（实施完成，等待用户或独立 reviewer 验证）。
- Skill 5 至 19：全部"未开始"。

固定顺序（依赖优先，来自统一知识设计规格 §11.1）：
1 crawler-curate-sources（已完成）
2 stellaris-crawler-context（已完成）
3 crawler-triage-incidents（已完成）
4 crawler-review-architecture（待验证）
5 crawler-discover-frontier
6 crawler-debug-http-network
7 crawler-automate-browsers
8 crawler-validate-extraction
9 crawler-tune-queues
10 crawler-manage-evidence-storage
11 crawler-observe-runtime
12 crawler-enforce-security
13 crawler-test-regressions
14 crawler-debug-typescript-node
15 crawler-use-crawlee
16 crawler-use-playwright
17 crawler-run-docker
18 crawler-use-postgresql
19 crawler-writing-plans-bridge

三、第一步：验证 Skill 4（当前待验证）

不得接受任何旧执行摘要作为通过证据。必须亲自执行新鲜验证：

1. 运行结构验证：确认 `skills/crawler-review-architecture/SKILL.md`、`references/review-workflow.md`、`references/output-contract.md`、`tests/skills/crawler-review-architecture/cases.md`、`tests/skills/crawler-review-architecture/results.md` 全部存在；cases RA 与 results RA 各为 8。
2. 行为结果核对：`results.md` 记录 16 次真实 Agent 运行（8 baseline＋8 Skill-assisted），各含 agentId 与时间戳，总体 8 PASS、0 FAIL。
3. 计划复选项核对：`docs/superpowers/plans/2026-08-01-crawler-review-architecture.md` 应为 31/31 已勾选、0 未勾选。
4. 扫描核对：占位符 0；无肯定式第三方运行指令；无敏感信息示例。
5. Git 边界：`git -C E:\Stellaris rev-parse --is-inside-work-tree` 预期失败（128）；不得初始化 Git。
6. E 盘可用空间应 > 120 GB（当前约 240 GB）；第三方资料库 < 50 GB（当前约 3.38 GB）。

验证通过后：
1. 把进度总账中 `crawler-review-architecture` 更新为"已完成"，记录验证时间与角色。
2. 在主决策日志追加一节，只记录可验证事实（验证时间、运行统计、复选项核销、状态更新）。
3. 将 `crawler-discover-frontier`（Skill 5）从"未开始"更新为"规划中"，当前阶段切换为其 brainstorming。
4. 然后进入第四步。

若 Skill 4 验证发现缺口，先补齐并重新验证，不得进入 Skill 5。

四、后续 Skill 的逐项流程（每次只处理一个）

对 Skill 5 `crawler-discover-frontier` 及后续每个 Skill，严格按以下顺序：

1. 宣布使用 `superpowers:brainstorming`（skill 源码位于 `third-party/crawler-knowledge-sources/repos/batch-02-diagnosis-planning/superpowers/skills/`，下同）。
2. 先只读检查当前项目目录、依赖及锁文件、配置、测试、启动/验证命令和已有上下文记录；不修改代码、不运行项目。
3. 根据主决策日志已确认的该 Skill 职责（如 Skill 5 见 §48，Skill 6 见 §49，Skill 7 见 §50，Skill 8 见 §53，Skill 9 见 §54，Skill 10 见 §55，Skill 11 见 §56，Skill 12 见 §57，Skill 13 见 §58，Skill 14 见 §59，Skill 15 见 §60，Skill 16 见 §61，Skill 17 见 §62，Skill 18 见 §63，Skill 19 见 §23.3/§47）恢复已确认职责，不重新询问。
4. 只在确有一个尚未确定、且答案会实质改变该 Skill 设计时提出问题；每次只能提出一个关键问题。
5. 用户确认新决策后，必须先追加主决策日志，再继续。
6. 比较 2-3 个最小充分方案，明确推荐方案和取舍；分段呈现职责边界、输入、核心流程、输出、冲突处理、交接、禁止项和验证设计，并获得用户批准。
7. 设计获批后，写入 `docs/superpowers/specs/YYYY-MM-DD-<skill-name>-design.md`；更新进度总账；自审（占位符、内部矛盾、范围、歧义、历史草案误升格、职责越界、非 Git 例外）。
8. 状态更新为"计划待审"之前，先请用户审阅书面规格；用户没有明确批准书面规格时，不得进入 `writing-plans`。
9. 规格获批后，宣布使用 `superpowers:writing-plans`，只生成该 Skill 一份独立计划 `docs/superpowers/plans/YYYY-MM-DD-<skill-name>.md`；自审规格覆盖、占位符、路径、接口一致性、测试可执行性和下一 Skill 越界。
10. 将总账更新为"计划待审"，把计划交给用户审阅后立即停止；用户批准后更新为"计划已批准"，再实施。

实施阶段（用户批准计划后）：
1. 加载 `superpowers:executing-plans`（或 `subagent-driven-development`）与 `superpowers:writing-skills`；行为测试遵守 `superpowers:test-driven-development` 的 RED-GREEN-REFACTOR。
2. 按计划逐 Task 实施：先创建 `tests/skills/<skill-name>/cases.md`（8 个案例，各含 Input／Expected classification／Required evidence／Forbidden behavior／Pass criteria），再创建 Skill 包与 references，最后对 8 个案例各运行一个未加载 Skill 的 baseline 与一个加载 Skill 的 Skill-assisted Agent（共 16 次全新隔离上下文运行，全部为"只生成回答文本"压力场景），如实记录到 `tests/skills/<skill-name>/results.md`（含 agentId、时间戳、实际决定与短原文、逐项判定）。
3. 依据证据核销计划的全部复选步骤；无法证明的保持 `[ ]` 并记录精确阻塞，不得批量盲勾。
4. 运行新鲜验证（结构验证、占位符/运行指令/敏感信息扫描、覆盖率核对、非 Git 边界、E 盘容量），并加载 `superpowers:verification-before-completion`。
5. 将总账更新为"待验证"；等待用户或独立 reviewer 验证。验证通过前不自行标记"已完成"，不进入下一 Skill。

五、Superpowers 与环境规则

1. 首先加载 `superpowers:using-superpowers`（技能源码位于 `third-party/crawler-knowledge-sources/repos/batch-02-diagnosis-planning/superpowers/skills/using-superpowers/SKILL.md`）。
2. 每次声称通过、完成或更新状态前，必须加载并执行 `superpowers:verification-before-completion`。
3. E:\Stellaris 当前不是 Git 仓库。用户约束覆盖 Superpowers 的 Git、worktree、branch、commit 和 finishing-a-development-branch 默认步骤：
   - 不得执行 `git init`。
   - 不得创建 Git worktree、分支或提交。
   - 不得为了满足流程形式把项目变成 Git 仓库。
   - 使用本地计划复选框、进度总账、验证结果和交接文档保存状态。
4. 所有第三方资料、大体量数据、Docker／WSL 数据继续留在 E 盘。第三方资料库采用 50 GB 软上限，E 盘至少保留 120 GB 可用空间。
5. 不得修改爬虫代码、`manifest.md`、任何第三方仓库；不得安装、构建、运行、扫描、代理、测试、执行示例或爬取外部目标；不得把密钥、Cookie、认证请求头写入记录（落盘前脱敏）。

六、关键记录文件

- 主决策日志：`docs/superpowers/brainstorming/2026-07-31-crawler-knowledge-skills-decision-log.md`（已确认决策的最高权威；当前至 §109）。
- 统一知识设计规格：`docs/superpowers/specs/2026-07-31-crawler-knowledge-skills-knowledge-design.md`（19 个 Skill 固定顺序见 §11.1）。
- 固定源码清单：`third-party/crawler-knowledge-sources/manifest.md`（41 个固定仓库）。
- 进度总账：`docs/superpowers/progress/crawler-knowledge-skills-progress.md`（当前状态入口，只索引状态与文档路径）。
- 前序交接合同（已完成 Skill 1 的两道门闭环，仅作背景）：`docs/superpowers/handoffs/2026-07-31-claude-code-superpowers-planning-transfer.md`。

七、停止条件

- Skill 4 验证未通过：补齐并重新验证，不得进入 Skill 5。
- 任一 Skill 的书面规格未获用户明确批准：不得进入 `writing-plans`。
- 任一 Skill 的实施未获用户/独立 reviewer 验证：不得标记"已完成"，不得进入下一 Skill。
- 每次只处理一个 Skill；不得一次规划多个 Skill，不得在计划中夹带下一 Skill 的实施任务。
```

## 新会话最短唤起语

在 Claude Code 中把工作目录切换到 `E:\Stellaris`，新建会话后发送：

```text
请完整读取并严格执行：

E:\Stellaris\docs\superpowers\handoffs\2026-08-01-claude-code-skill-implementation-continue.md

这是本次任务的权威交接合同。不要依赖任何旧会话记忆；先按文档规定顺序读取主决策日志、统一知识设计规格、manifest、进度总账和当前 Skill 计划，然后从 Skill 4 `crawler-review-architecture` 的待验证状态开始执行。任何阶段门失败都立即停止，不得提前进入下一个 Skill。
```
