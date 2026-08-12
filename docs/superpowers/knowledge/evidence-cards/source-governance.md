# 来源治理共享证据卡

> 共享可追溯证据层中的来源治理证据卡，是 `crawler-curate-sources` Skill 知识视图的判断依据来源。本文件只维护可验证、可复核的来源治理知识声明；许可证事实的唯一权威来源是 `third-party/crawler-knowledge-sources/manifest.md`，本文件不复制许可证值到第二套登记。

## 来源引用头

以下来源身份以 `third-party/crawler-knowledge-sources/manifest.md`（来源清单）为权威依据。ref、40 位 Commit、本地相对路径与许可证均以该清单为准；本文件不复制许可证值，仅引用来源身份、固定版本与本地证据路径。所有仓库文件都是只读证据，禁止在资料治理 Skill 中执行任何仓库程序。

- 来源 ID `ossf/scorecard`：ref `v5.5.0`，Commit `c395761df6afe1a69e476bc60a013a94bcbc153f`，本地路径 `third-party/crawler-knowledge-sources/repos/batch-01-source-governance/scorecard`，canonical URL `https://github.com/ossf/scorecard`。
- 来源 ID `licensee/licensee`：ref `v10.0.0`，Commit `cffd1eb1e3b52d85c4fe17f82e04cc1731cf15c4`，本地路径 `third-party/crawler-knowledge-sources/repos/batch-01-source-governance/licensee`，canonical URL `https://github.com/licensee/licensee`。
- 来源 ID `aboutcode-org/scancode-toolkit`：ref `v32.5.0`，Commit `abd87fb81609ea4a29ab4cdda755c188b8be3601`，本地路径 `third-party/crawler-knowledge-sources/repos/batch-01-source-governance/scancode-toolkit`，canonical URL `https://github.com/aboutcode-org/scancode-toolkit`。
- 来源 ID `clearlydefined/service`：ref `v2.4.1`，Commit `7e8f8631d5071f0125302ca0d677a2fd1992bd6f`，本地路径 `third-party/crawler-knowledge-sources/repos/batch-01-source-governance/service`，canonical URL `https://github.com/clearlydefined/service`。
- 来源 ID `fsfe/reuse-tool`：ref `v6.2.0`，Commit `a1bb792acda6fd0724936b4ebbdbc8eceb9c0459`，本地路径 `third-party/crawler-knowledge-sources/repos/batch-01-source-governance/reuse-tool`，canonical URL `https://codeberg.org/fsfe/reuse-tool`（GitHub 镜像 Commit 比较单独记录）。

### SG-ADMISSION-001

- 声明：来源收集采用先发现与审查、后获准下载的两遍式流程；不得从发现行为推断下载批准。
- 证据类型：项目规范决策
- 证据等级：规范性证据
- 来源身份：项目决策日志 `docs/superpowers/brainstorming/2026-07-31-crawler-knowledge-skills-decision-log.md` 第 65 至 66 节
- 版本／ref／Commit：决策日志第 65 至 66 节（非第三方仓库，不适用第三方 Commit）
- 原始位置：决策日志第 65 节“资料收集的两遍式流程”、第 66 节“第一遍资料清单的分批核对方式”
- 支持说明：两遍式流程要求第一遍只联网发现和审查并形成准入、候选、拒绝清单，用户核对后才进入第二遍固定 Commit 与浅克隆；未经用户核对的仓库不得提前下载源码。
- 适用条件：任何来源收集、资料基线、增量更新或定向补充流程的入口阶段。
- 限制：发现与审查结果不得被当作下载授权；用户批准与两遍式执行保持分离。
- 关联 Skill：`crawler-curate-sources`
- 状态：已确认

### SG-AUTHORITY-001

- 声明：OpenSSF Scorecard 评估的是自动化安全启发式信号，不构成来源总权威或项目正确性的判定。
- 证据类型：工程证据
- 证据等级：二级证据（官方源码文档）
- 来源身份：`ossf/scorecard`，ref `v5.5.0`，Commit `c395761df6afe1a69e476bc60a013a94bcbc153f`
- 版本／ref／Commit：`v5.5.0` ／ `c395761df6afe1a69e476bc60a013a94bcbc153f`
- 原始位置：本地 `scorecard/README.md:61-68`（What is Scorecard）；`scorecard/docs/checks.md:3-8`（Check Documentation）
- 支持说明：README 说明 Scorecard 是一个自动化工具，评估多项安全启发式并给出 0-10 分数，用于帮助维护者改进与消费者评估依赖风险；checks.md 说明每个检查描述评分标准、改进步骤与风险说明，检查会持续变化。分数只是一个准入信号。
- 适用条件：评估候选来源的安全启发式信号、把分数作为准入审查的一项输入时。
- 限制：分数不得单独代表来源总权威或项目正确性；不得以单一分数决定准入。
- 关联 Skill：`crawler-curate-sources`
- 状态：已确认

### SG-AUTHORITY-002

