# URL 与 Frontier 证据卡（共享证据层）

> 本文件是共享可追溯证据层中与 URL 发现与 Frontier 相关的证据卡集合。每张卡表达一条可验证知识声明，绑定固定版本资料、原始位置与适用边界。
>
> 来源：批次 3 固定源码快照，全部以 `third-party/crawler-knowledge-sources/manifest.md` 记录的 ref 与 Commit 为唯一版本基线。
>
> 证据等级：规范证据（官方规范/文档/Release）＞实现证据（同版本官方源码/测试）＞工程证据（官方运行指南/手册）＞案例证据（事故资料，只用于启发）。
>
> 维护规则：本文件由资料治理 Skill 按既定准入、许可证复核与版本固定流程维护；不得静默改写已固定证据卡，更新只通过新增修订进行。

## 来源身份与版本基线

| 仓库 | 权威 ref | Commit | 本地路径 |
|---|---|---|---|
| whatwg/url | `main` | `9dc3827fc722ac4af3f11061aa3e9adb44a17c8b` | `third-party/crawler-knowledge-sources/repos/batch-03-crawler-pipeline/url` |
| scrapy/scrapy | `2.17.0` | `feb692f552e3ed4533cf4e3af4809908d84cd763` | `third-party/crawler-knowledge-sources/repos/batch-03-crawler-pipeline/scrapy` |
| internetarchive/heritrix3 | `3.16.0` | `7af0bf56eaf1df032050f387d5650d6d80cc1b44` | `third-party/crawler-knowledge-sources/repos/batch-03-crawler-pipeline/heritrix3` |
| crawler-commons/crawler-commons | `crawler-commons-1.6` | `ce0fcb3e26dd653af93434a4cd64b1be4f7bce01` | `third-party/crawler-knowledge-sources/repos/batch-03-crawler-pipeline/crawler-commons` |
| google/robotstxt | `v1.0.0` | `a7a82530abedfda75f6a81396666700fc11e89fd` | `third-party/crawler-knowledge-sources/repos/batch-03-crawler-pipeline/robotstxt` |

---

## URL 身份、规范化与百分号编码

### UF-URL-001 percent-encoding 与规范化

- **知识声明**：URL 规范化在百分号编码与非法字符转义之后进行，且 fragment（`#...`）在转义前先被移除，以免 `#` 被错误转义。
- **证据类型/等级**：实现证据。
- **来源身份**：crawler-commons/crawler-commons（`crawler-commons-1.6`）。
- **版本/ref/Commit**：`crawler-commons-1.6`；`ce0fcb3e26dd653af93434a4cd64b1be4f7bce01`。
- **原始位置**：`src/main/java/crawlercommons/filters/basic/BasicURLNormalizer.java`，`filter(String)` 方法（约 174-260 行）。
- **支持说明**：`filter` 先 `trim()`、移除 fragment、`escapePath()` 转义非法字符，再 `parseStringToURL`。
- **适用条件**：用于判断 URL 规范化实现是否遗漏转义顺序或 fragment 处理。
- **限制**：Crawler-Commons 是 Java 实现；其规则顺序不代表所有爬虫框架，判断须结合项目实际技术栈的匹配版本资料。
- **关联 Skill**：crawler-discover-frontier。
- **状态**：有效。

### UF-URL-002 URLNormalizer 规则集

- **知识声明**：`BasicURLNormalizer` 提供可组合的规范化规则：主机名转小写、去除默认端口、空路径补 `/`、移除 ref、路径百分号编码，并支持按 Builder 开关配置。
- **证据类型/等级**：实现证据。
- **来源身份**：crawler-commons/crawler-commons（`crawler-commons-1.6`）。
- **版本/ref/Commit**：`crawler-commons-1.6`；`ce0fcb3e26dd653af93434a4cd64b1be4f7bce01`。
- **原始位置**：`src/main/java/crawlercommons/filters/basic/BasicURLNormalizer.java`（`filter` 方法、`normalizeHostName`、Builder）。
- **支持说明**：`filter` 对 http/https/ftp 分支做主机名小写、默认端口去除（`port == url.getDefaultPort()` 时置 -1）、空文件补 `/`、移除 ref；Builder 提供规则开关。
- **适用条件**：诊断重复抓取或 URL 身份不一致时核对规范化规则是否启用。
- **限制**：默认开关因版本与 Builder 配置而异；不得把某一默认值当作跨版本通用规则。
- **关联 Skill**：crawler-discover-frontier。
- **状态**：有效。

