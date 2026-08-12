# 浏览器自动化证据卡（共享证据层）

> 本文件是共享可追溯证据层中与浏览器自动化诊断相关的证据卡集合。每张卡表达一条可验证知识声明，绑定固定版本资料、原始位置与适用边界。
>
> 来源：批次 3 固定源码快照 `w3c/webdriver`，以 `third-party/crawler-knowledge-sources/manifest.md` 记录的 ref 与 Commit 为唯一版本基线。Playwright 等框架的具体 API 细节留给第五批重点技术栈（Skill 16 `crawler-use-playwright`）。
>
> 证据等级：规范证据（官方规范/文档/Release）＞实现证据（同版本官方源码/测试）＞工程证据（官方运行指南/手册）＞案例证据（事故资料，只用于启发）。
>
> 维护规则：本文件由资料治理 Skill 按既定准入、许可证复核与版本固定流程维护；不得静默改写已固定证据卡，更新只通过新增修订进行。

## 来源身份与版本基线

| 仓库 | 权威 ref | Commit | 本地路径 |
|---|---|---|---|
| w3c/webdriver | `master` | `14b5637636ca14da395e899ee5e45ac3eba5bfd7` | `third-party/crawler-knowledge-sources/repos/batch-03-crawler-pipeline/webdriver` |

规范正文位于 `index.html`（455 KB，WebDriver 规范）；`webdriver-spec.html` 为重定向页（指向 `https://w3c.github.io/webdriver/`），不作为证据来源。

---

## 会话与上下文隔离

### AB-SESS-001 会话与能力协商

- **知识声明**：WebDriver 通过 Capabilities 协商启动新会话（`new-session`）；会话是命令执行与状态隔离的边界，客户端与远端通过会话 ID 关联后续命令。
- **证据类型/等级**：规范证据。
- **来源身份**：w3c/webdriver（`master`）。
- **版本/ref/Commit**：`master`；`14b5637636ca14da395e899ee5e45ac3eba5bfd7`。
- **原始位置**：`index.html`，`Capabilities`、`Sessions`、`new-session` 小节。
- **支持说明**：规范定义 Capabilities 协商与新会话创建流程；"session" 在规范中出现 815 次，是 WebDriver 协议的核心状态单元。
- **适用条件**：诊断会话创建失败、能力协商不匹配、多会话状态泄漏时比对。
- **限制**：Capabilities 具体字段与扩展随版本与实现变化；Playwright/Crawlee 等的会话语义以其锁定版本资料为准。
- **关联 Skill**：crawler-automate-browsers。
- **状态**：有效。

### AB-SESS-002 上下文与窗口管理

- **知识声明**：WebDriver 的 Contexts 定义窗口/标签页句柄与当前上下文切换；会话维护顶层浏览上下文，脚本在选定上下文内执行。
- **证据类型/等级**：规范证据。
- **来源身份**：w3c/webdriver（`master`）。
- **版本/ref/Commit**：`master`；`14b5637636ca14da395e899ee5e45ac3eba5bfd7`。
- **原始位置**：`index.html`，`Contexts` 章节。
- **支持说明**：规范定义窗口句柄、切换上下文与顶层浏览上下文语义。
- **适用条件**：诊断窗口/标签页句柄错乱、上下文切换失败、多标签状态泄漏时比对。
- **限制**：上下文与窗口句柄的具体行为随实现与版本变化；本卡是规范语义。
- **关联 Skill**：crawler-automate-browsers。
- **状态**：有效。

### AB-SESS-003 全局状态与隐私边界

- **知识声明**：WebDriver 规范含 Global State 与 Privacy/Security 章节，定义会话全局状态与隐私/安全边界；不把用户真实凭据泄露给远端。
- **证据类型/等级**：规范证据。
- **来源身份**：w3c/webdriver（`master`）。
- **版本/ref/Commit**：`master`；`14b5637636ca14da395e899ee5e45ac3eba5bfd7`。
- **原始位置**：`index.html`，`Global State`、`Privacy`、`Security` 章节。
- **支持说明**：规范在 Global State 定义会话状态，Privacy/Security 定义边界。
- **适用条件**：诊断会话全局状态污染、凭据/敏感信息泄露风险时比对。
- **限制**：隐私/安全边界是规范要求；具体实现与合规解读须结合项目上下文与安全 Skill。
- **关联 Skill**：crawler-automate-browsers。
- **状态**：有效。

---

## 等待条件与导航

### AB-WAIT-001 超时类型与语义

