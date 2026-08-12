# crawler-writing-plans-bridge Skill 设计规格

日期：2026-08-03  
状态：书面规格待用户审阅  
适用范围：第 19 个（最后一个）独立 Agent Skill `crawler-writing-plans-bridge` 的完整设计

## 1. 目标与边界

`crawler-writing-plans-bridge` 是爬虫知识资料库中的**规划衔接 Skill**。它只接收具有充分证据支持的根因和用户已经批准的处理方向，核验根因、批准状态和必要证据是否齐全，条件不齐全时拒绝进入规划；整理影响范围、技术约束、禁止事项、验证标准和回滚要求，输出一份供 Superpowers `writing-plans` 使用的规划输入包；只有用户再次明确授权进入 `writing-plans` 时，才允许完成交接。

本 Skill **不重新诊断、不选择修复方向、不编写实施计划，也不修改代码**。它的直接接口契约以当前版本匹配的 Superpowers v6.2.0（obra/superpowers，Commit `3dcbd5c4b48e02263fbf4a3c01e3fe4f81d584d9`）为准；其他规划框架不得覆盖该契约或用户批准门。

本设计只规划 `crawler-writing-plans-bridge`；它是 19 个 Skill 中的最后一个，不存在后续 Skill 实施任务；不创建或实施本 Skill 本身（实施由 Claude Code 按后续写作计划执行）。

## 2. 已确认输入

- 主决策日志：`docs/superpowers/brainstorming/2026-07-31-crawler-knowledge-skills-decision-log.md`（已确认决策的最高权威；§47/§68/§51/§26.4）。
- 统一知识设计规格：`docs/superpowers/specs/2026-07-31-crawler-knowledge-skills-knowledge-design.md`（公共知识契约）。
- 固定源码清单：`third-party/crawler-knowledge-sources/manifest.md`。
- 直接接口契约：Superpowers v6.2.0 `skills/writing-plans/SKILL.md`、`skills/writing-plans/plan-document-reviewer-prompt.md`、`skills/executing-plans/SKILL.md`。
- 处理 Stellaris 问题时：`stellaris-crawler-context` 生成的项目上下文包路径。
- 已确认根因与方向（Skill 3-18 分诊/评审/诊断的获准结论，适用时）。
- 相关影响范围、技术约束、禁止事项、验证标准和回滚要求（现场只读核验）。

## 3. 职责与排除项

### 3.1 职责

- 核验根因、批准状态和必要证据是否齐全（主决策日志 §47）。
- 条件不齐全时拒绝进入规划，并说明缺失项（主决策日志 §47）。
- 整理影响范围、技术约束、禁止事项、验证标准和回滚要求（主决策日志 §47）。
- 输出一份供 Superpowers `writing-plans` 使用的规划输入包（主决策日志 §47；Superpowers v6.2.0 writing-plans 契约）。
- 只有用户再次明确授权进入 `writing-plans` 时，才允许完成交接（主决策日志 §47）。

### 3.2 排除项

- 不重新诊断、不选择修复方向、不编写实施计划，也不修改代码（主决策日志 §47）。
- 不越过用户批准边界：根因未获用户批准、或用户未再次明确授权进入 `writing-plans` 时，不完成交接（主决策日志 §47/§68）。
- 不拦截未确认猜测的例外：未确认猜测必须被拦截，不得进入规划输入包。
- 不生成 `writing-plans` 本身、不编写实施计划文档。
- 不安装、构建或运行未经批准的项目或第三方代码。
- 不修改爬虫代码、`manifest.md`、第三方仓库；不初始化 Git。
- 不把密钥、Cookie、认证请求头、代理凭据、环境变量中的秘密、数据库连接串凭据写入规划输入包，落盘前脱敏。

## 4. 触发条件与输入

### 4.1 触发

用户要求把已获批准的修复方向/评审结论衔接进 Superpowers `writing-plans` 规划，或 Skill 3-18 已输出获准修复方向并请求交接时触发（主决策日志 §47/§68）。通常由 `crawler-review-architecture`、领域或技术栈 Skill 在用户批准后请求交接进入，或用户直接要求规划衔接。

### 4.2 最低输入

