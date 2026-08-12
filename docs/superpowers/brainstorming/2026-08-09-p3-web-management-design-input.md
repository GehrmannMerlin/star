# P3「Web 完整管理页面」模块 设计输入（Brainstorming 结论待审）

> 创建日期：2026-08-09
> 当前状态：**brainstorming 结论，待用户审阅**
> 项目目录：`E:\Stellaris`
> 批准依据：开发期决策日志（模块一~八 + P1/P2 已完成）；`crawler-project-status-and-roadmap.md` §三 规划模块 P3
> 设计权威：冻结总设计 `2026-07-30-official-biography-crawler-design.md`（§19 Web API 与实时事件、§20 网页信息架构、§30 首版验收清单）
> 用途：作为 P3 实施计划的设计输入；本文不是实施计划，不授权修改代码

## 1. 目标

把当前「单任务创建→单任务结果」的网页工作台，升级为**范围驱动任务台（§20 选定视觉方向）的完整管理页面**，覆盖 §30 首版验收清单中全部 Web 相关验收项：

- 采集范围多选（行政区树/上传名单/展开层级，§20.1）；
- 完整机构模式与定向模式（§20.1）；
- 运行区真实计数 + 暂停/继续/取消控制（§20.2/§5.3/§5.4）；
- 结果表 + 证据详情（§20.3/§20.4）；
- 任务历史与回看（§19.1「查询任务与结果」）。

纯前端 + 少量后端补端点；不涉及真实抓取，无授权门槛（可并行）。

## 2. 现状差距（现场核验事实）

以下为 `apps/web/src/` 与 `apps/backend/src/contracts/` 现场核对结果：

| # | §20 要求 | 现状 | 差距 |
|---|---|---|---|
| 1 | §20.1 采集范围多选 | `TaskForm` 仅 regionCode/regionName/institutionName 三个文本输入 | 无行政区树选择、无多选、无上传名单、无展开层级选择 |
| 2 | §20.1 完整机构模式与定向模式 | `app.tsx` 只发 TARGETED（`mode` 不传） | 无模式选择入口（FULL_INSTITUTION 后端已支持） |
| 3 | §20.2 运行区暂停/继续/取消 | `TaskDetail` 只显示计数 + 导出按钮 | 无暂停/继续/取消按钮（后端 4 控制 API 已就绪，R-19） |
| 4 | §19.1 查询任务与结果（历史） | 无任务列表 API；网页无历史视图 | **缺 `GET /api/tasks` 列表端点**（仅按 id 查单任务） |
| 5 | §20.3/§20.4 结果表/证据 | `ResultsTable` + `EvidenceDrawer` 已实现 | 基本满足（字段与 §20.3 一致）；需复用任务台视觉 |
| 6 | §20.5 视觉系统 | `app.css` 已实现暖白/深灰/青绿/浅灰绿/小圆角/少阴影 | 满足；多选/列表需延续该视觉 |
| 7 | §20.2 细进度线 | 未实现 | 缺「细进度线只表达活动状态」元素 |
| 8 | §30「多行政区选择并展开」「上传名单」 | 后端 `region-routes.ts` 已实现（tree/children/validate/expand/provinces） | **前端未接入**——纯前端工作 |

**结论**：后端 API 几乎全部就绪（行政区树/展开/校验/上传验证、任务控制 4 API、SSE、证据、导出均已实现）；**唯一后端缺口是任务列表端点**。P3 主体是纯前端工作，可并行推进。

## 3. 设计决策（brainstorming 结论）

### 决策 D1：任务列表端点（唯一后端新增）

- 新增 `GET /api/tasks`（`task-routes.ts`）：
  - 返回最近任务摘要数组（复用 `toTaskSummary`，字段与 `TaskRunSummary` 一致）；
  - 分页：`?limit=`（默认 20，上限 100）+ `?offset=`；按 `requested_at` 降序；
  - 可选筛选：`?status=`（单个）、`?mode=`；
  - 依赖 `packages/db/src/repos/task-run.ts` 新增 `listRecent({ limit, offset, status?, mode? })`。
- 契约：`packages/contracts/src/task.ts` 新增 `TaskListResponse`（`{ tasks: TaskRunSummary[]; total: number }`）；`total` 支持总条数查询（`countByStatus`/`countAll`）。

### 决策 D2：前端结构升级（范围驱动任务台）