### UF-URL-003 URL 解析与非法字符处理

- **知识声明**：规范化前必须先把 URL 解析为协议/主机/端口/路径组件；解析失败（malformed URL）时返回 `null`，调用方须处理。
- **证据类型/等级**：实现证据。
- **来源身份**：crawler-commons/crawler-commons（`crawler-commons-1.6`）。
- **版本/ref/Commit**：`crawler-commons-1.6`；`ce0fcb3e26dd653af93434a4cd64b1be4f7bce01`。
- **原始位置**：`src/main/java/crawlercommons/filters/basic/BasicURLNormalizer.java`（`parseStringToURL`、`filter` 的 null 检查）。
- **支持说明**：`filter` 中 `URL url = parseStringToURL(urlString); if (url == null) return null;`，并 `LOG.debug("Malformed URL {}")`。
- **适用条件**：诊断 URL 样本被丢弃/无效的根因。
- **限制**：不同实现解析容错不同；WHATWG URL 规范（`url.bs`）是解析语义的权威依据，本卡是 Java 实现证据。
- **关联 Skill**：crawler-discover-frontier。
- **状态**：有效。

---

## 入口发现（种子／站内导航／Sitemap）

### UF-ENTRY-001 爬取规则与链接跟随语义

- **知识声明**：CrawlSpider 的 `Rule` 组合链接提取器与回调，决定哪些链接被跟随、由哪个回调处理；`_parse_response` 执行链接提取与跟随。
- **证据类型/等级**：实现证据。
- **来源身份**：scrapy/scrapy（`2.17.0`）。
- **版本/ref/Commit**：`2.17.0`；`feb692f552e3ed4533cf4e3af4809908d84cd763`。
- **原始位置**：`scrapy/spiders/crawl.py`（`Rule` 类、`CrawlSpider._parse_response`）。
- **支持说明**：`Rule` 类定义 `link_extractor`、`callback`、`follow`；`CrawlSpider._callback` 与 `_parse_response` 实现链接提取与跟随。
- **适用条件**：诊断入口遗漏（规则未覆盖的链接、回调未处理、follow 未开启）时比对。
- **限制**：规则匹配与链接提取器行为与版本相关；不得假设所有爬虫框架采用相同规则模型。
- **关联 Skill**：crawler-discover-frontier。
- **状态**：有效。

### UF-ENTRY-002 Sitemap 发现与规则

- **知识声明**：`SitemapSpider` 从 `sitemap_urls` 启动，用 `sitemap_rules` 匹配 URL 到回调，用 `sitemap_follow` 决定跟随哪些 sitemap 子索引，并支持 `sitemap_alternate_links` 与 `sitemap_filter`。
- **证据类型/等级**：实现证据。
- **来源身份**：scrapy/scrapy（`2.17.0`）。
- **版本/ref/Commit**：`2.17.0`；`feb692f552e3ed4533cf4e3af4809908d84cd763`。
- **原始位置**：`scrapy/spiders/sitemap.py`（`SitemapSpider`，26-115 行）。
- **支持说明**：`start` 对 `sitemap_urls` 逐项请求；`_parse_sitemap` 区分 robots.txt 提取 sitemap、`sitemapindex` 递归、`urlset` 匹配规则；`_get_urls_from_sitemapindex` 用 `_follow` 过滤。
- **适用条件**：诊断 Sitemap 入口遗漏（sitemap_follow 未覆盖子索引、rules 未匹配）时比对。
- **限制**：`sitemap_rules` 默认 `[("", "parse")]` 与 `sitemap_follow` 默认 `[""]` 是本版本默认；覆盖范围须与项目实际配置核对。
- **关联 Skill**：crawler-discover-frontier。
- **状态**：有效。

