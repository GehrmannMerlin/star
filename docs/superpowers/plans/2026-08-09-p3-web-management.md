# P3「Web 完整管理页面」模块 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把当前「单任务创建→单任务结果」网页工作台，升级为**范围驱动任务台（§20 选定视觉方向）的完整管理页面**。覆盖 §30 首版验收清单中全部 Web 相关验收项：采集范围多选（行政区树/上传名单/展开层级）、完整机构与定向模式切换、运行区真实计数 + 暂停/继续/取消、结果表 + 证据详情、任务历史与回看。纯前端 + 1 后端端点（任务列表），不涉及真实抓取。

**Architecture:** 延续模块化单体 + 进程内编排。后端新增 `GET /api/tasks` 列表端点（分页/筛选/total，`task-run` Repository 新增 `listRecent`/`count`）；前端 `app.tsx` 重构为两视图（任务台 + 历史），新建表单升级为范围驱动（行政区级联多选/上传名单/展开层级/模式切换），运行区加控制按钮与细进度线，新增任务列表历史视图。

**Tech Stack:** 复用全栈（TypeScript 6.0.3 / Node 24.18 / Vitest 4.1 / React 19.2.8 / TanStack Query 5.101.4 / TanStack Table 8.21.3 / PostgreSQL 18 / Kysely 0.29.4）；无新依赖（不引入路由库/状态库/UI 库，R-06 基线）。

## Global Constraints

- 本模块不改变已批准数据合同与证据链；`result_row`/`institution_snapshot`/`target_scope` 表结构不变。
- 前端只用真实计数（§20.2）：细进度线只表达活动状态，**不暗示完成比例**；不展示内部英文枚举/槽位/诊断字段（§20.4/§21.1）。
- 网页与 Excel 来自同一 `result_row`（投影不变）。
- SSE 断线按 seq 续传 + 刷新查询快照（§19.2）。
- 登录与角色（§19 暂缓项、§20.5 首版只绑本机）不实现。
- 生产行为必须有先失败测试；禁止 `--passWithNoTests`。
- 无新依赖（R-06）；不引入路由库（简单状态路由）。
- 视觉延续 §20.5 现有 `app.css`（暖白/深灰/青绿/浅灰绿/小圆角/少阴影/无插画/无图表/无侧边栏/无多层卡片）。

---

## 文件结构映射

### 新建文件

| 文件 | 单一责任 |
|---|---|
| `packages/contracts/src/task.ts`（改）| `TaskListResponse`/`TaskListParams` 契约（或独立 `task-list.ts`） |
| `packages/db/src/repos/task-run.ts`（改）| `listRecent`/`count` 方法 |
| `apps/backend/src/contracts/task-routes.ts`（改）| `GET /api/tasks` 列表端点 |
| `apps/backend/src/app.test.ts`（改）| 列表端点测试（分页/筛选/total） |
| `apps/web/src/components/RegionPicker.tsx` | 行政区级联多选 + 上传名单 |
| `apps/web/src/components/RegionPicker.test.tsx` | RegionPicker 测试 |
| `apps/web/src/components/TaskControlButtons.tsx` | 暂停/继续/取消按钮（按 `controlable` 显隐） |
| `apps/web/src/components/TaskControlButtons.test.tsx` | 控制按钮测试 |
| `apps/web/src/components/TaskHistory.tsx` | 任务列表 + 分页 + 筛选 |
| `apps/web/src/components/TaskHistory.test.tsx` | 历史视图测试 |
| `apps/web/src/app.tsx`（改）| 两视图重构 + 表单升级 |
| `apps/web/src/app.test.tsx`（改）| 视图切换 + payload 断言 |
| `apps/web/src/app.css`（改）| 新增组件样式（延续 §20.5） |

### 复用（不修改）

- `toTaskSummary`（task-routes.ts）、`TaskRunSummary`/`ResultRowView`（contracts）；
- 行政区 `tree/children/validate/expand/provinces`（region-routes.ts）；
- 任务控制 4 API（pause/resume/cancel/duplicate，R-19）；
- SSE `openEvents` + seq 续传（main.tsx/app.tsx）；
- 证据抽屉 `EvidenceDrawer`、结果表 `ResultsTable`（微调视觉）。

---

### Task 1: 任务列表端点（后端唯一新增）

**Files:**
- Modify: `packages/contracts/src/task.ts`
- Modify: `packages/db/src/repos/task-run.ts`
- Modify: `apps/backend/src/contracts/task-routes.ts`
- Modify: `apps/backend/src/app.test.ts`

