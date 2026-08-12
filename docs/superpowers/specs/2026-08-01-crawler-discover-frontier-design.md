# crawler-discover-frontier Skill 设计规格

日期：2026-08-01  
状态：书面规格待用户审阅  
适用范围：第 5 个独立 Agent Skill `crawler-discover-frontier` 的完整设计

## 1. 目标与边界

`crawler-discover-frontier` 是爬虫知识资料库爬虫流水线方向下的 Agent URL 发现与 Frontier 诊断、设计专家。其职责是：依托固定版本资料，帮助 Agent 检查项目中的种子来源与入口遗漏、站内导航/Sitemap/公开搜索线索、URL 身份/规范化/去重、抓取范围/优先级/预算/停止条件、无限分页/参数组合/重复路径等爬虫陷阱，输出可追溯的问题证据、根因或待验证假设、影响范围、修复方向和回归测试建议；根因和方向获批后交给 `crawler-writing-plans-bridge`。

本 Skill **不是**项目中的生产 URL 队列或抓取调度器。它不创建、替代或运行项目的生产抓取队列/调度器，不执行过度抓取或无效轰击。

本设计只规划 `crawler-discover-frontier`，不包含第 6 个及后续 Skill 的实施任务；不创建或实施本 Skill 本身（实施由 Claude Code 按后续写作计划执行）。

## 2. 已确认输入

- 主决策日志：`docs/superpowers/brainstorming/2026-07-31-crawler-knowledge-skills-decision-log.md`（已确认决策的最高权威；§48/§51/§111）。
- 统一知识设计规格：`docs/superpowers/specs/2026-07-31-crawler-knowledge-skills-knowledge-design.md`（公共知识契约）。
- 固定源码清单：`third-party/crawler-knowledge-sources/manifest.md`。
- 处理 Stellaris 问题时：`stellaris-crawler-context` 生成的项目上下文包路径。
- 已确认问题证据（`crawler-triage-incidents` 分诊结论，适用时）。
- Frontier 相关代码、配置、依赖版本、日志、URL 样本、复现证据（现场只读核验）。

## 3. 职责与排除项

### 3.1 职责

- 检查项目中的入口发现与 URL Frontier 相关问题：
  - 种子来源与入口遗漏；
  - 站内导航、Sitemap、公开搜索线索和站点模式的使用；
  - URL 身份、规范化与去重；
  - 抓取范围、优先级、预算和停止条件；
  - 无限分页、参数组合、重复路径等爬虫陷阱。
- 结合适用版本资料判断问题属于代码缺陷、配置错误、设计不足、外部条件还是未知项。
- 输出可追溯的问题证据、根因或待验证假设、影响范围、修复方向和回归测试建议。

### 3.2 排除项

- 不创建、替代或运行项目的生产抓取队列或调度器。
- 不执行过度抓取或无效轰击；诊断探测限小规模、受控、合规。
- 不负责 HTTP 连接、浏览器渲染或业务字段正确性；相关问题分别交给对应领域 Skill。
- 不绕过登录、验证码、访问控制或 WAF。
- 不把外部条件或未知项伪装成已修复。
- 不生成 `writing-plans`、不提出未经批准的代码修改。
- 不修改爬虫代码、`manifest.md`、第三方仓库；不初始化 Git。
- 不把密钥、Cookie、认证请求头写入诊断记录，落盘前脱敏。

## 4. 触发条件与输入

### 4.1 触发

用户要求检查 URL 发现/Frontier 相关设计或故障，或已经确认的问题涉及入口遗漏、重复抓取、范围越界、优先级错误、抓取预算或无限扩散（爬虫陷阱）时触发（主决策日志 §48）。

### 4.2 最低输入

- 项目上下文（处理 Stellaris 问题时为 `stellaris-crawler-context` 项目上下文包路径）。
- Frontier 相关代码、配置、依赖版本、日志、URL 样本、复现证据。
- 固定版本资料（批次 3：whatwg/url、scrapy、heritrix3、crawler-commons、google/robotstxt）。

