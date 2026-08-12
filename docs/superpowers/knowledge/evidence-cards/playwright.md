# Playwright 专项实现证据卡（共享证据层）

> 本文件是共享可追溯证据层中与 Playwright 专项实现诊断相关的证据卡集合。每张卡表达一条可验证知识声明，绑定固定版本资料、原始位置与适用边界。
>
> 来源：批次 5 固定源码快照（microsoft/playwright），全部以 `third-party/crawler-knowledge-sources/manifest.md` 记录的 ref 与 Commit 为唯一版本基线。
>
> 证据等级：规范证据（官方规范/文档/Release）＞实现证据（同版本官方源码/测试）＞工程证据（官方运行指南/手册）＞案例证据（事故资料，只用于启发）。
>
> 维护规则：本文件由资料治理 Skill 按既定准入、许可证复核与版本固定流程维护；不得静默改写已固定证据卡，更新只通过新增修订进行。

## 来源身份与版本基线

| 仓库 | 权威 ref | Commit | 本地路径 |
|---|---|---|---|
| microsoft/playwright | `v1.62.1` | `26a9e470a7b3c7822084b09fb7f13902c5f37b51` | `third-party/crawler-knowledge-sources/repos/batch-05-core-stack/playwright` |

---

## Browser 与启动配置

### PW-BROWSER-001 Browser 类型与启动

- **知识声明**：Playwright 通过 BrowserType 启动浏览器（chromium、firefox、webkit），Browser 代表浏览器实例；启动失败（缺二进制、环境受限）会导致浏览器无法使用。
- **证据类型/等级**：实现证据（同版本官方源码）。
- **来源身份**：microsoft/playwright（`v1.62.1`）。
- **版本/ref/Commit**：`v1.62.1`；`26a9e470a7b3c7822084b09fb7f13902c5f37b51`。
- **原始位置**：`packages/playwright-core/src/client/browser.ts`、`browserType.ts`。
- **支持说明**：browser.ts 定义 Browser 实例语义；browserType.ts 定义启动流程。
- **适用条件**：诊断浏览器启动失败、浏览器选择错误、启动崩溃。
- **限制**：Browser 行为以 playwright v1.62.1 为准；启动失败常源于环境（外部条件）。
- **关联 Skill**：crawler-use-playwright。
- **状态**：有效。

### PW-BROWSER-002 启动选项

- **知识声明**：Playwright 浏览器启动支持选项（headless、executablePath、args、env 等）；启动选项配置错误会导致浏览器行为不符预期。
- **证据类型/等级**：实现证据（同版本官方源码）。
- **来源身份**：microsoft/playwright（`v1.62.1`）。
- **版本/ref/Commit**：`v1.62.1`；`26a9e470a7b3c7822084b09fb7f13902c5f37b51`。
- **原始位置**：`packages/playwright-core/src/client/browserType.ts`。
- **支持说明**：browserType.ts 定义启动选项处理。
- **适用条件**：诊断启动选项配置错误、"适用版本准确但运行行为错误"。
- **限制**：启动选项语义以 playwright v1.62.1 为准。
- **关联 Skill**：crawler-use-playwright。
- **状态**：有效。

### PW-BROWSER-003 启动失败与崩溃

- **知识声明**：Playwright 浏览器启动失败或崩溃（缺二进制、OOM、环境受限）会中断抓取；启动失败常属外部条件，只给合规降级/等待/终止结论。
- **证据类型/等级**：实现证据（同版本官方源码）。
- **来源身份**：microsoft/playwright（`v1.62.1`）。
- **版本/ref/Commit**：`v1.62.1`；`26a9e470a7b3c7822084b09fb7f13902c5f37b51`。
- **原始位置**：`packages/playwright-core/src/client/browserType.ts`。
- **支持说明**：browserType.ts 启动失败路径；启动失败诊断依赖运行时证据。
- **适用条件**：诊断浏览器启动失败、崩溃、缺二进制。
- **限制**：启动失败归因须运行时证据；外部条件不得伪装成已修复。
- **关联 Skill**：crawler-use-playwright。
- **状态**：有效。

---

## Context 与隔离

### PW-CTX-001 newContext 与上下文隔离

