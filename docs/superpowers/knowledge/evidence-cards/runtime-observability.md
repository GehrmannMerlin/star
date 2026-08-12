# 运行环境与可观测性证据卡（共享证据层）

> 本文件是共享可追溯证据层中与运行环境与可观测性诊断相关的证据卡集合。每张卡表达一条可验证知识声明，绑定固定版本资料、原始位置与适用边界。
>
> 来源：批次 4 固定源码快照（open-telemetry/opentelemetry-specification、prometheus/OpenMetrics）与批次 2 工程 Playbook（microsoft/code-with-engineering-playbook），全部以 `third-party/crawler-knowledge-sources/manifest.md` 记录的 ref 与 Commit 为唯一版本基线。
>
> 证据等级：规范证据（官方规范/文档/Release）＞实现证据（同版本官方源码/测试）＞工程证据（官方运行指南/手册）＞案例证据（事故资料，只用于启发）。
>
> 维护规则：本文件由资料治理 Skill 按既定准入、许可证复核与版本固定流程维护；不得静默改写已固定证据卡，更新只通过新增修订进行。

## 来源身份与版本基线

| 仓库 | 权威 ref | Commit | 本地路径 |
|---|---|---|---|
| open-telemetry/opentelemetry-specification | `v1.59.0` | `a824fb4eba795c5c65dd397b3d22e7c28e934de3` | `third-party/crawler-knowledge-sources/repos/batch-04-platform-assurance/opentelemetry-specification` |
| prometheus/OpenMetrics | `v1.0.0` | `6c5579d2b81c7d9e4b5cba34a26e22827a1ac805` | `third-party/crawler-knowledge-sources/repos/batch-04-platform-assurance/OpenMetrics` |
| microsoft/code-with-engineering-playbook | `main` | `016770e43d8a75be87b98c000c049f07c4a6e6f8` | `third-party/crawler-knowledge-sources/repos/batch-02-diagnosis-planning/code-with-engineering-playbook` |

---

## 运行环境与环境变量

### OR-ENV-001 环境变量资源属性检测与合并

- **知识声明**：OpenTelemetry SDK 必须从 `OTEL_RESOURCE_ATTRIBUTES` 环境变量提取资源属性，并作为次级资源与用户提供的资源信息合并；用户提供的资源信息优先级更高。
- **证据类型/等级**：规范证据（官方规范）。
- **来源身份**：open-telemetry/opentelemetry-specification（`v1.59.0`）。
- **版本/ref/Commit**：`v1.59.0`；`a824fb4eba795c5c65dd397b3d22e7c28e934de3`。
- **原始位置**：`specification/resource/sdk.md` §"Specifying resource information via an environment variable"。
- **支持说明**：规范原文规定 `OTEL_RESOURCE_ATTRIBUTES` 为 `key1=value1,key2=value2`，键值中的 `,`/`=` 必须百分号编码；解码出错时整个环境变量值应被丢弃并上报错误。
- **适用条件**：诊断环境变量驱动的资源属性采集、配置漂移、合并优先级错误。
- **限制**：不同实现与版本对错误处理细节可能不同；本卡描述规范要求的合并与解码语义。
- **关联 Skill**：crawler-observe-runtime。
- **状态**：有效。

### OR-ENV-002 SDK 提供的默认资源属性

- **知识声明**：OpenTelemetry SDK 必须提供带有一组默认资源属性的 Resource，并在未显式指定其他资源时与 TracerProvider/MeterProvider/LoggerProvider 关联。
- **证据类型/等级**：规范证据（官方规范）。
- **来源身份**：open-telemetry/opentelemetry-specification（`v1.59.0`）。
- **版本/ref/Commit**：`v1.59.0`；`a824fb4eba795c5c65dd397b3d22e7c28e934de3`。
- **原始位置**：`specification/resource/sdk.md` §"SDK-provided resource attributes"。
- **支持说明**：规范原文规定 SDK 提供默认资源属性；用户可自定义资源检测器或通过 Merge 组合自定义属性。
- **适用条件**：诊断资源属性缺失、检测器未生效、SDK 默认资源与自定义资源合并问题。
- **限制**：默认属性集以语义约定为准；本卡描述 SDK 必须提供默认资源的规范要求。
- **关联 Skill**：crawler-observe-runtime。
- **状态**：有效。