## 5. 诊断流程

1. 读取项目上下文（Stellaris 问题先读 `stellaris-crawler-context` 项目上下文包）、目标、约束与已确认问题证据。
2. 确定诊断聚焦点：入口发现 / URL 身份·规范化·去重 / 范围·优先级·预算·停止条件 / 爬虫陷阱。
3. 检查相关代码、配置、依赖版本、日志、URL 样本，定位具体证据位置。
4. 引用匹配版本的证据卡（`url-frontier.md`）比对项目行为与规范/实现/工程证据。
5. 分类：代码缺陷 / 配置错误 / 设计不足 / 外部条件 / 未知项。
6. 证据不足时只提出最小补充取证或受控 URL 探测；根因未证实前不提出代码修改。
7. 输出可追溯问题证据、根因或待验证假设、影响范围、修复方向、回归测试建议。
8. 根因和方向获批后交给 `crawler-writing-plans-bridge`。

## 6. 问题分类规则

- **代码缺陷**：项目代码未按规范/实现证据处理（如 URL 规范化错误、去重 key 不当、优先级计算错误）。
- **配置错误**：配置/参数与固定版本行为不符（如 robots 策略配置、预算参数、停止条件设置错误）。
- **设计不足**：缺乏预算、停止条件、去重策略、优先级机制等设计层面缺失。
- **外部条件**：目标站点拒绝访问、`robots.txt` 禁止、网站结构变化等——只能给合规的降级/等待/终止结论，不得伪装成已修复（主决策日志 §12/§48）。
- **未知项**：证据不足或冲突，保持候选假设，显式标记，不判定为确定根因。

每条结论必须明确区分：事实、证据、综合推断、待确认项。综合推断必须显式标记为"推断"，不得伪装成资料中的确定结论（主决策日志 §14）。

## 7. 证据卡主题分组

共享证据卡 `docs/superpowers/knowledge/evidence-cards/url-frontier.md` 从批次 3 固定资料筛选，按以下主题分组（实施时按实际固定资料筛选具体卡片）：

1. **URL 身份、规范化与百分号编码**：whatwg/url `url.bs`；crawler-commons `BasicURLNormalizer`/`URLUtils`。
2. **入口发现**（种子/站内导航/Sitemap）：scrapy `spiders/crawl.py`、`spiders/sitemap.py`；crawler-commons `sitemaps/SiteMapParser`。
3. **robots.txt 与爬取边界**：google/robotstxt `robots.cc`；crawler-commons `robots/BaseRobotsParser`。
4. **URL 去重与指纹**：scrapy `dupefilters.py`；heritrix3 Frontier 去重机制。
5. **Frontier 调度**（优先级/预算/停止条件/礼貌爬取）：heritrix3 `frontier/WorkQueueFrontier.java`、`AbstractFrontier.java`、`BdbFrontier.java`；scrapy `core/scheduler.py`。
6. **爬虫陷阱**（无限分页/参数组合/重复路径）：结合 heritrix3/scrapy 的预算、去重与停止条件机制。

## 8. 输出契约

诊断记录采用可落盘结构化记录＋简短人类可读摘要（主决策日志 §33 节），每条结论可追溯。固定字段：

- 问题证据（定位到的代码/配置/日志/URL 样本位置）。
- 分类（代码缺陷 / 配置错误 / 设计不足 / 外部条件 / 未知项；含置信度：高/中/低/不确定）。
- 根因或待验证假设（区分事实、证据、推断、待确认项）。
- 影响范围（受影响的抓取范围、数据、吞吐、资源）。
- 修复方向（可验证且不过度抓取的修复建议，指向匹配版本资料）。
- 回归测试建议（能稳定暴露问题的失败案例思路）。
- 交接对象（根因和方向获批后 → `crawler-writing-plans-bridge`）。

