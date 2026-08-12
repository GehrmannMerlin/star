# `crawler-debug-http-network` 诊断流程与分类规则

> 本文件定义本 Skill 的诊断流程、问题分类规则与证据卡映射。判断依据与边界以主决策日志与已批准设计规格为准。

## 诊断流程

1. 读取项目上下文、目标、约束与已确认问题证据。处理 Stellaris 问题时，先读取 `stellaris-crawler-context` 生成的项目上下文包路径。
2. 确定诊断聚焦点（DNS / TLS / 代理 / 重定向 / 请求头·状态码 / 连接·超时 / 请求级重试 / 礼貌限流·响应完整性），聚焦该点，不做无边界全栈诊断。
3. 检查相关代码、配置、依赖版本、日志、请求记录、响应或错误，定位具体证据位置。
4. 引用匹配版本的证据卡（`http-network.md`）比对项目行为与规范/实现/工程证据。
5. 分类：代码缺陷 / 配置错误 / 版本兼容 / 瞬时故障 / 外部限制 / 未知项。
6. 证据不足时只提出最小补充取证或安全诊断检查；根因未证实前不提出代码修改。
7. 输出可追溯问题证据、根因或待验证假设、影响范围、修复方向、网络层测试建议。
8. 根因和方向获批后，将选定方向交给 `crawler-writing-plans-bridge`。

## 问题分类规则

- **代码缺陷**：项目网络代码未按规范/实现证据处理（如请求头构造错误、重定向处理缺失、超时配置未生效）。
- **配置错误**：网络配置/参数与固定版本行为不符（如代理配置、TLS 验证、重试参数设置错误）。
- **版本兼容**：依赖版本与 API 行为不匹配（如 curl/scrapy 版本差异导致行为变化）。
- **瞬时故障**：网络瞬时抖动、DNS 临时解析失败、超时偶发——按重试策略处理，不是代码缺陷。
- **外部限制**：站点拒绝、验证码、限流、WAF 拦截等——只能给合规降级/等待/终止结论，不得伪装成已修复（主决策日志 §12/§49）。
- **未知项**：证据不足或冲突，保持候选假设，显式标记，不判定为确定根因。

每条结论必须明确区分：事实、证据、综合推断、待确认项。综合推断必须显式标记为"推断"，不得伪装成资料中的确定结论（主决策日志 §14）。

置信度使用固定枚举：高（证据充分且指向唯一分类）、中（证据充分但多个分类可能）、低（证据不足或冲突，仅候选假设）、不确定（无法判断）。

## 证据卡映射

共享证据卡：`docs/superpowers/knowledge/evidence-cards/http-network.md`；知识视图：`docs/superpowers/knowledge/skill-views/crawler-debug-http-network.md`。

| 诊断聚焦点 | 证据卡 | 固定资料路径 |
|---|---|---|
| DNS、TLS 与连接 | HN-DNS-001、HN-TLS-001、HN-CONN-001 | curl `lib/cf-dns.h`、`lib/connect.c`、`lib/cf-https-connect.h`、`lib/vtls`；scrapy `core/downloader/contextfactory.py`、`core/downloader/tls.py` |
| 代理与重定向 | HN-PROXY-001、HN-REDIR-001、HN-REDIR-002 | scrapy `downloadermiddlewares/httpproxy.py`、`redirect.py`；curl `lib/cf-h1-proxy.h`、`lib/cf-h2-proxy.h`、`lib/http_proxy.c` |
| 请求头、状态码与 HTTP 版本 | HN-HDR-001、HN-HDR-002、HN-STATUS-001 | scrapy `downloadermiddlewares/defaultheaders.py`；curl `lib/http.c`、`lib/http1.c`、`lib/http2.c` |
| 超时、重试与礼貌限流 | HN-TIMEOUT-001、HN-RETRY-001、HN-RETRY-002 | scrapy `downloadermiddlewares/downloadtimeout.py`、`retry.py`；curl `lib/transfer.c`、`lib/multi.c` |
| robots.txt 与响应完整性 | HN-ROBOTS-001、HN-ROBOTS-002、HN-COMPLETE-001 | scrapy `downloadermiddlewares/robotstxt.py`；crawler-commons `robots/BaseRobotsParser.java`、`SimpleRobotRules.java`；curl `lib/http_chunks.c` |

每条依据必须可追溯：从诊断记录追到固定版本资料、证据卡、上下文包条目或决策日志节号。只给仓库首页、模糊文件夹或没有版本的引用不满足要求。

## 安全诊断请求边界

- 诊断确有必要时，可以指导 Agent 执行小规模、安全且合规的 DNS/TLS/HTTP 诊断请求用于验证假设。
- 诊断请求不得承担项目的生产请求、重试或代理功能；不得执行无效轰击或过度诊断。
- 诊断请求必须遵守 `robots.txt`、访问控制与合规边界；不得绕过登录、验证码、访问控制或 WAF；不保存密钥、Cookie、认证请求头、代理凭据。

## 证据不足与冲突

- 证据不足时不得把结论判定为确定根因；保留候选状态并标记未知项。
- 现场证据、项目上下文、已批准要求冲突时并列报告，不静默覆盖任一来源。
- 未解决的声明标记为不确定（非确定性），不得伪装成确定结论。
- 固定版本证据卡与既有诊断记录不得被静默改写；更新只通过新增修订进行。
- 外部限制（站点拒绝/验证码/限流/WAF）只能给合规降级/等待/终止结论，不得伪装成已修复。
- 不得因新技术更新默认要求升级；是否升级以证据和项目约束为准。
