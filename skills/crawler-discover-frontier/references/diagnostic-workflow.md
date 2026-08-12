# `crawler-discover-frontier` 诊断流程与分类规则

> 本文件定义本 Skill 的诊断流程、问题分类规则与证据卡映射。判断依据与边界以主决策日志与已批准设计规格为准。

## 诊断流程

1. 读取项目上下文、目标、约束与已确认问题证据。处理 Stellaris 问题时，先读取 `stellaris-crawler-context` 生成的项目上下文包路径。
2. 确定诊断聚焦点（入口发现 / URL 身份·规范化·去重 / 范围·优先级·预算·停止条件 / 爬虫陷阱），聚焦该点，不做无边界全栈诊断。
3. 检查相关代码、配置、依赖版本、日志、URL 样本，定位具体证据位置。
4. 引用匹配版本的证据卡（`url-frontier.md`）比对项目行为与规范/实现/工程证据。
5. 分类：代码缺陷 / 配置错误 / 设计不足 / 外部条件 / 未知项。
6. 证据不足时只提出最小补充取证或受控 URL 探测；根因未证实前不提出代码修改。
7. 输出可追溯问题证据、根因或待验证假设、影响范围、修复方向、回归测试建议。
8. 根因和方向获批后，将选定方向交给 `crawler-writing-plans-bridge`。

## 问题分类规则

- **代码缺陷**：项目代码未按规范/实现证据处理（如 URL 规范化错误、去重 key 不当、优先级计算错误）。
- **配置错误**：配置/参数与固定版本行为不符（如 robots 策略配置、预算参数、停止条件设置错误）。
- **设计不足**：缺乏预算、停止条件、去重策略、优先级机制等设计层面缺失。
- **外部条件**：目标站点拒绝访问、`robots.txt` 禁止、网站结构变化等——只能给合规的降级/等待/终止结论，不得伪装成已修复（主决策日志 §12/§48）。
- **未知项**：证据不足或冲突，保持候选假设，显式标记，不判定为确定根因。

每条结论必须明确区分：事实、证据、综合推断、待确认项。综合推断必须显式标记为"推断"，不得伪装成资料中的确定结论（主决策日志 §14）。

置信度使用固定枚举：高（证据充分且指向唯一分类）、中（证据充分但多个分类可能）、低（证据不足或冲突，仅候选假设）、不确定（无法判断）。

## 证据卡映射

共享证据卡：`docs/superpowers/knowledge/evidence-cards/url-frontier.md`；知识视图：`docs/superpowers/knowledge/skill-views/crawler-discover-frontier.md`。

| 诊断聚焦点 | 证据卡 | 固定资料路径 |
|---|---|---|
| 入口发现与入口遗漏 | UF-ENTRY-001、UF-ENTRY-002、UF-ENTRY-003 | scrapy `scrapy/spiders/crawl.py`、`scrapy/spiders/sitemap.py`；crawler-commons `sitemaps/SiteMapParser.java` |
| URL 身份、规范化与去重 | UF-URL-001、UF-URL-002、UF-URL-003、UF-DEDUP-001、UF-DEDUP-002 | whatwg/url `url.bs`；crawler-commons `BasicURLNormalizer.java`、`URLUtils.java`；scrapy `dupefilters.py` |
| 抓取范围、优先级、预算与停止条件 | UF-SCHED-001、UF-SCHED-002、UF-SCHED-003 | scrapy `core/scheduler.py`；heritrix3 `frontier/WorkQueueFrontier.java`、`AbstractFrontier.java` |
| robots.txt 与爬取边界 | UF-ROBOTS-001、UF-ROBOTS-002 | google/robotstxt `robots.cc`、`protocol-draft/draft-illyes-repext-00.xml`；crawler-commons `robots/BaseRobotsParser.java` |
| 爬虫陷阱（无限分页/参数组合/重复路径） | UF-TRAP-001、UF-TRAP-002 | scrapy 调度/去重实现；heritrix3 唯一化调度 |

每条依据必须可追溯：从诊断记录追到固定版本资料、证据卡、上下文包条目或决策日志节号。只给仓库首页、模糊文件夹或没有版本的引用不满足要求。

## 受控 URL 探测边界

- 诊断确有必要时，可以指导 Agent 执行小规模、受控且合规的 URL 探测用于验证假设。
- 探测不得创建、替代或运行项目的生产抓取队列/调度器；不得执行过度抓取或无效轰击。
- 探测必须遵守 `robots.txt`、访问控制与合规边界；不得绕过登录、验证码、访问控制或 WAF。

## 证据不足与冲突

- 证据不足时不得把结论判定为确定根因；保留候选状态并标记未知项。
- 现场证据、项目上下文、已批准要求冲突时并列报告，不静默覆盖任一来源。
- 未解决的声明标记为不确定（非确定性），不得伪装成确定结论。
- 固定版本证据卡与既有诊断记录不得被静默改写；更新只通过新增修订进行。
- 外部条件（站点拒绝/robots 禁止/结构变化）只能给合规降级/等待/终止结论，不得伪装成已修复。
- 不得因新技术更新默认要求升级；是否升级以证据和项目约束为准。
