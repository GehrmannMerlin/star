# crawler-observe-runtime Skill 设计规格

日期：2026-08-01  
状态：书面规格待用户审阅  
适用范围：第 11 个独立 Agent Skill `crawler-observe-runtime` 的完整设计

## 1. 目标与边界

`crawler-observe-runtime` 是爬虫知识资料库平台保障方向下的 Agent 运行环境与可观测性诊断顾问。其职责是：依托固定版本资料，帮助 Agent 检查项目中的运行环境、环境变量、资源限制、健康检查，以及日志、指标和 Trace 的采集与关联，发现配置漂移、资源耗尽、健康检查失真、日志缺失、Trace 断链和故障现场信息不足，输出可追溯的运行现象、证据缺口、影响范围和建议继续加载的领域 Skill。

本 Skill **不是**项目中的常驻监控服务。它负责准确说明"发生了什么、在哪里发生"，**不以观测现象代替业务根因**。

本设计只规划 `crawler-observe-runtime`，不包含第 12 个及后续 Skill 的实施任务；不创建或实施本 Skill 本身（实施由 Claude Code 按后续写作计划执行）。

## 2. 已确认输入

- 主决策日志：`docs/superpowers/brainstorming/2026-07-31-crawler-knowledge-skills-decision-log.md`（已确认决策的最高权威；§56/§51/§25.2）。
- 统一知识设计规格：`docs/superpowers/specs/2026-07-31-crawler-knowledge-skills-knowledge-design.md`（公共知识契约）。
- 固定源码清单：`third-party/crawler-knowledge-sources/manifest.md`。
- 处理 Stellaris 问题时：`stellaris-crawler-context` 生成的项目上下文包路径。
- 已确认问题证据（`crawler-triage-incidents` 分诊结论，适用时）。
- 相关配置、运行状态、日志、指标、Trace 和资源证据（现场只读核验）。

## 3. 职责与排除项

### 3.1 职责

- 检查项目中的运行环境与可观测性相关问题：
  - 运行环境、环境变量、资源限制；
  - 健康检查（存活/就绪语义与状态判定）；
  - 日志、指标、Trace 的采集与关联。
- 发现配置漂移、资源耗尽、健康检查失真、日志缺失、Trace 断链和故障现场信息不足。
- 结合适用版本资料判断问题属于代码缺陷、配置错误、版本兼容、设计不足、外部条件还是未知项。
- 输出可追溯的运行现象、证据缺口、影响范围、建议继续加载的领域 Skill；准确说明"发生了什么、在哪里发生"，不以观测现象代替业务根因。

### 3.2 排除项

- 不建设常驻监控服务，不替代项目运行系统。
- 不以观测现象代替业务根因，不把表面症状直接报告为根因。
- 诊断确有必要时可指导安全的只读环境检查和短时诊断，但不常驻监控或替代项目运行系统。
- Docker 具体问题交给 `crawler-run-docker`；Node.js 运行时问题交给 `crawler-debug-typescript-node`；业务根因交给相应领域 Skill。
- 不修改配置、环境变量、代码或运行中的项目；不执行破坏性诊断。
- 不绕过登录、验证码、访问控制或 WAF。
- 不把外部条件或未知项伪装成已修复。
- 不生成 `writing-plans`、不提出未经批准的代码修改。
- 不修改爬虫代码、`manifest.md`、第三方仓库；不初始化 Git。
- 不把密钥、Cookie、认证请求头、代理凭据、环境变量中的秘密写入诊断记录，落盘前脱敏。

## 4. 触发条件与输入

### 4.1 触发

用户要求检查运行环境与可观测性相关设计或故障，或已经确认的问题涉及配置漂移、资源耗尽、健康检查失真、日志缺失、Trace 断链或故障现场信息不足时触发（主决策日志 §56）。通常由 `crawler-triage-incidents` 分诊路由进入，或用户直接要求检查运行可观测性。

### 4.2 最低输入

- 项目上下文（处理 Stellaris 问题时为 `stellaris-crawler-context` 项目上下文包路径）。
- 相关配置、运行状态、日志、指标、Trace 和资源证据。
- 固定版本资料（批次 4：open-telemetry/opentelemetry-specification、prometheus/OpenMetrics；批次 2 工程 Playbook 的 observability 章节作工程证据）。

## 5. 诊断流程

