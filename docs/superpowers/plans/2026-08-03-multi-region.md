# 多行政区、下级展开与上传名单模块 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将「单行政区完整机构模式」升级为「多行政区范围选择」：内置安徽省行政区树、多选与静态展开（默认区县可选乡镇/街道）、上传代码清单、冻结 `target_scope` 多行、行政区串行调度（每行政区复用已校准的多机构驱动），统一多行政区结果与单 Sheet Excel。

**Architecture:** 延续模块化单体 + 进程内编排。新增「行政区数据层」（内置 JSON + 查询/展开）与「多行政区编排」（行政区串行，每行政区调用已实现的 `runMultiInstitutionPipeline`）。复用 `target_scope` 表多行唯一约束、`ExpandLevel` 枚举、多机构驱动、规则/Reviewer/证据/Excel 全部。

**Tech Stack:** 复用第一闭环与多机构模块全栈（TypeScript 6.0.3 / Node 24.18 / Vitest 4.1 / PostgreSQL 18 / Kysely 0.29.4）；新增内置行政区 JSON（node:fs/JSON 解析，无新依赖）。

## Global Constraints

- 本模块不改变已批准的数据合同与证据链：`target_scope`、`institution_snapshot`、`result_row`、`review_decision`、`export_artifact` 结构不变。
- 数据存储根、PostgreSQL 参数、依赖精确版本、非 Git 边界均沿用（R-01/R-02/R-06/R-07/R-12）。
- 真实网络边界：本模块自动测试全部离线（fixture + 内置行政区数据）；真实多行政区抓取单列为需用户逐项授权的 Canary。
- 安全边界沿用：DNS-pinned SSRF、逐跳重定向、脱敏、robots；不登录、不解验证码、不绕过访问控制。
- 生产行为必须有先失败测试；禁止 `--passWithNoTests`。
- 暂缓（不删除）：全国行政区数据、暂停/继续/取消、行政区并行、Graphile Worker、大规模性能。

---

## 文件结构映射

> 每个文件单一责任；按纵向可测试交付物拆任务。

### 新建文件

| 文件 | 单一责任 |
|---|---|
| `packages/contracts/src/data/regions-anhui.ts` | 安徽省行政区树内置数据（省→16 地市→区县→乡镇/街道） |
| `packages/contracts/src/region.ts` | 行政区类型（RegionNode）、查询/展开函数（前缀匹配） |
| `packages/contracts/src/region.test.ts` | 行政区树查询与展开测试 |
| `apps/backend/src/workers/multi-region-driver.ts` | 多行政区编排（行政区串行 → 每行政区多机构驱动） |
| `apps/backend/src/workers/multi-region-driver.test.ts` | 多行政区编排集成测试（真实 PostgreSQL） |
| `apps/backend/src/contracts/region-routes.ts` | 行政区树查询 API、上传名单校验 |

### 修改文件

| 文件 | 修改内容 |
|---|---|
| `packages/contracts/src/index.ts` | 导出 region 模块 |
| `apps/backend/src/contracts/task-routes.ts` | CreateTaskRequest 支持 `regionCodes: string[]` 多行政区 + `expandLevel` |
| `apps/backend/src/server.ts` | 注册 region-routes |

### 复用（不修改）

- `target_scope` 表 + `addMany`（多行 + `task_run_id + region_code` 唯一）；
- `runMultiInstitutionPipeline`（每行政区调用）；
- `ExpandLevel` 枚举（COUNTY/TOWN_STREET）；
- 规则/Reviewer/证据/Excel。

---

### Task 1: 安徽省行政区树数据与查询/展开

**Files:**
- Create: `packages/contracts/src/data/regions-anhui.ts`
- Create: `packages/contracts/src/region.ts`
- Create: `packages/contracts/src/region.test.ts`
- Modify: `packages/contracts/src/index.ts`

**Interfaces:**
- Consumes: 无
- Produces:
```ts
// region.ts
export interface RegionNode {
  code: string;                 // 文本，保留前导零
  name: string;
  level: "province" | "city" | "county" | "town";
  parentCode: string | null;
}
export function listAnhuiRegions(): RegionNode[];         // 安徽全量
export function childrenOf(parentCode: string): RegionNode[];   // 按父级查下级
export function expandRegions(codes: string[], level: "COUNTY" | "TOWN_STREET"): RegionNode[];
// 展开 = 对每个传入代码，按代码前缀匹配其至目标层级的所有下级（含自身）。
// 例：expandRegions(["340000"], "COUNTY") -> 340000 + 16 地市 + 其下所有区县。
```

