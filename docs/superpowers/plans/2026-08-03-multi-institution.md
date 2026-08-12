# 多机构与完整机构库存 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将第一闭环的「指定单机构」升级为「完整机构模式」：在单行政区（安徽省）下自动发现多个机构、冻结机构清单，每个机构独立走完抓取→证据→抽取→规则→选人→Reviewer→result_row 纵向链路，浏览器升级 Worker 与声明式适配器支撑动态站点，最终统一多机构结果与单 Sheet Excel。

**Architecture:** 延续模块化单体 + 进程内编排（复用 replay-driver 模式）。在任务编排层新增「机构发现（混合四层抽取）」与「多机构调度（小并发）」，在抓取层新增「进程内浏览器池（Playwright 2-4）」与「声明式适配器（安徽首个）」。所有新组件复用第一闭环已验证的数据合同（`institution_snapshot` 多行、`result_row` 每机构两槽位唯一、Reviewer 隔离、Excel 统一投影）。

**Tech Stack:** 复用第一闭环全栈（TypeScript 6.0.3 / Node 24.18 / Vitest 4.1 / PostgreSQL 18 / Kysely 0.29.4 / Crawlee 3.17 / Playwright 1.62 / Fastify 5.11）；新增声明式 JSON 适配器加载（node:fs JSON 解析，无新依赖）。

## Global Constraints

- 本模块不改变第一闭环的数据合同与证据链（规格 §6.3）：`institution_snapshot`、`result_row`、`review_decision`、`export_artifact` 结构不变。
- 数据存储根、PostgreSQL 容器参数、依赖精确版本、非 Git 边界均沿用第一闭环（R-01/R-02/R-06/R-07）。
- 真实网络边界：本模块自动测试全部离线（金标 fixture）；真实安徽省多机构抓取单列为需用户逐项授权的 Canary 步骤，不在计划自动执行。
- 浏览器升级只读：图片/字体/视频默认阻断（规格 §23.3）；浏览器不直连 PostgreSQL/API（规格 §6.3）。
- 安全边界沿用：DNS-pinned SSRF、逐跳重定向、脱敏、robots；不登录、不解验证码、不绕过访问控制。
- 生产行为必须有先失败测试；禁止 `--passWithNoTests`。
- 暂缓（不删除）：多行政区、全国库存、暂停/继续/取消、Graphile Worker、独立浏览器进程、大规模性能。

---

## 文件结构映射

> 每个文件单一责任；按纵向可测试交付物拆任务。

### 新建文件

| 文件 | 单一责任 |
|---|---|
| `packages/crawler/src/discovery/discover.ts` | 机构发现核心（混合四层抽取，返回机构候选列表） |
| `packages/crawler/src/discovery/discover.test.ts` | 机构发现测试（离线金标） |
| `packages/crawler/src/discovery/golden/institution-list.html` | 金标：机构列表页（安徽省政府机构） |
| `packages/crawler/src/browser/render.ts` | 进程内 Playwright 渲染（升级 Worker） |
| `packages/crawler/src/browser/render.test.ts` | 浏览器渲染测试（本地 fixture + 真实动态验证） |
| `packages/crawler/src/adapter/loader.ts` | 声明式适配器加载与校验（JSON 解析、schema 校验） |
| `packages/crawler/src/adapter/loader.test.ts` | 适配器加载测试 |
| `config/site-adapters/anhui-provincial-government.json` | 安徽省政府门户适配器 |
| `apps/backend/src/workers/multi-institution-driver.ts` | 多机构编排（机构发现→冻结→调度→每机构纵向链路） |
| `apps/backend/src/workers/multi-institution-driver.test.ts` | 多机构编排测试（真实 PostgreSQL 集成） |

### 修改文件

