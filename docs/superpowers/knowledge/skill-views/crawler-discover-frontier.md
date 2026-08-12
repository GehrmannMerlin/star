# crawler-discover-frontier 知识视图

> 本视图是 `crawler-discover-frontier` Skill 的独立知识视图，只保留与"URL 发现与 Frontier 诊断、设计"职责相关的知识。来源身份、版本与许可证事实由共享证据层统一维护，本视图通过稳定证据卡 ID 引用，不复制原始来源元数据。

## 定位、触发与排除项

- **定位**：面向 Agent 的 URL 发现与 Frontier 诊断、设计专家；依托固定版本资料帮助 Agent 检查项目的入口发现、URL 身份/规范化/去重、抓取范围/优先级/预算/停止条件与爬虫陷阱。
- **不是**：项目中的生产 URL 队列或抓取调度器；不创建、替代或运行生产抓取队列；不是修复器、规划器、记忆服务、RAG、索引服务、上下文框架或运行组件。
- **触发**：用户要求检查 URL 发现/Frontier 相关设计或故障；已确认问题涉及入口遗漏、重复抓取、范围越界、优先级错误、抓取预算或无限扩散（爬虫陷阱）。
- **排除**：不负责 HTTP 连接、浏览器渲染或业务字段正确性；不绕过登录/验证码/访问控制/WAF；不把外部条件或未知项伪装成已修复；不生成 `writing-plans`。

## 最低证据输入

- 项目上下文（处理 Stellaris 问题时为 `stellaris-crawler-context` 项目上下文包路径）。
- Frontier 相关代码、配置、依赖版本、日志、URL 样本、复现证据。
- 固定版本资料（批次 3：whatwg/url、scrapy、heritrix3、crawler-commons、google/robotstxt）。

## 知识主题与证据卡映射

### 入口发现与入口遗漏

- 判断项目是否正确覆盖种子来源、站内导航、Sitemap 与公开搜索线索；入口遗漏通常表现为"规则未覆盖的链接"或"Sitemap 子索引未跟随"。
- 证据卡：[[UF-ENTRY-001]]（爬取规则与链接跟随语义）、[[UF-ENTRY-002]]（Sitemap 发现与规则）、[[UF-ENTRY-003]]（Sitemap 解析边界）。
- 依据固定版本：scrapy `scrapy/spiders/crawl.py`、`scrapy/spiders/sitemap.py`；crawler-commons `sitemaps/SiteMapParser.java`。

### URL 身份、规范化与去重

- 判断 URL 身份是否唯一、规范化规则是否覆盖百分号编码/主机名/默认端口/fragment/路径斜杠；去重 key 是否覆盖 URL 变体。
- 证据卡：[[UF-URL-001]]（percent-encoding 与规范化顺序）、[[UF-URL-002]]（URLNormalizer 规则集）、[[UF-URL-003]]（URL 解析与非法字符）、[[UF-DEDUP-001]]（请求指纹与去重）、[[UF-DEDUP-002]]（去重集合与内存增长）。
- 依据固定版本：crawler-commons `BasicURLNormalizer.java`、`URLUtils.java`；scrapy `dupefilters.py`；whatwg/url `url.bs`（解析语义规范依据）。

### 抓取范围、优先级、预算与停止条件

- 判断抓取范围是否越界、优先级是否正确、预算与停止条件是否缺失或失效；无预算/停止条件时范围会无限扩展。
- 证据卡：[[UF-SCHED-001]]（请求优先级语义）、[[UF-SCHED-002]]（礼貌爬取与去重闸门）、[[UF-SCHED-003]]（去重后调度唯一性）。
- 依据固定版本：scrapy `core/scheduler.py`；heritrix3 `frontier/WorkQueueFrontier.java`、`AbstractFrontier.java`。

### robots.txt 与爬取边界

- 判断 robots 策略配置与解析是否符合协议与固定版本实现；站点拒绝/robots 禁止属于外部条件，只给合规结论。
- 证据卡：[[UF-ROBOTS-001]]（robots 匹配与优先级规则）、[[UF-ROBOTS-002]]（爬虫公共库 robots 解析边界）。
- 依据固定版本：google/robotstxt `robots.cc`、`protocol-draft/draft-illyes-repext-00.xml`；crawler-commons `robots/BaseRobotsParser.java`。

