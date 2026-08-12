# Claude Code 新会话交接：闭环 Skill 1 并接管后续 Superpowers 规划

用途：在 Claude Code 的全新会话中恢复当前任务。该文档是自包含执行合同；不得依赖旧会话摘要或模型记忆。

## 给 Claude Code 的完整任务

```text
你现在负责在 E:\Stellaris 中接管“爬虫知识资料库与故障修复 Skills”的后续 Superpowers 流程。

本次采用已经获用户批准的“两道门”方案：

1. 先补齐并独立验收第 1 个 Skill `crawler-curate-sources`。
2. 只有第 1 个 Skill 正式更新为“已完成”后，才开始第 2 个 Skill `stellaris-crawler-context` 的 Superpowers brainstorming，并最终为它单独生成一份 writing-plans 计划。

不得把两道门并行处理，不得跳过第一道门，不得规划或实施第 3 个及后续 Skill。

一、启动前必须完整读取

任何修改、提问、Agent 派发或状态更新之前，按以下顺序完整读取：

1. E:\Stellaris\docs\superpowers\brainstorming\2026-07-31-crawler-knowledge-skills-decision-log.md
2. E:\Stellaris\docs\superpowers\specs\2026-07-31-crawler-knowledge-skills-knowledge-design.md
3. E:\Stellaris\third-party\crawler-knowledge-sources\manifest.md
4. E:\Stellaris\docs\superpowers\progress\crawler-knowledge-skills-progress.md
5. E:\Stellaris\docs\superpowers\plans\2026-07-31-crawler-curate-sources.md
6. E:\Stellaris\tests\skills\crawler-curate-sources\cases.md
7. E:\Stellaris\tests\skills\crawler-curate-sources\results.md

如果进入第二道门，再完整读取：

8. E:\Stellaris\docs\superpowers\source-reviews\2026-07-31-batch-06-stellaris-project-context-review.md
9. E:\Stellaris\docs\superpowers\brainstorming\2026-07-30-official-biography-crawler-decision-log.md
10. E:\Stellaris\docs\superpowers\specs\2026-07-30-official-biography-crawler-design.md

第 9、10 项永远只是历史背景，不得覆盖主决策日志、当前项目事实、统一知识设计规格或进度总账。

主决策日志是已确认决策的最高权威；manifest 是第三方来源版本、Commit、许可证和路径的权威登记；进度总账是当前状态入口；单 Skill 计划是第一道门的执行合同。

核对第 1 个 Skill 计划 SHA-256：

D1134BB030A80323E35DE007BEF251743A9C2CE5895B0E8C37FC54153D900FEE

哈希不一致时立即停止并报告，不得自行选择或改写计划版本。

二、Superpowers 与环境规则

1. 首先加载 `superpowers:using-superpowers`。
2. 第一道门的补证工作使用 `superpowers:executing-plans`；如果 Claude Code 支持子 Agent，使用 `superpowers:subagent-driven-development` 编排隔离的 implementer 与 reviewer。
3. 行为测试必须加载 `superpowers:writing-skills`，并遵守其要求的 `superpowers:test-driven-development` RED–GREEN–REFACTOR 方法。
4. 每次声称通过、完成或更新状态前，必须加载并执行 `superpowers:verification-before-completion`。
5. 进入第二道门时必须从 `superpowers:brainstorming` 开始；书面规格经用户批准后，唯一允许的下一项 Superpowers Skill 是 `superpowers:writing-plans`。

E:\Stellaris 当前不是 Git 仓库。用户约束覆盖 Superpowers 的 Git、worktree、branch、commit 和 finishing-a-development-branch 默认步骤：

- 不得执行 `git init`。
- 不得创建 Git worktree、分支或提交。
- 不得为了满足流程形式把项目变成 Git 仓库。
- 使用本地计划复选框、进度总账、验证结果和交接文档保存状态。

所有第三方资料、大体量数据、Docker／WSL 数据继续留在 E 盘。第三方资料库采用 50 GB 软上限，E 盘至少保留 120 GB 可用空间。

三、第一道门：闭环 `crawler-curate-sources`

当前已知状态不是“已完成”，而是“待验证”。不得接受旧执行摘要作为通过证据。

当前已独立确认：

- 结构校验器可输出 `PASS crawler-curate-sources contract`。
- 11 张证据卡、11/11 视图引用、8 个案例定义及五个固定仓库的版本／origin／洁净状态均已通过静态检查。
- 计划中 34 个复选步骤仍为 0 个勾选、34 个未勾选。
- `results.md` 的基线结果包含“大概率”“可能”“模拟观察”等推测性表述，缺少足以复核的真实新鲜 Agent RED／GREEN 运行证据。

第一道门只允许完成以下工作：

### A. 建立精确待办与状态

1. 从获批计划提取全部 34 个复选步骤，建立逐项待办。
2. 核对进度总账仍将 `crawler-curate-sources` 标为“待验证”、第 2 个 Skill 标为“未开始”。
3. 在开始补证前，先把当前 Skill 状态更新为“Claude Code 执行中”，记录时间、执行角色和本次目的“补齐行为测试与计划追踪证据”。
4. 不得改动获批计划的范围、6 个 Task、11 个证据卡 ID、8 个案例 ID、固定版本或职责边界。

### B. 真实运行 RED／GREEN Agent 行为测试

必须实际使用彼此隔离的全新 Agent 上下文，而不是静态阅读或模拟推测：

1. 对 CS-01 至 CS-08，每个案例运行一个未加载 `crawler-curate-sources` 的 baseline Agent。
2. baseline Agent 只接收该案例的 Input，不得看到 Skill 内容、Expected classification、Forbidden behavior 或 Pass criteria。
3. 对同一 8 个案例，各运行一个加载 `crawler-curate-sources` 的 Skill-assisted Agent。
4. Skill-assisted Agent 必须读取项目内 `skills/crawler-curate-sources/SKILL.md` 及其明确路由的引用文件。
5. 每次运行使用新鲜上下文，不继承其他案例答案。共需要 8 个 baseline 和 8 个 Skill-assisted 运行。
6. 这些都是“只生成回答文本”的压力场景；不得真的安装、构建、运行、扫描、代理、测试、启动服务、执行示例、下载浏览器或抓取外部目标。
7. 如果 Agent 尝试实际执行禁止动作，立即中止该 Agent，把它记录为安全失败；主会话不得代为执行。

修订 `tests/skills/crawler-curate-sources/results.md`，每个案例至少记录：

- baseline 运行时间与可区分的运行标识；
- baseline 的实际决定和一段必要的短原文；
- Skill-assisted 运行时间与可区分的运行标识；
- Skill-assisted 的实际决定和一段必要的短原文；
- Required evidence、Forbidden behavior 和 Pass criteria 的逐项判定；
- PASS／FAIL 结论及理由。

必须如实记录观察。baseline 如果自然遵守某条规则，也应记录为遵守；不得为了制造 RED 而虚构失败。不得再用“大概率”“可能”“模拟观察”替代实际结果。

如果任一 Skill-assisted 案例失败：

- 只修复真实暴露的最小 Skill 指令缺口；
- 重新运行该案例；
- 再重新运行全部 8 个 Skill-assisted 案例；
- 不得扩展到其他 Skill、爬虫诊断、法律意见或运行时组件。

### C. 核销计划复选步骤

逐项审阅 34 个复选步骤：

- 只有对应产物、命令输出或行为运行证据存在时才改为 `[x]`。
- 不需要发生的条件步骤也必须以实际证据说明为什么属于已验证的 N/A，再标记完成。
- 无法证明的步骤保持 `[ ]`，并在进度总账记录精确阻塞；不得批量盲勾。
- 大段证据保存在 `results.md` 或进度总账，计划只保留复选状态，避免复制分叉。

### D. 新鲜验证

至少重新执行并读取完整输出：

1. `powershell.exe -NoProfile -ExecutionPolicy Bypass -File E:\Stellaris\tests\skills\crawler-curate-sources\validate.ps1 -ProjectRoot E:\Stellaris`
2. 34 个计划复选步骤的 checked／unchecked 统计。
3. 11 个 `SG-*` 卡片唯一性、字段完整性、本地证据路径和知识视图 11/11 引用。
4. 8 个案例定义和 16 个实际 Agent 运行记录的完整性。
5. 五个固定仓库的 manifest、HEAD、shallow、origin 与 clean 状态；ScanCode 仓库复核使用 `git -c core.longpaths=true`。
6. 占位符、职责越界和肯定式第三方运行指令扫描。
7. E 盘剩余空间、项目根目录非 Git worktree、未修改 manifest／第三方仓库／爬虫代码。

### E. 独立 reviewer

补证实施上下文不得自行宣布正式完成。

如果支持子 Agent：

1. 派发一个全新、只读 reviewer。
2. reviewer 必须直接读取计划、产物、results、进度总账和原始验证输出，不得只看 implementer 摘要。
3. reviewer 独立运行结构校验和完成条件检查。
4. reviewer 输出逐条 PASS／FAIL、证据路径和未满足项，不修改文件。

如果不支持真正隔离的新鲜 reviewer，状态保持“待验证”，停止并要求用户另开 Claude Code 验证会话；不得自行标记“已完成”。

reviewer 只要发现一项失败：

- 把状态恢复或保持为“待验证”；
- 把失败证据写入进度总账；
- 立即停止本次任务；
- 不得开始第二道门。

只有 reviewer 对计划完成条件全部 PASS 时：

1. 先把进度总账中 `crawler-curate-sources` 更新为“已完成”，记录 reviewer 标识、验证时间、命令和结果。
2. 在主决策日志追加一节“crawler-curate-sources 独立验收通过与 Skill 2 入口”，只记录可验证事实。
3. 将 `stellaris-crawler-context` 从“未开始”更新为“规划中”，把当前阶段改为其 brainstorming，规划角色改为 Claude Code。
4. 然后才能进入第二道门。

四、第二道门：Claude Code 接管 `stellaris-crawler-context` 规划

第二道门只规划第 2 个 Skill，不实施它。

### A. 已确认边界，不得重新询问

从主决策日志直接继承：

- Stellaris 问题先由本 Skill 注入项目事实与已批准约束，再交给 `crawler-triage-incidents`。
- 使用“动态核验＋已批准记录”。
- 当前项目事实必须现场只读核验；快照只用于定位，不能替代现场核验。
- 必须区分当前代码事实、已批准要求、历史设计草案、冲突与未知项。
- 固定输出项目上下文包。
- 不诊断根因，不提出修复方案，不替代分诊、领域诊断或架构评审。
- 项目专用层不引入通用 memory、RAG、代码索引或上下文框架，不建设运行服务。
- 第 6 批资料审查没有准入外部仓库；知识底座以项目内权威资料和动态现场证据为主。

不得重新询问上述问题，也不得把 2026-07-30 历史设计提升为当前硬约束。

### B. 使用 brainstorming，保持收束

1. 宣布使用 `superpowers:brainstorming`。
2. 先只读检查当前项目目录、依赖及锁文件、配置、测试、启动／验证命令和已有上下文记录；不得修改代码或运行项目。
3. 根据主日志第 38、39、41、43、68 节及第 6 批资料审查恢复已确认职责。
4. 只在确有一个尚未确定、且答案会实质改变 Skill 设计时提出问题。
5. 每次只能提出一个关键问题；不讨论低优先级格式细节。
6. 用户确认新决策后，必须先追加主决策日志，再继续。
7. 比较 2–3 个最小充分方案，明确推荐方案和取舍。
8. 分段呈现职责边界、输入、动态核验流程、上下文包输出、冲突处理、交接、禁止项和验证设计，并获得用户批准。

### C. 书面规格与用户门

设计获批后：

1. 写入 `docs/superpowers/specs/YYYY-MM-DD-stellaris-crawler-context-design.md`。
2. 更新进度总账，记录规格路径和状态。
3. 自审占位符、内部矛盾、范围、歧义、历史草案误升格、职责越界和非 Git 例外。
4. 把状态更新为“计划待审”之前，先请用户审阅书面规格。
5. 用户提出修改时，修订规格并重新自审。
6. 用户没有明确批准书面规格时，不得进入 `writing-plans`。

### D. 单 Skill writing-plans

只有书面规格获用户明确批准后：

1. 宣布使用 `superpowers:writing-plans`。
2. 只生成 `stellaris-crawler-context` 一份独立计划：
   `docs/superpowers/plans/YYYY-MM-DD-stellaris-crawler-context.md`
3. 计划必须足以由没有聊天记忆的执行 Agent 实施，完整包含：
   - 权威决策与禁止事项；
   - 精确文件目标；
   - 项目内证据选择、证据卡和知识视图范围；
   - 动态核验与上下文包接口；
   - 分步骤任务、实际测试／验证方法和预期结果；
   - 冲突、证据缺失、失败与回退处理；
   - 与 `crawler-triage-incidents` 的交接；
   - 非 Git 检查点和进度总账更新；
   - 完成定义。
4. 自审规格覆盖、占位符、路径、接口一致性、测试可执行性和第 3 个 Skill 越界。
5. 将 `stellaris-crawler-context` 更新为“计划待审”。
6. 把计划交给用户审阅后立即停止。

不得实施 `stellaris-crawler-context`，不得开始 `crawler-triage-incidents`，不得一次规划多个 Skill。

五、状态与最终回复

所有状态变化必须先写入：

E:\Stellaris\docs\superpowers\progress\crawler-knowledge-skills-progress.md

跨 Skill 的用户决策必须先追加：

E:\Stellaris\docs\superpowers\brainstorming\2026-07-31-crawler-knowledge-skills-decision-log.md

任何停止点的最终回复必须报告：

1. 当前位于第一道门还是第二道门；
2. 实际读取、创建或修改的文件；
3. 实际运行的验证命令、退出码和关键输出；
4. 计划复选项、证据卡、行为运行和 reviewer 统计；
5. 当前进度状态；
6. 是否修改爬虫代码、manifest、第三方仓库或初始化 Git；
7. 唯一需要用户决定的下一步。

现在从完整读取权威文件开始。不要根据本提示词摘要跳过原文读取。
```

## 新会话最短唤起语

在 Claude Code 中把工作目录切换到 `E:\Stellaris`，新建会话后发送：

```text
请完整读取并严格执行：

E:\Stellaris\docs\superpowers\handoffs\2026-07-31-claude-code-superpowers-planning-transfer.md

这是本次任务的权威交接合同。不要依赖任何旧会话记忆；先按文档规定读取原始决策、规格、总账和计划，再从第一道门开始。任何阶段门失败都立即停止，不得提前进入下一个 Skill。
```
