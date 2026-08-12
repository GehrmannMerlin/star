# PostgreSQL 专项实现证据卡（共享证据层）

> 本文件是共享可追溯证据层中与 PostgreSQL 专项实现诊断相关的证据卡集合。每张卡表达一条可验证知识声明，绑定固定版本资料、原始位置与适用边界。
>
> 来源：批次 5 固定源码快照（postgres/postgres、docker-library/postgres），全部以 `third-party/crawler-knowledge-sources/manifest.md` 记录的 ref 与 Commit 为唯一版本基线。
>
> 证据等级：规范证据（官方规范/文档/Release）＞实现证据（同版本官方源码/测试）＞工程证据（官方运行指南/手册）＞案例证据（事故资料，只用于启发）。
>
> 维护规则：本文件由资料治理 Skill 按既定准入、许可证复核与版本固定流程维护；不得静默改写已固定证据卡，更新只通过新增修订进行。

## 来源身份与版本基线

| 仓库 | 权威 ref | Commit | 本地路径 |
|---|---|---|---|
| postgres/postgres | `REL_18_4` | `f5cc81719e6da4cbdb1f797c48b693e91018153a` | `third-party/crawler-knowledge-sources/repos/batch-05-core-stack/postgres` |
| docker-library/postgres | `master`（固定快照） | `62a714f93cc32220de46fd12235c9d509e3b1ad6` | `third-party/crawler-knowledge-sources/repos/batch-05-core-stack/docker-library-postgres` |

---

## SQL 与驱动/连接

### PG-SQL-001 SQL 语义

- **知识声明**：PostgreSQL 的 SQL 语义由解析器与执行器（`parser/`、`executor/`）实现；SQL 语句按语法与语义规则解析并执行，错误使用导致查询失败或结果错误。
- **证据类型/等级**：实现证据（同版本官方源码）。
- **来源身份**：postgres/postgres（`REL_18_4`）。
- **版本/ref/Commit**：`REL_18_4`；`f5cc81719e6da4cbdb1f797c48b693e91018153a`。
- **原始位置**：`src/backend/parser/`、`src/backend/executor/`。
- **支持说明**：解析器与执行器实现 SQL 语法与语义；SQL 使用错误导致失败。
- **适用条件**：诊断 SQL 语法/语义错误、查询失败、结果错误。
- **限制**：SQL 语义以 postgres `REL_18_4` 为准。
- **关联 Skill**：crawler-use-postgresql。
- **状态**：有效。

### PG-SQL-002 libpq 连接语义

- **知识声明**：libpq（`src/interfaces/libpq/fe-connect.c`）实现客户端与 PostgreSQL 服务器的连接建立；连接参数错误、认证失败导致连接失败。
- **证据类型/等级**：实现证据（同版本官方源码）。
- **来源身份**：postgres/postgres（`REL_18_4`）。
- **版本/ref/Commit**：`REL_18_4`；`f5cc81719e6da4cbdb1f797c48b693e91018153a`。
- **原始位置**：`src/interfaces/libpq/fe-connect.c`。
- **支持说明**：libpq 实现连接建立与参数处理；连接失败路径与错误处理。
- **适用条件**：诊断连接失败、连接参数错误、认证问题。
- **限制**：连接语义以 postgres `REL_18_4` 为准。
- **关联 Skill**：crawler-use-postgresql。
- **状态**：有效。

### PG-SQL-003 查询执行

- **知识声明**：libpq（`fe-exec.c`）实现查询发送与结果接收；查询执行错误、结果处理错误导致数据不一致或程序异常。
- **证据类型/等级**：实现证据（同版本官方源码）。
- **来源身份**：postgres/postgres（`REL_18_4`）。
- **版本/ref/Commit**：`REL_18_4`；`f5cc81719e6da4cbdb1f797c48b693e91018153a`。
- **原始位置**：`src/interfaces/libpq/fe-exec.c`。
- **支持说明**：libpq 实现查询执行与结果处理；错误路径影响程序行为。
- **适用条件**：诊断查询执行错误、结果处理错误、SQL 语句执行失败。
- **限制**：查询执行语义以 postgres `REL_18_4` 为准。
- **关联 Skill**：crawler-use-postgresql。
- **状态**：有效。

---

## 连接池与连接管理

### PG-POOL-001 连接生命周期

- **知识声明**：libpq 连接具有建立、使用、关闭生命周期；连接未正确关闭导致连接泄漏与资源耗尽。
- **证据类型/等级**：实现证据（同版本官方源码）。
- **来源身份**：postgres/postgres（`REL_18_4`）。
- **版本/ref/Commit**：`REL_18_4`；`f5cc81719e6da4cbdb1f797c48b693e91018153a`。
- **原始位置**：`src/interfaces/libpq/fe-connect.c`（连接建立/关闭）。
- **支持说明**：libpq 连接生命周期决定资源释放；未关闭连接导致泄漏。
- **适用条件**：诊断连接泄漏、连接耗尽、资源未释放。
- **限制**：连接生命周期以 postgres `REL_18_4` 为准。
- **关联 Skill**：crawler-use-postgresql。
- **状态**：有效。