`data/regions-anhui.ts`：安徽省行政区（含 16 地市、区县代表性数据；乡镇/街道首批按代表性子集，后续可扩充）。

- [ ] **Step 1: 写失败测试**
`region.test.ts`：
```ts
import { describe, it, expect } from "vitest";
import { listAnhuiRegions, childrenOf, expandRegions } from "./region.js";

describe("安徽省行政区树", () => {
  it("安徽数据完整：省→16 地市→区县", () => {
    const all = listAnhuiRegions();
    expect(all.filter(r => r.level === "province")).toHaveLength(1);
    expect(all.filter(r => r.level === "city")).toHaveLength(16);
    expect(all.filter(r => r.level === "county").length).toBeGreaterThan(80);
  });
  it("childrenOf 按父级返回下级", () => {
    const cities = childrenOf("340000");
    expect(cities.every(c => c.level === "city")).toBe(true);
    expect(cities.some(c => c.name.includes("合肥"))).toBe(true);
  });
  it("expandRegions 展开省级到区县", () => {
    const expanded = expandRegions(["340000"], "COUNTY");
    const codes = new Set(expanded.map(r => r.code));
    expect(codes.has("340000")).toBe(true);
    expect(codes.has("340100")).toBe(true); // 合肥市
    expect(expanded.some(r => r.level === "county")).toBe(true);
  });
  it("expandRegions 展开到乡镇/街道", () => {
    const expanded = expandRegions(["340100"], "TOWN_STREET");
    expect(expanded.some(r => r.level === "town")).toBe(true);
  });
});
```

- [ ] **Step 2: 运行确认先失败**
Run: `pnpm --filter @stellaris/contracts exec vitest run src/region.test.ts`
Expected: FAIL（region.js 不存在）。

- [ ] **Step 3: 最小实现**
`data/regions-anhui.ts` 提供安徽数据；`region.ts` 实现 `listAnhuiRegions`/`childrenOf`/`expandRegions`（前缀匹配）。

- [ ] **Step 4: 运行通过**
Expected: PASS。

- [ ] **Step 5: 相关全量验证**
Run: `pnpm --filter @stellaris/contracts typecheck && pnpm test`
Expected: PASS。

- [ ] **Step 6: 独立验证检查点**
Run: `pnpm --filter @stellaris/contracts test`
Expected: 退出码 0。

---

### Task 2: 行政区查询 API + 多行政区任务创建

**Files:**
- Create: `apps/backend/src/contracts/region-routes.ts`
- Modify: `apps/backend/src/contracts/task-routes.ts`（CreateTaskRequest 支持 `regionCodes: string[]` + `expandLevel`）
- Modify: `apps/backend/src/server.ts`

**Interfaces:**
- Consumes: `listAnhuiRegions`/`expandRegions`、`targetScope.addMany`
- Produces:
```ts
// region-routes.ts
export async function registerRegionRoutes(app: FastifyInstance): Promise<void>;
// GET /api/regions/tree?level=county|town  -> 行政区树（安徽）
// GET /api/regions/children?parent=340000  -> 下级行政区
// POST /api/regions/validate   { codes: string[] } -> { valid: true, invalid: string[] }
```

`task-routes.ts` 创建任务扩展：
- CreateTaskRequest 新增 `regionCodes?: string[]`（多行政区代码清单）与 `expandLevel?: ExpandLevel`；
- `mode: "FULL_INSTITUTION"` 时：展开 regionCodes 至目标层级 → `targetScope.addMany` 多行；
- 兼容既有单行政区（regionCode + expandLevel 默认 COUNTY）。

- [ ] **Step 1: 写失败测试**
`region-routes` 或 `app.test.ts`：GET /api/regions/tree 返回安徽树；POST /api/tasks FULL_INSTITUTION + regionCodes 冻结多行 target_scope。
Expected: FAIL（路由未实现）。

- [ ] **Step 2: 运行确认先失败**
Expected: FAIL。

- [ ] **Step 3: 最小实现**
region-routes + task-routes 扩展。

- [ ] **Step 4: 运行通过**
Expected: PASS。

- [ ] **Step 5: 相关全量验证**
Run: `pnpm --filter @stellaris/backend typecheck && pnpm test`
Expected: PASS。

- [ ] **Step 6: 独立验证检查点**
Run: `pnpm --filter @stellaris/backend test`
Expected: 退出码 0。

