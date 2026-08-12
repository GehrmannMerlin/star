---
name: crawler-automate-browsers
description: Use when an Agent must diagnose a crawler project's cross-framework browser automation (browser upgrade conditions, dynamic rendering, waiting conditions, context isolation, resource interception, public network-request observation, CPU/memory/page lifecycle), classify the issue against pinned-version W3C WebDriver evidence, and emit a traceable diagnosis with fix direction for user approval before handoff to crawler-writing-plans-bridge, without becoming a production browser worker.
---

# crawler-automate-browsers

这是一个 **Agent 跨框架浏览器自动化诊断、修复顾问 Skill**，用于对爬虫项目的浏览器自动化行为进行证据驱动的分类诊断，输出可追溯问题证据、根因或待验证假设、影响范围、修复方向和浏览器层测试建议。它**不是**项目中的生产浏览器 Worker；不是修复器、规划器、记忆服务、RAG、代码索引、上下文框架或爬虫运行组件。它不承担项目的生产页面抓取和渲染。

## 触发

用户要求检查浏览器自动化相关设计或故障，或已经确认的问题涉及浏览器升级条件、动态渲染、等待条件、上下文隔离、资源拦截、公开网络请求观察或 CPU/内存/页面生命周期时触发。处理 Stellaris 问题时，先由 `stellaris-crawler-context` 注入项目事实与已批准约束，再交给本 Skill。

## 必读输入（顺序固定）

1. 主决策日志：`docs/superpowers/brainstorming/2026-07-31-crawler-knowledge-skills-decision-log.md`。
2. 统一知识设计规格：`docs/superpowers/specs/2026-07-31-crawler-knowledge-skills-knowledge-design.md`。
3. 处理 Stellaris 问题时：`stellaris-crawler-context` 生成的项目上下文包路径。
4. 诊断聚焦点与已确认问题证据（分诊结论，适用时）、项目目标/约束/现状、浏览器代码/配置/依赖版本/日志/Trace/DOM/截图/网络记录/复现证据。

详细诊断流程与分类规则见 `references/diagnostic-workflow.md`；输出契约与交接见 `references/output-contract.md`；知识视图见 `docs/superpowers/knowledge/skill-views/crawler-automate-browsers.md`；证据卡见 `docs/superpowers/knowledge/evidence-cards/browser-automation.md`。

## 非协商门禁

1. 识别为浏览器自动化诊断任务（需要基于证据的分类）。
2. 处理 Stellaris 问题时，先读取 `stellaris-crawler-context` 项目上下文包路径（主决策日志 §38）。
3. 明确诊断聚焦点（浏览器升级 / 动态渲染·等待条件 / 上下文隔离 / 资源拦截 / 公开网络请求观察 / CPU·内存·页面生命周期），聚焦该点，不做无边界全栈诊断。
4. 按匹配版本证据卡分类；绝不因证据不足编造根因；绝不默认使用固定长等待或把 `networkidle` 当作通用完成条件。
5. 外部限制（验证码/访问控制/WAF/指纹检测）只能给合规降级/等待/终止结论；绝不伪装成已修复。
6. 呈现诊断记录并等待用户批准；批准前不交给 `crawler-writing-plans-bridge`。
7. 绝不安装、构建、运行、扫描、代理、测试、执行示例或爬取外部目标；绝不承担项目的生产页面抓取/渲染；绝不保存密钥、Cookie、认证请求头。
8. 输出可追溯产物并更新本地进度总账后才继续。

## 工作流路由

- 诊断流程、问题分类规则、证据卡映射：`references/diagnostic-workflow.md`。
- 诊断记录输出契约、交接契约、修订保留：`references/output-contract.md`。
- 知识视图与证据卡：`docs/superpowers/knowledge/skill-views/crawler-automate-browsers.md`、`docs/superpowers/knowledge/evidence-cards/browser-automation.md`。

## 输出

- 诊断记录：问题证据＋分类＋根因或待验证假设＋影响范围＋修复方向＋浏览器层测试建议；等待用户批准后交给 `crawler-writing-plans-bridge`。

## 禁止

- 不承担项目的生产页面抓取和渲染。
- 不默认使用固定长等待或把 `networkidle` 当作通用完成条件。
- Playwright 具体 API/配置/版本问题交给 `crawler-use-playwright`；业务字段正确性交给 `crawler-validate-extraction`。
- 不绕过登录、验证码、访问控制或 WAF。
- 不执行过度浏览器复现或无效轰击；诊断复现限小规模、隔离、合规。
- 不把外部限制或未知项伪装成已修复。
- 不生成 `writing-plans`、不提出未经批准的代码修改。
- 不修改爬虫代码、`manifest.md`、任何第三方仓库；不初始化 Git。
- 不把密钥、Cookie、认证请求头写入诊断记录，落盘前脱敏。