### PG-POOL-002 postmaster 连接处理

- **知识声明**：postmaster（`src/backend/postmaster/postmaster.c`）接受并管理客户端连接；连接数限制与资源管理不当导致连接拒绝或资源耗尽。
- **证据类型/等级**：实现证据（同版本官方源码）。
- **来源身份**：postgres/postgres（`REL_18_4`）。
- **版本/ref/Commit**：`REL_18_4`；`f5cc81719e6da4cbdb1f797c48b693e91018153a`。
- **原始位置**：`src/backend/postmaster/postmaster.c`。
- **支持说明**：postmaster 实现连接接受与管理；连接限制影响资源。
- **适用条件**：诊断连接拒绝、连接数限制、资源管理问题。
- **限制**：连接管理语义以 postgres `REL_18_4` 为准。
- **关联 Skill**：crawler-use-postgresql。
- **状态**：有效。

---

## 事务与锁

### PG-TXN-001 事务语义

- **知识声明**：PostgreSQL 事务由 `src/backend/access/transam/xact.c` 实现；事务提交/回滚错误导致数据不一致或连接状态异常。
- **证据类型/等级**：实现证据（同版本官方源码）。
- **来源身份**：postgres/postgres（`REL_18_4`）。
- **版本/ref/Commit**：`REL_18_4`；`f5cc81719e6da4cbdb1f797c48b693e91018153a`。
- **原始位置**：`src/backend/access/transam/xact.c`。
- **支持说明**：事务管理实现提交/回滚；事务错误导致不一致。
- **适用条件**：诊断事务错误、提交/回滚问题、事务不一致。
- **限制**：事务语义以 postgres `REL_18_4` 为准。
- **关联 Skill**：crawler-use-postgresql。
- **状态**：有效。

### PG-LOCK-001 锁语义

- **知识声明**：PostgreSQL 锁由 `src/backend/storage/lmgr/lock.c`、`lwlock.c` 实现；锁等待或锁配置错误导致阻塞与性能下降。
- **证据类型/等级**：实现证据（同版本官方源码）。
- **来源身份**：postgres/postgres（`REL_18_4`）。
- **版本/ref/Commit**：`REL_18_4`；`f5cc81719e6da4cbdb1f797c48b693e91018153a`。
- **原始位置**：`src/backend/storage/lmgr/lock.c`、`src/backend/storage/lmgr/lwlock.c`。
- **支持说明**：锁管理实现锁获取/释放；锁等待影响性能。
- **适用条件**：诊断锁等待、锁配置错误、阻塞问题。
- **限制**：锁语义以 postgres `REL_18_4` 为准。
- **关联 Skill**：crawler-use-postgresql。
- **状态**：有效。

### PG-LOCK-002 死锁检测

- **知识声明**：PostgreSQL 通过 `src/backend/storage/lmgr/deadlock.c` 检测死锁；死锁检测将终止导致死锁的事务并返回错误。
- **证据类型/等级**：实现证据（同版本官方源码）。
- **来源身份**：postgres/postgres（`REL_18_4`）。
- **版本/ref/Commit**：`REL_18_4`；`f5cc81719e6da4cbdb1f797c48b693e91018153a`。
- **原始位置**：`src/backend/storage/lmgr/deadlock.c`。
- **支持说明**：死锁检测终止死锁事务；死锁错误返回给应用。
- **适用条件**：诊断死锁、死锁错误、事务被终止。
- **限制**：死锁检测语义以 postgres `REL_18_4` 为准。
- **关联 Skill**：crawler-use-postgresql。
- **状态**：有效。

---

## 索引与查询性能

### PG-INDEX-001 索引语义

- **知识声明**：PostgreSQL 索引通过 `src/backend/access/index/indexam.c`、`genam.c` 实现；索引使用错误或缺失导致查询性能下降或索引失效。
- **证据类型/等级**：实现证据（同版本官方源码）。
- **来源身份**：postgres/postgres（`REL_18_4`）。
- **版本/ref/Commit**：`REL_18_4`；`f5cc81719e6da4cbdb1f797c48b693e91018153a`。
- **原始位置**：`src/backend/access/index/indexam.c`、`genam.c`。
- **支持说明**：索引访问方法实现索引语义；索引缺失影响性能。
- **适用条件**：诊断索引失效、索引缺失、查询性能下降。
- **限制**：索引语义以 postgres `REL_18_4` 为准。
- **关联 Skill**：crawler-use-postgresql。
- **状态**：有效。

### PG-INDEX-002 索引管理

