# crawler-debug-http-network 知识视图

> 本视图是 `crawler-debug-http-network` Skill 的独立知识视图，只保留与"HTTP 与网络诊断、修复顾问"职责相关的知识。来源身份、版本与许可证事实由共享证据层统一维护，本视图通过稳定证据卡 ID 引用，不复制原始来源元数据。

## 定位、触发与排除项

- **定位**：面向 Agent 的 HTTP 与网络诊断、修复顾问；依托固定版本资料帮助 Agent 检查项目的 DNS、TLS、代理、重定向、`robots.txt`、请求头、状态码、连接、超时、请求级重试、礼貌限流与响应完整性。
- **不是**：项目中的生产 HTTP 客户端、代理或网络 Worker；不承担项目的生产请求、重试或代理功能；不是修复器、规划器、记忆服务、RAG、索引服务、上下文框架或运行组件。
- **触发**：用户要求检查 HTTP 与网络相关设计或故障；已确认问题涉及 DNS、TLS、代理、重定向、请求头、状态码、连接、超时、请求级重试、礼貌限流或响应完整性。
- **排除**：具体 Node.js、Crawlee 等框架 API 与版本用法交给重点技术栈 Skill；动态页面渲染、跨任务调度、业务字段正确性分别交给对应领域 Skill；不绕过登录/验证码/访问控制/WAF；不把外部限制或未知项伪装成已修复；不生成 `writing-plans`。

## 最低证据输入

- 项目上下文（处理 Stellaris 问题时为 `stellaris-crawler-context` 项目上下文包路径）。
- 网络代码、配置、依赖版本、日志、请求记录、响应或错误、复现证据。
- 固定版本资料（批次 3：curl、scrapy downloader/中间件、crawler-commons robots、whatwg/url）。

## 知识主题与证据卡映射

### DNS、TLS 与连接

- 判断 DNS 解析、TLS 上下文/证书验证、连接建立是否符合固定版本行为；TLS 验证关闭、密码套件配置、HTTPS CONNECT 异常是常见问题。
- 证据卡：[[HN-DNS-001]]（DNS 解析与连接过滤器）、[[HN-TLS-001]]（TLS 上下文与证书验证）、[[HN-CONN-001]]（连接建立与 HTTPS CONNECT）。
- 依据固定版本：curl `lib/cf-dns.h`、`lib/connect.c`、`lib/cf-https-connect.h`、`lib/vtls`；scrapy `core/downloader/contextfactory.py`、`core/downloader/tls.py`。

### 代理与重定向

- 判断代理选择/绕过、重定向跟随语义与上限是否符合固定版本行为；`no_proxy` 失效、重定向环、POST 被转 GET 是常见问题。
- 证据卡：[[HN-PROXY-001]]（代理选择与绕过）、[[HN-REDIR-001]]（重定向跟随语义）、[[HN-REDIR-002]]（重定向上限与优先级）。
- 依据固定版本：scrapy `downloadermiddlewares/httpproxy.py`、`redirect.py`；curl `lib/cf-h1-proxy.h`、`lib/cf-h2-proxy.h`、`lib/http_proxy.c`。

### 请求头、状态码与 HTTP 版本

- 判断默认请求头、请求构造、状态码处理路径是否符合固定版本行为；默认头缺失/覆盖、HTTP/1.1 与 HTTP/2 差异、状态码未按预期重试/重定向是常见问题。
- 证据卡：[[HN-HDR-001]]（默认请求头）、[[HN-HDR-002]]（HTTP 请求构造与版本行为）、[[HN-STATUS-001]]（状态码处理）。
- 依据固定版本：scrapy `downloadermiddlewares/defaultheaders.py`；curl `lib/http.c`、`lib/http1.c`、`lib/http2.c`。

### 超时、重试与礼貌限流

- 判断超时传播、重试策略与触发条件、重试优先级调整是否符合固定版本行为；超时未生效、重试风暴、瞬时失败被丢弃是常见问题。
- 证据卡：[[HN-TIMEOUT-001]]（超时语义与配置）、[[HN-RETRY-001]]（重试策略与触发条件）、[[HN-RETRY-002]]（重试优先级调整）。
- 依据固定版本：scrapy `downloadermiddlewares/downloadtimeout.py`、`retry.py`；curl `lib/transfer.c`、`lib/multi.c`。

### robots.txt 与响应完整性

- 判断 robots 执行与解析、响应完整性是否符合固定版本行为；robots 策略未生效、chunked 响应被截断是常见问题。
- 证据卡：[[HN-ROBOTS-001]]（robots 执行）、[[HN-ROBOTS-002]]（robots 解析器行为）、[[HN-COMPLETE-001]]（响应完整性）。
- 依据固定版本：scrapy `downloadermiddlewares/robotstxt.py`；crawler-commons `robots/BaseRobotsParser.java`、`SimpleRobotRules.java`；curl `lib/http_chunks.c`。

