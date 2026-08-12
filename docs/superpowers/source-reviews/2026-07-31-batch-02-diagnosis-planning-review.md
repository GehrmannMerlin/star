# 爬虫知识资料库首遍资料审查——第 2 批：诊断与规划

> 审查日期：2026-07-31
>
> 对应一级方向：诊断与规划
>
> 对应 Skills：`crawler-triage-incidents`、`crawler-review-architecture`、`crawler-writing-plans-bridge`
>
> 状态：等待用户核对
>
> 边界：本文记录联网审查得到的当前事实与 Agent 建议，不是已确认决策。未调用 Superpowers `writing-plans`，未生成实施计划，也未下载、克隆或执行第三方源码。

## 1. 审查口径

- 故障分诊资料必须支持“现象、影响、证据、假设、根因、缓解、修复”分离，并能保留未知项和置信边界。
- 架构评审资料必须支持多方案比较、质量属性、约束、风险、取舍和决策记录，不得把模板本身当作架构结论。
- `crawler-writing-plans-bridge` 的直接接口契约只以 Stellaris 当前安装且版本匹配的 Superpowers `writing-plans` 为准；其他规划框架只能作为比较资料。
- Star、最后推送时间、最新 Release 和 GitHub `size` 字段均为 2026-07-31 的观察值。
- “预计体积”使用 GitHub `size` 字段换算，只是完整仓库体积风险代理，不等于第二遍的实际浅克隆大小。
- 即使源码准入，仍只允许只读分析；不得运行其中的 CLI、生成器、容器、脚本或示例。

## 2. Agent 建议：准入的权威在线资料（未确认）

