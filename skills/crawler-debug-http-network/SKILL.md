---
name: crawler-debug-http-network
description: Use when an Agent must diagnose a crawler project's HTTP and network behavior (DNS, TLS, proxy, redirect, request headers, status codes, connection, timeout, request-level retry, politeness/rate-limiting, response completeness), classify the issue against pinned-version evidence, and emit a traceable diagnosis with fix direction for user approval before handoff to crawler-writing-plans-bridge, without becoming a production HTTP client or proxy.
---

# crawler-debug-http-network

这是一个 **Agent HTTP 与网络诊断、修复顾问 Skill**，用于对爬虫项目的 HTTP 与网络行为进行证据驱动的分类诊断，输出可追溯问题证据、根因或待验证假设、影响范围、修复方向和网络层测试建议。它**不是**项目中的生产 HTTP 客户端、代理或网络 Worker；不是修复器、规划器、记忆服务、RAG、代码索引、上下文框架或爬虫运行组件。它不承担项目的生产请求、重试或代理功能。

## 触发

用户要求检查 HTTP 与网络相关设计或故障，或已经确认的问题涉及 DNS、TLS、代理、重定向、请求头、状态码、连接、超时、请求级重试、礼貌限流或响应完整性时触发。处理 Stellaris 问题时，先由 `stellaris-crawler-context` 注入项目事实与已批准约束，再交给本 Skill。

## 必读输入（顺序固定）

1. 主决策日志：`docs/superpowers/brainstorming/2026-07-31-crawler-knowledge-skills-decision-log.md`。
2. 统一知识设计规格：`docs/superpowers/specs/2026-07-31-crawler-knowledge-skills-knowledge-design.md`。
3. 处理 Stellaris 问题时：`stellaris-crawler-context` 生成的项目上下文包路径。
4. 诊断聚焦点与已确认问题证据（分诊结论，适用时）、项目目标/约束/现状、网络代码/配置/依赖版本/日志/请求记录/响应或错误/复现证据。

详细诊断流程与分类规则见 `references/diagnostic-workflow.md`；输出契约与交接见 `references/output-contract.md`；知识视图见 `docs/superpowers/knowledge/skill-views/crawler-debug-http-network.md`；证据卡见 `docs/superpowers/knowledge/evidence-cards/http-network.md`。

## 非协商门禁

1. 识别为 HTTP/网络诊断任务（需要基于证据的分类）。
2. 处理 Stellaris 问题时，先读取 `stellaris-crawler-context` 项目上下文包路径（主决策日志 §38）。
3. 明确诊断聚焦点（DNS / TLS / 代理 / 重定向 / 请求头·状态码 / 连接·超时 / 请求级重试 / 礼貌限流·响应完整性），聚焦该点，不做无边界全栈诊断。
4. 按匹配版本证据卡分类；绝不因证据不足编造根因。
5. 外部限制（站点拒绝/验证码/限流/WAF）只能给合规降级/等待/终止结论；绝不伪装成已修复。
6. 呈现诊断记录并等待用户批准；批准前不交给 `crawler-writing-plans-bridge`。
7. 绝不安装、构建、运行、扫描、代理、测试、执行示例或爬取外部目标；绝不承担项目的生产请求/重试/代理功能；绝不保存密钥、Cookie、认证请求头、代理凭据。
8. 输出可追溯产物并更新本地进度总账后才继续。

## 工作流路由

- 诊断流程、问题分类规则、证据卡映射：`references/diagnostic-workflow.md`。
- 诊断记录输出契约、交接契约、修订保留：`references/output-contract.md`。
- 知识视图与证据卡：`docs/superpowers/knowledge/skill-views/crawler-debug-http-network.md`、`docs/superpowers/knowledge/evidence-cards/http-network.md`。

## 输出

- 诊断记录：问题证据＋分类＋根因或待验证假设＋影响范围＋修复方向＋网络层测试建议；等待用户批准后交给 `crawler-writing-plans-bridge`。

## 禁止

- 不承担项目的生产请求、重试或代理功能。
- 不执行无效轰击或过度诊断请求；诊断探测限小规模、安全、合规。
- 具体 Node.js、Crawlee 等框架 API 与版本用法交给对应重点技术栈 Skill；动态页面渲染、跨任务调度和业务字段正确性分别交给对应领域 Skill。
- 不绕过登录、验证码、访问控制或 WAF。
- 不把外部限制或未知项伪装成已修复。
- 不生成 `writing-plans`、不提出未经批准的代码修改。
- 不修改爬虫代码、`manifest.md`、任何第三方仓库；不初始化 Git。
- 不把密钥、Cookie、认证请求头、代理凭据写入诊断记录，落盘前脱敏。
