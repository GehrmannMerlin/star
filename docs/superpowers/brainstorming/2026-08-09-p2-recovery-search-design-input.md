# P2「Recovery 完整策略链 + 搜索提供器」模块 设计输入（Brainstorming 结论待审）

> 创建日期：2026-08-09
> 当前状态：**brainstorming 结论，待用户审阅**
> 项目目录：`E:\Stellaris`
> 批准依据：开发期决策日志 R-31（启动 P2 brainstorming）
> 设计权威：冻结总设计 `2026-07-30-official-biography-crawler-design.md`（§14.2/14.3 Recovery、§22 搜索提供器、§5.3 复验不被缓存绕过）
> 用途：作为 P2 实施计划的设计输入；本文不是实施计划，不授权修改代码

## 1. 目标

把 Recovery 从「触发判定」升级为「**改变策略的完整执行**」，并接入搜索提供器：
- Recovery 触发后，按 §14.3 八步顺序改变发现/验证策略，每步更新 `recovery_attempt` 与中文终态；
- 搜索提供器（§22）：统一 Provider 接口，结果只作 URL 发现线索，不成为最终 URL/当前性证据；
- 当前性复验不被缓存绕过（§5.3，P1 已保证）。

## 2. 现状差距（现场核验事实）

| # | 现状 | 差距 |
|---|---|---|
| 1 | `recovery.ts` 有 `decideRecovery`/`buildRecoveryOrder`（八步） | **驱动不消费**——replay-driver 只 `addAttempt` 不执行 Recovery 策略 |
| 2 | 驱动 Recovery 触发后直接空 URL/终态 | §14.3「必须改变入口或验证方式」未实现 |
| 3 | `search_result_cache` 表存在（query/provider/results jsonb） | 无 Repository、无搜索提供器实现 |
| 4 | Reviewer 复验无缓存（P1 已保证） | §5.3 满足 |

## 3. 设计决策（brainstorming 结论）

### 决策 D1：Recovery 策略执行器（新增 `packages/rules/src/recovery-executor.ts`）

- 输入：Recovery 触发上下文 + 驱动依赖（repos/evidenceStore/policy/httpCache）；
- 按八步顺序执行，每步：
  1. 判定该步可用的入口（如 site_profile_entry → 画像 current_leader_entry；sitemap_site_search → 站内搜索；domain_limited_external_search → 搜索提供器）；
  2. 尝试抓取/搜索 → 抽取 → 判型 → 若命中合格候选，产出候选 URL 交主链路复核（Reviewer）；
  3. 每步写 `recovery_attempt`（strategy/result/budgetUsed）+ 发 SSE；
- 八步全失败 → 空 URL + 中文终态（沿用既有语义）。
- **预算**：每任务 Recovery 预算上限（如 3 次），超预算停止（§14.2）。

### 决策 D2：搜索提供器接口 + fixture 提供器（§22）

- 新增 `packages/crawler/src/search/provider.ts`：
```ts
export interface SearchResult {
  title: string;
  summary: string | null;
  url: string;
  rank: number;
  timestamp?: string;
}
export interface SearchProvider {
  search(query: string, opts: { domain?: string; pageToken?: string }): Promise<{ results: SearchResult[]; nextToken?: string; providerError?: string; durationMs: number }>;
}
```
- **首版实现**：
  - `FixtureSearchProvider`（离线金标，供测试与 Recovery 校验）；
  - **Brave 等真实提供器留待用户授权**（真实搜索调用需逐项授权）；
- **结果准入**：搜索结果 URL 必须过 `assertAllowedUrl`（DNS-pinned SSRF）、仅作 URL 线索，**不成为最终 URL/当前性证据**（§22 硬约束）；
- 写 `search_result_cache`（复用既有表）。

### 决策 D3：Recovery 接入驱动

- `processSingleInstitution` 的候选 URL 失败路径：触发 Recovery → `recoveryExecutor.run(...)` → 返回候选或空；
- Recovery 产出候选须走 Reviewer 复核（不跳过 §15）；
- 8 步全失败 → 空 URL + 中文终态。

### 决策 D4：范围边界（暂缓不删除）

- Brave/Google/SearXNG 真实提供器：待用户授权后接入；
- 不做跨进程共享搜索缓存（单进程 cache 先行）；
- 不改变数据合同（`recovery_attempt`/`search_result_cache` 复用既有表）。

## 4. 建议任务划分（供实施计划参考）

| 任务 | 内容 | 离线可测 |
|---|---|---|
| P2-T1 | `SearchProvider` 接口 + `FixtureSearchProvider` + search_result_cache Repository | ✅ |
| P2-T2 | `recovery-executor.ts`（八步策略执行器 + 预算） | ✅ |
| P2-T3 | 驱动接入 Recovery 执行（候选失败 → 执行器 → Reviewer 复核） | ✅ |
| P2-T4 | 全量回归 + Recovery 策略链测试 | ✅ |

## 5. 边界与授权范围

- 本模块**仅 brainstorming**；不授权实施。
- 不改变已批准数据合同/证据链。
- **真实搜索调用（Brave 等）需逐项授权**；本设计用 FixtureSearchProvider 离线验证机制。
- 搜索结果只作 URL 线索，不成为最终 URL/当前性证据（§22）。

## 6. 修订记录

- 2026-08-09：依据 R-31 创建第一版。四项关键设计决策已确认（Recovery 执行器、搜索提供器接口+fixture、驱动接入、边界）。
