# crawler-validate-extraction Skill 设计规格

日期：2026-08-01  
状态：书面规格待用户审阅  
适用范围：第 8 个独立 Agent Skill `crawler-validate-extraction` 的完整设计

## 1. 目标与边界

`crawler-validate-extraction` 是爬虫知识资料库爬虫流水线方向下的 Agent 解析与数据质量诊断、修复顾问。其职责是：依托固定版本资料，帮助 Agent 检查项目中的 HTML、DOM、JSON、结构化数据、文本编码、Selector、字段映射和数据校验逻辑，发现字段缺失、错位、过期、冲突、乱码以及"程序成功但数据错误"等问题，输出可追溯的问题证据、根因或待验证假设、影响范围、修复方向和回归样例；根因和方向获批后交给 `crawler-writing-plans-bridge`。

本 Skill **不是**项目中的生产解析器。它不承担项目的生产解析功能，不负责联网抓取或浏览器渲染。

本设计只规划 `crawler-validate-extraction`，不包含第 9 个及后续 Skill 的实施任务；不创建或实施本 Skill 本身（实施由 Claude Code 按后续写作计划执行）。

## 2. 已确认输入

- 主决策日志：`docs/superpowers/brainstorming/2026-07-31-crawler-knowledge-skills-decision-log.md`（已确认决策的最高权威；§53/§51/§123）。
- 统一知识设计规格：`docs/superpowers/specs/2026-07-31-crawler-knowledge-skills-knowledge-design.md`（公共知识契约）。
- 固定源码清单：`third-party/crawler-knowledge-sources/manifest.md`。
- 处理 Stellaris 问题时：`stellaris-crawler-context` 生成的项目上下文包路径。
- 已确认问题证据（`crawler-triage-incidents` 分诊结论，适用时）。
- 解析代码、配置、依赖版本、原始页面证据、抽取结果、金标预期、复现证据（现场只读核验）。

## 3. 职责与排除项

### 3.1 职责

- 检查项目中的解析与数据质量相关问题：
  - HTML、DOM、JSON、结构化数据、文本编码；
  - Selector、字段映射；
  - 数据校验逻辑。
- 发现字段缺失、错位、过期、冲突、乱码以及"程序成功但数据错误"等问题。
- 结合适用版本资料判断问题属于代码缺陷、配置错误、版本兼容、页面行为变化、外部条件还是未知项。
- 输出可追溯的问题证据、根因或待验证假设、影响范围、修复方向和回归样例。

### 3.2 排除项

- 不承担项目的生产解析器功能。
- 不负责联网抓取或浏览器渲染（分别交给对应领域 Skill）。
- 具体 TypeScript、Crawlee 等框架 API 与版本问题交给对应重点技术栈 Skill；证据存储完整性交给 `crawler-manage-evidence-storage`。
- 不绕过登录、验证码、访问控制或 WAF。
- 不把外部条件或未知项伪装成已修复。
- 不使用默认值或猜测掩盖字段缺失与冲突。
- 不生成 `writing-plans`、不提出未经批准的代码修改。
- 不修改爬虫代码、`manifest.md`、第三方仓库；不初始化 Git。
- 不把密钥、Cookie、认证请求头写入诊断记录，落盘前脱敏。

## 4. 触发条件与输入

### 4.1 触发

用户要求检查解析与数据质量相关设计或故障，或已经确认的问题涉及字段缺失、错位、过期、冲突、乱码或"程序成功但数据错误"时触发（主决策日志 §53）。

### 4.2 最低输入

- 项目上下文（处理 Stellaris 问题时为 `stellaris-crawler-context` 项目上下文包路径）。
- 解析代码、配置、依赖版本、原始页面证据、抽取结果、金标预期、复现证据。
- 固定版本资料（批次 3：jsoup、mozilla/readability、whatwg/url）。

## 5. 诊断流程