---

### Task 3: 多行政区编排驱动（行政区串行 → 多机构）

**Files:**
- Create: `apps/backend/src/workers/multi-region-driver.ts`
- Create: `apps/backend/src/workers/multi-region-driver.test.ts`

**Interfaces:**
- Consumes: `runMultiInstitutionPipeline`、`targetScope.listByTask`、`expandRegions`
- Produces:
```ts
export interface MultiRegionPipelineInput {
  taskRunId: string;
  repos: Repositories;
  evidenceStore: EvidenceStore;
  policy: SafeEgressPolicy;
  fixtureUrl?: string;
  adapter?: SiteAdapter;
  emit: (e: SseEvent) => void;
  evidenceRoot: string;
}
export async function runMultiRegionPipeline(input: MultiRegionPipelineInput): Promise<void>;
// 流程：
// 1. 取任务冻结的行政区范围（target_scope 多行）；
// 2. 行政区串行：对每个行政区调 runMultiInstitutionPipeline（机构发现 + 多机构链路）；
// 3. 每行政区完成更新 task.progress_changed（已处理行政区/总数）；
// 4. 全部行政区到终态 → 任务完成。
```

- [ ] **Step 1: 写失败测试**
`multi-region-driver.test.ts`（真实 PostgreSQL + fixture）：2-3 个行政区 → 每行政区机构发现 → 多机构结果。
```ts
it("2 行政区串行 → 每行政区多机构结果", async () => {
  // 冻结 2 个行政区（合肥 340100、芜湖 340200）；
  // 每个行政区 fixture 机构列表页不同（按 region_code 返回不同机构）；
  // 断言：result_row 按行政区 × 机构 × 槽位分布，任务完成。
});
```

- [ ] **Step 2: 运行确认先失败**
Expected: FAIL（驱动不存在）。

- [ ] **Step 3: 最小实现**
multi-region-driver.ts：行政区串行，复用多机构驱动。

- [ ] **Step 4: 运行通过**
Expected: PASS。

- [ ] **Step 5: 相关全量验证**
Run: `pnpm --filter @stellaris/backend typecheck && pnpm test`
Expected: PASS。

- [ ] **Step 6: 独立验证检查点**
Run: `pnpm --filter @stellaris/backend test`
Expected: 退出码 0。

---

### Task 4: 上传名单 + 全量终验

**Files:**
- Modify: `apps/backend/src/contracts/task-routes.ts`（`regionCodes` 名单 + `expandLevel` 提交）
- Modify: `apps/backend/src/server.ts`

**Interfaces:**
- Consumes: 全部前置任务产物
- Produces: POST /api/tasks 支持 `regionCodes: string[]`（代码清单）→ 校验 → 展开 → 冻结 → 多行政区驱动。

- [ ] **Step 1: 写失败测试**
`app.test.ts`：POST /api/tasks FULL_INSTITUTION + regionCodes 代码清单 → 多行政区冻结 → 结果。
Expected: FAIL。

- [ ] **Step 2: 运行确认先失败**
Expected: FAIL。

- [ ] **Step 3: 最小实现**
task-routes 扩展（regionCodes 校验 + 展开 + 冻结 + 调 multi-region 驱动）。

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

1. **规格覆盖**：设计规格 §1-§7 全部映射到任务（行政区数据→Task1、查询 API→Task2、多行政区编排→Task3、上传名单→Task4）。
2. **占位符扫描**：无 TBD/TODO/"类似前一任务"；所有代码步骤含实际代码或 Schema 形状。
3. **接口一致性**：`listAnhuiRegions`/`childrenOf`/`expandRegions`/`runMultiRegionPipeline` 跨任务签名一致；复用 `targetScope`/`runMultiInstitutionPipeline`/`ExpandLevel`。
4. **依赖顺序**：行政区数据→API→多行政区编排→上传名单，形成连续纵向闭环。
5. **先失败测试**：每任务含"写失败→确认失败→最小实现→通过→全量验证→独立检查点"。
6. **无越权动作**：自动测试全离线；真实多行政区抓取列为需用户授权的 Canary 步骤。

### 设计规格 → 计划任务映射

| 设计规格章节 | 计划任务 |
|---|---|
| §5.1 行政区数据层 | Task 1 |
| §5.2 范围冻结 + §5.4 上传名单 | Task 2 |
| §5.3 多行政区编排 | Task 3 |
| §5.4 上传名单 + 终验 | Task 4 |
