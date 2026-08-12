# crawler-automate-browsers Skill 设计规格

日期：2026-08-01  
状态：书面规格待用户审阅  
适用范围：第 7 个独立 Agent Skill `crawler-automate-browsers` 的完整设计

## 1. 目标与边界

`crawler-automate-browsers` 是爬虫知识资料库爬虫流水线方向下的 Agent 跨框架浏览器自动化诊断、修复顾问。其职责是：依托固定版本资料，帮助 Agent 检查项目中的浏览器升级条件、动态渲染、等待条件、上下文隔离、资源拦截、公开网络请求观察以及 CPU、内存和页面生命周期问题，输出可追溯的问题证据、根因或待验证假设、影响范围、修复方向和浏览器层测试建议；根因和方向获批后交给 `crawler-writing-plans-bridge`。

本 Skill **不是**项目中的生产浏览器 Worker。它不承担项目的生产页面抓取和渲染。

本设计只规划 `crawler-automate-browsers`，不包含第 8 个及后续 Skill 的实施任务；不创建或实施本 Skill 本身（实施由 Claude Code 按后续写作计划执行）。

## 2. 已确认输入

- 主决策日志：`docs/superpowers/brainstorming/2026-07-31-crawler-knowledge-skills-decision-log.md`（已确认决策的最高权威；§50/§51/§119）。
- 统一知识设计规格：`docs/superpowers/specs/2026-07-31-crawler-knowledge-skills-knowledge-design.md`（公共知识契约）。
- 固定源码清单：`third-party/crawler-knowledge-sources/manifest.md`。
- 处理 Stellaris 问题时：`stellaris-crawler-context` 生成的项目上下文包路径。
- 已确认问题证据（`crawler-triage-incidents` 分诊结论，适用时）。
- 浏览器代码、配置、依赖版本、日志、Trace、DOM、截图、网络记录、复现证据（现场只读核验）。

## 3. 职责与排除项

### 3.1 职责

- 检查项目中的浏览器自动化相关问题：
  - 浏览器升级条件；
  - 动态渲染与等待条件；
  - 上下文隔离；
  - 资源拦截；
  - 公开网络请求观察；
  - CPU、内存和页面生命周期。
- 结合适用版本资料判断问题属于代码缺陷、配置错误、版本兼容、页面行为变化、外部限制还是未知项。
- 输出可追溯的问题证据、根因或待验证假设、影响范围、修复方向和浏览器层测试建议。

### 3.2 排除项

- 不承担项目的生产页面抓取和渲染。
- 跨框架的浏览器自动化原理归本 Skill；Playwright 的具体 API、配置和版本问题交给 `crawler-use-playwright`，最终业务字段正确性交给 `crawler-validate-extraction`。
- 不得默认使用固定长等待或把 `networkidle` 当作通用完成条件。
- 不绕过登录、验证码、访问控制或 WAF。
- 不执行过度浏览器复现或无效轰击；诊断复现限小规模、隔离、合规。
- 不把外部限制或未知项伪装成已修复。
- 不生成 `writing-plans`、不提出未经批准的代码修改。
- 不修改爬虫代码、`manifest.md`、第三方仓库；不初始化 Git。
- 不把密钥、Cookie、认证请求头写入诊断记录，落盘前脱敏。

## 4. 触发条件与输入

### 4.1 触发

用户要求检查浏览器自动化相关设计或故障，或已经确认的问题涉及浏览器升级条件、动态渲染、等待条件、上下文隔离、资源拦截、公开网络请求观察或 CPU/内存/页面生命周期时触发（主决策日志 §50）。

### 4.2 最低输入

- 项目上下文（处理 Stellaris 问题时为 `stellaris-crawler-context` 项目上下文包路径）。
- 浏览器代码、配置、依赖版本、日志、Trace、DOM、截图、网络记录、复现证据。
- 固定版本资料（批次 3：w3c/webdriver 规范 `index.html`；Playwright 细节留给第五批 Skill 16）。

## 5. 诊断流程

1. 读取项目上下文（Stellaris 问题先读 `stellaris-crawler-context` 项目上下文包）、目标、约束与已确认问题证据。
2. 确定诊断聚焦点：浏览器升级条件 / 动态渲染·等待条件 / 上下文隔离 / 资源拦截 / 公开网络请求观察 / CPU·内存·页面生命周期。
3. 检查相关代码、配置、依赖版本、日志、Trace、DOM、截图、网络记录，定位具体证据位置。
4. 引用匹配版本的证据卡（`browser-automation.md`，以 W3C WebDriver 规范为主要依据）比对项目行为。
5. 分类：代码缺陷 / 配置错误 / 版本兼容 / 页面行为变化 / 外部限制 / 未知项。
6. 证据不足时只提出最小补充取证或受控浏览器复现；根因未证实前不提出代码修改。
7. 输出可追溯问题证据、根因或待验证假设、影响范围、修复方向、浏览器层测试建议。
8. 根因和方向获批后交给 `crawler-writing-plans-bridge`。

## 6. 问题分类规则

- **代码缺陷**：浏览器自动化代码未按规范/实现证据处理（如等待条件错误、上下文未隔离、资源拦截误配置）。
- **配置错误**：浏览器配置/参数与固定版本行为不符（如启动参数、上下文配置、超时设置错误）。
- **版本兼容**：浏览器/驱动/框架版本与 API 行为不匹配（如 WebDriver 协议版本差异）。
- **页面行为变化**：目标站点 DOM/结构/行为变化导致选择器失效、元素不可交互、动态内容加载变化——需重新取证而非盲改代码。
- **外部限制**：站点验证码、访问控制、WAF、浏览器指纹检测等——只能给合规降级/等待/终止结论，不得伪装成已修复（主决策日志 §12/§50）。
- **未知项**：证据不足或冲突，保持候选假设，显式标记，不判定为确定根因。

