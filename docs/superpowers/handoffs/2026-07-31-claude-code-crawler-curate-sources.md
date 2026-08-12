# Claude Code 执行交接：`crawler-curate-sources`

将下面代码块中的全部内容作为 Claude Code 新会话的第一条提示词。不要省略读取顺序、状态门、非 Git 例外或最终停止条件。

```text
你现在负责在 E:\Stellaris 中执行已经获用户批准的第 1 个 Skill 计划：

E:\Stellaris\docs\superpowers\plans\2026-07-31-crawler-curate-sources.md

你的职责是严格实施并验证 `crawler-curate-sources`，不是重新 brainstorming，不是重写计划，也不是设计或实施其余 18 个 Skill。

一、开始前的强制读取与优先级

在执行任何修改前，必须完整读取以下文件，按顺序恢复项目状态：

1. E:\Stellaris\docs\superpowers\brainstorming\2026-07-31-crawler-knowledge-skills-decision-log.md
2. E:\Stellaris\docs\superpowers\specs\2026-07-31-crawler-knowledge-skills-knowledge-design.md
3. E:\Stellaris\third-party\crawler-knowledge-sources\manifest.md
4. E:\Stellaris\docs\superpowers\progress\crawler-knowledge-skills-progress.md
5. E:\Stellaris\docs\superpowers\plans\2026-07-31-crawler-curate-sources.md

主决策日志是最新决策权威；统一规格是公共知识契约；固定清单是来源版本、Commit、许可证和本地路径的权威登记；独立计划是本次执行合同。2026-07-30 的历史 brainstorming／设计文档只能作为背景，不能覆盖上述文件。

读取后校验计划文件 SHA-256：

D1134BB030A80323E35DE007BEF251743A9C2CE5895B0E8C37FC54153D900FEE

若哈希不一致，先停止并向用户报告，不得猜测应该执行哪个版本。

二、必须使用的 Superpowers 流程

1. 首先加载 `superpowers:using-superpowers`。
2. 宣布并使用 `superpowers:executing-plans` 审阅和执行计划。
3. 如果当前 Claude Code 确实支持子 Agent，则按 `executing-plans` 的要求改用 `superpowers:subagent-driven-development`；若不支持，就继续使用 `executing-plans`，不要为此安装或修改环境。
4. 在创建或编辑 Skill 内容前，必须加载 `superpowers:writing-skills`，并按其要求理解和使用 `superpowers:test-driven-development` 的 RED–GREEN–REFACTOR 流程。
5. 在报告实现或验证完成前，必须加载 `superpowers:verification-before-completion`，运行全套新鲜验证并读取完整输出。

本项目的用户约束覆盖 Superpowers 的默认 Git／worktree／分支步骤：E:\Stellaris 当前不是 Git 仓库。不得执行 `git init`，不得创建 Git worktree，不得为了满足形式要求建立分支或提交。计划中的提交检查点只有在用户另行建立或明确授权 Git 仓库后才适用；否则使用计划复选框和本地进度总账保存检查点。`executing-plans` 最后的 `finishing-a-development-branch` Git 集成步骤在本任务中不适用；不得为了调用它而创建仓库，本任务的结束门以已批准计划 Task 6 的“待验证”状态为准。

三、启动门

1. 批判性审阅计划，确认文件、接口、测试和边界可执行。
2. 若发现会改变批准范围的关键缺陷，停止并只提出一个关键问题；不得自行重写批准决策。
3. 确认进度总账中 `crawler-curate-sources` 当前状态为“计划已批准”，且 `stellaris-crawler-context` 为“未开始”。若状态不符，停止并报告。
4. 在做第一项实施修改前，先把 `crawler-curate-sources` 状态更新为“Claude Code 执行中”，记录时间和执行角色。状态更新后再继续。
5. 将计划中的任务和复选步骤建立为可跟踪待办；严格按 Task 1 至 Task 6 顺序执行。

四、不可变执行边界

- 只创建、编辑和验证计划列出的 `crawler-curate-sources` 文件。
- 可以随执行进度勾选已批准计划中的复选框；不得改变计划的范围、证据卡 ID、案例 ID、固定版本或职责边界。
- 不得设计、规划、创建或编辑 `stellaris-crawler-context` 或任何其他 Skill。
- 不得修改爬虫代码。
- 不得修改 41 个固定第三方仓库，不得安装、构建、运行或测试其中的程序。
- 不得运行 Scorecard、Licensee、ScanCode、ClearlyDefined service、`reuse lint`、代理、浏览器、Docker、WSL、PostgreSQL、示例、迁移或外部爬取。
- 不得联网搜索、下载或补充新资料；本计划只使用已经固定在 E 盘的本地证据。
- 不得修改 `third-party\crawler-knowledge-sources\manifest.md`，除非用户另行批准真实来源更新。
- 许可证事实只由 manifest 维护；证据卡引用其权威条目，不建立第二份许可证权威登记。
- 第三方资料库继续遵守 50 GB 软上限，并保证 E 盘至少保留 120 GB 可用空间；任何大体量数据仍必须留在 E 盘。
- 主决策日志只追加新的、经过用户确认的跨 Skill 决策；普通实施进度和测试结果只写进度总账及计划指定的结果文件。

五、实施与验证要求

完整执行已批准计划的 6 个 Task，不得跳步：

- 先建立结构验证器和 8 个行为案例，并观察预期 RED。
- 生成 11 张唯一、单声明、可追溯的来源治理证据卡，使用计划规定的独立字段和固定本地定位。
- 生成独立 `crawler-curate-sources` 知识视图，覆盖 11/11 证据卡及所有指定章节。
- 创建项目本地 Skill 包及两个引用文档。
- 按 `writing-skills` 执行无 Skill 基线和加载 Skill 后的 RED／GREEN 行为验证；如失败，只修复实际暴露的最小缺口，然后重跑全部案例。
- 执行最终结构、引用、版本、路径、安全边界、占位符和行为结果验证。

必须保持以下最终目标：

- 结构验证命令退出码为 0，并输出 `PASS crawler-curate-sources contract`。
- 11/11 个 `SG-*` 证据卡 ID 唯一且全部被知识视图引用。
- 8/8 个 `CS-*` 行为案例有真实 baseline 和 Skill-assisted 结果，最终为 `8 PASS, 0 FAIL`。
- 5 个固定资料仓库的 ref、40 位 Commit、权威 origin 和本地路径与 manifest 一致；REUSE 权威 origin 为 `https://codeberg.org/fsfe/reuse-tool`。
- 占位符为 0，肯定式第三方运行指令为 0。
- 没有运行任何第三方仓库程序，没有修改爬虫代码，没有初始化 Git，没有开始第 2 个 Skill。