### UF-ENTRY-003 Sitemap 解析边界

- **知识声明**：Crawler-Commons `SiteMapParser` 负责解析 sitemap 与 sitemap index；无效 sitemap 会被忽略并告警，解析器对格式有边界与限制。
- **证据类型/等级**：实现证据。
- **来源身份**：crawler-commons/crawler-commons（`crawler-commons-1.6`）。
- **版本/ref/Commit**：`crawler-commons-1.6`；`ce0fcb3e26dd653af93434a4cd64b1be4f7bce01`。
- **原始位置**：`src/main/java/crawlercommons/sitemaps/SiteMapParser.java`、`SiteMapURL.java`。
- **支持说明**：`SiteMapParser` 解析 `<sitemapindex>` 与 `<urlset>`，`SiteMapURL` 表示条目；无效内容按实现边界处理。
- **适用条件**：诊断 sitemap 解析失败或条目缺失时核对解析边界。
- **限制**：Sitemap 协议的具体字段语义以协议规范为主证据；本卡是 Java 解析器实现证据。
- **关联 Skill**：crawler-discover-frontier。
- **状态**：有效。

---

## robots.txt 与爬取边界

### UF-ROBOTS-001 robots.txt 匹配与优先级规则

- **知识声明**：google/robotstxt 解析 `User-agent`、`Allow`、`Disallow` 行并支持常见拼写错误；匹配按路径规则执行，是 robots.txt 协议的参考实现。
- **证据类型/等级**：实现证据。
- **来源身份**：google/robotstxt（`v1.0.0`）。
- **版本/ref/Commit**：`v1.0.0`；`a7a82530abedfda75f6a81396666700fc11e89fd`。
- **原始位置**：`robots.cc`（`ParsedRobotsKey`、`RobotsTxtParser`、`MatchAllow`/`MatchDisallow`）。
- **支持说明**：`ParsedRobotsKey` 识别 USER_AGENT/ALLOW/DISALLOW 并处理可接受拼写错误；`MatchAllow`/`MatchDisallow` 提供路径匹配。
- **适用条件**：诊断 robots.txt 配置或解析行为（Allow/Disallow 优先级、通配匹配）时比对。
- **限制**：robots 协议存在不同解释（`draft-illyes-repext-00.xml` 是协议草案）；本卡是 Google 参考实现行为，优先级语义以协议与实现共同为准。
- **关联 Skill**：crawler-discover-frontier。
- **状态**：有效。

### UF-ROBOTS-002 爬虫公共库 robots 解析边界

- **知识声明**：Crawler-Commons `BaseRobotsParser` 是跨语言爬虫库的 robots 解析基础类，定义解析器接口与行为边界。
- **证据类型/等级**：实现证据。
- **来源身份**：crawler-commons/crawler-commons（`crawler-commons-1.6`）。
- **版本/ref/Commit**：`crawler-commons-1.6`；`ce0fcb3e26dd653af93434a4cd64b1be4f7bce01`。
- **原始位置**：`src/main/java/crawlercommons/robots/BaseRobotsParser.java`。
- **支持说明**：`BaseRobotsParser` 提供 robots 解析的公共结构与行为边界。
- **适用条件**：诊断基于 Crawler-Commons 的项目 robots 处理行为时比对。
- **限制**：不同实现与版本对 robots 的解析与缓存策略不同；判断须结合项目实际锁定版本。
- **关联 Skill**：crawler-discover-frontier。
- **状态**：有效。

---

## URL 去重与指纹

### UF-DEDUP-001 请求指纹与去重

