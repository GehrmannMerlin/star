# 爬虫知识资料库首遍资料审查——第 3 批：爬虫流水线

> 审查日期：2026-07-31
>
> 对应一级方向：爬虫流水线
>
> 对应 Skills：`crawler-discover-frontier`、`crawler-debug-http-network`、`crawler-automate-browsers`、`crawler-validate-extraction`、`crawler-tune-queues`
>
> 状态：等待用户核对
>
> 边界：本文记录联网审查得到的当前事实与 Agent 建议，不是已确认决策。未下载、克隆或执行任何第三方源码，也未设计或实施 Skill，未修改爬虫代码。

## 1. 审查口径

- 本批只收集跨框架的 URL 身份与发现、礼貌抓取、HTTP／TLS 诊断、浏览器协议与生命周期、解析正确性、队列／背压和性能验证知识。
- TypeScript、Node.js、Crawlee、Playwright、Docker 和 PostgreSQL 的项目版本及具体 API 留给后续重点技术栈批次；本批资料不得覆盖那些版本化实现依据。
- `crawler-discover-frontier`、`crawler-debug-http-network` 和 `crawler-automate-browsers` 仍是面向 Agent 的诊断、评审和修复辅助能力，不是生产 Frontier、HTTP 客户端或浏览器运行组件。
- Star、最后推送时间、最新 Release 和 GitHub `size` 字段均为 2026-07-31 的观察值，后续会变化。
- “预计体积”使用 GitHub `size` 字段换算，只是完整仓库体积风险代理，不等于第二遍固定 Commit 后的实际浅克隆大小。
- “准入”表示 Agent 建议允许进入第二遍资格范围；只有用户核对本报告且全部第一遍批次完成后，才可固定 Commit 并浅克隆。
- “候选”只保留元数据；“拒绝”记录排除理由。两者均不得下载，也不得作为 Skill 修复依据。
- 即使源码获准进入第二遍，仍只允许作为只读知识依据；不得安装依赖、构建、运行 Hook、容器、爬虫、浏览器、压测或示例程序。

## 2. Agent 建议：准入的权威在线资料（未确认）

这些资料无需 Git 克隆；如果第二遍需要本地快照，仍须单独核对版本、许可和保存方式。

