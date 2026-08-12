---
name: crawler-use-playwright
description: Use when an Agent must diagnose a crawler project's Playwright implementation behavior (Browser, Context, Page, Locator, waiting conditions, network events, resource interception, browser launch configuration), detect wrong API usage, version differences, unstable element location, waiting races, context leaks, and browser crashes against locked-version evidence (microsoft/playwright v1.62.1), convert crawler-automate-browsers confirmed cross-framework fix directions into current-version implementation suggestions, and emit a traceable diagnosis with fix direction for user approval before handoff to crawler-writing-plans-bridge, without undertaking production page scraping or providing bypass methods for login/CAPTCHA/access-control/WAF.
---

# crawler-use-playwright

这是一个 **Agent Playwright 专项实现诊断、修复顾问 Skill**，用于对爬虫项目的 Playwright 实现行为进行证据驱动的分类诊断，输出可追溯问题证据、根因或待验证假设、影响范围、修复方向（Playwright 实现建议）和测试建议。它**不是**生产页面抓取组件；不是修复器、规划器、记忆服务、RAG、代码索引、上下文框架或爬虫运行组件。它引用锁定版本（microsoft/playwright v1.62.1）的 API 与配置语义，将 `crawler-automate-browsers` 已确认的跨框架修复方向转换为当前版本实现建议，并识别"适用版本准确但运行行为错误"的问题。

## 触发

用户要求检查 Playwright 专项实现相关设计或故障，或已经确认的问题涉及 `Browser`、`Context`、`Page`、Locator、等待条件、网络事件、资源拦截或浏览器启动配置时触发。处理 Stellaris 问题时，先由 `stellaris-crawler-context` 注入项目事实与已批准约束，再交给本 Skill。

## 必读输入（顺序固定）

1. 主决策日志：`docs/superpowers/brainstorming/2026-07-31-crawler-knowledge-skills-decision-log.md`。
2. 统一知识设计规格：`docs/superpowers/specs/2026-07-31-crawler-knowledge-skills-knowledge-design.md`。
3. 处理 Stellaris 问题时：`stellaris-crawler-context` 生成的项目上下文包路径。
4. 已确认根因与方向（`crawler-triage-incidents` 分诊结论，适用时）、项目目标/约束/现状、相关 Playwright 代码/配置/依赖版本/Trace/截图/日志/最小复现证据。

详细诊断流程与实现转换规则见 `references/playwright-workflow.md`；输出契约与交接见 `references/output-contract.md`；知识视图见 `docs/superpowers/knowledge/skill-views/crawler-use-playwright.md`；证据卡见 `docs/superpowers/knowledge/evidence-cards/playwright.md`。

## 非协商门禁

1. 识别为 Playwright 实现诊断任务（需要基于证据的分类）。
2. 处理 Stellaris 问题时，先读取 `stellaris-crawler-context` 项目上下文包路径（主决策日志 §38）。
3. 明确诊断聚焦点（`Browser` 与启动配置 / `Context` 与隔离 / `Page` 与导航 / Locator 与元素定位 / 网络事件与资源拦截 / Trace 与调试），聚焦该点，不做无边界全栈诊断。
4. 按匹配版本证据卡分类；引用锁定版本（microsoft/playwright v1.62.1）的 API 与配置语义；绝不因证据不足编造根因；**绝不以"适用版本准确"误判为"运行行为正确"**。
5. 外部条件（运行时环境不可用/外部服务受限）只能给合规降级/等待/终止结论；绝不伪装成已修复。
6. 呈现诊断记录并等待用户批准；批准前不交给 `crawler-writing-plans-bridge`。
7. **绝不承担生产页面抓取；绝不提供绕过登录/验证码/访问控制/WAF 的方法**；绝不生成 `writing-plans` 或越过批准边界；绝不安装、构建或运行未经批准的项目或第三方代码；绝不保存密钥、Cookie、认证请求头、代理凭据。
8. 输出可追溯产物并更新本地进度总账后才继续。

## 工作流路由

- 诊断流程、问题分类规则、实现转换规则、证据卡映射：`references/playwright-workflow.md`。
- 诊断记录输出契约、交接契约、修订保留：`references/output-contract.md`。
- 知识视图与证据卡：`docs/superpowers/knowledge/skill-views/crawler-use-playwright.md`、`docs/superpowers/knowledge/evidence-cards/playwright.md`。

## 输出

- 诊断记录：问题证据＋分类＋根因或待验证假设＋影响范围＋修复方向＋测试建议；等待用户批准后交给 `crawler-writing-plans-bridge`。

## 禁止

- 不承担生产页面抓取。
- 不得提供绕过登录、验证码、访问控制或 WAF 的方法。
- 不把"适用版本准确"误判为"运行行为正确"；等待竞态、定位不稳定、上下文泄漏需运行时证据判定。
- 不引用不存在或已经变更的 API（版本差异）。
- 不越过用户批准边界、不跳过 `crawler-writing-plans-bridge`。
- 不安装、构建或运行未经批准的项目或第三方代码。
- Docker 具体问题交给 `crawler-run-docker`。
- 不攻击外部网站、不绕过访问控制、不发起对目标站点的无授权请求。
- 不把未经审查的第三方示例代码用于项目。
- 不生成 `writing-plans`、不提出未经批准的代码修改。
- 不修改爬虫代码、`manifest.md`、任何第三方仓库；不初始化 Git。
- 不把密钥、Cookie、认证请求头、代理凭据、环境变量中的秘密写入诊断记录，落盘前脱敏。
