# P1「性能与并发」模块 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 达成冻结 §26.1 性能门槛（页面 30 秒内显示已复核结果、已知候选批次 P95 ≤60 秒），并为真实多站点抓取提供礼貌性与效率基础：站点画像（§10.3）、并发/限速/退避（§11）、HTTP 缓存（§11.3，Reviewer 复验绕过）。

**Architecture:** 延续模块化单体 + 进程内编排。新增「站点画像 Repository」（复用既有 `site_profile` 表）、「礼貌并发闸」（`politeness.ts`，全局+站点级并发、429/503 退避、自适应降并发）、「内存 LRU 缓存」（`http-cache.ts`，Reviewer 绕过）、性能基准测试。不引入 Redis/Kafka/k6（§6.2 排除）。

**Tech Stack:** 复用全栈（TypeScript 6.0.3 / Node 24.18 / Vitest 4.1 / PostgreSQL 18 / Kysely 0.29.4）；无新依赖。

## Global Constraints

- 本模块不改变已批准数据合同与证据链：`result_row`/`institution_snapshot`/`review_decision`/`export_artifact` 结构不变。
- `site_profile`/`robots_cache` 表已存在（migration 001），本模块仅补 Repository 与读写，不重建表；如需字段扩展走新 migration-003（仅当现有字段不足时）。
- 安全边界沿用：DNS-pinned SSRF、逐跳重定向、脱敏、robots；不登录、不解验证码、不绕过访问控制。
- **Reviewer 复验不被缓存绕过**（冻结 §5.3）：Reviewer 的 `refetchFacts` 必须绕过缓存直连。
- 生产行为必须有先失败测试；禁止 `--passWithNoTests`。
- 暂缓（不删除）：Redis/Kafka、k6 压测、跨进程共享缓存、真实批量抓取。

---

## 文件结构映射

### 新建文件

| 文件 | 单一责任 |
|---|---|
| `packages/db/src/repos/site-profile.ts` | `site_profile` Repository（upsert/findByHost） |
| `packages/crawler/src/polite/politeness.ts` | 全局+站点级并发闸、429/503 退避、自适应降并发 |
| `packages/crawler/src/polite/politeness.test.ts` | 并发闸/退避测试 |
| `packages/crawler/src/http-cache.ts` | 内存 LRU 缓存（按 canonicalKey，Reviewer 绕过） |
| `packages/crawler/src/http-cache.test.ts` | 缓存命中/绕过/失效测试 |
| `apps/backend/src/workers/site-profile.test.ts` | 画像读写 + 驱动接入集成测试 |

### 修改文件

| 文件 | 修改内容 |
|---|---|
| `packages/db/src/repos/index.ts` | 注册 `siteProfile` |
| `packages/db/src/schema.ts` | 若需画像字段扩展（`max_concurrency`/`retry_after`）——**仅在现有字段不足时** |
| `packages/crawler/src/http-fetch.ts` | `httpFetch` 接受可选 `politeness`/`cache` 上下文；成功后更新画像 |
| `packages/crawler/src/browser/render.ts` | `render` 接受可选 `politeness`；成功后更新画像 |
| `packages/crawler/src/index.ts` | 导出 politeness/http-cache |
| `apps/backend/src/workers/multi-institution-driver.ts` | 驱动接入画像查询 + 并发闸 + 缓存 |

### 复用（不修改）

- `site_profile` 表（migration 001）、`robots_cache` 表；
- `httpFetch`/`BrowserPool`（加可选上下文，默认无兼容既有测试）；
- `canonicalKeyFor`（http-fetch 内部去重键）；
- 三套驱动纵向链路。

---

### Task 1: site_profile Repository + 画像读写

**Files:**
- Create: `packages/db/src/repos/site-profile.ts`
- Modify: `packages/db/src/repos/index.ts`

**Interfaces:**
```ts
export class SiteProfileRepository {
  async upsert(input: { host: string; fetchMode: FetchMode; domFingerprint?: string | null; waitCondition?: string | null; currentLeaderEntry?: string | null; avgDurationMs?: number | null; successRate?: number | null; lastVerifiedAt?: string | null; failureSignals?: string | null }): Promise<SiteProfileRow>;
  async findByHost(host: string): Promise<SiteProfileRow | undefined>;
  async recordFetch(host: string, input: { ok: boolean; durationMs: number; fetchMode: FetchMode; retryAfterMs?: number }): Promise<void>;
}
```
`recordFetch` 更新 avg_duration_ms（滚动平均）、success_rate、last_verified_at、failure_signals（429/5xx）。