### OR-ENV-003 指标暴露端点与采集方式

- **知识声明**：OpenMetrics 实现必须通过 HTTP GET 请求暴露 OpenMetrics 文本格式指标，端点应命名为 `/metrics`；实现也可通过推送方式定期向配置端点发送指标。
- **证据类型/等级**：规范证据（官方规范）。
- **来源身份**：prometheus/OpenMetrics（`v1.0.0`）。
- **版本/ref/Commit**：`v1.0.0`；`6c5579d2b81c7d9e4b5cba34a26e22827a1ac805`。
- **原始位置**：`specification/OpenMetrics.md` §"Overview"。
- **支持说明**：规范原文规定 `Implementers MUST expose metrics in the OpenMetrics text format in response to a simple HTTP GET request to a documented URL for a given process or device. This endpoint SHOULD be called "/metrics".` 并允许推送方式。
- **适用条件**：诊断指标端点缺失/不可达、抓取失败、pull/push 采集方式与运行环境不匹配。
- **限制**：OpenMetrics 是线格式规范，独立于具体传输；抓取可达性还取决于网络与部署。
- **关联 Skill**：crawler-observe-runtime。
- **状态**：有效。

---

## 指标模型与采集

### OR-MET-001 指标类型与时序

- **知识声明**：OpenMetrics 将系统状态表达为数值（计数、当前值、枚举、布尔）；指标是对数据的时间聚合，时间序列是随时间变化的信息记录，仅数值数据在范围内。
- **证据类型/等级**：规范证据（官方规范）。
- **来源身份**：prometheus/OpenMetrics（`v1.0.0`）。
- **版本/ref/Commit**：`v1.0.0`；`6c5579d2b81c7d9e4b5cba34a26e22827a1ac805`。
- **原始位置**：`specification/OpenMetrics.md` §"Metrics and Time Series"。
- **支持说明**：规范原文区分指标（聚合数据）与事件/日志（单事件记录），并说明时序仅支持数值数据。
- **适用条件**：诊断指标类型误用、时序断裂、指标与事件/日志混淆。
- **限制**：指标数值化是设计取舍；诊断时不得用指标代替事件级日志证据。
- **关联 Skill**：crawler-observe-runtime。
- **状态**：有效。

### OR-MET-002 指标 Temporality 语义

- **知识声明**：OTLP 指标数据点支持累计（cumulative）与增量（delta）两种聚合 Temporality；`TimeUnixNano` 记录观测时刻，`StartTimeUnixNano` 标记序列起点；累计时序在采集中断时天然平均缺口，增量时序支持采样。
- **证据类型/等级**：规范证据（官方规范）。
- **来源身份**：open-telemetry/opentelemetry-specification（`v1.59.0`）。
- **版本/ref/Commit**：`v1.59.0`；`a824fb4eba795c5c65dd397b3d22e7c28e934de3`。
- **原始位置**：`specification/metrics/data-model.md` §"Temporality"。
- **支持说明**：规范原文定义累计/增量语义、双时间戳字段及其在正确解释速率与重启感知中的作用。
- **适用条件**：诊断指标读数错误、Temporality 配置不当、重启后指标缺口误判。
- **限制**：Temporality 适用于 Sum/Histogram/ExponentialHistogram 等可加量；Gauge 不适用。
- **关联 Skill**：crawler-observe-runtime。
- **状态**：有效。

### OR-MET-003 Exemplars 与单写者约束

- **知识声明**：OTLP 指标数据模型定义 Exemplars（关联指标点与代表性追踪数据）与 Single-Writer 约束（每个指标时序在同一时间只有一个写入者）。
- **证据类型/等级**：规范证据（官方规范）。
- **来源身份**：open-telemetry/opentelemetry-specification（`v1.59.0`）。
- **版本/ref/Commit**：`v1.59.0`；`a824fb4eba795c5c65dd397b3d22e7c28e934de3`。
- **原始位置**：`specification/metrics/data-model.md` §"Exemplars"、§"Single-Writer"。
- **支持说明**：规范原文定义 Exemplars 结构（关联 TraceId/SpanId）与 Single-Writer 一致性约束。
- **适用条件**：诊断指标与 Trace 无法关联（Exemplars 缺失）、多实例同时写同一时序导致数据不一致。
- **限制**：Exemplars 为可选字段；Single-Writer 约束的强制程度依部署而定。
- **关联 Skill**：crawler-observe-runtime。
- **状态**：有效。

