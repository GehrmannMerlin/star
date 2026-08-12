# P4 深度校准「通用机构发现 selector 覆盖增强」Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 解决 R-48 暴露的「通用机构发现对地市官网覆盖不足」——静态地市（滁州/马鞍山）栏目入口词漏过；JS 动态地市（芜湖/淮北）机构发现不消费 BrowserPool。D1 补栏目递归市级词；D2 机构发现浏览器升级。

**Architecture:** 延续模块化单体。D1 纯正则增强（`discover.ts` `discoverFromDepartmentColumns` 栏目词）；D2 `discoverInstitutions` 增可选 `browserPool`，HTTP 候选为空时渲染入口页重跑抽取；`multi-institution-driver` 传已注入的 browserPool（R-46 已透传）。不新增适配器。

**Tech Stack:** 复用全栈（TypeScript 6.0.3 / Node 24.18 / Vitest 4.1 / Playwright 1.62）；无新依赖（R-06）。

## Global Constraints

- 本模块不改变已批准数据合同与证据链；不改驱动核心语义。
- 浏览器升级仅渲染授权 URL（入口页）；礼貌并发/资源限制沿用 P1（politeness gate）。
- 浏览器升级时机：**仅 HTTP 候选为空时**渲染（避免每站开浏览器）。
- 渲染深度：仅入口页渲染；栏目页仍 HTTP（先最小）。
- 地市无领导信息页 → 如实「该机构无领导信息」（R-23 方向 2）。
- 真实 Canary 验证沿用 R-45 授权（安徽 16 地市只读）。
- 生产行为必须有先失败测试；禁止 `--passWithNoTests`。
- 无新依赖；不新增适配器。

---

## 文件结构映射

### 修改文件

| 文件 | 修改内容 |
|---|---|
| `packages/crawler/src/discovery/discover.ts` | D1 栏目词补充；D2 `browserPool` 可选参数 + 渲染重跑 |
| `packages/crawler/src/discovery/discover.test.ts` | D1/D2 测试 |
| `apps/backend/src/workers/multi-institution-driver.ts` | 机构发现传 browserPool |

### 复用（不修改）

- `BrowserPool`（`browser/render.ts`）、`extractCandidatesFromHtml`、`extractPageFacts`；
- R-46 已透传的 browserPool 链路（multi-region → multi-institution → processSingleInstitution）。

---

### Task 1（D1）: 部门栏目递归入口词补充（静态地市）

**Files:**
- Modify: `packages/crawler/src/discovery/discover.ts`

**内容:**
- `discoverFromDepartmentColumns` 两处栏目入口正则（识别部门栏目入口 + 下钻子栏目）补充市级词：
  ```
  现有: /政府机构|省政府办公厅|省直部门|直属单位|组成部门|机构设置|政府部门|省长之窗/
  新增: |市直部门|市直政府部门|部门网站|政府工作部门|市属机构|组织机构
  ```
- `isInstitutionName` 不变（R-47 已覆盖）。

- [ ] **Step 1: 写失败测试**
新增 fixture `city-departments.html`（含「市直政府部门」栏目入口 → 栏目页含 3 个市局机构）。断言：走栏目递归抽到市局机构。
Expected: FAIL（栏目词缺「市直政府部门」）。

- [ ] **Step 2: 运行确认先失败**
- [ ] **Step 3: 最小实现**
- [ ] **Step 4: 运行通过**
- [ ] **Step 5: 相关全量验证**
Run: `pnpm --filter @stellaris/crawler test`
- [ ] **Step 6: 独立验证检查点**

---

### Task 2（D2）: 机构发现浏览器升级（JS 动态地市）

**Files:**
- Modify: `packages/crawler/src/discovery/discover.ts`
- Modify: `packages/crawler/src/discovery/discover.test.ts`
- Modify: `apps/backend/src/workers/multi-institution-driver.ts`

**Interfaces:**
```ts
// discover.ts
export interface DiscoverInput {
  // ... 既有字段
  /** P4-D2：浏览器池（HTTP 候选为空时渲染入口页重跑抽取）。 */
  browserPool?: BrowserPool;
}
// discoverInstitutions 流程：
// 1. 声明式机构（R-46 隔离）→ 2. institutionList → 3. HTTP 通用抽取 + 栏目递归
// 4. D2 新增：HTTP 全部候选为空 且 browserPool 存在 → render(entryUrl) → extractCandidatesFromHtml(渲染后 HTML)
// 渲染后仍空 → 返回 []（调用方终态）
// multi-institution-driver.ts：
//   机构发现调用处传 browserPool（从 pipeline input 解构，R-46 已注入）
```

- [ ] **Step 1: 写失败测试**
新增测试：mock BrowserPool（渲染返回含机构链接 HTML）→ 断言 HTTP 空时走渲染路径抽到机构；渲染仍空 → []。
Expected: FAIL（discover 不消费 browserPool）。

- [ ] **Step 2: 运行确认先失败**
- [ ] **Step 3: 最小实现**
- [ ] **Step 4: 运行通过**
- [ ] **Step 5: 相关全量验证**
Run: `pnpm --filter @stellaris/crawler test && pnpm --filter @stellaris/backend test`
- [ ] **Step 6: 独立验证检查点**

---

### Task 3: 全量终验 + 地市 Canary 复测（R-45 授权）

- [ ] **Step 1: 全量验证**
Run: `pnpm typecheck && pnpm test && pnpm build`
Expected: 全部 PASS。
- [ ] **Step 2: 真实 Canary 复测（R-45 授权）**
  - 静态地市：滁州（340100 附近可达站）→ 应抽到真实机构；
  - JS 动态地市：芜湖（340200）→ 浏览器升级后抽到真实机构 或 如实空；
  - 记录各站结果如实（含入口受限站）。
- [ ] **Step 3: 合同一致性自查**
  - `DiscoverInput` 增 `browserPool` 可选；`discoverInstitutions` 渲染路径消费；
  - 栏目词含市级词；无 `--passWithNoTests`；无新依赖。

---

## 自审记录

1. **规格覆盖**：D1 栏目词、D2 浏览器升级（冻结 §10.2/§12.1/§8.2）、D3 边界；真实 Canary 沿用 R-45。
2. **占位符扫描**：无 TBD/TODO；关键接口含实际签名。
3. **接口一致性**：`DiscoverInput.browserPool` 跨 discover/driver 一致；复用 `BrowserPool`/`extractCandidatesFromHtml`。
4. **依赖顺序**：栏目词→浏览器升级→终验+Canary。
5. **先失败测试**：每任务含"写失败→确认失败→最小实现→通过→全量验证→独立检查点"。
6. **无越权动作**：仅通用规则增强；不新增适配器；Canary 沿用 R-45 授权。
7. **风险**：地市官网结构差异大——D2 渲染仍可能空（如实终态）；浏览器渲染耗时——仅 HTTP 空时触发，影响可控。

### 设计输入 → 计划任务映射

| 设计输入章节 | 计划任务 |
|---|---|
| D1 栏目词补充 | Task 1 |
| D2 浏览器升级 | Task 2 |
| D3 边界 + 终验 + Canary | Task 3 |
