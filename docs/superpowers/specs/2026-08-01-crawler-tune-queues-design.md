# crawler-tune-queues Skill 设计规格

日期：2026-08-01  
状态：书面规格待用户审阅  
适用范围：第 9 个独立 Agent Skill `crawler-tune-queues` 的完整设计

## 1. 目标与边界

`crawler-tune-queues` 是爬虫知识资料库爬虫流水线方向下的 Agent 队列、并发与性能诊断、优化顾问。其职责是：依托固定版本资料，帮助 Agent 检查项目中的任务队列、并发、背压、任务级重试、优先级、公平性、缓存、暂停恢复和资源控制，发现任务丢失或重复、重试风暴、队列饥饿、吞吐下降、延迟异常以及 CPU、内存失控等问题，输出可追溯的问题证据、根因或待验证假设、影响范围、修复方向、性能基线和回归建议；根因和方向获批后交给 `crawler-writing-plans-bridge`。

本 Skill **不是**项目中的生产队列或调度器。它不接管项目的生产任务队列。

本设计只规划 `crawler-tune-queues`，不包含第 10 个及后续 Skill 的实施任务；不创建或实施本 Skill 本身（实施由 Claude Code 按后续写作计划执行）。

## 2. 已确认输入

- 主决策日志：`docs/superpowers/brainstorming/2026-07-31-crawler-knowledge-skills-decision-log.md`（已确认决策的最高权威；§54/§51/§127）。
- 统一知识设计规格：`docs/superpowers/specs/2026-07-31-crawler-knowledge-skills-knowledge-design.md`（公共知识契约）。
- 固定源码清单：`third-party/crawler-knowledge-sources/manifest.md`。
- 处理 Stellaris 问题时：`stellaris-crawler-context` 生成的项目上下文包路径。
- 已确认问题证据（`crawler-triage-incidents` 分诊结论，适用时）。
- 队列与调度代码、配置、依赖版本、日志、指标、Trace、资源数据、压测结果（现场只读核验）。

## 3. 职责与排除项

### 3.1 职责

- 检查项目中的队列、并发与性能相关问题：
  - 任务队列、并发、背压；
  - 任务级重试、优先级、公平性；
  - 缓存、暂停恢复、资源控制。
- 发现任务丢失或重复、重试风暴、队列饥饿、吞吐下降、延迟异常以及 CPU、内存失控等问题。
- 结合适用版本资料判断问题属于代码缺陷、配置错误、版本兼容、设计不足、外部条件还是未知项。
- 输出可追溯的问题证据、根因或待验证假设、影响范围、修复方向、性能基线和回归建议。

### 3.2 排除项

- 不接管项目的生产任务队列。
- 请求级重试归 `crawler-debug-http-network`；跨任务重排、恢复与整体吞吐归本 Skill。
- 具体 Crawlee、Node.js 或其他框架 API 与版本问题交给对应重点技术栈 Skill。
- 不执行无效压测或过度故障注入；诊断复现限受控、合规。
- 不绕过登录、验证码、访问控制或 WAF。
- 不把外部条件或未知项伪装成已修复。
- 不生成 `writing-plans`、不提出未经批准的代码修改。
- 不修改爬虫代码、`manifest.md`、第三方仓库；不初始化 Git。
- 不把密钥、Cookie、认证请求头写入诊断记录，落盘前脱敏。

## 4. 触发条件与输入

### 4.1 触发

用户要求检查队列、并发或性能相关设计或故障，或已经确认的问题涉及任务丢失/重复、重试风暴、队列饥饿、吞吐下降、延迟异常或 CPU/内存失控时触发（主决策日志 §54）。

### 4.2 最低输入

- 项目上下文（处理 Stellaris 问题时为 `stellaris-crawler-context` 项目上下文包路径）。
- 队列与调度代码、配置、依赖版本、日志、指标、Trace、资源数据、压测结果。
- 固定版本资料（批次 3：celery、reactive-streams、locust、scrapy engine/scheduler）。

## 5. 诊断流程

1. 读取项目上下文（Stellaris 问题先读 `stellaris-crawler-context` 项目上下文包）、目标、约束与已确认问题证据。
2. 确定诊断聚焦点：任务队列 / 并发 / 背压 / 任务级重试 / 优先级·公平性 / 缓存 / 暂停恢复 / 资源控制。
3. 检查相关代码、配置、依赖版本、日志、指标、Trace、资源数据、压测结果，定位具体证据位置。
4. 引用匹配版本的证据卡（`queue-performance.md`）比对项目行为与规范/实现/工程证据。
5. 分类：代码缺陷 / 配置错误 / 版本兼容 / 设计不足 / 外部条件 / 未知项。
6. 证据不足时只提出最小补充取证或受控基准测试/故障注入；根因未证实前不提出代码修改。
7. 输出可追溯问题证据、根因或待验证假设、影响范围、修复方向、性能基线和回归建议。
8. 根因和方向获批后交给 `crawler-writing-plans-bridge`。

## 6. 问题分类规则

- **代码缺陷**：队列/并发代码未按规范/实现证据处理（如任务重复入队、并发控制错误、背压未生效）。
- **配置错误**：队列/性能配置与固定版本行为不符（如并发数、队列容量、超时设置错误）。
- **版本兼容**：依赖版本与 API 行为不匹配（如 celery/reactive-streams 版本差异）。
- **设计不足**：缺乏背压、优先级、公平调度、资源控制等设计层面缺失。
- **外部条件**：目标站点拒绝、限流、资源环境受限等——只能给合规降级/等待/终止结论，不得伪装成已修复（主决策日志 §12/§54）。
- **未知项**：证据不足或冲突，保持候选假设，显式标记，不判定为确定根因。

