# `crawler-writing-plans-bridge` 核验流程与规划输入包契约

> 本文件定义本 Skill 的核验流程、规划输入包契约、Superpowers 接口契约与证据卡映射。判断依据与边界以主决策日志与已批准设计规格为准。

## 核验流程

1. 读取项目上下文、目标、约束与已确认根因。处理 Stellaris 问题时，先读取 `stellaris-crawler-context` 生成的项目上下文包路径。
2. 核验根因、批准状态和必要证据是否齐全：根因是否具有充分证据支持；用户是否已明确批准根因和方向；必要证据（固定版本资料、证据卡、上下文包条目、决策日志节号）是否可追溯。
3. 条件不齐全时拒绝进入规划，列出缺失项与补齐要求，结论停留在核验记录。
4. 条件齐全时整理影响范围、技术约束、禁止事项、验证标准和回滚要求。
5. 输出一份供 Superpowers `writing-plans` 使用的规划输入包（遵循 Superpowers v6.2.0 writing-plans 契约）。
6. 呈现规划输入包并等待用户再次明确授权进入 `writing-plans`；获授权后才完成交接。

## 规划输入包契约

规划输入包采用可落盘结构化记录＋简短人类可读摘要（主决策日志第 33 节），每条结论可追溯。固定字段：

- 影响范围（受影响的模块、文件、配置、数据面、部署面）。
- 技术约束（锁定版本、E 盘存储约束、合规与安全约束）。
- 禁止事项（来自上游 Skill 的排除项与用户批准边界）。
- 验证标准（验收方法：只读检查、测试、健康检查、金标比对）。
- 回滚要求（修复失败的恢复路径与数据保全措施）。
- 根因依据（证据卡 ID、固定资料路径、上下文包条目、决策日志节号）。
- 批准边界（根因和方向的用户批准记录；进入 `writing-plans` 需用户再次明确授权）。

记录必须明确区分：事实、证据、推断、待确认项与用户批准状态。未确认猜测必须被拦截，不得进入规划输入包。

## Superpowers 接口契约

- 遵循 Superpowers v6.2.0 `writing-plans`（Plan Document Header、Global Constraints、Task Structure、No Placeholders、Task Right-Sizing、Self-Review、Execution Handoff、REQUIRED SUB-SKILL）。
- 其他规划框架不得覆盖该契约或用户批准门（主决策日志 §68）。
- 规划输入包作为 `writing-plans` 的输入，不取代其规划职责；不编写实施计划文档。
- 不重新诊断、不选择修复方向、不修改代码（主决策日志 §47）。

## 证据卡映射

共享证据卡：`docs/superpowers/knowledge/evidence-cards/writing-plans-bridge.md`；知识视图：`docs/superpowers/knowledge/skill-views/crawler-writing-plans-bridge.md`。

| 核验聚焦点 | 证据卡 | 固定资料路径 |
|---|---|---|
| 交接准入与批准门 | WB-ADMIT-001、WB-ADMIT-002、WB-ADMIT-003 | 主决策日志 §47；obra/superpowers `skills/writing-plans/SKILL.md`（Scope Check、Self-Review） |
| 规划输入包内容 | WB-PKG-001、WB-PKG-002、WB-PKG-003 | 主决策日志 §47；obra/superpowers `skills/writing-plans/SKILL.md`（Plan Document Header、Global Constraints、Task Structure） |
| Superpowers 接口契约 | WB-IF-001、WB-IF-002 | obra/superpowers `skills/writing-plans/SKILL.md`（Plan Document Header、No Placeholders、Task Right-Sizing、Execution Handoff、REQUIRED SUB-SKILL） |
| 验收与防猜测 | WB-ACC-001、WB-ACC-002 | obra/superpowers `skills/writing-plans/plan-document-reviewer-prompt.md`；主决策日志 §47 验收重点 |

每条依据必须可追溯：从规划输入包追到固定版本资料、证据卡、上下文包条目或决策日志节号。只给仓库首页、模糊文件夹或没有版本的引用不满足要求。

## 证据不足与冲突

- 证据不足时不得把结论判定为确定根因；保留候选状态并标记未知项。
- 现场证据、项目上下文、已批准要求冲突时并列报告，不静默覆盖任一来源。
- 未解决的声明标记为不确定（非确定性），不得伪装成确定结论。
- 固定版本证据卡与既有规划输入包记录不得被静默改写；更新只通过新增修订进行。
- 未确认猜测（未标注为推断、证据不足以证实）必须被拦截，不得进入规划输入包。
- 外部条件（数据库服务不可用/外部依赖受限）只能给合规降级/等待/终止结论，不得伪装成已修复。
- 不得因新技术更新默认要求升级；是否升级以证据和项目约束为准。
