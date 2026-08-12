# crawler-use-postgresql 知识视图

> 本视图是 `crawler-use-postgresql` Skill 的独立知识视图，只保留与"PostgreSQL 专项实现诊断、修复顾问"职责相关的知识。来源身份、版本与许可证事实由共享证据层统一维护，本视图通过稳定证据卡 ID 引用，不复制原始来源元数据。

## 定位、触发与排除项

- **定位**：面向 Agent 的 PostgreSQL 专项实现诊断、修复顾问；依托项目锁定 PostgreSQL、驱动和迁移工具版本对应的官方资料、发布说明、故障案例和源码，帮助 Agent 检查 Schema、迁移、SQL、连接池、事务、锁、索引、查询计划和数据库日志，发现连接泄漏、事务错误、锁等待或死锁、索引失效、慢查询、迁移不一致和版本兼容问题。
- **不是**：数据库服务、连接池或迁移运行组件。
- **触发**：用户要求检查 PostgreSQL 专项实现相关设计或故障；已确认问题涉及 Schema、迁移、SQL、连接池、事务、锁、索引、查询计划或数据库日志。
- **排除**：数据修改、Schema 变更和修复迁移等动作必须经过规划并获得用户明确批准；不重复跨存储证据链方法论，也不自行改变业务数据模型；不越批准边界/不跳过 `crawler-writing-plans-bridge`；不生成 `writing-plans`。

## 最低证据输入

- 项目上下文（处理 Stellaris 问题时为 `stellaris-crawler-context` 项目上下文包路径）。
- 已确认根因与方向（`crawler-triage-incidents` 分诊结论，适用时）。
- 相关 PostgreSQL 代码、配置、版本、数据库结构和运行证据。
- 固定版本资料（批次 5：postgres/postgres、docker-library/postgres）。

## 知识主题与证据卡映射

### SQL 与驱动/连接

- 判断 SQL 语法/语义、libpq 连接、查询执行是否符合锁定版本行为；SQL 使用错误、连接失败、查询执行错误是常见问题。
- 证据卡：[[PG-SQL-001]]（SQL 语义）、[[PG-SQL-002]]（libpq 连接语义）、[[PG-SQL-003]]（查询执行）。
- 依据固定版本：postgres `src/backend/parser/`、`src/backend/executor/`；`src/interfaces/libpq/fe-connect.c`、`fe-exec.c`。

### 连接池与连接管理

- 判断连接生命周期、postmaster 连接处理是否符合锁定版本行为；连接泄漏、连接耗尽是常见问题。
- 证据卡：[[PG-POOL-001]]（连接生命周期）、[[PG-POOL-002]]（postmaster 连接处理）。
- 依据固定版本：postgres `src/interfaces/libpq/fe-connect.c`；`src/backend/postmaster/postmaster.c`。

### 事务与锁

- 判断事务语义、锁语义、死锁检测是否符合锁定版本行为；事务错误、锁等待、死锁是常见问题。
- 证据卡：[[PG-TXN-001]]（事务语义）、[[PG-LOCK-001]]（锁语义）、[[PG-LOCK-002]]（死锁检测）。
- 依据固定版本：postgres `src/backend/access/transam/xact.c`；`src/backend/storage/lmgr/lock.c`、`lwlock.c`、`deadlock.c`。

### 索引与查询性能

- 判断索引语义、索引管理、查询计划是否符合锁定版本行为；索引失效、慢查询、查询计划错误是常见问题。
- 证据卡：[[PG-INDEX-001]]（索引语义）、[[PG-INDEX-002]]（索引管理）、[[PG-PLAN-001]]（查询计划/优化器语义）。
- 依据固定版本：postgres `src/backend/access/index/`；`src/backend/commands/indexcmds.c`；`src/backend/optimizer/plan/`。

### 迁移与版本兼容/数据库日志

- 判断迁移/备份语义、版本兼容与配置、数据库日志与运行时是否符合锁定版本行为；迁移不一致、版本兼容、集成错误是常见问题。
- 证据卡：[[PG-MIG-001]]（迁移/备份语义）、[[PG-VER-001]]（版本兼容与配置语义）、[[PG-LOG-001]]（数据库日志/运行时语义）。
- 依据固定版本：postgres `src/bin/pg_dump/`；`doc/src/sgml/config.sgml`、`runtime.sgml`；docker-library-postgres `docker-entrypoint.sh`、`18/`。

## 实现转换规则

- 将 `crawler-manage-evidence-storage` 已确认的持久化与证据链方向转换为适合当前 PostgreSQL 环境的具体实现建议。
- 引用锁定版本（postgres/postgres `REL_18_4`、docker-library-postgres `master` 固定快照）的 SQL 与配置语义；不默认采用最新 Release 或历史草案版本。
- 默认只指导只读诊断和查询计划分析；数据修改、Schema 变更和修复迁移等动作必须经过规划并获得用户明确批准。
- 不重复跨存储证据链方法论，也不自行改变业务数据模型。
- 准确区分项目数据库配置问题、数据库服务环境问题与应用代码问题。

## 版本化判断规则

- 每条判断依据必须追溯到固定版本资料（ref＋Commit）、证据卡、上下文包条目或决策日志节号；只给仓库首页或没有版本的引用不满足要求。
- 明确区分事实、证据、综合推断与未知项；综合推断必须显式标记"推断"，不得伪装成资料中的确定结论。
- 不得因新技术更新默认要求升级；是否升级以证据和项目约束为准。
- 案例证据与工程证据不得单独升格为跨项目通用规范或确定根因。

## 输出、交接与禁止越权

- **输出**：可追溯问题证据、根因或待验证假设、影响范围、修复方向（PostgreSQL 实现建议）、测试建议。
- **交接**：将 `crawler-manage-evidence-storage` 已确认方向转换为 PostgreSQL 实现建议，不越过批准边界/不跳过 `crawler-writing-plans-bridge`；获准修复方向→`crawler-writing-plans-bridge`。
- **禁止越权**：不执行未经批准的数据修改/Schema 变更/修复迁移、不自行改变业务数据模型、不把项目配置问题误判为应用代码/环境问题、不重复跨存储证据链方法论、不生成 `writing-plans`、不初始化 Git、不记录敏感信息原件。

## 视图自检

- 全部证据卡 ID（PG-SQL-*、PG-POOL-*、PG-TXN-*、PG-LOCK-*、PG-INDEX-*、PG-PLAN-*、PG-MIG-*、PG-VER-*、PG-LOG-*）在 `postgresql.md` 中存在且被本视图引用。
- 无未标注的推断；每条判断可追溯到证据卡或固定资料。
- 未复制相邻 Skill（`crawler-manage-evidence-storage`、`crawler-run-docker`）的职责。