| 文件 | 修改内容 |
|---|---|
| `packages/contracts/src/task.ts` | CreateTaskRequest 扩展 `mode: "FULL_INSTITUTION"` 支持（已有 TaskMode 枚举） |
| `packages/crawler/src/index.ts` | 导出 discovery/browser/adapter 子模块 |
| `apps/backend/src/contracts/task-routes.ts` | 完整机构模式路由：任务创建触发机构发现 + 多机构调度 |
| `apps/backend/src/server.ts` | 组装多机构驱动 |

### 复用（不修改）

- `institution_snapshot` 仓储（`addMany` 已支持多机构批量写入）；
- `result_row` 仓储（每机构两槽位唯一）；
- `replay-driver.ts`（单机构纵向链路逻辑可抽为共享函数供多机构驱动复用）；
- Reviewer、规则、证据、Excel 全部复用。

---

### Task 1: 声明式适配器加载器（config/site-adapters）

**Files:**
- Create: `packages/crawler/src/adapter/loader.ts`
- Create: `packages/crawler/src/adapter/loader.test.ts`
- Create: `config/site-adapters/anhui-provincial-government.json`

**Interfaces:**
- Consumes: 无（node:fs/json）
- Produces:
```ts
export interface SiteAdapter {
  siteId: string;
  hosts: string[];
  institutionList: { url: string; selector: string } | null;
  leadershipList: { url: string; memberSelector: string } | null;
  memberDetail: { render: "http" | "playwright"; bioSelector: string | null } | null;
  roles: { primaryKeywords: string[]; secondaryKeywords: string[] };
}
export function loadAdapter(siteId: string, dir?: string): SiteAdapter;
export function loadAllAdapters(dir?: string): Map<string, SiteAdapter>;
export function validateAdapter(raw: unknown): SiteAdapter; // schema 校验，缺字段抛错
```

`config/site-adapters/anhui-provincial-government.json`（基于 R-08/R-09 Canary 事实）：
```json
{
  "siteId": "anhui-provincial-government",
  "hosts": ["www.ah.gov.cn"],
  "institutionList": { "url": "https://www.ah.gov.cn/site/tpl/2121", "selector": ".list a" },
  "leadershipList": { "url": "https://www.ah.gov.cn/szf/index.html", "memberSelector": "a[href*='liId=']" },
  "memberDetail": { "render": "playwright", "bioSelector": ".personal-intro" },
  "roles": { "primaryKeywords": ["省长"], "secondaryKeywords": ["常务副省长", "副省长"] }
}
```

- [ ] **Step 1: 写失败测试**

`loader.test.ts`：
```ts
import { describe, it, expect } from "vitest";
import { loadAdapter, loadAllAdapters, validateAdapter } from "./loader.js";
import { join } from "node:path";

describe("声明式适配器加载", () => {
  it("加载安徽适配器并校验必填字段", () => {
    const a = loadAdapter("anhui-provincial-government", join(import.meta.dirname, "../../../../config/site-adapters"));
    expect(a.siteId).toBe("anhui-provincial-government");
    expect(a.hosts).toContain("www.ah.gov.cn");
    expect(a.leadershipList?.url).toContain("/szf/index.html");
    expect(a.memberDetail?.render).toBe("playwright");
  });
  it("加载全部适配器", () => {
    const all = loadAllAdapters(join(import.meta.dirname, "../../../../config/site-adapters"));
    expect(all.size).toBeGreaterThanOrEqual(1);
  });
  it("校验非法适配器缺字段抛错", () => {
    expect(() => validateAdapter({ siteId: "x" })).toThrow();
  });
});
```

- [ ] **Step 2: 运行确认先失败**
Run: `pnpm --filter @stellaris/crawler exec vitest run src/adapter/loader.test.ts`
Expected: FAIL（loader.js 不存在）。

- [ ] **Step 3: 最小实现**
`loader.ts` 实现 `loadAdapter`/`loadAllAdapters`/`validateAdapter`（JSON 读取 + 必填字段校验）。

- [ ] **Step 4: 运行通过**
Run: `pnpm --filter @stellaris/crawler exec vitest run src/adapter/loader.test.ts`
Expected: PASS。