- **知识声明**：Scrapy `RFPDupeFilter` 用请求指纹（fingerprint）字符串标识请求；`request_seen` 对已见指纹返回 `True` 并从内存集合与磁盘文件跟踪。
- **证据类型/等级**：实现证据。
- **来源身份**：scrapy/scrapy（`2.17.0`）。
- **版本/ref/Commit**：`2.17.0`；`feb692f552e3ed4533cf4e3af4809908d84cd763`。
- **原始位置**：`scrapy/dupefilters.py`（`RFPDupeFilter`，53-119 行）。
- **支持说明**：`request_fingerprint` 返回 `self.fingerprinter.fingerprint(request).hex()`；`request_seen` 检查集合、写入 `self.file`。
- **适用条件**：诊断重复抓取或指纹未覆盖查询参数/方法/体时比对。
- **限制**：指纹构造由 `request_fingerprinter` 决定，不同版本与配置会改变指纹内容；不得假设指纹覆盖全部 URL 变体。
- **关联 Skill**：crawler-discover-frontier。
- **状态**：有效。

### UF-DEDUP-002 去重集合与内存增长

- **知识声明**：内存型去重集合随去重请求数线性增长；默认 `RFPDupeFilter` 将指纹存入内存 `set`，大抓取范围下会显著占用内存。
- **证据类型/等级**：实现证据。
- **来源身份**：scrapy/scrapy（`2.17.0`）。
- **版本/ref/Commit**：`2.17.0`；`feb692f552e3ed4533cf4e3af4809908d84cd763`。
- **原始位置**：`scrapy/dupefilters.py`（`self.fingerprints: set[str]`，83 行）。
- **支持说明**：`self.fingerprints.update(x.rstrip() for x in self.file)` 从文件加载，`request_seen` 向集合添加指纹。
- **适用条件**：诊断大抓取范围下内存增长或去重状态持久化行为时比对。
- **限制**：磁盘型/自定义去重器行为不同；本卡只描述默认内存实现。
- **关联 Skill**：crawler-discover-frontier。
- **状态**：有效。

---

## Frontier 调度（优先级／预算／停止条件／礼貌爬取）

### UF-SCHED-001 请求优先级语义

- **知识声明**：Scrapy 调度器按 `Request.priority` 维护优先级队列；同优先级请求按请求顺序处理，内存与磁盘队列策略由配置决定。
- **证据类型/等级**：实现证据。
- **来源身份**：scrapy/scrapy（`2.17.0`）。
- **版本/ref/Commit**：`2.17.0`；`feb692f552e3ed4533cf4e3af4809908d84cd763`。
- **原始位置**：`scrapy/core/scheduler.py`（`Scheduler` 类，127-316 行）。
- **支持说明**：`Requests are stored into priority queues` 按 `Request.priority` 排序；`enqueue_request`/`next_request` 实现入队与取出。
- **适用条件**：诊断优先级配置或队列顺序异常时比对。
- **限制**：优先级语义与队列实现（内存/磁盘）随版本与配置而异。
- **关联 Skill**：crawler-discover-frontier。
- **状态**：有效。

### UF-SCHED-002 礼貌爬取与去重闸门

- **知识声明**：Scrapy 调度器在 `enqueue_request` 被去重器拒绝时返回 `False`，引擎触发 `request_dropped`，不再尝试调度该请求；这是调度入口的礼貌/去重闸门。
- **证据类型/等级**：实现证据。
- **来源身份**：scrapy/scrapy（`2.17.0`）。
- **版本/ref/Commit**：`2.17.0`；`feb692f552e3ed4533cf4e3af4809908d84cd763`。
- **原始位置**：`scrapy/core/scheduler.py`（`BaseScheduler.enqueue_request` 文档，101-113 行）。
- **支持说明**：文档明确返回 `False` 表示请求被去重器拒绝，引擎将不再尝试调度。
- **适用条件**：诊断"请求被静默丢弃/不重试"的调度行为时比对。
- **限制**：礼貌延迟、robots 检查等具体机制在各框架/版本实现不同；本卡描述调度器与去重器的交接语义。
- **关联 Skill**：crawler-discover-frontier。
- **状态**：有效。

### UF-SCHED-003 去重后调度唯一性