- 项目上下文（处理 Stellaris 问题时为 `stellaris-crawler-context` 项目上下文包路径）。
- 已确认根因与方向（Skill 3-18 分诊/评审/诊断的获准结论）。
- 用户批准状态（根因和方向的批准记录）。
- 必要证据（支撑根因的固定版本资料、证据卡、上下文包条目或决策日志节号）。
- 固定版本资料（批次 2：obra/superpowers v6.2.0）。

## 5. 核验流程

1. 读取项目上下文（Stellaris 问题先读 `stellaris-crawler-context` 项目上下文包）、目标、约束与已确认根因。
2. 核验根因、批准状态和必要证据是否齐全：根因是否具有充分证据支持；用户是否已明确批准根因和方向；必要证据（固定版本资料、证据卡、上下文包条目、决策日志节号）是否可追溯。
3. 条件不齐全时拒绝进入规划，列出缺失项与补齐要求，结论停留在核验记录。
4. 条件齐全时整理影响范围、技术约束、禁止事项、验证标准和回滚要求。
5. 输出一份供 Superpowers `writing-plans` 使用的规划输入包（遵循 Superpowers v6.2.0 writing-plans 契约）。
6. 呈现规划输入包并等待用户再次明确授权进入 `writing-plans`；获授权后才完成交接。

## 6. 规划输入包契约

- **影响范围**：受影响的模块、文件、配置、数据面、部署面。
- **技术约束**：锁定版本（TypeScript、Node.js、Crawlee、Playwright、Docker、Compose、WSL、PostgreSQL 等）、E 盘存储约束、合规与安全约束。
- **禁止事项**：来自上游 Skill 的排除项与用户批准边界。
- **验证标准**：验收方法（只读检查、测试、健康检查、金标比对）。
- **回滚要求**：修复失败的恢复路径与数据保全措施。
- **根因依据**：证据卡 ID、固定资料路径、上下文包条目、决策日志节号（可追溯）。
- **批准边界**：根因和方向的用户批准记录；进入 `writing-plans` 需用户再次明确授权。

每条结论必须明确区分：事实、证据、推断、待确认项。未确认猜测必须被拦截，不得进入规划输入包。

## 7. 证据卡主题分组

共享证据卡 `docs/superpowers/knowledge/evidence-cards/writing-plans-bridge.md` 从批次 2 固定资料筛选，按以下主题分组（实施时按实际固定资料筛选具体卡片）：

1. **交接准入与批准门**：Superpowers v6.2.0 `skills/writing-plans/SKILL.md`（Scope Check、Self-Review）；主决策日志 §47/§68。
2. **规划输入包内容**：Superpowers v6.2.0 `skills/writing-plans/SKILL.md`（Plan Document Header、Global Constraints、Task Structure）；主决策日志 §47。
3. **Superpowers writing-plans 接口契约**：Superpowers v6.2.0 `skills/writing-plans/SKILL.md`（Plan Document Header、No Placeholders、Task Right-Sizing、Execution Handoff、REQUIRED SUB-SKILL）。
4. **验收与防猜测**：Superpowers v6.2.0 `skills/writing-plans/plan-document-reviewer-prompt.md`（Completeness/Spec Alignment/Task Decomposition/Buildability 四维验收）；主决策日志 §47 验收重点。

## 8. 输出契约

规划输入包采用可落盘结构化记录＋简短人类可读摘要（主决策日志 §33 节），每条结论可追溯。固定字段：

- 影响范围。
- 技术约束。
- 禁止事项。
- 验证标准。
- 回滚要求。
- 根因依据（证据卡 ID、固定资料路径、上下文包条目、决策日志节号）。
- 批准边界（根因和方向的用户批准记录；进入 `writing-plans` 的用户再次明确授权状态）。

记录必须明确区分：事实、证据、推断、待确认项与用户批准状态。未确认猜测被拦截。

## 9. 交接契约

