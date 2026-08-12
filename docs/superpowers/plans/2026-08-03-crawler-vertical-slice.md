# 爬虫单地区单机构真实纵向闭环 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 交付一个经用户批准的"单地区、单机构真实端到端纵向闭环"——从任务输入、范围与机构冻结、URL 意图、HTTP 优先抓取、证据入库、事实抽取、完整领导结构、两名主要自然人槽位、五类页面与九项硬门槛、Recovery、隔离 Reviewer，到 `result_row`、网页结果/SSE/证据抽屉与单 Sheet Excel，全部通过真实 PostgreSQL 18 集成、离线固定金标回放与 Web/API 组件测试验证。

**Architecture:** 模块化单体代码仓库＋独立 Worker 入口＋PostgreSQL 持久业务状态。第一闭环采用"契约（`packages/contracts`）→ 数据（`packages/db` 真实 PostgreSQL 18）→ 证据（`packages/evidence` 内容寻址）→ 抓取（`packages/crawler` 安全出口＋HTTP 优先＋必要时 Playwright）→ 规则（`packages/rules` 领导结构/选人/准入/Recovery）→ 隔离 Reviewer → `result_row`"的纵向链路，由 `apps/backend` 提供任务 API/SSE/导出并驱动离线回放，`apps/web` 只读同一份已复核 `result_row` 呈现结果，`packages/exporter` 生成唯一单 Sheet Excel。真实网络前全部验证在离线固定金标下完成；真实官网 Canary 单列为需用户再次授权的步骤。

**Tech Stack:** TypeScript 6.0.3；Node.js 24.18.0（NodeNext/ESM）；Vitest 4.1.10（TDD）；Fastify 5.11.0（REST＋SSE）；TypeBox 0.34.52＋Ajv 8.20.0（边界合同）；PostgreSQL 18＋Kysely 0.29.4＋pg 8.22.0（真实集成/迁移）；Testcontainers（Node）PostgreSQL 18 容器；Crawlee 3.17.0＋Cheerio 1.2.0＋Playwright 1.62.1（HTTP 优先/浏览器升级依赖）；ExcelJS 4.4.0；React 19.2.8＋Vite 8.2.0＋TanStack Query 5.101.4＋TanStack Table 8.21.3；fast-check 4.9.0（属性测试）。

## Global Constraints

- 数据存储根目录：PostgreSQL 数据 `E:\StellarisData\postgres`，证据 `E:\StellarisData\evidence`，导出 `E:\StellarisData\exports`（开发期决议 R-01；覆盖冻结规格 D 盘条款）。
- PostgreSQL 18 容器：`127.0.0.1:5432` 仅本机监听；开发密码 `stellaris_dev`（开发期决议 R-02）。
- 依赖使用 pnpm 锁定的精确版本；本计划所有命令与代码以当前锁文件实测版本为实施基线（TypeScript 6.0.3、Vitest 4.1.10、Fastify 5.11.0、Kysely 0.29.4、pg 8.22.0、Graphile Worker 0.17.3、Crawlee 3.17.0、Playwright 1.62.1、Cheerio 1.2.0、ExcelJS 4.4.0、TypeBox 0.34.52、Ajv 8.20.0、React 19.2.8、Vite 8.2.0、TanStack Query 5.101.4、TanStack Table 8.21.3、fast-check 4.9.0）。版本基线对账决议需用户批准后追加开发期决策日志 `R-xx`，本计划不擅自视为已批准。
- 禁止在计划未获批前初始化 Git；项目根目录当前不是 Git 仓库，每个任务以独立验证检查点代替 git commit 步骤；Git 初始化列为需要用户单独授权的外部前提。
- 生产行为必须有先失败测试：禁止用 `--passWithNoTests` 或忽略无测试参数伪造成功；第一批任务必须用真实测试建立基线。
- 用户可见位置只显示中文状态与结论；英文枚举只存在于规则、数据库与代码内部。
- 网页与 Excel 只读取同一份已复核 `result_row`；导出阶段不做语义判断。
- 真实网络访问禁止：所有自动验证仅在离线固定金标回放下进行；真实官网 Canary 单列为需用户再次明确授权的步骤。
- 真实网络前必须具备 SSRF、DNS/IP、逐跳重定向、统一出口、资源上限、脱敏与 robots/访问限制测试。
- 本阶段暂缓（不删除）：多行政区批量、完整机构库存批量发现、完整暂停/继续/取消、大规模性能与完整管理页面。
- 安全边界：不登录、不解验证码、不绕过访问控制/WAF/robots；只采集公开官方页面。
- **第一闭环不引入**：Redis/Kafka/GraphQL/WebSocket/微服务/Kubernetes；Graphile Worker 持久队列与独立常驻 Worker 进程（`worker-http`/`worker-browser`/`worker-rules`/`worker-reviewer`/`worker-export`）列为后续扩展（详细设计 §5、冻结规格 §6.2.5），本计划以 `replay-driver` 进程内编排离线金标闭环验证业务链路，不作为常驻服务交付。
- 每个任务结束必须运行相关局部验证；关键节点运行 `pnpm typecheck`、`pnpm test`、`pnpm build`、`docker compose config`、PostgreSQL 迁移与集成测试、离线端到端金标回放。

---

## 文件结构映射

> 每个文件的单一责任；本计划按纵向可测试交付物拆任务，不按目录横向把所有包先填满。

### 新建文件

| 文件 | 单一责任 |
|---|---|
| `packages/contracts/src/task.ts` | 创建任务请求/响应、任务详情（含中文状态）、范围与机构快照合同（TypeBox＋Static） |
| `packages/contracts/src/result.ts` | `result_row` 视图、证据摘要/详情合同 |
| `packages/contracts/src/sse.ts` | SSE 事件联合类型（TypeBox 判别联合） |
| `packages/contracts/src/export-status.ts` | Excel 导出状态合同 |
| `packages/contracts/src/index.ts`（修改） | 重新导出新增合同模块 |
| `packages/contracts/src/contracts.test.ts` | 合同自检测试（TypeBox Schema 与 TypeScript 类型一致） |
| `packages/db/src/migration-002-invariants.ts` | 补关键外键、唯一约束、索引、事务级不变量的迁移 |
| `packages/db/src/repos/crawl-intent.ts` | crawl_intent 仓储（唯一抓取作业去重） |
| `packages/db/src/repos/fetch-attempt.ts` | fetch_attempt 仓储（独立网络事件） |
| `packages/db/src/repos/document-snapshot.ts` | document_snapshot 仓储（内容哈希去重引用） |
| `packages/db/src/repos/page-fact.ts` | page_fact 仓储 |
| `packages/db/src/repos/leadership.ts` | leadership_snapshot / role_assignment 仓储 |
| `packages/db/src/repos/slot-decision.ts` | slot_decision 仓储（两槽位唯一） |
| `packages/db/src/repos/url-candidate.ts` | url_candidate 仓储 |
| `packages/db/src/repos/recovery-attempt.ts` | recovery_attempt 仓储 |
| `packages/db/src/repos/review.ts` | review_job / review_decision 仓储（隔离 Reviewer 持久化） |
| `packages/db/src/repos/result-row.ts` | result_row 仓储（当前结果唯一、position_url 不变量） |
| `packages/db/src/repos/export-artifact.ts` | export_artifact 仓储 |
| `packages/db/src/repos/index.ts`（修改） | 组合新增仓储 |
| `packages/db/src/db.integration.test.ts` | 真实 PostgreSQL 18 集成测试：迁移、约束、事务、幂等、五不变量 |
| `packages/db/src/evidence-invariant.test.ts` | position_url↔Reviewer 决策 / 空 URL↔中文原因 的 DB 层不变量测试 |
| `packages/evidence/src/store.ts` | 内容寻址证据库：流式 SHA-256、临时写、原子改名、去重、读取校验、完整性检查 |
| `packages/evidence/src/store.test.ts` | 证据库测试（哈希/去重/原子提交/损坏检测） |
| `packages/crawler/src/safe-egress.ts` | 协议/端口/DNS/IP/私网拒绝/每跳重定向复核/资源上限策略 |
| `packages/crawler/src/safe-egress.test.ts` | SSRF、DNS/IP、重定向、资源上限测试 |
| `packages/crawler/src/http-fetch.ts` | HTTP 优先抓取（native fetch，逐跳校验，10MB 上限） |
| `packages/crawler/src/http-fetch.test.ts` | HTTP 抓取测试（本地离线 fixture） |
| `packages/crawler/src/sanitize.ts` | 日志/SSE/证据摘要统一脱敏（凭据、Cookie、URL userinfo、签名参数值） |
| `packages/crawler/src/sanitize.test.ts` | 脱敏测试 |
| `packages/crawler/src/robots.ts` | robots.txt 读取与路径准入（robots/访问限制） |
| `packages/crawler/src/robots.test.ts` | robots 遵守与访问限制测试 |
| `packages/crawler/src/browser-upgrade.ts` | Playwright 升级条件判断（仅在升级条件成立时启用） |
| `packages/crawler/src/browser-upgrade.test.ts` | 升级条件测试 |
| `packages/crawler/src/page-facts.ts` | 页面事实抽取（Cheerio/parse5，DOM 事实） |
| `packages/crawler/src/page-facts.test.ts` | 固定 HTML 回放的事实抽取测试 |
| `packages/crawler/src/testing/fixture-server.ts` | 离线固定金标 HTTP 服务器（本地端口，静态 golden） |
| `packages/crawler/src/golden/collection.html` | 金标：当前领导集合页 |
| `packages/crawler/src/golden/leader-detail-1.html` | 金标：领导人详情页 |
| `packages/crawler/src/golden/leader-detail-2.html` | 金标：第二领导人详情页 |
| `packages/crawler/src/golden/forbidden-news.html` | 金标：禁止类型（新闻）页 |
| `packages/crawler/src/golden/robots.txt` | 金标：robots（`User-agent: *`、`Disallow: /private/`） |
| `packages/rules/src/classify.ts` | 五类允许页面判定（纯规则） |
| `packages/rules/src/leadership.ts` | 完整领导结构组装 |
| `packages/rules/src/selection.ts` | 按机构类型选两名主要自然人（PRIMARY_1/PRIMARY_2） |
| `packages/rules/src/currentness.ts` | 当前性证据图 |
| `packages/rules/src/admission.ts` | 九项最终 URL 硬门槛 |
| `packages/rules/src/recovery.ts` | Recovery 触发/预算/顺序 |
| `packages/rules/src/reviewer.ts` | 六方面独立一致性判断 |
| `packages/rules/src/rules.test.ts` | 判型/领导结构/选人/当前性/硬门槛/Recovery/Reviewer 测试 |
| `packages/exporter/src/excel.ts` | ExcelJS 单 Sheet 导出（中文表头、超链接、空 URL 空白） |
| `packages/exporter/src/excel.test.ts` | Excel 单 Sheet/中文/超链接/空 URL 测试 |
| `apps/backend/src/contracts/task-routes.ts` | 创建任务/查询任务/导出/SSE 路由 |
| `apps/backend/src/workers/replay-driver.ts` | 离线回放编排（任务→机构→抓取→规则→Reviewer→result_row） |
| `apps/backend/src/app.test.ts` | API 与 SSE 组件测试 |
| `apps/web/src/components/TaskForm.tsx` | 指定行政区/机构任务表单 |
| `apps/web/src/components/TaskDetail.tsx` | 真实任务状态/计数/失败恢复状态 |
| `apps/web/src/components/ResultsTable.tsx` | 两槽位结果表＋证据抽屉＋Excel 下载 |
| `apps/web/src/app.tsx` | 单页工作台组装 |
| `apps/web/src/app.test.tsx` | Web 组件测试（RTL＋jsdom） |
| `apps/web/src/app.css` | CSS Modules＋CSS Custom Properties 视觉基线 |
| `apps/backend/src/e2e/replay.e2e.test.ts` | 离线端到端金标回放测试 |
| `infra/docker/compose.yml` | PostgreSQL 18 服务＋E 盘卷＋健康检查 |
| `tests/golden/manifest.json` | 金标页清单（路径→类型→关键断言） |

### 修改文件

| 文件 | 修改内容 |
|---|---|
| `packages/contracts/src/index.ts` | 追加导出 task/result/sse/export-status |
| `packages/db/src/migration-provider.ts` | 追加 `MIGRATION_002_INVARIANTS` |
| `packages/db/src/repos/index.ts` | 组合全部新增仓储 |
| `apps/backend/src/server.ts` | 注册任务路由与 SSE；挂载 replay-driver |
| `apps/web/src/main.tsx` | 渲染 `<App/>` |

### 新增依赖（写进对应任务；pnpm 锁定精确版本）

| 包 | 新增依赖 |
|---|---|
| `@stellaris/db`（dev） | `testcontainers`（Node 版，精确版本在任务 3 安装时写入锁文件） |
| `@stellaris/backend`（dev） | `testcontainers`（Node 版，同上） |
| `@stellaris/backend` | `@stellaris/exporter`（workspace，已声明） |
| `@stellaris/rules` | `@stellaris/crawler`（workspace：Reviewer 复抓所需） |
| `@stellaris/rules`（dev） | `testcontainers`（Node 版，任务 9） |
| `@stellaris/web` | 无（RTL/vitest/jsdom 已在 devDependencies） |

---

### Task 1: 建立真实测试基线（8 工作区首个 Vitest 测试）

**Files:**
- Create: `packages/contracts/src/contracts.test.ts`（真实断言测试）
- Create: `packages/db/src/db.smoke.test.ts`（无 DB 依赖的纯单元断言）
- Create: `packages/crawler/src/package.test.ts`
- Create: `packages/evidence/src/package.test.ts`
- Create: `packages/exporter/src/package.test.ts`
- Create: `packages/rules/src/package.test.ts`
- Create: `apps/backend/src/smoke.test.ts`
- Create: `apps/web/src/smoke.test.tsx`
- Modify: 无

**Interfaces:**
- Consumes: 各包现有导出（`HEALTH_VERSION`、`EVIDENCE_PACKAGE_NAME` 等包名常量）
- Produces: 8 个工作区各至少 1 个通过的真实 Vitest 测试，使根 `pnpm test` 变绿（基线）

- [ ] **Step 1: 写入每个工作区的失败测试**

`packages/contracts/src/contracts.test.ts`：
```ts
import { describe, it, expect } from "vitest";
import { HEALTH_SERVICE_NAME, HEALTH_VERSION } from "./health.js";
import { TaskRunStatusZh, PageTypeZh } from "./enums.js";

describe("contracts baseline", () => {
  it("health 常量存在且为字符串", () => {
    expect(typeof HEALTH_SERVICE_NAME).toBe("string");
    expect(typeof HEALTH_VERSION).toBe("string");
  });
  it("12 项任务状态都有中文映射", () => {
    expect(Object.keys(TaskRunStatusZh)).toHaveLength(12);
    expect(TaskRunStatusZh.COMPLETED).toBe("已完成");
  });
  it("五类页面都有中文映射", () => {
    expect(Object.keys(PageTypeZh)).toHaveLength(5);
    expect(PageTypeZh.OFFICIAL_BIOGRAPHY).toBe("个人简介页");
  });
});
```