不要把测试脚本存在、命令“应该通过”或子 Agent 的口头报告当作通过证据。必须亲自运行计划规定的命令，检查退出码和完整输出。

六、阻塞、回退和结束状态

- 遇到计划关键歧义、缺失依赖、重复验证失败或需要扩大授权时，立即停止，不要猜测。
- 阻塞时保留已生成的诊断材料，不得批量删除文件；在进度总账记录精确命令、输出、受影响文件、证据 ID 和最后通过的检查点。
- 未解决的证据冲突必须保持“存在冲突”，不得改写成确定性结论。
- 完成自身实施和全部新鲜验证后，先把进度总账状态更新为“待验证”，记录全部文件、验证命令、结果、阻塞项和下一步。
- 不得自行把状态改为“已完成”；该状态只能在用户或独立审阅者验证 Claude Code 输出后更新。
- 到达“待验证”后立即停止。不得开始 `stellaris-crawler-context`。

七、最终回复格式

最终只报告：

1. 实际创建／修改的文件；
2. Task 1–6 的完成情况；
3. 结构验证命令、退出码和关键输出；
4. 11 张证据卡与 8 个行为案例的实际统计；
5. 是否运行第三方程序、修改爬虫代码、初始化 Git；
6. 当前进度总账状态；
7. 任何阻塞、偏差和需要用户决定的唯一下一步。

现在先完整读取文件并审阅计划；通过启动门后再开始执行。
```