- **知识声明**：WebDriver 定义三类超时：script timeout（脚本执行）、page load timeout（页面加载）、implicit wait（元素定位隐式等待）；Timeouts 命令可设置会话级超时。
- **证据类型/等级**：规范证据。
- **来源身份**：w3c/webdriver（`master`）。
- **版本/ref/Commit**：`master`；`14b5637636ca14da395e899ee5e45ac3eba5bfd7`。
- **原始位置**：`index.html`，`Timeouts` 章节（`timeout` 138 次、`script timeout` 7 次、`page load timeout` 6 次、`implicit wait` 5 次）。
- **支持说明**：规范定义三类超时及其设置命令。
- **适用条件**：诊断等待失效（固定长等待不足/超时）、超时未生效时比对。
- **限制**：不把固定长等待或 `networkidle` 当作通用完成条件；应针对动态内容使用显式等待或条件等待。
- **关联 Skill**：crawler-automate-browsers。
- **状态**：有效。

### AB-WAIT-002 导航与文档就绪

- **知识声明**：WebDriver 的 Navigation 定义页面导航命令；Document 定义文档状态（如加载完成标志），page load timeout 限制导航等待。
- **证据类型/等级**：规范证据。
- **来源身份**：w3c/webdriver（`master`）。
- **版本/ref/Commit**：`master`；`14b5637636ca14da395e899ee5e45ac3eba5bfd7`。
- **原始位置**：`index.html`，`Navigation`、`Document` 章节。
- **支持说明**：规范定义导航命令与文档就绪语义。
- **适用条件**：诊断页面加载未完成、导航超时、文档就绪判断错误时比对。
- **限制**：`networkidle` 不是 WebDriver 规范定义的通用完成条件；动态内容加载须用条件等待验证。
- **关联 Skill**：crawler-automate-browsers。
- **状态**：有效。

### AB-WAIT-003 脚本执行

- **知识声明**：WebDriver 的 Executing Script 定义在当前上下文执行脚本；script timeout 限制脚本执行时间。
- **证据类型/等级**：规范证据。
- **来源身份**：w3c/webdriver（`master`）。
- **版本/ref/Commit**：`master`；`14b5637636ca14da395e899ee5e45ac3eba5bfd7`。
- **原始位置**：`index.html`，`Executing Script`、`Timeouts`（script timeout）章节。
- **支持说明**：规范定义脚本执行命令与 script timeout 语义。
- **适用条件**：诊断脚本执行超时、注入脚本失效、异步脚本等待错误时比对。
- **限制**：异步脚本与等待条件的具体实现随框架/版本变化。
- **关联 Skill**：crawler-automate-browsers。
- **状态**：有效。

---

## 元素与交互

### AB-ELEM-001 元素检索

- **知识声明**：WebDriver 定义元素检索（Element Retrieval）：通过选择器/定位器在当前上下文查找元素；找不到时返回 no such element 错误。
- **证据类型/等级**：规范证据。
- **来源身份**：w3c/webdriver（`master`）。
- **版本/ref/Commit**：`master`；`14b5637636ca14da395e899ee5e45ac3eba5bfd7`。
- **原始位置**：`index.html`，`Elements`、`element-retrieval` 小节。
- **支持说明**：规范定义元素检索语义与错误处理。
- **适用条件**：诊断元素找不到、选择器失效、隐式等待未生效时比对。
- **限制**：定位器语法与解析随实现与版本变化；页面结构变化导致的失效须重新取证（页面行为变化分类）。
- **关联 Skill**：crawler-automate-browsers。
- **状态**：有效。

### AB-ELEM-002 可交互性与元素状态

- **知识声明**：WebDriver 定义元素可交互性（Interactability）检查与元素状态（Element State）；交互前须满足可交互条件（可见、可点等）。
- **证据类型/等级**：规范证据。
- **来源身份**：w3c/webdriver（`master`）。
- **版本/ref/Commit**：`master`；`14b5637636ca14da395e899ee5e45ac3eba5bfd7`。
- **原始位置**：`index.html`，`Elements`、`Interactability`、`State`、`Element displayedness` 章节。
- **支持说明**：规范定义可交互性检查（如 `element-displayedness`）与元素状态语义。
- **适用条件**：诊断元素不可交互、点击/输入无效、元素状态判断错误时比对。
- **限制**：可交互性判定（可见性、遮挡）随实现与版本变化；本卡是规范语义。
- **关联 Skill**：crawler-automate-browsers。
- **状态**：有效。

### AB-ELEM-003 动作与输入

