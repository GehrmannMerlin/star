# crawler-use-postgresql Skill 设计规格

日期：2026-08-03  
状态：书面规格待用户审阅  
适用范围：第 18 个独立 Agent Skill `crawler-use-postgresql` 的完整设计

## 1. 目标与边界

`crawler-use-postgresql` 是爬虫知识资料库当前重点技术栈方向下的 Agent PostgreSQL 专项实现诊断、修复顾问。其职责是：依托项目锁定 PostgreSQL、驱动和迁移工具版本对应的官方资料、发布说明、故障案例和源码，帮助 Agent 检查 Schema、迁移、SQL、连接池、事务、锁、索引、查询计划和数据库日志，发现连接泄漏、事务错误、锁等待或死锁、索引失效、慢查询、迁移不一致和版本兼容问题。它将 `crawler-manage-evidence-storage` 已经确认的持久化与证据链方向转换为适合当前 PostgreSQL 环境的具体实现建议。

本 Skill **不是**项目数据库服务或连接池运行组件。它默认只指导只读诊断和查询计划分析；数据修改、Schema 变更和修复迁移等动作必须经过规划并获得用户明确批准。它不重复跨存储证据链方法论，也不自行改变业务数据模型。

本设计只规划 `crawler-use-postgresql`，不包含第 19 个及后续 Skill 的实施任务；不创建或实施本 Skill 本身（实施由 Claude Code 按后续写作计划执行）。

## 2. 已确认输入

- 主决策日志：`docs/superpowers/brainstorming/2026-07-31-crawler-knowledge-skills-decision-log.md`（已确认决策的最高权威；§63/§51/§26.3）。
- 统一知识设计规格：`docs/superpowers/specs/2026-07-31-crawler-knowledge-skills-knowledge-design.md`（公共知识契约）。
- 固定源码清单：`third-party/crawler-knowledge-sources/manifest.md`。
- 处理 Stellaris 问题时：`stellaris-crawler-context` 生成的项目上下文包路径。
- 已确认根因与方向（`crawler-triage-incidents` 分诊结论，适用时）。
- 相关 PostgreSQL 代码、配置、版本、数据库结构和运行证据（现场只读核验）。

## 3. 职责与排除项

### 3.1 职责

- 检查项目中的 PostgreSQL 专项实现相关问题：
  - Schema、迁移（DDL、迁移工具）；
  - SQL 与查询计划；
  - 连接池与连接管理；
  - 事务与锁（锁等待、死锁）；
  - 索引与查询性能；
  - 数据库日志与版本兼容。
- 发现连接泄漏、事务错误、锁等待或死锁、索引失效、慢查询、迁移不一致和版本兼容问题。
- 将 `crawler-manage-evidence-storage` 已经确认的持久化与证据链方向转换为适合当前 PostgreSQL 环境的具体实现建议。
- 输出可追溯问题证据、根因或待验证假设、影响范围、修复方向（PostgreSQL 实现建议）、测试建议。

### 3.2 排除项

- 不替代项目数据库服务、连接池或迁移运行组件。
- 默认只指导只读诊断和查询计划分析；数据修改、Schema 变更和修复迁移等动作必须经过规划并获得用户明确批准（主决策日志 §63）。
- 不重复跨存储证据链方法论，也不自行改变业务数据模型（主决策日志 §63）。
- 不引用锁定版本不存在的或已经变更的 SQL/API/配置项（版本兼容）。
- 不越过用户批准边界或跳过 `crawler-writing-plans-bridge`。
- 跨存储一致性、证据链完整性与可追溯性原理交给 `crawler-manage-evidence-storage`；Docker 具体问题交给 `crawler-run-docker`。
- 不生成 `writing-plans`、不提出未经批准的代码修改。
- 不安装、构建或运行未经批准的项目或第三方代码；不启动 PostgreSQL 服务、不执行数据修改或 Schema 变更。
- 不修改爬虫代码、`manifest.md`、第三方仓库；不初始化 Git。
- 不把密钥、Cookie、认证请求头、代理凭据、环境变量中的秘密、数据库连接串凭据写入诊断记录，落盘前脱敏。

## 4. 触发条件与输入

### 4.1 触发

用户要求检查 PostgreSQL 专项实现相关设计或故障，或已经确认的问题涉及 Schema、迁移、SQL、连接池、事务、锁、索引、查询计划或数据库日志时触发（主决策日志 §63）。通常由 `crawler-triage-incidents` 分诊路由进入（已确认根因后），或用户直接要求 PostgreSQL 专项诊断。

### 4.2 最低输入

- 项目上下文（处理 Stellaris 问题时为 `stellaris-crawler-context` 项目上下文包路径）。
- 已确认根因与方向（`crawler-triage-incidents` 分诊结论，适用时）。
- 相关 PostgreSQL 代码、配置、版本、数据库结构和运行证据。
- 固定版本资料（批次 5：postgres/postgres、docker-library/postgres）。