- **知识声明**：Playwright BrowserContext（`browserContext.ts`）代表隔离的浏览器上下文（cookie/storage/会话隔离）；newContext 创建独立上下文，隔离错误会导致会话串用。
- **证据类型/等级**：实现证据（同版本官方源码）。
- **来源身份**：microsoft/playwright（`v1.62.1`）。
- **版本/ref/Commit**：`v1.62.1`；`26a9e470a7b3c7822084b09fb7f13902c5f37b51`。
- **原始位置**：`packages/playwright-core/src/client/browserContext.ts`。
- **支持说明**：browserContext.ts 实现上下文创建与隔离语义。
- **适用条件**：诊断上下文隔离错误、cookie/storage 串用。
- **限制**：上下文语义以 playwright v1.62.1 为准。
- **关联 Skill**：crawler-use-playwright。
- **状态**：有效。

### PW-CTX-002 上下文泄漏与清理

- **知识声明**：Playwright BrowserContext 需要正确关闭（close）以释放资源；上下文未关闭会导致浏览器资源泄漏、进程挂起。
- **证据类型/等级**：实现证据（同版本官方源码）。
- **来源身份**：microsoft/playwright（`v1.62.1`）。
- **版本/ref/Commit**：`v1.62.1`；`26a9e470a7b3c7822084b09fb7f13902c5f37b51`。
- **原始位置**：`packages/playwright-core/src/client/browserContext.ts`。
- **支持说明**：browserContext.ts 实现 close 语义；未关闭导致资源泄漏。
- **适用条件**：诊断上下文泄漏、资源未释放、进程挂起。
- **限制**：清理语义以 playwright v1.62.1 为准。
- **关联 Skill**：crawler-use-playwright。
- **状态**：有效。

---

## Page 与导航

### PW-PAGE-001 Page 与导航语义

- **知识声明**：Playwright Page（`page.ts`）代表浏览器标签页，支持 goto 导航；导航失败或等待错误导致抓取中断。
- **证据类型/等级**：实现证据（同版本官方源码）。
- **来源身份**：microsoft/playwright（`v1.62.1`）。
- **版本/ref/Commit**：`v1.62.1`；`26a9e470a7b3c7822084b09fb7f13902c5f37b51`。
- **原始位置**：`packages/playwright-core/src/client/page.ts`、`frame.ts`。
- **支持说明**：page.ts 实现 Page 语义与导航。
- **适用条件**：诊断页面导航失败、goto 错误。
- **限制**：导航语义以 playwright v1.62.1 为准。
- **关联 Skill**：crawler-use-playwright。
- **状态**：有效。

### PW-PAGE-002 导航等待

- **知识声明**：Playwright 导航等待（waitForLoadState、goto 等待）决定页面加载完成条件；等待条件错误会导致页面未就绪或竞态。
- **证据类型/等级**：实现证据（同版本官方源码）。
- **来源身份**：microsoft/playwright（`v1.62.1`）。
- **版本/ref/Commit**：`v1.62.1`；`26a9e470a7b3c7822084b09fb7f13902c5f37b51`。
- **原始位置**：`packages/playwright-core/src/client/page.ts`、`frame.ts`。
- **支持说明**：page/frame 实现导航等待语义。
- **适用条件**：诊断导航等待错误、页面未就绪、竞态。
- **限制**：等待语义以 playwright v1.62.1 为准；不得默认固定长等待。
- **关联 Skill**：crawler-use-playwright。
- **状态**：有效。

### PW-PAGE-003 页面生命周期

- **知识声明**：Playwright Page 生命周期（load、domcontentloaded、close 等事件）决定页面状态；生命周期误解会导致抓取时序错误。
- **证据类型/等级**：实现证据（同版本官方源码）。
- **来源身份**：microsoft/playwright（`v1.62.1`）。
- **版本/ref/Commit**：`v1.62.1`；`26a9e470a7b3c7822084b09fb7f13902c5f37b51`。
- **原始位置**：`packages/playwright-core/src/client/page.ts`。
- **支持说明**：page.ts 定义页面生命周期事件。
- **适用条件**：诊断页面生命周期误解、事件时序错误。
- **限制**：生命周期语义以 playwright v1.62.1 为准。
- **关联 Skill**：crawler-use-playwright。
- **状态**：有效。

---

## Locator 与元素定位

### PW-LOC-001 Locator 语义

