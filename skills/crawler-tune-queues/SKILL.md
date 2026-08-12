---
name: crawler-tune-queues
description: Use when an Agent must diagnose a crawler project's queue, concurrency, and performance behavior (task queue, concurrency, backpressure, task-level retry, priority, fairness, cache, pause/resume, resource control), detect cross-task issues (task loss/duplication, retry storms, starvation, backpressure failure, resource anomalies), classify them against pinned-version evidence, and emit a traceable diagnosis with fix direction and performance baseline for user approval before handoff to crawler-writing-plans-bridge, without becoming a production queue or scheduler.
---

# crawler-tune-queues

这是一个 **Agent 队列、并发与性能诊断、优化顾问 Skill**，用于对爬虫项目的队列、并发与性能行为进行证据驱动的分类诊断，输出可追溯问题证据、根因或待验证假设、影响范围、修复方向、性能基线和回归建议。它**不是**项目中的生产队列或调度器；不是修复器、规划器、记忆服务、RAG、代码索引、上下文框架或爬虫运行组件。它不接管项目的生产任务队列。

## 触发

用户要求检查队列、并发或性能相关设计或故障，或已经确认的问题涉及任务丢失/重复、重试风暴、队列饥饿、吞吐下降、延迟异常或 CPU/内存失控时触发。处理 Stellaris 问题时，先由 `stellaris-crawler-context` 注入项目事实与已批准约束，再交给本 Skill。

## 必读输入（顺序固定）

1. 主决策日志：`docs/superpowers/brainstorming/2026-07-31-crawler-knowledge-skills-decision-log.md`。
2. 统一知识设计规格：`docs/superpowers/specs/2026-07-31-crawler-knowledge-skills-knowledge-design.md`。
3. 处理 Stellaris 问题时：`stellaris-crawler-context` 生成的项目上下文包路径。
4. 诊断聚焦点与已确认问题证据（分诊结论，适用时）、项目目标/约束/现状、队列与调度代码/配置/依赖版本/日志/指标/Trace/资源数据/压测结果。

详细诊断流程与分类规则见 `references/diagnostic-workflow.md`；输出契约与交接见 `references/output-contract.md`；知识视图见 `docs/superpowers/knowledge/skill-views/crawler-tune-queues.md`；证据卡见 `docs/superpowers/knowledge/evidence-cards/queue-performance.md`。

## 非协商门禁

1. 识别为队列/并发/性能诊断任务（需要基于证据的分类）。
2. 处理 Stellaris 问题时，先读取 `stellaris-crawler-context` 项目上下文包路径（主决策日志 §38）。
3. 明确诊断聚焦点（任务队列 / 并发 / 背压 / 任务级重试 / 优先级·公平性 / 缓存 / 暂停恢复 / 资源控制），聚焦该点，不做无边界全栈诊断。
4. 按匹配版本证据卡分类；绝不因证据不足编造根因；绝不用默认值或猜测掩盖跨任务问题。
5. 外部条件（站点拒绝/资源环境受限）只能给合规降级/等待/终止结论；绝不伪装成已修复。
6. 呈现诊断记录并等待用户批准；批准前不交给 `crawler-writing-plans-bridge`。
7. 绝不安装、构建、运行、扫描、代理、测试、执行示例或爬取外部目标；绝不接管项目的生产任务队列；绝不保存密钥、Cookie、认证请求头。
8. 输出可追溯产物并更新本地进度总账后才继续。

## 工作流路由

- 诊断流程、问题分类规则、证据卡映射：`references/diagnostic-workflow.md`。
- 诊断记录输出契约、交接契约、修订保留：`references/output-contract.md`。
- 知识视图与证据卡：`docs/superpowers/knowledge/skill-views/crawler-tune-queues.md`、`docs/superpowers/knowledge/evidence-cards/queue-performance.md`。

## 输出

- 诊断记录：问题证据＋分类＋根因或待验证假设＋影响范围＋修复方向＋性能基线和回归建议；等待用户批准后交给 `crawler-writing-plans-bridge`。

## 禁止

- 不接管项目的生产任务队列。
- 不执行无效压测或过度故障注入；诊断复现限受控、合规。
- 请求级重试交给 `crawler-debug-http-network`；具体 Crawlee/Node.js 等框架 API/版本问题交给对应重点技术栈 Skill。
- 不绕过登录、验证码、访问控制或 WAF。
- 不把外部条件或未知项伪装成已修复。
- 不生成 `writing-plans`、不提出未经批准的代码修改。
- 不修改爬虫代码、`manifest.md`、任何第三方仓库；不初始化 Git。
- 不把密钥、Cookie、认证请求头写入诊断记录，落盘前脱敏。