| 来源 | 官方性与适用版本 | 用途 | 对应 Skill | 使用边界 |
|---|---|---|---|---|
| [RFC 9309：Robots Exclusion Protocol](https://www.rfc-editor.org/info/rfc9309/) | IETF／RFC Editor 官方；2022 Proposed Standard | `robots.txt` 分组、最长匹配、编码、重定向、不可达状态、缓存和最小解析限制 | `crawler-discover-frontier` | REP 是站点表达的抓取偏好，不是访问授权；不得把 Allow 当成越权许可 |
| [WHATWG URL Living Standard](https://url.spec.whatwg.org/) 与 [RFC 3986](https://www.rfc-editor.org/info/rfc3986/) | WHATWG 与 IETF 官方；Living Standard 及 STD 66 | URL 解析、相对解析、规范化、百分号编码、等价与身份边界 | `crawler-discover-frontier`、`crawler-debug-http-network` | 不得用激进规范化合并语义不同的 URL；实际项目行为还须与锁定运行时核对 |
| [Sitemaps protocol](https://www.sitemaps.org/protocol.html) | Google、Microsoft、Yahoo 等共同维护的官方协议站点；Sitemap 0.90 | Sitemap 与索引文件、站点范围、UTF-8、容量限制和增量提示 | `crawler-discover-frontier` | Sitemap 是发现提示，不保证页面有效、允许访问或应该抓取 |
| [Scrapy 2.17 Scheduler](https://docs.scrapy.org/en/latest/topics/scheduler.html) 与 [AutoThrottle](https://docs.scrapy.org/en/master/topics/autothrottle.html) | Scrapy 官方；2.17.0 | 队列次序、去重、持久化、下载槽、公平性和基于延迟的礼貌调节案例 | `crawler-discover-frontier`、`crawler-tune-queues` | 只吸收通用行为和失效模式，不把 Scrapy API 当成 Stellaris 实现要求 |
| [RFC 9110：HTTP Semantics](https://www.rfc-editor.org/info/rfc9110/) | IETF／RFC Editor 官方；STD 97 | 方法、状态码、字段、重定向、条件请求、URI 与表示语义 | `crawler-debug-http-network` | 协议语义不能代替现场 DNS、TCP、TLS、代理和服务端证据 |
| [RFC 9111：HTTP Caching](https://www.rfc-editor.org/rfc/rfc9111.html) | IETF／RFC Editor 官方；STD 98 | 新鲜度、验证、缓存键、条件请求及缓存异常诊断 | `crawler-debug-http-network`、`crawler-discover-frontier` | 不得把缓存命中或 304 直接解释为源站内容未变化 |
| [RFC 9846：TLS 1.3](https://www.rfc-editor.org/info/rfc9846/) | IETF／RFC Editor 官方；2026，向后兼容地取代 RFC 8446 | TLS 握手、版本协商、证书、恢复、0-RTT 和错误诊断 | `crawler-debug-http-network` | 本批采用 RFC 9846，不再把已被取代的 RFC 8446 当成当前最高依据 |
| [curl Documentation](https://curl.se/docs/) 与 [everything curl：Timeouts](https://everything.curl.dev/usingcurl/timeouts.html) | curl 官方；与 curl 8.21.0 及滚动文档配套 | DNS、连接、代理、TLS、重定向、超时和传输阶段的可观测诊断 | `crawler-debug-http-network` | curl 只作为可解释的协议探针与案例，不作为项目生产 HTTP 客户端 |
| [W3C WebDriver 规范系列](https://www.w3.org/TR/webdriver/all/) | W3C 官方；2018 Recommendation 与 2026-05-28 Working Draft 并存 | 跨浏览器会话、命令、元素、导航、等待和错误的协议基础 | `crawler-automate-browsers` | 必须记录引用的是 Recommendation 还是 Working Draft；不得把草案行为默认为所有浏览器已实现 |
| [W3C WebDriver BiDi](https://www.w3.org/TR/webdriver-bidi/) | W3C 官方；2026-06-01 Working Draft | 双向会话、事件订阅、网络与日志观测的跨浏览器协议方向 | `crawler-automate-browsers`、`crawler-debug-http-network` | 仍是 Working Draft；具体支持范围必须在后续 Playwright／浏览器版本资料中核对 |
| [WHATWG HTML parsing](https://html.spec.whatwg.org/multipage/parsing.html) | WHATWG 官方；Living Standard，审查时页面更新于 2026-07 | HTML Tokenization、树构建、错误恢复、编码探测与片段解析 | `crawler-validate-extraction`、`crawler-automate-browsers` | 浏览器 DOM 与非浏览器解析器可能存在可解释差异；不能以“解析成功”证明字段正确 |
| [RFC 8259：JSON](https://www.rfc-editor.org/info/rfc8259/) | IETF／RFC Editor 官方；Internet Standard | JSON 语法、数字、字符串、Unicode、解析器与生成器互操作边界 | `crawler-validate-extraction` | 宽松解析器行为不得升级为数据正确性依据 |
| [JSON-LD 1.1](https://www.w3.org/TR/json-ld/) | W3C Recommendation；2020-07-16 | 页面结构化数据、上下文、节点标识和展开／压缩语义 | `crawler-validate-extraction` | 只适用于 JSON-LD 证据；不得替代站点业务字段校验 |
| [Unicode UAX #15](https://unicode.org/reports/tr15/) | Unicode Consortium 官方；Unicode 17.0.0，Revision 57 | NFC／NFD／NFKC／NFKD、等价比较、稳定性与规范化测试 | `crawler-validate-extraction`、`crawler-discover-frontier` | NFKC／NFKD 会抹除部分语义差异，不能对任意原始证据盲目应用 |
| [W3C Data Quality Vocabulary](https://www.w3.org/TR/2016/NOTE-vocab-dqv-20160830/) | W3C Working Group Note；2016-08-30 | 质量维度、指标、度量、质量报告和标准符合性表达 | `crawler-validate-extraction` | 作为组织质量证据的方法，不把词汇表本身当成项目验收指标 |
| [Reactive Streams 1.0.4](https://github.com/reactive-streams/reactive-streams-jvm) | Reactive Streams 官方规范；1.0.4 | 异步边界、有限需求、非阻塞背压和 TCK 思路 | `crawler-tune-queues` | JVM API 不是项目技术栈要求；只吸收背压契约与验证方法 |
| [Celery 5.6 User Guide](https://docs.celeryq.dev/en/stable/userguide/) | Celery 官方；稳定文档 5.6／源码 v5.6.3 | Ack 时机、重复执行、幂等、重试、预取、连接恢复和 Worker 失效案例 | `crawler-tune-queues` | Celery 是案例库，不作为 Stellaris 生产任务队列 |
| [Locust Documentation](https://docs.locust.io/en/stable/) | Locust 官方；审查时稳定页面索引显示 2.44.4，仓库最新 Release 为 2.46.2 | 受控负载、分布式压测、阶段性吞吐／延迟对比和退出门槛 | `crawler-tune-queues` | 版本差异须以第二遍固定源码为准；不得对未获授权的外部站点施压 |

## 3. Agent 建议：准入清单（未确认）

| 仓库 | 官方性／作用 | Star | 维护状态 | 许可证 | 适用版本 | GitHub 体积代理 | 对应 Skill | 建议理由 |
|---|---|---:|---|---|---|---:|---|---|
| [scrapy/scrapy](https://github.com/scrapy/scrapy) | Scrapy 官方；完整抓取流水线的成熟实现与测试案例 | 63,506 | 活跃；最后推送 2026-07-30 | BSD-3-Clause | 2.17.0 | 约 30.8 MiB | Frontier、HTTP、解析、队列 | 可用一套高维护源码交叉观察调度、去重、中间件、下载、解析和限速边界，但不得把其运行时架构移植为项目硬约束 |
| [internetarchive/heritrix3](https://github.com/internetarchive/heritrix3) | Internet Archive 官方；大规模归档爬虫的 Frontier、礼貌策略与恢复案例 | 3,289 | 活跃；最后推送 2026-07-15 | Apache-2.0；已直接核对根许可证文本 | 3.16.0 | 约 12.4 MiB | `crawler-discover-frontier`、`crawler-tune-queues` | 对主机级礼貌、URI 队列、断点恢复和大规模 Frontier 缺陷具有独特证据价值 |
| [crawler-commons/crawler-commons](https://github.com/crawler-commons/crawler-commons) | Crawler Commons 官方；Robots、Sitemap 和 URL 过滤的复用组件与测试 | 259 | 活跃；最后推送 2026-07-27 | Apache-2.0 | 1.6 | 约 4.5 MiB | `crawler-discover-frontier` | Star 低但主题高度聚焦、维护活跃，能把规范与真实边界用例连接起来 |
| [google/robotstxt](https://github.com/google/robotstxt) | Google 官方；RFC 9309 作者关联实现与测试案例 | 3,468 | 活跃；最后推送 2026-04-01 | Apache-2.0 | v1.0.0 | 约 0.1 MiB | `crawler-discover-frontier` | 极小体积提供最长匹配、编码和边界输入的权威实现证据，可与 Crawler Commons 交叉验证 |
| [curl/curl](https://github.com/curl/curl) | curl 官方；多协议、DNS、TCP、TLS、代理和 HTTP 客户端实现及测试 | 42,498 | 活跃；最后推送 2026-07-30 | curl license；GitHub 为 `NOASSERTION`，已直接核对根 `COPYING` | 8.21.0 | 约 140.3 MiB | `crawler-debug-http-network` | 协议覆盖、诊断选项和回归案例独特；体积可控，且比收集多个语言 HTTP 客户端更节省重复成本 |
| [w3c/webdriver](https://github.com/w3c/webdriver) | W3C 官方 WebDriver 规范源码与议题历史 | 717 | 活跃；最后推送 2026-07-09 | W3C Software and Document License；已核对 `LICENSE.md` | 2026-05-28 WD；同时保留 2018 REC 边界 | 约 11.7 MiB | `crawler-automate-browsers` | Star 不高但官方性最高，适合追溯协议算法、错误语义和草案变化；避免先下载超大型浏览器实现 |
| [whatwg/url](https://github.com/whatwg/url) | WHATWG 官方 URL 标准源码、测试链接和变更历史 | 618 | 活跃；最后推送 2026-07-06 | 文档 CC-BY-4.0；纳入源码的部分 BSD-3-Clause | 审查时 Living Standard；第二遍固定 Commit | 约 3.7 MiB | Frontier、HTTP | 体积小且能为 URL 身份、相对解析和规范化争议提供可追溯算法依据 |
| [jhy/jsoup](https://github.com/jhy/jsoup) | jsoup 官方；容错 HTML 解析、DOM、Selector 和清洗实现及测试 | 11,381 | 活跃；最后推送 2026-07-30 | MIT | 1.23.1 | 约 6.8 MiB | `crawler-validate-extraction` | 重点覆盖畸形 HTML、编码、DOM 差异和 Selector 边界，作为跨语言实现证据而非项目依赖 |
| [mozilla/readability](https://github.com/mozilla/readability) | Mozilla 官方；正文提取算法、可读性评分和回归样例 | 11,367 | 活跃；最后推送 2026-07-09 | Apache-2.0 | 无正式 Release；第二遍固定 `main` Commit | 约 6.9 MiB | `crawler-validate-extraction` | 能提供“程序成功但正文抽取错误”的代表性启发式与回归案例，并与通用 DOM 解析区分 |
| [reactive-streams/reactive-streams-jvm](https://github.com/reactive-streams/reactive-streams-jvm) | Reactive Streams 官方规范、API 与 TCK | 4,873 | 规范稳定；最后推送 2024-03-13 | MIT-0 | 1.0.4 | 约 1.8 MiB | `crawler-tune-queues` | 维护节奏慢源于规范稳定，仍是非阻塞背压与一致性验证的直接规范源码 |
| [celery/celery](https://github.com/celery/celery) | Celery 官方；成熟分布式任务队列的 Ack、重试、预取和恢复案例 | 28,743 | 活跃；最后推送 2026-07-30 | BSD-3-Clause；已直接核对根许可证文本 | v5.6.3 | 约 36.1 MiB | `crawler-tune-queues` | 对重复执行、任务丢失、重试风暴、幂等和连接恢复提供集中且高质量的反例与测试 |
| [locustio/locust](https://github.com/locustio/locust) | Locust 官方；负载生成、统计、分布式执行和退出条件实现 | 28,033 | 活跃；最后推送 2026-07-30 | MIT | 2.46.2 | 约 38.8 MiB | `crawler-tune-queues` | 支撑受控基准、吞吐／延迟对比和性能回归证据；只学习测试设计，不在本阶段运行工具 |

准入仓库 GitHub 体积代理合计约 **294 MiB（0.29 GiB）**。该数值不是实际浅克隆大小；本批目前不触发任何下载。

## 4. Agent 建议：候选清单（未确认，不下载）

| 仓库 | Star | 维护状态 | 许可证 | 适用版本 | GitHub 体积代理 | 对应 Skill | 暂不准入原因 |
|---|---:|---|---|---|---:|---|---|
| [apache/nutch](https://github.com/apache/nutch) | 3,272 | 活跃；最后推送 2026-07-30 | Apache-2.0 | GitHub 无正式 Release；第二遍若升级须先核对 Apache 发布版 | 约 135.6 MiB | Frontier、HTTP、解析 | 官方且成熟，但覆盖面与 Scrapy、Heritrix 高度重复；先观察后续是否存在两者都不能解释的 Hadoop／批处理 Frontier 问题 |
| [apache/stormcrawler](https://github.com/apache/stormcrawler) | 989 | 活跃；最后推送 2026-07-29 | Apache-2.0 | 3.6.0 | 约 8.7 MiB | Frontier、队列 | 事件流式 Frontier 有独特性，但依赖 Apache Storm 语境，当前不如通用背压规范和 Heritrix 直接 |
| [urllib3/urllib3](https://github.com/urllib3/urllib3) | 4,046 | 活跃；最后推送 2026-07-30 | MIT | 2.7.0 | 约 8.7 MiB | `crawler-debug-http-network` | 高质量 HTTP 客户端，但语言特定且与 curl 的协议诊断证据重叠；留作 Python 行为差异备选 |
| [SeleniumHQ/selenium](https://github.com/SeleniumHQ/selenium) | 34,335 | 活跃；最后推送 2026-07-31 | Apache-2.0 | 4.46.0 | 约 2.27 GiB | `crawler-automate-browsers` | 官方且跨浏览器，但体积过大；本批先用 W3C 规范源码，具体项目实现留给后续 Playwright 版本资料 |
| [puppeteer/puppeteer](https://github.com/puppeteer/puppeteer) | 95,381 | 活跃；最后推送 2026-07-30 | Apache-2.0 | 25.4.0 | 约 1.43 GiB | `crawler-automate-browsers` | 影响力高但偏 Chromium／CDP 且体积大，与后续 Playwright 专项资料会明显重复 |
| [w3c/webdriver-bidi](https://github.com/w3c/webdriver-bidi) | 507 | 活跃；最后推送 2026-07-28 | GitHub 为 `NONE`，根目录未找到独立许可证文件；在线规范受 W3C 条款约束 | 2026-06-01 WD；第二遍若升级须重新核对 | 约 9.1 MiB | `crawler-automate-browsers` | 内容权威但仓库复制许可不满足当前明确性门槛；先准入 W3C 在线规范，不下载源码仓库 |
| [whatwg/html](https://github.com/whatwg/html) | 9,340 | 活跃；最后推送 2026-07-30 | 文档 CC-BY-4.0；纳入源码的部分 BSD-3-Clause | 审查时 Living Standard；第二遍固定 Commit | 约 1.12 GiB | 浏览器、解析 | 官方且重要，但完整历史体积过大；在线解析规范与 jsoup 测试已足以支撑本批最小骨架 |
| [lxml/lxml](https://github.com/lxml/lxml) | 3,044 | 活跃；最后推送 2026-07-30 | BSD-3-Clause | GitHub latest 为 7.0.0a3 | 约 20.7 MiB | `crawler-validate-extraction` | C／Python 绑定和 XML 能力有价值，但与 jsoup、Scrapy 解析证据重叠，且当前最新标签为预发布线索 |
| [scrapy/parsel](https://github.com/scrapy/parsel) | 1,347 | 活跃；最后推送 2026-07-27 | BSD-3-Clause | 1.11.0 | 约 0.9 MiB | `crawler-validate-extraction` | Selector 层很聚焦且体积小，但与准入的 Scrapy 源码存在直接包含关系；只有需要独立版本史时再升级 |
| [HdrHistogram/HdrHistogram](https://github.com/HdrHistogram/HdrHistogram) | 2,307 | 最后推送 2024-06-27；最新 Release 同年 | CC0／公有领域，并可按 BSD-2-Clause 使用；已核对许可证文本 | 2.2.2 | 约 5.0 MiB | `crawler-tune-queues` | 对尾延迟和 coordinated omission 很有价值，但维护与版本信号较弱；先由 Locust 与受控基线方法覆盖一般性能判断 |

## 5. Agent 建议：拒绝清单（未确认，不下载）

| 仓库 | Star | 维护状态 | 许可证 | 适用版本 | GitHub 体积代理 | 对应 Skill | 拒绝原因 |
|---|---:|---|---|---|---:|---|---|
| [commoncrawl/news-crawl](https://github.com/commoncrawl/news-crawl) | 375 | 活跃；最后推送 2026-07-30 | Apache-2.0 | 无正式 Release；滚动 `main` | 约 0.4 MiB | Frontier、队列 | 是 Common Crawl 面向新闻抓取的特定 StormCrawler 部署，不是通用方法或基础组件；与 StormCrawler 候选重复 |
| [projectdiscovery/katana](https://github.com/projectdiscovery/katana) | 17,247 | 活跃；最后推送 2026-07-28 | MIT | v1.6.1 | 约 2.8 MiB | Frontier、浏览器 | 面向安全侦察和攻击面发现，目标与本项目的公开资料礼貌采集及故障修复不一致，容易引入不必要的越权／绕过方向 |
| [crawlab-team/crawlab](https://github.com/crawlab-team/crawlab) | 12,250 | 最后推送 2026-02-10；最新 Release 2023-07-26 | BSD-3-Clause | v0.6.3 | 约 24.8 MiB | 队列、运行环境 | 是爬虫管理平台运行时，范围包含调度、UI、部署和管理；与已确认的“知识辅助而非生产组件”定位不符，独特诊断知识不足 |

## 6. 当前事实、Agent 推断与待确认项

### 当前事实

- 本批共审查 25 个有效仓库：12 个建议准入、10 个候选、3 个拒绝；所有仓库均未归档。
- `commoncrawl/cc-crawler` 路径在 GitHub 返回 404，没有被当作有效仓库；有效的 `commoncrawl/news-crawl` 已按其实际用途单独评估。
- RFC Editor 当前页面明确显示 RFC 9846 已取代 RFC 8446，并保持 TLS 1.3 版本号及向后兼容；因此本报告采用 RFC 9846。
- W3C WebDriver 同时存在 2018 Recommendation 和 2026 Working Draft；WebDriver BiDi 仍是 Working Draft。
- `w3c/webdriver-bidi` 根目录未找到独立许可证文件，GitHub 许可证字段为 `NONE`；其在线 W3C 规范仍可按网站条款审阅。
- Selenium、Puppeteer 和 WHATWG HTML 的 GitHub 体积代理合计约 4.82 GiB，三者均未直接准入。
- 本轮只读取官方网页、公共仓库元数据和少量根许可证文本，没有下载仓库、执行第三方代码、调用浏览器或运行压测。

### Agent 推断

- 12 个准入仓库与第 2 节在线规范构成了本批的最小充分知识骨架：规范提供正确语义，成熟实现与测试提供边界案例，且没有让任一 Skill 变成生产运行组件。
- 以 `w3c/webdriver` 和 W3C 在线 BiDi 规范覆盖跨浏览器协议，再在后续重点技术栈批次收集锁定版本的 Playwright 资料，比当前下载 Selenium／Puppeteer 更符合职责边界与容量约束。
- Scrapy、Heritrix、Crawler Commons 与 Google robotstxt 各自承担流水线、规模化 Frontier、复用协议组件和 RFC 边界实现，虽有交叉但不属于简单重复。
- Celery、Reactive Streams 与 Locust 分别提供任务投递语义、背压契约和受控性能验证；它们只能作为诊断知识与案例，不能定义 Stellaris 的生产队列。

### 待用户核对

- 是否接受第 2、3、4、5 节中的权威在线资料、准入、候选和拒绝分类。
- 未获核对前，不把本批分类写入主决策日志，不固定 Commit、不浅克隆，也不进入下一批资料审查。