1. 读取项目上下文（Stellaris 问题先读 `stellaris-crawler-context` 项目上下文包）、目标、约束与已确认问题证据。
2. 确定诊断聚焦点：HTML/DOM 解析 / JSON·结构化数据 / 文本编码 / Selector·字段映射 / 数据校验·数据质量。
3. 检查相关代码、配置、依赖版本、原始页面证据、抽取结果、金标预期，定位具体证据位置。
4. 引用匹配版本的证据卡（`extraction-quality.md`）比对项目行为与规范/实现/工程证据。
5. 分类：代码缺陷 / 配置错误 / 版本兼容 / 页面行为变化 / 外部条件 / 未知项。
6. 证据不足时只提出最小补充取证或离线回放；根因未证实前不提出代码修改。
7. 输出可追溯问题证据、根因或待验证假设、影响范围、修复方向、回归样例。
8. 根因和方向获批后交给 `crawler-writing-plans-bridge`。

## 6. 问题分类规则

- **代码缺陷**：解析/抽取代码未按规范/实现证据处理（如 Selector 错误、字段映射错位、编码处理缺失）。
- **配置错误**：解析配置/参数与固定版本行为不符（如编码声明、解析器设置错误）。
- **版本兼容**：依赖版本与 API 行为不匹配（如 jsoup/readability 版本差异导致解析行为变化）。
- **页面行为变化**：目标站点 DOM/结构/JSON 结构变化导致字段错位、Select 失效——需重新取证而非盲改代码。
- **外部条件**：目标站点拒绝、访问限制、页面结构特殊等——只能给合规降级/等待/终止结论，不得伪装成已修复（主决策日志 §12/§53）。
- **未知项**：证据不足或冲突，保持候选假设，显式标记，不判定为确定根因。

每条结论必须明确区分：事实、证据、综合推断、待确认项。综合推断必须显式标记为"推断"，不得伪装成资料中的确定结论（主决策日志 §14）。

**隐蔽数据错误重点**：本 Skill 特别要识别"程序成功但数据错误"——程序不报错但字段缺失、错位、乱码、过期、冲突，需结合金标预期与离线回放验证；不得用默认值或猜测掩盖。

## 7. 证据卡主题分组

共享证据卡 `docs/superpowers/knowledge/evidence-cards/extraction-quality.md` 从批次 3 固定资料筛选，按以下主题分组（实施时按实际固定资料筛选具体卡片）：

1. **HTML/DOM 解析**：jsoup `org/jsoup/parser`、`org/jsoup/nodes`；mozilla/readability `Readability.js`、`JSDOMParser.js`。
2. **JSON/结构化数据**：jsoup `helper`；whatwg/url `url.bs`（URL 规范化）。
3. **文本编码**：jsoup `helper`（编码处理）；whatwg/url（百分号编码）。
4. **Selector/字段映射**：jsoup `org/jsoup/select`（CSS 选择器）；mozilla/readability（正文提取算法）。
5. **数据校验/数据质量**：jsoup `safety`（安全清洗）；mozilla/readability（可读性评分/内容判定）。

## 8. 输出契约

诊断记录采用可落盘结构化记录＋简短人类可读摘要（主决策日志 §33 节），每条结论可追溯。固定字段：

- 问题证据（定位到的代码/配置/原始页面证据/抽取结果/金标预期位置）。
- 分类（代码缺陷 / 配置错误 / 版本兼容 / 页面行为变化 / 外部条件 / 未知项；含置信度：高/中/低/不确定）。
- 根因或待验证假设（区分事实、证据、推断、待确认项）。
- 影响范围（受影响的字段、记录、数据、下游消费）。
- 修复方向（可验证的修复建议，指向匹配版本资料；避免用默认值或猜测掩盖缺失与冲突）。
- 回归样例（能稳定暴露问题的失败案例/金标样例思路）。
- 交接对象（根因和方向获批后 → `crawler-writing-plans-bridge`）。

