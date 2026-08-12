# Claude Code：爬虫网站纵向闭环规划入口

> 创建日期：2026-08-03  
> 状态：详细设计已获用户批准；允许 Claude Code 编写实施计划，不授权开发  
> 目标：让 Claude Code 在获得用户明确规划授权后，依据本地决议和设计编写可执行计划

## 1. 必读顺序

Claude Code 开始规划前必须完整读取：

1. `docs/superpowers/brainstorming/2026-08-03-crawler-implementation-decision-log.md`
2. `docs/superpowers/specs/2026-08-03-crawler-vertical-slice-design.md`
3. `docs/superpowers/specs/2026-07-30-official-biography-crawler-design.md`
4. `docs/superpowers/brainstorming/2026-07-30-official-biography-crawler-decision-log.md`
5. `docs/superpowers/progress/crawler-knowledge-skills-progress.md`
6. 当前 `package.json`、`pnpm-lock.yaml`、`apps/`、`packages/`、`config/`、`infra/` 和测试目录现场事实

如需领域或技术栈知识，再按问题加载对应的项目 Skill、知识视图和证据卡。不得把 19 个 Skill 当成生产运行组件。

## 2. 权威与冲突处理

- 最新用户明确决议优先。
- 开发期决策日志只记录已批准决议。
- 详细设计中标记为待复核的内容不能冒充已批准决议。
- 当前代码事实不能自动覆盖设计；文档也不能假装尚未实现的功能已经存在。
- 发现版本、架构、业务合同或安全边界冲突时，先形成冲突报告，不静默选边，不直接改代码。

## 3. 规划准入门

用户已通过开发期决议 R-05 明确授权 Claude Code 开始编写实施计划。该授权仅覆盖计划编写。开始前仍须：

- 只读核验；
- 对照当前代码、锁文件与权威文档；
- 提出阻断计划准确性的缺失信息；
- 记录新的用户决议；
- 保持已批准设计规格不被静默改变。

不得把 R-05、本文或计划编写授权解释为已经授权实施。

## 4. 计划必须包含

- 单地区、单机构纵向闭环的明确完成定义；
- 精确文件路径、函数/模块责任和依赖顺序；
- 每项生产行为对应的先失败测试、最小实现和验证命令；
- 合同、数据库、证据存储、Crawler、Rules、Reviewer、API/SSE、Web 和 Excel 的纵向任务拆分；
- PostgreSQL 真实集成测试与迁移验证；
- SSRF、重定向、统一出口、资源限制和脱敏测试；
- 离线金标回放，真实官网 Canary 单列为需要用户授权的步骤；
- 回滚和数据兼容策略；
- 每个任务的完成证据；
- 不得出现未完成占位项、空壳文件或“稍后补测试”。

计划应优先交付可运行纵向链路，不按目录横向把所有包先写满。

## 5. 开发期决议记录协议

每次用户作出新决议时：

1. 在开发期决策日志追加下一个 `R-xx`；
2. 记录日期、明确指令、覆盖或澄清条款、新基线、影响和边界；
3. 若影响设计，同步修订设计规格并追加修订记录；
4. 若影响计划，同步更新计划并标明受影响任务；
5. 不删除、不重排、不静默改写旧决议；
6. 建议、风险和 Agent 推断不得写成用户决议。

## 6. 当前已知阻断项

以下不是永久阻断，但必须在计划前部处理：

- 项目根目录没有 Git 元数据，任何 Agent 不得擅自初始化 Git。
- 当前 `pnpm test` 因零测试文件失败。
- Docker daemon 当前未运行，`E:\StellarisData\postgres` 为空。
- `infra/docker`、`infra/squid`、`config/rules` 和 `config/site-adapters` 尚无实现文件。
- 数据库初始迁移尚未完成真实环境验证，关键跨表不变量仍需审计。
- 依赖版本与冻结设计的版本条目需要形成一次获准的开发期基线决议。

## 7. 规划完成后的等待门

Claude Code 写完计划后必须：

- 自审占位符、矛盾、范围、依赖顺序和验证缺口；
- 向用户提供计划文件路径和关键决策摘要；
- 等待用户批准计划；
- 在用户批准计划前不修改业务代码、不启动服务、不执行迁移、不抓取真实网站。
