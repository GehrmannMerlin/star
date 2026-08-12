# P2「Recovery 完整策略链 + 搜索提供器」模块 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 Recovery 从「触发判定」升级为「**改变策略的完整执行**」，并接入搜索提供器（§22）。Recovery 触发后按 §14.3 八步顺序改变发现/验证策略，每步更新 `recovery_attempt` 与中文终态；搜索提供器统一接口，结果只作 URL 线索，不成为最终 URL/当前性证据（§22）。

**Architecture:** 延续模块化单体 + 进程内编排。新增「Recovery 策略执行器」（`recovery-executor.ts`，八步 + 预算 3 次）、「搜索提供器接口」（`packages/crawler/src/search/provider.ts`）+ `FixtureSearchProvider`（离线金标，Brave 等真实提供器待授权）、`search_result_cache` Repository（复用既有表）。不引入真实搜索调用（需逐项授权）。

**Tech Stack:** 复用全栈（TypeScript 6.0.3 / Node 24.18 / Vitest 4.1 / PostgreSQL 18 / Kysely 0.29.4）；无新依赖。

## Global Constraints

- 本模块不改变已批准数据合同与证据链：`recovery_attempt`/`search_result_cache` 表结构不变（复用既有）。
- Recovery 必须改变入口或验证方式，不得只是刷新原页面（§14.3）。
- 搜索结果只作 URL 发现线索；搜索页/标题/摘要**不能成为最终 URL 或当前性证据**（§22）。
- Recovery 产出候选须走 Reviewer 复核（不跳过 §15）。
- 安全边界沿用：DNS-pinned SSRF、逐跳重定向、robots；搜索结果 URL 必须过 `assertAllowedUrl`。
- Reviewer 复验不被缓存绕过（§5.3，P1 已保证）。
- 生产行为必须有先失败测试；禁止 `--passWithNoTests`。
- 暂缓（不删除）：Brave/Google/SearXNG 真实提供器（需授权）、跨进程共享搜索缓存。

---

## 文件结构映射

### 新建文件

| 文件 | 单一责任 |
|---|---|
| `packages/crawler/src/search/provider.ts` | `SearchProvider` 接口 + `SearchResult` 类型 |
| `packages/crawler/src/search/fixture-provider.ts` | 离线金标搜索提供器（测试/Recovery 校验） |
| `packages/crawler/src/search/provider.test.ts` | 提供器接口与 fixture 行为测试 |
| `packages/db/src/repos/search-cache.ts` | `search_result_cache` Repository（upsert/findByQuery） |
| `packages/db/src/repos/search-cache.test.ts` | 搜索缓存仓储测试 |
| `packages/rules/src/recovery-executor.ts` | Recovery 策略执行器（八步 + 预算） |
| `packages/rules/src/recovery-executor.test.ts` | 执行器策略链测试 |

### 修改文件

| 文件 | 修改内容 |
|---|---|
| `packages/db/src/repos/index.ts` | 注册 `searchCache` |
| `packages/crawler/src/index.ts` | 导出 search 模块 |
| `apps/backend/src/workers/multi-institution-driver.ts` | 候选失败路径接入 `recoveryExecutor` |

### 复用（不修改）

- `recovery_attempt` 表 + `RecoveryAttemptRepository.addAttempt`；
- `search_result_cache` 表（migration 001）；
- `decideRecovery`/`buildRecoveryOrder`（recovery.ts）；
- Reviewer（`runReviewer`）、`assertAllowedUrl`（SSRF）、P1 的 politeness/cache。

---

### Task 1: 搜索提供器接口 + Fixture 提供器 + search_result_cache Repository

**Files:**
- Create: `packages/crawler/src/search/provider.ts`
- Create: `packages/crawler/src/search/fixture-provider.ts`
- Create: `packages/crawler/src/search/provider.test.ts`
- Create: `packages/db/src/repos/search-cache.ts`
- Create: `packages/db/src/repos/search-cache.test.ts`
- Modify: `packages/db/src/repos/index.ts`

**Interfaces:**
```ts
// provider.ts
export interface SearchResult {
  title: string;
  summary: string | null;
  url: string;
  rank: number;
  timestamp?: string;
}
export interface SearchProvider {
  search(query: string, opts: { domain?: string; pageToken?: string }): Promise<{
    results: SearchResult[];
    nextToken?: string;
    providerError?: string;
    durationMs: number;
  }>;
}
// fixture-provider.ts
export class FixtureSearchProvider implements SearchProvider { ... }  // 返回金标结果，domain 过滤
// search-cache.ts
export class SearchCacheRepository {
  async upsert(input: { query: string; provider: string; paginationToken?: string | null; results: string | null; cachedAt: string }): Promise<SearchResultCacheRow>;
  async findByQuery(query: string, provider: string): Promise<SearchResultCacheRow | undefined>;
}
```

- [ ] **Step 1: 写失败测试**
provider.test.ts：`FixtureSearchProvider` 返回金标结果、domain 过滤、rank 顺序。
search-cache.test.ts：upsert/findByQuery（query+provider 唯一）。
Expected: FAIL（模块不存在）。