记录必须明确区分：事实、证据、推断、待确认项与用户批准状态。

## 9. 交接契约

- 遵守主决策日志第 33-36 节：可落盘结构化记录＋简短人类摘要；双层存储（小型记录项目内保存、大型证据以内容哈希和相对路径引用）；敏感信息落盘前脱敏。
- 根因和方向获批后，诊断结论交接给 `crawler-writing-plans-bridge` 作为规划输入，不取代其规划职责。
- 诊断结论明确区分事实、证据、推断、待确认项与用户批准状态。

## 10. 文件结构

```text
skills/crawler-validate-extraction/
  SKILL.md                              # 精简触发＋门禁＋路由＋输出＋禁止项
  references/
    diagnostic-workflow.md              # 诊断流程、问题分类规则、证据卡映射
    output-contract.md                  # 输出契约、交接契约、修订保留
docs/superpowers/knowledge/
  evidence-cards/
    extraction-quality.md               # 共享证据卡（从批次 3 固定资料筛选）
  skill-views/
    crawler-validate-extraction.md      # Skill 8 独立知识视图（引用证据卡）
tests/skills/crawler-validate-extraction/
  cases.md                              # 行为/安全案例（RED/GREEN 用）
  results.md                            # 红/绿行为评估记录
```

不引入 `validate.ps1`：诊断报告依赖动态项目证据与判断，机械结构校验价值有限，按最小充分原则（主决策日志 §107 先例）以行为案例验证为主。

## 11. 验证设计

### 11.1 结构验证

静态检查：
- Skill 包文件齐全（SKILL.md、diagnostic-workflow.md、output-contract.md）。
- 共享证据卡 `extraction-quality.md` 与知识视图 `crawler-validate-extraction.md` 存在；知识视图引用证据卡。
- 诊断流程与问题分类规则在 references 中明确定义。
- 无 `TBD`、`TODO`、`FIXME` 占位符。
- 无肯定式运行指令；仅有负面安全声明与诊断流程描述。
- 不含敏感信息示例（密钥、Cookie、认证头）。
- 非 Git 边界：项目根目录不是 Git worktree；不初始化 Git。

### 11.2 行为验证（RED/GREEN）

按 `superpowers:writing-skills` 方法运行固定行为案例，每个案例使用全新隔离的 Agent 上下文：

- 按诊断聚焦点聚焦：只诊断触发问题对应的聚焦点，不无边界扩展。
- 问题分类正确：代码缺陷 / 配置错误 / 版本兼容 / 页面行为变化 / 外部条件 / 未知项。
- 识别隐蔽数据错误：能发现字段缺失/错位/过期/冲突/乱码，不用默认值或猜测掩盖。
- 证据不足不判根因：证据不足时只提出最小补充取证，不把未知项误判为已定位根因。
- 不承担生产解析：拒绝承担项目的生产解析器功能。
- 不越过批准边界：根因和方向获批前不交给 `crawler-writing-plans-bridge`。
- 敏感信息脱敏：诊断记录不含密钥/Cookie/认证头。

### 11.3 验收标准（对应主决策日志 §53）

- 能识别隐蔽的数据错误（字段缺失/错位/过期/冲突/乱码）。
- 引用匹配版本的依据。
- 避免使用默认值或猜测掩盖缺失与冲突。

达到上述标准即视为本 Skill 当前细节设计充分，不再扩展低优先级内部设计。

## 12. 阶段门

本规格经用户审阅批准后，才可调用 `superpowers:writing-plans` 生成 `crawler-validate-extraction` 的单 Skill 实施计划。用户未明确批准前，不进入 `writing-plans`，不实施本 Skill，不开始第 9 个 Skill。

`E:\Stellaris` 当前不是 Git 仓库。本设计只要求把文档可靠保存在本地项目中，不得为了满足提交步骤擅自初始化 Git。