- 遵守主决策日志第 33-36 节：可落盘结构化记录＋简短人类摘要；双层存储（小型记录项目内保存、大型证据以内容哈希和相对路径引用）；敏感信息落盘前脱敏。
- 只有用户再次明确授权进入 `writing-plans` 时，才允许完成交接（主决策日志 §47）。
- 规划输入包作为 Superpowers `writing-plans` 的输入，不取代其规划职责；不编写实施计划文档。
- 不重新诊断、不选择修复方向、不修改代码（主决策日志 §47）。
- 根因依据完整保留（证据卡 ID、固定资料路径、上下文包条目、决策日志节号）；用户批准边界、验证要求和回滚要求完整保留（主决策日志 §47 验收重点）。
- 诊断结论明确区分事实、证据、推断、待确认项与用户批准状态。

## 10. 文件结构

```text
skills/crawler-writing-plans-bridge/
  SKILL.md                              # 精简触发＋门禁＋路由＋输出＋禁止项
  references/
    bridge-workflow.md                  # 核验流程、规划输入包契约、Superpowers 接口契约、证据卡映射
    output-contract.md                  # 输出契约、交接契约、修订保留
docs/superpowers/knowledge/
  evidence-cards/
    writing-plans-bridge.md             # 共享证据卡（从批次 2 固定资料筛选）
  skill-views/
    crawler-writing-plans-bridge.md     # Skill 19 独立知识视图（引用证据卡）
tests/skills/crawler-writing-plans-bridge/
  cases.md                              # 行为/安全案例（RED/GREEN 用）
  results.md                            # 红/绿行为评估记录
```

不引入 `validate.ps1`：规划衔接输出依赖动态项目证据与判断，机械结构校验价值有限，按最小充分原则（主决策日志 §107 先例）以行为案例验证为主。

## 11. 验证设计

### 11.1 结构验证

静态检查：
- Skill 包文件齐全（SKILL.md、bridge-workflow.md、output-contract.md）。
- 共享证据卡 `writing-plans-bridge.md` 与知识视图 `crawler-writing-plans-bridge.md` 存在；知识视图引用证据卡。
- 核验流程与规划输入包契约、Superpowers 接口契约在 references 中明确定义。
- 无 `TBD`、`TODO`、`FIXME` 占位符。
- 无肯定式运行指令；仅有负面安全声明与核验流程描述。
- 不含敏感信息示例（密钥、Cookie、认证头、代理凭据、数据库连接串凭据）。
- 非 Git 边界：项目根目录不是 Git worktree；不初始化 Git。

### 11.2 行为验证（RED/GREEN）

按 `superpowers:writing-skills` 方法运行固定行为案例，每个案例使用全新隔离的 Agent 上下文：

- 交接准入核验：只接收具有充分证据支持的根因和用户已批准的处理方向。
- 条件不齐拒绝：根因证据不足、批准状态缺失或必要证据不完整时拒绝进入规划，列出缺失项。
- 拦截未确认猜测：未确认猜测被拦截，不得进入规划输入包。
- 规划输入包契约：影响范围、技术约束、禁止事项、验证标准、回滚要求、根因依据、批准边界齐全。
- Superpowers 接口契约：遵循 Superpowers v6.2.0 writing-plans 契约（Plan Document Header、No Placeholders、Task Right-Sizing、Execution Handoff、REQUIRED SUB-SKILL）。
- 不越权：不重新诊断、不选择修复方向、不编写实施计划、不修改代码。
- 批准门：只有用户再次明确授权进入 `writing-plans` 时才完成交接；未授权前结论停留在规划输入包。
- 敏感信息脱敏：规划输入包不含密钥/Cookie/认证头/代理凭据/数据库连接串凭据/环境变量中的秘密。

### 11.3 验收标准（对应主决策日志 §47）

- 能够拦截未确认猜测。
- 完整保留根因依据、用户批准边界、验证要求和回滚要求。

达到上述标准即视为本 Skill 当前细节设计充分，不再扩展低优先级内部设计。

## 12. 阶段门

本规格经用户审阅批准后，才可调用 `superpowers:writing-plans` 生成 `crawler-writing-plans-bridge` 的单 Skill 实施计划。用户未明确批准前，不进入 `writing-plans`，不实施本 Skill。本 Skill 是第 19 个（最后一个）Skill，实施完成后 19 个 Skill 全部完成。

`E:\Stellaris` 当前不是 Git 仓库。本设计只要求把文档可靠保存在本地项目中，不得为了满足提交步骤擅自初始化 Git。