- [ ] **Step 1: 写失败测试**
`site-profile` 测试（db 包）：
```ts
it("upsert 后 findByHost 返回画像", async () => { ... });
it("recordFetch 更新 success_rate 与 avg_duration", async () => { ... });
it("429 后 failure_signals 记录", async () => { ... });
```
Expected: FAIL（Repository 不存在）。

- [ ] **Step 2: 运行确认先失败**
Run: `pnpm --filter @stellaris/db test`
Expected: FAIL。

- [ ] **Step 3: 最小实现**
site-profile.ts + index.ts 注册。

- [ ] **Step 4: 运行通过**
Expected: PASS。

- [ ] **Step 5: 相关全量验证**
Run: `pnpm --filter @stellaris/db typecheck && pnpm test`
Expected: PASS。

- [ ] **Step 6: 独立验证检查点**
Run: `pnpm --filter @stellaris/db test`
Expected: 退出码 0。

---

### Task 2: 礼貌并发闸（politeness.ts）

**Files:**
- Create: `packages/crawler/src/polite/politeness.ts`
- Create: `packages/crawler/src/polite/politeness.test.ts`

**Interfaces:**
```ts
export interface PolitenessOptions {
  globalMaxConcurrency?: number;      // 默认 8
  siteMaxConcurrency?: number;        // 默认 2（保守礼貌）
  retryAfterCapMs?: number;           // 默认 30_000
}
export class PolitenessGate {
  constructor(opts?: PolitenessOptions);
  async acquire(host: string): Promise<() => void>;   // 获取站点+全局并发槽；返回释放函数
  recordError(host: string, status: number, retryAfterMs?: number): void;  // 429/503 退避 + 降并发
  getSiteConcurrency(host: string): number;            // 画像查询当前建议并发
}
```

- [ ] **Step 1: 写失败测试**
```ts
it("并发超上限时排队", async () => { ... });   // 站点并发 2，第 3 个 acquire 排队
it("429 后 retryAfter 退避，期间 acquire 等待", async () => { ... });
it("连续错误降低站点并发", async () => { ... });   // 自适应
it("释放后槽位可复用", async () => { ... });
```
Expected: FAIL。

- [ ] **Step 2: 运行确认先失败**
Expected: FAIL。

- [ ] **Step 3: 最小实现**
politeness.ts（信号量 + 站点并发表 + 退避时间戳）。

- [ ] **Step 4: 运行通过**
Expected: PASS。

- [ ] **Step 5: 相关全量验证**
Run: `pnpm --filter @stellaris/crawler typecheck && pnpm test`
Expected: PASS。

- [ ] **Step 6: 独立验证检查点**
Run: `pnpm --filter @stellaris/crawler test`
Expected: 退出码 0。

---

### Task 3: HTTP 内存 LRU 缓存（Reviewer 绕过）

**Files:**
- Create: `packages/crawler/src/http-cache.ts`
- Create: `packages/crawler/src/http-cache.test.ts`

**Interfaces:**
```ts
export class HttpCache {
  constructor(opts?: { maxEntries?: number; ttlMs?: number });  // 默认 500 / 300_000
  get(key: string): Uint8Array | undefined;
  set(key: string, body: Uint8Array): void;
  // 仅 GET + 无 Cache-Control:no-store 才缓存；Reviewer 调用方传 bypass=true。
}
```
缓存键用 `http-fetch` 的 `canonicalKey`；TTL 默认 5 分钟。**Reviewer 的 `refetchFacts` 必须 bypass**（§5.3）。

- [ ] **Step 1: 写失败测试**
```ts
it("set/get 命中；TTL 过期失效", async () => { ... });
it("no-store 响应不缓存", async () => { ... });
it("maxEntries 淘汰最久未用", async () => { ... });
```
Expected: FAIL。

- [ ] **Step 2: 运行确认先失败**
Expected: FAIL。

- [ ] **Step 3: 最小实现**
http-cache.ts（Map + LRU 链表或简化时间戳排序）。

- [ ] **Step 4: 运行通过**
Expected: PASS。

- [ ] **Step 5: 相关全量验证**
Run: `pnpm --filter @stellaris/crawler typecheck && pnpm test`
Expected: PASS。

- [ ] **Step 6: 独立验证检查点**
Run: `pnpm --filter @stellaris/crawler test`
Expected: 退出码 0。

---

### Task 4: httpFetch/render 接入 politeness + cache + 画像更新

**Files:**
- Modify: `packages/crawler/src/http-fetch.ts`
- Modify: `packages/crawler/src/browser/render.ts`
- Modify: `packages/crawler/src/index.ts`