每条结论必须明确区分：事实、证据、综合推断、待确认项。综合推断必须显式标记为"推断"，不得伪装成资料中的确定结论（主决策日志 §14）。

**跨任务问题重点**：本 Skill 特别识别任务丢失/重复、重试风暴、队列饥饿、背压失效等跨任务问题，并强调优化方向须给出可比较基线与回归门槛。

## 7. 证据卡主题分组

共享证据卡 `docs/superpowers/knowledge/evidence-cards/queue-performance.md` 从批次 3 固定资料筛选，按以下主题分组（实施时按实际固定资料筛选具体卡片）：

1. **任务队列与调度**：celery `celery/app`、`celery/worker`；scrapy `core/scheduler.py`、`core/engine.py`。
2. **并发与背压**：reactive-streams `api`、`tck`（背压规范）；celery `celery/worker`；scrapy `core/engine.py`。
3. **优先级与公平性**：celery `celery/canvas`；scrapy `core/scheduler.py`（Request.priority）。
4. **缓存与暂停恢复**：celery `celery/backends`、`celery/app`（控制/暂停）。
5. **性能基线与故障注入**：locust 源码（压测）；celery 故障场景。

## 8. 输出契约

诊断记录采用可落盘结构化记录＋简短人类可读摘要（主决策日志 §33 节），每条结论可追溯。固定字段：

- 问题证据（定位到的代码/配置/日志/指标/Trace/资源数据/压测结果位置）。
- 分类（代码缺陷 / 配置错误 / 版本兼容 / 设计不足 / 外部条件 / 未知项；含置信度：高/中/低/不确定）。
- 根因或待验证假设（区分事实、证据、推断、待确认项）。
- 影响范围（受影响的任务、队列、吞吐、延迟、资源）。
- 修复方向（可验证且不越权的修复建议，指向匹配版本资料；含性能基线与回归门槛）。
- 性能基线与回归建议（可比较基线方法——压测/指标对比——与回归门槛）。
- 交接对象（根因和方向获批后 → `crawler-writing-plans-bridge`）。

记录必须明确区分：事实、证据、推断、待确认项与用户批准状态。

## 9. 交接契约

- 遵守主决策日志第 33-36 节：可落盘结构化记录＋简短人类摘要；双层存储（小型记录项目内保存、大型证据以内容哈希和相对路径引用）；敏感信息落盘前脱敏。
- 根因和方向获批后，诊断结论交接给 `crawler-writing-plans-bridge` 作为规划输入，不取代其规划职责。
- 诊断结论明确区分事实、证据、推断、待确认项与用户批准状态。

## 10. 文件结构

```text
skills/crawler-tune-queues/
  SKILL.md                              # 精简触发＋门禁＋路由＋输出＋禁止项
  references/
    diagnostic-workflow.md              # 诊断流程、问题分类规则、证据卡映射
    output-contract.md                  # 输出契约、交接契约、修订保留
docs/superpowers/knowledge/
  evidence-cards/
    queue-performance.md                # 共享证据卡（从批次 3 固定资料筛选）
  skill-views/
    crawler-tune-queues.md              # Skill 9 独立知识视图（引用证据卡）
tests/skills/crawler-tune-queues/
  cases.md                              # 行为/安全案例（RED/GREEN 用）
  results.md                            # 红/绿行为评估记录
```

不引入 `validate.ps1`：诊断报告依赖动态项目证据与判断，机械结构校验价值有限，按最小充分原则（主决策日志 §107 先例）以行为案例验证为主。

## 11. 验证设计

### 11.1 结构验证

静态检查：
- Skill 包文件齐全（SKILL.md、diagnostic-workflow.md、output-contract.md）。
- 共享证据卡 `queue-performance.md` 与知识视图 `crawler-tune-queues.md` 存在；知识视图引用证据卡。
- 诊断流程与问题分类规则在 references 中明确定义。
- 无 `TBD`、`TODO`、`FIXME` 占位符。
- 无肯定式运行指令；仅有负面安全声明与诊断流程描述。
- 不含敏感信息示例（密钥、Cookie、认证头）。
- 非 Git 边界：项目根目录不是 Git worktree；不初始化 Git。

### 11.2 行为验证（RED/GREEN）

按 `superpowers:writing-skills` 方法运行固定行为案例，每个案例使用全新隔离的 Agent 上下文：

- 按诊断聚焦点聚焦：只诊断触发问题对应的聚焦点，不无边界扩展。
- 问题分类正确：代码缺陷 / 配置错误 / 版本兼容 / 设计不足 / 外部条件 / 未知项。
- 识别跨任务问题：能识别任务丢失/重复、重试风暴、饥饿、背压失效。
- 证据不足不判根因：证据不足时只提出最小补充取证，不把未知项误判为已定位根因。
- 不接管生产队列：拒绝接管项目的生产任务队列。
- 不越过批准边界：根因和方向获批前不交给 `crawler-writing-plans-bridge`。
- 敏感信息脱敏：诊断记录不含密钥/Cookie/认证头。

### 11.3 验收标准（对应主决策日志 §54）

- 能识别任务丢失、重复执行、重试风暴、饥饿、背压失效和资源异常。
- 引用匹配版本的依据。
- 提出具有可比较基线和回归门槛的优化方向。

达到上述标准即视为本 Skill 当前细节设计充分，不再扩展低优先级内部设计。

## 12. 阶段门

本规格经用户审阅批准后，才可调用 `superpowers:writing-plans` 生成 `crawler-tune-queues` 的单 Skill 实施计划。用户未明确批准前，不进入 `writing-plans`，不实施本 Skill，不开始第 10 个 Skill。

`E:\Stellaris` 当前不是 Git 仓库。本设计只要求把文档可靠保存在本地项目中，不得为了满足提交步骤擅自初始化 Git。
