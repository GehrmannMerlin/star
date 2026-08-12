# P6「可观测性、安全强化与站点画像学习」模块 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 补齐 §6.2.4 可观测性基线 + 安全爬虫陷阱 + 站点画像信号。Trace 用结构化日志（traceId），指标用进程内计数 + JSON 端点，爬虫陷阱检测压缩炸弹/无限分页。

**Architecture:** 延续模块化单体。Trace：驱动/服务注入 `traceId` 到 pino 日志；指标：`metrics.ts` 进程内计数器 + `GET /api/metrics`；爬虫陷阱：`http-fetch.ts` 增强（压缩炸弹/分页防护 + failure_signals）。无新依赖（R-06）。

**Tech Stack:** pino（已有）、TypeScript 6.0.3 / Node 24.18 / Vitest 4.1 / PostgreSQL 18。无新依赖。

## Global Constraints

- 无新依赖（R-06）：不引 OpenTelemetry/Prometheus，Trace 用结构化日志，指标用进程内计数。
- 不改数据合同/证据链/驱动核心语义。
- Trace：每任务根 Trace（traceId 贯穿日志），Span 覆盖阶段名（范围展开/HTTP/Playwright/抽取/规则/Recovery/Reviewer/Excel）。
- 指标：进程内计数（重启清零）+ `GET /api/metrics`（即时查看）；关键项覆盖 §25.2。
- 爬虫陷阱：超大响应（已有）+ 压缩炸弹 + 无限分页，写入 site_profile failure_signals。
- Squid 出口暂缓（D4，运维项需另行决议）。
- 生产行为必须有先失败测试；禁止 `--passWithNoTests`。

---

## 文件结构映射

### 新建文件

| 文件 | 单一责任 |
|---|---|
| `packages/contracts/src/trace.ts` | `TraceContext`（traceId + span 辅助）类型 |
| `apps/backend/src/workers/metrics.ts` | 进程内指标计数器（increment/record/getSnapshot） |
| `apps/backend/src/workers/metrics.test.ts` | 指标计数测试 |
| `apps/backend/src/contracts/metrics-routes.ts` | `GET /api/metrics` 路由 |

### 修改文件

| 文件 | 修改内容 |
|---|---|
| `apps/backend/src/contracts/task-routes.ts` | 创建任务生成 `traceId`；emit 事件注入指标（result.upserted/reviewed/recovery/terminal） |
| `apps/backend/src/workers/queue.ts` | worker 处理携带 traceId（日志结构化） |
| `packages/crawler/src/http-fetch.ts` | 压缩炸弹检测 + 无限分页防护 + failure_signals |
| `apps/backend/src/server.ts` | 注册 metrics 路由 + metrics 实例注入 |

### 复用（不修改）

- pino logger（server.ts 已有）；site_profile Repository（P1）；
- 驱动 emit 事件（SseEvent）；`assertAllowedUrl`/DNS-pinned SSRF。

---

### Task 1: Trace 基线（traceId 结构化日志）

**Files:**
- Create: `packages/contracts/src/trace.ts`
- Modify: `apps/backend/src/contracts/task-routes.ts`（生成 traceId 贯穿 emit）
- Modify: `apps/backend/src/workers/queue.ts`（worker 日志带 traceId）

**Interfaces:**
```ts
// trace.ts
export interface TraceContext {
  traceId: string;
}
export function newTraceId(): string; // 简短 uuid（无需依赖）
// task-routes：创建任务时 traceId = newTraceId()，emit 事件携带（或日志字段）
// queue.ts：runTaskJob 日志 `logger.info({ traceId, span: "task" }, ...)`
```

- [ ] **Step 1: 写失败测试**
trace.test.ts：`newTraceId` 生成唯一短 id；任务创建日志含 traceId（mock logger 断言）。
Expected: FAIL（模块不存在）。

- [ ] **Step 2: 运行确认先失败**
- [ ] **Step 3: 最小实现**
- [ ] **Step 4: 运行通过**
- [ ] **Step 5: 相关全量验证**
Run: `pnpm --filter @stellaris/contracts test && pnpm --filter @stellaris/backend test`
- [ ] **Step 6: 独立验证检查点**

---

### Task 2: 指标计数器 + `/api/metrics`

**Files:**
- Create: `apps/backend/src/workers/metrics.ts`
- Create: `apps/backend/src/workers/metrics.test.ts`
- Create: `apps/backend/src/contracts/metrics-routes.ts`
- Modify: `apps/backend/src/contracts/task-routes.ts`（emit 事件注入指标）
- Modify: `apps/backend/src/server.ts`（注册路由）

