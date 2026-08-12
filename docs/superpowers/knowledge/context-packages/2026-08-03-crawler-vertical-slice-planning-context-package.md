# 爬虫单地区单机构纵向闭环规划上下文包

> 生成时间：2026-08-03
> 现场核验时间：2026-08-03（本会话逐项只读核验，不使用旧快照）
> 生成角色：Claude Code（writing-plans 规划准入阶段）
> 依据 Skill：`stellaris-crawler-context` 动态核验流程与五类内容×固定字段契约
> 性质：本包仅分离现场事实、已批准要求、历史设计、冲突与未知项及建议规划重点；不含根因结论、修复方案或实施计划。

## 1. 当前代码事实（current fact）

| 标签 | 值/内容 | 来源位置 | 验证时间 | 证据等级 |
|---|---|---|---|---|
| current fact | pnpm workspace 已建，8 个工作区（apps/backend、apps/web、packages/contracts、crawler、db、evidence、exporter、rules），`pnpm-workspace.yaml` 声明 `apps/*` 与 `packages/*` | `E:\Stellaris\pnpm-workspace.yaml`；`package.json` | 2026-08-03 | 现场只读核验 |
| current fact | 锁文件 `pnpm-lock.yaml` 存在（182,092 字节），599 个 `.pnpm` 存储条目；node_modules 已安装 | `E:\Stellaris\pnpm-lock.yaml`；`node_modules/.pnpm` | 2026-08-03 | 现场只读核验 |
| current fact | 根 `package.json`：scripts `build`=pnpm -r build、`dev`=backend、`typecheck`=pnpm -r typecheck、`test`=pnpm -r test；`engines` node>=24 / pnpm>=10；`.npmrc` 强制 `engine-strict=true`、`save-exact=true` | `E:\Stellaris\package.json`；`.npmrc` | 2026-08-03 | 现场只读核验 |
| current fact | `tsconfig.base.json`：target ES2024、module NodeNext、strict、noUncheckedIndexedAccess、exactOptionalPropertyTypes、verbatimModuleSyntax、declaration 等 | `E:\Stellaris\tsconfig.base.json` | 2026-08-03 | 现场只读核验 |
| current fact | 各包 `test` 脚本均为 `vitest run`；`apps/` 与 `packages/` 下 **0 个** `*.test.ts/tsx/spec.*` 单元测试文件；`tests/` 下只有 19 个 skill 的 cases.md/results.md 文档 | 各包 `package.json`；`find` 扫描 | 2026-08-03 | 现场只读核验 |
| current fact | 无 `vitest.config.*`；仅 `apps/web/vite.config.ts`；无集中测试环境配置 | `find` 扫描 | 2026-08-03 | 现场只读核验 |
| current fact | `pnpm typecheck` 通过（设计文档 §3 基线）；`pnpm test` 因零测试文件失败（vitest 无测试可运行） | 详细设计 §3；计划入口 §6 | 2026-08-03 | 设计基线＋现场基线 |
| current fact | 依赖精确版本：TypeScript 6.0.3、Vitest 4.1.10、Fastify 5.11.0、Kysely 0.29.4、pg 8.22.0、Graphile Worker 0.17.3、Crawlee 3.17.0、Playwright 1.62.1、Cheerio 1.2.0、ExcelJS 4.4.0、TypeBox 0.34.52、Ajv 8.20.0、React 19.2.8、Vite 8.2.0、TanStack Query 5.101.4、TanStack Table 8.21.3、fast-check 4.9.0 | `pnpm-lock.yaml`；各包 `package.json` | 2026-08-03 | 现场只读核验 |
| current fact | `apps/backend/src/server.ts`：仅 `/health`；`buildApp` 可注入 host/port；直接运行检测入口 | `apps/backend/src/server.ts` | 2026-08-03 | 现场只读核验 |
| current fact | `apps/web/src/main.tsx`：仅渲染 `<h1>政务简历采集</h1>`；`index.html` 为 zh-CN 骨架 | `apps/web/src/main.tsx`；`apps/web/index.html` | 2026-08-03 | 现场只读核验 |
| current fact | `packages/contracts`：健康合同（HealthSchema）＋业务枚举（TaskRunStatus 12 项、CurrentnessStatus 6 项、InstitutionType 14 类、PageType 5 类、TaskMode、ExpandLevel、FetchMode、FrontierPriority、Slot、ReviewDecision、InstitutionOutcome）＋中文映射（TaskRunStatusZh、CurrentnessStatusZh、PageTypeZh）；**缺任务、SSE、证据、结果、导出边界合同** | `packages/contracts/src/{index,health,enums}.ts` | 2026-08-03 | 现场只读核验 |
| current fact | `packages/db`：schema.ts 定义 **25 张表**（范围/抓取/事实/业务/控制/输出/复用层）＋TABLE_NAMES；`migration-001-initial.ts` 初始迁移（uuid PK、varchar+CHECK 枚举、幂等键/`result_row` 同任务机构槽位/slot_decision/`document_snapshot` 哈希/`site_profile` host 等唯一约束）；client.ts（createDb/dbConfigFromEnv，默认 127.0.0.1:5432、用户 stellaris、密码 stellaris_dev）；migrate.ts（migrateToLatest/migrateDown）；migration-provider.ts（单迁移）；三个 Repository（task-run、target-scope、institution-snapshot） | `packages/db/src/*.ts` | 2026-08-03 | 现场只读核验 |
| current fact | **初始迁移存在结构性缺口**：`fetch_attempt.document_snapshot_id`、`document_snapshot` 的 `content_hash` 等关键外键未定义（schema.ts 中 `document_snapshot_id` 无 references）；`review_job.unique_request_key` 无唯一约束；`result_row.position_url` 与 `review_decision` 无外键/约束不变量；`review_decision.review_job_id` 无外键；`document_snapshot.relative_path` 无“仅证据根下相对路径”DB 层强制 | `packages/db/src/migration-001-initial.ts`；`packages/db/src/schema.ts` | 2026-08-03 | 现场只读核验 |
| current fact | `packages/crawler`、`evidence`、`exporter`、`rules` 均为包骨架（仅导出包名常量）；无实现 | 各包 `src/index.ts` | 2026-08-03 | 现场只读核验 |
| current fact | `config/rules`、`config/site-adapters`、`infra/docker`、`infra/squid` 为**空目录（0 文件，无 .gitkeep）** | `find config infra` | 2026-08-03 | 现场只读核验 |
| current fact | `E:\StellarisData\postgres` 存在但为空；`evidence`、`exports` 目录**尚未创建** | `ls /e/StellarisData` | 2026-08-03 | 现场只读核验 |
| current fact | **Docker daemon 当前运行中**（`docker info` 返回 ServerVersion 29.5.3）——与详细设计 §3 记录“Docker daemon 未运行”不一致（详见第 4 节） | `docker info` | 2026-08-03 | 现场只读核验 |
| current fact | E 盘可用 **240 GiB**（> 120 GB 底线）；项目根目录**不是 Git 仓库**（`git rev-parse` 退出 128） | `df -h /e`；`git rev-parse` | 2026-08-03 | 现场只读核验 |
| current fact | `third-party/crawler-knowledge-sources/repos/batch-02-diagnosis-planning/superpowers` 本地快照存在（v6.2.0，Commit `3dcbd5c4…`），含 `skills/writing-plans/SKILL.md` 与 `plan-document-reviewer-prompt.md`；本项目 19 个 Skill（含 `crawler-writing-plans-bridge`、`stellaris-crawler-context`）均为已完成的知识/规划层 | `third-party/…/superpowers`；`skills/` 目录 | 2026-08-03 | 现场只读核验 |
| current fact | `docs/superpowers/knowledge/context-packages/` 仅含 `.gitkeep`；本包为第一个上下文包 | 目录扫描 | 2026-08-03 | 现场只读核验 |

