# P6「可观测性、安全强化与站点画像学习」模块 设计输入（Brainstorming 结论待审）

> 创建日期：2026-08-09
> 当前状态：**brainstorming 结论，待用户审阅**
> 项目目录：`E:\Stellaris`
> 批准依据：`crawler-project-status-and-roadmap.md` §三 规划模块 P6
> 设计权威：冻结总设计 §25（可观测性）、§23（安全）、§10.3（站点画像）、§6.2.4（可观测性基线）
> 用途：作为 P6 实施计划的设计输入；本文不是实施计划，不授权修改代码

## 1. 目标

补齐 §6.2.4 可观测性基线 + 安全出口 + 站点画像长期学习：

- **Trace**（§25.1）：每任务根 Trace，子 Span 覆盖范围展开/机构冻结/HTTP/Playwright/抽取/规则/Recovery/Reviewer/Excel；
- **指标**（§25.2）：首个已复核结果耗时、批次完成时间、HTTP 请求数/成功率、浏览器升级率、429/403/5xx、Recovery 成功率、Reviewer 分歧率、缓存命中率 等；
- **安全**（§23）：爬虫陷阱检测；统一出口（Squid 可选，见决策）；
- **站点画像学习**（§10.3）：基于已采集画像持续学习（画像表已存在，P1）。

## 2. 现状差距（现场核验事实）

| # | 现状 | 差距 |
|---|---|---|
| 1 | **Trace 完全缺失**：无 OpenTelemetry，仅 pino 基础日志 | §25.1 每任务根 Trace 未实现 |
| 2 | **指标缺失**：无 metrics 收集/导出 | §25.2 全部指标项未实现 |
| 3 | site_profile 已实现（P1，Repository + recordFetch） | §10.3 字段部分满足，但「长期学习」策略未接 |
| 4 | politeness 已实现（P1，并发闸 + 429 退避） | §23 统一出口部分满足 |
| 5 | **爬虫陷阱检测缺失**：无限分页/压缩炸弹/超大响应已部分（P1 Oversized） | §23 爬虫陷阱未系统化 |
| 6 | **Squid 出口缺失**：无统一代理出口 | §23.1 统一出口未达 |

**结论**：P6 核心差距集中在**可观测性（Trace+指标）完全空白** + 安全出口/爬虫陷阱部分缺失。站点画像已有基础。

## 3. 设计决策（brainstorming 结论）

### 决策 D1：Trace 基线（首版最小可行）

- **不引入 OpenTelemetry 依赖**（R-06 无新依赖基线）：用轻量结构化日志实现「任务级 Trace」——每个任务一个 `traceId`，pino 日志携带 `traceId` + `span`（阶段名）+ 耗时；
- 满足 §25.1「每个任务一个根 Trace」的可追溯性（日志按 traceId 过滤），代价是无分布式传播（单进程内足够）；
- 若后续需要分布式，可平滑升级 OTel（接口留 traceId 贯穿）。

### 决策 D2：指标基线

- 新增 `apps/backend/src/workers/metrics.ts`：内存计数器（JSON 端点 `GET /api/metrics`）；
- 采集：HTTP 请求数/成功率、429/403/5xx、浏览器升级率、Reviewer 分歧率、Recovery 成功率、合格/空 URL 数、缓存命中率、首个结果耗时、批次耗时；
- 数据源：驱动 emit 事件 + httpFetch/render onFetch 回调（P1 已有 onFetch）+ result_row 投影；
- 持久化：可选落库（metrics 表）或仅进程内（重启清零）——建议首版进程内 + JSON 端点（§25.2 指标即时查看）。

### 决策 D3：爬虫陷阱检测（§23）

- `http-fetch.ts` 增强：超大响应（已有 Oversized）+ 压缩炸弹（响应头 content-encoding 解压后超限）+ 无限分页（URL 深度/参数分页防护）；
- 在 `assertAllowedUrl`/`httpFetch` 层加陷阱信号收集（failure_signals，P1 site_profile 已有字段）。

### 决策 D4：统一出口（Squid）——待授权/暂缓

- **建议暂缓 Squid sidecar**（§23.1 统一出口）：当前直连 egress（DNS-pinned SSRF 已防私网），无代理场景；Squid 是运维基础设施（新容器/配置），非代码；
- 若后续需要统一出口（审计/合规），另行决议；
- 本决议仅做爬虫陷阱检测 + 现有出口的完善。

### 决策 D5：站点画像学习

- 复用 site_profile（P1）：`recordFetch` 已更新 success_rate/avg_duration/failure_signals；
- 补「推荐抓取方式」决策：画像驱动 HTTP vs Playwright 路由（§10.3）——当前是 `memberDetail.render` 静态声明，画像学习为进阶；
- 首版：画像字段确认 + 记录 429/403/5xx 信号（P1 已部分），长期学习留待后续。

### 决策 D6：边界

- 无新依赖（R-06）：Trace 用结构化日志，指标用进程内计数，不引 OTel/Prometheus；
- Squid 出口暂缓（D4）；登录与角色不实现（§19 暂缓项）；
- 不改数据合同/证据链/驱动核心语义。

## 4. 验收

- 任务执行日志含 `traceId`（按任务过滤可追溯完整链路）；
- `GET /api/metrics` 返回 §25.2 关键指标（HTTP 成功率/429/5xx/升级率/分歧率/URL 数等）；
- 爬虫陷阱（超大响应/压缩炸弹）返回明确错误与 failure_signals；
- 全量回归 typecheck/test/build 全绿。

## 5. 打开问题

1. **指标持久化**：进程内（重启清零）vs 落库——建议进程内 + JSON 端点（即时查看，最小实现）；
2. **Trace 是否需要 OTel**：建议轻量日志 traceId（无新依赖），OTel 留待分布式需求；
3. **画像学习深度**：首版记录信号 vs 完整学习——建议首版信号确认，学习策略后续。

## 6. 边界与授权

- 本设计输入待用户审阅；批准后产出实施计划；
- Squid 出口（D4）本模块不做（运维基础设施，需另行决议）；
- `E:\Stellaris` 非 Git 仓库，不初始化。

## 7. 修订记录

- 2026-08-09：创建。基于 §25/§23/§10.3 与现场核验产出。