- `app.tsx` 重构为两视图（简单状态路由，不引入路由库——R-06 无新依赖基线）：
  - **任务台视图（默认）**：新建任务表单 + 运行区 + 结果表（现有能力扩展）；
  - **历史视图**：任务列表 + 点开回看（详情/结果/证据/导出）。
- 新建表单升级（替换 `TaskForm` 的三个文本输入）：
  - 行政区：级联选择（省→地市→区县，复用 `GET /api/regions/provinces` + `/children`）支持多选；
  - 或上传名单（`GET /api/regions/validate` 校验后冻结）；
  - 展开层级选择（COUNTY / TOWN_STREET）；
  - 模式切换（完整机构 FULL_INSTITUTION / 定向 TARGETED）；定向模式下保留 institutionName + officialEntryUrl（R-37 新增字段）；
  - `regionCodes: string[]` 透传（模块三已支持）。
- 运行区（`TaskDetail` 扩展）：现有真实计数 + 暂停/继续/取消按钮（`POST /api/tasks/:id/pause|resume|cancel`）+ 细进度线（纯活动状态动画，不暗示完成比例，§20.2 禁止虚假百分比）。
- SSE 续传（§19.2）：事件序号续传 + 刷新时查询快照（现有 `openEvents` 已按 seq 缓冲；历史视图加载时先 GET 快照再挂 SSE）。

### 决策 D3：组件拆分

- `apps/web/src/components/` 下拆分：
  - `RegionPicker.tsx`（级联多选 + 上传名单）；
  - `TaskControlButtons.tsx`（暂停/继续/取消，按 `controlable` 显隐）；
  - `TaskHistory.tsx`（列表 + 分页 + 筛选）；
  - `TaskDetail.tsx`/`ResultsTable.tsx`/`EvidenceDrawer` 保持，按任务台视觉微调。

### 决策 D4：边界

- 纯前端 + 1 后端端点；不引入路由库/状态库/UI 库（R-06 无新依赖基线）；
- 登录与角色（§19 暂缓项、§20.5 首版只绑本机）不实现；
- 不涉及真实抓取、不改数据合同/证据链/驱动；
- 视觉延续 §20.5 现有 `app.css`（暖白/深灰/青绿/浅灰绿/小圆角/少阴影/无插画/无图表/无侧边栏/无多层卡片）。

## 4. 验收映射（§30 首版验收清单）

| 验收项 | 达成方式 |
|---|---|
| 多行政区选择并展开 | D2 RegionPicker 级联多选 + 展开层级 |
| 上传行政区名单 | D2 上传名单校验（validate API） |
| 完整机构/定向模式 | D2 模式切换 |
| 暂停/继续/取消通过测试 | D3 控制按钮 + 既有后端测试 |
| 网页与 Excel 同一 result_row | 已有（结果表复用同一投影） |
| 首版页面符合任务台视觉 | 延续 §20.5 app.css |

## 5. 测试策略（草案，待实施计划细化）

- 前端组件测试（`apps/web/src/*.test.tsx`，R-06 vitest + React Testing Library）：
  - RegionPicker 级联/多选/上传名单 mock 行为；
  - TaskControlButtons 按 `controlable` 显隐 + 触发对应 API；
  - TaskHistory 列表渲染/分页/筛选；
  - app 两视图切换 + 表单 payload 断言（mode/regionCodes/officialEntryUrl）。
- 后端：`task-routes` 新增列表端点测试（分页/筛选/total）。

## 6. 打开问题（建议分诊，不在此定论）

1. **历史视图是否需要「暂停中」任务续跑提示**（SSE 断线后状态如何呈现）——建议先做快照回看，续跑逻辑复用现有 resume API；
2. **任务列表是否需要批量操作**（如批量取消）——§30 未要求，建议首版不做，留待后续；
3. **上传名单的格式**（纯代码清单 vs 含行政区树展开）——模块三已有 validate/expand 语义，建议复用。

## 7. 边界与授权

- 本设计输入待用户审阅；批准后产出实施计划（`2026-08-09-p3-web-management.md`），计划批准后才实施；
- 不涉及真实网络抓取授权、Git 初始化；
- `E:\Stellaris` 非 Git 仓库，不初始化。

## 8. 修订记录

- 2026-08-09：创建。基于冻结规格 §19/§20/§30 与现场代码核验产出。