`packages/db/src/db.smoke.test.ts`：
```ts
import { describe, it, expect } from "vitest";
import { TABLE_NAMES } from "./schema.js";

describe("db schema baseline", () => {
  it("25 张表清单齐全", () => {
    expect(TABLE_NAMES).toHaveLength(25);
    expect(TABLE_NAMES).toContain("task_run");
    expect(TABLE_NAMES).toContain("result_row");
  });
});
```

`packages/crawler/src/package.test.ts`、`packages/evidence/src/package.test.ts`、`packages/exporter/src/package.test.ts`、`packages/rules/src/package.test.ts`（每包一个，断言各自包名常量存在）：
```ts
import { describe, it, expect } from "vitest";
import { CRAWLER_PACKAGE_NAME } from "./index.js";

describe("crawler package baseline", () => {
  it("包名常量为 @stellaris/crawler", () => {
    expect(CRAWLER_PACKAGE_NAME).toBe("@stellaris/crawler");
  });
});
```
（evidence/exporter/rules 对应改为 `EVIDENCE_PACKAGE_NAME`/`EXPORTER_PACKAGE_NAME`/`RULES_PACKAGE_NAME` 与对应包名。）

`apps/backend/src/smoke.test.ts`：
```ts
import { describe, it, expect } from "vitest";
import { buildApp } from "./server.js";

describe("backend baseline", () => {
  it("/health 返回 ok", async () => {
    const app = await buildApp();
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: "ok" });
  });
});
```

`apps/web/src/smoke.test.tsx`：
```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StrictMode } from "react";

describe("web baseline", () => {
  it("根容器文档可用（jsdom）", () => {
    const el = document.createElement("div");
    expect(el.id).toBe("");
  });
  it("渲染后出现标题文本", () => {
    render(<StrictMode><h1>政务简历采集</h1></StrictMode>);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("政务简历采集");
  });
});
```

- [ ] **Step 2: 运行根测试确认先失败**

Run: `pnpm test`
Expected: FAIL（当前 0 个测试文件；Vitest 报"could not find any test file"或类似，退出码非 0）。记录输出。

- [ ] **Step 3: 补 vitest 配置与 web 测试环境**

修改 `apps/web/vite.config.ts`，追加 Vitest 配置（jsdom 环境）：
```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: { host: "127.0.0.1", port: 5173 },
  build: { outDir: "dist" },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: [],
  },
});
```
（`apps/web` 无独立 `vitest.config.*`，沿用 `vite.config.ts` 内联 `test` 字段，与 Vitest 4 默认读取一致。）

- [ ] **Step 4: 运行局部测试**

Run: `pnpm --filter @stellaris/contracts test`
Expected: PASS（3 个断言全绿）

Run: `pnpm --filter @stellaris/db test`、`pnpm --filter @stellaris/crawler test`、`pnpm --filter @stellaris/evidence test`、`pnpm --filter @stellaris/exporter test`、`pnpm --filter @stellaris/rules test`、`pnpm --filter @stellaris/backend test`、`pnpm --filter @stellaris/web test`
Expected: 各 PASS。

- [ ] **Step 5: 运行相关全量验证**

Run: `pnpm test`
Expected: PASS（8 工作区全部真实测试通过，无任何跳过/忽略参数）
Run: `pnpm typecheck`
Expected: PASS
Run: `pnpm build`
Expected: PASS（各包 tsc 编译与 vite build 通过）

- [ ] **Step 6: 独立验证检查点**

Run: `pnpm test && pnpm typecheck && pnpm build`
Expected: 三条命令全部退出码 0；`git -C E:\Stellaris rev-parse --is-inside-work-tree` 返回失败（非 Git，未初始化）属预期，不执行 git 命令。

---

### Task 2: 边界合同补齐（task/result/sse/export-status）

**Files:**
- Create: `packages/contracts/src/task.ts`
- Create: `packages/contracts/src/result.ts`
- Create: `packages/contracts/src/sse.ts`
- Create: `packages/contracts/src/export-status.ts`
- Create: `packages/contracts/src/contracts.test.ts`（扩充）
- Modify: `packages/contracts/src/index.ts`

**Interfaces:**
- Consumes: `packages/contracts/src/enums.ts`（TaskRunStatus/TaskMode/ExpandLevel/InstitutionType/PageType/Slot/ReviewDecision/CurrentnessStatus）
- Produces: 以下类型与 Schema 供 db/crawler/rules/backend/web/exporter 共用

`task.ts` 关键形状：
```ts
import { Type, type Static } from "@sinclair/typebox";
import { TaskRunStatus, TaskMode, ExpandLevel, InstitutionType } from "./enums.js";

export const CreateTaskRequest = Type.Object({
  clientIdempotencyKey: Type.String({ minLength: 8, maxLength: 128 }),
  regionCode: Type.String({ minLength: 6, maxLength: 16 }),      // 行政区划代码（文本，保留前导零）
  regionName: Type.String({ minLength: 1, maxLength: 128 }),
  institutionName: Type.String({ minLength: 1, maxLength: 255 }),
  personName: Type.Optional(Type.String({ maxLength: 128 })),    // 可选：只缩小目标，不跳过准入/Reviewer
  officialEntryUrl: Type.Optional(Type.String({ maxLength: 2048 })),
  institutionType: Type.Enum(InstitutionType),
  ruleVersion: Type.String({ minLength: 1, maxLength: 64 }),
});
export type CreateTaskRequest = Static<typeof CreateTaskRequest>;

export const TaskRunSummary = Type.Object({
  id: Type.String(),
  status: Type.Enum(TaskRunStatus),
  statusZh: Type.String(),
  mode: Type.Enum(TaskMode),
  expandLevel: Type.Enum(ExpandLevel),
  ruleVersion: Type.String(),
  totalInstitutions: Type.Number(),
  processedInstitutions: Type.Number(),
  reviewedSlots: Type.Number(),
  recoveryCount: Type.Number(),
  blockedCount: Type.Number(),
  requestedAt: Type.String(),
  startedAt: Type.Optional(Type.String()),
  finishedAt: Type.Optional(Type.String()),
  errorMessage: Type.Optional(Type.String()),
});
export type TaskRunSummary = Static<typeof TaskRunSummary>;

export const CreateTaskResponse = Type.Object({
  task: TaskRunSummary,
  /** 幂等结果：created=首次创建，replayed=命中既有幂等键 */
  idempotencyResult: Type.Union([Type.Literal("created"), Type.Literal("replayed")]),
});
export type CreateTaskResponse = Static<typeof CreateTaskResponse>;

export const TargetScopeView = Type.Object({
  id: Type.String(),
  taskRunId: Type.String(),
  regionCode: Type.String(),
  regionName: Type.String(),
  parentRegionCode: Type.Optional(Type.String()),
  regionLevel: Type.String(),
  included: Type.Boolean(),
});
export type TargetScopeView = Static<typeof TargetScopeView>;

export const InstitutionSnapshotView = Type.Object({
  id: Type.String(),
  taskRunId: Type.String(),
  regionCode: Type.String(),
  officialName: Type.String(),
  commonName: Type.Optional(Type.String()),
  institutionType: Type.Enum(InstitutionType),
  officialEntryUrl: Type.Optional(Type.String()),
  discoverySource: Type.String(),
  selectTwoPrimary: Type.Boolean(),
  frozenAt: Type.String(),
  status: Type.String(),
  terminalReason: Type.Optional(Type.String()),
});
export type InstitutionSnapshotView = Static<typeof InstitutionSnapshotView>;

export const TaskDetail = Type.Object({
  task: TaskRunSummary,
  scopes: Type.Array(TargetScopeView),
  institution: InstitutionSnapshotView,
});
export type TaskDetail = Static<typeof TaskDetail>;
```

`result.ts` 关键形状：
```ts
export const ResultRowView = Type.Object({
  id: Type.String(),
  taskRunId: Type.String(),
  institutionSnapshotId: Type.String(),
  slot: Type.Enum(Slot),
  regionCode: Type.String(),
  province: Type.Optional(Type.String()),
  city: Type.Optional(Type.String()),
  county: Type.Optional(Type.String()),
  town: Type.Optional(Type.String()),
  institutionName: Type.String(),
  positionDisplay: Type.String(),
  personName: Type.Optional(Type.String()),
  currentStatusZh: Type.String(),
  positionUrl: Type.Optional(Type.String()),
  pageTypeZh: Type.Optional(Type.String()),
  resultZh: Type.String(),
  collectedAt: Type.String(),
});
export type ResultRowView = Static<typeof ResultRowView>;

export const EvidenceSummary = Type.Object({
  pageTypeZh: Type.Optional(Type.String()),
  collectorAccessedAt: Type.Optional(Type.String()),
  reviewerAccessedAt: Type.Optional(Type.String()),
  currentnessRelationZh: Type.Optional(Type.String()),
  supportingSnippets: Type.Array(Type.String()),
  terminalReasonZh: Type.Optional(Type.String()),
  officialSourceUrls: Type.Array(Type.String()),
});
export type EvidenceSummary = Static<typeof EvidenceSummary>;

export const EvidenceDetail = Type.Object({
  summary: EvidenceSummary,
  documentSnapshotId: Type.Optional(Type.String()),
  contentHash: Type.Optional(Type.String()),
  relativePath: Type.Optional(Type.String()),
});
export type EvidenceDetail = Static<typeof EvidenceDetail>;
```

`export-status.ts`：
```ts
export const ExportStatus = Type.Object({
  taskRunId: Type.String(),
  filename: Type.String(),
  rowCount: Type.Number(),
  contentHash: Type.String(),
  generatedAt: Type.String(),
  downloadUrl: Type.String(),
});
export type ExportStatus = Static<typeof ExportStatus>;
```

`sse.ts`（判别联合，`type` 字段作判别）：
```ts
const TaskStateChanged = Type.Object({ type: Type.Literal("task.state_changed"), taskRunId: Type.String(), status: Type.Enum(TaskRunStatus), statusZh: Type.String(), seq: Type.Number() });
const TaskProgressChanged = Type.Object({ type: Type.Literal("task.progress_changed"), taskRunId: Type.String(), processedInstitutions: Type.Number(), totalInstitutions: Type.Number(), seq: Type.Number() });
const InstitutionCompleted = Type.Object({ type: Type.Literal("institution.completed"), taskRunId: Type.String(), institutionSnapshotId: Type.String(), statusZh: Type.String(), seq: Type.Number() });
const ResultUpserted = Type.Object({ type: Type.Literal("result.upserted"), taskRunId: Type.String(), result: ResultRowView, seq: Type.Number() });
const ResultReviewed = Type.Object({ type: Type.Literal("result.reviewed"), taskRunId: Type.String(), institutionSnapshotId: Type.String(), slot: Type.Enum(Slot), reviewed: Type.Boolean(), seq: Type.Number() });
const ResultRecoveryStarted = Type.Object({ type: Type.Literal("result.recovery_started"), taskRunId: Type.String(), institutionSnapshotId: Type.String(), seq: Type.Number() });
const ResultTerminalBlank = Type.Object({ type: Type.Literal("result.terminal_blank"), taskRunId: Type.String(), institutionSnapshotId: Type.String(), slot: Type.Enum(Slot), terminalReasonZh: Type.String(), seq: Type.Number() });
const ExportReady = Type.Object({ type: Type.Literal("export.ready"), taskRunId: Type.String(), filename: Type.String(), seq: Type.Number() });
const TaskCompleted = Type.Object({ type: Type.Literal("task.completed"), taskRunId: Type.String(), statusZh: Type.String(), seq: Type.Number() });
const TaskFailed = Type.Object({ type: Type.Literal("task.failed"), taskRunId: Type.String(), errorMessageZh: Type.String(), seq: Type.Number() });
export const SseEvent = Type.Union([TaskStateChanged, TaskProgressChanged, InstitutionCompleted, ResultUpserted, ResultReviewed, ResultRecoveryStarted, ResultTerminalBlank, ExportReady, TaskCompleted, TaskFailed]);
export type SseEvent = Static<typeof SseEvent>;
```

- [ ] **Step 1: 写入失败测试**

`packages/contracts/src/contracts.test.ts` 追加：
```ts
import { Value } from "@sinclair/typebox/value";
import { CreateTaskRequest, CreateTaskResponse, TaskDetail } from "./task.js";
import { ResultRowView, EvidenceSummary } from "./result.js";
import { ExportStatus } from "./export-status.js";
import { SseEvent } from "./sse.js";

describe("contracts 边界合同", () => {
  it("CreateTaskRequest 拒绝缺 institutionName 的负载", () => {
    const bad = { clientIdempotencyKey: "key-12345678", regionCode: "110000", regionName: "北京市", institutionType: "government", ruleVersion: "v1" };
    expect(Value.Check(CreateTaskRequest, bad)).toBe(false);
  });
  it("CreateTaskRequest 接受合法负载", () => {
    const good = { clientIdempotencyKey: "key-12345678", regionCode: "110000", regionName: "北京市", institutionName: "某某区人民政府", institutionType: "government", ruleVersion: "v1" };
    expect(Value.Check(CreateTaskRequest, good)).toBe(true);
  });
  it("CreateTaskResponse 判别 idempotencyResult", () => {
    const task = { id: "t1", status: "PENDING", statusZh: "待开始", mode: "TARGETED", expandLevel: "COUNTY", ruleVersion: "v1", totalInstitutions: 1, processedInstitutions: 0, reviewedSlots: 0, recoveryCount: 0, blockedCount: 0, requestedAt: new Date().toISOString() };
    expect(Value.Check(CreateTaskResponse, { task, idempotencyResult: "created" })).toBe(true);
    expect(Value.Check(CreateTaskResponse, { task, idempotencyResult: "replayed" })).toBe(true);
  });
  it("ResultRowView 要求 positionUrl 可选且为空时允许", () => {
    const row = { id: "r1", taskRunId: "t1", institutionSnapshotId: "i1", slot: "PRIMARY_1", regionCode: "110000", institutionName: "某某区人民政府", positionDisplay: "某某区人民政府 区长", currentStatusZh: "正式在任", resultZh: "完整搜索后无合格URL", collectedAt: new Date().toISOString() };
    expect(Value.Check(ResultRowView, row)).toBe(true);
  });
  it("SseEvent 判别联合按 type 区分", () => {
    const ev = { type: "result.upserted", taskRunId: "t1", result: { id: "r1", taskRunId: "t1", institutionSnapshotId: "i1", slot: "PRIMARY_1", regionCode: "110000", institutionName: "某某区人民政府", positionDisplay: "某某区人民政府 区长", currentStatusZh: "正式在任", resultZh: "已找到并复核", collectedAt: new Date().toISOString() }, seq: 1 };
    expect(Value.Check(SseEvent, ev)).toBe(true);
    expect(Value.Check(SseEvent, { ...ev, type: "no.such" })).toBe(false);
  });
});
```