- **知识声明**：Playwright Locator（`locator.ts`）提供元素定位语义（getByRole、getByText、locator 链式选择器）；Locator 语义误用导致定位失败。
- **证据类型/等级**：实现证据（同版本官方源码）。
- **来源身份**：microsoft/playwright（`v1.62.1`）。
- **版本/ref/Commit**：`v1.62.1`；`26a9e470a7b3c7822084b09fb7f13902c5f37b51`。
- **原始位置**：`packages/playwright-core/src/client/locator.ts`。
- **支持说明**：locator.ts 实现 Locator 语义与选择器。
- **适用条件**：诊断 Locator 语义误用、定位失败。
- **限制**：Locator 语义以 playwright v1.62.1 为准。
- **关联 Skill**：crawler-use-playwright。
- **状态**：有效。

### PW-LOC-002 元素定位与等待

- **知识声明**：Playwright 元素定位依赖等待条件（waitFor、auto-waiting）；等待竞态导致元素定位不稳定（偶发失败）。
- **证据类型/等级**：实现证据（同版本官方源码）。
- **来源身份**：microsoft/playwright（`v1.62.1`）。
- **版本/ref/Commit**：`v1.62.1`；`26a9e470a7b3c7822084b09fb7f13902c5f37b51`。
- **原始位置**：`packages/playwright-core/src/client/locator.ts`、`elementHandle.ts`。
- **支持说明**：locator/elementHandle 实现等待与定位；等待竞态导致定位不稳定。
- **适用条件**：诊断元素定位不稳定、等待竞态、偶发失败。
- **限制**：定位/等待语义以 playwright v1.62.1 为准；识别偶发竞态是验收重点。
- **关联 Skill**：crawler-use-playwright。
- **状态**：有效。

### PW-LOC-003 定位竞态与资源泄漏

- **知识声明**：Playwright 元素定位竞态（等待时序错误）与资源泄漏（Context/Page 未关闭）是常见问题；识别偶发竞态和资源泄漏是验收重点。
- **证据类型/等级**：实现证据（同版本官方源码）。
- **来源身份**：microsoft/playwright（`v1.62.1`）。
- **版本/ref/Commit**：`v1.62.1`；`26a9e470a7b3c7822084b09fb7f13902c5f37b51`。
- **原始位置**：`packages/playwright-core/src/client/locator.ts`、`elementHandle.ts`。
- **支持说明**：定位竞态与资源泄漏是 Playwright 常见失效模式。
- **适用条件**：诊断定位竞态、资源泄漏、上下文泄漏。
- **限制**：本卡描述常见失效模式；根因判定需运行时证据。
- **关联 Skill**：crawler-use-playwright。
- **状态**：有效。

---

## 网络事件与 Trace

### PW-NET-001 网络事件与资源拦截

- **知识声明**：Playwright 网络事件（request/response/failed）与资源拦截（route）用于观察与拦截网络请求；网络事件观察错误导致请求分析失败。
- **证据类型/等级**：实现证据（同版本官方源码）。
- **来源身份**：microsoft/playwright（`v1.62.1`）。
- **版本/ref/Commit**：`v1.62.1`；`26a9e470a7b3c7822084b09fb7f13902c5f37b51`。
- **原始位置**：`packages/playwright-core/src/client/network.ts`。
- **支持说明**：network.ts 实现网络事件与路由拦截语义。
- **适用条件**：诊断网络事件观察错误、资源拦截错误。
- **限制**：网络语义以 playwright v1.62.1 为准。
- **关联 Skill**：crawler-use-playwright。
- **状态**：有效。

### PW-NET-002 Trace 与调试

- **知识声明**：Playwright Trace 提供调试数据（浏览器上下文记录）；Trace 分析用于复现偶发问题；截图/视频用于故障现场证据。
- **证据类型/等级**：实现证据（同版本官方源码）。
- **来源身份**：microsoft/playwright（`v1.62.1`）。
- **版本/ref/Commit**：`v1.62.1`；`26a9e470a7b3c7822084b09fb7f13902c5f37b51`。
- **原始位置**：`packages/playwright-core/src/client/tracing.ts`；`packages/playwright-core/src/client/video.ts`。
- **支持说明**：Tracing 与 Video 客户端实现 Trace/视频采集。
- **适用条件**：诊断 Trace 分析、偶发问题复现、截图/视频证据。
- **限制**：Trace 语义以 playwright v1.62.1 为准；截图含敏感信息须脱敏。
- **关联 Skill**：crawler-use-playwright。
- **状态**：有效。