- 声明：自动化检查存在检测局限，可能产生不完整信号。
- 证据类型：实现／工程证据
- 证据等级：二级证据（官方源码文档）
- 来源身份：`ossf/scorecard`，ref `v5.5.0`，Commit `c395761df6afe1a69e476bc60a013a94bcbc153f`
- 版本／ref／Commit：`v5.5.0` ／ `c395761df6afe1a69e476bc60a013a94bcbc153f`
- 原始位置：本地 `scorecard/docs/checks.md:156-161`（CI-Tests 局限说明）、`scorecard/docs/checks.md:185-186`（最佳实践徽章与自动检测局限）
- 支持说明：checks.md 说明即使用其他工具满足条件，自动化工具仍可能给出低分，低分不一定是项目有风险；最佳实践徽章可以报告人工声明，而 Scorecard 只能报告它能自动检测到的内容，存在假阴性／假阳性空间。
- 适用条件：解释单个检查未通过、低分或未检测到的含义，避免过度结论时。
- 限制：不得仅凭一个未检测到的检查拒绝或接受来源；自动化检测结果需结合其他证据。
- 关联 Skill：`crawler-curate-sources`
- 状态：已确认

### SG-LICENSE-001

- 声明：Licensee 使用有序的精确与相似度策略匹配候选许可证文件。
- 证据类型：实现证据
- 证据等级：二级证据（官方源码文档）
- 来源身份：`licensee/licensee`，ref `v10.0.0`，Commit `cffd1eb1e3b52d85c4fe17f82e04cc1731cf15c4`
- 版本／ref／Commit：`v10.0.0` ／ `cffd1eb1e3b52d85c4fe17f82e04cc1731cf15c4`
- 原始位置：本地 `licensee/docs/README.md:16-20`（The solution 的 Matchers 顺序）
- 支持说明：README 说明 Licensee 按顺序使用若干匹配策略：显式版权声明且无更多内容时判定为未许可；精确匹配已知许可证；仍无法匹配时使用 Sørensen–Dice 相似度系数计算与已知许可证的相似百分比。
- 适用条件：把许可证检测工具结果作为来源许可证识别的检测证据时。
- 限制：检测结果是检测证据而非法律意见；匹配策略存在相似度判定，不构成法律建议。
- 关联 Skill：`crawler-curate-sources`
- 状态：已确认

### SG-LICENSE-002

- 声明：许可证结果可能冲突，并暴露必须保留的匹配置信度。
- 证据类型：实现证据
- 证据等级：二级证据（官方源码文档）
- 来源身份：`licensee/licensee`，ref `v10.0.0`，Commit `cffd1eb1e3b52d85c4fe17f82e04cc1731cf15c4`
- 版本／ref／Commit：`v10.0.0` ／ `cffd1eb1e3b52d85c4fe17f82e04cc1731cf15c4`
- 原始位置：本地 `licensee/docs/usage.md:30`、`licensee/docs/usage.md:67-74`（matched_file 与 confidence）
- 支持说明：usage.md 说明可通过 project 对象获取匹配许可证、匹配文件、文件名与匹配置信度；不同项目与文件可能产生不同匹配结果，必须保留置信度与原始匹配文件身份。
- 适用条件：面对多个许可证候选、冲突检测结果或需要保留匹配置信度的场景。
- 限制：不得把多个匹配折叠成虚假的确定性；冲突必须保持可见。
- 关联 Skill：`crawler-curate-sources`
- 状态：已确认

### SG-SCANCODE-001

- 声明：ScanCode 覆盖许可证、版权、包与依赖检测，并可能输出结构化结果。
- 证据类型：实现证据
- 证据等级：二级证据（官方源码文档）
- 来源身份：`aboutcode-org/scancode-toolkit`，ref `v32.5.0`，Commit `abd87fb81609ea4a29ab4cdda755c188b8be3601`
- 版本／ref／Commit：`v32.5.0` ／ `abd87fb81609ea4a29ab4cdda755c188b8be3601`
- 原始位置：本地 `scancode-toolkit/README.rst:5-6`（工具定位）、`scancode-toolkit/README.rst:65-84`（特性：结构化输出、JSON/YAML/HTML/CycloneDX/SPDX）
- 支持说明：README.rst 说明 ScanCode 检测代码中版权、许可证与漏洞，覆盖包、依赖与清单；支持保存为 JSON、YAML、HTML、CycloneDX 或 SPDX 等结构化输出。
- 适用条件：读取或引用 ScanCode 结构化结果作为来源扫描证据时。
- 限制：本 Skill 可读取既有结果，但未经单独批准不得运行 ScanCode；扫描器不属于资料治理运行范围。
- 关联 Skill：`crawler-curate-sources`
- 状态：已确认

### SG-CURATION-001