- [ ] **Step 2: 运行测试确认先失败**

Run: `pnpm --filter @stellaris/contracts test`
Expected: FAIL（`./task.js`/`./result.js`/`./export-status.js`/`./sse.js` 不存在，模块解析错误）。

- [ ] **Step 3: 实现最小合同模块**

按"Interfaces"形状创建 `task.ts`、`result.ts`、`export-status.ts`、`sse.ts`（TypeBox 定义与 `Static<>` 类型），并在 `index.ts` 追加：
```ts
export * from "./task.js";
export * from "./result.js";
export * from "./sse.js";
export * from "./export-status.js";
```

- [ ] **Step 4: 运行局部测试**

Run: `pnpm --filter @stellaris/contracts test`
Expected: PASS。

- [ ] **Step 5: 相关全量验证**

Run: `pnpm --filter @stellaris/contracts typecheck`
Expected: PASS
Run: `pnpm test`
Expected: PASS

- [ ] **Step 6: 独立验证检查点**

Run: `pnpm --filter @stellaris/contracts build && pnpm typecheck && pnpm test`
Expected: 全部退出码 0。

---

### Task 3: PostgreSQL 18 容器 + 不变量迁移（真实集成）

**Files:**
- Create: `infra/docker/compose.yml`
- Create: `packages/db/src/migration-002-invariants.ts`
- Create: `packages/db/src/db.integration.test.ts`
- Create: `packages/db/src/evidence-invariant.test.ts`
- Modify: `packages/db/src/migration-provider.ts`
- Modify: `packages/db/package.json`（dev 依赖 `testcontainers`，精确版本安装后写入锁文件）

**Interfaces:**
- Consumes: `createDb`/`dbConfigFromEnv`/`migrateToLatest`（client.ts/migrate.ts）；`@stellaris/contracts` 枚举
- Produces:
  - `MIGRATION_002_INVARIANTS`（name: `"2026-08-03-invariants"`）：补齐关键外键、唯一约束、索引、不变量
  - 集成测试：`startPostgres()` 返回 `{ host, port }`（Testcontainers `postgres:18`）

`compose.yml`：
```yaml
services:
  postgres:
    image: postgres:18
    container_name: stellaris-postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: stellaris
      POSTGRES_PASSWORD: stellaris_dev
      POSTGRES_DB: stellaris
    ports:
      - "127.0.0.1:5432:5432"
    volumes:
      - stellaris_pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U stellaris -d stellaris"]
      interval: 5s
      timeout: 5s
      retries: 10
volumes:
  stellaris_pgdata:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: E:\StellarisData\postgres
```
> 注：`device` 使用 Windows 盘符路径 `E:\StellarisData\postgres`（开发期决议 R-01）；若当前 Docker Desktop 以 WSL2 后端运行，实施时以 `docker info` 与 `wslpath` 解析为实际宿主挂载路径（通常 `/mnt/e/StellarisData/postgres` 或 `//e/StellarisData/postgres`），路径值属实施环境适配，不改变 E 盘根基线。

迁移 `migration-002-invariants.ts`（Kysely builder，`up`/`down`）：
```ts
// 补外键（schema 曾缺 references）：
//   fetch_attempt.document_snapshot_id -> document_snapshot.id
//   fetch_attempt.crawl_intent_id -> crawl_intent.id
//   link_edge.source_document_snapshot_id -> document_snapshot.id
//   page_fact.document_snapshot_id -> document_snapshot.id
//   entity_assertion.institution_id / currentness_assertion.institution_id -> institution_snapshot.id
//   leadership_snapshot.institution_snapshot_id -> institution_snapshot.id
//   role_assignment.institution_snapshot_id -> institution_snapshot.id
//   slot_decision.institution_snapshot_id -> institution_snapshot.id
//   url_candidate.institution_snapshot_id -> institution_snapshot.id
//   recovery_attempt.institution_snapshot_id -> institution_snapshot.id
//   review_job.institution_snapshot_id -> institution_snapshot.id
//   review_decision.review_job_id -> review_job.id
//   result_row.institution_snapshot_id -> institution_snapshot.id
//   path_family_profile.site_profile_id / public_api_profile.site_profile_id -> site_profile.id
// 唯一约束：
//   review_job.unique_request_key 唯一（Reviewer 请求键不得复用 Collector 键）
//   crawl_intent (task_run_id, canonical_key, purpose) 已有；补 institution_snapshot_id 复合去重键
// 索引：
//   idx_fetch_attempt_task (task_run_id)
//   idx_fetch_attempt_canonical (canonical_key)
//   idx_document_snapshot_hash (content_hash)（迁移1已唯一，无需重复）
//   idx_review_decision_review_job (review_job_id)
//   idx_result_row_task_institution (task_run_id, institution_snapshot_id)
// 不变量（CHECK）：
//   result_row: (position_url IS NULL) OR (position_url IS NOT NULL) 由应用层 + 触发器保证非空 URL 引用通过的 Reviewer 决策
//   review_decision: decision IN ('MATCH','CONFLICT')
```
触发器 `trg_result_row_url_requires_review`（见测试断言）：
```sql
CREATE OR REPLACE FUNCTION fn_result_row_url_requires_review() RETURNS trigger AS $$
BEGIN
  IF NEW.position_url IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM review_decision rd
      WHERE rd.task_run_id = NEW.task_run_id
        AND rd.url = NEW.position_url
        AND rd.decision = 'MATCH'
    ) THEN
      RAISE EXCEPTION 'result_row.position_url 必须引用通过的 Reviewer 决策 (MATCH)';
    END IF;
  ELSE
    IF NEW.result_zh IS NULL OR length(trim(NEW.result_zh)) = 0 THEN
      RAISE EXCEPTION '空 position_url 必须有中文终态原因 result_zh';
    END IF;
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
CREATE TRIGGER trg_result_row_url_requires_review
  BEFORE INSERT OR UPDATE OF position_url, result_zh ON result_row
  FOR EACH ROW EXECUTE FUNCTION fn_result_row_url_requires_review();
```

`db.integration.test.ts`（Testcontainers）：
```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { GenericContainer, StartedTestContainer } from "testcontainers";
import { createDb } from "./client.js";
import { migrateToLatest } from "./migrate.js";

let container: StartedTestContainer;

beforeAll(async () => {
  container = await new GenericContainer("postgres:18")
    .withExposedPorts(5432)
    .withEnvironment({ POSTGRES_USER: "stellaris", POSTGRES_PASSWORD: "stellaris_dev", POSTGRES_DB: "stellaris" })
    .start();
}, 120_000);

afterAll(async () => { await container.stop(); });

describe("PostgreSQL 18 真实集成", () => {
  it("迁移全部执行且幂等", async () => {
    const db = createDb({ host: container.getHost(), port: container.getMappedPort(5432), user: "stellaris", password: "stellaris_dev", database: "stellaris" });
    const r1 = await migrateToLatest(db);
    expect(r1.ok).toBe(true);
    expect(r1.all).toContain("2026-08-03-initial-schema");
    expect(r1.all).toContain("2026-08-03-invariants");
    const r2 = await migrateToLatest(db);
    expect(r2.ok).toBe(true);
    expect(r2.executed).toEqual([]); // 幂等：已执行的迁移跳过
  });
});
```

`evidence-invariant.test.ts`（插入违反不变量行应被拒绝；Testcontainers 前缀同本 Task）：
```ts
let container: StartedTestContainer;
let db: ReturnType<typeof createDb>;
let taskId: string; let instId: string;

beforeAll(async () => {
  container = await new GenericContainer("postgres:18")
    .withExposedPorts(5432)
    .withEnvironment({ POSTGRES_USER: "stellaris", POSTGRES_PASSWORD: "stellaris_dev", POSTGRES_DB: "stellaris" })
    .start();
  db = createDb({ host: container.getHost(), port: container.getMappedPort(5432), user: "stellaris", password: "stellaris_dev", database: "stellaris" });
  await migrateToLatest(db);
  const task = await db.insertInto("task_run").values({ idempotency_key: "invariant-test-key", mode: "TARGETED", expand_level: "COUNTY", status: "PENDING", rule_version: "v1" }).returning("id").executeTakeFirstOrThrow();
  taskId = task.id;
  const inst = await db.insertInto("institution_snapshot").values({ task_run_id: taskId, region_code: "110000", official_name: "某某区人民政府", institution_type: "government", discovery_source: "user_specified", select_two_primary: true, frozen_at: new Date().toISOString() }).returning("id").executeTakeFirstOrThrow();
  instId = inst.id;
}, 120_000);
afterAll(async () => { await container.stop(); });

it("position_url 非空但不引用 MATCH 的 review_decision 被拒绝", async () => {
  await expect(
    db.insertInto("result_row").values({ task_run_id: taskId, institution_snapshot_id: instId, slot: "PRIMARY_1", region_code: "110000", institution_name: "机构", position_display: "机构 岗位", current_status_zh: "正式在任", position_url: "https://official.example/leader", result_zh: "已找到并复核", collected_at: new Date().toISOString() }).execute()
  ).rejects.toThrow(/必须引用通过的 Reviewer 决策/);
});
it("空 position_url 但无中文终态原因被拒绝", async () => {
  await expect(
    db.insertInto("result_row").values({ task_run_id: taskId, institution_snapshot_id: instId, slot: "PRIMARY_1", region_code: "110000", institution_name: "机构", position_display: "机构 岗位", current_status_zh: "正式在任", position_url: null, result_zh: "", collected_at: new Date().toISOString() }).execute()
  ).rejects.toThrow(/必须有中文终态原因/);
});
```

- [ ] **Step 1: 安装 testcontainers 并写入失败测试**

Run（Task 内首次执行需安装依赖；安装是实施的一部分，非真实抓取/迁移）:
`pnpm --filter @stellaris/db add -D testcontainers`
Expected: 锁文件新增 `testcontainers` 精确版本。

写入 `compose.yml`、`db.integration.test.ts`、`evidence-invariant.test.ts` 与迁移骨架（`up` 先实现全部外键/约束/索引/触发器）。

- [ ] **Step 2: 运行集成测试确认先失败（若迁移未实现则失败）**

Run: `pnpm --filter @stellaris/db exec vitest run src/db.integration.test.ts src/evidence-invariant.test.ts`
Expected: 若 `MIGRATION_002_INVARIANTS` 未注册则迁移 all 不含 invariants → FAIL；注册后若触发器缺失 → 违反不变量测试 FAIL。

- [ ] **Step 3: 实现最小迁移与提供器注册**

按"Interfaces"实现 `migration-002-invariants.ts`，并修改 `migration-provider.ts`：
```ts
import { MIGRATION_002_INVARIANTS } from "./migration-002-invariants.js";
export const MIGRATIONS: MigrationEntry[] = [
  { name: MIGRATION_001_INITIAL.name, migration: MIGRATION_001_INITIAL.migration },
  { name: MIGRATION_002_INVARIANTS.name, migration: MIGRATION_002_INVARIANTS.migration },
];
```

- [ ] **Step 4: 运行集成测试**

Run: `pnpm --filter @stellaris/db exec vitest run src/db.integration.test.ts src/evidence-invariant.test.ts`
Expected: PASS（真实 postgres:18 容器迁移两段、幂等、不变量触发器拒绝生效）。

- [ ] **Step 5: Docker Compose 配置校验**

Run: `docker compose -f infra/docker/compose.yml config`
Expected: 输出解析后的 compose 配置，退出码 0。

- [ ] **Step 6: 相关全量验证**

Run: `pnpm --filter @stellaris/db test && pnpm typecheck && pnpm test`
Expected: 全 PASS。

- [ ] **Step 7: 独立验证检查点**

Run: `docker compose -f infra/docker/compose.yml config >/dev/null && pnpm --filter @stellaris/db exec vitest run src/db.integration.test.ts src/evidence-invariant.test.ts`
Expected: 退出码 0；本任务不启动 compose 常驻服务（启动与手工验证留给实施阶段独立步骤，见 Global Constraints 外部前提）。

---

### Task 4: Repository 补齐（抓取/事实/业务/控制/输出层）

**Files:**
- Create: `packages/db/src/repos/crawl-intent.ts`
- Create: `packages/db/src/repos/fetch-attempt.ts`
- Create: `packages/db/src/repos/document-snapshot.ts`
- Create: `packages/db/src/repos/page-fact.ts`
- Create: `packages/db/src/repos/leadership.ts`
- Create: `packages/db/src/repos/slot-decision.ts`
- Create: `packages/db/src/repos/url-candidate.ts`
- Create: `packages/db/src/repos/recovery-attempt.ts`
- Create: `packages/db/src/repos/review.ts`
- Create: `packages/db/src/repos/result-row.ts`
- Create: `packages/db/src/repos/export-artifact.ts`
- Create: `packages/db/src/repos/repos.test.ts`
- Modify: `packages/db/src/repos/index.ts`
- Modify: `packages/db/src/types.ts`（补充各表读取行类型别名，供仓储签名引用）

**Interfaces:**
- Consumes: `createDb`、`migrateToLatest`、Task1/2 合同类型、Task3 迁移
- Produces: 各仓储类方法（后续 tasks 消费）

`CrawlIntentRepository`：
```ts
class CrawlIntentRepository {
  constructor(db: Kysely<Database>)
  async createIfAbsent(input: { taskRunId: string; institutionSnapshotId: string | null; originalUrl: string; canonicalKey: string; priority: FrontierPriority; phase: string; purpose: string }): Promise<CrawlIntentRow>  // onConflict(task_run_id, canonical_key, purpose) doNothing
  async listByTask(taskRunId: string): Promise<CrawlIntentRow[]>
}
```
`FetchAttemptRepository`：
```ts
class FetchAttemptRepository {
  constructor(db: Kysely<Database>)
  async create(input: { taskRunId: string; crawlIntentId: string | null; fetchMode: FetchMode; url: string; canonicalKey: string; httpStatus: number | null; status: string; resolvedIp: string | null; durationMs: number; redirectedUrl: string | null; documentSnapshotId: string | null; errorMessage: string | null }): Promise<FetchAttemptRow>
  async listByTask(taskRunId: string): Promise<FetchAttemptRow[]>
}
```
`DocumentSnapshotRepository`：
```ts
class DocumentSnapshotRepository {
  constructor(db: Kysely<Database>)
  async upsertByHash(input: { contentHash: string; mimeType: string; charset: string | null; sizeBytes: number; relativePath: string }): Promise<DocumentSnapshotRow>  // onConflict(content_hash) doNothing 后查回
}
```
`PageFactRepository`（`saveFacts`）、`LeadershipRepository`（`saveLeadership` + `addRoleAssignments`）、`SlotDecisionRepository`（`upsertSlot`）、`UrlCandidateRepository`（`addCandidate`）、`RecoveryAttemptRepository`（`addAttempt`）、`ReviewRepository`（`createReviewJob` + `addDecision`，`createReviewJob` 以 `unique_request_key` 唯一约束防复用）、`ResultRowRepository`（`upsertCurrentResult`，按 task+institution+slot 唯一；`listByTask`；`getByTaskSlot`）、`ExportArtifactRepository`（`save`）。

