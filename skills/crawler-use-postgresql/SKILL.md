---
name: crawler-use-postgresql
description: Use when an Agent must diagnose a crawler project's PostgreSQL implementation behavior (Schema, migrations, SQL, connection pool, transactions, locks, indexes, query plans, database logs), detect connection leaks, transaction errors, lock waits/deadlocks, index failures, slow queries, migration inconsistencies, and version-compatibility problems against locked-version evidence (postgres/postgres REL_18_4, docker-library/postgres master snapshot), convert crawler-manage-evidence-storage confirmed persistence/evidence-chain directions into current-environment implementation suggestions, and emit a traceable diagnosis with fix direction for user approval before handoff to crawler-writing-plans-bridge, without data modification, Schema changes, or fix migrations unless separately explicitly approved, and without repeating cross-storage evidence-chain methodology or changing the business data model.
---

# crawler-use-postgresql

这是一个 **Agent PostgreSQL 专项实现诊断、修复顾问 Skill**，用于对爬虫项目的 PostgreSQL 实现行为进行证据驱动的分类诊断，输出可追溯问题证据、根因或待验证假设、影响范围、修复方向（PostgreSQL 实现建议）和测试建议。它**不是**数据库服务、连接池或迁移运行组件；不是修复器、规划器、记忆服务、RAG、代码索引、上下文框架或爬虫运行组件。它引用锁定版本（postgres/postgres `REL_18_4`、docker-library/postgres `master` 固定快照）的 SQL 与配置语义，将 `crawler-manage-evidence-storage` 已确认的持久化与证据链方向转换为当前环境实现建议，并准确区分项目数据库配置问题、数据库服务环境问题与应用代码问题。

## 触发

用户要求检查 PostgreSQL 专项实现相关设计或故障，或已经确认的问题涉及 Schema、迁移、SQL、连接池、事务、锁、索引、查询计划或数据库日志时触发。处理 Stellaris 问题时，先由 `stellaris-crawler-context` 注入项目事实与已批准约束，再交给本 Skill。

## 必读输入（顺序固定）

1. 主决策日志：`docs/superpowers/brainstorming/2026-07-31-crawler-knowledge-skills-decision-log.md`。
2. 统一知识设计规格：`docs/superpowers/specs/2026-07-31-crawler-knowledge-skills-knowledge-design.md`。
3. 处理 Stellaris 问题时：`stellaris-crawler-context` 生成的项目上下文包路径。
4. 已确认根因与方向（`crawler-triage-incidents` 分诊结论，适用时）、项目目标/约束/现状、相关 PostgreSQL 代码/配置/版本/数据库结构/运行证据。

详细诊断流程与实现转换规则见 `references/postgresql-workflow.md`；输出契约与交接见 `references/output-contract.md`；知识视图见 `docs/superpowers/knowledge/skill-views/crawler-use-postgresql.md`；证据卡见 `docs/superpowers/knowledge/evidence-cards/postgresql.md`。

## 非协商门禁

1. 识别为 PostgreSQL 实现诊断任务（需要基于证据的分类）。
2. 处理 Stellaris 问题时，先读取 `stellaris-crawler-context` 项目上下文包路径（主决策日志 §38）。
3. 明确诊断聚焦点（Schema 与迁移 / SQL 与查询计划 / 连接池与连接管理 / 事务与锁 / 索引与查询性能 / 数据库日志与版本兼容），聚焦该点，不做无边界全栈诊断。
4. 按匹配版本证据卡分类；引用锁定版本（postgres/postgres `REL_18_4`、docker-library/postgres `master` 固定快照）的 SQL 与配置语义；绝不因证据不足编造根因；**绝不在根因未证实前提出数据修改、Schema 变更或修复迁移**。
5. 外部条件（数据库服务不可用/外部依赖受限）只能给合规降级/等待/终止结论；绝不伪装成已修复。
6. 呈现诊断记录并等待用户批准；批准前不交给 `crawler-writing-plans-bridge`。
7. **绝不执行数据修改、Schema 变更或修复迁移（必须经过规划并获得用户明确批准）；绝不重复跨存储证据链方法论或自行改变业务数据模型**；绝不生成 `writing-plans` 或越过批准边界；绝不安装、构建或运行未经批准的项目或第三方代码；绝不启动 PostgreSQL 服务或执行数据修改；绝不保存密钥、Cookie、认证请求头、代理凭据、数据库连接串凭据。
8. 输出可追溯产物并更新本地进度总账后才继续。

## 工作流路由

- 诊断流程、问题分类规则、实现转换规则、证据卡映射：`references/postgresql-workflow.md`。
- 诊断记录输出契约、交接契约、修订保留：`references/output-contract.md`。
- 知识视图与证据卡：`docs/superpowers/knowledge/skill-views/crawler-use-postgresql.md`、`docs/superpowers/knowledge/evidence-cards/postgresql.md`。

## 输出

- 诊断记录：问题证据＋分类＋根因或待验证假设＋影响范围＋修复方向＋测试建议；等待用户批准后交给 `crawler-writing-plans-bridge`。

## 禁止

- 不替代项目数据库服务、连接池或迁移运行组件。
- 不执行数据修改、Schema 变更和修复迁移（必须经过规划并获得用户明确批准）；不自行改变业务数据模型。
- 不重复跨存储证据链方法论；跨存储一致性问题路由到 `crawler-manage-evidence-storage`。
- 不把项目数据库配置问题误判为应用代码问题或数据库服务环境问题。
- 不把外部条件或未知项伪装成已修复。
- 不引用审查时最新 Release 或历史草案版本；实现建议引用锁定版本（postgres/postgres `REL_18_4`、docker-library/postgres `master` 固定快照）。
- 不越过用户批准边界、不跳过 `crawler-writing-plans-bridge`。
- 不安装、构建或运行未经批准的项目或第三方代码；不启动 PostgreSQL 服务、不执行数据修改或 Schema 变更。
- 不攻击外部网站、不绕过访问控制、不发起对目标站点的无授权请求。
- 不把未经审查的第三方示例代码用于项目。
- 不生成 `writing-plans`、不提出未经批准的代码修改。
- 不修改爬虫代码、`manifest.md`、任何第三方仓库；不初始化 Git。
- 不把密钥、Cookie、认证请求头、代理凭据、环境变量中的秘密、数据库连接串凭据写入诊断记录，落盘前脱敏。
