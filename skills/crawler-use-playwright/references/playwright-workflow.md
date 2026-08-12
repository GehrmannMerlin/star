# `crawler-use-playwright` 诊断流程与实现转换规则

> 本文件定义本 Skill 的诊断流程、问题分类规则、实现转换规则与证据卡映射。判断依据与边界以主决策日志与已批准设计规格为准。

## 诊断流程

1. 读取项目上下文、目标、约束与已确认根因。处理 Stellaris 问题时，先读取 `stellaris-crawler-context` 生成的项目上下文包路径。
2. 确定诊断聚焦点（`Browser` 与启动配置 / `Context` 与隔离 / `Page` 与导航 / Locator 与元素定位 / 网络事件与资源拦截 / Trace 与调试），聚焦该点，不做无边界全栈诊断。
3. 检查相关 Playwright 代码、配置、依赖版本、Trace、截图、日志和最小复现证据，定位具体证据位置。
4. 引用匹配版本的证据卡（`playwright.md`）比对项目行为与规范/实现/工程证据。
5. 分类：代码缺陷 / 配置错误 / 版本兼容 / 设计不足 / 外部条件 / 未知项。
6. 证据不足时只提出最小补充取证（隔离的最小复现、Trace 分析）；根因未证实前不提出代码修改。
7. 将 `crawler-automate-browsers` 已确认的跨框架修复方向转换为适合当前 Playwright 版本（v1.62.1）的具体实现建议。
8. 输出可追溯问题证据、根因或待验证假设、影响范围、修复方向、测试建议。
9. 获准的修复方向交给 `crawler-writing-plans-bridge`。

## 问题分类规则

- **代码缺陷**：Playwright 代码未按锁定版本行为处理（如错误 API 用法、定位竞态、上下文泄漏）。
- **配置错误**：Playwright 配置与锁定版本行为不符（如浏览器启动配置、等待条件配置错误）。
- **版本兼容**：Playwright 版本与 API 行为不匹配（如引用已变更或已移除的 API）。
- **设计不足**：缺乏上下文隔离、等待条件、资源拦截等设计层面缺失。
- **外部条件**：运行时环境不可用、外部服务受限等——只能给合规降级/等待/终止结论，不得伪装成已修复（主决策日志 §12/§61）。
- **未知项**：证据不足或冲突，保持候选假设，显式标记，不判定为确定根因。

每条结论必须明确区分：事实、证据、综合推断、待确认项。综合推断必须显式标记为"推断"，不得伪装成资料中的确定结论（主决策日志 §14）。

置信度使用固定枚举：高（证据充分且指向唯一分类）、中（证据充分但多个分类可能）、低（证据不足或冲突，仅候选假设）、不确定（无法判断）。

## 实现转换规则

- 将 `crawler-automate-browsers` 已确认的跨框架修复方向转换为适合当前 Playwright 版本（v1.62.1）的具体实现建议。
- 引用锁定版本（microsoft/playwright v1.62.1）的 API 与配置语义；不引用不存在或已变更的 API；不默认采用审查时最新 Release 或历史草案版本（主决策日志 §71/§75）。
- 识别"适用版本准确但运行行为错误"是验收重点——版本准确不等于运行行为正确；等待竞态、定位不稳定、上下文泄漏需运行时证据判定。
- 等待与定位方式可靠；识别偶发性的浏览器竞态和资源泄漏问题。
- 不承担生产页面抓取；不得提供绕过登录/验证码/访问控制/WAF 的方法。

## 证据卡映射

共享证据卡：`docs/superpowers/knowledge/evidence-cards/playwright.md`；知识视图：`docs/superpowers/knowledge/skill-views/crawler-use-playwright.md`。

| 诊断聚焦点 | 证据卡 | 固定资料路径 |
|---|---|---|
| `Browser` 与启动配置 | PW-BROWSER-001、PW-BROWSER-002、PW-BROWSER-003 | Playwright `packages/playwright-core/src/client/browser.ts`、`browserType.ts` |
| `Context` 与隔离 | PW-CTX-001、PW-CTX-002 | Playwright `packages/playwright-core/src/client/browserContext.ts` |
| `Page` 与导航 | PW-PAGE-001、PW-PAGE-002、PW-PAGE-003 | Playwright `packages/playwright-core/src/client/page.ts`、`frame.ts` |
| Locator 与元素定位 | PW-LOC-001、PW-LOC-002、PW-LOC-003 | Playwright `packages/playwright-core/src/client/locator.ts`、`elementHandle.ts` |
| 网络事件与 Trace | PW-NET-001、PW-NET-002 | Playwright `packages/playwright-core/src/client/network.ts`、`tracing.ts`、`video.ts` |

每条依据必须可追溯：从诊断记录追到固定版本资料、证据卡、上下文包条目或决策日志节号。只给仓库首页、模糊文件夹或没有版本的引用不满足要求。

## 只读诊断边界

- 诊断默认只指导只读静态审查、配置审查和锁定版本资料比对。
- 任何隔离的最小复现或 Trace 分析动作须获得明确批准。
- 不安装、构建或运行未经批准的项目或第三方代码。
- 不承担生产页面抓取；不得提供绕过访问控制方法；不发起对目标站点的无授权请求。
- 诊断复现限受控、合规；不得发起新的对外抓取或绕过访问控制。

## 证据不足与冲突

- 证据不足时不得把结论判定为确定根因；保留候选状态并标记未知项。
- 现场证据、项目上下文、已批准要求冲突时并列报告，不静默覆盖任一来源。
- 未解决的声明标记为不确定（非确定性），不得伪装成确定结论。
- 固定版本证据卡与既有诊断记录不得被静默改写；更新只通过新增修订进行。
- 不把"适用版本准确"误判为"运行行为正确"；等待竞态、定位不稳定、上下文泄漏需运行时证据判定。
- 外部条件（运行时环境不可用/外部服务受限）只能给合规降级/等待/终止结论，不得伪装成已修复。
- 不得因新技术更新默认要求升级；是否升级以证据和项目约束为准。
