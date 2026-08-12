---
name: stellaris-crawler-context
description: Use when an Agent is handling a Stellaris project fault or design question and must first inject live-verified project facts and approved requirements, and emit a traceable project-context package for crawler-triage-incidents, without diagnosing root cause or proposing fixes.
---

# stellaris-crawler-context

这是一个 **Stellaris 项目专用层的 Agent 项目上下文 Skill**。它为 Stellaris 问题现场只读核验当前项目事实，结合主决策日志中已批准的要求，固定输出一份可追溯的项目上下文包交给 `crawler-triage-incidents`。它**不是**诊断器、修复器、规划器、记忆服务、RAG、代码索引、上下文框架或爬虫运行组件。

## 触发

处理 Stellaris 项目的故障或设计问题、且需要项目上下文时触发。通用或跨项目爬虫问题直接进入 `crawler-triage-incidents`，不强制加载本 Skill。

## 必读输入（顺序固定）

1. 主决策日志：`docs/superpowers/brainstorming/2026-07-31-crawler-knowledge-skills-decision-log.md`（动态提取已批准要求）。
2. 统一知识设计规格：`docs/superpowers/specs/2026-07-31-crawler-knowledge-skills-knowledge-design.md`。
3. 第 6 批资料审查：`docs/superpowers/source-reviews/2026-07-31-batch-06-stellaris-project-context-review.md`。
4. 现场只读核验结果（每次重新核验，不使用旧快照）。

详细核验流程、字段契约与模板见 `references/project-context.md`；交接契约、标签规则与修订保留见 `references/handoff-contract.md`。

## 非协商门禁

1. 识别为 Stellaris 项目上下文任务（需要项目上下文的故障或设计问题）。
2. 先读主决策日志与统一规格，动态提取已批准要求；不另建独立批准清单。
3. 现场只读核验当前项目事实；快照/缓存只用于定位，绝不替代现场核验。
4. 分离五类内容（当前代码事实／已批准要求／历史设计草案／冲突与未知项／建议分诊重点）并各按固定字段输出。
5. 上下文包落盘到 `docs/superpowers/knowledge/context-packages/`，修订追加保留，不静默覆盖。
6. 主交接给 `crawler-triage-incidents`；不提出根因、修复方案或 `writing-plans` 输入。
7. 绝不安装、构建、运行、扫描、代理、测试、执行示例或爬取外部目标；绝不保存密钥、Cookie、认证请求头。
8. 输出可追溯产物并更新本地进度总账后才继续。

## 工作流路由

- 动态核验流程、五类×固定字段契约、上下文包模板：`references/project-context.md`。
- 交接契约、标签规则、修订保留：`references/handoff-contract.md`。

## 输出

- 一份项目上下文包：`docs/superpowers/knowledge/context-packages/YYYY-MM-DD-<主题>-context-package.md`。
- 上下文包含六节：当前代码事实、已批准要求、历史设计草案、冲突与未知项、建议分诊重点、修订记录。

## 禁止

- 不诊断根因、不提出修复方案、不生成 Superpowers `writing-plans`。
- 不替代 `crawler-triage-incidents`、领域诊断或架构评审。
- 不建立或运行 memory、RAG、代码索引、上下文框架或运行服务。
- 不把历史草案或未批准建议升格为硬约束；冲突不静默消解。
- 不修改爬虫代码、`manifest.md`、任何第三方仓库；不初始化 Git。
- 不把密钥、Cookie、认证请求头写入上下文包，落盘前脱敏。