**Interfaces:**
```ts
// task.ts
export const TaskListParams = Type.Object({
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })),
  offset: Type.Optional(Type.Integer({ minimum: 0 })),
  status: Type.Optional(Type.Enum(TaskRunStatus)),
  mode: Type.Optional(Type.Enum(TaskMode)),
});
export const TaskListResponse = Type.Object({
  tasks: Type.Array(TaskRunSummary),
  total: Type.Number(),
});
// task-run.ts
async listRecent(opts: { limit: number; offset: number; status?: TaskRunStatus; mode?: TaskMode }): Promise<TaskRunRow[]>;
async count(opts?: { status?: TaskRunStatus; mode?: TaskMode }): Promise<number>;
// task-routes.ts
app.get<{ Querystring: TaskListParams }>("/api/tasks", async (req) => {
  // 默认 limit=20；status/mode 可选筛选；按 requested_at 降序
  // 返回 { tasks: rows.map(toTaskSummary), total: await count(...) }
});
```

- [ ] **Step 1: 写失败测试**
task-routes 列表端点测试：默认返回最近 20、`limit`/`offset` 分页、`status` 筛选、`mode` 筛选、`total` 正确。
Expected: FAIL（端点不存在）。

- [ ] **Step 2: 运行确认先失败**
- [ ] **Step 3: 最小实现**
  - `task.ts` 加 `TaskListParams`/`TaskListResponse`；
  - `task-run.ts` 加 `listRecent`（`requested_at` 降序 + limit/offset + 可选 status/mode 过滤）与 `count`；
  - `task-routes.ts` 加 `GET /api/tasks`（解析 query、返回 `toTaskSummary` 数组 + total）。
- [ ] **Step 4: 运行通过**
- [ ] **Step 5: 相关全量验证**
Run: `pnpm --filter @stellaris/contracts test && pnpm --filter @stellaris/db test && pnpm --filter @stellaris/backend test`
- [ ] **Step 6: 独立验证检查点**

---

### Task 2: RegionPicker 组件（行政区级联多选 + 上传名单 + 展开层级）

**Files:**
- Create: `apps/web/src/components/RegionPicker.tsx`
- Create: `apps/web/src/components/RegionPicker.test.tsx`
- Modify: `apps/web/src/app.css`

**Interfaces:**
```ts
export interface RegionSelection {
  codes: string[];          // 冻结代码（已展开）
  names: string[];          // 展示名（与 codes 对齐）
  level: "COUNTY" | "TOWN_STREET";
}
export function RegionPicker({
  api,
  value,
  onChange,
}: {
  api: ApiClient;
  value: RegionSelection;
  onChange: (sel: RegionSelection) => void;
}): React.ReactElement;
// 行为：
// - 级联多选：GET /api/regions/provinces → children（选中省份后）→ 多选区县；选中父级自动展开
// - 上传名单：文本输入代码/名称 → POST /api/regions/validate → 无效代码标红 → POST /api/regions/expand 展开至目标层级
// - 展开层级单选：COUNTY / TOWN_STREET
// ApiClient 需扩展 regions 相关方法（见 Task 4）
```

- [ ] **Step 1: 写失败测试**
RegionPicker.test.tsx：mock ApiClient，断言级联加载省/市/区县、多选、上传名单校验、展开层级切换。
Expected: FAIL（组件不存在）。

- [ ] **Step 2: 运行确认先失败**
- [ ] **Step 3: 最小实现**
- [ ] **Step 4: 运行通过**
- [ ] **Step 5: 相关全量验证**
Run: `pnpm --filter @stellaris/web test`
- [ ] **Step 6: 独立验证检查点**

---

### Task 3: TaskControlButtons + TaskHistory 组件

**Files:**
- Create: `apps/web/src/components/TaskControlButtons.tsx`
- Create: `apps/web/src/components/TaskControlButtons.test.tsx`
- Create: `apps/web/src/components/TaskHistory.tsx`
- Create: `apps/web/src/components/TaskHistory.test.tsx`
- Modify: `apps/web/src/app.css`

**Interfaces:**
```ts
// TaskControlButtons.tsx
export function TaskControlButtons({
  task,
  api,
  onChanged,
}: {
  task: TaskRunSummary;
  api: ApiClient;
  onChanged: (updated: TaskRunSummary) => void;
}): React.ReactElement;
// 按 task.controlable 显隐；pause/resume/cancel 调对应 API，成功后 onChanged(新 task)
// cancel 为危险操作：二次确认（window.confirm）

// TaskHistory.tsx
export function TaskHistory({
  api,
  onOpen,
}: {
  api: ApiClient;
  onOpen: (taskId: string) => void;
}): React.ReactElement;
// 行为：
// - 加载 GET /api/tasks?limit=20&offset=... → 列表（状态/模式/时间/已处理/已复核）
// - 分页（上一页/下一页，按 total 计算）
// - 状态筛选（下拉：全部/PENDING/CRAWLING/COMPLETED/...）
// - 点行 onOpen(taskId) → 打开任务详情视图
```

- [ ] **Step 1: 写失败测试**
TaskControlButtons.test.tsx：`controlable=false` 不显示按钮；pause/resume/cancel 调 API 并回调。
TaskHistory.test.tsx：mock ApiClient，列表渲染、分页、状态筛选。
Expected: FAIL（组件不存在）。