### 爬虫陷阱（无限分页/参数组合/重复路径）

- 判断是否存在无限分页、无界参数组合、重复路径陷阱；规范化与去重只消除"同 URL"重复，不消除"无限新 URL"。
- 证据卡：[[UF-TRAP-001]]（无限分页与无界参数）、[[UF-TRAP-002]]（重复路径与陷阱规避）。
- 依据固定版本：scrapy 调度/去重实现；heritrix3 唯一化调度。

## 版本化判断规则

- 每条判断依据必须追溯到固定版本资料（ref＋Commit）、证据卡、上下文包条目或决策日志节号；只给仓库首页或没有版本的引用不满足要求。
- 明确区分事实、证据、综合推断与未知项；综合推断必须显式标记"推断"，不得伪装成资料中的确定结论。
- 不得因新技术更新默认要求升级；是否升级以证据和项目约束为准。
- 不同版本行为分别保存，禁止把新版本结论回填到旧版本卡片。

## 常见故障模式

| 故障模式 | 证据卡 | 典型根因方向 |
|---|---|---|
| 入口遗漏（首页仅覆盖） | [[UF-ENTRY-001]]、[[UF-ENTRY-002]] | 规则未覆盖链接、Sitemap 子索引未跟随、follow 未开启 |
| 同一页面多 URL 重复抓取 | [[UF-URL-002]]、[[UF-DEDUP-001]]、[[UF-TRAP-002]] | 规范化未覆盖 query 变体、去重 key 未标准化 |
| 抓取范围无限扩大 | [[UF-TRAP-001]]、[[UF-SCHED-003]] | 无预算/停止条件、参数无界、去重不构成停止条件 |
| 优先级错误/队列顺序异常 | [[UF-SCHED-001]] | 优先级配置错误、队列实现配置问题 |
| 请求被静默丢弃 | [[UF-SCHED-002]] | 去重器误拒、调度器返回 False 未处理 |
| 站点拒绝/robots 禁止 | [[UF-ROBOTS-001]]、[[UF-ROBOTS-002]] | 外部条件，只能合规降级/等待/终止 |
| 大范围内存增长 | [[UF-DEDUP-002]] | 内存型去重集合线性增长、缺磁盘/持久化去重 |
| URL 被解析为 malformed 丢弃 | [[UF-URL-003]] | 解析失败未处理、非法字符未转义 |

## 证据不足与冲突处理

- 证据不足时不得把结论判定为确定根因；保持候选假设并标记未知项，只提出最小补充取证或受控 URL 探测。
- 现场证据、项目上下文、已批准要求冲突时并列报告，不静默覆盖任一来源。
- 未解决的声明标记为不确定（非确定性），不得伪装成确定结论。
- 固定版本证据卡与既有诊断记录不得被静默改写；更新只通过新增修订进行。
- 外部条件（站点拒绝/robots 禁止/结构变化）只能给合规降级/等待/终止结论，不得伪装成已修复。

## 输出与交接

- 输出可追溯诊断记录：问题证据、分类（代码缺陷/配置错误/设计不足/外部条件/未知项，含置信度）、根因或待验证假设、影响范围、修复方向、回归测试建议。
- 根因和方向获批后，交接给 `crawler-writing-plans-bridge` 作为规划输入；用户未批准前不交接。
- 交接遵守主决策日志 §33-36：可落盘结构化记录＋简短摘要；双层存储；敏感信息落盘前脱敏。
- 处理 Stellaris 问题时，先读取 `stellaris-crawler-context` 项目上下文包路径。

## 排除项与禁止

- 不创建、替代或运行项目的生产抓取队列/调度器。
- 不执行过度抓取或无效轰击；诊断探测限小规模、受控、合规。
- 不绕过登录、验证码、访问控制或 WAF。
- 不修改爬虫代码、`manifest.md`、第三方仓库；不初始化 Git。
- 不把密钥、Cookie、认证请求头写入诊断记录。

## 视图自检

- 本视图引用的全部证据卡 ID 必须存在于 `docs/superpowers/knowledge/evidence-cards/url-frontier.md`。
- 引用计数：UF-URL 3、UF-ENTRY 3、UF-ROBOTS 2、UF-DEDUP 2、UF-SCHED 3、UF-TRAP 2，共 15。
- 无未标注"推断"的综合推断；无把案例/Playbook 升格为规范的表述。