- 声明：ClearlyDefined 区分收割数据与经过人工审阅的 curations，并鼓励上游修正。
- 证据类型：工程证据
- 证据等级：二级证据（官方源码文档）
- 来源身份：`clearlydefined/service`，ref `v2.4.1`，Commit `7e8f8631d5071f0125302ca0d677a2fd1992bd6f`
- 版本／ref／Commit：`v2.4.1` ／ `7e8f8631d5071f0125302ca0d677a2fd1992bd6f`
- 原始位置：本地 `service/README.md:3-7`（服务定位与收割／curations 分离）、`service/README.md:58-72`（System Flow 中收割、patch、PR、审阅合并）
- 支持说明：README 说明服务管理收割数据的 curations、人工输入与修正，crawler 承担收割；数据经 PR 审阅合并后构建进数据库；目标是鼓励项目把数据直接纳入上游。
- 适用条件：引用收割元数据或 curated 元数据作为来源信息时。
- 限制：curated 元数据是带来源出处的证据，不得替代上游事实；不得把收割数据当作权威事实。
- 关联 Skill：`crawler-curate-sources`
- 状态：已确认

### SG-REUSE-001

- 声明：REUSE 合规要求许可证文本与 SPDX 标注，并可用 `reuse lint` 检查。
- 证据类型：规范性／实现证据
- 证据等级：二级证据（官方源码文档）
- 来源身份：`fsfe/reuse-tool`，ref `v6.2.0`，Commit `a1bb792acda6fd0724936b4ebbdbc8eceb9c0459`，canonical origin 为 Codeberg
- 版本／ref／Commit：`v6.2.0` ／ `a1bb792acda6fd0724936b4ebbdbc8eceb9c0459`
- 原始位置：本地 `reuse-tool/README.md:180-224`（Usage 与 `reuse lint`）
- 支持说明：README 说明把许可证放入 `LICENSES/` 目录、为每个文件添加 `SPDX-License-Identifier` 与 `SPDX-FileCopyrightText` 头，并用 `reuse lint` 核验合规。
- 适用条件：评估来源或项目是否满足 REUSE 合规要求，或解释 REUSE 标注规则时。
- 限制：本 Skill 只读取该规则，资料治理过程中不执行 `reuse lint`；执行任何仓库命令都需要单独批准。
- 关联 Skill：`crawler-curate-sources`
- 状态：已确认

### SG-VERSION-001

- 声明：获准入的来源代码必须固定到权威 ref 与共享清单中的精确 Commit。
- 证据类型：项目规范决策
- 证据等级：规范性证据
- 来源身份：项目决策日志第 65、73、76 节与来源清单 `third-party/crawler-knowledge-sources/manifest.md`
- 版本／ref／Commit：决策日志第 65、73、76 节；manifest.md 记录每个仓库的 ref 与 40 位 Commit
- 原始位置：决策日志第 73 节“第二遍资料收集的分阶段推进决定”、第 76 节“第二遍完整收集结果”；`manifest.md`（ref、commit_sha、status 列）
- 支持说明：第二遍必须逐一核对权威上游、稳定 ref／审查 Commit 后固定；manifest 记录 ref 与 40 位 Commit 作为唯一可追溯版本基线；完整复核要求 HEAD 与固定 Commit 一致。
- 适用条件：任何来源的固定版本、版本基线更新或增量更新场景。
- 限制：移动分支在冻结前不可复现，不作为版本基线；只有 manifest 固定的 ref＋Commit 可作为可追溯基线。
- 关联 Skill：`crawler-curate-sources`
- 状态：已确认

### SG-CAPACITY-001

- 声明：资料库具有 50 GB 软上限，并必须在 E 盘保留至少 120 GB 可用空间。
- 证据类型：项目规范决策
- 证据等级：规范性证据
- 来源身份：项目决策日志第 73、75、76 节
- 版本／ref／Commit：决策日志第 73、75、76 节（非第三方仓库，不适用第三方 Commit）
- 原始位置：决策日志第 31 节“E 盘资料库容量边界”、第 73、75、76 节容量核验
- 支持说明：50 GB 软上限与 E 盘至少保留 120 GB 可用空间是既定边界；达到任一边界必须停止新增源码克隆，只保留候选元数据，直到用户批准扩容、清理或调整保留策略。
- 适用条件：下载前、下载中、下载后的容量与可用空间检查。
- 限制：超过 50 GB 软上限或 E 盘可用空间低于 120 GB 时，必须在边界前停止下载。
- 关联 Skill：`crawler-curate-sources`
- 状态：已确认

### SG-SAFETY-001

- 声明：资料收集不授权安装、构建、执行、服务、扫描器、代理、测试、示例或外部抓取。
- 证据类型：项目规范决策
- 证据等级：规范性证据
- 来源身份：项目决策日志第 73、75、76、82 节
- 版本／ref／Commit：决策日志第 73、75、76、82 节（非第三方仓库，不适用第三方 Commit）
- 原始位置：决策日志第 16 节“第三方源码执行安全”、第 73、75、76 节执行边界、第 82 节授权边界
- 支持说明：第三方仓库只作只读分析；禁止自动执行依赖安装脚本、构建脚本、Git hooks、容器、示例程序及其他未经审查的可执行内容；确有必要执行时，须先审查风险并在隔离环境经用户批准。
- 适用条件：任何涉及第三方源码快照的收集、分析、交接流程。
- 限制：任何执行都需单独用户批准和不同计划；本 Skill 不得越权执行或建议执行。
- 关联 Skill：`crawler-curate-sources`
- 状态：已确认