每条结论必须明确区分：事实、证据、综合推断、待确认项。综合推断必须显式标记为"推断"，不得伪装成资料中的确定结论（主决策日志 §14）。

## 7. 证据卡主题分组

共享证据卡 `docs/superpowers/knowledge/evidence-cards/browser-automation.md` 以 w3c/webdriver 规范 `index.html` 为主要依据，按以下主题分组（实施时按实际固定资料筛选具体卡片）：

1. **会话与上下文隔离**：WebDriver Capabilities、Sessions、Contexts、Global State。
2. **等待条件与导航**：WebDriver Timeouts、Navigation、Document、Executing Script。
3. **元素与交互**：WebDriver Elements、Interactability、Retrieval、State、Interaction、Actions。
4. **资源拦截与网络观察**：WebDriver Proxy、公开网络请求观察、路由请求。
5. **生命周期与资源**：Screen capture、Print、页面生命周期、CPU/内存观察。

## 8. 输出契约

诊断记录采用可落盘结构化记录＋简短人类可读摘要（主决策日志 §33 节），每条结论可追溯。固定字段：

- 问题证据（定位到的代码/配置/日志/Trace/DOM/截图/网络记录位置）。
- 分类（代码缺陷 / 配置错误 / 版本兼容 / 页面行为变化 / 外部限制 / 未知项；含置信度：高/中/低/不确定）。
- 根因或待验证假设（区分事实、证据、推断、待确认项）。
- 影响范围（受影响的页面、元素、数据、资源）。
- 修复方向（可验证且合规的修复建议，指向匹配版本资料）。
- 浏览器层测试建议（能稳定暴露问题的失败案例思路）。
- 交接对象（根因和方向获批后 → `crawler-writing-plans-bridge`）。

记录必须明确区分：事实、证据、推断、待确认项与用户批准状态。

## 9. 交接契约

- 遵守主决策日志第 33-36 节：可落盘结构化记录＋简短人类摘要；双层存储（小型记录项目内保存、大型证据以内容哈希和相对路径引用）；敏感信息落盘前脱敏。
- 根因和方向获批后，诊断结论交接给 `crawler-writing-plans-bridge` 作为规划输入，不取代其规划职责。
- 诊断结论明确区分事实、证据、推断、待确认项与用户批准状态。

## 10. 文件结构

```text
skills/crawler-automate-browsers/
  SKILL.md                              # 精简触发＋门禁＋路由＋输出＋禁止项
  references/
    diagnostic-workflow.md              # 诊断流程、问题分类规则、证据卡映射
    output-contract.md                  # 输出契约、交接契约、修订保留
docs/superpowers/knowledge/
  evidence-cards/
    browser-automation.md               # 共享证据卡（以 w3c/webdriver 规范为主）
  skill-views/
    crawler-automate-browsers.md        # Skill 7 独立知识视图（引用证据卡）
tests/skills/crawler-automate-browsers/
  cases.md                              # 行为/安全案例（RED/GREEN 用）
  results.md                            # 红/绿行为评估记录
```

不引入 `validate.ps1`：诊断报告依赖动态项目证据与判断，机械结构校验价值有限，按最小充分原则（主决策日志 §107 先例）以行为案例验证为主。

## 11. 验证设计

### 11.1 结构验证

静态检查：
- Skill 包文件齐全（SKILL.md、diagnostic-workflow.md、output-contract.md）。
- 共享证据卡 `browser-automation.md` 与知识视图 `crawler-automate-browsers.md` 存在；知识视图引用证据卡。
- 诊断流程与问题分类规则在 references 中明确定义。
- 无 `TBD`、`TODO`、`FIXME` 占位符。
- 无肯定式运行指令；仅有负面安全声明与诊断流程描述。
- 不含敏感信息示例（密钥、Cookie、认证头）。
- 非 Git 边界：项目根目录不是 Git worktree；不初始化 Git。

### 11.2 行为验证（RED/GREEN）

按 `superpowers:writing-skills` 方法运行固定行为案例，每个案例使用全新隔离的 Agent 上下文：

- 按诊断聚焦点聚焦：只诊断触发问题对应的聚焦点，不无边界扩展。
- 问题分类正确：代码缺陷 / 配置错误 / 版本兼容 / 页面行为变化 / 外部限制 / 未知项。
- 证据不足不判根因：证据不足时只提出最小补充取证，不把未知项误判为已定位根因。
- 不承担生产渲染：拒绝承担项目的生产页面抓取和渲染。
- 不默认固定长等待/networkidle：不把固定长等待或 `networkidle` 当作通用完成条件。
- 不越过批准边界：根因和方向获批前不交给 `crawler-writing-plans-bridge`。
- 敏感信息脱敏：诊断记录不含密钥/Cookie/认证头。

### 11.3 验收标准（对应主决策日志 §50）

- 能从固定案例或项目证据中发现错误的浏览器升级、等待失效、上下文泄漏、资源拦截错误、公开请求观察错误和资源异常。
- 引用匹配版本的依据。
- 提出可验证且合规的修复方向。

达到上述标准即视为本 Skill 当前细节设计充分，不再扩展低优先级内部设计。

## 12. 阶段门

本规格经用户审阅批准后，才可调用 `superpowers:writing-plans` 生成 `crawler-automate-browsers` 的单 Skill 实施计划。用户未明确批准前，不进入 `writing-plans`，不实施本 Skill，不开始第 8 个 Skill。

`E:\Stellaris` 当前不是 Git 仓库。本设计只要求把文档可靠保存在本地项目中，不得为了满足提交步骤擅自初始化 Git。
