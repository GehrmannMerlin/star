# P5「Graphile Worker 持久队列」模块 设计输入（Brainstorming 结论待审）

> 创建日期：2026-08-09
> 当前状态：**brainstorming 结论，待用户审阅**
> 项目目录：`E:\Stellaris`
> 批准依据：`crawler-project-status-and-roadmap.md` §三 规划模块 P5
> 设计权威：冻结总设计 §18.2（Graphile Worker 使用方式）、§18.3（幂等）、§18.1（生命周期）
> 用途：作为 P5 实施计划的设计输入；本文不是实施计划，不授权修改代码

## 1. 目标

从**进程内编排**升级为**持久队列**（§18.2），获得可靠投递、多 worker、指数退避、锁恢复：

- Graphile Worker 可靠投递/并发领取/指数退避/锁恢复；
- 永久业务状态保留在项目表中（不依赖完成作业常驻队列）；
- 驱动改造为 worker 处理函数（至少一次执行语义）；
- 作业幂等键符合 §18.3（任务+机构+阶段+canonical_key+用途+规则版本）。

## 2. 现状差距（现场核验事实）

| # | 现状 | 差距 |
|---|---|---|
| 1 | 3 个驱动（replay/multi-institution/multi-region）由 task-routes **`void runXxxPipeline()` 进程内拉起** | 无持久队列——进程崩溃/重启后运行中任务靠 recovery 扫描重拉（已有，但非队列语义） |
| 2 | Graphile Worker **0.17.3 已在 backend 依赖**（R-06 锁定） | 未接入——无 worker 实例、无任务投递 |
| 3 | `makeRequestKey` 幂等键 = 任务+机构+用途+canonical_key | §18.3 缺「阶段」「规则版本」维度（部分符合） |
| 4 | 崩溃恢复 `recoverInterruptedTasks`（recovery.ts）扫描 task_run 重拉驱动 | 升级为队列后需兼容/替换 |
| 5 | task-control（暂停/取消）通过 AbortSignal 协作式中止驱动 | 队列 worker 需支持暂停/取消语义（§5.3/§5.4） |

**结论**：P5 是架构级升级，核心是把「驱动直接调用」改为「驱动注册为 worker 处理函数 + 队列投递」。风险较高（涉及驱动生命周期、暂停/取消、恢复），需谨慎设计作业粒度。

## 3. 设计决策（brainstorming 结论）

### 决策 D1：作业粒度——按「任务」而非「机构」投递（首版）

- **建议首版按任务投递**：每个 task_run 一个作业，处理函数 = 现有驱动（replay/multi-institution/multi-region）包装；
- 理由：驱动内部已有串行/并发编排（机构循环、浏览器池），按任务投递改动最小、复用现有逻辑；按机构拆分会大幅重构驱动；
- 代价：大任务（多机构）单 worker 长时间占用——依赖多 worker 并发不同任务弥补；
- §18.3 幂等键：任务级 = `任务ID + 模式 + 规则版本`。

### 决策 D2：Worker 职责与生命周期

- 新增 worker 入口（`apps/backend/src/workers/queue.ts`）：
  - `runWorker()`：Graphile Worker `run()`，监听 `stellaris_task` 任务；
  - 处理函数按 task_run.mode 路由到对应驱动；
  - 优雅关闭：worker 停止领取新作业（§18.2）；
  - 异常退出：Graphile Worker 自动释放锁（§18.2 锁恢复）；
- `server.ts` 启动：task-routes 不再 `void runXxxPipeline`，改为**投递队列作业**；启动 recovery 扫描仍保留（兜底未领取作业）。

### 决策 D3：暂停/取消语义适配

- 队列 worker 处理函数内：接收 AbortSignal（task-control 注册表，R-19），协作式中止驱动；
- 暂停：中止信号 + 任务置 PAUSED；恢复：重新投递作业（幂等键去重）；
- 取消：中止信号 + 任务置 CANCELLED 终态；Graphile Worker 作业标记完成（避免重试）。

### 决策 D4：幂等键补全

- `makeRequestKey` 增「阶段」「规则版本」维度（§18.3）——适配现有调用点；
- 队列作业幂等：`jobKey = taskId + mode + ruleVersion`（Graphile Worker `run_at`/唯一键语义）。

### 决策 D5：边界

- **保留进程内驱动不变**（replay/multi-institution/multi-region 作为 worker 处理函数体），不改其内部逻辑；
- 队列表用 Graphile Worker 自动创建的 `graphile_worker.jobs`（内部表，不污染项目 schema）；
- 无新依赖（Graphile Worker 已在）；不改数据合同/证据链；
- 真实行为变化点：驱动由「直接调用」变「队列投递 + worker 领取」——需全量回归 + 本地冒烟验证。

## 4. 验收

- 任务创建 → 投递队列 → worker 领取 → 驱动执行 → 结果落库（与现状一致）；
- 队列 worker 多实例可并发处理不同任务；
- 崩溃/重启后未完成作业重新可用（锁恢复）；
- 暂停/取消在队列语义下仍正确；
- 全量回归 typecheck/test/build 全绿。

## 5. 打开问题

1. **作业粒度**：按任务（D1 建议）vs 按机构——按机构更细但重构驱动，建议首版按任务；
2. **多 worker 进程**：生产是否起多个 worker 进程（多核）——建议首版单进程 worker + 可配置并发；
3. **与 recovery 的关系**：现有 `recoverInterruptedTasks` 是否保留——建议保留兜底（队列未领取作业的重拉）。

## 6. 边界与授权

- 本设计输入待用户审阅；批准后产出实施计划；
- P5 为架构级升级，改动 backend 启动链路——实施计划需明确回归与冒烟；
- `E:\Stellaris` 非 Git 仓库，不初始化。

## 7. 修订记录

- 2026-08-09：创建。基于 §18.2/18.3 与现场核验产出。
