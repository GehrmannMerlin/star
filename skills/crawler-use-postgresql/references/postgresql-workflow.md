# `crawler-use-postgresql` 诊断流程与实现转换规则

> 本文件定义本 Skill 的诊断流程、问题分类规则、实现转换规则与证据卡映射。判断依据与边界以主决策日志与已批准设计规格为准。

## 诊断流程

1. 读取项目上下文、目标、约束与已确认根因。处理 Stellaris 问题时，先读取 `stellaris-crawler-context` 生成的项目上下文包路径。
2. 确定诊断聚焦点（Schema 与迁移 / SQL 与查询计划 / 连接池与连接管理 / 事务与锁 / 索引与查询性能 / 数据库日志与版本兼容），聚焦该点，不做无边界全栈诊断。
3. 检查相关 PostgreSQL 代码、配置、版本、数据库结构和运行证据，定位具体证据位置。
4. 引用匹配版本的证据卡（`postgresql.md`）比对项目行为与锁定版本规范/实现/工程证据。
5. 分类：代码缺陷 / 配置错误 / 版本兼容 / 设计不足 / 外部条件 / 未知项。
6. 证据不足时只提出最小补充取证（只读查询、查询计划分析、隔离复现）；根因未证实前不提出代码修改或 Schema 变更。
7. 将 `crawler-manage-evidence-storage` 已确认的方向转换为适合当前 PostgreSQL 环境的具体实现建议。
8. 输出可追溯问题证据、根因或待验证假设、影响范围、修复方向、测试建议。
9. 获准的修复方向交给 `crawler-writing-plans-bridge`。

## 问题分类规则

- **代码缺陷**：PostgreSQL 相关代码未按锁定版本行为处理（如连接泄漏、事务错误、SQL 使用错误）。
- **配置错误**：PostgreSQL/驱动/连接池配置与锁定版本行为不符（如连接池参数、Schema、索引配置错误）。
- **版本兼容**：PostgreSQL/驱动/迁移工具版本与配置行为不匹配（如引用已变更的 SQL/API/配置项）。
- **设计不足**：缺乏 Schema 规划、索引设计、连接池管理、迁移管理等设计层面缺失。
- **外部条件**：数据库服务不可用、外部依赖受限等——只能给合规降级/等待/终止结论，不得伪装成已修复（主决策日志 §12/§63）。
- **未知项**：证据不足或冲突，保持候选假设，显式标记，不判定为确定根因。

每条结论必须明确区分：事实、证据、综合推断、待确认项。综合推断必须显式标记为"推断"，不得伪装成资料中的确定结论（主决策日志 §14）。

置信度使用固定枚举：高（证据充分且指向唯一分类）、中（证据充分但多个分类可能）、低（证据不足或冲突，仅候选假设）、不确定（无法判断）。

## 实现转换规则

- 将 `crawler-manage-evidence-storage` 已确认的方向转换为适合当前 PostgreSQL 环境的具体实现建议。
- 引用锁定版本（postgres/postgres `REL_18_4`、docker-library/postgres `master` 固定快照）的 SQL 与配置语义；不默认采用审查时最新 Release 或历史草案版本（主决策日志 §71/§75）。
- 默认只指导只读诊断和查询计划分析；数据修改、Schema 变更和修复迁移等动作必须经过规划并获得用户明确批准（主决策日志 §63）。
- 不重复跨存储证据链方法论，也不自行改变业务数据模型；跨存储一致性、证据链完整性交给 `crawler-manage-evidence-storage`。
- 识别"适用版本准确、SQL 与事务判断正确"是验收重点；准确区分项目数据库配置问题、数据库服务环境问题与应用代码问题。

## 证据卡映射

共享证据卡：`docs/superpowers/knowledge/evidence-cards/postgresql.md`；知识视图：`docs/superpowers/knowledge/skill-views/crawler-use-postgresql.md`。

| 诊断聚焦点 | 证据卡 | 固定资料路径 |
|---|---|---|
| SQL 与驱动/连接 | PG-SQL-001、PG-SQL-002、PG-SQL-003 | postgres `src/backend/parser/`、`src/backend/executor/`；`src/interfaces/libpq/fe-connect.c`、`fe-exec.c` |
| 连接池与连接管理 | PG-POOL-001、PG-POOL-002 | postgres `src/interfaces/libpq/fe-connect.c`；`src/backend/postmaster/postmaster.c` |
| 事务与锁 | PG-TXN-001、PG-LOCK-001、PG-LOCK-002 | postgres `src/backend/access/transam/xact.c`；`src/backend/storage/lmgr/lock.c`、`lwlock.c`、`deadlock.c` |
| 索引与查询性能 | PG-INDEX-001、PG-INDEX-002、PG-PLAN-001 | postgres `src/backend/access/index/`；`src/backend/commands/indexcmds.c`；`src/backend/optimizer/plan/` |
| 迁移与版本兼容/数据库日志 | PG-MIG-001、PG-VER-001、PG-LOG-001 | postgres `src/bin/pg_dump/`；`doc/src/sgml/config.sgml`、`runtime.sgml`；docker-library-postgres `docker-entrypoint.sh`、`18/` |

每条依据必须可追溯：从诊断记录追到固定版本资料、证据卡、上下文包条目或决策日志节号。只给仓库首页、模糊文件夹或没有版本的引用不满足要求。

## 只读诊断边界

- 诊断默认只指导只读静态审查、配置审查、只读查询、查询计划分析和锁定版本资料比对。
- 数据修改、Schema 变更和修复迁移等动作必须经过规划并获得用户明确批准；不自行改变业务数据模型。
- 任何只读查询、查询计划分析或隔离复现动作须获得明确批准。
- 不安装、构建或运行未经批准的项目或第三方代码；不启动 PostgreSQL 服务、不执行数据修改或 Schema 变更。
- 不替代项目数据库服务、连接池或迁移运行组件；不发起对目标站点的无授权请求；不绕过访问控制。

## 证据不足与冲突

- 证据不足时不得把结论判定为确定根因；保留候选状态并标记未知项。
- 现场证据、项目上下文、已批准要求冲突时并列报告，不静默覆盖任一来源。
- 未解决的声明标记为不确定（非确定性），不得伪装成确定结论。
- 固定版本证据卡与既有诊断记录不得被静默改写；更新只通过新增修订进行。
- 根因未证实前不提出数据修改、Schema 变更或修复迁移；不把项目数据库配置问题误判为应用代码问题或数据库服务环境问题。
- 外部条件（数据库服务不可用/外部依赖受限）只能给合规降级/等待/终止结论，不得伪装成已修复。
- 不得因新技术更新默认要求升级；是否升级以证据和项目约束为准。
