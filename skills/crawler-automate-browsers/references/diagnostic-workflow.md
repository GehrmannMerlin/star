# `crawler-automate-browsers` 诊断流程与分类规则

> 本文件定义本 Skill 的诊断流程、问题分类规则与证据卡映射。判断依据与边界以主决策日志与已批准设计规格为准。

## 诊断流程

1. 读取项目上下文、目标、约束与已确认问题证据。处理 Stellaris 问题时，先读取 `stellaris-crawler-context` 生成的项目上下文包路径。
2. 确定诊断聚焦点（浏览器升级条件 / 动态渲染·等待条件 / 上下文隔离 / 资源拦截 / 公开网络请求观察 / CPU·内存·页面生命周期），聚焦该点，不做无边界全栈诊断。
3. 检查相关代码、配置、依赖版本、日志、Trace、DOM、截图、网络记录，定位具体证据位置。
4. 引用匹配版本的证据卡（`browser-automation.md`，以 W3C WebDriver 规范为主要依据）比对项目行为。
5. 分类：代码缺陷 / 配置错误 / 版本兼容 / 页面行为变化 / 外部限制 / 未知项。
6. 证据不足时只提出最小补充取证或受控浏览器复现；根因未证实前不提出代码修改。
7. 输出可追溯问题证据、根因或待验证假设、影响范围、修复方向、浏览器层测试建议。
8. 根因和方向获批后，将选定方向交给 `crawler-writing-plans-bridge`。

## 问题分类规则

- **代码缺陷**：浏览器自动化代码未按规范/实现证据处理（如等待条件错误、上下文未隔离、资源拦截误配置）。
- **配置错误**：浏览器配置/参数与固定版本行为不符（如启动参数、上下文配置、超时设置错误）。
- **版本兼容**：浏览器/驱动/框架版本与 API 行为不匹配（如 WebDriver 协议版本差异）。
- **页面行为变化**：目标站点 DOM/结构/行为变化导致选择器失效、元素不可交互、动态内容加载变化——需重新取证而非盲改代码。
- **外部限制**：站点验证码、访问控制、WAF、浏览器指纹检测等——只能给合规降级/等待/终止结论，不得伪装成已修复（主决策日志 §12/§50）。
- **未知项**：证据不足或冲突，保持候选假设，显式标记，不判定为确定根因。

每条结论必须明确区分：事实、证据、综合推断、待确认项。综合推断必须显式标记为"推断"，不得伪装成资料中的确定结论（主决策日志 §14）。

置信度使用固定枚举：高（证据充分且指向唯一分类）、中（证据充分但多个分类可能）、低（证据不足或冲突，仅候选假设）、不确定（无法判断）。

## 等待条件纪律

- 不得默认使用固定长等待；等待应针对动态内容的实际就绪条件使用显式等待或条件等待。
- 不得把 `networkidle` 当作通用完成条件；`networkidle` 不是 W3C WebDriver 规范定义的通用完成条件。
- 超时类型区分：script timeout（脚本执行）、page load timeout（页面加载）、implicit wait（元素定位隐式等待）。

## 证据卡映射

共享证据卡：`docs/superpowers/knowledge/evidence-cards/browser-automation.md`；知识视图：`docs/superpowers/knowledge/skill-views/crawler-automate-browsers.md`。

| 诊断聚焦点 | 证据卡 | 固定资料路径 |
|---|---|---|
| 会话与上下文隔离 | AB-SESS-001、AB-SESS-002、AB-SESS-003 | w3c/webdriver `index.html`（Capabilities、Sessions、Contexts、Global State、Privacy、Security 章节） |
| 等待条件与导航 | AB-WAIT-001、AB-WAIT-002、AB-WAIT-003 | w3c/webdriver `index.html`（Timeouts、Navigation、Document、Executing Script 章节） |
| 元素与交互 | AB-ELEM-001、AB-ELEM-002、AB-ELEM-003 | w3c/webdriver `index.html`（Elements、Interactability、Retrieval、State、Interaction、Actions 章节） |
| 资源拦截与网络观察 | AB-NET-001、AB-NET-002 | w3c/webdriver `index.html`（Capabilities、Proxy 章节） |
| 生命周期与资源 | AB-LIFE-001、AB-LIFE-002 | w3c/webdriver `index.html`（Screen capture、Print、Sessions、Contexts 章节） |

每条依据必须可追溯：从诊断记录追到固定版本资料、证据卡、上下文包条目或决策日志节号。只给仓库首页、模糊文件夹或没有版本的引用不满足要求。

## 受控浏览器复现边界

- 诊断确有必要时，可以指导 Agent 执行小规模、隔离且合规的浏览器复现用于收集诊断证据。
- 复现不得承担项目的生产页面抓取和渲染；不得执行过度复现或无效轰击。
- 复现必须遵守访问控制与合规边界；不得绕过登录、验证码、访问控制或 WAF；不保存密钥、Cookie、认证请求头。

## 证据不足与冲突

- 证据不足时不得把结论判定为确定根因；保留候选状态并标记未知项。
- 现场证据、项目上下文、已批准要求冲突时并列报告，不静默覆盖任一来源。
- 未解决的声明标记为不确定（非确定性），不得伪装成确定结论。
- 固定版本证据卡与既有诊断记录不得被静默改写；更新只通过新增修订进行。
- 外部限制（验证码/访问控制/WAF/指纹检测）只能给合规降级/等待/终止结论，不得伪装成已修复。
- 不得因新技术更新默认要求升级；是否升级以证据和项目约束为准。