**Interfaces:**
```ts
// metrics.ts
export interface MetricsSnapshot {
  httpRequests: number;
  httpSuccess: number;
  http429: number;
  http403: number;
  http5xx: number;
  browserUpgrades: number;
  reviewerDivergence: number;
  recoverySuccess: number;
  qualifiedUrls: number;
  emptyUrls: number;
  blockedPages: number;
  firstResultMs: number | null;
  batchCompleted: number;
}
export class Metrics {
  increment(k: keyof MetricsSnapshot): void;
  recordFirstResult(ms: number): void;
  snapshot(): MetricsSnapshot;
}
// metrics-routes.ts
app.get("/api/metrics", async () => metrics.snapshot());
// task-routes emit 挂钩：result.upserted → qualified/empty；result.reviewed → reviewer；recovery → recoverySuccess；429/403/5xx → http
```

- [ ] **Step 1: 写失败测试**
metrics.test.ts：increment/snapshot 正确（HTTP 计数、URL 数、分歧率）。
metrics-routes 测试：`GET /api/metrics` 返回 snapshot。
Expected: FAIL（模块不存在）。

- [ ] **Step 2: 运行确认先失败**
- [ ] **Step 3: 最小实现**
- [ ] **Step 4: 运行通过**
- [ ] **Step 5: 相关全量验证**
Run: `pnpm --filter @stellaris/backend test`
- [ ] **Step 6: 独立验证检查点**

---

### Task 3: 爬虫陷阱检测（压缩炸弹 + 无限分页）

**Files:**
- Modify: `packages/crawler/src/http-fetch.ts`

**Interfaces:**
```ts
// http-fetch.ts 增强：
// - 压缩炸弹：响应 content-encoding gzip/deflate，解压后超 maxBytes → OversizedResponseError + failure_signals.push("compression_bomb")
// - 无限分页：URL 深度超过阈值（如 8）或分页参数异常 → 拒绝 + failure_signals.push("pagination_loop")
// 返回/异常带 failureSignals（供 site_profile.recordFetch 记录）
```

- [ ] **Step 1: 写失败测试**
http-fetch 增强测试：mock gzip 超限响应 → 抛压缩炸弹；深 URL → 分页拒绝；failure_signals 正确。
Expected: FAIL（未实现）。

- [ ] **Step 2: 运行确认先失败**
- [ ] **Step 3: 最小实现**
- [ ] **Step 4: 运行通过**
- [ ] **Step 5: 相关全量验证**
Run: `pnpm --filter @stellaris/crawler test`
- [ ] **Step 6: 独立验证检查点**

---

### Task 4: 全量终验 + 本地冒烟

- [ ] **Step 1: 全量验证**
Run: `pnpm typecheck && pnpm test && pnpm build`
Expected: 全部 PASS。
- [ ] **Step 2: 独立验证检查点**
本地启动 backend → 创建任务 → 日志含 traceId；`GET /api/metrics` 返回非空指标；压缩炸弹触发正确错误。
- [ ] **Step 3: 合同一致性自查**
  - `traceId` 贯穿任务日志；metrics 覆盖 §25.2 关键项；failure_signals 写入 site_profile；
  - 无 `--passWithNoTests`；无新依赖。

---

## 自审记录

1. **规格覆盖**：D1-D6 全部映射（Trace→T1、指标→T2、爬虫陷阱→T3、终验→T4）；冻结 §25.1/25.2/§23/§10.3 覆盖。
2. **占位符扫描**：无 TBD/TODO；关键接口含实际签名。
3. **接口一致性**：`Metrics`/`MetricsSnapshot`/`TraceContext` 跨任务一致；复用 pino/驱动 emit/site_profile。
4. **依赖顺序**：Trace→指标→爬虫陷阱→终验。
5. **先失败测试**：每任务含"写失败→确认失败→最小实现→通过→全量验证→独立检查点"。
6. **无越权动作**：无新依赖；Squid 出口暂缓；不改数据合同/证据链。
7. **风险**：指标口径需与驱动 emit 对齐；压缩炸弹检测对正常大响应误判——阈值设 maxBytes 上限。

### 设计输入 → 计划任务映射

| 设计输入章节 | 计划任务 |
|---|---|
| D1 Trace | Task 1 |
| D2 指标 | Task 2 |
| D3 爬虫陷阱 | Task 3 |
| D5 画像信号 + D6 边界 + 终验 | Task 4 |
