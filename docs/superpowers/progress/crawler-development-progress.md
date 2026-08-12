# 爬虫系统开发进度总账

> **历史开发记录**：本文不代表腾讯云当前生产状态。唯一事实来源：[`tencent-production-recovery-progress.md`](./tencent-production-recovery-progress.md)。

> 最后更新：2026-08-09
> 历史阶段记录：R-69 当时记为开发收尾；当前腾讯生产状态请查唯一恢复总账
> 规划角色：Claude Code
> 执行角色：Claude Code
> 批准与最终审阅：用户

## 恢复入口

任何新会话必须按以下顺序读取，不得依赖聊天记忆：

1. `docs/superpowers/brainstorming/2026-08-03-crawler-implementation-decision-log.md`（开发期决议 R-01 ~ R-27，权威）
2. `docs/superpowers/specs/2026-08-03-crawler-vertical-slice-design.md`（第一闭环设计，已批准）
3. `docs/superpowers/specs/2026-08-03-multi-institution-design.md`（多机构模块设计，已批准）
4. `docs/superpowers/specs/2026-08-03-multi-region-design.md`（多行政区模块设计，已批准）
5. `docs/superpowers/plans/2026-08-03-crawler-vertical-slice.md`（第一闭环计划，已批准并实施）
6. `docs/superpowers/plans/2026-08-03-multi-institution.md`（多机构计划，已批准并实施）
7. `docs/superpowers/plans/2026-08-03-multi-region.md`（多行政区计划，已批准并实施）
8. `docs/superpowers/progress/crawler-project-status-and-roadmap.md`（**项目状态与开发规划，后续开发权威基线**）
9. `docs/superpowers/handoffs/2026-08-09-deploy-collection-fault.md`（**线上采集故障诊断交接，当前活跃任务**）
10. 本进度总账
11. `docs/superpowers/handoffs/2026-08-03-crawler-multi-region-next-start-prompt.md`（早期启动提示词）

## 全局规则

- 每次只推进一个模块；当前模块计划通过用户审阅前，不开始下一个。
- `E:\Stellaris` 不是 Git 仓库，任何 Agent 不得擅自初始化 Git。
- 状态变化后先更新本总账，再继续下一动作。
- 新的用户明确决议追加到开发期决策日志，连续 `R-xx` 编号；建议/推断不得写成决议。
- 真实网络抓取（Canary）、Git 初始化、常驻服务启动均属外部前提，需逐项另行授权。

## 已完成模块

### 模块一：单地区、单机构真实纵向闭环（已完成）

- 设计：`docs/superpowers/specs/2026-08-03-crawler-vertical-slice-design.md`
- 计划：`docs/superpowers/plans/2026-08-03-crawler-vertical-slice.md`
- 决议：R-05（设计获批）、R-06（版本基线对账）、R-07（计划获批并授权实施）
- 交付：14 个任务全部完成。测试基线 8 工作区（contracts 8/db 12/crawler 24/rules 9/evidence 6/exporter 4/backend 6/web 5 等），`pnpm typecheck`/`test`/`build` 全绿，PostgreSQL 18 真实集成 + 不变量触发器，离线端到端金标回放通过。
- 关键能力：任务创建幂等、范围与机构冻结、HTTP 优先抓取（DNS-pinned SSRF）、证据内容寻址、页面事实抽取、规则引擎（判型/领导结构/选人/硬门槛/Recovery）、隔离 Reviewer、result_row 投影、任务 API/SSE、单 Sheet Excel、网页工作台。

### 模块二：多机构与完整机构库存（已完成）

- 设计：`docs/superpowers/specs/2026-08-03-multi-institution-design.md`
- 计划：`docs/superpowers/plans/2026-08-03-multi-institution.md`
- 决议：R-10（启动 brainstorming）、R-11（设计获批）、R-12（计划获批并授权实施）、R-13（真实安徽多机构 Canary）、R-14（机构发现增强+适配器重校准）
- 交付：5 个任务全部完成。机构发现（混合四层+部门栏目递归）、进程内浏览器池（Playwright 2-4）、声明式适配器（安徽首个）、多机构编排驱动、API FULL_INSTITUTION 模式。
- 真实 Canary 校准（R-13/R-14）：安徽省官网无单一机构清单页（`/site/tpl/2121` 仅单机构链接，机构容器 HTTP 与浏览器渲染后均空）；机构入口需走部门栏目逐个发现；领导列表链路（`/szf/index.html` → 9 名成员 → liId 详情）真实可用。