## 5. 诊断流程

1. 读取项目上下文（Stellaris 问题先读 `stellaris-crawler-context` 项目上下文包）、目标、约束与已确认根因。
2. 确定诊断聚焦点：Schema 与迁移 / SQL 与查询计划 / 连接池与连接管理 / 事务与锁 / 索引与查询性能 / 数据库日志与版本兼容。
3. 检查相关 PostgreSQL 代码、配置、版本、数据库结构和运行证据，定位具体证据位置。
4. 引用匹配版本的证据卡（`postgresql.md`）比对项目行为与规范/实现/工程证据。
5. 分类：代码缺陷 / 配置错误 / 版本兼容 / 设计不足 / 外部条件 / 未知项。
6. 证据不足时只提出最小补充取证（只读查询、查询计划分析、隔离复现）；根因未证实前不提出代码修改或 Schema 变更。
7. 将 `crawler-manage-evidence-storage` 已确认的方向转换为适合当前 PostgreSQL 环境的具体实现建议。
8. 输出可追溯问题证据、根因或待验证假设、影响范围、修复方向、测试建议。
9. 获准的修复方向交给 `crawler-writing-plans-bridge`。

## 6. 问题分类规则

- **代码缺陷**：PostgreSQL 相关代码未按锁定版本行为处理（如连接泄漏、事务错误、SQL 使用错误）。
- **配置错误**：PostgreSQL/驱动/连接池配置与锁定版本行为不符（如连接池参数、Schema、索引配置错误）。
- **版本兼容**：PostgreSQL/驱动/迁移工具版本与配置行为不匹配（如引用已变更的 SQL/API/配置项）。
- **设计不足**：缺乏 Schema 规划、索引设计、连接池管理、迁移管理等设计层面缺失。
- **外部条件**：数据库服务不可用、外部依赖受限等——只能给合规降级/等待/终止结论，不得伪装成已修复（主决策日志 §12/§63）。
- **未知项**：证据不足或冲突，保持候选假设，显式标记，不判定为确定根因。

每条结论必须明确区分：事实、证据、综合推断、待确认项。综合推断必须显式标记为"推断"，不得伪装成资料中的确定结论（主决策日志 §14）。

置信度使用固定枚举：高（证据充分且指向唯一分类）、中（证据充分但多个分类可能）、低（证据不足或冲突，仅候选假设）、不确定（无法判断）。

**实现转换规则**：将 `crawler-manage-evidence-storage` 已确认方向转换为 PostgreSQL 实现建议时，必须引用锁定版本（postgres `REL_18_4`、docker-library-postgres `master` 固定快照 `62a714f9…`）的 SQL 与配置语义；不得默认采用审查时最新 Release 或历史草案版本（主决策日志 §71/§75）。识别"适用版本准确、SQL 与事务判断正确"是验收重点。

## 7. 证据卡主题分组

共享证据卡 `docs/superpowers/knowledge/evidence-cards/postgresql.md` 从批次 5 固定资料筛选，按以下主题分组（实施时按实际固定资料筛选具体卡片）：

1. **SQL 与驱动/连接**：postgres `src/interfaces/libpq/`（fe-connect.c、fe-exec.c）；`doc/src/sgml/syntax.sgml`。
2. **连接池与连接管理**：postgres `src/interfaces/libpq/`（连接语义）；`src/backend/postmaster/`（postmaster 连接处理）。
3. **事务与锁**：postgres `src/backend/access/transam/`；`src/backend/storage/lmgr/`（lock.c、deadlock.c、lwlock.c、proc.c）。
4. **索引与查询性能**：postgres `src/backend/access/index/`；`src/backend/commands/indexcmds.c`；`src/backend/optimizer/`。
5. **迁移与版本兼容/数据库日志**：postgres `src/bin/pg_dump/`（pg_dump.c、pg_restore.c）；`doc/src/sgml/config.sgml`、`runtime.sgml`；docker-library-postgres `docker-entrypoint.sh`、`18/`。

## 8. 输出契约

诊断记录采用可落盘结构化记录＋简短人类可读摘要（主决策日志 §33 节），每条结论可追溯。固定字段：

- 问题证据（定位到的 PostgreSQL 代码/配置/版本/数据库结构/日志证据位置）。
- 分类（代码缺陷 / 配置错误 / 版本兼容 / 设计不足 / 外部条件 / 未知项；含置信度：高/中/低/不确定）。
- 根因或待验证假设（区分事实、证据、推断、待确认项）。
- 影响范围（受影响的 Schema、表、索引、连接池、迁移、部署面）。
- 修复方向（适合当前 PostgreSQL 环境的具体实现建议，指向匹配版本资料）。
- 测试建议（只读查询、查询计划分析、隔离复现、健康检查验证方法）。
- 依据（关联证据卡 ID、固定资料路径、PostgreSQL 配置/日志位置）。