1. 读取项目上下文（Stellaris 问题先读 `stellaris-crawler-context` 项目上下文包）、目标、约束与已确认问题证据。
2. 确定诊断聚焦点：运行环境与环境变量 / 资源限制与消耗 / 健康检查 / 日志采集与关联 / 指标采集与关联 / Trace 采集与关联 / 故障现场信息完整性。
3. 检查相关配置、运行状态、日志、指标、Trace 和资源证据，定位具体证据位置。
4. 引用匹配版本的证据卡（`runtime-observability.md`）比对项目行为与规范/实现/工程证据。
5. 分类：代码缺陷 / 配置错误 / 版本兼容 / 设计不足 / 外部条件 / 未知项。
6. 证据不足时只提出最小补充取证（只读环境检查、短时诊断、日志/指标/Trace 采集要求）；根因未证实前不提出代码修改。
7. 输出可追溯运行现象、证据缺口、影响范围、观测盲区、问题分类与置信度、建议加载的领域 Skill。
8. 已确认根因方向获批后交给 `crawler-writing-plans-bridge`。

## 6. 问题分类规则

- **代码缺陷**：运行/观测相关代码未按规范/实现证据处理（如健康检查判定错误、日志/指标/Trace 采集代码错误）。
- **配置错误**：运行/观测配置与固定版本行为不符（如环境变量、资源限制、采集端点、采样率配置错误）。
- **版本兼容**：运行时/观测依赖版本与 API 行为不匹配。
- **设计不足**：缺乏日志/指标/Trace 采集、健康检查、运行现场证据等设计层面缺失。
- **外部条件**：运行环境不可用、资源环境受限等——只能给合规降级/等待/终止结论，不得伪装成已修复（主决策日志 §12/§56）。
- **未知项**：证据不足或冲突，保持候选假设，显式标记，不判定为确定根因。

每条结论必须明确区分：事实、证据、综合推断、待确认项。综合推断必须显式标记为"推断"，不得伪装成资料中的确定结论（主决策日志 §14）。

**观测与根因边界重点**：本 Skill 只负责确凿说明"发生了什么、在哪里发生"（运行现象、证据缺口、影响范围、观测盲区），不把观测现象直接报告为业务根因；业务根因由相应领域 Skill 判定。

## 7. 证据卡主题分组

共享证据卡 `docs/superpowers/knowledge/evidence-cards/runtime-observability.md` 从批次 4 固定资料筛选，按以下主题分组（实施时按实际固定资料筛选具体卡片）：

1. **运行环境与环境变量**：open-telemetry `specification/resource/sdk.md`（`OTEL_RESOURCE_ATTRIBUTES` 环境变量检测/合并、SDK-provided attributes、资源检测）；OpenMetrics `specification/OpenMetrics.md`（`/metrics` 端点、采集方式）。
2. **指标模型与采集**：OpenMetrics `specification/OpenMetrics.md`（指标类型、时序、文本/Protobuf 暴露、pull/push）；open-telemetry `specification/metrics/data-model.md`（Sum/Gauge/Histogram、Temporality、Exemplars、Single-Writer）。
3. **日志模型与关联**：open-telemetry `specification/logs/data-model.md`（日志记录字段、Timestamp/ObservedTimestamp、Severity、TraceId/SpanId/TraceFlags 关联字段）。
4. **Trace 模型与关联**：open-telemetry `specification/trace/sdk.md`（Span 生命周期、采样、上下文传播、ForceFlush/Shutdown）；`specification/trace/api.md`；断链判定。
5. **观测工程**：microsoft/code-with-engineering-playbook `docs/observability/`（`log-vs-metric-vs-trace.md`、`best-practices.md`、`pitfalls.md`）——作**工程证据**，只用于诊断步骤/验证方法，不升格为规范（统一知识设计规格 §5.3/§79）。

## 8. 输出契约

诊断记录采用可落盘结构化记录＋简短人类可读摘要（主决策日志 §33 节），每条结论可追溯。固定字段：

- 运行现象（确凿观测：时间、位置、可复现的状态；区分观测事实与推断）。
- 证据缺口（缺失/不足的日志、指标、Trace、配置、版本证据）。
- 影响范围（受影响的运行单元、资源、功能面）。
- 观测盲区（现有采集覆盖不到、无法还原"何时/何地/什么现象"的部分）。
- 问题分类与置信度（代码缺陷 / 配置错误 / 版本兼容 / 设计不足 / 外部条件 / 未知项；含置信度：高/中/低/不确定）。
- 建议加载的领域/技术栈 Skill 与交接对象（Docker→`crawler-run-docker`；Node.js→`crawler-debug-typescript-node`；业务根因→相应领域 Skill；根因方向获批后→`crawler-writing-plans-bridge`）。
- 依据（关联证据卡 ID、固定资料路径、日志/配置/代码位置）。

