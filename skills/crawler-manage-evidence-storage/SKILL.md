---
name: crawler-manage-evidence-storage
description: Use when an Agent must diagnose a crawler project's persistence and evidence-chain behavior (Schema, migration, transaction, connection pool, index, query, content-addressed files, hash verification, data lineage, evidence references), detect evidence-chain integrity issues (evidence loss/corruption, orphan files, wrong dedup, transaction inconsistency, migration failure, query performance), classify them against pinned-version evidence, and emit a traceable diagnosis with fix direction for user approval before handoff to crawler-writing-plans-bridge, defaulting to read-only queries and integrity scans without becoming a database service or storage runtime.
---

# crawler-manage-evidence-storage

这是一个 **Agent 持久化与证据链诊断、设计顾问 Skill**，用于对爬虫项目的持久化与证据链行为进行证据驱动的分类诊断，输出可追溯问题证据、根因或待验证假设、数据影响范围、修复方向和完整性回归建议。它**不是**项目中的数据库服务或文件存储运行组件；不是修复器、规划器、记忆服务、RAG、代码索引、上下文框架或爬虫运行组件。它默认只指导只读查询和完整性扫描；任何可能修改数据库或证据文件的动作仍须获得明确批准。

## 触发

用户要求检查持久化与证据链相关设计或故障，或已经确认的问题涉及证据丢失/损坏、孤立文件、错误去重、事务不一致、迁移失败或查询性能时触发。处理 Stellaris 问题时，先由 `stellaris-crawler-context` 注入项目事实与已批准约束，再交给本 Skill。

## 必读输入（顺序固定）

1. 主决策日志：`docs/superpowers/brainstorming/2026-07-31-crawler-knowledge-skills-decision-log.md`。
2. 统一知识设计规格：`docs/superpowers/specs/2026-07-31-crawler-knowledge-skills-knowledge-design.md`。
3. 处理 Stellaris 问题时：`stellaris-crawler-context` 生成的项目上下文包路径。
4. 诊断聚焦点与已确认问题证据（分诊结论，适用时）、项目目标/约束/现状、存储代码/配置/依赖版本/数据库结构/查询计划/文件元数据/完整性检查结果。

详细诊断流程与分类规则见 `references/diagnostic-workflow.md`；输出契约与交接见 `references/output-contract.md`；知识视图见 `docs/superpowers/knowledge/skill-views/crawler-manage-evidence-storage.md`；证据卡见 `docs/superpowers/knowledge/evidence-cards/evidence-storage.md`。

## 非协商门禁

1. 识别为持久化/证据链诊断任务（需要基于证据的分类）。
2. 处理 Stellaris 问题时，先读取 `stellaris-crawler-context` 项目上下文包路径（主决策日志 §38）。
3. 明确诊断聚焦点（Schema / 迁移 / 事务 / 连接池 / 索引·查询 / 内容寻址文件·哈希 / 数据血缘·证据引用 / 完整性扫描），聚焦该点，不做无边界全栈诊断。
4. 按匹配版本证据卡分类；绝不因证据不足编造根因；绝不用默认值或猜测掩盖证据链完整性问题；绝不破坏或静默改写原始证据。
5. 外部条件（数据库/存储服务不可用/资源环境受限）只能给合规降级/等待/终止结论；绝不伪装成已修复。
6. 呈现诊断记录并等待用户批准；批准前不交给 `crawler-writing-plans-bridge`。
7. 绝不安装、构建、运行、扫描、代理、测试、执行示例或爬取外部目标；绝不保存密钥、Cookie、认证请求头；绝不经明确批准修改数据库或证据文件。
8. 输出可追溯产物并更新本地进度总账后才继续。

## 工作流路由

- 诊断流程、问题分类规则、证据卡映射：`references/diagnostic-workflow.md`。
- 诊断记录输出契约、交接契约、修订保留：`references/output-contract.md`。
- 知识视图与证据卡：`docs/superpowers/knowledge/skill-views/crawler-manage-evidence-storage.md`、`docs/superpowers/knowledge/evidence-cards/evidence-storage.md`。

## 输出

- 诊断记录：问题证据＋分类＋根因或待验证假设＋数据影响范围＋修复方向＋完整性回归建议；等待用户批准后交给 `crawler-writing-plans-bridge`。

## 禁止

- 不建设数据库服务或文件存储运行组件。
- 默认只指导只读查询和完整性扫描；任何可能修改数据库或证据文件的动作须获得明确批准。
- 不破坏原始证据；不以修复为名静默改写证据。
- PostgreSQL 具体驱动/SQL/配置/版本问题交给 `crawler-use-postgresql`。
- 不绕过登录、验证码、访问控制或 WAF。
- 不把外部条件或未知项伪装成已修复。
- 不生成 `writing-plans`、不提出未经批准的代码修改。
- 不修改爬虫代码、`manifest.md`、任何第三方仓库；不初始化 Git。
- 不把密钥、Cookie、认证请求头写入诊断记录，落盘前脱敏。