## 版本化判断规则

- 每条判断依据必须追溯到固定版本资料（ref＋Commit）、证据卡、上下文包条目或决策日志节号；只给仓库首页或没有版本的引用不满足要求。
- 明确区分事实、证据、综合推断与未知项；综合推断必须显式标记"推断"，不得伪装成资料中的确定结论。
- 不得因新技术更新默认要求升级；是否升级以证据和项目约束为准。
- 不同版本行为分别保存，禁止把新版本结论回填到旧版本卡片。

## 常见故障模式

| 故障模式 | 证据卡 | 典型根因方向 |
|---|---|---|
| DNS 解析失败/连接建立失败 | [[HN-DNS-001]]、[[HN-CONN-001]] | DNS 解析依赖、连接过滤器配置、瞬时解析失败 |
| TLS 握手失败/证书被拒 | [[HN-TLS-001]] | 证书验证关闭、密码套件配置、TLS 版本选择 |
| 代理未生效/no_proxy 失效 | [[HN-PROXY-001]] | meta 代理未设置、no_proxy 不覆盖 scheme、凭据错误 |
| 重定向未跟随/重定向环 | [[HN-REDIR-001]]、[[HN-REDIR-002]] | Location 处理、豁免条件、上限耗尽 |
| 默认头缺失/覆盖 | [[HN-HDR-001]] | 中间件未启用、请求级头覆盖 |
| HTTP/1.1 与 HTTP/2 行为差异 | [[HN-HDR-002]] | 版本协商、请求构造差异 |
| 状态码处理路径异常 | [[HN-STATUS-001]] | RETRY_HTTP_CODES 未覆盖、重定向豁免配置 |
| 超时未生效 | [[HN-TIMEOUT-001]] | DOWNLOAD_TIMEOUT 未设置、meta 未传播 |
| 重试风暴/瞬时失败被丢弃 | [[HN-RETRY-001]]、[[HN-RETRY-002]] | RETRY_HTTP_CODES/EXCEPTIONS 配置、max_retry_times、优先级调整 |
| 站点拒绝/验证码/限流/WAF | [[HN-ROBOTS-001]]、[[HN-ROBOTS-002]] | 外部限制，只能合规降级/等待/终止 |
| 响应体不完整/chunked 截断 | [[HN-COMPLETE-001]] | chunked 解析失败、连接中断未检测 |

## 证据不足与冲突处理

- 证据不足时不得把结论判定为确定根因；保持候选假设并标记未知项，只提出最小补充取证或安全诊断检查。
- 现场证据、项目上下文、已批准要求冲突时并列报告，不静默覆盖任一来源。
- 未解决的声明标记为不确定（非确定性），不得伪装成确定结论。
- 固定版本证据卡与既有诊断记录不得被静默改写；更新只通过新增修订进行。
- 外部限制（站点拒绝/验证码/限流/WAF）只能给合规降级/等待/终止结论，不得伪装成已修复。

## 输出与交接

- 输出可追溯诊断记录：问题证据、分类（代码缺陷/配置错误/版本兼容/瞬时故障/外部限制/未知项，含置信度）、根因或待验证假设、影响范围、修复方向、网络层测试建议。
- 根因和方向获批后，交接给 `crawler-writing-plans-bridge` 作为规划输入；用户未批准前不交接。
- 交接遵守主决策日志 §33-36：可落盘结构化记录＋简短摘要；双层存储；敏感信息（含代理凭据）落盘前脱敏。
- 处理 Stellaris 问题时，先读取 `stellaris-crawler-context` 项目上下文包路径。

## 排除项与禁止

- 不承担项目的生产请求、重试或代理功能。
- 不执行无效轰击或过度诊断请求；诊断探测限小规模、安全、合规。
- 不绕过登录、验证码、访问控制或 WAF。
- 不修改爬虫代码、`manifest.md`、第三方仓库；不初始化 Git。
- 不把密钥、Cookie、认证请求头、代理凭据写入诊断记录。

## 视图自检

- 本视图引用的全部证据卡 ID 必须存在于 `docs/superpowers/knowledge/evidence-cards/http-network.md`。
- 引用计数：HN-DNS 1＋HN-TLS 1＋HN-CONN 1＋HN-PROXY 1＋HN-REDIR 2＋HN-HDR 2＋HN-STATUS 1＋HN-TIMEOUT 1＋HN-RETRY 2＋HN-ROBOTS 2＋HN-COMPLETE 1，共 15。
- 无未标注"推断"的综合推断；无把案例/Playbook 升格为规范的表述。
