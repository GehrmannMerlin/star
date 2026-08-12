---
name: crawler-writing-plans-bridge
description: Use when an Agent must bridge a crawler project's approved fix direction into Superpowers writing-plans planning — verifying root cause, approval status, and required evidence completeness (refusing to enter planning when incomplete), organizing impact scope / technical constraints / prohibitions / verification criteria / rollback requirements, and outputting a planning-input package for Superpowers writing-plans (v6.2.0 contract, obra/superpowers 3dcbd5c4) — completing handoff only after the user again explicitly authorizes entering writing-plans, without re-diagnosing, choosing a fix direction, writing an implementation plan, or modifying code.
---

# crawler-writing-plans-bridge

这是一个 **Agent 规划衔接 Skill**，用于把爬虫项目中已获批准的修复方向衔接进 Superpowers `writing-plans` 规划。它只接收具有充分证据支持的根因和用户已经批准的处理方向，核验根因、批准状态和必要证据是否齐全（条件不齐全时拒绝进入规划），整理影响范围、技术约束、禁止事项、验证标准和回滚要求，输出一份供 Superpowers `writing-plans` 使用的规划输入包；只有用户再次明确授权进入 `writing-plans` 时，才允许完成交接。它**不是**诊断 Skill、修复方向选择器、实施计划编写器、记忆服务、RAG、代码索引、上下文框架或爬虫运行组件。它引用锁定版本（obra/superpowers v6.2.0）的 writing-plans 契约，不重新诊断、不选择修复方向、不编写实施计划，也不修改代码。

## 触发

用户要求把已获批准的修复方向/评审结论衔接进 Superpowers `writing-plans` 规划，或 Skill 3-18 已输出获准修复方向并请求交接时触发。处理 Stellaris 问题时，先由 `stellaris-crawler-context` 注入项目事实与已批准约束，再交给本 Skill。

## 必读输入（顺序固定）

1. 主决策日志：`docs/superpowers/brainstorming/2026-07-31-crawler-knowledge-skills-decision-log.md`。
2. 统一知识设计规格：`docs/superpowers/specs/2026-07-31-crawler-knowledge-skills-knowledge-design.md`。
3. 处理 Stellaris 问题时：`stellaris-crawler-context` 生成的项目上下文包路径。
4. 已确认根因与方向（Skill 3-18 分诊/评审/诊断的获准结论）、用户批准状态、必要证据（固定版本资料/证据卡/上下文包条目/决策日志节号）。

详细核验流程与规划输入包契约见 `references/bridge-workflow.md`；输出契约与交接见 `references/output-contract.md`；知识视图见 `docs/superpowers/knowledge/skill-views/crawler-writing-plans-bridge.md`；证据卡见 `docs/superpowers/knowledge/evidence-cards/writing-plans-bridge.md`。

## 非协商门禁

1. 识别为规划衔接任务（需要基于根因/批准/证据的核验）。
2. 处理 Stellaris 问题时，先读取 `stellaris-crawler-context` 项目上下文包路径（主决策日志 §38）。
3. 核验根因、批准状态和必要证据是否齐全；条件不齐全时拒绝进入规划并列出缺失项。
4. 按匹配版本证据卡核验；引用锁定版本（obra/superpowers v6.2.0）的 writing-plans 契约；绝不因证据不足编造根因；**绝不把未确认猜测写入规划输入包**。
5. 外部条件（数据库服务不可用/外部依赖受限）只能给合规降级/等待/终止结论；绝不伪装成已修复。
6. 呈现规划输入包并等待用户再次明确授权进入 `writing-plans`；授权前不完成交接。
7. **绝不重新诊断、不选择修复方向、不编写实施计划、不修改代码**；绝不执行数据修改、Schema 变更、修复迁移等破坏性操作（必须经规划＋用户明确批准）；绝不启动 PostgreSQL 服务或运行数据修改；绝不保存密钥、Cookie、认证请求头、代理凭据、数据库连接串凭据。
8. 输出可追溯产物并更新本地进度总账后才继续。

## 工作流路由

- 核验流程、规划输入包契约、Superpowers 接口契约、证据卡映射：`references/bridge-workflow.md`。
- 规划输入包输出契约、交接契约、修订保留：`references/output-contract.md`。
- 知识视图与证据卡：`docs/superpowers/knowledge/skill-views/crawler-writing-plans-bridge.md`、`docs/superpowers/knowledge/evidence-cards/writing-plans-bridge.md`。

## 输出

- 规划输入包：影响范围＋技术约束＋禁止事项＋验证标准＋回滚要求＋根因依据＋批准边界；用户再次明确授权后交给 Superpowers `writing-plans`。

## 禁止

- 不重新诊断、不选择修复方向、不编写实施计划、不修改代码。
- 不把未确认猜测写入规划输入包。
- 不越过用户批准边界：根因未获批准或用户未再次明确授权进入 `writing-plans` 时，不完成交接。
- 不采用其他规划框架覆盖 Superpowers v6.2.0 契约或用户批准门。
- 不引用审查时最新 Release 或历史草案版本；实现建议引用锁定版本（obra/superpowers v6.2.0）。
- 不安装、构建或运行未经批准的项目或第三方代码。
- 不执行数据修改、Schema 变更、修复迁移等破坏性操作（必须经规划＋用户明确批准）；不启动 PostgreSQL 服务或运行数据修改。
- 不攻击外部网站、不绕过访问控制、不发起对目标站点的无授权请求。
- 不把未经审查的第三方示例代码用于项目。
- 不生成 `writing-plans` 本身、不编写实施计划文档。
- 不修改爬虫代码、`manifest.md`、任何第三方仓库；不初始化 Git。
- 不把密钥、Cookie、认证请求头、代理凭据、环境变量中的秘密、数据库连接串凭据写入规划输入包记录，落盘前脱敏。