- [ ] **Step 5: 相关全量验证**
Run: `pnpm --filter @stellaris/crawler typecheck && pnpm test`
Expected: PASS。

- [ ] **Step 6: 独立验证检查点**
Run: `pnpm --filter @stellaris/crawler test`
Expected: 退出码 0。

---

### Task 2: 机构发现（混合四层抽取）

**Files:**
- Create: `packages/crawler/src/discovery/discover.ts`
- Create: `packages/crawler/src/discovery/discover.test.ts`
- Create: `packages/crawler/src/discovery/golden/institution-list.html`

**Interfaces:**
- Consumes: `httpFetch`、`extractPageFacts`、`loadAdapter`
- Produces:
```ts
export interface InstitutionCandidate {
  officialName: string;
  institutionType: InstitutionType;
  officialEntryUrl: string | null;
  discoverySource: "auto_discovered" | "adapter" | "user_specified";
}
export interface DiscoverInput {
  regionCode: string;
  regionName: string;
  entryUrl: string;
  policy: SafeEgressPolicy;
  adapter?: SiteAdapter;
}
export async function discoverInstitutions(input: DiscoverInput): Promise<InstitutionCandidate[]>;
// 四层抽取：
// 1. 通用 DOM：从入口页抽「政府机构/机构设置」栏目链接 → 机构列表页；
// 2. 适配器：adapter.institutionList 直接定位机构列表；
// 3. 区域模式：同省同市 URL 模式复用（安徽 `/site/tpl/2121`）；
// 4. 回退：通用规则。
// 候选统一：名称、类型（按关键词推断 government_department 等）、入口 URL、来源。
```

金标 `institution-list.html`（仿安徽省政府机构页 `/site/tpl/2121`）：
```html
<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>省政府机构</title></head>
<body><ul class="list">
  <li><a href="/zwgk/zfxxgk/17525.html">省发展和改革委员会</a></li>
  <li><a href="/zwgk/zfxxgk/17526.html">省教育厅</a></li>
  <li><a href="/zwgk/zfxxgk/17527.html">省公安厅</a></li>
</ul></body></html>
```

- [ ] **Step 1: 写失败测试**
`discover.test.ts`（本地 fixture 服务 + golden HTML，用 adapter 驱动）：
```ts
it("适配器路径发现机构清单", async () => {
  const srv = await createFixtureServer([{ pathPrefix: "/golden", dir: join(import.meta.dirname, "golden") }]);
  const policy = createSafeEgressPolicy({ mode: "offline-fixture", allowedTestPorts: new Set([srv.basePort]) });
  const adapter: SiteAdapter = { siteId: "t", hosts: ["localhost"], institutionList: { url: `${srv.url}/golden/institution-list.html`, selector: ".list a" }, leadershipList: null, memberDetail: null, roles: { primaryKeywords: [], secondaryKeywords: [] } };
  const cands = await discoverInstitutions({ regionCode: "340000", regionName: "安徽省", entryUrl: srv.url, policy, adapter });
  expect(cands.length).toBe(3);
  expect(cands[0].officialName).toBe("省发展和改革委员会");
  expect(cands[0].discoverySource).toBe("adapter");
  await srv.close();
});
```

- [ ] **Step 2: 运行确认先失败**
Run: `pnpm --filter @stellaris/crawler exec vitest run src/discovery/discover.test.ts`
Expected: FAIL。

- [ ] **Step 3: 最小实现**
`discover.ts` 实现四层抽取；adapter 有 institutionList 时优先（第 2 层），否则通用 DOM（第 1 层）+ 区域模式（第 3 层）+ 回退（第 4 层）。

- [ ] **Step 4: 运行通过**
Expected: PASS。

- [ ] **Step 5: 相关全量验证**
Run: `pnpm --filter @stellaris/crawler typecheck && pnpm test`
Expected: PASS。

- [ ] **Step 6: 独立验证检查点**
Run: `pnpm --filter @stellaris/crawler test`
Expected: 退出码 0。