- **知识声明**：Heritrix3 `WorkQueueFrontier` 在 `processScheduleIfUnique` 中用规范化后的 URL 作为去重 key，`uriUniqFilter.add` 保证每个 canonical URL 只调度一次（除非强制抓取）。
- **证据类型/等级**：实现证据。
- **来源身份**：internetarchive/heritrix3（`3.16.0`）。
- **版本/ref/Commit**：`3.16.0`；`7af0bf56eaf1df032050f387d5650d6d80cc1b44`。
- **原始位置**：`engine/src/main/java/org/archive/crawler/frontier/WorkQueueFrontier.java`（`processScheduleIfUnique`）。
- **支持说明**：`String canon = curi.getCanonicalString(); if (curi.forceFetch()) uriUniqFilter.addForce(canon, curi); else uriUniqFilter.add(canon, curi);`。
- **适用条件**：诊断重复调度或 canonical 化与去重 key 不一致时比对。
- **限制**：canonical 化规则由 Heritrix3 配置决定；本卡描述"规范化后唯一"的调度语义。
- **关联 Skill**：crawler-discover-frontier。
- **状态**：有效。

---

## 爬虫陷阱（无限分页／参数组合／重复路径）

### UF-TRAP-001 无限分页与无界参数

- **知识声明**：无限分页与无界查询参数组合会在没有预算/停止条件约束时无限扩展抓取范围；规范化与去重只消除"同 URL"重复，不消除"无限新 URL"。
- **证据类型/等级**：工程证据（结合实现证据推导）。
- **来源身份**：scrapy/scrapy（`2.17.0`）与 internetarchive/heritrix3（`3.16.0`）的调度与去重实现。
- **版本/ref/Commit**：`2.17.0`（`feb692f552e3ed4533cf4e3af4809908d84cd763`）；`3.16.0`（`7af0bf56eaf1df032050f387d5650d6d80cc1b44`）。
- **原始位置**：scrapy `core/scheduler.py`（优先级队列入队）；heritrix3 `WorkQueueFrontier`（唯一化调度）。
- **支持说明**：去重基于指纹/canonical URL，参数变体产生不同 key；若参数无界，去重不构成停止条件，范围会持续扩大。
- **适用条件**：诊断"抓取永不结束/范围无限扩大"时判断是否缺乏预算与停止条件。
- **限制**：本卡是工程推断（`推断`），不是单一实现证据；停止条件必须由项目自己的预算/配额机制提供。
- **关联 Skill**：crawler-discover-frontier。
- **状态**：有效。

### UF-TRAP-002 重复路径与陷阱规避

- **知识声明**：规范化（小写主机、去默认端口、去 fragment、路径百分号编码）与去重组合是规避"同一页面多 URL"陷阱的基本手段；规范化缺失会导致同页多 URL 全部入队。
- **证据类型/等级**：工程证据（结合实现证据推导）。
- **来源身份**：crawler-commons `BasicURLNormalizer` 与 scrapy `RFPDupeFilter`。
- **版本/ref/Commit**：`crawler-commons-1.6`（`ce0fcb3e26dd653af93434a4cd64b1be4f7bce01`）；scrapy `2.17.0`（`feb692f552e3ed4533cf4e3af4809908d84cd763`）。
- **原始位置**：`crawler-commons/src/main/java/crawlercommons/filters/basic/BasicURLNormalizer.java`；`scrapy/dupefilters.py`。
- **支持说明**：`filter` 去除 fragment/默认端口/路径补斜杠；`request_seen` 以指纹去重。规范化未覆盖的变体（如未处理 query 顺序）会绕过指纹去重。
- **适用条件**：诊断"同一页面重复抓取/重复入队"时核对规范化与去重是否覆盖 URL 变体。
- **限制**：不同框架的规范化覆盖范围不同；本卡是工程推断，须结合项目实际技术栈的匹配版本资料确认。
- **关联 Skill**：crawler-discover-frontier。
- **状态**：有效。

---

## 汇总

- 证据卡总数：15 张（UF-URL 3、UF-ENTRY 3、UF-ROBOTS 2、UF-DEDUP 2、UF-SCHED 3、UF-TRAP 2）。
- 来源：批次 3 固定仓库 5 个（whatwg/url、scrapy、heritrix3、crawler-commons、google/robotstxt）。
- 引用契约：下游 Skill 视图通过稳定 ID 引用本文件；原始证据通过 manifest 固定 Commit 与相对路径可追溯。