---

## 日志模型与关联

### OR-LOG-001 日志记录结构与字段

- **知识声明**：OpenTelemetry 日志数据模型定义 LogRecord 的核心字段：`Timestamp`、`ObservedTimestamp`、`SeverityText`、`SeverityNumber`、`Body`、`Resource`、`InstrumentationScope`、`Attributes`、`EventName`。
- **证据类型/等级**：规范证据（官方规范）。
- **来源身份**：open-telemetry/opentelemetry-specification（`v1.59.0`）。
- **版本/ref/Commit**：`v1.59.0`；`a824fb4eba795c5c65dd397b3d22e7c28e934de3`。
- **原始位置**：`specification/logs/data-model.md` §"Log and Event Record Definition"、§"Severity Fields"、§"Field: Body"。
- **支持说明**：规范原文定义各字段类型与语义，并定义 SeverityNumber 映射。
- **适用条件**：诊断日志格式/字段缺失、Severity 映射错误、日志与运行事件的时间语义混淆。
- **限制**：不同实现可能提供不同日志框架；本卡描述数据模型的规范字段。
- **关联 Skill**：crawler-observe-runtime。
- **状态**：有效。

### OR-LOG-002 日志中的 Trace 关联字段

- **知识声明**：OpenTelemetry 日志记录可携带 `TraceId`、`SpanId`、`TraceFlags` 字段实现日志与 Trace 的关联；`SpanId` 存在时 `TraceId` 也应存在。
- **证据类型/等级**：规范证据（官方规范）。
- **来源身份**：open-telemetry/opentelemetry-specification（`v1.59.0`）。
- **版本/ref/Commit**：`v1.59.0`；`a824fb4eba795c5c65dd397b3d22e7c28e934de3`。
- **原始位置**：`specification/logs/data-model.md` §"Trace Context Fields"。
- **支持说明**：规范原文定义 `TraceId`/`SpanId`/`TraceFlags` 字段为可选的 Trace 上下文字段，并规定 SpanId 存在时 TraceId SHOULD 同时存在。
- **适用条件**：诊断日志无法关联到 Trace（关联字段缺失）、SpanId 有而 TraceId 无的断链。
- **限制**：字段可选；日志采集端必须显式填充这些字段才能建立关联。
- **关联 Skill**：crawler-observe-runtime。
- **状态**：有效。

---

## Trace 模型与关联

### OR-TRACE-001 Span 生命周期与强制刷新

- **知识声明**：OpenTelemetry TracerProvider 提供 `Shutdown`（每个实例只能调用一次，之后禁止再获取 Tracer）与 `ForceFlush`（立即导出所有未导出的 Span，并调用所有已注册 SpanProcessor 的 ForceFlush）。
- **证据类型/等级**：规范证据（官方规范）。
- **来源身份**：open-telemetry/opentelemetry-specification（`v1.59.0`）。
- **版本/ref/Commit**：`v1.59.0`；`a824fb4eba795c5c65dd397b3d22e7c28e934de3`。
- **原始位置**：`specification/trace/sdk.md` §"Shutdown"、§"ForceFlush"。
- **支持说明**：规范原文规定 Shutdown 一次性语义与 ForceFlush 的立即导出与超时行为。
- **适用条件**：诊断 Trace 丢失（进程退出前未 ForceFlush）、Shutdown 被重复调用、处理器未导出。
- **限制**：Shutdown/ForceFlush 超时可配置；不同实现行为可能不同。
- **关联 Skill**：crawler-observe-runtime。
- **状态**：有效。

### OR-TRACE-002 采样与丢失 Trace 判定