以上全部仓储类从 `packages/db/src/repos/index.ts` 重新导出（`export { ... }`），供 Task 9/11 经 `@stellaris/db` 引用。

`repos.test.ts`（真实 DB 集成）验证：
- `createIfAbsent` 同 canonical_key+purpose 二次调用返回同一条（唯一去重）；
- `review.unique_request_key` 与 Collector fetch 的 canonical_key 不同的断言在 Task 8/9 复用；
- `result_row.upsertCurrentResult` 同 task+institution+slot 二次写入仍只有一行（当前结果唯一）。

- [ ] **Step 1: 写入失败测试**

`packages/db/src/repos/repos.test.ts`（Testcontainers 前缀同 Task 3；前置已迁移、已有任务行 `t` 与机构行 `inst`；断言 createIfAbsent 去重、slot 唯一、review key 唯一）：
```ts
import { GenericContainer, StartedTestContainer } from "testcontainers";
import { createDb } from "../client.js";
import { migrateToLatest } from "../migrate.js";
import { CrawlIntentRepository } from "./crawl-intent.js";
import { ReviewRepository } from "./review.js";
import { ResultRowRepository } from "./result-row.js";

let container: StartedTestContainer;
let db: ReturnType<typeof createDb>;
let t: string; // 任务 id
beforeAll(async () => {
  container = await new GenericContainer("postgres:18")
    .withExposedPorts(5432)
    .withEnvironment({ POSTGRES_USER: "stellaris", POSTGRES_PASSWORD: "stellaris_dev", POSTGRES_DB: "stellaris" })
    .start();
  db = createDb({ host: container.getHost(), port: container.getMappedPort(5432), user: "stellaris", password: "stellaris_dev", database: "stellaris" });
  await migrateToLatest(db);
  const task = await db.insertInto("task_run").values({ idempotency_key: "repos-test-key", mode: "TARGETED", expand_level: "COUNTY", status: "PENDING", rule_version: "v1" }).returning("id").executeTakeFirstOrThrow();
  t = task.id;
}, 120_000);
afterAll(async () => { await container.stop(); });

it("同任务同 canonical_key 同 purpose 的抓取意图只创建一条", async () => {
  const repo = new CrawlIntentRepository(db);
  const a = await repo.createIfAbsent({ taskRunId: t, institutionSnapshotId: null, originalUrl: "https://a/", canonicalKey: "ck1", priority: 1, phase: "primary", purpose: "collector" });
  const b = await repo.createIfAbsent({ taskRunId: t, institutionSnapshotId: null, originalUrl: "https://a/", canonicalKey: "ck1", priority: 1, phase: "primary", purpose: "collector" });
  expect(a.id).toBe(b.id);
});
it("review_job.unique_request_key 唯一约束生效", async () => {
  await expect(db.insertInto("review_job").values({ task_run_id: t, url: "https://a/", status: "PENDING", unique_request_key: "same-key" }).execute()).resolves.toBeDefined();
  await expect(db.insertInto("review_job").values({ task_run_id: t, url: "https://a/", status: "PENDING", unique_request_key: "same-key" }).execute()).rejects.toThrow();
});
it("同任务同机构同槽位只保留一个当前结果行", async () => {
  const inst = await db.insertInto("institution_snapshot").values({ task_run_id: t, region_code: "110000", official_name: "某某区人民政府", institution_type: "government", discovery_source: "user_specified", select_two_primary: true, frozen_at: new Date().toISOString() }).returning("id").executeTakeFirstOrThrow();
  const repo = new ResultRowRepository(db);
  await repo.upsertCurrentResult({ taskRunId: t, institutionSnapshotId: inst.id, slot: "PRIMARY_1", regionCode: "110000", institutionName: "某某区人民政府", positionDisplay: "某某区人民政府 区长", personName: "张三", currentStatusZh: "正式在任", positionUrl: null, pageTypeZh: null, resultZh: "完整搜索后无合格URL", collectedAt: new Date().toISOString() });
  await repo.upsertCurrentResult({ taskRunId: t, institutionSnapshotId: inst.id, slot: "PRIMARY_1", regionCode: "110000", institutionName: "某某区人民政府", positionDisplay: "某某区人民政府 区长", personName: "张三", currentStatusZh: "正式在任", positionUrl: null, pageTypeZh: null, resultZh: "已找到并复核", collectedAt: new Date().toISOString() });
  const rows = await repo.listByTask(t);
  const primary1 = rows.filter(r => r.slot === "PRIMARY_1");
  expect(primary1).toHaveLength(1);
  expect(primary1[0].resultZh).toBe("已找到并复核");
});
```

- [ ] **Step 2: 运行测试确认先失败**

Run: `pnpm --filter @stellaris/db exec vitest run src/repos/repos.test.ts`
Expected: FAIL（仓储类未导出、unique_request_key 唯一约束在迁移 2 前缺失）。

- [ ] **Step 3: 实现全部仓储**

按"Interfaces"签名实现各仓储类，并在 `repos/index.ts` 的 `Repositories` 接口与 `createRepositories()` 中组合。

- [ ] **Step 4: 运行测试**

Run: `pnpm --filter @stellaris/db exec vitest run src/repos/repos.test.ts`
Expected: PASS。

- [ ] **Step 5: 相关全量验证**

Run: `pnpm --filter @stellaris/db test && pnpm typecheck && pnpm test`
Expected: 全 PASS。

- [ ] **Step 6: 独立验证检查点**

Run: `pnpm --filter @stellaris/db exec vitest run src/repos/repos.test.ts src/db.integration.test.ts src/evidence-invariant.test.ts`
Expected: 退出码 0。

---

### Task 5: 内容寻址证据库（E:\StellarisData\evidence）

**Files:**
- Create: `packages/evidence/src/store.ts`
- Create: `packages/evidence/src/store.test.ts`

**Interfaces:**
- Consumes: `@stellaris/contracts`（无新增）
- Produces:
```ts
export interface EvidenceStore {
  save(input: { raw: Uint8Array; mimeType: string; charset?: string; category: "html" | "json" | "headers" | "screenshot" }): Promise<{ contentHash: string; relativePath: string; sizeBytes: number }>;
  read(relativePath: string): Promise<Uint8Array>;            // 读取并校验哈希
  resolvePath(relativePath: string): string;                  // 证据根 + 相对路径（拒绝绝对路径/穿越）
  integrityCheck(): Promise<{ missingReferences: string[]; orphanFiles: string[]; totalFiles: number }>;
}
export function createEvidenceStore(rootDir: string): EvidenceStore;
```

实现要点（规格 §17.2）：
- 对未压缩原始字节流式计算 SHA-256（`createHash("sha256")`）；
- 写入 `rootDir/tmp/<uuid>`，`fs.writeFile` + `fsync` 后原子 `rename` 到 `rootDir/sha256/<前两位>/<次两位>/<hash>.<category>.bin`；
- 相同哈希返回同一 `relativePath`（去重）；
- `read` 读取后重新哈希比对，不符抛 `EvidenceCorruptError`；
- `relativePath` 规范化：拒绝 `..`、绝对路径、盘符；只允许 `sha256/…` 下相对路径；
- `integrityCheck` 对比 DB 引用集与磁盘文件集（DB 侧引用由 Task 9 的完整性扫描测试注入）。

- [ ] **Step 1: 写入失败测试**

`packages/evidence/src/store.test.ts`（使用 OS 临时目录，避免污染 E 盘真实证据根）：
```ts
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createEvidenceStore } from "./store.js";

describe("证据库", () => {
  let dir: string; let store: ReturnType<typeof createEvidenceStore>;
  beforeAll(async () => { dir = await mkdtemp(join(tmpdir(), "stellaris-ev-")); store = createEvidenceStore(dir); });
  afterAll(async () => { await rm(dir, { recursive: true, force: true }); });

  it("相同内容去重，不同内容不同哈希", async () => {
    const a = await store.save({ raw: new TextEncoder().encode("same"), mimeType: "text/html", category: "html" });
    const b = await store.save({ raw: new TextEncoder().encode("same"), mimeType: "text/html", category: "html" });
    expect(a.contentHash).toBe(b.contentHash);
    expect(a.relativePath).toBe(b.relativePath);
    const c = await store.save({ raw: new TextEncoder().encode("other"), mimeType: "text/html", category: "html" });
    expect(c.contentHash).not.toBe(a.contentHash);
  });
  it("相对路径拒绝绝对路径与穿越", async () => {
    await expect(store.save({ raw: new TextEncoder().encode("x"), mimeType: "text/html", category: "html" })).resolves.toBeDefined();
    expect(() => store.resolvePath("C:/Windows/evil")).toThrow();
    expect(() => store.resolvePath("../outside")).toThrow();
  });
  it("读取校验哈希，损坏抛 EvidenceCorruptError", async () => {
    const saved = await store.save({ raw: new TextEncoder().encode("tamper"), mimeType: "text/html", category: "html" });
    const p = store.resolvePath(saved.relativePath);
    const { writeFile } = await import("node:fs/promises");
    await writeFile(p, Buffer.from("tampered!!"));
    await expect(store.read(saved.relativePath)).rejects.toThrow("哈希校验失败");
  });
});
```

- [ ] **Step 2: 运行测试确认先失败**

Run: `pnpm --filter @stellaris/evidence test`
Expected: FAIL（`store.ts` 不存在）。

- [ ] **Step 3: 实现最小证据库**

按"Interfaces"实现 `store.ts`（含流式哈希、临时写、原子改名、去重、读取校验、完整性扫描、路径安全）。

- [ ] **Step 4: 运行测试**

Run: `pnpm --filter @stellaris/evidence test`
Expected: PASS。

- [ ] **Step 5: 相关全量验证**

Run: `pnpm --filter @stellaris/evidence typecheck && pnpm test`
Expected: PASS。

- [ ] **Step 6: 独立验证检查点**

Run: `pnpm --filter @stellaris/evidence test && pnpm --filter @stellaris/evidence build`
Expected: 退出码 0；不写入 `E:\StellarisData\evidence`（测试用临时目录），真实证据根由 Task 11/13 在集成路径创建。

---

### Task 6: 安全出口 + HTTP 优先抓取（离线 fixture）

**Files:**
- Create: `packages/crawler/src/safe-egress.ts`
- Create: `packages/crawler/src/safe-egress.test.ts`
- Create: `packages/crawler/src/http-fetch.ts`
- Create: `packages/crawler/src/http-fetch.test.ts`
- Create: `packages/crawler/src/sanitize.ts`
- Create: `packages/crawler/src/sanitize.test.ts`
- Create: `packages/crawler/src/robots.ts`
- Create: `packages/crawler/src/robots.test.ts`
- Create: `packages/crawler/src/browser-upgrade.ts`
- Create: `packages/crawler/src/browser-upgrade.test.ts`
- Create: `packages/crawler/src/testing/fixture-server.ts`
- Modify: `packages/crawler/package.json`（补充 `exports` 子路径：`./safe-egress.js`、`./testing/fixture-server.js`；`./page-facts.js` 在 Task 7 与 page-facts 一并补充）

**Interfaces:**
- Consumes: 无外部（Node 内置）
- Produces:
```ts
export type EgressMode = "offline-fixture" | "production";
export interface SafeEgressPolicy {
  mode: EgressMode;
  allowedPorts: ReadonlySet<number>;          // 默认 {80,443}
  allowedTestPorts: ReadonlySet<number>;      // offline-fixture 模式下允许的本地端口（如 {8899}）
  maxRedirects: number;                        // 5
  maxBytes: number;                            // 10 * 1024 * 1024
  maxTimeoutMs: number;
}
export function createSafeEgressPolicy(opts?: Partial<SafeEgressPolicy>): SafeEgressPolicy;
export function assertAllowedUrl(url: string, policy: SafeEgressPolicy): void;   // 协议/端口/私网/环回/保留地址；offline-fixture 模式例外仅限显式登记端口
export function assertRedirectChain(urls: string[], policy: SafeEgressPolicy): void;
export interface HttpResponse {
  fetchUrl: string; originalUrl: string; canonicalKey: string;
  status: number; headers: Headers; body: Uint8Array; redirectChain: string[];
}
export async function httpFetch(url: string, policy: SafeEgressPolicy): Promise<HttpResponse>;
export function shouldUpgradeToPlaywright(doc: { bodyLength: number; hashRoute: boolean; dynamicList: boolean; blocked: boolean }): boolean;

// sanitize.ts —— 统一脱敏（规格 §23 与 §9.2）：SSE、日志、证据摘要统一出口
export function sanitizeUrlForDisplay(url: string): string;        // 去掉 userinfo、追踪参数值保留键名、截断超长查询
export function sanitizeHeaderNameForLog(name: string): string;    // 白名单头名原样返回，其余一律 "REDACTED"
export function sanitizeTextForEvidence(text: string): string;     // 去除 Cookie/Authorization 值、<secret> 替换

// robots.ts —— robots.txt 读取与访问限制（规格 §9.3/§23.4）
export interface RobotsPolicy {
  isAllowed(url: string, userAgent: string): boolean;
  crawlDelayMs(): number | null;
}
export async function loadRobots(url: string, policy: SafeEgressPolicy): Promise<RobotsPolicy | null>; // 经安全出口获取；失败返回 null 并按降级规则处理

export function createFixtureServer(roots: Array<{ pathPrefix: string; dir: string }>): Promise<{ url: string; close(): Promise<void>; basePort: number }>;
```

实现要点（规格 §23.1）：
- `assertAllowedUrl`：仅 `http/https`；拒绝 URL 用户名/密码；端口默认仅 80/443，offline-fixture 模式对显式登记端口放行；`resolve4/6` 解析全部 A/AAAA，拒绝环回/私有/链路本地/组播/保留/云元数据（`169.254.169.254`）等；`isLoopback/isPrivate` 用 `net.isIP`＋前缀判断；
- `httpFetch`：`fetch`（undici）请求前 `assertAllowedUrl`；收到响应后逐跳 `assertAllowedUrl(redirect)`；超过 `maxRedirects` 拒绝；`Content-Length`/流式计数超过 `maxBytes` 截断并抛 `OversizedResponseError`；`canonicalKey` = 协议+host+pathname（去显式追踪参数）；
- `shouldUpgradeToPlaywright`：正文缺失/`hash` 路由/动态列表/HTTP 阻断之一成立 → true；
- `createFixtureServer`：`node:http` 静态服务指定目录文件，端口 0（自动分配）由实现记录。