| 来源 | 官方性与适用版本 | 用途 | 对应 Skill | 使用边界 |
|---|---|---|---|---|
| [Google SRE：Effective Troubleshooting](https://sre.google/sre-book/effective-troubleshooting/) | Google SRE 官方；SRE Book，CC BY-NC-ND 4.0 | 从系统理解、问题报告、检查、诊断、测试到证明根因的通用排障方法 | `crawler-triage-incidents` | 只引用和提炼事实／方法，不复制或改编大段受限文本 |
| [Google SRE Workbook：Incident Response](https://sre.google/workbook/incident-response/) | Google SRE 官方；SRE Workbook | 区分事件管理、影响缓解和根因诊断，理解事件角色、记录与交接 | `crawler-triage-incidents` | 不把生产事件指挥职责并入 Skill |
| [Google SRE：Postmortem Culture](https://sre.google/sre-book/postmortem-culture/) 与 [Postmortem Analysis](https://sre.google/workbook/postmortem-analysis/) | Google SRE 官方；CC BY-NC-ND 4.0 | 根因、触发因素、影响、时间线和后续动作的可追溯记录 | `crawler-triage-incidents` | 复盘经验不能替代当前项目证据 |
| [NIST SP 800-61 Rev.3](https://csrc.nist.gov/pubs/sp/800/61/r3/final) | NIST 官方；2025-04 最终版 | 安全事件的准备、检测、响应、恢复及风险管理边界 | `crawler-triage-incidents`、`crawler-review-architecture` | 仅适用于安全事件或可借鉴的通用原则，不把所有爬虫故障安全事件化 |
| [SEI Architecture Tradeoff Analysis Method](https://www.sei.cmu.edu/library/the-architecture-tradeoff-analysis-method/) | CMU SEI 官方；ATAM 原始方法报告 | 围绕多个质量属性识别敏感点、风险和取舍 | `crawler-review-architecture` | 方法权威但年代较早，应与当前技术及项目证据结合 |
| [ISO/IEC/IEEE 42010:2022 概览](https://www.iso.org/standard/74393.html) | ISO 官方；现行 2022 版 | 区分架构、架构描述、视点、模型和关注点 | `crawler-review-architecture` | 只使用公开概览；未取得的付费标准全文不得被假定为已读依据 |
| [Microsoft：Maintain an architecture decision record](https://learn.microsoft.com/en-us/azure/well-architected/architect-role/architecture-decision-record) | Microsoft 官方；2026 滚动文档 | 决策的上下文、选项、理由、状态、后果和独立可读性 | `crawler-review-architecture` | Azure 示例不是 Stellaris 的技术硬约束 |
| [Microsoft Engineering Playbook：Design Reviews](https://microsoft.github.io/code-with-engineering-playbook/design/design-reviews/recipes/engagement-process/) | Microsoft 官方；仓库文档 CC-BY-4.0 | 设计审查的准备、约束发现、同步／异步评审和结果跟踪 | `crawler-review-architecture` | 只吸收通用评审方法 |
| [IETF BCP 14 / RFC 8174](https://datatracker.ietf.org/doc/rfc8174/) | IETF 官方；更新 RFC 2119 | 明确 `MUST`、`SHOULD`、`MAY` 等规范性约束的解释边界 | `crawler-writing-plans-bridge` | 仅用于规划输入包中的约束等级，不把普通自然语言自动升级为规范要求 |
| [Superpowers v6.2.0 `writing-plans`](https://github.com/obra/superpowers/blob/v6.2.0/skills/writing-plans/SKILL.md) | Superpowers 官方源码；与当前已安装插件版本 6.2.0 匹配 | 规划输入应覆盖目标、架构、技术栈、精确文件、测试、验证、任务粒度和无占位符要求 | `crawler-writing-plans-bridge` | 本阶段只审查接口，不调用 Skill、不创建计划 |

## 3. Agent 建议：准入清单（未确认）

| 仓库 | 官方性／作用 | Star | 维护状态 | 许可证 | 适用版本 | GitHub 体积代理 | 对应 Skill | 建议理由 |
|---|---|---:|---|---|---|---:|---|---|
| [obra/superpowers](https://github.com/obra/superpowers) | Superpowers 官方；包含 `writing-plans` 及其上下游流程契约 | 264,012 | 活跃；最后推送 2026-07-28 | MIT | v6.2.0 | 约 4.0 MiB | `crawler-writing-plans-bridge` | 与当前安装版本完全匹配，是 Bridge 唯一直接规划契约；不得因此提前调用 `writing-plans` |
| [PagerDuty/incident-response-docs](https://github.com/PagerDuty/incident-response-docs) | PagerDuty 官方公开事件响应流程；准备、响应、复盘 | 1,048 | 活跃；最后推送 2026-07-02 | Apache-2.0 | 无正式 Release；固定审核时 Commit | 约 165 MiB | `crawler-triage-incidents` | 直接提供可审查的事件分类、角色、沟通、时间线和复盘案例；只作诊断知识，不建设事件指挥运行时 |
| [microsoft/code-with-engineering-playbook](https://github.com/microsoft/code-with-engineering-playbook) | Microsoft 官方工程实践；设计审查、可靠性、反馈与质量门 | 2,701 | 仍具现实参考价值；最后推送 2026-02-03 | 文档 CC-BY-4.0；代码 MIT | 无正式 Release；固定审核时 Commit | 约 91.6 MiB | 三个本批 Skills | 一个来源覆盖设计审查、可复现工程反馈、可靠性与实施前质量边界，许可证清晰 |
| [adr/madr](https://github.com/adr/madr) | ADR 组织官方 Markdown Any Decision Records 模板 | 2,358 | 活跃；最后推送 2026-07-13 | MIT OR CC0-1.0 | 4.0.0；同时固定活跃分支 Commit | 约 0.4 MiB | `crawler-review-architecture` | 体积小、许可证明确，模板强调选项、利弊、决策结果、状态和后果，适合可追溯方案比较 |
| [arc42/arc42-template](https://github.com/arc42/arc42-template) | arc42 官方；架构文档、质量要求和风险结构 | 1,254 | 活跃；最后推送 2026-07-07 | CC-BY-SA-4.0 | 模板 9.0 系列；固定审核时 Commit | 约 162 MiB | `crawler-review-architecture` | 提供完整但可裁剪的架构关注点结构，并包含中文版本；使用时必须保留署名与相同方式共享边界 |

准入仓库 GitHub 体积代理合计约 **423 MiB（0.41 GiB）**。该数值不是实际浅克隆大小。

## 4. Agent 建议：候选清单（未确认，不下载）

| 仓库 | Star | 维护状态 | 许可证 | 适用版本 | GitHub 体积代理 | 对应 Skill | 暂不准入原因 |
|---|---:|---|---|---|---:|---|---|
| [github/spec-kit](https://github.com/github/spec-kit) | 124,678 | 活跃；最后推送 2026-07-30 | MIT | v0.15.0 | 约 14.4 MiB | `crawler-writing-plans-bridge` | 结构化 Spec→Plan→Tasks 流程有比较价值，但它是另一套可执行工具链，不能覆盖 Superpowers v6.2.0 契约或用户批准门 |
| [MicrosoftDocs/architecture-center](https://github.com/MicrosoftDocs/architecture-center) | 2,011 | 活跃；最后推送 2026-07-30 | CC-BY-4.0 | 滚动 `main` | 约 1.57 GiB | `crawler-review-architecture` | 官方且权威，但仓库体积大、Azure 内容范围远超本项目；优先按需引用在线 ADR 和架构评审页面 |
| [architecture-decision-record/architecture-decision-record](https://github.com/architecture-decision-record/architecture-decision-record) | 16,561 | 活跃；最后推送 2026-07-12 | 作者内容 CC-BY-NC-SA-4.0；收录模板各自适用原许可证 | 无正式 Release；滚动 `main` | 约 0.5 MiB | `crawler-review-architecture` | 影响力高但属于模板聚合，许可证不统一且与 MADR 重复；只保留目录元数据和来源线索 |

## 5. Agent 建议：拒绝清单（未确认，不下载）

| 仓库 | Star | 维护状态 | 许可证 | 适用版本 | GitHub 体积代理 | 对应 Skill | 拒绝原因 |
|---|---:|---|---|---|---:|---|---|
| [dastergon/awesome-sre](https://github.com/dastergon/awesome-sre) | 13,411 | 最后推送 2025-08-28 | CC0-1.0 | 无正式 Release | 约 1.2 MiB | `crawler-triage-incidents` | 高 Star 但主要是第三方链接目录，不能作为根因或修复依据；本批已有更权威的一手资料 |
| [dastergon/postmortem-templates](https://github.com/dastergon/postmortem-templates) | 1,445 | 最后推送 2023-07-12 | CC0-1.0 | 无正式 Release | 约 0.03 MiB | `crawler-triage-incidents` | 长期未维护且只是模板集合；Google SRE 与 PagerDuty 已提供更完整、当前且可追溯的复盘资料 |
| [npryce/adr-tools](https://github.com/npryce/adr-tools) | 5,582 | 最后推送 2024-04-25；最新 Release 2018-07-25 | GitHub `NOASSERTION`，未完成明确许可证核验 | 3.0.0 | 约 0.13 MiB | `crawler-review-architecture` | 是 ADR 命令行运行工具而非评审知识底座，维护与许可证信号不足，且本 Skill 不需要另一套运行时 |

## 6. 当前事实、推断与待确认项

### 当前事实

- 当前 Stellaris 安装的 Superpowers 版本为 6.2.0，`obra/superpowers` 最新 Release 也是 v6.2.0。
- Superpowers `writing-plans` 要求从已完成规格进入详细计划，并要求精确文件、测试、验证、细粒度步骤和禁止占位符；本轮没有调用该 Skill。
- Google SRE 明确把影响缓解、事件管理和根因定位视为相关但不同的活动，并强调在纠正动作前验证因果假设。
- SEI ATAM 面向多个竞争质量属性的架构取舍；ISO/IEC/IEEE 42010:2022 面向架构描述而不规定具体架构方法。
- 本批 11 个有效仓库候选均未归档；另一个已知旧 AWS Labs 路径返回 404，未作为有效候选记录。
- 本轮只读取网页、少量许可证文本和公共元数据，没有克隆仓库或执行第三方内容。

### Agent 推断

- 5 个准入仓库与 10 项权威在线资料已形成覆盖三项 Skill 的最小充分骨架，无需再扩张到大量 SRE 链接目录、ADR CLI 或云厂商完整文档库。
- `crawler-writing-plans-bridge` 应从 Superpowers 当前版本反向确定输入完整性，而不是借用 Spec Kit 等其他工具的流程重定义接口。
- `crawler-triage-incidents` 可以吸收事件管理与复盘的证据结构，但不能变成生产事件指挥系统。

### 待用户核对

- 是否接受第 2、3、4、5 节中的权威在线资料、准入、候选和拒绝分类。
- 未获核对前，不固定 Commit、不浅克隆、不进入下一批资料审查。
