---
name: crawler-review-architecture
description: Use when an Agent must review a crawler project architecture, data model, business rule, technical path, or acceptance standard, compare the current state against viable alternatives on traceable evidence, and emit a review report with a recommended direction for user approval before handoff to crawler-writing-plans-bridge, without modifying design or code.
---

# crawler-review-architecture

这是一个 **Agent 架构与方法论评审 Skill**，用于对爬虫项目设计进行公平、可追溯的方案比较，输出推荐方向供用户批准后交给 `crawler-writing-plans-bridge`。它**不是**诊断器、修复器、规划器、记忆服务、RAG、代码索引、上下文框架或爬虫运行组件。它不因新技术更新默认要求升级、不自行修改设计或代码、不静默改变项目设计。

## 触发

用户要求评审设计，或已经确认的问题涉及架构、数据模型、业务规则、技术路线或验收标准时触发。处理 Stellaris 问题时，先由 `stellaris-crawler-context` 注入项目事实与已批准约束，再交给本 Skill。

## 必读输入（顺序固定）

1. 主决策日志：`docs/superpowers/brainstorming/2026-07-31-crawler-knowledge-skills-decision-log.md`。
2. 统一知识设计规格：`docs/superpowers/specs/2026-07-31-crawler-knowledge-skills-knowledge-design.md`。
3. 处理 Stellaris 问题时：`stellaris-crawler-context` 生成的项目上下文包路径。
4. 评审目标与触发层次（架构/数据模型/业务规则/技术路线/验收标准之一）、已确认问题证据（分诊结论，适用时）、项目目标/约束/现状。

详细评审流程与比较规则见 `references/review-workflow.md`；输出契约与等待批准门见 `references/output-contract.md`。

## 非协商门禁

1. 识别为爬虫架构/方法论评审任务（需要对设计选项做公平比较）。
2. 处理 Stellaris 问题时，先读取 `stellaris-crawler-context` 项目上下文包路径（主决策日志 §38）。
3. 明确触发层次（架构/数据模型/业务规则/技术路线/验收标准之一），聚焦该层，不做全栈评审。
4. 确定"保持现状"作为基线，提出 1-3 个可行替代方案。
5. 按六个固定维度公平比较，每条依据可追溯；绝不因新技术更新默认升级。
6. 呈现评审报告并等待用户批准；批准前不交给 `crawler-writing-plans-bridge`。
7. 绝不安装、构建、运行、扫描、代理、测试、执行示例或爬取外部目标；绝不保存密钥、Cookie、认证请求头。
8. 输出可追溯产物并更新本地进度总账后才继续。

## 工作流路由

- 评审流程、六维比较规则、迁移风险评估：`references/review-workflow.md`。
- 评审报告输出契约、等待批准门、交接契约、修订保留：`references/output-contract.md`。

## 输出

- 评审报告：推荐方向＋保留备选＋未知项＋迁移风险＋依据＋交接对象；等待用户批准后交给 `crawler-writing-plans-bridge`。

## 禁止

- 不因新技术更新默认要求升级；是否升级以证据和项目约束为准。
- 不自行修改设计或代码；不静默改变项目设计。
- 不替代 `crawler-triage-incidents` 的分诊、领域 Skill 的完整诊断或 `crawler-writing-plans-bridge` 的规划。
- 不把未确认猜测当作确定结论；不静默消解证据冲突。
- 不建立或运行 memory、RAG、代码索引、上下文框架或运行服务。
- 不修改爬虫代码、`manifest.md`、任何第三方仓库；不初始化 Git。
- 不把密钥、Cookie、认证请求头写入评审记录，落盘前脱敏。
