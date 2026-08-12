# 爬虫知识资料库首遍资料审查——第 1 批：资料治理

> 审查日期：2026-07-31
>
> 对应一级方向：资料治理
>
> 对应 Skill：`crawler-curate-sources`
>
> 状态：等待用户核对
>
> 边界：本文记录联网审查得到的当前事实与 Agent 建议，不是已确认决策。未下载、克隆或执行任何第三方源码。

## 1. 审查口径

- 当前事实来自官方站点、官方文档、仓库页面和 GitHub REST 元数据。
- Star、最后推送时间、最新 Release 和 GitHub `size` 字段均为 2026-07-31 的观察值，后续会变化。
- “预计体积”使用 GitHub `size` 字段换算，只作为完整仓库体积风险的代理值；它不等于后续固定 Commit 的实际浅克隆大小。
- “准入”表示 Agent 建议允许进入用户核对范围；只有用户核对后，第二遍才会固定 Commit 并浅克隆。
- “候选”表示目前不满足直接下载条件或价值仍需确认，只保留元数据。
- “拒绝”表示本批不建议下载；仍保留拒绝原因，避免后续重复评估。
- 即使源码准入，仍仅作为只读知识依据，不执行依赖安装、构建、Hook、容器或示例程序。

## 2. 建议准入的权威在线资料

这些资料无需 Git 克隆；第二遍若需要本地快照，须另按其版本和许可边界处理。