## 2. 已批准要求（approved requirement）

| 标签 | 值/内容 | 来源位置 | 批准状态 |
|---|---|---|---|
| approved requirement | 下一阶段采用“单地区、单机构真实纵向闭环”，先建可验证地基与单机构闭环，再扩展多行政区、完整机构库存、任务控制、并发、性能与运维能力 | 开发期决议 R-03 | 已批准（用户明确） |
| approved requirement | 下一阶段目标链路：任务输入 → 范围与机构冻结 → URL 意图 → HTTP 优先抓取 → 必要时 Playwright 升级 → 不可变证据入库 → 页面事实抽取 → 完整领导结构 → 两名主要自然人槽位 → 五类页面与九项硬门槛 → Recovery → 隔离 Reviewer → `result_row` → 网页结果与单 Sheet Excel | 开发期决议 R-03 | 已批准（用户明确） |
| approved requirement | 19 个项目 Skill 继续作为 Agent 的知识、诊断、评审和规划层，**不成为网站运行组件**；生产运行时使用 TypeScript 代码、声明式规则、数据库约束和 Worker 实现业务语义 | 开发期决议 R-03；详细设计 §2 | 已批准（用户明确） |
| approved requirement | 数据卷/证据库/导出根目录改为 **E 盘**：Docker 卷 `E:\StellarisData\postgres`；证据 `E:\StellarisData\evidence`；导出 `E:\StellarisData\exports`（覆盖冻结规格 D 盘条款） | 开发期决议 R-01 | 已批准（用户明确） |
| approved requirement | PostgreSQL 18 容器：`127.0.0.1:5432` 仅本机；开发密码 `stellaris_dev`（仅 localhost） | 开发期决议 R-02 | 已批准（用户明确） |
| approved requirement | 后续新决议必须本地持久化（开发期决策日志连续 `R-xx`），作为 Claude Code 交接依据；建议/推断不得写成决议 | 开发期决议 R-04 | 已批准（用户明确） |
| approved requirement | 详细设计 `2026-08-03-crawler-vertical-slice-design.md` **已获批**（R-05）；允许编写正式实施计划并保存到 `docs/superpowers/plans/2026-08-03-crawler-vertical-slice.md`；计划批准前不授权开发 | 开发期决议 R-05 | 已批准（用户明确） |
| approved requirement | 权威顺序：最新用户决议与开发期决议日志 > 已批准纵向闭环设计 > 2026-07-30 冻结总设计；冲突不静默选边 | 详细设计 §2；start-prompt §二 | 已批准（用户明确） |
| approved requirement | 当前 `pnpm test` 因零测试文件失败；第一批任务必须用真实测试建立测试基线，禁止 `--passWithNoTests` 掩盖 | 详细设计 §10；start-prompt §五.6 | 已批准（用户明确） |
| approved requirement | 数据库计划必须覆盖真实 PostgreSQL 18 集成测试、迁移、关键外键、索引、事务、幂等，以及五项不变量（同任务机构槽位单结果、非空 URL↔通过 Reviewer、空 URL 中文原因、Reviewer 请求键≠Collector 键、网页与 Excel 同源 `result_row`） | start-prompt §五.7 | 已批准（用户明确） |
| approved requirement | 真实网络前必须先完成 SSRF、DNS/IP、逐跳重定向、统一出口、资源上限、脱敏、robots/访问限制测试 | start-prompt §五.9；冻结规格 §23 | 已批准（用户明确） |
| approved requirement | 离线固定金标回放属计划内自动验证；真实官网 Canary 单列为需用户再次明确授权的步骤 | start-prompt §五.10 | 已批准（用户明确） |
| approved requirement | 明确暂缓能力：多行政区批量、完整机构库存批量发现、完整暂停/继续/取消、大规模性能、完整管理页面；暂缓≠删除 | start-prompt §五.11；详细设计 §4.3 | 已批准（用户明确） |
| approved requirement | 项目根目录非 Git；不得初始化 Git；每个任务改用独立验证检查点；Git 初始化列为需单独授权的外部前提 | start-prompt §二；计划入口 §6 | 已批准（用户明确） |
| approved requirement | 最终验证至少包含：`pnpm typecheck`、`pnpm test`、`pnpm build`、Docker Compose 配置校验、PostgreSQL 迁移与集成测试、离线端到端金标回放 | start-prompt §五.12 | 已批准（用户明确） |