`safe-egress.test.ts`：
```ts
import { createSafeEgressPolicy, assertAllowedUrl, assertRedirectChain } from "./safe-egress.js";

const productionPolicy = createSafeEgressPolicy({ mode: "production" });

it("拒绝 file:/ftp:/ws: 协议", () => {
  for (const u of ["file:///etc/passwd", "ftp://x/", "ws://x/", "data:text/plain,x"]) {
    expect(() => assertAllowedUrl(u, productionPolicy)).toThrow();
  }
});
it("生产模式拒绝 127.0.0.1/10.0.0.0/169.254.169.254", () => {
  for (const u of ["http://127.0.0.1/", "http://10.1.2.3/", "http://169.254.169.254/latest/meta-data/", "http://[::1]/"]) {
    expect(() => assertAllowedUrl(u, productionPolicy)).toThrow();
  }
});
it("offline-fixture 模式对登记测试端口放行", () => {
  const policy = createSafeEgressPolicy({ mode: "offline-fixture", allowedTestPorts: new Set([8899]) });
  expect(() => assertAllowedUrl("http://127.0.0.1:8899/golden/collection.html", policy)).not.toThrow();
});
it("重定向逐跳复核：中间跳落到私网被拒", () => {
  expect(() => assertRedirectChain(["http://ok/", "http://10.0.0.1/"], productionPolicy)).toThrow();
});
```

`http-fetch.test.ts`：
```ts
import { join } from "node:path";
import { createFixtureServer } from "./testing/fixture-server.js";
import { httpFetch } from "./http-fetch.js";
import { createSafeEgressPolicy } from "./safe-egress.js";

describe("http-fetch 离线抓取", () => {
  it("离线 fixture 抓取成功并保留 originalUrl/fetchUrl/canonicalKey", async () => {
    const srv = await createFixtureServer([{ pathPrefix: "/golden", dir: join(import.meta.dirname, "golden") }]);
    const policy = createSafeEgressPolicy({ mode: "offline-fixture", allowedTestPorts: new Set([srv.basePort]) });
    const res = await httpFetch(`${srv.url}/golden/collection.html`, policy);
    expect(res.status).toBe(200);
    expect(res.originalUrl).toBe(`${srv.url}/golden/collection.html`);
    expect(res.fetchUrl).toBe(res.originalUrl);
    expect(res.canonicalKey).toBeTruthy();
    await srv.close();
  });
  it("超限响应被截断拒绝", async () => {
    // fixture 端返回超大正文（>maxBytes），httpFetch 抛 OversizedResponseError
  });
});
```

`sanitize.test.ts`：
```ts
it("URL userinfo 与追踪参数值被脱敏，业务参数键保留", () => {
  expect(sanitizeUrlForDisplay("https://user:pass@x.gov.cn/a?token=abc&id=1")).toBe("https://x.gov.cn/a?token=***&id=1");
});
it("Cookie/Authorization 值从证据文本移除", () => {
  expect(sanitizeTextForEvidence("Cookie: abc=1; Authorization: Bearer secret")).not.toMatch(/Bearer secret|abc=1/);
});
it("SSE 载荷白名单外头名一律 REDACTED", () => {
  expect(sanitizeHeaderNameForLog("content-type")).toBe("content-type");
  expect(sanitizeHeaderNameForLog("x-session-token")).toBe("REDACTED");
});
```

`robots.test.ts`：
```ts
import { join } from "node:path";
import { createFixtureServer } from "./testing/fixture-server.js";
import { loadRobots, type RobotsPolicy } from "./robots.js";
import { createSafeEgressPolicy } from "./safe-egress.js";

describe("robots 遵守", () => {
  let srv: Awaited<ReturnType<typeof createFixtureServer>>;
  let robots: RobotsPolicy | null;
  beforeAll(async () => {
    srv = await createFixtureServer([{ pathPrefix: "/robots-fixture", dir: join(import.meta.dirname, "golden") }]);
    const policy = createSafeEgressPolicy({ mode: "offline-fixture", allowedTestPorts: new Set([srv.basePort]) });
    robots = await loadRobots(`${srv.url}/robots-fixture/robots.txt`, policy);
  });
  afterAll(async () => { await srv.close(); });

  it("robots 禁止路径返回 not allowed，允许路径返回 allowed", () => {
    expect(robots).not.toBeNull();
    expect(robots!.isAllowed(`${srv.url}/robots-fixture/collection.html`, "*")).toBe(true);
    expect(robots!.isAllowed(`${srv.url}/robots-fixture/private/`, "*")).toBe(false);
  });
  it("robots 获取失败时按降级规则处理（null 不阻断但标记）", async () => {
    const prod = createSafeEgressPolicy({ mode: "production" });
    const missing = await loadRobots("http://127.0.0.1:1/robots.txt", prod);
    expect(missing).toBeNull();
  });
});
```
> 注：`golden/robots.txt` 内容为 `User-agent: *\nDisallow: /private/`，随本 Task 一并加入 `packages/crawler/src/golden/`。

- [ ] **Step 1: 写入失败测试**

创建上述六个测试文件（`safe-egress`/`http-fetch`/`sanitize`/`robots`/`browser-upgrade`/`fixture-server` 未实现，先失败）。

- [ ] **Step 2: 运行测试确认先失败**

Run: `pnpm --filter @stellaris/crawler test`
Expected: FAIL（模块不存在）。

- [ ] **Step 3: 实现最小安全出口与抓取**

按"Interfaces"实现 `safe-egress.ts`、`http-fetch.ts`、`sanitize.ts`、`robots.ts`、`browser-upgrade.ts`、`fixture-server.ts`。robots 降级规则：获取失败/不可解析按 `null` 返回，调用方标记"robots 未知"并维持礼貌并发，不因 robots 失败放行任何访问控制绕过。

- [ ] **Step 4: 运行测试**

Run: `pnpm --filter @stellaris/crawler test`
Expected: PASS。

- [ ] **Step 5: 相关全量验证**

Run: `pnpm --filter @stellaris/crawler typecheck && pnpm test`
Expected: PASS。

- [ ] **Step 6: 独立验证检查点**

Run: `pnpm --filter @stellaris/crawler test && pnpm build`
Expected: 退出码 0；全程仅访问本地 fixture 端口，无任何真实公网请求。

---

### Task 7: 页面事实抽取 + 金标 fixture（Cheerio）

**Files:**
- Create: `packages/crawler/src/golden/collection.html`
- Create: `packages/crawler/src/golden/leader-detail-1.html`
- Create: `packages/crawler/src/golden/leader-detail-2.html`
- Create: `packages/crawler/src/golden/forbidden-news.html`
- Create: `packages/crawler/src/page-facts.ts`
- Create: `packages/crawler/src/page-facts.test.ts`
- Modify: `packages/crawler/package.json`（补充 `exports` 子路径 `./page-facts.js`）
- Create: `tests/golden/manifest.json`

**Interfaces:**
- Consumes: `httpFetch`/`SafeEgressPolicy`（Task 6）
- Produces:
```ts
export interface LeadershipMemberFact {
  name: string;
  roles: string[];
  sortOrder: number;
  href: string | null;
}
export interface PageFacts {
  documentHash: string;
  title: string | null;
  bodyText: string;
  leadershipMembers: LeadershipMemberFact[];
  links: Array<{ href: string; anchor: string }>;
  pageDate: string | null;
}
export async function extractPageFacts(html: Uint8Array): Promise<PageFacts>;
```

金标 `collection.html`（当前领导集合页，含两名主要领导人链接与岗位）：
```html
<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><title>某某区人民政府领导信息</title></head>
<body>
<h1>领导信息</h1>
<table id="leaderTable">
  <tr><th>姓名</th><th>职务</th><th>分工</th></tr>
  <tr><td><a href="/ldr/zhang-san.html">张三</a></td><td>区长</td><td>主持区政府全面工作</td></tr>
  <tr><td><a href="/ldr/li-si.html">李四</a></td><td>常务副区长</td><td>负责常务工作</td></tr>
  <tr><td><a href="/ldr/wang-wu.html">王五</a></td><td>副区长</td><td>分管教育</td></tr>
</table>
</body></html>
```
`leader-detail-1.html`（张三详情：简历、当前职务、页面日期）与 `leader-detail-2.html`（李四详情）结构类似；`forbidden-news.html` 为新闻列表页（标题含"工作动态"），用于判型为禁止。

`manifest.json`：
```json
{
  "pages": [
    { "path": "collection.html", "expectedType": "CURRENT_LEADER_COLLECTION", "assertions": ["张三", "李四", "区长", "常务副区长"] },
    { "path": "leader-detail-1.html", "expectedType": "OFFICIAL_BIOGRAPHY", "assertions": ["张三", "区长"] },
    { "path": "leader-detail-2.html", "expectedType": "OFFICIAL_BIOGRAPHY", "assertions": ["李四", "常务副区长"] },
    { "path": "forbidden-news.html", "expectedType": "FORBIDDEN", "assertions": [] }
  ]
}
```

`page-facts.test.ts`：
```ts
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { extractPageFacts } from "./page-facts.js";

it("从金标集合页抽取完整领导结构与姓名链接", async () => {
  const html = await readFile(join(import.meta.dirname, "golden", "collection.html"));
  const facts = await extractPageFacts(new Uint8Array(html));
  expect(facts.title).toContain("领导信息");
  expect(facts.leadershipMembers.map(m => m.name)).toEqual(["张三", "李四", "王五"]);
  expect(facts.leadershipMembers[0].href).toContain("zhang-san.html");
  expect(facts.leadershipMembers[0].roles).toContain("区长");
  expect(facts.bodyText).toContain("主持区政府全面工作");
});
```

- [ ] **Step 1: 写入金标 fixture 与失败测试**

创建 4 个 golden HTML、`manifest.json`、`page-facts.test.ts`。

- [ ] **Step 2: 运行测试确认先失败**

Run: `pnpm --filter @stellaris/crawler exec vitest run src/page-facts.test.ts`
Expected: FAIL（`page-facts.ts` 不存在）。

- [ ] **Step 3: 实现最小抽取**

按"Interfaces"实现 `extractPageFacts`（Cheerio：`load` html，`#leaderTable tr` 抽姓名/职务/链接/顺序，正文 `body` 文本，`a[href]` 链接清单）。

- [ ] **Step 4: 运行测试**

Run: `pnpm --filter @stellaris/crawler exec vitest run src/page-facts.test.ts`
Expected: PASS。

- [ ] **Step 5: 相关全量验证**

Run: `pnpm --filter @stellaris/crawler test && pnpm typecheck`
Expected: PASS。

- [ ] **Step 6: 独立验证检查点**

Run: `pnpm --filter @stellaris/crawler test`
Expected: 退出码 0。

---

### Task 8: 规则引擎（判型/领导结构/选人/当前性/硬门槛/Recovery）

**Files:**
- Create: `packages/rules/src/classify.ts`
- Create: `packages/rules/src/leadership.ts`
- Create: `packages/rules/src/selection.ts`
- Create: `packages/rules/src/currentness.ts`
- Create: `packages/rules/src/admission.ts`
- Create: `packages/rules/src/recovery.ts`
- Create: `packages/rules/src/rules.test.ts`

**Interfaces:**
- Consumes: `@stellaris/contracts`（PageType/CurrentnessStatus/Slot/ReviewDecision/InstitutionType）；`extractPageFacts`（Task 7）
- Produces:
```ts
export type PageClassification = { pageType: PageType; forbidden: boolean; forbiddenReason?: string };
export function classifyPage(title: string, bodyText: string, facts: PageFacts): PageClassification;   // 五类允许 + FORBIDDEN/UNKNOWN

export interface LeadershipStructure {
  institutionSnapshotId: string;
  members: Array<{ personName: string; roles: string[]; sortOrder: number; currentnessStatus: CurrentnessStatus }>;
}
export function assembleLeadership(institutionSnapshotId: string, facts: PageFacts[], currentness: Map<string, CurrentnessStatus>): LeadershipStructure;

export interface SlotSelection { slot: Slot; personName: string | null; status: "FILLED" | "VACANT" | "UNCONFIRMED" }
export function selectTwoPrimary(institutionType: InstitutionType, structure: LeadershipStructure): [SlotSelection, SlotSelection];
// 规则示例：政府类 PRIMARY_1=正式负责人（区长/县长/书记），PRIMARY_2=常务副职或主持工作；纪委监委分别输出；同一人不得占两槽位；空缺输出"空缺"（status=VACANT, personName=null）

export function evaluateCurrentness(facts: PageFacts[], collectionHrefs: string[]): CurrentnessStatus;  // 六状态

export interface HardGateResult { passed: boolean; failures: Array<{ gate: string; reason: string }> }
export const HARD_GATES = ["official_domain","allowed_page_type","supports_person","supports_institution","supports_official_role","currentness_ok","priority_entry_checked","reviewer_consistent","no_forbidden_signal"] as const;
export function checkHardGates(input: {
  url: string; pageType: PageType; forbidden: boolean;
  personName: string; institutionName: string; officialRole: string;
  currentness: CurrentnessStatus; priorityEntryChecked: boolean; reviewerConsistent: boolean;
  officialDomains: string[]; forbiddenSignals: string[];
}): HardGateResult;

export interface RecoveryDecision { triggered: boolean; reason?: string; nextStrategies: string[] }
export function decideRecovery(context: { urlEmpty: boolean; forbidden: boolean; personMismatch: boolean; institutionMismatch: boolean; roleMismatch: boolean; currentnessConflict: boolean; priorityNotChecked: boolean; secondUnconfirmed: boolean; reviewerDisagree: boolean }): RecoveryDecision;  // 任一触发

export function buildRecoveryOrder(): string[];  // 规格 §14.3 八步顺序
```