### 模块三：多行政区、下级展开与上传名单（已完成）

- 设计：`docs/superpowers/specs/2026-08-03-multi-region-design.md`
- 计划：`docs/superpowers/plans/2026-08-03-multi-region.md`
- 决议：R-15（启动 brainstorming）、R-16（设计获批）、R-17（计划获批并授权实施）
- 交付：4 个任务全部完成。
  - 安徽省行政区树内置数据（省→16 地市→区县→乡镇/街道，代码保留前导零）
  - 行政区查询/展开（`region.ts`，代码前缀匹配：省 2 位、地市 4 位、区县 6 位）
  - 行政区查询 API（`region-routes.ts`：tree/children/validate/expand）
  - 多行政区任务创建（`regionCodes: string[]` + `expandLevel`）
  - 多行政区编排驱动（`multi-region-driver.ts`：行政区串行 → 每行政区多机构）
  - 机构快照行政区去重（`institution_snapshot` 加 `(task_run_id, region_code, official_name)` 唯一约束）
  - 修复驱动生命周期 bug：`runMultiInstitutionPipeline` 加 `completeTask` 标志，多行政区驱动统一 complete
- 验证：backend 11 测试全通过（含多行政区 API：regionCodes 展开 → 合肥 3401xx + 芜湖 3402xx 区县均产出），全量 typecheck/test/build 绿。

### 模块四：暂停/继续/取消与崩溃恢复（已完成）

- 设计：`docs/superpowers/brainstorming/2026-08-08-pause-cancel-recovery-design-input.md`
- 计划：`docs/superpowers/plans/2026-08-08-pause-cancel-recovery.md`
- 决议：R-18（启动 brainstorming）、R-19（计划获批并授权实施）
- 交付：5 个任务全部完成。
  - 每任务 AbortSignal 注册表（`task-signal.ts`）+ 三套驱动协作式检查点
  - 任务控制核心（`task-control.ts`：`pauseTask`/`resumeTask`/`cancelTask`/`duplicateTask` 状态机）
  - 控制 API 4 路由（pause/resume/cancel/duplicate）+ contracts（`TaskControlResponse`/`controlable` + `task.paused/resumed/cancelled` 事件）
  - 崩溃恢复入口（`recovery.ts` `recoverInterruptedTasks` + `server.ts` 启动接入；`task_run.listRecoverable`）
  - 驱动运行态持久化（三驱动进入运行态 `markStarted`）
- 实施中修复的真实缺口：运行态持久化缺失、多行政区驱动吞中止、驱动启动点无信号回退、`cancelTask` 收敛设计修正（详见 R-19）。
- 验证：全量 typecheck/test/build 8 工作区全绿；新增 task-signal 2 / task-control 3 / recovery 2 / app 控制 API 3 测试；全量 113 测试通过。

### 模块五：浏览器升级接入驱动（已完成，Canary 前置）

- 决议：R-20（浏览器升级接入 + 真实安徽多机构闭环 Canary）
- 背景（现场核实）：`browser/render.ts`（`BrowserPool`）/`browser-upgrade.ts` 已实现但从未接入任何驱动；`multi-institution-driver.ts` 只用 `httpFetch`，不消费 `memberDetail.render`。
- 交付：
  - `processSingleInstitution` 补全完整纵向链路（机构入口→领导集合页→成员详情页 HTTP 优先/浏览器升级→硬门槛→Reviewer→非空/空 URL result_row）；
  - Reviewer 独立复抓支持浏览器升级（`refetchFacts` 需渲染时用 `BrowserPool`）；
  - `classifyPage` 增强：纯姓名标题 + 正文含简历结构 → `OFFICIAL_BIOGRAPHY`（真实官网详情页判型覆盖缺口）；
  - `makeRequestKey` 增加机构维度（规格 §18.3：任务+机构+阶段+用途），修复多机构同 URL 撞 `review_job` 唯一约束；
  - `SiteAdapter.regionEntries` + 安徽适配器 `340000 → https://www.ah.gov.cn/`（行政区→真实入口映射）。