| 来源 | 官方性与适用版本 | 对本 Skill 的用途 | Star／预计体积 |
|---|---|---|---|
| [GitHub REST：Repositories](https://docs.github.com/en/rest/repos/repos) | GitHub 官方；版本化 REST 文档，当前页面对应 2026-03-10 API | 获取仓库状态、默认分支、`archived`、`pushed_at`、`stargazers_count`、`size` 和许可证摘要 | 不适用；在线文档 |
| [GitHub REST：Licenses](https://docs.github.com/en/rest/licenses/licenses) | GitHub 官方；版本化 REST 文档 | 理解 GitHub 许可证识别范围及其对 Licensee 的依赖，避免把 API 结果当作完整法律结论 | 不适用；在线文档 |
| [GitHub REST：Starring](https://docs.github.com/en/rest/activity/starring) | GitHub 官方；版本化 REST 文档 | 明确 `stargazers_count` 与 watchers/subscribers 的区别 | 不适用；在线文档 |
| [GitHub：Licensing a repository](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/licensing-a-repository) | GitHub 官方；滚动更新 | 核对 GitHub 许可证检测的能力和限制 | 不适用；在线文档 |
| [Git `clone` 文档](https://git-scm.com/docs/git-clone.html) | Git 官方；按当前 Git 文档版本 | 固化 `--depth`、`--single-branch`、`--filter`、`--no-tags` 与浅克隆语义 | 不适用；在线文档 |
| [SPDX License List](https://spdx.org/licenses/) | SPDX 官方；当前发布版 3.28.0（2026-02-20） | 许可证标识、例外、规范名称、永久 URL 和匹配指南的权威入口 | 不适用；在线数据 |
| [REUSE Specification 3.3](https://reuse.software/spec-3.3/) | FSFE/REUSE 官方；规范 3.3 | 文件级许可证与版权标注、机器可读合规检查 | 不适用；在线规范 |
| [OpenSSF Scorecard checks](https://github.com/ossf/scorecard/blob/main/docs/checks.md) | OpenSSF 官方；与 Scorecard v5.5.0 及滚动检查文档配套 | 将维护、安全和供应链信号作为分项证据，不把聚合分数当作单一准入结论 | 仓库元数据见准入清单 |
| [OpenSSF Best Practices Badge](https://openssf.org/projects/best-practices-badge/) | OpenSSF 官方；滚动标准 | 补充项目自证的开发、安全与维护实践信号 | 不适用；在线资料 |
| [ClearlyDefined curation guidelines](https://docs.clearlydefined.io/docs/curation/curation-guidelines) | ClearlyDefined/OSI 官方；滚动更新 | 区分 declared、discovered、`NOASSERTION`、`NONE`、`OTHER`，形成许可证不确定性处理依据 | 仓库元数据见准入清单 |
| [ScanCode Toolkit 文档](https://scancode-toolkit.readthedocs.io/en/stable/) | AboutCode 官方；与稳定版及 v32.5.0 源码配套 | 深度许可证、版权、包与依赖识别方法及限制 | 仓库元数据见准入清单 |

## 3. Agent 建议：准入清单（未确认）

| 仓库 | 官方性／作用 | Star | 维护状态 | 许可证 | 适用版本 | GitHub 体积代理 | 对应 Skill | 建议理由 |
|---|---|---:|---|---|---|---:|---|---|
| [ossf/scorecard](https://github.com/ossf/scorecard) | OpenSSF 官方；开源项目维护与供应链安全启发式检查 | 5,603 | 活跃；最后推送 2026-07-27 | Apache-2.0 | v5.5.0 | 约 366 MiB | `crawler-curate-sources` | 与质量、维护和安全评分直接相关，文档明确提醒不得只看聚合分数 |
| [licensee/licensee](https://github.com/licensee/licensee) | GitHub 许可证 API 所用识别引擎；许可证文件匹配与相似度判断 | 903 | 活跃；最后推送 2026-07-29 | MIT | v10.0.0 | 约 3.8 MiB | `crawler-curate-sources` | 虽不足 1000 Star，但官方关联性强、体积小，能解释 GitHub 许可证字段的能力和盲区 |
| [aboutcode-org/scancode-toolkit](https://github.com/aboutcode-org/scancode-toolkit) | AboutCode 官方；深度许可证、版权、包、依赖和来源扫描 | 2,592 | 活跃；最后推送 2026-07-09 | 主体 Apache-2.0；参考数据 CC-BY-4.0；第三方组件另有明确记录 | v32.5.0 | 约 691 MiB | `crawler-curate-sources` | 能补充 Licensee 的浅层检测，但必须保留多许可证与第三方文件边界，且不得执行工具 |
| [clearlydefined/service](https://github.com/clearlydefined/service) | ClearlyDefined/OSI 官方；许可证元数据收集、人工校订和上游回馈流程 | 51 | 活跃；最后推送 2026-07-28 | MIT；官方 FAQ 说明数据为 CC0 | v2.4.1 | 约 8.6 MiB | `crawler-curate-sources` | Star 低但官方性和主题相关性强，源码与文档能提供 declared/discovered 及审校工作流案例 |
| [fsfe/reuse-tool](https://github.com/fsfe/reuse-tool) | FSFE 官方 GitHub 镜像；规范化文件级许可证与版权合规 | 583 | 活跃；镜像最后推送 2026-07-24；权威上游为 Codeberg | 文件级明确：源码 GPL-3.0-or-later、文档 CC-BY-SA-4.0、部分数据 CC0-1.0、借用代码 Apache-2.0 | v6.2.0；REUSE Specification 3.3 | 约 7.5 MiB | `crawler-curate-sources` | 不足 1000 Star但为官方项目且通过 REUSE 自检；第二遍应固定权威 Codeberg 上游并核对镜像 Commit |

准入仓库 GitHub 体积代理合计约 **1.05 GiB**。该数值不是实际浅克隆大小。

## 4. Agent 建议：候选清单（未确认，不下载）

| 仓库 | Star | 维护状态 | 许可证 | 适用版本 | GitHub 体积代理 | 对应 Skill | 暂不准入原因 |
|---|---:|---|---|---|---:|---|---|
| [spdx/license-list-XML](https://github.com/spdx/license-list-XML) | 482 | 活跃；最后推送 2026-07-17 | GitHub 为 `NOASSERTION`，根目录未找到统一许可证文件 | v3.28.0 | 约 8.0 MiB | `crawler-curate-sources` | 内容权威且高度相关，但当前无法按既定规则确认整个仓库的统一复制许可；先使用 SPDX 官方在线列表 |
| [spdx/spdx-spec](https://github.com/spdx/spdx-spec) | 374 | 活跃；最后推送 2026-07-30 | Community-Spec-1.0；历史部分 CC-BY-3.0；脚本 MIT | 3.0.1 | 约 1.71 GiB | `crawler-curate-sources` | 许可证明确但仓库体积大、主题宽于本 Skill；优先使用官方稳定规范页面，后续若其他 Skill 需要再复审 |
| [github/rest-api-description](https://github.com/github/rest-api-description) | 1,615 | 活跃；自动更新，最后推送 2026-07-30 | MIT | 滚动 `main`；最近 Release v2.1.0 不能代表当前 API | 约 6.04 GiB | `crawler-curate-sources` | 官方且有价值，但体积代理过大；本批使用版本化 GitHub REST 在线文档足够 |
| [github/choosealicense.com](https://github.com/github/choosealicense.com) | 4,177 | 活跃；最后推送 2026-07-13 | MIT | 无正式 Release；滚动 `gh-pages` | 约 3.1 MiB | `crawler-curate-sources` | 官方、活跃且体积小，但主要帮助选择许可证，不是审查既有仓库许可证的核心依据 |
| [ossf/criticality_score](https://github.com/ossf/criticality_score) | 1,447 | 未归档；最后推送 2025-12-02；最新 Release 2024-04-30 | Apache-2.0 | v2.0.4 | 约 1.6 MiB | `crawler-curate-sources` | 项目重要性评分有参考价值，但维护节奏和本 Skill 的直接价值弱于 Scorecard，需观察后再决定 |
| [ecosyste-ms/repos](https://github.com/ecosyste-ms/repos) | 70 | 活跃；最后推送 2026-07-30 | AGPL-3.0 | 无正式 Release；滚动 `main` | 约 5.0 MiB | `crawler-curate-sources` | 可提供跨托管平台仓库元数据，但不是权威来源且影响力低，仅作为未来数据缺口的备选 |

## 5. Agent 建议：拒绝清单（未确认，不下载）

| 仓库 | Star | 维护状态 | 许可证 | 适用版本 | GitHub 体积代理 | 对应 Skill | 拒绝原因 |
|---|---:|---|---|---|---:|---|---|
| [spdx/license-list-data](https://github.com/spdx/license-list-data) | 682 | 活跃；最后推送 2026-07-16 | 根目录未独立声明整体许可，README 转引源仓库与发布工具 | v3.28.0 | 约 1.84 GiB | `crawler-curate-sources` | 是由 `license-list-XML` 生成的多格式副本，体积大且重复；SPDX 官方在线数据足以替代 |
| [librariesio/libraries.io](https://github.com/librariesio/libraries.io) | 1,155 | 活跃；最后推送 2026-07-29 | AGPL-3.0 | 无正式 Release；滚动 `main` | 约 64 MiB | `crawler-curate-sources` | 完整依赖元数据服务与本 Skill 的筛选方法论关系间接；运行服务源码不会提供足够独特价值 |
| [git/git](https://github.com/git/git) | 62,293 | 活跃；最后推送 2026-07-30 | GPL-2.0-only | GitHub 镜像滚动 `master` | 约 307 MiB | `crawler-curate-sources` | 本批只需 Git 官方 `clone` 文档解释浅克隆语义，下载完整 Git 实现源码属于明显过度收集 |

## 6. 当前事实、推断与待确认项

### 当前事实

- 上述 14 个仓库均未归档；维护活跃度差异已按最后推送和 Release 记录。
- GitHub 许可证 API 由 Licensee 提供识别，官方文档明确说明它不覆盖依赖许可证或所有声明位置。
- OpenSSF Scorecard 自身说明聚合分数不能代替对各项行为的审查。
- ClearlyDefined 的官方审校指南明确区分 declared、discovered、`NOASSERTION`、`NONE` 和 `OTHER`。
- 本轮只读取网页和公共元数据，没有克隆仓库或执行第三方代码。

### Agent 推断

- 对本 Skill 而言，GitHub REST 元数据、Licensee、ScanCode、REUSE、SPDX、Scorecard 和 ClearlyDefined 已构成最小充分的资料治理知识骨架。
- GitHub OpenAPI 描述、完整 SPDX 生成数据和 Git 实现源码的本地价值不足以抵消其体积或重复成本。
- `spdx/license-list-XML` 的权威性没有疑问，但“权威”不能替代既定的许可证明确性准入要求。

### 待用户核对

- 是否接受第 2、3、4、5 节中的准入、候选和拒绝分类。
- 未获核对前，不固定 Commit、不浅克隆、不进入下一批资料审查。