记录必须明确区分：事实、证据、推断、待确认项与用户批准状态。

## 9. 交接契约

- 遵守主决策日志第 33-36 节：可落盘结构化记录＋简短人类摘要；双层存储（小型记录项目内保存、大型证据以内容哈希和相对路径引用）；敏感信息落盘前脱敏。
- 根因和方向获批后，诊断结论交接给 `crawler-writing-plans-bridge` 作为规划输入，不取代其规划职责。
- 诊断结论明确区分事实、证据、推断、待确认项与用户批准状态。

## 10. 文件结构

```text
skills/crawler-discover-frontier/
  SKILL.md                              # 精简触发＋门禁＋路由＋输出＋禁止项
  references/
    diagnostic-workflow.md              # 诊断流程、问题分类规则、证据卡映射
    output-contract.md                  # 输出契约、交接契约、修订保留
docs/superpowers/knowledge/
  evidence-cards/
    url-frontier.md                     # 共享证据卡（从批次 3 固定资料筛选）
  skill-views/
    crawler-discover-frontier.md        # Skill 5 独立知识视图（引用证据卡）
tests/skills/crawler-discover-frontier/
  cases.md                              # 行为/安全案例（RED/GREEN 用）
  results.md                            # 红/绿行为评估记录
```

不引入 `validate.ps1`：诊断报告依赖动态项目证据与判断，机械结构校验价值有限，按最小充分原则（主决策日志 §107 先例）以行为案例验证为主。

## 11. 验证设计

### 11.1 结构验证

静态检查：
- Skill 包文件齐全（SKILL.md、diagnostic-workflow.md、output-contract.md）。
- 共享证据卡 `url-frontier.md` 与知识视图 `crawler-discover-frontier.md` 存在；知识视图引用证据卡。
- 诊断流程与问题分类规则在 references 中明确定义。
- 无 `TBD`、`TODO`、`FIXME` 占位符。
- 无肯定式运行指令；仅有负面安全声明与诊断流程描述。
- 不含敏感信息示例（密钥、Cookie、认证头）。
- 非 Git 边界：项目根目录不是 Git worktree；不初始化 Git。

### 11.2 行为验证（RED/GREEN）

按 `superpowers:writing-skills` 方法运行固定行为案例，每个案例使用全新隔离的 Agent 上下文：

- 按诊断聚焦点聚焦：只诊断触发问题对应的聚焦点，不无边界扩展。
- 问题分类正确：代码缺陷 / 配置错误 / 设计不足 / 外部条件 / 未知项。
- 证据不足不判根因：证据不足时只提出最小补充取证，不把未知项误判为已定位根因。
- 不创建生产队列：拒绝创建、替代或运行生产抓取队列/调度器。
- 不越过批准边界：根因和方向获批前不交给 `crawler-writing-plans-bridge`。
- 敏感信息脱敏：诊断记录不含密钥/Cookie/认证头。
- 不无边界扩展：不越权做 HTTP/浏览器/解析诊断。

### 11.3 验收标准（对应主决策日志 §48）

- 能从固定案例或项目证据中发现入口遗漏、重复抓取、范围越界、优先级错误和无限扩散等缺陷。
- 引用匹配版本的依据。
- 提出可验证而不过度抓取的修复方向。

达到上述标准即视为本 Skill 当前细节设计充分，不再扩展低优先级内部设计。

## 12. 阶段门

本规格经用户审阅批准后，才可调用 `superpowers:writing-plans` 生成 `crawler-discover-frontier` 的单 Skill 实施计划。用户未明确批准前，不进入 `writing-plans`，不实施本 Skill，不开始第 6 个 Skill。

`E:\Stellaris` 当前不是 Git 仓库。本设计只要求把文档可靠保存在本地项目中，不得为了满足提交步骤擅自初始化 Git。
