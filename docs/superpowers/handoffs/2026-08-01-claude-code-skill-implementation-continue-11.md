# Claude Code 新会话交接：继续 19 个 Skill 逐项实施（Skill 11 起）

用途：在 Claude Code 的新会话中恢复"爬虫知识资料库与故障修复 Skills"的逐项实施任务。该文档是自包含执行合同；不得依赖旧会话摘要或模型记忆，必须按以下顺序完整读取权威文件后从当前断点继续。

## 给 Claude Code 的完整任务

```text
你现在负责在 E:\Stellaris 中继续 19 个爬虫知识 Skills 的逐项规划与实施。当前断点在第 11 个 Skill `crawler-observe-runtime` 的"规划中"状态（其 brainstorming 尚未开始；Skill 1-10 已全部"已完成"）。

本任务遵循已批准的逐 Skill 流程：每次只处理一个 Skill，一个 Skill 完成独立设计（brainstorming）→ 书面规格 → 用户审阅批准 → 单 Skill 计划（writing-plans）→ 用户批准 → Claude Code 实施 → 用户/独立 reviewer 验证通过 → 更新为"已完成" → 才进入下一个 Skill。禁止并行处理多个 Skill，禁止一次规划多个 Skill。

一、启动前必须完整读取（顺序固定，不得跳过）

1. E:\Stellaris\docs\superpowers\brainstorming\2026-07-31-crawler-knowledge-skills-decision-log.md
2. E:\Stellaris\docs\superpowers\specs\2026-07-31-crawler-knowledge-skills-knowledge-design.md
3. E:\Stellaris\third-party\crawler-knowledge-sources\manifest.md
4. E:\Stellaris\docs\superpowers\progress\crawler-knowledge-skills-progress.md
5. 当前 Skill 的独立设计/计划文档（如已有）

二、当前状态（截至 2026-08-01T21:57:20，从进度总账权威读取）

- Skill 1 `crawler-curate-sources`：已完成（独立 reviewer ALL PASS）。
- Skill 2 `stellaris-crawler-context`：已完成（用户验收实施结果）。
- Skill 3 `crawler-triage-incidents`：已完成（用户验证实施结果通过）。
- Skill 4 `crawler-review-architecture`：已完成（Claude Code 续接会话新鲜验证通过）。
- Skill 5 `crawler-discover-frontier`：已完成（用户验证实施结果通过）。
- Skill 6 `crawler-debug-http-network`：已完成（用户验证实施结果通过）。
- Skill 7 `crawler-automate-browsers`：已完成（用户验证实施结果通过）。
- Skill 8 `crawler-validate-extraction`：已完成（用户验证实施结果通过）。
- Skill 9 `crawler-tune-queues`：已完成（用户验证实施结果通过）。
- Skill 10 `crawler-manage-evidence-storage`：已完成（用户验证实施结果通过）。
- Skill 11 至 19：全部"未开始"→ 其中 Skill 11 `crawler-observe-runtime` 已更新为"规划中"，当前阶段为其 brainstorming，规划角色为 Claude Code。

固定顺序（依赖优先，来自统一知识设计规格 §11.1）：
1 crawler-curate-sources（已完成）
2 stellaris-crawler-context（已完成）
3 crawler-triage-incidents（已完成）
4 crawler-review-architecture（已完成）
5 crawler-discover-frontier（已完成）
6 crawler-debug-http-network（已完成）
7 crawler-automate-browsers（已完成）
8 crawler-validate-extraction（已完成）
9 crawler-tune-queues（已完成）
10 crawler-manage-evidence-storage（已完成）
11 crawler-observe-runtime（规划中）
12 crawler-enforce-security
13 crawler-test-regressions
14 crawler-debug-typescript-node
15 crawler-use-crawlee
16 crawler-use-playwright
17 crawler-run-docker
18 crawler-use-postgresql
19 crawler-writing-plans-bridge

三、第一步：进入 Skill 11 `crawler-observe-runtime` 的 brainstorming

1. 加载 `superpowers:using-superpowers`（技能源码位于 `third-party/crawler-knowledge-sources/repos/batch-02-diagnosis-planning/superpowers/skills/using-superpowers/SKILL.md`）与 `superpowers:brainstorming`。
2. 先只读检查当前项目目录、依赖及锁文件、配置、测试、启动/验证命令和已有上下文记录；不修改代码、不运行项目。
3. 根据主决策日志 §56 已确认的职责恢复（定位：面向 Agent 的运行环境与可观测性诊断顾问，不常驻监控服务；检查运行环境/环境变量/资源限制/健康检查/日志/指标/Trace 采集关联；输出运行现象/证据缺口/影响范围/建议加载的领域 Skill；不以观测现象代替业务根因；Docker 问题交 `crawler-run-docker`，Node.js 运行时问题交 `crawler-debug-typescript-node`），不重新询问。
4. 只读核对批次 4 中可观测性相关固定资料：`open-telemetry/opentelemetry-specification`（v1.59.0）、`prometheus/OpenMetrics`（v1.0.0）。
5. 只在确有一个尚未确定、且答案会实质改变该 Skill 设计时提出问题；每次只能提出一个关键问题。
6. 用户确认新决策后，必须先追加主决策日志，再继续。
7. 比较 2-3 个最小充分方案，明确推荐方案和取舍；分段呈现职责边界、输入、核心流程、输出、冲突处理、交接、禁止项和验证设计，并获得用户批准。
8. 设计获批后，写入 `docs/superpowers/specs/2026-08-01-crawler-observe-runtime-design.md`；更新进度总账；自审（占位符、内部矛盾、范围、歧义、历史草案误升格、职责越界、非 Git 例外）。
9. 状态更新为"计划待审"之前，先请用户审阅书面规格；用户没有明确批准书面规格时，不得进入 `writing-plans`。
10. 规格获批后，宣布使用 `superpowers:writing-plans`，只生成该 Skill 一份独立计划 `docs/superpowers/plans/2026-08-01-crawler-observe-runtime.md`；自审规格覆盖、占位符、路径、接口一致性、测试可执行性和下一 Skill 越界。
11. 将总账更新为"计划待审"，把计划交给用户审阅后立即停止；用户批准后更新为"计划已批准"，再实施。

实施阶段（用户批准计划后）：
1. 加载 `superpowers:executing-plans` 与 `superpowers:writing-skills`；行为测试遵守 `superpowers:test-driven-development` 的 RED-GREEN-REFACTOR。
2. 按计划逐 Task 实施：先创建 `tests/skills/crawler-observe-runtime/cases.md`（8 个案例，各含 Input／Expected classification／Required evidence／Forbidden behavior／Pass criteria），再创建 Skill 包与 references，最后对 8 个案例各运行一个未加载 Skill 的 baseline 与一个加载 Skill 的 Skill-assisted Agent（共 16 次全新隔离上下文运行，全部为"只生成回答文本"压力场景），如实记录到 `tests/skills/crawler-observe-runtime/results.md`（含 agentId、时间戳、实际决定与短原文、逐项判定）。
3. 依据证据核销计划的全部复选步骤；无法证明的保持 `[ ]` 并记录精确阻塞，不得批量盲勾。
4. 运行新鲜验证（结构验证、占位符/运行指令/敏感信息扫描、覆盖率核对、非 Git 边界、E 盘容量），并加载 `superpowers:verification-before-completion`。
5. 将总账更新为"待验证"；等待用户或独立 reviewer 验证。验证通过前不自行标记"已完成"，不进入下一 Skill。

四、后续 Skill 的逐项流程（每次只处理一个）

对 Skill 12 `crawler-enforce-security` 及后续每个 Skill，严格按以下顺序：

1. 根据主决策日志已确认的该 Skill 职责恢复（Skill 12 见 §57，Skill 13 见 §58，Skill 14 见 §59，Skill 15 见 §60，Skill 16 见 §61，Skill 17 见 §62，Skill 18 见 §63，Skill 19 见 §23.3/§47），不重新询问。
2. 只收束会实质改变 Skill 设计的关键问题，每次最多一个。
3. 分段方案获批 → 写入书面规格并自审 → 用户审阅批准 → 调用 `superpowers:writing-plans` 生成单 Skill 计划停在"计划待审" → 用户批准 → 实施 → 新鲜验证 → 更新为"待验证" → 用户/独立 reviewer 验证通过 → 更新为"已完成"。

五、Superpowers 与环境规则

1. 每次声称通过、完成或更新状态前，必须加载并执行 `superpowers:verification-before-completion`。
2. E:\Stellaris 当前不是 Git 仓库。用户约束覆盖 Superpowers 的 Git、worktree、branch、commit 和 finishing-a-development-branch 默认步骤：
   - 不得执行 `git init`。
   - 不得创建 Git worktree、分支或提交。
   - 不得为了满足流程形式把项目变成 Git 仓库。
   - 使用本地计划复选框、进度总账、验证结果和交接文档保存状态。
3. 所有第三方资料、大体量数据、Docker／WSL 数据继续留在 E 盘。第三方资料库采用 50 GB 软上限，E 盘至少保留 120 GB 可用空间。
4. 不得修改爬虫代码、`manifest.md`、任何第三方仓库；不得安装、构建、运行、扫描、代理、测试、执行示例或爬取外部目标；不得把密钥、Cookie、认证请求头写入记录（落盘前脱敏）。

六、关键记录文件

- 主决策日志：`docs/superpowers/brainstorming/2026-07-31-crawler-knowledge-skills-decision-log.md`（已确认决策的最高权威；当前至 §134）。
- 统一知识设计规格：`docs/superpowers/specs/2026-07-31-crawler-knowledge-skills-knowledge-design.md`（19 个 Skill 固定顺序见 §11.1）。
- 固定源码清单：`third-party/crawler-knowledge-sources/manifest.md`（41 个固定仓库）。
- 进度总账：`docs/superpowers/progress/crawler-knowledge-skills-progress.md`（当前状态入口，只索引状态与文档路径）。
- Skill 1-10 已完成，各自的规格/计划/测试产物路径见进度总账。

七、停止条件

- 任一 Skill 的书面规格未获用户明确批准：不得进入 `writing-plans`。
- 任一 Skill 的实施未获用户/独立 reviewer 验证：不得标记"已完成"，不得进入下一 Skill。
- 每次只处理一个 Skill；不得一次规划多个 Skill，不得在计划中夹带下一 Skill 的实施任务。
```

## 新会话最短唤起语

在 Claude Code 中把工作目录切换到 `E:\Stellaris`，新建会话后发送：

```text
请完整读取并严格执行：

E:\Stellaris\docs\superpowers\handoffs\2026-08-01-claude-code-skill-implementation-continue-11.md

这是本次任务的权威交接合同。不要依赖任何旧会话记忆；先按文档规定顺序读取主决策日志、统一知识设计规格、manifest、进度总账和当前 Skill 文档，然后从 Skill 11 `crawler-observe-runtime` 的 brainstorming 开始执行。任何阶段门失败都立即停止，不得提前进入下一个 Skill。
```