- **知识声明**：OpenTelemetry 通过采样机制减少采集的 Trace 样本数量以控制噪声与开销；`IsRecording` 为 false 时 Span 丢弃全部数据。采样发生在不同阶段（创建前、处理器、Collector）。
- **证据类型/等级**：规范证据（官方规范）。
- **来源身份**：open-telemetry/opentelemetry-specification（`v1.59.0`）。
- **版本/ref/Commit**：`v1.59.0`；`a824fb4eba795c5c65dd397b3d22e7c28e934de3`。
- **原始位置**：`specification/trace/sdk.md` §"Sampling"。
- **支持说明**：规范原文定义采样目的、发生阶段与 `IsRecording` 属性。
- **适用条件**：诊断 Trace 缺失是否因采样（而非采集故障）导致；区分采样丢弃与采集断链。
- **限制**：采样配置影响可用 Trace 数量；缺失 Trace 需先排除采样因素再判断链。
- **关联 Skill**：crawler-observe-runtime。
- **状态**：有效。

### OR-TRACE-003 上下文传播与断链判定

- **知识声明**：OpenTelemetry 各信号共享 Context 传播子系统；跨进程/跨服务的 Trace 关联依赖 W3C Trace Context 传播（trace-id、span-id、trace-flags）。
- **证据类型/等级**：规范证据（官方规范）。
- **来源身份**：open-telemetry/opentelemetry-specification（`v1.59.0`）。
- **版本/ref/Commit**：`v1.59.0`；`a824fb4eba795c5c65dd397b3d22e7c28e934de3`。
- **原始位置**：`specification/overview.md` §"Context Propagation"、§"Propagators"；`specification/trace/api.md`。
- **支持说明**：规范原文将 Context Propagation 定义为共享子系统，SpanContext 承载 trace-id/span-id。
- **适用条件**：诊断 Trace 断链（子 Span 无父 TraceId）、传播配置缺失、跨服务关联失败。
- **限制**：断链可能源于传播未实现、配置错误或采样；需结合日志关联字段综合判定。
- **关联 Skill**：crawler-observe-runtime。
- **状态**：有效。

---

## 观测工程

### OR-OBS-001 日志、指标与 Trace 的角色区分

- **知识声明**：日志（log）、指标（metric）与 Trace 是三种不同观测信号，各有适用场景：日志记录单个事件，指标聚合系统状态，Trace 追踪请求路径；诊断时应按故障形态选择合适信号，避免用单一信号代替其他信号。
- **证据类型/等级**：工程证据（官方工程手册）。
- **来源身份**：microsoft/code-with-engineering-playbook（`main`）。
- **版本/ref/Commit**：`main`；`016770e43d8a75be87b98c000c049f07c4a6e6f8`。
- **原始位置**：`docs/observability/log-vs-metric-vs-trace.md`。
- **支持说明**：工程手册提供日志、指标与 Trace 的角色对比与选择建议，用于诊断步骤与验证方法。
- **适用条件**：诊断故障时选择观测信号、识别信号缺失导致的观测盲区。
- **限制**：工程证据只用于提供诊断思路与验证方法，不得单独升格为跨项目通用规范或确定根因。
- **关联 Skill**：crawler-observe-runtime。
- **状态**：有效。

### OR-OBS-002 可观测性最佳实践与陷阱

- **知识声明**：可观测性工程存在常见最佳实践与陷阱（如日志缺失敏感字段、关联字段未填充、采集覆盖不足导致故障现场信息不足）；诊断时应核对采集配置与最佳实践对照，识别观测盲区。
- **证据类型/等级**：工程证据（官方工程手册）。
- **来源身份**：microsoft/code-with-engineering-playbook（`main`）。
- **版本/ref/Commit**：`main`；`016770e43d8a75be87b98c000c049f07c4a6e6f8`。
- **原始位置**：`docs/observability/best-practices.md`、`docs/observability/pitfalls.md`。
- **支持说明**：工程手册列举可观测性最佳实践与常见陷阱，用于识别采集配置缺陷与观测盲区。
- **适用条件**：诊断日志/指标/Trace 采集缺失、关联断裂、故障现场信息不足时对照检查。
- **限制**：工程证据只用于启发诊断步骤与验证方法；不得作为确定根因的唯一依据。
- **关联 Skill**：crawler-observe-runtime。
- **状态**：有效。
