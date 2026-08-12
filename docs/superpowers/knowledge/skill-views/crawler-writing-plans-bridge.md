# crawler-writing-plans-bridge 知识视图

> 本视图是 `crawler-writing-plans-bridge` Skill 的独立知识视图，只保留与"规划衔接"职责相关的知识。来源身份、版本与许可证事实由共享证据层统一维护，本视图通过稳定证据卡 ID 引用，不复制原始来源元数据。

## 定位、触发与排除项

- **定位**：规划衔接 Skill；只接收具有充分证据支持的根因和用户已经批准的处理方向，核验根因、批准状态和必要证据是否齐全（条件不齐全时拒绝进入规划），整理影响范围、技术约束、禁止事项、验证标准和回滚要求，输出一份供 Superpowers `writing-plans` 使用的规划输入包；只有用户再次明确授权进入 `writing-plans` 时，才允许完成交接。
- **不是**：诊断 Skill、修复方向选择器、实施计划编写器、记忆服务、RAG、代码索引、上下文框架或爬虫运行组件。
- **触发**：用户要求把已获批准的修复方向/评审结论衔接进 Superpowers `writing-plans` 规划，或 Skill 3-18 已输出获准修复方向并请求交接时触发。
- **排除**：不重新诊断、不选择修复方向、不编写实施计划，也不修改代码（主决策日志 §47）；直接接口契约以 obra/superpowers v6.2.0 为准，其他规划框架不得覆盖该契约或用户批准门（§68）。

## 最低证据输入

- 项目上下文（处理 Stellaris 问题时为 `stellaris-crawler-context` 项目上下文包路径）。
- 已确认根因与方向（Skill 3-18 分诊/评审/诊断的获准结论）。
- 用户批准状态（根因和方向的批准记录）。
- 必要证据（支撑根因的固定版本资料、证据卡、上下文包条目或决策日志节号）。
- 固定版本资料（批次 2：obra/superpowers v6.2.0）。

## 知识主题与证据卡映射

### 交接准入与批准门

- 判断只接收已核实输入、条件不齐拒绝、拦截未确认猜测是否符合交接准入规则；根因证据不足、批准状态缺失或证据不可追溯时拒绝进入规划。
- 证据卡：[[WB-ADMIT-001]]（只接收已核实输入）、[[WB-ADMIT-002]]（条件不齐拒绝）、[[WB-ADMIT-003]]（拦截未确认猜测）。
- 依据固定版本：主决策日志 §47；obra/superpowers v6.2.0 `skills/writing-plans/SKILL.md`（Scope Check、Self-Review）。

### 规划输入包内容

- 判断影响范围、技术约束、禁止事项、验证标准、回滚要求、根因依据、批准边界是否齐全且可追溯。
- 证据卡：[[WB-PKG-001]]（影响范围与技术约束）、[[WB-PKG-002]]（禁止事项/验证标准/回滚要求）、[[WB-PKG-003]]（根因依据与批准边界）。
- 依据固定版本：主决策日志 §47；obra/superpowers v6.2.0 `skills/writing-plans/SKILL.md`（Plan Document Header、Global Constraints）。

### Superpowers writing-plans 接口契约

- 判断规划输入包是否遵循 Superpowers v6.2.0 writing-plans 契约（Plan Document Header、No Placeholders、Task Right-Sizing、Execution Handoff、REQUIRED SUB-SKILL）；其他规划框架不得覆盖该契约或用户批准门。
- 证据卡：[[WB-IF-001]]（计划文档头与无占位符）、[[WB-IF-002]]（任务粒度与执行交接）。
- 依据固定版本：obra/superpowers v6.2.0 `skills/writing-plans/SKILL.md`（Plan Document Header、No Placeholders、Task Right-Sizing、Execution Handoff）。

### 验收与防猜测

- 判断规划输入包验收是否符合四维验收（Completeness/Spec Alignment/Task Decomposition/Buildability），未确认猜测是否被拦截。
- 证据卡：[[WB-ACC-001]]（四维验收）、[[WB-ACC-002]]（防猜测与验收重点）。
- 依据固定版本：obra/superpowers v6.2.0 `skills/writing-plans/plan-document-reviewer-prompt.md`；主决策日志 §47 验收重点。

## 版本化判断规则

- 每条判断依据必须追溯到固定版本资料（ref＋Commit）、证据卡、上下文包条目或决策日志节号；只给仓库首页或没有版本的引用不满足要求。
- 明确区分事实、证据、综合推断与未知项；综合推断必须显式标记"推断"，不得伪装成资料中的确定结论。
- 未确认猜测必须被拦截，不得进入规划输入包。
- 其他规划框架不得覆盖 Superpowers v6.2.0 契约或用户批准门（主决策日志 §68）。

## 输出、交接与禁止越权

- **输出**：可追溯规划输入包（影响范围、技术约束、禁止事项、验证标准、回滚要求、根因依据、批准边界）。
- **交接**：只有用户再次明确授权进入 `writing-plans` 时才完成交接；规划输入包作为 Superpowers `writing-plans` 输入，不取代其规划职责。
- **禁止越权**：不重新诊断、不选择修复方向、不编写实施计划、不修改代码、不把未确认猜测写入规划输入包、不初始化 Git、不记录敏感信息原件。

## 视图自检

- 全部证据卡 ID（WB-ADMIT-*、WB-PKG-*、WB-IF-*、WB-ACC-*）在 `writing-plans-bridge.md` 中存在且被本视图引用。
- 无未标注的推断；每条判断可追溯到证据卡或固定资料。
- 未复制相邻 Skill（诊断类 Skill 3-18）的职责。