- 验证：全量 typecheck/test/build 8 工作区全绿；新增浏览器升级路径测试（真实 Chromium 渲染 JS 动态页）；全量 114 测试通过。

### 模块六：真实安徽完整闭环 Canary + 校准（已完成）

- 决议：R-21（Canary 计划获批执行）、R-22（机构发现校准）、R-23（领导集合页按机构映射 + 无领导页机构如实标记）
- **里程碑：真实安徽官网完整多机构闭环首次跑通**（`安徽省人民政府`，两名主要自然人全部非空 URL）：
  - PRIMARY_1 王清宪（省长）→ `/content/column/6784021?liId=711`
  - PRIMARY_2 王东伟（副省长）→ `/content/column/6784021?liId=1201`
  - 35.6s，production egress + DNS-pinned SSRF + BrowserPool 渲染 + 硬门槛 + Reviewer MATCH。
- Canary 暴露并校准的真实缺陷：
  1. **机构发现**：导航/新闻标题被当机构（过滤正则 + `isInstitutionName` 判定 + 第 4 层短路 + 全链接扫描覆盖 `a.link` 机构容器）；
  2. **领导成员抽取**：`extractPageFacts` 只解析 table，真实官网为「角色分组 + liId 链接」结构 → 增 liId 解析器（姓名 + 分组标题岗位，9 名领导全对）；
  3. **机构类型推断**：`inferInstitutionType` 缺「人民政府」→ `government`（误判 government_department）；
  4. **选人关键词**：`selection.ts` government PRIMARY 加「省长」、SECONDARY 加「副省长」；
  5. **无领导页机构**：部门机构（如省政府办公厅）无领导信息 → 如实标记「该机构无领导信息」（R-23 方向 2）。
- 验证：全量 typecheck/test/build 8 工作区全绿（114 测试）。已知偶发测试竞态：backend 全量多 describe 并发共享资源致个别测试偶发失败，重跑即绿（既有问题，非校准引入）。

### 模块七：全国行政区数据（已完成）

- 决议：R-24（方案 A1：内置生成数据）
- 交付：
  - 全国行政区数据（GB/T 2260 快照，`packages/contracts/src/data/regions/`）：华北/东北/华东/华中/华南/西北 6 区域文件 + 安徽（既有）+ 聚合 `ALL_REGIONS`；
  - `region.ts` 泛化：`listRegions`/`listProvinces`/`regionsByProvince` + 兼容保留 `listAnhuiRegions`/`childrenOf`/`expandRegions`；
  - `region-routes.ts`：`/api/regions/provinces` + tree 支持 `province` 省份筛选；
  - 数据校验测试：省级/地市/区县规模、代码格式（省市区 6 位/乡镇 9 位）、前缀匹配、无孤儿节点、跨省展开。
- 覆盖：34 省级 → 333 地市 → 3000+ 区县（乡镇/街道后续按需扩展）。
- 说明：数据为快照，部分 2023-2025 新设/调整区划可能与知识截止不一致；真实抓取校准（方案 B）留待后续。
- 验证：全量 typecheck/test/build 8 工作区全绿；全量 119 测试通过（contracts 13→18）。

### 模块八：真实 Canary 扩展（省本级多机构）（已完成）

- 决议：R-25（路径 B 省本级深化）、R-26（省政府组成部门）、R-27（子域名授权 + 部门扩展）
- 核验发现：`ah.gov.cn` 首页无省委/人大/政协入口（核心班子在独立域名）；`/site/tpl/2121` 部门列表为 JS 动态渲染（HTTP 静态仅省政府办公厅，浏览器渲染后 21 个部门，入口指向 `*.ah.gov.cn` 子域名）。
- 交付：
  - 安徽适配器 `declaredInstitutions` 扩展为 22 机构（安徽省人民政府 + 21 省政府组成部门）；
  - `hosts` 扩展 `*.ah.gov.cn`；
  - `processSingleInstitution` 修复：声明式模式（有 `declaredInstitutions`）下机构须有显式领导映射，否则如实「该机构无领导信息」（不再错位 fallback 到站点级省领导页）。