记录必须明确区分：事实、证据、推断、待确认项与用户批准状态。

## 9. 交接契约

- 遵守主决策日志第 33-36 节：可落盘结构化记录＋简短人类摘要；双层存储（小型记录项目内保存、大型证据以内容哈希和相对路径引用）；敏感信息落盘前脱敏。
- 本 Skill 输出交给 `crawler-triage-incidents` 或分诊之后的下游诊断流程，作为运行层证据输入，不取代领域诊断。
- Docker 具体问题交给 `crawler-run-docker`；Node.js 运行时问题交给 `crawler-debug-typescript-node`；业务根因交给相应领域 Skill。
- 已确认根因方向获批后，诊断结论交接给 `crawler-writing-plans-bridge` 作为规划输入，不取代其规划职责。
- 诊断结论明确区分事实、证据、推断、待确认项与用户批准状态。

## 10. 文件结构

```text
skills/crawler-observe-runtime/
  SKILL.md                              # 精简触发＋门禁＋路由＋输出＋禁止项
  references/
    diagnostic-workflow.md              # 诊断流程、问题分类规则、证据卡映射
    output-contract.md                  # 输出契约、交接契约、修订保留
docs/superpowers/knowledge/
  evidence-cards/
    runtime-observability.md            # 共享证据卡（从批次 4 固定资料筛选）
  skill-views/
    crawler-observe-runtime.md          # Skill 11 独立知识视图（引用证据卡）
tests/skills/crawler-observe-runtime/
  cases.md                              # 行为/安全案例（RED/GREEN 用）
  results.md                            # 红/绿行为评估记录
```

不引入 `validate.ps1`：诊断报告依赖动态运行证据与判断，机械结构校验价值有限，按最小充分原则（主决策日志 §107 先例）以行为案例验证为主。

## 11. 验证设计

### 11.1 结构验证

静态检查：
- Skill 包文件齐全（SKILL.md、diagnostic-workflow.md、output-contract.md）。
- 共享证据卡 `runtime-observability.md` 与知识视图 `crawler-observe-runtime.md` 存在；知识视图引用证据卡。
- 诊断流程与问题分类规则在 references 中明确定义。
- 无 `TBD`、`TODO`、`FIXME` 占位符。
- 无肯定式运行指令；仅有负面安全声明与诊断流程描述。
- 不含敏感信息示例（密钥、Cookie、认证头、代理凭据）。
- 非 Git 边界：项目根目录不是 Git worktree；不初始化 Git。

### 11.2 行为验证（RED/GREEN）

按 `superpowers:writing-skills` 方法运行固定行为案例，每个案例使用全新隔离的 Agent 上下文：

- 按诊断聚焦点聚焦：只诊断触发问题对应的聚焦点，不无边界扩展。
- 问题分类正确：代码缺陷 / 配置错误 / 版本兼容 / 设计不足 / 外部条件 / 未知项。
- 识别运行证据问题：能识别配置漂移、资源耗尽、健康检查失真、日志缺失、Trace 断链、观测盲区。
- 证据不足不判根因：证据不足时只提出最小补充取证，不把未知项误判为已定位根因。
- 不以观测现象代替根因：只输出运行现象/证据缺口/影响范围/建议加载的领域 Skill，不把表面症状直接报告为业务根因。
- 只读诊断为主：默认只指导只读环境检查和短时诊断；不修改配置/环境变量/代码/运行中的项目。
- 不越过批准边界：根因方向获批前不交给 `crawler-writing-plans-bridge`。
- 敏感信息脱敏：诊断记录不含密钥/Cookie/认证头/代理凭据/环境变量中的秘密。

### 11.3 验收标准（对应主决策日志 §56）

- 能否为故障分诊收集足够、相关且可关联的运行证据。
- 能否识别观测盲区。
- 能否避免把表面症状直接报告为根因。

达到上述标准即视为本 Skill 当前细节设计充分，不再扩展低优先级内部设计。

## 12. 阶段门

本规格经用户审阅批准后，才可调用 `superpowers:writing-plans` 生成 `crawler-observe-runtime` 的单 Skill 实施计划。用户未明确批准前，不进入 `writing-plans`，不实施本 Skill，不开始第 12 个 Skill。

`E:\Stellaris` 当前不是 Git 仓库。本设计只要求把文档可靠保存在本地项目中，不得为了满足提交步骤擅自初始化 Git。