---

### Task 3: 进程内浏览器池（Playwright 渲染升级）

**Files:**
- Create: `packages/crawler/src/browser/render.ts`
- Create: `packages/crawler/src/browser/render.test.ts`

**Interfaces:**
- Consumes: `shouldUpgradeToPlaywright`、Playwright chromium
- Produces:
```ts
export interface RenderResult {
  fetchUrl: string;
  title: string | null;
  bodyText: string;
  html: Uint8Array;
  waitSignals: string[]; // 满足的等待条件
}
export class BrowserPool {
  constructor(opts?: { maxPages?: number });
  async render(url: string, opts?: { waitSelector?: string }): Promise<RenderResult>;
  async close(): Promise<void>;
}
// 浏览器池：初始 2 页、上限 4（规格 §11.2）；图片/字体/视频默认阻断（规格 §23.3）；
// 等待明确 DOM/业务字段信号，不用固定长等待/networkidle（规格 §10.2）。
```

- [ ] **Step 1: 写失败测试**
`render.test.ts`（本地 fixture 渲染；等待明确 selector）：
```ts
it("渲染本地动态页并抽取正文", async () => {
  const pool = new BrowserPool({ maxPages: 2 });
  const srv = await createFixtureServer([{ pathPrefix: "/golden", dir: join(import.meta.dirname, "../golden") }]);
  // golden 提供动态渲染页（含脚本注入正文）。
  const res = await pool.render(`${srv.url}/golden/dynamic.html`, { waitSelector: ".bio" });
  expect(res.title).toBeTruthy();
  expect(res.bodyText).toContain("王清宪");
  await pool.close();
  await srv.close();
});
```

- [ ] **Step 2: 运行确认先失败**
Expected: FAIL（render.js 不存在）。

- [ ] **Step 3: 最小实现**
`render.ts` 实现 `BrowserPool`：chromium.launch headless → context（userAgent、viewport）→ route 阻断 image/font/media → goto + waitForSelector → 提取 title/bodyText/html。

- [ ] **Step 4: 运行通过**
Expected: PASS（本地 fixture 渲染 + 抽取）。

- [ ] **Step 5: 相关全量验证**
Run: `pnpm --filter @stellaris/crawler typecheck && pnpm test`
Expected: PASS。

- [ ] **Step 6: 独立验证检查点**
Run: `pnpm --filter @stellaris/crawler test`
Expected: 退出码 0。

---

### Task 4: 多机构编排驱动（机构发现→冻结→调度→纵向链路）

**Files:**
- Create: `apps/backend/src/workers/multi-institution-driver.ts`
- Create: `apps/backend/src/workers/multi-institution-driver.test.ts`

**Interfaces:**
- Consumes: `discoverInstitutions`、`loadAdapter`、`institutionSnapshotRepository.addMany`、`resultRowRepository`、Reviewer、规则、证据（全部复用第一闭环）
- Produces:
```ts
export interface MultiInstitutionPipelineInput {
  taskRunId: string;
  repos: Repositories;
  evidenceStore: EvidenceStore;
  policy: SafeEgressPolicy;
  fixtureUrl?: string;      // 离线金标模式
  adapter?: SiteAdapter;
  concurrency?: number;     // 默认 3
  emit: (e: SseEvent) => void;
  evidenceRoot: string;
}
export async function runMultiInstitutionPipeline(input: MultiInstitutionPipelineInput): Promise<void>;
// 流程：
// 1. 机构发现（discoverInstitutions）；
// 2. 机构清单冻结（institutionSnapshot.addMany，discovery_source=adapter/auto_discovered）；
// 3. 多机构调度（小并发：同时处理 ≤concurrency 个机构，逐个串行走纵向链路）；
// 4. 每机构：入口抓取 → 升级判定 → 浏览器池渲染（若需要）→ 证据 → 抽取 → 规则 → 选人 → Reviewer → result_row；
// 5. 全部机构到终态 → 任务完成。
```