- [ ] **Step 2: 运行确认先失败**
- [ ] **Step 3: 最小实现**
- [ ] **Step 4: 运行通过**
- [ ] **Step 5: 相关全量验证**
Run: `pnpm --filter @stellaris/web test`
- [ ] **Step 6: 独立验证检查点**

---

### Task 4: 前端两视图重构 + 表单升级 + ApiClient 扩展

**Files:**
- Modify: `apps/web/src/app.tsx`
- Modify: `apps/web/src/main.tsx`（ApiClient 扩展 regions/tasks 列表方法）
- Modify: `apps/web/src/app.test.tsx`
- Modify: `apps/web/src/app.css`

**Interfaces:**
- `ApiClient` 扩展：
  - `listProvinces()`, `listChildren(parent)`, `validateRegions(codes)`, `expandRegions(codes, level)`, `listTasks(params)`；
  - `controlTask(id, action: "pause"|"resume"|"cancel")`。
- `App` 重构为两视图（state: `{ view: "workspace" | "history"; taskId?: string }`）：
  - **任务台视图（默认）**：`RegionPicker`（多选/上传/展开层级）+ 模式切换（FULL_INSTITUTION / TARGETED）+ 定向模式保留 institutionName/officialEntryUrl + 开始采集 → 运行区（`TaskDetail` + `TaskControlButtons` + 细进度线）+ `ResultsTable` + 证据抽屉 + 导出；
  - **历史视图**：`TaskHistory` 列表 → 点开回看（复用任务台详情渲染，读快照 + SSE 续传）。
- 表单 payload：
  - FULL_INSTITUTION：`{ mode, regionCodes: RegionPicker.codes, expandLevel, ruleVersion }`；
  - TARGETED：`{ mode: "TARGETED", regionCode, regionName, institutionName, institutionType, officialEntryUrl?, ruleVersion }`。
- 细进度线：CSS 动画（活动状态脉冲/位移），**不显示百分比**（§20.2 禁止虚假百分比）。

- [ ] **Step 1: 写失败测试**
app.test.tsx：两视图切换、FULL_INSTITUTION payload 断言（regionCodes/expandLevel/mode）、TARGETED payload 断言（含 R-37 officialEntryUrl 透传）、控制按钮回调。
Expected: FAIL（重构未完成）。

- [ ] **Step 2: 运行确认先失败**
- [ ] **Step 3: 最小实现**
- [ ] **Step 4: 运行通过**
- [ ] **Step 5: 相关全量验证**
Run: `pnpm --filter @stellaris/web test && pnpm --filter @stellaris/backend test`
- [ ] **Step 6: 独立验证检查点**

---

### Task 5: 全量终验

- [ ] **Step 1: 全量验证**
Run: `pnpm typecheck && pnpm test && pnpm build`
Expected: 全部 PASS。
- [ ] **Step 2: 独立验证检查点**
  - 手动冒烟（本地 `pnpm dev`）：任务台新建 FULL_INSTITUTION 任务（行政区多选）→ 运行区计数 → 暂停/继续/取消 → 结果表 → 证据 → 导出；历史视图回看。
- [ ] **Step 3: 合同一致性自查**
  - `TaskListResponse` 从 contracts 导出；`listRecent`/`count` 注册进 Repositories；
  - 前端只用真实计数与中文态；无内部英文枚举泄漏；
  - 无 `--passWithNoTests`；无新依赖。

---

## 自审记录

1. **规格覆盖**：设计输入 D1-D4 全部映射（任务列表端点→T1、RegionPicker→T2、控制+历史→T3、两视图重构→T4、终验→T5）；冻结 §5.3/§19.1/§19.2/§20.1-20.5/§30 覆盖。
2. **占位符扫描**：无 TBD/TODO；关键接口含实际签名。
3. **接口一致性**：`TaskListResponse`/`listRecent`/`count` 跨任务签名一致；复用 `toTaskSummary`/`TaskRunSummary`/`ResultRowView`/控制 API/行政区 API。
4. **依赖顺序**：列表端点→RegionPicker→控制+历史→两视图重构→终验。
5. **先失败测试**：每任务含"写失败→确认失败→最小实现→通过→全量验证→独立检查点"。
6. **无越权动作**：纯前端 + 1 端点；无真实抓取、无新依赖、无路由库；登录与角色不实现。
7. **风险**：前端表单升级涉及 payload 结构变化——用测试锁定；行政区多选 UX 复杂度——RegionPicker 独立组件降耦；浏览器手动冒烟需本地运行（无真实网络）。

### 设计输入 → 计划任务映射

| 设计输入章节 | 计划任务 |
|---|---|
| D1 任务列表端点 | Task 1 |
| D2 前端两视图 + 范围驱动任务台 | Task 2 + Task 4 |
| D3 组件拆分 | Task 2 + Task 3 |
| D4 边界 + 终验 | Task 5 |
