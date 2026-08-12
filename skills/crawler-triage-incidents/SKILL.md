---
name: crawler-triage-incidents
description: Use when an Agent receives a crawler project fault or design issue and must check evidence sufficiency, classify the fault into internal defect / external limitation / unknown, route to the relevant domain and core-stack Skills, and emit a traceable triage verdict with confidence level, without fixing or proposing code changes.
---

# crawler-triage-incidents

这是一个 **Agent 故障分诊 Skill**，用于对爬虫项目故障现象做证据充分性检查、问题层次分类与路由。它**不是**诊断器、修复器、规划器、记忆服务、RAG、代码索引、上下文框架或爬虫运行组件。它不深入解决领域问题、不提出代码修改，也不生成 Superpowers `writing-plans`。

## 触发

收到爬虫项目故障现象需要分类与路由时触发。处理 Stellaris 问题时，先由 `stellaris-crawler-context` 注入项目事实与已批准约束，再交给本 Skill；通用或跨项目爬虫问题可以直接进入本 Skill。

## 必读输入（顺序固定）

1. 主决策日志：`docs/superpowers/brainstorming/2026-07-31-crawler-knowledge-skills-decision-log.md`。
2. 统一知识设计规格：`docs/superpowers/specs/2026-07-31-crawler-knowledge-skills-knowledge-design.md`。
3. 处理 Stellaris 问题时：`stellaris-crawler-context` 生成的项目上下文包路径。
4. 故障现象与现场可获得的证据（日志、配置、版本、代码位置、复现信息）。

详细分诊流程与分层证据清单见 `references/triage-workflow.md`；输出契约与交接见 `references/output-contract.md`。

## 非协商门禁

1. 识别为爬虫故障分诊任务（需要分类与路由的故障/设计问题）。
2. 处理 Stellaris 问题时，先读取 `stellaris-crawler-context` 项目上下文包路径（主决策日志 §38）。
3. 按对应故障类型的最小证据清单检查证据是否足够。
4. 证据不足：只输出证据缺口与最小补充/复现要求，不分类、不猜测根因。
5. 证据足够：区分内部缺陷、外部限制、未知问题（必要时实际加载领域/技术栈 Skill 仅用于分类），确定路由目标。
6. 输出可追溯的分诊结论（分类、证据缺口、路由目标、置信度、依据、交接对象）。
7. 绝不安装、构建、运行、扫描、代理、测试、执行示例或爬取外部目标；绝不保存密钥、Cookie、认证请求头。
8. 输出可追溯产物并更新本地进度总账后才继续。

## 工作流路由

- 分诊流程、分层最小证据清单、置信度规则：`references/triage-workflow.md`。
- 分诊结论输出契约、交接契约、修订保留：`references/output-contract.md`。

## 输出

- 分诊结论：分类（内部缺陷/外部限制/未知问题）、证据缺口、路由目标、置信程度（高/中/低/不确定）、依据、交接对象。

## 禁止

- 不深入解决领域问题、不提出代码修改、不生成 Superpowers `writing-plans`。
- 不替代领域 Skill 的完整诊断、修复方向或架构评审。
- 不把外部限制、未知问题或证据不足误判为已定位根因。
- 不把未确认猜测当作确定结论；不静默消解证据冲突。
- 不建立或运行 memory、RAG、代码索引、上下文框架或运行服务。
- 不修改爬虫代码、`manifest.md`、任何第三方仓库；不初始化 Git。
- 不把密钥、Cookie、认证请求头写入分诊记录，落盘前脱敏。