- [ ] **Step 2: 运行确认先失败**
- [ ] **Step 3: 最小实现**
- [ ] **Step 4: 运行通过**
- [ ] **Step 5: 相关全量验证**
Run: `pnpm --filter @stellaris/crawler test && pnpm --filter @stellaris/db test`
- [ ] **Step 6: 独立验证检查点**

---

### Task 2: Recovery 策略执行器（八步 + 预算）

**Files:**
- Create: `packages/rules/src/recovery-executor.ts`
- Create: `packages/rules/src/recovery-executor.test.ts`

**Interfaces:**
```ts
export interface RecoveryExecutorInput {
  taskRunId: string;
  institutionSnapshotId: string;
  personName: string | null;
  institutionName: string;
  repos: Repositories;
  policy: SafeEgressPolicy;
  evidenceStore: EvidenceStore;
  evidenceRoot: string;
  searchProvider?: SearchProvider;   // 缺省用 Fixture
  politeness?: PolitenessGate;
  httpCache?: HttpCache;
  maxBudget?: number;                // 默认 3
  emit: (e: SseEvent) => void;
}
export async function runRecovery(input: RecoveryExecutorInput): Promise<{ candidateUrl: string | null; strategiesUsed: string[] }>;
// 按 buildRecoveryOrder() 八步执行，每步：
// - 判定可用入口（site_profile_entry→画像 current_leader_entry；sitemap_site_search→站内搜索；domain_limited_external_search→searchProvider）
// - 尝试抓取/搜索 → 抽取 → 判型 → 命中合格候选则返回
// - 每步 addAttempt(strategy/result/budgetUsed) + SSE recovery_started
// 八步全失败 → candidateUrl=null（调用方写空 URL 中文终态）
```

- [ ] **Step 1: 写失败测试**
recovery-executor.test.ts：fixture 下「搜索提供器命中合格候选 → 返回 URL」「八步全失败 → null」「预算超限停止」「每步写 recovery_attempt」。
Expected: FAIL。

- [ ] **Step 2: 运行确认先失败**
- [ ] **Step 3: 最小实现**
- [ ] **Step 4: 运行通过**
- [ ] **Step 5: 相关全量验证**
Run: `pnpm --filter @stellaris/rules test`
- [ ] **Step 6: 独立验证检查点**

---

### Task 3: 驱动接入 Recovery 执行

**Files:**
- Modify: `apps/backend/src/workers/multi-institution-driver.ts`

**Interfaces:**
- `processSingleInstitution` 候选失败路径（Reviewer 不一致/硬门槛失败）→ 触发 `runRecovery`（注入 repos/policy/searchProvider/politeness/httpCache）；
- Recovery 产出候选 → 走 Reviewer 复核 + 硬门槛（不跳过 §15）→ 通过则写非空 result_row；
- Recovery 返回 null → 空 URL + 中文终态。

- [ ] **Step 1: 写失败测试**
driver 集成测试：fixture 下候选失败 → Recovery 搜索命中 → Reviewer MATCH → 非空 URL。
- [ ] **Step 2: 运行确认先失败**
- [ ] **Step 3: 最小实现**
- [ ] **Step 4: 运行通过**
- [ ] **Step 5: 相关全量验证**
Run: `pnpm --filter @stellaris/backend test`
- [ ] **Step 6: 独立验证检查点**

---

### Task 4: 全量终验

- [ ] **Step 1: 全量验证**
Run: `pnpm typecheck && pnpm test && pnpm build`
Expected: 全部 PASS。
- [ ] **Step 2: 独立验证检查点**
- [ ] **Step 3: 合同一致性自查**
- `SearchProvider`/`FixtureSearchProvider` 从 crawler index 导出；
- `searchCache` 注册进 Repositories；
- Recovery 产出候选走 Reviewer；搜索 URL 过 `assertAllowedUrl`；
- 无 `--passWithNoTests`。

---

## 自审记录

1. **规格覆盖**：设计输入 D1-D4 全部映射（搜索提供器→T1、Recovery 执行器→T2、驱动接入→T3、终验→T4）；冻结 §5.3/§14.2/§14.3/§15/§22 覆盖。
2. **占位符扫描**：无 TBD/TODO；关键接口含实际签名。
3. **接口一致性**：`SearchProvider`/`runRecovery` 跨任务签名一致；复用 `addAttempt`/`decideRecovery`/`buildRecoveryOrder`/Reviewer。
4. **依赖顺序**：搜索提供器→执行器→驱动接入→终验。
5. **先失败测试**：每任务含"写失败→确认失败→最小实现→通过→全量验证→独立检查点"。
6. **无越权动作**：无真实搜索调用（Fixture 先行）、无新依赖、无真实批量抓取；搜索结果只作 URL 线索。
7. **风险**：搜索提供器真实调用需授权——本计划全部离线（Fixture）；真实 Brave 接入列为后续授权项。

### 设计输入 → 计划任务映射

| 设计输入章节 | 计划任务 |
|---|---|
| D2 搜索提供器接口 + Fixture | Task 1 |
| D1 Recovery 执行器 | Task 2 |
| D3 驱动接入 | Task 3 |
| D4 边界 + 终验 | Task 4 |
