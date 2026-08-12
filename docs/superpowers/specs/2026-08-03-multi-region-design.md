# 多行政区、下级展开与上传名单模块设计规格

> 创建日期：2026-08-03
> 当前状态：brainstorming 结论待用户审阅
> 项目目录：`E:\Stellaris`
> 批准依据：开发期决议 R-15（启动多行政区模块 brainstorming）
> 真实站点依据：R-08/R-09/R-13/R-14（安徽省人民政府官网 Canary 与校准）
> 用途：作为多行政区模块实施计划的设计输入；本文不是实施计划，不授权修改代码

## 1. 目标

把「单行政区（安徽省）完整机构模式」升级为「多行政区范围选择」：用户选择多个行政区 → 按层级展开（默认区县，可选乡镇/街道）→ 上传行政区代码名单 → 冻结任务范围（`target_scope` 多行）→ 多行政区调度（每行政区复用已校准的机构发现 + 多机构纵向链路）→ 统一多行政区结果与单 Sheet Excel。

## 2. 权威来源顺序

1. 开发期决议日志（R-03/R-08~R-15）。
2. 已批准纵向闭环设计 `2026-08-03-crawler-vertical-slice-design.md`。
3. 多机构模块设计 `2026-08-03-multi-institution-design.md` 与实施计划。
4. 冻结总设计 `2026-07-30-official-biography-crawler-design.md`。
5. 当前代码事实与 R-08~R-14 Canary/校准事实。

## 3. 范围

### 3.1 本模块实现

- **内置行政区数据**（JSON）：覆盖**安徽省全量**（省→16 地市→区县→乡镇/街道），代码按文本保留前导零（规格 §8.1）；其余省留待扩展（YAGNI）。
- **行政区树查询**：按父级/层级查询，支持展开（代码前缀匹配）。
- **多行政区选择与展开**：默认展开到区县，可选乡镇/街道（`ExpandLevel` 枚举已就绪）。
- **上传行政区代码清单**：每行一个代码（文本/CSV）。
- **范围冻结**：`target_scope` 多行写入（`task_run_id + region_code` 唯一约束已就绪）。
- **多行政区调度**：行政区间串行，每个行政区内部跑机构发现 + 多机构纵向链路（机构并发 3）。
- **统一结果与 Excel**：`result_row.region_code` 已支持行政区列，Excel 按行政区组织。

### 3.2 本模块暂缓（不删除）

- 全国全量行政区数据；
- 完整暂停/继续/取消与崩溃恢复（扩展顺序第 3 步）；
- 行政区级并行；
- Graphile Worker 持久队列；
- 大规模性能目标。

## 4. 架构

延续模块化单体 + 进程内编排。新增「行政区数据层」（内置 JSON + 查询/展开）与「多行政区编排」（行政区串行调度，复用已校准的多机构驱动）。

```mermaid
flowchart LR
    UI["多行政区选择/展开/上传"] --> API["任务 API"]
    API --> ORCH["编排器"]
    ORCH --> SCOPE["范围冻结（target_scope 多行）"]
    SCOPE --> REGION_LOOP["行政区串行"]
    REGION_LOOP --> MULTI_INST["多机构驱动（每行政区）"]
    MULTI_INST --> RESULT["统一结果 + Excel"]
```

## 5. 模块边界

### 5.1 行政区数据层（新增：`packages/contracts` 或 `packages/db`）

- 内置 JSON：`config/regions/anhui.json`（或 `packages/contracts/src/data/regions-anhui.ts`）；
- 结构：`{ code, name, level: "province"|"city"|"county"|"town", parentCode }`；
- 查询：按层级/父级列出；展开 = 按代码前缀匹配下级。

### 5.2 范围冻结

复用 `target_scope` 表（多行），`region_level` 存 province/city/county/town，`included` 默认 true。

### 5.3 多行政区编排（新增：`apps/backend/src/workers/multi-region-driver.ts`）

- 行政区间串行；每个行政区调用已实现的 `runMultiInstitutionPipeline`（含机构发现 + 多机构纵向链路）；
- 每行政区 `task.progress_changed` 更新真实计数（已处理行政区/总数）。

### 5.4 上传名单

`POST /api/tasks` 支持 `regionCodes: string[]`（代码清单）；或独立上传端点。校验代码在行政区数据中存在。

## 6. 数据流

1. 用户选择多行政区 / 上传名单 → 展开（默认区县）→ 提交；
2. API 校验 → 冻结 `target_scope` 多行；
3. 多行政区编排：行政区串行 → 每行政区跑机构发现 + 多机构链路；
4. 全部行政区到终态 → 任务完成 → 统一结果 + Excel。

## 7. 测试与验证

- 行政区数据：安徽全量数据完整性（省→地市→区县→乡镇计数）；
- 展开逻辑：前缀匹配正确（340100→区县）；
- 范围冻结：多行写入 + 唯一约束；
- 多行政区编排：真实 PostgreSQL 集成，2-3 行政区 → 每行政区多机构 → 统一结果；
- 全量：`pnpm typecheck` / `pnpm test` / `pnpm build`。

## 8. 决议记录规则

新的用户明确决议追加到开发期决策日志；设计推导、扫描发现和建议保留在本文档，不标记为用户批准决议。

## 9. 修订记录

- 2026-08-03：依据 R-15 创建第一版。brainstorming 四项关键设计已确认（内置静态数据、静态展开、行政区串行+机构并发、代码清单上传）。