**Interfaces:**
```ts
export interface FetchContext {
  politeness?: PolitenessGate;
  cache?: HttpCache;
  cacheBypass?: boolean;          // Reviewer 复验传 true（§5.3）
  siteProfile?: SiteProfileRepository;  // 画像更新（需 db 类型注入，避免 crawler 依赖 db——用回调）
  onFetch?: (host: string, info: { ok: boolean; durationMs: number; status: number; retryAfterMs?: number }) => void;
}
export async function httpFetch(url: string, policy: SafeEgressPolicy, ctx?: FetchContext): Promise<HttpResponse>;
```
- `httpFetch` 开头：`ctx.politeness?.acquire(host)`（try/finally 释放）；
- 缓存：`cacheBypass` 时跳过缓存直连；否则 `cache.get(canonicalKey)` 命中直接返回；
- 成功后 `ctx.onFetch?.({ ok: true, ... })`（更新画像）；429/503 时 `ctx.politeness?.recordError`。

`render.ts` 同理（浏览器池加 politeness 并发，不缓存渲染结果）。

- [ ] **Step 1: 写失败测试**
`http-fetch` 既有测试兼容（无 ctx 时行为不变）+ 新增 ctx 测试（并发/缓存/onFetch）。

- [ ] **Step 2: 运行确认先失败**
Expected: FAIL。

- [ ] **Step 3: 最小实现**
- [ ] **Step 4: 运行通过**
- [ ] **Step 5: 相关全量验证**
Run: `pnpm --filter @stellaris/crawler typecheck && pnpm test`
- [ ] **Step 6: 独立验证检查点**

---

### Task 5: 驱动接入画像 + 并发闸 + 缓存 + 性能基准

**Files:**
- Modify: `apps/backend/src/workers/multi-institution-driver.ts`
- Create: `apps/backend/src/workers/site-profile.test.ts`

**Interfaces:**
- 驱动创建共享 `PolitenessGate` + `HttpCache` + `siteProfile` Repository，注入 `processSingleInstitution`；
- 抓取前查画像决定 HTTP/浏览器（`fetch_mode`）、站点并发（`max_concurrency`）；
- `httpFetch`/`render` 传 ctx（politeness/cache/onFetch→siteProfile）；
- **性能基准测试**：fixture 下 10-20 URL 批次，断言 P95 ≤60s + 30 秒内首批 SSE。

- [ ] **Step 1: 写失败测试**
`site-profile.test.ts`：真实 PostgreSQL + fixture，多机构驱动跑通 + 画像被写入 + 缓存命中。
- [ ] **Step 2: 运行确认先失败**
- [ ] **Step 3: 最小实现**
- [ ] **Step 4: 运行通过**
- [ ] **Step 5: 相关全量验证**
Run: `pnpm --filter @stellaris/backend typecheck && pnpm test`
- [ ] **Step 6: 独立验证检查点**

---

### Task 6: 全量终验

- [ ] **Step 1: 全量验证**
Run: `pnpm typecheck && pnpm test && pnpm build`
Expected: 全部 PASS（8 工作区全绿）。
- [ ] **Step 2: 独立验证检查点**
Expected: 退出码 0。
- [ ] **Step 3: 合同一致性自查**
- `PolitenessGate`/`HttpCache` 从 crawler index 导出；
- `httpFetch`/`render` 无 ctx 时行为与既有测试一致（向后兼容）；
- Reviewer `refetchFacts` 明确 `cacheBypass: true`；
- `siteProfile` 注册进 Repositories 且 db 类型通过。

---

## 自审记录

1. **规格覆盖**：设计输入 D1-D5 全部映射（画像→T1/T5、并发闸→T2、缓存→T3、接入→T4、性能基准→T5、终验→T6）；冻结 §5.3/§10.3/§11/§14.1/§26.1 覆盖。
2. **占位符扫描**：无 TBD/TODO；关键接口含实际签名。
3. **接口一致性**：`httpFetch`/`render` 的 `FetchContext` 可选（向后兼容）；`PolitenessGate`/`HttpCache`/`SiteProfileRepository` 跨任务签名一致。
4. **依赖顺序**：画像→并发闸→缓存→接入→驱动+基准→终验。
5. **先失败测试**：每任务含"写失败→确认失败→最小实现→通过→全量验证→独立检查点"。
6. **无越权动作**：无新依赖、无 Redis/k6、无真实批量抓取；migration 仅在现有字段不足时新增（预计无需）。
7. **风险**：缓存过期风险由短 TTL（5 分钟）+ Reviewer 绕过控制；并发闸保守默认（站点 2、全局 8）避免触发站点限流。

### 设计输入 → 计划任务映射

| 设计输入章节 | 计划任务 |
|---|---|
| D1 站点画像 | Task 1 + Task 5 |
| D2 并发/限速/退避 | Task 2 |
| D3 HTTP 缓存 | Task 3 |
| D2/D3 注入 | Task 4 |
| D4 性能基准 | Task 5 |
| D5 边界 + 终验 | Task 6 |