`rules.test.ts`（先失败）：
```ts
import type { PageFacts } from "@stellaris/crawler/page-facts.js";
import { classifyPage } from "./classify.js";
import { selectTwoPrimary } from "./selection.js";
import { checkHardGates } from "./admission.js";
import { decideRecovery } from "./recovery.js";
import type { LeadershipStructure } from "./leadership.js";

const collectionFacts: PageFacts = {
  documentHash: "h1", title: "某某区人民政府领导信息", bodyText: "张三 区长；李四 常务副区长；王五 副区长",
  leadershipMembers: [
    { name: "张三", roles: ["区长"], sortOrder: 1, href: "https://x.gov.cn/ldr/zhang-san.html" },
    { name: "李四", roles: ["常务副区长"], sortOrder: 2, href: "https://x.gov.cn/ldr/li-si.html" },
    { name: "王五", roles: ["副区长"], sortOrder: 3, href: "https://x.gov.cn/ldr/wang-wu.html" },
  ],
  links: [], pageDate: null,
};
const newsFacts: PageFacts = {
  documentHash: "h2", title: "某某区工作动态", bodyText: "会议调研报道 工作动态",
  leadershipMembers: [], links: [], pageDate: null,
};
const structure: LeadershipStructure = {
  institutionSnapshotId: "i1",
  members: [
    { personName: "张三", roles: ["区长"], sortOrder: 1, currentnessStatus: "CURRENT_COLLECTION_MEMBER" },
    { personName: "李四", roles: ["常务副区长"], sortOrder: 2, currentnessStatus: "CURRENT_COLLECTION_MEMBER" },
    { personName: "王五", roles: ["副区长"], sortOrder: 3, currentnessStatus: "CURRENT_COLLECTION_MEMBER" },
  ],
};

it("集合页判型为 CURRENT_LEADER_COLLECTION，新闻页判型为禁止", () => {
  const c1 = classifyPage("某某区人民政府领导信息", "张三 区长 李四", collectionFacts);
  expect(c1.pageType).toBe("CURRENT_LEADER_COLLECTION");
  const c2 = classifyPage("某某区工作动态", "会议调研报道", newsFacts);
  expect(c2.forbidden).toBe(true);
});
it("政府机构选出 PRIMARY_1=张三、PRIMARY_2=李四", () => {
  const sel = selectTwoPrimary("government", structure);   // 张三=区长(正式), 李四=常务副区长
  expect(sel[0]).toMatchObject({ slot: "PRIMARY_1", personName: "张三", status: "FILLED" });
  expect(sel[1]).toMatchObject({ slot: "PRIMARY_2", personName: "李四", status: "FILLED" });
});
it("任一硬门槛失败则准入失败，分数不抵门槛", () => {
  const r = checkHardGates({ url: "https://x/", pageType: "CURRENT_LEADER_COLLECTION", forbidden: false, personName: "张三", institutionName: "某某区人民政府", officialRole: "区长", currentness: "CURRENT_COLLECTION_MEMBER", priorityEntryChecked: true, reviewerConsistent: false, officialDomains: ["x.gov.cn"], forbiddenSignals: [] });
  expect(r.passed).toBe(false);
  expect(r.failures.some(f => f.gate === "reviewer_consistent")).toBe(true);
});
it("URL 为空、人员错误、当前性冲突任一都触发 Recovery", () => {
  expect(decideRecovery({ urlEmpty: true, forbidden: false, personMismatch: false, institutionMismatch: false, roleMismatch: false, currentnessConflict: false, priorityNotChecked: false, secondUnconfirmed: false, reviewerDisagree: false }).triggered).toBe(true);
  expect(decideRecovery({ urlEmpty: false, forbidden: false, personMismatch: false, institutionMismatch: false, roleMismatch: false, currentnessConflict: true, priorityNotChecked: false, secondUnconfirmed: false, reviewerDisagree: false }).triggered).toBe(true);
});
```
> 注：`@stellaris/crawler/page-facts.js` 经 `packages/crawler/package.json` `exports` 子路径导出（Task 6 实现时补充映射）；`@stellaris/rules` 需在 Task 8 声明对 `@stellaris/crawler` 的类型依赖（type-only import，运行时无循环依赖）。

- [ ] **Step 1: 写入失败测试**

创建 `rules.test.ts`（引用未实现模块）；先安装依赖：
Run: `pnpm --filter @stellaris/rules add @stellaris/crawler@workspace:*`
Expected: 锁文件与 `packages/rules/package.json` 更新（type-only 依赖）。

- [ ] **Step 2: 运行测试确认先失败**

Run: `pnpm --filter @stellaris/rules test`
Expected: FAIL（模块不存在）。

- [ ] **Step 3: 实现最小规则模块**

按"Interfaces"实现六个模块（纯 TypeScript 规则，不调用 LLM；`evaluateCurrentness` 用集合成员/详情链接关系判定六状态；`checkHardGates` 九门槛；`buildRecoveryOrder` 八步）。

- [ ] **Step 4: 运行测试**

Run: `pnpm --filter @stellaris/rules test`
Expected: PASS。

- [ ] **Step 5: 相关全量验证**

Run: `pnpm --filter @stellaris/rules typecheck && pnpm test`
Expected: PASS。

- [ ] **Step 6: 独立验证检查点**

Run: `pnpm --filter @stellaris/rules test && pnpm build`
Expected: 退出码 0。

---

### Task 9: 隔离 Reviewer（独立复抓 + 六方面一致）

**Files:**
- Create: `packages/rules/src/reviewer.ts`
- Create: `packages/rules/src/reviewer.test.ts`
- Modify: `packages/rules/package.json`（追加 `@stellaris/crawler` 为依赖，供 Reviewer 复抓；`testcontainers` 为 devDependency）

**Interfaces:**
- Consumes: `checkHardGates`/`classifyPage`/`evaluateCurrentness`（Task 8）；`httpFetch`/`extractPageFacts`（Task 6/7）；`FetchAttemptRepository`/`ReviewRepository`（Task 4）
- Produces:
```ts
export interface ReviewerInput {
  taskRunId: string; institutionSnapshotId: string; personName: string; institutionName: string;
  officialRole: string; urlToReview: string; upstreamUrls: string[]; policy: SafeEgressPolicy;
}
export interface ReviewerOutcome {
  dimensions: { person: boolean; institution: boolean; role: boolean; pageType: boolean; currentness: boolean; url: boolean };
  decision: ReviewDecision;   // 全部一致 => MATCH，否则 CONFLICT
  conflictReason: string | null;
  reviewerRequestKey: string; // 独立请求唯一键（purpose="reviewer" 的 canonical_key 派生）
}
export async function runReviewer(input: ReviewerInput, deps: { fetchAttempts: FetchAttemptRepository; reviews: ReviewRepository }): Promise<ReviewerOutcome>;
export function makeRequestKey(taskRunId: string, purpose: "collector" | "reviewer", canonicalKey: string): string; // 用途前缀区分，保证两键不同
```

实现要点（规格 §15）：
- Reviewer 只接收最小核验目标，不读 Collector 得分/判型/准入/抽取；
- 使用 `makeRequestKey(taskRunId, "reviewer", canonicalKey)`（与 Collector 的 `"collector"` 键不同），创建独立 `fetch_attempt`；
- 用新响应重算 `classifyPage`/`extractPageFacts`/`evaluateCurrentness`，与输入六方面比对；
- 全部一致 → `MATCH`，任一分歧 → `CONFLICT`＋中文原因；`url` 维度比较最终 URL 是否等于 `urlToReview`；
- `review_job` 写入独立请求键（唯一约束生效）。

`reviewer.test.ts`：
```ts
import { describe, it, expect } from "vitest";
import { makeRequestKey, runReviewer } from "./reviewer.js";
import { createFixtureServer } from "@stellaris/crawler/testing/fixture-server.js";
import { createSafeEgressPolicy } from "@stellaris/crawler/safe-egress.js";
import type { SafeEgressPolicy } from "@stellaris/crawler/safe-egress.js";
import { createDb } from "@stellaris/db";
import { migrateToLatest } from "@stellaris/db";
import { FetchAttemptRepository } from "@stellaris/db";
import { ReviewRepository } from "@stellaris/db";
import { GenericContainer } from "testcontainers";
import { join } from "node:path";

describe("隔离 Reviewer", () => {
  let srv: Awaited<ReturnType<typeof createFixtureServer>>;
  let policy: SafeEgressPolicy;
  let deps: { fetchAttempts: FetchAttemptRepository; reviews: ReviewRepository };

  beforeAll(async () => {
    const container = await new GenericContainer("postgres:18")
      .withExposedPorts(5432)
      .withEnvironment({ POSTGRES_USER: "stellaris", POSTGRES_PASSWORD: "stellaris_dev", POSTGRES_DB: "stellaris" })
      .start();
    const db = createDb({ host: container.getHost(), port: container.getMappedPort(5432), user: "stellaris", password: "stellaris_dev", database: "stellaris" });
    await migrateToLatest(db);
    deps = { fetchAttempts: new FetchAttemptRepository(db), reviews: new ReviewRepository(db) };
    srv = await createFixtureServer([{ pathPrefix: "/golden", dir: join(import.meta.dirname, "../../crawler/src/golden") }]);
    policy = createSafeEgressPolicy({ mode: "offline-fixture", allowedTestPorts: new Set([srv.basePort]) });
  }, 120_000);
  afterAll(async () => { await srv.close(); });

  it("Collector 与 Reviewer 请求键不同", () => {
    expect(makeRequestKey("t", "collector", "ck")).not.toBe(makeRequestKey("t", "reviewer", "ck"));
  });
  it("六方面一致返回 MATCH；页面类型分歧返回 CONFLICT", async () => {
    const base = { taskRunId: "t", institutionSnapshotId: "i", personName: "张三", institutionName: "某某区人民政府", officialRole: "区长", policy };
    const match = await runReviewer({ ...base, urlToReview: `${srv.url}/golden/leader-detail-1.html`, upstreamUrls: [`${srv.url}/golden/collection.html`] }, deps);
    expect(match.decision).toBe("MATCH");
    expect(match.reviewerRequestKey).toContain("reviewer");
    // 分歧：复抓页内容被判定为禁止/错误页面（此处用新闻页） -> CONFLICT
    const conflict = await runReviewer({ ...base, urlToReview: `${srv.url}/golden/forbidden-news.html`, upstreamUrls: [`${srv.url}/golden/collection.html`] }, deps);
    expect(conflict.decision).toBe("CONFLICT");
    expect(conflict.conflictReason).toBeTruthy();
  });
});
```
> 注：`@stellaris/crawler` 的 `testing/fixture-server.js` 与 `safe-egress.js` 经 `packages/crawler/package.json` `exports` 子路径导出（Task 6 实现时补充映射）；`ReviewRepository` 与 `FetchAttemptRepository` 由 Task 4 导出。

- [ ] **Step 1: 写入失败测试**

创建 `reviewer.test.ts`（引用未实现模块）；先安装依赖：
Run: `pnpm --filter @stellaris/rules add @stellaris/crawler@workspace:* && pnpm --filter @stellaris/rules add -D testcontainers`
Expected: 锁文件与 `packages/rules/package.json` 更新。

- [ ] **Step 2: 运行测试确认先失败**

Run: `pnpm --filter @stellaris/rules exec vitest run src/reviewer.test.ts`
Expected: FAIL。

- [ ] **Step 3: 实现最小 Reviewer**

按"Interfaces"实现 `reviewer.ts`。

- [ ] **Step 4: 运行测试**

Run: `pnpm --filter @stellaris/rules exec vitest run src/reviewer.test.ts`
Expected: PASS。

- [ ] **Step 5: 相关全量验证**

Run: `pnpm --filter @stellaris/rules test && pnpm typecheck && pnpm test`
Expected: PASS。

- [ ] **Step 6: 独立验证检查点**

Run: `pnpm --filter @stellaris/rules test`
Expected: 退出码 0；Reviewer 全程本地 fixture，独立网络事件且请求键不与 Collector 复用。

---

### Task 10: result_row 投影（中文化 + 终态原因 + 单结果不变量）

**Files:**
- Create: `packages/db/src/repos/result-row.ts`（扩充：投影方法）
- Create: `packages/db/src/result-projection.ts`
- Create: `packages/db/src/result-projection.test.ts`
- Modify: `packages/db/src/types.ts`（补充各表读取行类型别名）

**Interfaces:**
- Consumes: Task 2 `ResultRowView`；Task 3 触发器；Task 4 仓储
- Produces:
```ts
// types.ts 新增：与 schema 的 TaskRunRow/TargetScopeRow/InstitutionSnapshotRow 同构，为后续各表补充：
export type ResultRowRow = Selectable<ResultRowTable>;
export type CrawlIntentRow = Selectable<CrawlIntentTable>;
export type FetchAttemptRow = Selectable<FetchAttemptTable>;
export type DocumentSnapshotRow = Selectable<DocumentSnapshotTable>;
// （Task 4 仓储签名引用以上 Row 类型，统一以 Selectable<> 派生）

export interface TerminalChineseReasons { [key: string]: string }
export const TERMINAL_REASONS: TerminalChineseReasons = {
  NO_QUALIFIED_URL: "完整搜索后无合格URL",
  PERSON_UNCONFIRMED: "当前人员未确认",
  ROLE_VACANT: "岗位空缺",
  SITE_BLOCKED: "官网访问受限",
  SITE_TIMEOUT: "官网持续超时",
  STRUCTURE_UNCONFIRMED: "官网页面结构无法确认",
  CURRENTNESS_CONFLICT: "当前领导信息相互冲突",
  REVIEWER_CONFLICT: "Reviewer 复核不一致",
  SEARCH_UNAVAILABLE: "搜索服务暂不可用",
  USER_CANCELLED: "任务被用户取消",
  EVIDENCE_CORRUPT: "内部证据完整性错误",
};
export function mapResultRowToView(row: ResultRowRow): ResultRowView;   // 与导出/网页共用同一投影
export function resolveTerminalReason(code: string): string;            // 未知 code 仍返回可读中文兜底
```

实现要点：
- `upsertCurrentResult` 已按 task+institution+slot 唯一（Task 4）；投影只做字段重命名与可选字段映射，不做语义判断；
- 网页与 Excel 都调用 `mapResultRowToView`，确保同一份已复核 `result_row`。

`result-projection.test.ts`：
```ts
it("空 URL 行投影保留中文终态原因且 positionUrl 为空", () => {
  const row = makeRow({ position_url: null, result_zh: TERMINAL_REASONS.NO_QUALIFIED_URL });
  const view = mapResultRowToView(row);
  expect(view.positionUrl).toBeUndefined();
  expect(view.resultZh).toBe("完整搜索后无合格URL");
});
it("已复核 URL 行投影 positionUrl 与 pageTypeZh 齐备", () => {
  const view = mapResultRowToView(makeRow({ position_url: "https://x/", result_zh: "已找到并复核", page_type_zh: "个人简介页" }));
  expect(view.positionUrl).toBe("https://x/");
  expect(view.pageTypeZh).toBe("个人简介页");
});
```

- [ ] **Step 1: 写入失败测试**

创建 `result-projection.ts`（返回对象 shape）与测试。

- [ ] **Step 2: 运行测试确认先失败**

Run: `pnpm --filter @stellaris/db exec vitest run src/result-projection.test.ts`
Expected: FAIL。

- [ ] **Step 3: 实现最小投影**

按"Interfaces"实现 `result-projection.ts`，并在 `result-row.ts` 仓储中导出 `mapResultRowToView`（经 `index.ts` 暴露）。

- [ ] **Step 4: 运行测试**

Run: `pnpm --filter @stellaris/db exec vitest run src/result-projection.test.ts`
Expected: PASS。

- [ ] **Step 5: 相关全量验证**

Run: `pnpm --filter @stellaris/db test && pnpm typecheck && pnpm test`
Expected: PASS。

- [ ] **Step 6: 独立验证检查点**