记录必须明确区分：事实、证据、推断、待确认项与用户批准状态。

## 9. 交接契约

- 遵守主决策日志第 33-36 节：可落盘结构化记录＋简短人类摘要；双层存储（小型记录项目内保存、大型证据以内容哈希和相对路径引用）；敏感信息落盘前脱敏。
- 将 `crawler-manage-evidence-storage` 已确认方向转换为 PostgreSQL 实现建议，但不得越过用户批准边界或跳过 `crawler-writing-plans-bridge`。
- 获准的修复方向交给 `crawler-writing-plans-bridge` 作为规划输入，不取代其规划职责。
- 数据修改、Schema 变更和修复迁移等动作必须经过规划并获得用户明确批准（主决策日志 §63）。
- 跨存储一致性、证据链完整性与可追溯性原理交给 `crawler-manage-evidence-storage`。
- 诊断结论明确区分事实、证据、推断、待确认项与用户批准状态。

## 10. 文件结构

```text
skills/crawler-use-postgresql/
  SKILL.md                              # 精简触发＋门禁＋路由＋输出＋禁止项
  references/
    postgresql-workflow.md              # 诊断流程、问题分类规则、实现转换规则、证据卡映射
    output-contract.md                  # 输出契约、交接契约、修订保留
docs/superpowers/knowledge/
  evidence-cards/
    postgresql.md                       # 共享证据卡（从批次 5 固定资料筛选）
  skill-views/
    crawler-use-postgresql.md           # Skill 18 独立知识视图（引用证据卡）
tests/skills/crawler-use-postgresql/
  cases.md                              # 行为/安全案例（RED/GREEN 用）
  results.md                            # 红/绿行为评估记录
```

不引入 `validate.ps1`：PostgreSQL 专项诊断报告依赖动态项目证据与判断，机械结构校验价值有限，按最小充分原则（主决策日志 §107 先例）以行为案例验证为主。

## 11. 验证设计

### 11.1 结构验证

静态检查：
- Skill 包文件齐全（SKILL.md、postgresql-workflow.md、output-contract.md）。
- 共享证据卡 `postgresql.md` 与知识视图 `crawler-use-postgresql.md` 存在；知识视图引用证据卡。
- 诊断流程与问题分类规则、实现转换规则在 references 中明确定义。
- 无 `TBD`、`TODO`、`FIXME` 占位符。
- 无肯定式运行指令；仅有负面安全声明与诊断流程描述。
- 不含敏感信息示例（密钥、Cookie、认证头、代理凭据、数据库连接串凭据）。
- 非 Git 边界：项目根目录不是 Git worktree；不初始化 Git。

### 11.2 行为验证（RED/GREEN）

按 `superpowers:writing-skills` 方法运行固定行为案例，每个案例使用全新隔离的 Agent 上下文：

- 按诊断聚焦点聚焦：只诊断触发问题对应的聚焦点，不无边界扩展。
- 问题分类正确：代码缺陷 / 配置错误 / 版本兼容 / 设计不足 / 外部条件 / 未知项。
- 识别 PostgreSQL 缺陷：能识别连接泄漏、事务错误、锁等待或死锁、索引失效、慢查询、迁移不一致和版本兼容问题。
- 版本准确：引用锁定版本（postgres `REL_18_4`、docker-library-postgres `master` 固定快照）的 SQL 与配置语义；不引用锁定版本不存在的或已变更的项。
- 只读边界：数据修改、Schema 变更和修复迁移等动作必须经过规划并获得用户明确批准。
- 不越过批准边界：获准前不交给 `crawler-writing-plans-bridge`。
- 证据不足不判根因：证据不足时只提出最小补充取证，不把未知项误判为已定位根因。
- 不重复跨存储证据链方法论：跨存储一致性、证据链完整性交给 `crawler-manage-evidence-storage`。
- 敏感信息脱敏：诊断记录不含密钥/Cookie/认证头/代理凭据/数据库连接串凭据/环境变量中的秘密。

### 11.3 验收标准（对应主决策日志 §63）

- 适用版本准确。
- SQL 与事务判断正确。
- 能定位锁、性能和迁移问题，且不破坏数据。

达到上述标准即视为本 Skill 当前细节设计充分，不再扩展低优先级内部设计。

## 12. 阶段门

本规格经用户审阅批准后，才可调用 `superpowers:writing-plans` 生成 `crawler-use-postgresql` 的单 Skill 实施计划。用户未明确批准前，不进入 `writing-plans`，不实施本 Skill，不开始第 19 个 Skill。

`E:\Stellaris` 当前不是 Git 仓库。本设计只要求把文档可靠保存在本地项目中，不得为了满足提交步骤擅自初始化 Git。
