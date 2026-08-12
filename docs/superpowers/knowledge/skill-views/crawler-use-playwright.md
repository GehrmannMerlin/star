# crawler-use-playwright 知识视图

> 本视图是 `crawler-use-playwright` Skill 的独立知识视图，只保留与"Playwright 专项实现诊断、修复顾问"职责相关的知识。来源身份、版本与许可证事实由共享证据层统一维护，本视图通过稳定证据卡 ID 引用，不复制原始来源元数据。

## 定位、触发与排除项

- **定位**：面向 Agent 的 Playwright 专项实现诊断、修复顾问；依托项目锁定 Playwright 版本（v1.62.1）对应的官方文档、发布说明、故障案例和源码，帮助 Agent 检查 `Browser`、`Context`、`Page`、Locator、等待条件、网络事件、资源拦截和浏览器启动配置，识别错误 API 用法、版本差异、元素定位不稳定、等待竞态、上下文泄漏和浏览器崩溃问题。
- **不是**：生产页面抓取组件。
- **触发**：用户要求检查 Playwright 专项实现相关设计或故障；已确认问题涉及 `Browser`、`Context`、`Page`、Locator、等待条件、网络事件、资源拦截或浏览器启动配置。
- **排除**：不承担生产页面抓取；不得提供绕过登录/验证码/访问控制/WAF 的方法；跨框架浏览器方法论交给 `crawler-automate-browsers`；Docker→`crawler-run-docker`；不越过批准边界/不跳过 `crawler-writing-plans-bridge`；不生成 `writing-plans`。

## 最低证据输入

- 项目上下文（处理 Stellaris 问题时为 `stellaris-crawler-context` 项目上下文包路径）。
- 已确认根因与方向（`crawler-triage-incidents` 分诊结论，适用时）。
- 相关 Playwright 代码、配置、依赖版本、Trace、截图、日志和最小复现证据。
- 固定版本资料（批次 5：microsoft/playwright v1.62.1）。

## 知识主题与证据卡映射

### Browser 与启动配置

- 判断 Browser 类型/启动、启动选项、启动失败是否符合锁定版本行为；启动失败、启动选项错误是常见问题。
- 证据卡：[[PW-BROWSER-001]]（Browser 类型与启动）、[[PW-BROWSER-002]]（启动选项）、[[PW-BROWSER-003]]（启动失败与崩溃）。
- 依据固定版本：Playwright `packages/playwright-core/src/client/browser.ts`、`browserType.ts`。

### Context 与隔离

- 判断上下文隔离、上下文泄漏是否符合锁定版本行为；会话串用、资源泄漏是常见问题。
- 证据卡：[[PW-CTX-001]]（newContext 与上下文隔离）、[[PW-CTX-002]]（上下文泄漏与清理）。
- 依据固定版本：Playwright `packages/playwright-core/src/client/browserContext.ts`。

### Page 与导航

- 判断 Page 导航、导航等待、页面生命周期是否符合锁定版本行为；导航失败、等待竞态是常见问题。
- 证据卡：[[PW-PAGE-001]]（Page 与导航语义）、[[PW-PAGE-002]]（导航等待）、[[PW-PAGE-003]]（页面生命周期）。
- 依据固定版本：Playwright `packages/playwright-core/src/client/page.ts`、`frame.ts`。

### Locator 与元素定位

- 判断 Locator 语义、元素定位/等待、定位竞态是否符合锁定版本行为；定位不稳定、等待竞态是常见问题。
- 证据卡：[[PW-LOC-001]]（Locator 语义）、[[PW-LOC-002]]（元素定位与等待）、[[PW-LOC-003]]（定位竞态与资源泄漏）。
- 依据固定版本：Playwright `packages/playwright-core/src/client/locator.ts`、`elementHandle.ts`。

### 网络事件与 Trace

- 判断网络事件/资源拦截、Trace/调试是否符合锁定版本行为；网络观察错误、Trace 断链是常见问题。
- 证据卡：[[PW-NET-001]]（网络事件与资源拦截）、[[PW-NET-002]]（Trace 与调试）。
- 依据固定版本：Playwright `packages/playwright-core/src/client/network.ts`、`tracing.ts`、`video.ts`。

## 实现转换规则

- 将 `crawler-automate-browsers` 已确认的跨框架修复方向转换为适合当前 Playwright 版本（v1.62.1）的具体实现建议。
- 引用锁定版本（microsoft/playwright v1.62.1）的 API 与配置语义；不引用不存在或已变更的 API；不默认采用最新 Release 或历史草案版本。
- 识别"适用版本准确但运行行为错误"是验收重点——版本准确不等于运行行为正确。
- 等待与定位方式可靠；识别偶发性的浏览器竞态和资源泄漏问题。

## 版本化判断规则

- 每条判断依据必须追溯到固定版本资料（ref＋Commit）、证据卡、上下文包条目或决策日志节号；只给仓库首页或没有版本的引用不满足要求。
- 明确区分事实、证据、综合推断与未知项；综合推断必须显式标记"推断"，不得伪装成资料中的确定结论。
- 不得因新技术更新默认要求升级；是否升级以证据和项目约束为准。
- 案例证据与工程证据不得单独升格为跨项目通用规范或确定根因。

## 输出、交接与禁止越权

- **输出**：可追溯问题证据、根因或待验证假设、影响范围、修复方向（Playwright 实现建议）、测试建议。
- **交接**：将 `crawler-automate-browsers` 已确认方向转换为 Playwright 实现建议，不越过批准边界/不跳过 `crawler-writing-plans-bridge`；获准修复方向→`crawler-writing-plans-bridge`；Docker→`crawler-run-docker`。
- **禁止越权**：不承担生产页面抓取、不得提供绕过访问控制方法、不把适用版本准确误判为运行行为正确、不生成 `writing-plans`、不初始化 Git、不记录敏感信息原件。

## 视图自检

- 全部证据卡 ID（PW-BROWSER-*、PW-CTX-*、PW-PAGE-*、PW-LOC-*、PW-NET-*）在 `playwright.md` 中存在且被本视图引用。
- 无未标注的推断；每条判断可追溯到证据卡或固定资料。
- 未复制相邻 Skill（`crawler-automate-browsers`、`crawler-debug-http-network`、`crawler-run-docker`）的职责。