- **真实 Canary 结果**（R-21/R-27 授权，37.3s，22 机构 44 行）：
  - 安徽省人民政府：王清宪/王东伟 → 非空 URL（领导闭环）✅
  - 21 省政府组成部门：「该机构无领导信息」空 URL（如实标记）✅
  - 22 机构全部正常终态，无 BLOCKED/FAILED。
- 验证：全量 typecheck/test/build 8 工作区全绿（119 测试）。

### P1：性能与并发（已完成，R-28/R-29/R-30）

- 设计：`docs/superpowers/brainstorming/2026-08-08-p1-performance-concurrency-design-input.md`
- 计划：`docs/superpowers/plans/2026-08-08-p1-performance-concurrency.md`
- 决议：R-28（brainstorming）、R-29（设计获批）、R-30（计划获批并授权实施）
- 交付：
  - `site_profile` Repository（`upsert`/`findByHost`/`recordFetch`，更新 success_rate/avg_duration/failure_signals）；
  - `politeness.ts` 礼貌并发闸（全局 8/站点 2、429/503 退避、自适应降并发）；
  - `http-cache.ts` 内存 LRU 缓存（canonicalKey、TTL 5 分钟、Reviewer 复验绕过 §5.3）；
  - `httpFetch`/`render` 接入可选 `FetchContext`（politeness/cache/cacheBypass/onFetch，向后兼容）；
  - 驱动接入共享 politeness/cache/siteProfile，`fetchCtx` 画像更新回调；
  - 性能基准测试（批次 P95 上限、画像写入）。
- 修复的真实问题：`success_rate` 为 numeric 返回 string（`Number()` 归一化）、`failure_signals` 为 jsonb 返回对象（schema 类型修正为 `Record`）。
- 验证：全量 typecheck/test/build 8 工作区全绿（135 测试）；crawler 43→54、db 12→15、backend 22→24。
- 边界：无新依赖、无 Redis/k6、Reviewer 复验绕过缓存、无真实批量抓取。

### P2：Recovery 完整策略链 + 搜索提供器（已完成，R-31/R-32/R-33）

- 设计：`docs/superpowers/brainstorming/2026-08-09-p2-recovery-search-design-input.md`
- 计划：`docs/superpowers/plans/2026-08-09-p2-recovery-search.md`
- 决议：R-31（brainstorming）、R-32（设计获批）、R-33（计划获批并授权实施）
- 交付：
  - `SearchProvider` 接口 + `FixtureSearchProvider`（离线金标，domain 过滤）；
  - `search_result_cache` Repository（query+provider 唯一，results jsonb）；
  - `recovery-executor.ts` 八步策略执行器（预算 3 次、空转步不耗预算、每步 addAttempt + SSE）；
  - 驱动候选失败路径接入 `runRecovery`：搜索候选 → Reviewer 复核（§15）→ 通过则采纳；
  - `recovery-attempt.listByTask`。
- 修复的真实问题：`search_result_cache.results` 为 jsonb 需 `JSON.stringify` 写入（Kysely 不自动序列化）；预算逻辑修正（空转步不耗预算，保证搜索步可命中）。
- 验证：全量 typecheck/test/build 8 工作区全绿（143 测试）；db 15→17、crawler 54→57、rules 9→12。
- 边界：无真实搜索调用（Fixture 先行）；搜索结果只作 URL 线索（§22）；真实 Brave 提供器待授权。

## 当前可执行验证命令

```bash
# 全量验证（typecheck/test/build）
pnpm typecheck
pnpm test
pnpm build

# 单包验证
pnpm --filter @stellaris/contracts test
pnpm --filter @stellaris/crawler test
pnpm --filter @stellaris/db test
pnpm --filter @stellaris/backend test
pnpm --filter @stellaris/backend exec vitest run src/app.test.ts
pnpm --filter @stellaris/backend exec vitest run src/workers/multi-region-driver.test.ts
```

注：Docker daemon 需运行（Testcontainers 起 PostgreSQL 18）；若停则先启动 Docker Desktop 并等待引擎就绪。