Run: `pnpm --filter @stellaris/db test`
Expected: 退出码 0。

---

### Task 11: 任务 API + SSE（创建/详情/结果/导出路由）

**Files:**
- Create: `apps/backend/src/contracts/task-routes.ts`
- Create: `apps/backend/src/workers/replay-driver.ts`
- Create: `apps/backend/src/app.test.ts`
- Modify: `apps/backend/src/server.ts`
- Modify: `packages/db/package.json`（dev 依赖 `testcontainers`，若 Task 3 未加）

**Interfaces:**
- Consumes: Task 2 合同；Task 3/4/10 仓储与投影；Task 6/7/8/9 抓取与规则；`createEvidenceStore`（Task 5）
- Produces:
```ts
// server.ts 扩展签名（Task 11 Step 3 修改）：在既有 { host?, port? } 之上追加可选依赖注入
export interface ServerDeps {
  host?: string; port?: number;
  db?: Kysely<Database>;          // 缺省时按 dbConfigFromEnv 创建
  fixtureUrl?: string;            // 离线金标 fixture 基础 URL（缺省关闭）
  egressMode?: EgressMode;        // 缺省 production；离线测试传 "offline-fixture"
  fixturePort?: number;           // offline-fixture 放行端口
  evidenceRoot?: string;          // 缺省 E:\StellarisData\evidence
  exportRoot?: string;            // 缺省 E:\StellarisData\exports
}
// server.ts 内部据此组装 TaskRoutesDeps 并注册路由；/health 保持既有行为

// task-routes.ts
export interface TaskRoutesDeps {
  repos: Repositories;
  evidenceStore: EvidenceStore;
  runTaskPipeline: RunTaskPipeline;          // replay-driver 暴露
  policy: SafeEgressPolicy;
  fixture: { url: string; close(): Promise<void> } | null;  // 离线金标模式
  exportRoot: string;
}
export async function registerTaskRoutes(app: FastifyInstance, deps: TaskRoutesDeps): Promise<void>;
// 路由：
//   POST /api/tasks          请求 CreateTaskRequest -> CreateTaskResponse（幂等键冲突返回既有任务 + replayed）
//   GET  /api/tasks/:id      请求 -> TaskDetail（含 scopes + institution + 两槽位结果）
//   GET  /api/tasks/:id/results   -> ResultRowView[]
//   GET  /api/tasks/:id/evidence/:resultRowId -> EvidenceDetail
//   GET  /api/tasks/:id/export     -> 触发 exporter，返回 ExportStatus；重复请求返回既有 export_artifact
//   GET  /api/tasks/:id/events    -> SSE 流（Content-Type: text/event-stream；每条事件带 seq；断线按 seq 续传）

// replay-driver.ts
export interface RunTaskPipeline { (input: { taskRunId: string; repos: Repositories; evidenceStore: EvidenceStore; policy: SafeEgressPolicy; fixtureUrl: string; emit: (e: SseEvent) => void }): Promise<void>; }
export function createReplayDriver(deps: { policy: SafeEgressPolicy }): RunTaskPipeline;
// 纵向链路（离线）：冻结范围/机构 -> CrawlIntent(primary) -> httpFetch(fixture) -> 证据保存 -> extractPageFacts
//   -> assembleLeadership -> selectTwoPrimary -> checkHardGates -> 必要时 decideRecovery/runReviewer(fixture)
//   -> result_row.upsertCurrentResult（事务，position_url 仅 Reviewer MATCH 时非空）-> 记录 export_artifact 前置数据
```

`app.test.ts`（真实 DB + 本地 fixture，Testcontainers）：
```ts
import { join } from "node:path";
import { GenericContainer, StartedTestContainer } from "testcontainers";
import { createDb, migrateToLatest } from "@stellaris/db";
import { buildApp } from "../server.js";
import { createFixtureServer } from "@stellaris/crawler/testing/fixture-server.js";
import type { FastifyInstance } from "fastify";

let container: StartedTestContainer;
let app: FastifyInstance;
let fixture: { url: string; close(): Promise<void> };
const validCreate = {
  clientIdempotencyKey: "app-test-key-0001",
  regionCode: "110000", regionName: "北京市",
  institutionName: "某某区人民政府", institutionType: "government",
  ruleVersion: "v1",
};

beforeAll(async () => {
  container = await new GenericContainer("postgres:18")
    .withExposedPorts(5432)
    .withEnvironment({ POSTGRES_USER: "stellaris", POSTGRES_PASSWORD: "stellaris_dev", POSTGRES_DB: "stellaris" })
    .start();
  const db = createDb({ host: container.getHost(), port: container.getMappedPort(5432), user: "stellaris", password: "stellaris_dev", database: "stellaris" });
  await migrateToLatest(db);
  fixture = await createFixtureServer([{ pathPrefix: "/golden", dir: join(import.meta.dirname, "../../../packages/crawler/src/golden") }]);
  app = await buildApp({ db, fixtureUrl: fixture.url, egressMode: "offline-fixture", fixturePort: fixture.basePort });
}, 120_000);
afterAll(async () => { await app.close(); await fixture.close(); await container.stop(); });

it("创建任务返回 created 且任务状态为已完成", async () => {
  const res = await app.inject({ method: "POST", url: "/api/tasks", payload: validCreate });
  expect(res.statusCode).toBe(200);
  expect(res.json().idempotencyResult).toBe("created");
  const id = res.json().task.id;
  const detail = await app.inject({ method: "GET", url: `/api/tasks/${id}` });
  expect(detail.json().task.statusZh).toBe("已完成");
});
it("同幂等键重复创建返回 replayed 且同一任务 id", async () => {
  const a = await app.inject({ method: "POST", url: "/api/tasks", payload: validCreate });
  const b = await app.inject({ method: "POST", url: "/api/tasks", payload: validCreate });
  expect(b.json().idempotencyResult).toBe("replayed");
  expect(b.json().task.id).toBe(a.json().task.id);
});
it("结果含两槽位且 PRIMARY_1 的 positionUrl 已被 Reviewer 复核", async () => {
  const id = (await app.inject({ method: "POST", url: "/api/tasks", payload: validCreate })).json().task.id;
  const results = (await app.inject({ method: "GET", url: `/api/tasks/${id}/results` })).json();
  expect(results).toHaveLength(2);
  const p1 = results.find(r => r.slot === "PRIMARY_1");
  expect(p1.positionUrl).toMatch(/^https?:\/\//);
  expect(p1.pageTypeZh).toBeTruthy();
});
it("SSE 事件按序推送且带 seq", async () => {
  const id = (await app.inject({ method: "POST", url: "/api/tasks", payload: validCreate })).json().task.id;
  const ev = await app.inject({ method: "GET", url: `/api/tasks/${id}/events` });
  expect(ev.headers["content-type"]).toContain("text/event-stream");
  const body = ev.body as string;
  expect(body).toContain("result.upserted");
  expect(body).toContain("task.completed");
  expect(body).toMatch(/seq: \d+/);
});
```
> 注：`buildApp` 在本计划中扩展接受 `{ db, fixtureUrl, egressMode, fixturePort }` 可选依赖（Task 11 Step 3 修改 `server.ts`），`@stellaris/crawler/testing` 通过 `packages/crawler/package.json` 的 `exports` 子路径导出（Task 6 实现时补充该导出映射）。

- [ ] **Step 1: 写入失败测试**

创建 `app.test.ts`（引用未实现路由/驱动）；先安装依赖：
Run: `pnpm --filter @stellaris/backend add -D testcontainers`
Expected: 锁文件与 `apps/backend/package.json` 更新。

- [ ] **Step 2: 运行测试确认先失败**

Run: `pnpm --filter @stellaris/backend exec vitest run src/app.test.ts`
Expected: FAIL（路由未注册）。

- [ ] **Step 3: 实现最小路由与驱动**

按"Interfaces"实现 `task-routes.ts` 与 `replay-driver.ts`；修改 `server.ts` 扩展 `ServerDeps`（追加 `db`/`fixtureUrl`/`egressMode`/`fixturePort`/`evidenceRoot`/`exportRoot` 可选依赖），`buildApp` 组装 `TaskRoutesDeps` 并注册路由；`main()` 保持 `{ host, port }` 直接运行并显式传入 `db`（`createDb(dbConfigFromEnv())`）、`evidenceRoot`、`exportRoot` 与 `policy`（production），不启用 fixture。

- [ ] **Step 4: 运行测试**

Run: `pnpm --filter @stellaris/backend exec vitest run src/app.test.ts`
Expected: PASS。

- [ ] **Step 5: 相关全量验证**

Run: `pnpm --filter @stellaris/backend test && pnpm typecheck && pnpm test`
Expected: PASS。

- [ ] **Step 6: 独立验证检查点**

Run: `pnpm --filter @stellaris/backend test && pnpm build`
Expected: 退出码 0；API 全程本地 fixture + Testcontainers，无真实公网请求。

---

### Task 12: 单 Sheet Excel 导出

**Files:**
- Create: `packages/exporter/src/excel.ts`
- Create: `packages/exporter/src/excel.test.ts`

**Interfaces:**
- Consumes: Task 10 `mapResultRowToView`/`ResultRowView`
- Produces:
```ts
export interface ExportExcelInput {
  taskRunId: string;
  rows: ResultRowView[];
  exportDir: string;      // E:\StellarisData\exports\<taskRunId>
}
export interface ExportExcelOutput { filename: string; filePath: string; rowCount: number; contentHash: string; generatedAt: string }
export async function exportResultRows(input: ExportExcelInput): Promise<ExportExcelOutput>;
export const EXCEL_SHEET_NAME = "岗位信息采集结果";
export const EXCEL_COLUMNS = ["行政区划代码","省","地市","区县/县级市","乡镇/街道","机构","岗位","现任人员","当前状态","岗位信息URL","页面类型","采集结果","采集时间"] as const;
```

实现要点（规格 §21.2）：
- 严格一个 Sheet，名称 `岗位信息采集结果`；13 个固定列；
- 一个机构两名主要自然人各一行；不显示 `PRIMARY_1/PRIMARY_2`；
- `岗位信息URL` 单元格：ExcelJS 超链接 `{ text: url, hyperlink: url }`；URL 为空时单元格留空（不写任何值）；
- 只读 `ResultRowView` 投影，不做语义判断；空 URL 行只投影中文字段；
- 文件写入 `exportDir`，完成后计算 SHA-256 并返回哈希（`export_artifact` 由后端在 Task 11 写库）。

`excel.test.ts`：
```ts
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ExcelJS from "exceljs";
import { exportResultRows } from "./excel.js";
import type { ResultRowView } from "@stellaris/contracts";

describe("exporter 单 Sheet Excel", () => {
  let exportDir: string;
  const base = { taskRunId: "t1", regionCode: "110000", institutionName: "某某区人民政府", positionDisplay: "某某区人民政府 区长", currentStatusZh: "正式在任", resultZh: "已找到并复核", collectedAt: new Date().toISOString() };
  const rowP1: ResultRowView = { ...base, id: "r1", institutionSnapshotId: "i1", slot: "PRIMARY_1", personName: "张三", positionUrl: "https://x/ldr/zhang-san.html", pageTypeZh: "个人简介页" };
  const rowP2: ResultRowView = { ...base, id: "r2", institutionSnapshotId: "i1", slot: "PRIMARY_2", positionDisplay: "某某区人民政府 常务副区长", personName: "李四", positionUrl: "https://x/ldr/li-si.html", pageTypeZh: "个人简介页" };

  beforeAll(async () => { exportDir = await mkdtemp(join(tmpdir(), "stellaris-xlsx-")); });

  it("导出严格一个 Sheet，名称为岗位信息采集结果，13 列", async () => {
    const out = await exportResultRows({ taskRunId: "t1", rows: [rowP1, rowP2], exportDir });
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(out.filePath);
    expect(wb.worksheets).toHaveLength(1);
    expect(wb.worksheets[0].name).toBe("岗位信息采集结果");
    expect(wb.worksheets[0].getRow(1).cellCount).toBe(13);
  });
  it("URL 单元格为超链接，空 URL 单元格留空", async () => {
    const blankRow: ResultRowView = { ...base, id: "r3", institutionSnapshotId: "i1", slot: "PRIMARY_2", personName: null, positionUrl: undefined, resultZh: "完整搜索后无合格URL" };
    const out = await exportResultRows({ taskRunId: "t1", rows: [rowP1, blankRow], exportDir });
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(out.filePath);
    const cell = wb.worksheets[0].getRow(2).getCell(10);
    expect(cell.value).toEqual({ text: rowP1.positionUrl, hyperlink: rowP1.positionUrl });
    const blank = wb.worksheets[0].getRow(3).getCell(10);
    expect(blank.value).toBeNull();
  });
});
```

- [ ] **Step 1: 写入失败测试**

创建 `excel.test.ts`。

- [ ] **Step 2: 运行测试确认先失败**

Run: `pnpm --filter @stellaris/exporter test`
Expected: FAIL（`excel.ts` 不存在）。

- [ ] **Step 3: 实现最小导出**

按"Interfaces"实现 `excel.ts`（ExcelJS；超链接与空单元格按上述）。

- [ ] **Step 4: 运行测试**

Run: `pnpm --filter @stellaris/exporter test`
Expected: PASS。

- [ ] **Step 5: 相关全量验证**

Run: `pnpm --filter @stellaris/exporter typecheck && pnpm test`
Expected: PASS。

- [ ] **Step 6: 独立验证检查点**

Run: `pnpm --filter @stellaris/exporter test && pnpm build`
Expected: 退出码 0。

---

### Task 13: 网页工作台（任务表单 + 状态 + 结果表 + 证据抽屉 + 下载）

**Files:**
- Create: `apps/web/src/components/TaskForm.tsx`
- Create: `apps/web/src/components/TaskDetail.tsx`
- Create: `apps/web/src/components/ResultsTable.tsx`
- Create: `apps/web/src/app.tsx`
- Create: `apps/web/src/app.test.tsx`
- Create: `apps/web/src/app.css`
- Modify: `apps/web/src/main.tsx`

**Interfaces:**
- Consumes: Task 2 合同（CreateTaskRequest/ResultRowView/EvidenceDetail/ExportStatus）；后端 `/api/tasks*`；TanStack Query/Table
- Produces: 单页工作台：任务表单（行政区/机构/可选人员/规则版本）→ 提交 → 状态区（真实计数：已处理/冻结、已复核、Recovery、官网受限、开始时间）→ 两槽位结果表（中文字段）→ 每行"查看证据"抽屉 → "导出 Excel"按钮（下载 `/api/tasks/:id/export`）。