## 3. 历史设计草案（historical draft）

| 标签 | 值/内容 | 来源位置 | 不得覆盖硬约束声明 |
|---|---|---|---|
| historical draft | 冻结总设计定义全国多行政区、完整机构库存、完整暂停/继续/取消、任务控制、SaaS 管理页面与完整并发/性能目标 | `2026-07-30-official-biography-crawler-design.md` §2.1/§5/§18/§19/§20 | 仅作背景；R-03/R-05 已明确本阶段先做单地区单机构闭环，多行政区等能力暂缓不删除 |
| historical draft | 冻结总设计证据/导出/PostgreSQL 位于 **D 盘**（`D:\StellarisData\`）；R-01 已覆盖为 E 盘 | 冻结规格 §17/§24.3 | 已被 R-01 覆盖为 `E:\StellarisData\` 基线 |
| historical draft | 冻结技术栈基线部分版本与本机锁文件不同：Crawlee 冻结 3.16 vs 当前 3.17.0；Fastify 冻结 5.7 vs 当前 5.11.0；Vite 冻结 8.1 vs 当前 8.2.0；TS 冻结 6.0 vs 当前 6.0.3；React 冻结 19 vs 当前 19.2.8；Playwright 冻结 1.62 vs 当前 1.62.1 | 冻结规格 §6.2；`pnpm-lock.yaml` | 详细设计 §3 已记录“版本基线对账需形成获准开发期基线决议”，不得擅自当作已批准 |
| historical draft | 冻结规格定义 500 页面金标、31 省、120 主机、P95≤60s 等大规模验收；第一闭环按详细设计 §10 收敛为离线固定金标＋真实 Canary（单独授权） | 冻结规格 §26/§27 | 第一闭环不把大规模金标当作完成门槛 |
| historical draft | 冻结规格 SSE 事件清单为 10 类（state_changed/progress_changed/institution.completed/result.upserted/result.reviewed/result.recovery_started/result.terminal_blank/export.ready/task.completed/task.failed）；第一闭环至少实现其中与纵向闭环相关子集 | 冻结规格 §19.2 | 第一闭环按详细设计 §6.1 补齐“SSE 事件联合类型”，可收敛事件集合并如实说明 |

## 4. 冲突与未知项（conflict / unknown）

| 标签 | 冲突双方或未知描述 | 相关来源位置 | 状态 |
|---|---|---|---|
| conflict | **Docker daemon 运行状态冲突**：详细设计 §3 与计划入口 §6 记录“Docker daemon 当前未运行、`E:\StellarisData\postgres` 为空”；现场核验 **Docker daemon 运行中（ServerVersion 29.5.3）**，postgres 数据目录仍为空 | 详细设计 §3；计划入口 §6；现场 `docker info` | 保持可见：Docker daemon 已运行属当前事实；计划前置任务仍须把“创建并验证真实 PostgreSQL 18 容器＋迁移”作为独立可验证任务，不因 daemon 运行而省略 |
| conflict | **依赖版本与冻结设计基线不一致**（Crawlee/Fastify/Vite/TS/React/Playwright 等）；开发期决策日志尚无版本基线决议 | 详细设计 §3 末段；冻结规格 §6.2；现场锁文件 | 保持可见：规划时以当前锁文件版本为实施基线并如实写入计划 Global Constraints；**版本基线对账决议**列入计划前置任务，需用户批准后追加 `R-xx`，不得由 Agent 自行批准 |
| unknown | 现有初始迁移（`migration-001-initial`）**未在当前环境完成可验证真实迁移**；关键外键/不变量约束未全部实现（第 1 节缺口） | 详细设计 §3；`packages/db/src/migration-001-initial.ts` | 不确定：是否需要在迁移中补外键/约束、如何补，由计划任务在真实 PostgreSQL 18 集成测试驱动下决定；当前事实只记录“缺失”，不判定修复方案 |
| unknown | `pnpm typecheck` 与 `pnpm build` 在当前 8 工作区下的全部包中是否仍通过（含各包 dist 陈旧度） | 详细设计 §3 | 不确定：计划应在任务 1 以真实命令核验并记录输出，不得沿用旧快照 |
| unknown | Graphile Worker 0.17.3 与 PostgreSQL 18 的兼容性、`graphile-worker` 迁移与项目业务迁移的共存方式 | 锁文件；冻结规格 §18.2 | 不确定：真实容器集成测试前不作结论 |
| unknown | ExcelJS 4.4.0 的超链接与单 Sheet 行为、@types/exceljs 1.3.2 与 ExcelJS 4.4.0 的 API 对齐 | 锁文件；冻结规格 §21.2 | 不确定：以真实导出测试验证 |
| unknown | 证据库压缩格式（规格 §17.2 提及 Zstandard）未在当前依赖中出现（zstd 未列入任何包依赖）；首阶段实现时需决定是否引入压缩或暂以原样保存 | 冻结规格 §17.2；各包 `package.json` | 不确定：作为实现选择保留，若改变规格描述需用户决议 |

## 5. 建议规划重点（triage focus）

| 标签 | 建议领域 | 依据 | 非根因结论声明 |
|---|---|---|---|
| triage focus | 任务 1 建立真实测试基线：为 8 个工作区各写入至少一个真实 Vitest 测试并驱动 `pnpm test` 通过（禁止 `--passWithNoTests`） | 第 1 节“0 个测试文件”；已批准要求“第一批任务用真实测试建立基线” | 仅建议规划顺序，非根因结论 |
| triage focus | 先做 contracts 边界合同与 db 真实 PostgreSQL 18 集成（迁移、外键、约束、不变量、事务、幂等），再进入爬虫/规则/Reviewer/Web/Excel 纵向闭环 | 第 1 节 db 迁移缺口；已批准要求“数据库计划覆盖外键/索引/事务/幂等/五不变量” | 仅建议规划顺序，非根因结论 |
| triage focus | 版本基线对账必须作为计划前置决议（需用户批准后写 `R-xx`），否则计划 Global Constraints 的版本值无批准依据 | 第 4 节 conflict（版本不一致）；开发期决议 R-04 | 仅建议规划事项，非根因结论 |
| triage focus | 证据/导出目录（`E:\StellarisData\evidence`、`exports`）尚不存在，需在计划任务中创建并纳入集成测试 | 第 1 节现场事实；已批准要求 R-01（E 盘根） | 仅建议规划事项，非根因结论 |
| triage focus | 安全出口（SSRF/DNS/IP/重定向/出口/资源上限/脱敏/robots）测试应排在任何真实抓取 Canary 之前，且 Canary 单列为需用户授权步骤 | 已批准要求“真实网络前必须完成安全测试”；start-prompt §五.9/§五.10 | 仅建议规划顺序，非根因结论 |
| triage focus | 本阶段暂缓能力（多行政区、完整库存、暂停/继续/取消、大规模性能、完整管理页）应写入计划“暂缓清单”，不写成删除 | 已批准要求 §五.11；详细设计 §4.3 | 仅建议计划结构，非根因结论 |
| triage focus | 由于 Docker daemon 已运行，计划可将“创建 PostgreSQL 18 容器＋迁移验证”作为常规集成任务，但仍须独立可验证，不能因 daemon 在跑而视为已完成 | 第 4 节 conflict（Docker 状态） | 仅建议计划结构，非根因结论 |

## 6. 修订记录（只追加）

- 2026-08-03：本包为第一版（规划准入专用）。取代对象：无（`docs/superpowers/knowledge/context-packages/` 下首个上下文包）。
