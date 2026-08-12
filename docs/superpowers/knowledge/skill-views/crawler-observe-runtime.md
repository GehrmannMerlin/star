# crawler-observe-runtime 知识视图

> 本视图是 `crawler-observe-runtime` Skill 的独立知识视图，只保留与"运行环境与可观测性诊断顾问"职责相关的知识。来源身份、版本与许可证事实由共享证据层统一维护，本视图通过稳定证据卡 ID 引用，不复制原始来源元数据。

## 定位、触发与排除项

- **定位**：面向 Agent 的运行环境与可观测性诊断顾问；依托固定版本资料帮助 Agent 检查项目的运行环境、环境变量、资源限制、健康检查，以及日志、指标和 Trace 的采集与关联，发现配置漂移、资源耗尽、健康检查失真、日志缺失、Trace 断链和故障现场信息不足。
- **不是**：项目中的常驻监控服务；不替代项目运行系统；不建设监控/日志/指标后端。
- **触发**：用户要求检查运行环境与可观测性相关设计或故障；已确认问题涉及配置漂移、资源耗尽、健康检查失真、日志缺失、Trace 断链或故障现场信息不足。
- **排除**：Docker 具体问题交给 `crawler-run-docker`；Node.js 运行时问题交给 `crawler-debug-typescript-node`；业务根因交给相应领域 Skill；不以观测现象代替业务根因；不把表面症状直接报告为根因；不修改配置/环境变量/代码/运行中的项目；不执行破坏性诊断；不生成 `writing-plans`。

## 最低证据输入

- 项目上下文（处理 Stellaris 问题时为 `stellaris-crawler-context` 项目上下文包路径）。
- 相关配置、运行状态、日志、指标、Trace 和资源证据。
- 固定版本资料（批次 4：open-telemetry/opentelemetry-specification、prometheus/OpenMetrics；批次 2 工程 Playbook 的 observability 章节作工程证据）。

## 知识主题与证据卡映射

### 运行环境与环境变量

- 判断环境变量驱动的资源属性检测/合并、SDK 默认资源、指标暴露端点是否符合固定版本行为；配置漂移、环境变量缺失/错误是常见问题。
- 证据卡：[[OR-ENV-001]]（环境变量资源属性检测与合并）、[[OR-ENV-002]]（SDK 提供的默认资源属性）、[[OR-ENV-003]]（指标暴露端点与采集方式）。
- 依据固定版本：open-telemetry `specification/resource/sdk.md`；prometheus/OpenMetrics `specification/OpenMetrics.md`。

### 指标模型与采集

- 判断指标类型/时序、Temporality、Exemplars 与单写者约束是否符合固定版本行为；指标读数错误、Temporality 配置不当、指标与 Trace 无法关联是常见问题。
- 证据卡：[[OR-MET-001]]（指标类型与时序）、[[OR-MET-002]]（指标 Temporality 语义）、[[OR-MET-003]]（Exemplars 与单写者约束）。
- 依据固定版本：prometheus/OpenMetrics `specification/OpenMetrics.md`；open-telemetry `specification/metrics/data-model.md`。

### 日志模型与关联

- 判断日志记录结构与字段、日志中的 Trace 关联是否符合固定版本行为；日志字段缺失、Severity 映射错误、日志无法关联到 Trace 是常见问题。
- 证据卡：[[OR-LOG-001]]（日志记录结构与字段）、[[OR-LOG-002]]（日志中的 Trace 关联字段）。
- 依据固定版本：open-telemetry `specification/logs/data-model.md`。

### Trace 模型与关联

- 判断 Span 生命周期与强制刷新、采样与丢失判定、上下文传播是否符合固定版本行为；Trace 丢失、采样误判、跨服务断链是常见问题。
- 证据卡：[[OR-TRACE-001]]（Span 生命周期与强制刷新）、[[OR-TRACE-002]]（采样与丢失 Trace 判定）、[[OR-TRACE-003]]（上下文传播与断链判定）。
- 依据固定版本：open-telemetry `specification/trace/sdk.md`、`specification/trace/api.md`、`specification/overview.md`。

### 观测工程

- 判断日志/指标/Trace 信号选择与可观测性最佳实践是否符合工程证据；信号缺失、采集覆盖不足导致故障现场信息不足是常见问题。
- 证据卡：[[OR-OBS-001]]（日志、指标与 Trace 的角色区分）、[[OR-OBS-002]]（可观测性最佳实践与陷阱）。
- 依据固定版本：microsoft/code-with-engineering-playbook `docs/observability/`（工程证据，不升格为规范）。

## 观测与根因边界重点

- 本 Skill 只确凿说明"发生了什么、在哪里发生"：运行现象、证据缺口、影响范围、观测盲区。
- 不以观测现象代替业务根因，不把表面症状直接报告为根因；业务根因由相应领域 Skill 判定。
- 默认只指导只读环境检查和短时诊断；任何修改配置/环境变量/代码/运行中项目的动作须获得明确批准。
- 不得用默认值或猜测掩盖观测缺口；不得把外部条件或未知项伪装成已修复。

## 版本化判断规则

- 每条判断依据必须追溯到固定版本资料（ref＋Commit）、证据卡、上下文包条目或决策日志节号；只给仓库首页或没有版本的引用不满足要求。
- 明确区分事实、证据、综合推断与未知项；综合推断必须显式标记"推断"，不得伪装成资料中的确定结论。
- 不得因新技术更新默认要求升级；是否升级以证据和项目约束为准。
- 案例证据与工程证据不得单独升格为跨项目通用规范或确定根因。

## 输出、交接与禁止越权

- **输出**：可追溯运行现象、证据缺口、影响范围、观测盲区、问题分类与置信度、建议加载的领域/技术栈 Skill。
- **交接**：输出交给 `crawler-triage-incidents` 或分诊之后的下游诊断流程作为运行层证据输入；Docker→`crawler-run-docker`；Node.js→`crawler-debug-typescript-node`；业务根因→相应领域 Skill；已确认根因方向获批后→`crawler-writing-plans-bridge`。
- **禁止越权**：不诊断业务根因、不提出未经批准的修复、不生成 `writing-plans`、不建设常驻监控服务、不修改配置/代码/运行中的项目、不初始化 Git、不记录敏感信息原件。

## 视图自检

- 全部证据卡 ID（OR-ENV-*、OR-MET-*、OR-LOG-*、OR-TRACE-*、OR-OBS-*）在 `runtime-observability.md` 中存在且被本视图引用。
- 无未标注的推断；每条判断可追溯到证据卡或固定资料。
- 未复制相邻 Skill（`crawler-run-docker`、`crawler-debug-typescript-node`、领域 Skill）的职责。