## 待决议 / 下一步

**已上线部署**：`https://stellaris.ac.cn`（服务器 47.238.145.24，lumia 共用 nginx 反代，不影响 lumia/aurora）。开发模块八 + P1 + P2 + P3（已部署）已完成。

**当前流程**：**项目收尾完成（R-69）**——P1~P6 全部规划模块完成并部署；§30 验收清单已核对（剩余 ⏳ 为真实站点性能测量/流式首批，需真实批量抓取授权）；交接文档 `2026-08-09-project-complete.md` 已生成。

后续模块按 `crawler-project-status-and-roadmap.md` 推进（规划模块已全部完成）：

后续模块按 `crawler-project-status-and-roadmap.md` 推进：

1. **P3 Web 完整管理页面**（✅ 已完成，R-38/R-39）
2. **P4 全国/多站点真实校准**（✅ A 部分 + 深度校准完成）
3. **P5 Graphile Worker 持久队列**（✅ 已完成并部署）
4. **P6 可观测性、安全强化与站点画像学习**（✅ 已完成，R-62~R-64）

后续模块按 `crawler-project-status-and-roadmap.md` 推进：

1. **P3 Web 完整管理页面**（✅ 已完成，R-38/R-39）
2. **P4 全国/多站点真实校准**（✅ A 部分 + 深度校准完成）
3. **P5 Graphile Worker 持久队列**（✅ 已完成并部署，R-57~R-61）
4. **P6 可观测性、安全强化与站点画像学习**

后续模块按 `crawler-project-status-and-roadmap.md` 推进：

1. **P3 Web 完整管理页面**（✅ 已完成，R-38/R-39）
2. **P4 全国/多站点真实校准**（✅ A 部分 + 深度校准完成）
3. **P5 Graphile Worker 持久队列**（✅ 已完成，R-57~R-59）
4. **P6 可观测性、安全强化与站点画像学习**

后续模块按 `crawler-project-status-and-roadmap.md` 推进：

1. **P3 Web 完整管理页面**（✅ 已完成，R-38/R-39）
2. **P4 全国/多站点真实校准**（A 部分完成；B 部分待 D2 授权）
3. **P5 Graphile Worker 持久队列**
4. **P6 可观测性、安全强化与站点画像学习**

跨模块待办：**backend 测试隔离加固**、**全国行政区数据真实校准**、**暂停/恢复人工复现**、**真实 Canary 再扩展**（需授权）、**性能门槛真实测量**（30 秒首批/P95≤60s 需真实站点验证）、**真实 Brave 搜索提供器接入**（需授权）。

## 部署记录

- **服务器**：47.238.145.24（ecs-user，lumia_ops_ed25519 密钥）
- **域名**：`https://stellaris.ac.cn`（DNS 已解析，Let's Encrypt 证书 2026-11-06 到期自动续期）
- **服务**：stellaris-postgres（PostgreSQL 18）/ stellaris-backend（node）/ stellaris-web（nginx），数据在 /opt/stellaris
- **反代**：lumia nginx（recreate 加 stellaris-tls.conf 挂载，平滑 reload，lumia/aurora 不受影响）
- **部署文件**：`Dockerfile`（monorepo 容器内构建）、`infra/docker/compose.server.yml`、`infra/docker/nginx-stellaris-tls.conf`
- **修复的部署缺陷**：server env 覆盖证据/导出目录（Linux 兼容）、tsconfig types:node（各包自足）、postgres 18 挂载路径（/var/lib/postgresql）、**fixtureUrl 门槛阻塞驱动启动（R-34）**、**R-35 自动补全精确匹配过严 + 空入口漏 complete + 表单无入口字段（R-37）**
- **验证**：web 200 / health 200 / API 200；线上真实采集验证：安徽省人民政府 → 王清宪/王东伟非空 URL（R-21/R-34/R-37/R-41/R-61 均复现）；安徽省公安厅/省公安厅/「 安徽省人民政府」→ 自动补全成功不再「受限」；P3 任务列表/筛选/行政区/控制链路正常；P5 Graphile Worker 队列投递/执行/暂停线上验证通过；lumia.ac.cn 200 / aurora.ah.cn 200

