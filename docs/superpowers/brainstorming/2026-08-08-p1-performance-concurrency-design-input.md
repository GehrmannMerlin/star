# P1「性能与并发」模块 设计输入（Brainstorming 结论待审）

> 创建日期：2026-08-08
> 当前状态：**brainstorming 结论，待用户审阅**
> 项目目录：`E:\Stellaris`
> 批准依据：开发期决策日志 R-28（启动 P1 brainstorming）
> 设计权威：冻结总设计 `2026-07-30-official-biography-crawler-design.md`（§10.3 站点画像、§11 并发/礼貌性/缓存、§14.1 网络重试、§26.1 性能门槛）
> 用途：作为 P1 实施计划的设计输入；本文不是实施计划，不授权修改代码

## 1. 目标

达成冻结 §26.1 性能门槛，并为真实多站点抓取提供礼貌性与效率基础：
- **页面 30 秒内显示已复核结果**（SSE 首批流式）；
- **已知候选批次 P95 ≤60 秒**；
- 全局/单主机并发控制 + 自适应退避（不触发站点 429/封禁）；
- 站点画像（§10.3）：画像决定 HTTP/Playwright/公开接口路由与限速，7 天并抽样复验；
- HTTP 缓存/去重，正式网络复验不被缓存绕过（§5.3）。

## 2. 现状差距（现场核验事实）

| # | 现状 | 与冻结设计的差距 |
|---|---|---|
| 1 | `http-fetch.ts` 每次裸请求，**无并发/限速/退避/缓存** | §11 并发模型、§11.3 缓存全缺 |
| 2 | `SafeEgressPolicy` 只有端口/重定向/大小/超时上限 | 无 concurrency/rateLimit 语义 |
| 3 | `site_profile` 表**已存在**（migration 001，host 唯一）但**无写入/读取实现** | §10.3 画像未实现 |
| 4 | Recovery 有 `site_profile_entry` 步骤（§14.3 八步）但**不读画像** | Recovery 依赖画像未接通 |
| 5 | 驱动串行 `Promise.all` 小并发（`concurrency=3`） | §11 自适应并发未实现 |
| 6 | 无性能基准测试 | §26.1 门槛无测量手段 |
| 7 | SSE 已按 seq 流式 | 30 秒首批依赖并发（P1） |

## 3. 设计决策（brainstorming 结论）

### 决策 D1：站点画像（§10.3）

- **数据**：复用现有 `site_profile` 表（host 唯一），补 Repository `siteProfile`（upsert/findByHost）。
- **字段**（对齐 §10.3）：`host`、`robots` 摘要、`js_rendered`（是否需要 Playwright）、`fetch_mode`（HTTP/PLAYWRIGHT/PUBLIC_API 建议）、`max_concurrency`（站点礼貌上限）、`retry_after`（最近 429 记录）、`last_verified_at`（7 天抽样复验）。
- **写入时机**：每次 `httpFetch`/`render` 后更新画像（JS 渲染判定、429/503 记录）。
- **读取时机**：`processSingleInstitution` 抓取前查画像，决定 HTTP 优先 or 浏览器升级 + 限速。

### 决策 D2：并发与限速（§11）

- **新增 `packages/crawler/src/polite/politeness.ts`**：
  - 全局并发闸（单主机上限，§11.1/11.2）；
  - 站点级并发闸（画像 `max_concurrency`，默认保守 2-4）；
  - 429/503 Retry-After 等待（§14.1：按服务端时间等待并降低主机并发）；
  - 自适应退避（连续错误降并发）。
- **注入点**：`httpFetch` 接受可选 `politeness` 上下文（默认无，兼容既有测试）；驱动传入共享闸。

### 决策 D3：HTTP 缓存（§11.3）

- **内存 LRU 缓存**（无新依赖，进程内）：
  - 按 `canonicalKey` 缓存正文 + 响应头；
  - **GET 且无 Cache-Control: no-store 才缓存**；
  - 正式网络复验（Reviewer）**不走缓存**（§5.3「正式网络复验不能被缓存绕过」）；
  - 默认缓存 TTL 短（如 5 分钟），避免陈旧。

### 决策 D4：性能门槛（§26.1）

- **新增性能基准测试**（vitest 或独立脚本）：
  - 已知候选批次（10-20 URL）处理 P95 ≤60 秒；
  - 30 秒内首批 SSE 结果事件；
- **优化点**：并发闸放行、Reviewer 并行、缓存命中率、浏览器池复用。

### 决策 D5：范围边界（暂缓不删除）

- 不引入 Redis/Kafka（§6.2 排除）；
- 不做 k6 压测（需授权）；
- 不做跨进程共享缓存（单进程内存缓存先行）。

## 4. 建议任务划分（供实施计划参考）

| 任务 | 内容 | 离线可测 |
|---|---|---|
| P1-T1 | `site_profile` Repository + 画像读写（httpFetch 后更新、驱动前查询） | ✅ |
| P1-T2 | `politeness.ts` 并发/限速/退避闸，`httpFetch` 注入 | ✅ |
| P1-T3 | HTTP 内存 LRU 缓存（Reviewer 绕过） | ✅ |
| P1-T4 | 驱动接入画像 + 并发闸 + 缓存；SSE 首批流式确认 | ✅（fixture） |
| P1-T5 | 性能基准测试（批次 P95 + 30 秒首批） | ✅（离线） |
| P1-T6 | 全量回归 | ✅ |

## 5. 边界与授权范围

- 本模块**仅 brainstorming**；不授权实施。
- 不改变已批准数据合同/证据链（`site_profile` 表扩展字段需 migration，属数据层新增）。
- 不引入新依赖、不做性能压测（k6）、不做真实批量抓取（均需逐项授权）。
- 站点画像写入基于既有抓取行为（不新增真实请求）。

## 6. 修订记录

- 2026-08-08：依据 R-28 创建第一版。五项关键设计决策已确认（站点画像复用表、并发/限速闸、内存 LRU 缓存、性能基准、范围边界）。
