# 多机构与完整机构库存模块设计规格

> 创建日期：2026-08-03
> 当前状态：brainstorming 结论待用户审阅
> 项目目录：`E:\Stellaris`
> 批准依据：开发期决议 R-10（启动多机构模块 brainstorming）
> 真实站点依据：R-08 Canary（安徽省人民政府官网）、R-09 Playwright 渲染验证
> 用途：作为多机构模块实施计划的设计输入；本文不是实施计划，不授权修改代码

## 1. 目标

把第一闭环的「指定单机构」升级为「完整机构模式」：在**单个行政区（安徽省）**下，自动发现多个机构（省政府组成部门等），批量冻结机构清单，每个机构独立走完「抓取 → 证据 → 抽取 → 规则 → 选人 → Reviewer → result_row」纵向链路，最终统一呈现多机构结果与单 Sheet Excel。

## 2. 权威来源顺序

1. 开发期决议日志（R-03/R-08/R-09/R-10）。
2. 已批准纵向闭环设计 `2026-08-03-crawler-vertical-slice-design.md`。
3. 冻结总设计 `2026-07-30-official-biography-crawler-design.md`。
4. 当前代码事实与 R-08/R-09 Canary 事实。

## 3. 范围

### 3.1 本模块实现

- 单行政区（安徽省）下的多机构发现；
- 完整机构模式任务创建（用户选行政区 → 自动发现机构清单 → 冻结）；
- 机构清单冻结与终态保留（规格 §8.2：抓取失败不删机构）；
- 每机构独立纵向链路（复用第一闭环：抓取 → 证据 → 抽取 → 规则 → Reviewer → result_row）；
- **浏览器升级 Worker**（进程内浏览器池，上限 2-4）：HTTP 事实不足时升级 Playwright 渲染；
- **声明式适配器**（首个为安徽省区域模式）：机构列表页 + 领导列表 + 领导详情 selector；
- 统一多机构结果表与单 Sheet Excel（一个机构两名主要自然人各一行）。

### 3.2 本模块暂缓（不删除）

- 多行政区批量选择与上传名单；
- 自动展开下级行政区；
- 全国机构库存；
- 完整暂停/继续/取消；
- 大规模并发与性能目标（P95≤60s 等）；
- Graphile Worker 持久队列；
- 独立 worker-browser 进程。

## 4. 架构

延续模块化单体 + 进程内编排（replay-driver 模式）。多机构模块在**任务编排层**增加「机构发现」与「多机构调度」，在**抓取层**增加「浏览器升级」与「声明式适配器」。

```mermaid
flowchart LR
    UI["任务表单（选行政区）"] --> API["任务 API"]
    API --> ORCH["编排器"]
    ORCH --> DISCOVER["机构发现（四层抽取）"]
    DISCOVER --> FREEZE["机构清单冻结"]
    FREEZE --> SCHED["多机构调度（小并发）"]
    SCHED --> HTTP["HTTP 抓取"]
    HTTP --> UPGRADE["升级判定"]
    UPGRADE --> BROWSER["进程内浏览器池（2-4）"]
    HTTP --> EVID["证据 + 事实抽取"]
    BROWSER --> EVID
    EVID --> RULES["规则 → Reviewer → result_row"]
    RULES --> RESULT["多机构结果"]
    RESULT --> UI
    RESULT --> XLSX["单 Sheet Excel"]
```

## 5. 模块边界

### 5.1 机构发现（新增：`packages/crawler/src/discovery`）

四层抽取（规格 §12.1）：
1. 通用 DOM 规则：从入口页抽取「政府机构/机构设置」栏目链接，识别机构列表页；
2. 声明式适配器：安徽适配器用 `/site/tpl/2121`（政府机构页）等已核验入口；
3. 区域成功模式复用：同省同市机构列表 URL 模式复用；
4. 通用规则回退。

发现结果统一为机构候选：正式名称、机构类型、官方入口、发现来源。

### 5.2 机构清单冻结

复用 `institution_snapshot` 表（`task_run_id` 已支持多行），`discovery_source` 区分 `user_specified` 与 `auto_discovered`。抓取失败不删除，保留终态。

### 5.3 浏览器升级（新增：`packages/crawler/src/browser`）

- 复用 `shouldUpgradeToPlaywright`（HTTP 正文缺失/动态列表等）；
- 进程内 Playwright 池，浏览器上限 2（初始），可升至 4；
- 图片/字体/视频默认阻断（规格 §23.3）；
- 渲染后走既有 `extractPageFacts` 与 `classifyPage`；
- 浏览器页面就绪用明确 DOM 信号，不用固定长等待/networkidle（规格 §10.2）。

### 5.4 声明式适配器（新增：`config/site-adapters`）

首个适配器为安徽省政府门户：
```json
{
  "siteId": "anhui-provincial-government",
  "hosts": ["www.ah.gov.cn"],
  "institutionList": { "url": "https://www.ah.gov.cn/site/tpl/2121", "selector": "..." },
  "leadershipList": { "url": "https://www.ah.gov.cn/szf/index.html", "memberSelector": "a[href*='liId=']" },
  "memberDetail": { "render": "playwright", "bioSelector": ".personal-intro" },
  "roles": { "primaryKeywords": ["省长"], "secondaryKeywords": ["常务副省长", "副省长"] }
}
```

### 5.5 多机构调度

进程内小并发：同时处理机构数上限 3（保守），每个机构串行走完纵向链路；机构间互不阻塞（一个机构失败不影响其他）。

### 5.6 结果组织

复用 `result_row`：每机构两槽位（PRIMARY_1/PRIMARY_2）各一行，`task_run_id` + `institution_snapshot_id` + `slot` 唯一（既有约束）。Excel 导出遍历全部机构，一个机构两行。

## 6. 数据流

1. 用户创建「完整机构模式」任务：选行政区（安徽省）+ 规则版本；
2. 编排器先执行机构发现，冻结机构清单（N 个机构写入 `institution_snapshot`）；
3. 多机构调度按小并发逐个处理：
   - HTTP 抓取机构入口 → 证据 → 抽取；
   - 若事实不足 → 浏览器升级渲染 → 抽取；
   - 规则层：领导结构 → 两槽位 → 硬门槛 → Reviewer；
   - 写 `result_row`；
4. 全部机构到终态 → 任务完成 → SSE 推送 → Excel 导出。

## 7. 失败与恢复

- 机构发现失败：该机构记录为 BLOCKED 终态，不阻塞其他机构；
- 单机构内部失败：该机构终态（FAILED + 中文原因），其余机构继续；
- 浏览器升级失败：回退 HTTP 结果（若已有），否则机构终态；
- 空 URL 与 Reviewer 冲突：沿用第一闭环语义（空 URL 中文原因、Reviewer MATCH 才非空）。

## 8. 测试与验证

- 机构发现：安徽政府机构页解析出机构清单（离线金标 fixture + 可选真实 Canary）；
- 浏览器升级：动态页面渲染抽取（Playwright 测试）；
- 适配器：安徽适配器加载与 selector 命中（金标 HTML）；
- 多机构编排：真实 PostgreSQL 集成，N 机构全链路 → 每机构两行 result_row；
- 全量：`pnpm typecheck` / `pnpm test` / `pnpm build`。

## 9. 决议记录规则

新的用户明确决议追加到开发期决策日志；设计推导、扫描发现和建议保留在本文档，不标记为用户批准决议。

## 10. 修订记录

- 2026-08-03：依据 R-10 创建第一版。brainstorming 三项关键设计已确认（混合四层抽取、进程内浏览器池、暂缓队列）。