- **知识声明**：PostgreSQL 索引创建/管理由 `src/backend/commands/indexcmds.c` 实现；索引配置错误或失效导致查询计划异常。
- **证据类型/等级**：实现证据（同版本官方源码）。
- **来源身份**：postgres/postgres（`REL_18_4`）。
- **版本/ref/Commit**：`REL_18_4`；`f5cc81719e6da4cbdb1f797c48b693e91018153a`。
- **原始位置**：`src/backend/commands/indexcmds.c`。
- **支持说明**：索引命令实现创建/管理；配置错误影响查询计划。
- **适用条件**：诊断索引配置错误、索引失效、查询计划异常。
- **限制**：索引管理语义以 postgres `REL_18_4` 为准。
- **关联 Skill**：crawler-use-postgresql。
- **状态**：有效。

### PG-PLAN-001 查询计划/优化器语义

- **知识声明**：PostgreSQL 优化器（`src/backend/optimizer/plan/`）生成查询计划；统计信息陈旧或优化器错误导致慢查询或错误计划。
- **证据类型/等级**：实现证据（同版本官方源码）。
- **来源身份**：postgres/postgres（`REL_18_4`）。
- **版本/ref/Commit**：`REL_18_4`；`f5cc81719e6da4cbdb1f797c48b693e91018153a`。
- **原始位置**：`src/backend/optimizer/plan/planner.c`、`planmain.c`。
- **支持说明**：优化器生成查询计划；统计与计划错误影响性能。
- **适用条件**：诊断慢查询、查询计划错误、统计信息问题。
- **限制**：查询计划语义以 postgres `REL_18_4` 为准。
- **关联 Skill**：crawler-use-postgresql。
- **状态**：有效。

---

## 迁移与版本兼容/数据库日志

### PG-MIG-001 迁移/备份语义

- **知识声明**：PostgreSQL `pg_dump`（`src/bin/pg_dump/pg_dump.c`）与 `pg_restore`（`pg_restore.c`）实现数据备份与恢复；迁移不一致或备份错误导致数据丢失或结构不一致。
- **证据类型/等级**：实现证据（同版本官方源码）。
- **来源身份**：postgres/postgres（`REL_18_4`）。
- **版本/ref/Commit**：`REL_18_4`；`f5cc81719e6da4cbdb1f797c48b693e91018153a`。
- **原始位置**：`src/bin/pg_dump/pg_dump.c`、`src/bin/pg_dump/pg_restore.c`。
- **支持说明**：pg_dump/pg_restore 实现备份与恢复；迁移错误导致不一致。
- **适用条件**：诊断迁移不一致、备份/恢复错误、Schema 迁移问题。
- **限制**：迁移语义以 postgres `REL_18_4` 为准；修复迁移须规划＋用户明确批准。
- **关联 Skill**：crawler-use-postgresql。
- **状态**：有效。

### PG-VER-001 版本兼容与配置语义

- **知识声明**：PostgreSQL 运行时配置由 `doc/src/sgml/config.sgml`、`runtime.sgml` 定义；版本与配置不匹配导致版本兼容问题或行为异常。
- **证据类型/等级**：规范证据（官方文档）。
- **来源身份**：postgres/postgres（`REL_18_4`）。
- **版本/ref/Commit**：`REL_18_4`；`f5cc81719e6da4cbdb1f797c48b693e91018153a`。
- **原始位置**：`doc/src/sgml/config.sgml`、`doc/src/sgml/runtime.sgml`。
- **支持说明**：官方文档定义运行时配置与版本语义；配置错误导致兼容问题。
- **适用条件**：诊断版本兼容、配置错误、运行时行为异常。
- **限制**：配置语义以 postgres `REL_18_4` 为准。
- **关联 Skill**：crawler-use-postgresql。
- **状态**：有效。

### PG-LOG-001 数据库日志/运行时语义

- **知识声明**：PostgreSQL 官方 Docker 镜像（`docker-library/postgres` `docker-entrypoint.sh`、`18/`）实现数据库初始化、日志与环境配置；集成错误导致数据库服务问题。
- **证据类型/等级**：工程证据＋实现证据（官方运行脚本）。
- **来源身份**：docker-library/postgres（`master` 固定快照）。
- **版本/ref/Commit**：`master` 固定快照；`62a714f93cc32220de46fd12235c9d509e3b1ad6`。
- **原始位置**：`docker-entrypoint.sh`、`18/`（如 `18/bookworm/`）。
- **支持说明**：官方镜像脚本实现初始化与日志配置；集成错误影响服务。
- **适用条件**：诊断数据库日志、容器化 PostgreSQL 集成问题、初始化配置错误。
- **限制**：Docker 镜像语义以 docker-library/postgres 固定快照为准；容器/镜像数据须位于 E 盘（主决策日志 §30/§31/§62）。
- **关联 Skill**：crawler-use-postgresql。
- **状态**：有效。