- [ ] **Step 1: 写失败测试**
`multi-institution-driver.test.ts`（真实 PostgreSQL 18 + 本地 fixture，3 个机构候选）：
```ts
it("3 机构完整链路 → 每机构两槽位 result_row", async () => {
  // 建任务 → 驱动 → 断言：
  // - institution_snapshot 有 3 行；
  // - result_row 有 6 行（3 机构 × 2 槽位）；
  // - 每机构 PRIMARY_1/PRIMARY_2 唯一（task+institution+slot）。
});
```

- [ ] **Step 2: 运行确认先失败**
Expected: FAIL（驱动不存在）。

- [ ] **Step 3: 最小实现**
`multi-institution-driver.ts` 实现上述流程；复用单机构链路逻辑（从 replay-driver 抽出共享的 `processSingleInstitution` 函数）。

- [ ] **Step 4: 运行通过**
Expected: PASS。

- [ ] **Step 5: 相关全量验证**
Run: `pnpm --filter @stellaris/backend typecheck && pnpm test`
Expected: PASS。

- [ ] **Step 6: 独立验证检查点**
Run: `pnpm --filter @stellaris/backend test`
Expected: 退出码 0。

---

### Task 5: API 路由完整机构模式 + 全量终验

**Files:**
- Modify: `apps/backend/src/contracts/task-routes.ts`（完整机构模式：任务创建触发机构发现 + 多机构调度）
- Modify: `apps/backend/src/server.ts`（组装多机构驱动）
- Modify: `packages/crawler/src/index.ts`（导出 discovery/browser/adapter）

**Interfaces:**
- Consumes: 全部前置任务产物
- Produces: POST /api/tasks 支持 `mode: "FULL_INSTITUTION"` → 触发机构发现 → 多机构调度 → 统一结果/Excel。

- [ ] **Step 1: 写失败测试**
`task-routes` 或 e2e 测试：完整机构模式创建 → 机构清单 >1 → 每机构结果。
Expected: FAIL（路由未支持 FULL_INSTITUTION）。

- [ ] **Step 2: 运行确认先失败**
Expected: FAIL。

- [ ] **Step 3: 最小实现**
task-routes 分支 `mode === "FULL_INSTITUTION"` → 调 `runMultiInstitutionPipeline`；server.ts 组装 adapter 与 fixture。

- [ ] **Step 4: 运行通过**
Expected: PASS。

- [ ] **Step 5: 全量终验**
Run: `pnpm typecheck && pnpm test && pnpm build`
Expected: 全部 PASS。

- [ ] **Step 6: 独立验证检查点**
Run: `pnpm typecheck && pnpm test && pnpm build`
Expected: 退出码 0。

---

## 自审记录

1. **规格覆盖**：设计规格 §1-§8 全部映射到任务（发现四层→Task2、浏览器池→Task3、多机构编排→Task4、API→Task5、适配器→Task1）。
2. **占位符扫描**：无 TBD/TODO/"类似前一任务"；所有代码步骤含实际代码或 Schema 形状。
3. **接口一致性**：`discoverInstitutions`/`BrowserPool`/`runMultiInstitutionPipeline` 跨任务签名一致；复用第一闭环仓储与合同。
4. **依赖顺序**：适配器→发现→浏览器→编排→API，形成连续纵向闭环。
5. **先失败测试**：每任务含"写失败→确认失败→最小实现→通过→全量验证→独立检查点"。
6. **无越权动作**：自动测试全离线；真实安徽多机构抓取列为需用户授权的 Canary 步骤。

### 设计规格 → 计划任务映射

| 设计规格章节 | 计划任务 |
|---|---|
| §5.4 声明式适配器 | Task 1 |
| §5.1 机构发现（四层） | Task 2 |
| §5.3 浏览器升级 | Task 3 |
| §5.5 多机构调度 | Task 4 |
| §5.6 结果组织 + API | Task 5 |