```ts
// app.tsx 定义可注入依赖（生产/测试统一）
export interface ApiClient {
  createTask(req: CreateTaskRequest): Promise<CreateTaskResponse>;
  getTask(id: string): Promise<TaskDetail>;
  getResults(id: string): Promise<ResultRowView[]>;
  getEvidence(id: string, resultRowId: string): Promise<EvidenceDetail>;
  downloadExport(id: string): Promise<{ url: string }>;
  openEvents(id: string): EventSource;   // 浏览器原生 EventSource
}
export interface AppDeps { api: ApiClient }
export function App({ deps }: { deps: AppDeps }): JSX.Element;
```
`main.tsx` 用真实 `fetch`/`EventSource` 实现 `ApiClient` 并渲染 `<App deps={realDeps} />`。

`app.test.tsx`：
```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App, type AppDeps, type ApiClient } from "./app";

const mockApi: ApiClient = {
  createTask: vi.fn(async () => ({ task: { id: "t1", status: "COMPLETED", statusZh: "已完成", mode: "TARGETED", expandLevel: "COUNTY", ruleVersion: "v1", totalInstitutions: 1, processedInstitutions: 1, reviewedSlots: 2, recoveryCount: 0, blockedCount: 0, requestedAt: new Date().toISOString() }, idempotencyResult: "created" })),
  getTask: vi.fn(async () => ({ task: { id: "t1", status: "COMPLETED", statusZh: "已完成", mode: "TARGETED", expandLevel: "COUNTY", ruleVersion: "v1", totalInstitutions: 1, processedInstitutions: 1, reviewedSlots: 2, recoveryCount: 0, blockedCount: 0, requestedAt: new Date().toISOString() }, scopes: [], institution: { id: "i1", taskRunId: "t1", regionCode: "110000", officialName: "某某区人民政府", institutionType: "government", discoverySource: "user_specified", selectTwoPrimary: true, frozenAt: new Date().toISOString(), status: "ACTIVE" } })),
  getResults: vi.fn(async () => ([
    { id: "r1", taskRunId: "t1", institutionSnapshotId: "i1", slot: "PRIMARY_1", regionCode: "110000", institutionName: "某某区人民政府", positionDisplay: "某某区人民政府 区长", personName: "张三", currentStatusZh: "正式在任", positionUrl: "https://x/ldr/zhang-san.html", pageTypeZh: "个人简介页", resultZh: "已找到并复核", collectedAt: new Date().toISOString() },
    { id: "r2", taskRunId: "t1", institutionSnapshotId: "i1", slot: "PRIMARY_2", regionCode: "110000", institutionName: "某某区人民政府", positionDisplay: "某某区人民政府 常务副区长", personName: "李四", currentStatusZh: "正式在任", positionUrl: "https://x/ldr/li-si.html", pageTypeZh: "个人简介页", resultZh: "已找到并复核", collectedAt: new Date().toISOString() },
  ])),
  getEvidence: vi.fn(async () => ({ summary: { supportingSnippets: ["张三 区长"], officialSourceUrls: ["https://x/ldr/zhang-san.html"] } })),
  downloadExport: vi.fn(async () => ({ url: "/api/tasks/t1/export" })),
  openEvents: vi.fn(),
};
const deps: AppDeps = { api: mockApi };

it("填写任务表单并提交后显示任务状态与两行结果", async () => {
  render(<App deps={deps} />);
  await userEvent.type(screen.getByLabelText("行政区划代码"), "110000");
  await userEvent.type(screen.getByLabelText("机构名称"), "某某区人民政府");
  await userEvent.click(screen.getByRole("button", { name: "开始采集" }));
  expect(await screen.findByText("已完成")).toBeInTheDocument();
  expect(await screen.findByText("张三")).toBeInTheDocument();
  expect(await screen.findByText("李四")).toBeInTheDocument();
});
it("结果表不显示 PRIMARY_1 内部槽位", () => {
  expect(screen.queryByText("PRIMARY_1")).not.toBeInTheDocument();
});
```
实现：`App` 接受 `deps`（含 `api` 客户端），测试注入 mock；生产 `main.tsx` 注入真实 `fetch` 客户端。

- [ ] **Step 1: 写入失败测试**

创建 `app.test.tsx` 与组件骨架（未实现路由/查询，先失败）。

- [ ] **Step 2: 运行测试确认先失败**

Run: `pnpm --filter @stellaris/web test`
Expected: FAIL。

- [ ] **Step 3: 实现最小工作台**

按"Interfaces"实现组件与 `App`，`main.tsx` 改为渲染 `<App deps={realDeps} />`；`app.css` 落实视觉基线（暖白底/深灰正文/低饱和青绿主色/浅灰绿分隔线/小圆角/少阴影）。

- [ ] **Step 4: 运行测试**

Run: `pnpm --filter @stellaris/web test`
Expected: PASS。

- [ ] **Step 5: 相关全量验证**

Run: `pnpm --filter @stellaris/web typecheck && pnpm --filter @stellaris/web build && pnpm test`
Expected: PASS。

- [ ] **Step 6: 独立验证检查点**

Run: `pnpm --filter @stellaris/web test && pnpm --filter @stellaris/web build`
Expected: 退出码 0。

---

### Task 14: 离线端到端金标回放 + 终验

**Files:**
- Create: `apps/backend/src/e2e/replay.e2e.test.ts`
- Modify: `packages/db/package.json`、`apps/backend/package.json`（dev `testcontainers` 已在前置任务安装）

**Interfaces:**
- Consumes: 全部前置任务产物
- Produces: 离线端到端闭环验证（真实 PostgreSQL 18 + 本地 fixture + 完整纵向链路 + Excel 断言）

`replay.e2e.test.ts`：
```ts
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { GenericContainer, StartedTestContainer } from "testcontainers";
import ExcelJS from "exceljs";
import { createDb, migrateToLatest } from "@stellaris/db";
import { createFixtureServer } from "@stellaris/crawler/testing/fixture-server.js";
import { buildApp } from "../../server.js";
import type { FastifyInstance } from "fastify";

describe("离线端到端金标回放", () => {
  let container: StartedTestContainer;
  let fixture: Awaited<ReturnType<typeof createFixtureServer>>;
  let app: FastifyInstance;
  let exportDir: string;
  const payload = {
    clientIdempotencyKey: "e2e-replay-key-0001",
    regionCode: "110000", regionName: "北京市",
    institutionName: "某某区人民政府", institutionType: "government",
    ruleVersion: "v1",
  };

  beforeAll(async () => {
    container = await new GenericContainer("postgres:18")
      .withExposedPorts(5432)
      .withEnvironment({ POSTGRES_USER: "stellaris", POSTGRES_PASSWORD: "stellaris_dev", POSTGRES_DB: "stellaris" })
      .start();
    const db = createDb({ host: container.getHost(), port: container.getMappedPort(5432), user: "stellaris", password: "stellaris_dev", database: "stellaris" });
    await migrateToLatest(db);
    fixture = await createFixtureServer([{ pathPrefix: "/golden", dir: join(import.meta.dirname, "../../../../packages/crawler/src/golden") }]);
    exportDir = await mkdtemp(join(tmpdir(), "stellaris-e2e-"));
    app = await buildApp({ db, fixtureUrl: fixture.url, egressMode: "offline-fixture", fixturePort: fixture.basePort, exportRoot: exportDir });
  }, 120_000);
  afterAll(async () => { await app.close(); await fixture.close(); await container.stop(); });

  it("从创建任务到单 Sheet Excel 的完整纵向闭环", async () => {
    const created = (await app.inject({ method: "POST", url: "/api/tasks", payload })).json();
    expect(created.idempotencyResult).toBe("created");
    const id = created.task.id;

    const detail = (await app.inject({ method: "GET", url: `/api/tasks/${id}` })).json();
    expect(detail.task.statusZh).toBe("已完成");
    expect(detail.institution.officialName).toBe("某某区人民政府");

    const results = (await app.inject({ method: "GET", url: `/api/tasks/${id}/results` })).json();
    expect(results).toHaveLength(2);
    const p1 = results.find(r => r.slot === "PRIMARY_1");
    const p2 = results.find(r => r.slot === "PRIMARY_2");
    expect(p1.positionUrl).toMatch(/^https?:\/\//);
    expect(p2.positionUrl).toMatch(/^https?:\/\//);

    // 不变量 1：非空 URL 必须引用通过的 Reviewer 决策 —— 由 DB 触发器在写入时强制，这里复核结果链
    const evidence = (await app.inject({ method: "GET", url: `/api/tasks/${id}/evidence/${p1.id}` })).json();
    expect(evidence.summary.officialSourceUrls.length).toBeGreaterThan(0);

    // 不变量 5：网页与 Excel 同源（同一投影）
    const exp = (await app.inject({ method: "GET", url: `/api/tasks/${id}/export` })).json();
    expect(exp.rowCount).toBe(2);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(join(exportDir, exp.filename));
    expect(wb.worksheets).toHaveLength(1);
    expect(wb.worksheets[0].name).toBe("岗位信息采集结果");
    expect(wb.worksheets[0].getRow(1).cellCount).toBe(13);
    const excelP1Name = wb.worksheets[0].getRow(2).getCell(8).value; // 现任人员
    expect(excelP1Name).toBe(p1.personName);
    const excelP1Url = wb.worksheets[0].getRow(2).getCell(10).value; // 岗位信息URL
    expect(excelP1Url).toEqual({ text: p1.positionUrl, hyperlink: p1.positionUrl });
  });
});
```

- [ ] **Step 1: 写入失败测试**

创建 `replay.e2e.test.ts`。

- [ ] **Step 2: 运行测试确认先失败**

Run: `pnpm --filter @stellaris/backend exec vitest run src/e2e/replay.e2e.test.ts`
Expected: FAIL（未实现或断言不符）。

- [ ] **Step 3: 实现最小端到端驱动**

复用 Task 11 的 replay-driver 与路由；若存在断言失败则按缺口修复（修改对应包实现，不新增未批准行为）。

- [ ] **Step 4: 运行测试**

Run: `pnpm --filter @stellaris/backend exec vitest run src/e2e/replay.e2e.test.ts`
Expected: PASS。

- [ ] **Step 5: 全量终验**

Run: `pnpm typecheck`
Expected: PASS
Run: `pnpm test`
Expected: PASS（8 工作区全部测试）
Run: `pnpm build`
Expected: PASS
Run: `docker compose -f infra/docker/compose.yml config`
Expected: 退出码 0
Run: `pnpm --filter @stellaris/db exec vitest run src/db.integration.test.ts`
Expected: PASS（真实 PostgreSQL 18 迁移验证）
Run: `pnpm --filter @stellaris/backend exec vitest run src/e2e/replay.e2e.test.ts`
Expected: PASS（离线端到端金标回放）

- [ ] **Step 6: 独立验证检查点**

Run: 上述六条命令逐条记录输出与退出码；任何一条失败都不得声明阶段完成；全程无真实公网请求、无 Git 初始化、无破坏性迁移。

---

## 暂缓能力清单（本阶段不实现，不删除）

以下能力保留在冻结总设计与后续扩展顺序中，本闭环明确暂缓：

- 多行政区批量选择与上传名单、自动展开下级行政区；
- 完整机构库存批量发现与完整机构模式；
- 完整暂停/继续/取消与容器重启恢复；
- 大规模并发、跨域性能目标（P95≤60s 等）与长期站点画像学习；
- 完整管理页面、登录、团队、角色、定时任务与 SaaS 能力；
- 真实官网 Live Canary（单列为需用户再次明确授权的步骤）。

## 外部前提（需用户单独授权，不属本计划自动执行）

- 初始化 Git 仓库（项目根目录当前非 Git）。
- 启动 `infra/docker/compose.yml` 定义的生产/开发常驻 PostgreSQL 服务（本计划集成测试使用 Testcontainers 临时容器，不启动常驻服务）。
- 真实官网 Canary 抓取。

## 回滚与数据保全策略

- 迁移采用追加式：`migration-002-invariants` 不修改既有迁移；失败时 `migrateDown()` 仅回滚最近未应用迁移，不动已提交业务数据。
- 证据文件先写临时路径、校验哈希后原子改名；任何证据写入失败不得继续形成事实或最终结论（规格 §8）。
- 结果行按 task+institution+slot 唯一约束防重复；Reviewer 请求键唯一约束防复用。
- `result_row` 非空 `position_url` 的删除/修改受 `trg_result_row_url_requires_review` 约束；违反不变量的事务整体回滚。

## 计划自审记录（Task-level checklist）

1. **规格覆盖**：开发期决议 R-03/R-05、详细设计 §1–§11 全部要求均映射到任务（见下表）。
2. **占位符扫描**：无 TBD/TODO/"类似前一任务"/"稍后补测试"；所有代码步骤含实际代码或 Schema 形状。
3. **类型/函数/Schema/事件名一致**：`TaskRunStatus`/`PageType`/`Slot`/`ReviewDecision`/`CurrentnessStatus`/`InstitutionType`/`FrontierPriority` 复用 `@stellaris/contracts` 既有枚举；仓储方法名（`createIfAbsent`/`upsertCurrentResult`/`runReviewer`/`exportResultRows`）跨任务一致；SSE 事件名与冻结规格 §19.2 一致。
4. **依赖顺序连续**：Task 1 测试基线 → 2 合同 → 3 数据库真实集成 → 4 仓储 → 5 证据 → 6 抓取/安全 → 7 事实 → 8 规则 → 9 Reviewer → 10 投影 → 11 API/SSE → 12 Excel → 13 Web → 14 端到端，形成连续纵向闭环。
5. **先失败测试与验证命令**：每个任务含"写失败测试→运行确认失败→最小实现→运行通过→全量验证→独立检查点"。
6. **无未经批准动作**：无真实抓取、无破坏性迁移、无 Git 初始化；真实 Canary 与常驻服务列为外部前提。

### 详细设计 → 计划任务映射

| 详细设计章节/要求 | 计划任务 |
|---|---|
| §10 测试与验证；"零测试文件第一优先级" | Task 1 |
| §6.1 边界合同（task/result/sse/evidence/export） | Task 2 |
| §6.2 db：外键/索引/事务/幂等/五不变量；§10 真实 PostgreSQL 18 集成 | Task 3 |
| §16 数据模型各层仓储 | Task 4 |
| §17 内容寻址证据库（E 盘） | Task 5 |
| §9 安全边界（SSRF/DNS/IP/重定向/出口/资源上限）＋§10 HTTP 优先/浏览器升级 | Task 6 |
| §12 页面抽取与 DOM 事实；§10 固定 HTML 回放 | Task 7 |
| §4/§13 判型、当前性、领导结构、选人、九项硬门槛、Recovery | Task 8 |
| §15 隔离 Reviewer（独立复抓、六方面、请求键不同） | Task 9 |
| §21.1/§28 result_row 投影与中文终态 | Task 10 |
| §19 任务 API/SSE；§7 数据流 | Task 11 |
| §21.2 单 Sheet Excel | Task 12 |
| §20 网页工作台（表单/状态/结果/证据抽屉/下载） | Task 13 |
| §10/§11 离线端到端金标回放；完成标准 | Task 14 |