- **知识声明**：WebDriver 的 Actions 定义输入动作（键盘、指针、滚轮）的处理模型；Actions Options、Input sources、Input state、Ticks、Processing/Dispatching actions 定义动作序列执行语义。
- **证据类型/等级**：规范证据。
- **来源身份**：w3c/webdriver（`master`）。
- **版本/ref/Commit**：`master`；`14b5637636ca14da395e899ee5e45ac3eba5bfd7`。
- **原始位置**：`index.html`，`Actions Options`、`Input sources`、`Input state`、`Ticks`、`Processing actions`、`Dispatching actions` 章节。
- **支持说明**：规范定义动作输入模型与执行语义。
- **适用条件**：诊断键盘/指针/滚轮动作无效、动作序列时序错误时比对。
- **限制**：具体动作 API 随框架/版本变化；本卡是 WebDriver 动作模型规范。
- **关联 Skill**：crawler-automate-browsers。
- **状态**：有效。

---

## 资源拦截与网络观察

### AB-NET-001 代理能力

- **知识声明**：WebDriver 定义 Proxy 能力（Capabilities 中的 proxy），用于配置浏览器代理；代理设置随会话/浏览器生效。
- **证据类型/等级**：规范证据。
- **来源身份**：w3c/webdriver（`master`）。
- **版本/ref/Commit**：`master`；`14b5637636ca14da395e899ee5e45ac3eba5bfd7`。
- **原始位置**：`index.html`，`Capabilities`、`Proxy` 章节。
- **支持说明**：规范定义 Proxy 能力（httpProxy、sslProxy、noProxy 等）。
- **适用条件**：诊断浏览器代理配置未生效、noProxy 失效时比对。
- **限制**：代理凭据属于敏感信息，诊断记录不得写入明文（§36）；不同浏览器代理实现不同。
- **关联 Skill**：crawler-automate-browsers。
- **状态**：有效。

### AB-NET-002 公开网络请求观察

- **知识声明**：WebDriver 通过代理或网络事件暴露公开网络请求；观察网络请求用于诊断动态渲染加载的资源与请求时序，但不得用于绕过访问控制。
- **证据类型/等级**：规范证据。
- **来源身份**：w3c/webdriver（`master`）。
- **版本/ref/Commit**：`master`；`14b5637636ca14da395e899ee5e45ac3eba5bfd7`。
- **原始位置**：`index.html`，`Proxy`、网络观察相关小节。
- **支持说明**：代理能力可暴露请求；公开网络请求观察用于诊断动态加载资源。
- **适用条件**：诊断动态内容加载的资源请求、请求时序、拦截配置时比对。
- **限制**：公开请求观察不得作为绕过访问控制的通道；网络事件 API 随实现/版本变化。
- **关联 Skill**：crawler-automate-browsers。
- **状态**：有效。

---

## 生命周期与资源

### AB-LIFE-001 屏幕捕获与打印

- **知识声明**：WebDriver 定义 Screen capture 与 Print 命令，用于捕获页面截图/打印 PDF；截图可用于取证与诊断展示。
- **证据类型/等级**：规范证据。
- **来源身份**：w3c/webdriver（`master`）。
- **版本/ref/Commit**：`master`；`14b5637636ca14da395e899ee5e45ac3eba5bfd7`。
- **原始位置**：`index.html`，`Screen capture`、`Print` 章节。
- **支持说明**：规范定义截图与打印命令。
- **适用条件**：诊断截图/打印异常、截图用于证据采集时比对。
- **限制**：截图内容可能含敏感信息，落盘前须脱敏（§36）。
- **关联 Skill**：crawler-automate-browsers。
- **状态**：有效。

### AB-LIFE-002 页面生命周期与资源观察

- **知识声明**：浏览器自动化会话的页面生命周期（加载、交互、关闭）与资源（CPU/内存）使用可被观察；生命周期管理不当会导致上下文泄漏或资源耗尽。
- **证据类型/等级**：规范证据（结合工程推断）。
- **来源身份**：w3c/webdriver（`master`）。
- **版本/ref/Commit**：`master`；`14b5637636ca14da395e899ee5e45ac3eba5bfd7`。
- **原始位置**：`index.html`，`Sessions`、`Contexts`、生命周期相关小节。
- **支持说明**：会话/上下文管理影响页面生命周期；未关闭的会话/上下文累积导致资源异常。
- **适用条件**：诊断浏览器上下文泄漏、CPU/内存持续增长、页面生命周期异常时比对。
- **限制**：本卡含工程推断（`推断`）；具体资源观测 API 随框架/版本变化。
- **关联 Skill**：crawler-automate-browsers。
- **状态**：有效。

---

## 汇总

- 证据卡总数：13 张（AB-SESS 3＋AB-WAIT 3＋AB-ELEM 3＋AB-NET 2＋AB-LIFE 2）。
- 来源：批次 3 固定仓库 `w3c/webdriver`（`index.html` 规范）。
- 引用契约：下游 Skill 视图通过稳定 ID 引用本文件；原始证据通过 manifest 固定 Commit 与相对路径可追溯。