## 修订记录

- 2026-08-09：R-69 项目收尾——P1~P6 全部规划模块完成并部署；核对 §30 验收清单（更新 roadmap 状态）；生成交接文档 `2026-08-09-project-complete.md`。
- 2026-08-09：R-68 队列指标缺口修复完成并部署——queue.ts emit 接 emitWithMetrics；线上 metrics 计数生效（qualifiedUrls:2/batchCompleted:1）。
- 2026-08-09：R-67 授权队列指标缺口修复（R-66 记录）；R-66 P6 部署线上 + 记录队列指标缺口。
- 2026-08-09：R-64 P6「可观测性、安全强化与站点画像学习」实施完成——Trace（traceId）/指标（metrics 端点）/爬虫陷阱（压缩炸弹/分页）；198 测试全绿；P1~P6 全部规划模块完成。
- 2026-08-09：R-63 P6 实施计划获批并授权实施；R-62 设计输入获批；产出实施计划 `2026-08-09-p6-observability.md`（4 任务）。
- 2026-08-09：R-61 P5 产物部署线上完成——compose 加 STELLARIS_WORKER=1、worker 常驻启动；线上队列投递/执行/暂停验证通过；记录 sudo 与 SSH known_hosts 运维事项。
- 2026-08-09：R-60 授权 P5 部署线上（worker 常驻服务启动）；R-59 P5「Graphile Worker 持久队列」实施完成——worker 入口/投递改造/集成终验；190 测试全绿；记录 require SSE 缺陷与 main() pgPool 缺口；本地端到端验证通过。
- 2026-08-09：R-58 P5 实施计划获批并授权实施；R-57 设计输入获批；产出实施计划 `2026-08-09-p5-graphile-worker.md`（3 任务）。
- 2026-08-09：R-55 授权本地执行地市 Canary（本地 IP 不受服务器侧 403/渲染限制）；R-54 Dockerfile 装 Chromium（线上核验蚌埠/滁州 403、芜湖渲染超时——外部限制如实标记）。
- 2026-08-09：R-52 授权国家级外链机构过滤（R-51 渲染噪声）。
- 2026-08-09：R-51 P4 深度「通用机构发现 selector 覆盖增强」实施完成——栏目词补充 + 浏览器升级；183 测试全绿；滁州抽 35 真实机构、芜湖从 0 到可抽取（含国家级外链噪声如实标记）。
- 2026-08-09：R-50 P4 深度实施计划获批并授权实施；R-49 设计输入获批；产出实施计划 `2026-08-09-p4-discover-selector.md`（3 任务）。
- 2026-08-09：R-49 P4 深度「通用机构发现 selector 覆盖增强」设计输入获批；产出实施计划 `2026-08-09-p4-discover-selector.md`（3 任务），登记为待批准状态。
- 2026-08-09：R-48 导航词过滤增强实施完成 + 地市 Canary 复测——isInstitutionName 增强（导航/年份/申请/站点词排除 + 补「委」）；179 测试全绿；蚌埠抽到真实机构/芜湖暴露 selector 覆盖局限；如实记录。
- 2026-08-09：R-47 授权通用机构发现导航词过滤增强（R-46 校准暴露的误抽问题）。
- 2026-08-09：R-46 行政区隔离修复 + 16 地市 Canary 校准——声明机构仅对声明行政区生效（discover 第 0 层 + declaredRegions + BrowserPool 透传）；Canary 复测隔离生效；暴露地市官网通用发现低质量 + 入口受限（合肥 521/安庆 403/黄山 412/铜陵 000）；全量 177 测试全绿。
- 2026-08-09：R-45 授权执行安徽 16 地市真实校准 Canary（只读边界）。
- 2026-08-09：R-44 P4 实施完成（A 部分离线 + B 部分脚本骨架）——安徽 16 地市 regionEntries、金标 golden.json、准确率评估器 evaluate.ts、174 测试全绿、金标种子准确率 100%；记录 BrowserPool 透传缺口（T5 真实执行待 D2 授权）。
- 2026-08-09：R-43 P4 实施计划获批并授权实施；R-42 设计输入获批；产出实施计划 `2026-08-09-p4-multi-region-accuracy.md`（5 任务）。
- 2026-08-09：R-41 P3 产物部署线上——替换旧版 backend/web 容器；线上验证通过（任务列表/筛选/行政区/控制链路/采集链路）；web 加载新 bundle。
- 2026-08-09：R-40 P3「Web 完整管理页面」实施完成——任务列表端点、RegionPicker、控制按钮+历史视图、两视图重构、全量终验；165 测试全绿；记录 2 项实施中修复缺口。登记待决议下一步（P3 是否部署/推进 P4-P6）。
- 2026-08-09：R-39 P3「Web 完整管理页面」实施计划获批并授权实施；R-38 设计输入获批；产出实施计划 `2026-08-09-p3-web-management.md`（5 任务）。
- 2026-08-09：R-37 修复线上网页采集「全部受限」——根因（R-35 精确匹配过严 + 空入口漏 complete + 表单无入口字段 + 适配器漏配）；修复（容错匹配 matchDeclaredInstitution + 空入口终态 + 表单入口字段 + 补配 7 部门）；本地 147 测试全绿；线上实测安徽省人民政府→王清宪/王东伟非空 URL、安徽省公安厅→补全 gat.ah.gov.cn 不再受限。更新部署记录与状态。
- 2026-08-09：R-36 记录用户反馈「网页全部受限」；创建交接文档 `2026-08-09-deploy-collection-fault.md`（含可复制提示词 + 现状 + 待验证假设），登记为新会话唤起入口。
- 2026-08-09：R-35 修复「官网采集受限」——TARGETED 缺官方入口时从适配器自动补全（安徽已验证：不填入口采集出王清宪/王东伟）；清理 R-34 修复前 3 个遗留 PENDING 任务。
- 2026-08-09：R-34 修复部署故障——`task-routes.ts` 去掉 fixtureUrl 驱动启动门槛，生产环境任务可真实采集；线上验证通过（王清宪/王东伟非空 URL）。
- 2026-08-09：爬虫系统上线部署至生产服务器（47.238.145.24，stellaris.ac.cn）；修复部署缺陷（env 覆盖/tsconfig/postgres 挂载）；lumia nginx 加 stellaris 反代，不影响现有项目。
- 2026-08-08：P1 设计获批（R-29）；产出实施计划 `2026-08-08-p1-performance-concurrency.md`（6 任务，含自审六项检查），登记为待批准状态。
- 2026-08-08：模块七「全国行政区数据」完成（R-24 方案 A1）；生成 6 区域 + 聚合数据、region.ts 泛化、provinces/省份筛选 API、数据校验测试；全量 119 测试全绿。
- 2026-08-08：模块六「真实安徽完整闭环 Canary」首次跑通（两名主要自然人非空 URL）；R-21/R-22/R-23 校准全部实施；记录 5 项真实缺陷校准 + 已知测试竞态。
- 2026-08-08：模块五「浏览器升级接入驱动」完成并全绿（R-20）；补全纵向链路、Reviewer 浏览器升级、classifyPage 判型增强、makeRequestKey 机构维度、regionEntries 映射；呈报真实 Canary 执行计划。
- 2026-08-08：模块四「暂停/继续/取消与崩溃恢复」实施完成并全绿（R-19）；记录实施中修复的 4 个真实缺口；更新待决议/下一步。
- 2026-08-08：产出「暂停/继续/取消与崩溃恢复」实施计划（5 任务，含自审六项检查）；登记为待批准状态。
- 2026-08-08：产出「暂停/继续/取消与崩溃恢复」设计输入（D1 进程内任务控制、D2 协作式取消+状态守卫、D3 四类控制 API、D4 崩溃恢复入口），登记为待审入口。
- 2026-08-08：恢复全绿基线（修复 backend 2 处类型错误：`task-routes.ts` regionCodes 可选收窄、`app.test.ts` results 类型标注）；启动「暂停/继续/取消与崩溃恢复」模块 brainstorming（R-18）；更新待决议/下一步。
- 2026-08-03：创建本总账。记录模块一至三完成状态、17 项开发期决议、真实 Canary 校准结论、待决议下一步。
