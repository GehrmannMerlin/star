# HTTP 与网络证据卡（共享证据层）

> 本文件是共享可追溯证据层中与 HTTP 与网络诊断相关的证据卡集合。每张卡表达一条可验证知识声明，绑定固定版本资料、原始位置与适用边界。
>
> 来源：批次 3 固定源码快照，全部以 `third-party/crawler-knowledge-sources/manifest.md` 记录的 ref 与 Commit 为唯一版本基线。
>
> 证据等级：规范证据（官方规范/文档/Release）＞实现证据（同版本官方源码/测试）＞工程证据（官方运行指南/手册）＞案例证据（事故资料，只用于启发）。
>
> 维护规则：本文件由资料治理 Skill 按既定准入、许可证复核与版本固定流程维护；不得静默改写已固定证据卡，更新只通过新增修订进行。

## 来源身份与版本基线

| 仓库 | 权威 ref | Commit | 本地路径 |
|---|---|---|---|
| curl/curl | `curl-8_21_0` | `68720b4837284335b2d63cb358f8f6ce65f5bc55` | `third-party/crawler-knowledge-sources/repos/batch-03-crawler-pipeline/curl` |
| scrapy/scrapy | `2.17.0` | `feb692f552e3ed4533cf4e3af4809908d84cd763` | `third-party/crawler-knowledge-sources/repos/batch-03-crawler-pipeline/scrapy` |
| crawler-commons/crawler-commons | `crawler-commons-1.6` | `ce0fcb3e26dd653af93434a4cd64b1be4f7bce01` | `third-party/crawler-knowledge-sources/repos/batch-03-crawler-pipeline/crawler-commons` |
| whatwg/url | `main` | `9dc3827fc722ac4af3f11061aa3e9adb44a17c8b` | `third-party/crawler-knowledge-sources/repos/batch-03-crawler-pipeline/url` |

---

## DNS、TLS 与连接

### HN-DNS-001 DNS 解析与连接过滤器

- **知识声明**：curl 通过 DNS 过滤器（`cf-dns`）把 DNS 解析结果接入连接过滤器链，`Curl_cf_dns_get_ai` 提供解析后的地址信息供连接建立使用。
- **证据类型/等级**：实现证据。
- **来源身份**：curl/curl（`curl-8_21_0`）。
- **版本/ref/Commit**：`curl-8_21_0`；`68720b4837284335b2d63cb358f8f6ce65f5bc55`。
- **原始位置**：`lib/cf-dns.h`（`Curl_cf_dns_add`、`Curl_cf_dns_insert_after`、`Curl_conn_dns_result`、`Curl_cf_dns_get_ai`）。
- **支持说明**：`Curl_cf_dns_get_ai` 返回 `const struct Curl_addrinfo *`；DNS 作为连接过滤器链的一环，其结果为后续连接建立提供地址。
- **适用条件**：诊断 DNS 解析失败、解析顺序或连接建立依赖 DNS 结果的项目行为时比对。
- **限制**：本卡是 curl 的 C 实现证据；Node.js/Crawlee 等项目的 DNS 行为以其锁定版本资料为准。
- **关联 Skill**：crawler-debug-http-network。
- **状态**：有效。

### HN-TLS-001 TLS 上下文与证书验证

- **知识声明**：Scrapy 的 `ScrapyClientContextFactory` 通过 `DOWNLOADER_CLIENT_TLS_CIPHERS` 与 `DOWNLOAD_VERIFY_CERTIFICATES` 配置 TLS 密码套件与证书验证；验证关闭时不做对端证书校验。
- **证据类型/等级**：实现证据。
- **来源身份**：scrapy/scrapy（`2.17.0`）。
- **版本/ref/Commit**：`2.17.0`；`feb692f552e3ed4533cf4e3af4809908d84cd763`。
- **原始位置**：`scrapy/core/downloader/contextfactory.py`（`ScrapyClientContextFactory`，93-109 行）。
- **支持说明**：`tls_ciphers = crawler.settings["DOWNLOADER_CLIENT_TLS_CIPHERS"]`；`verify_certificates = crawler.settings.getbool("DOWNLOAD_VERIFY_CERTIFICATES")`；`if not self._verify_certificates:` 分支跳过对端证书校验。
- **适用条件**：诊断 TLS 握手失败、证书校验被关闭、密码套件配置问题时比对。
- **限制**：TLS 版本选择（`tls.py` 的 `TLSVersion` 映射）与密码套件解析随 OpenSSL 与版本变化；不得把某默认值当作跨版本通用规则。
- **关联 Skill**：crawler-debug-http-network。
- **状态**：有效。

### HN-CONN-001 连接建立与 HTTPS CONNECT

- **知识声明**：curl 通过连接过滤器链建立连接；HTTPS 连接使用 `Curl_cft_http_connect` 过滤器，`Curl_cf_https_setup` 完成 HTTPS 连接初始化。
- **证据类型/等级**：实现证据。
- **来源身份**：curl/curl（`curl-8_21_0`）。
- **版本/ref/Commit**：`curl-8_21_0`；`68720b4837284335b2d63cb358f8f6ce65f5bc55`。
- **原始位置**：`lib/cf-https-connect.h`（`Curl_cft_http_connect`、`Curl_cf_https_setup`）；`lib/connect.c`。
- **支持说明**：`extern struct Curl_cftype Curl_cft_http_connect;` 与 `Curl_cf_https_setup` 定义 HTTPS 连接过滤器的接入点。
- **适用条件**：诊断 HTTPS 连接建立失败、CONNECT 行为异常时比对。
- **限制**：连接复用、超时等细节在 `connect.c`/`transfer.c` 中实现，本卡描述连接过滤器结构。
- **关联 Skill**：crawler-debug-http-network。
- **状态**：有效。

---

## 代理与重定向

### HN-PROXY-001 代理选择与绕过

- **知识声明**：Scrapy `HttpProxyMiddleware` 通过 `request.meta["proxy"]` 指定代理；`_parse_proxy` 解析代理 URL，`proxy_bypass` 决定主机是否绕过代理（`no_proxy` 仅对 http/https scheme 生效）。
- **证据类型/等级**：实现证据。
- **来源身份**：scrapy/scrapy（`2.17.0`）。
- **版本/ref/Commit**：`2.17.0`；`feb692f552e3ed4533cf4e3af4809908d84cd763`。
- **原始位置**：`scrapy/downloadermiddlewares/httpproxy.py`（`HttpProxyMiddleware`，26-75 行）。
- **支持说明**：`if "proxy" in request.meta` 优先用 meta 代理；`_scheme not in {"http","https"} or proxy_bypass(...)` 决定是否走默认代理；注释明确 `no_proxy` 仅支持 http schemes。
- **适用条件**：诊断代理未生效、`no_proxy` 失效、代理凭据传递问题时比对。
- **限制**：代理凭据属于敏感信息，诊断记录不得写入明文（§36）；不同框架代理配置方式不同。
- **关联 Skill**：crawler-debug-http-network。
- **状态**：有效。

### HN-REDIR-001 重定向跟随语义

- **知识声明**：Scrapy `RedirectMiddleware` 对 301/302/303/307/308 且带 `Location` 的响应构造重定向请求；`dont_redirect`、`handle_httpstatus_list`、`handle_httpstatus_all` 可禁用或豁免；301/302+POST、303+非 GET/HEAD 转 GET。
- **证据类型/等级**：实现证据。
- **来源身份**：scrapy/scrapy（`2.17.0`）。
- **版本/ref/Commit**：`2.17.0`；`feb692f552e3ed4533cf4e3af4809908d84cd763`。
- **原始位置**：`scrapy/downloadermiddlewares/redirect.py`（`RedirectMiddleware.process_response`，198-244 行）。
- **支持说明**：豁免条件、`Location` 头部处理、`urljoin` 构造重定向 URL、301/302+POST 与 303 转 GET 逻辑。
- **适用条件**：诊断重定向未跟随、重定向环、POST 被转 GET、`Location` 相对 URL 处理异常时比对。
- **限制**：重定向上限与优先级调整在 `BaseRedirectMiddleware`（`REDIRECT_MAX_TIMES`、`REDIRECT_PRIORITY_ADJUST`）；本卡描述跟随语义。
- **关联 Skill**：crawler-debug-http-network。
- **状态**：有效。

### HN-REDIR-002 重定向上限与优先级

- **知识声明**：Scrapy 重定向中间件通过 `REDIRECT_ENABLED`、`REDIRECT_MAX_TIMES`、`REDIRECT_PRIORITY_ADJUST` 配置启用、最大重定向次数与重定向后优先级调整。
- **证据类型/等级**：实现证据。
- **来源身份**：scrapy/scrapy（`2.17.0`）。
- **版本/ref/Commit**：`2.17.0`；`feb692f552e3ed4533cf4e3af4809908d84cd763`。
- **原始位置**：`scrapy/downloadermiddlewares/redirect.py`（`BaseRedirectMiddleware`，38-39 行）。
- **支持说明**：`self.max_redirect_times = settings.getint("REDIRECT_MAX_TIMES")`；`self.priority_adjust = settings.getint("REDIRECT_PRIORITY_ADJUST")`。
- **适用条件**：诊断重定向过多被终止、优先级调整影响队列顺序时比对。
- **限制**：重定向环检测与上限终止行为随版本与配置而异。
- **关联 Skill**：crawler-debug-http-network。
- **状态**：有效。

---

## 请求头、状态码与 HTTP 版本

### HN-HDR-001 默认请求头

- **知识声明**：Scrapy 通过 `DefaultHeadersMiddleware` 为请求注入默认请求头；请求级头可覆盖默认头。
- **证据类型/等级**：实现证据。
- **来源身份**：scrapy/scrapy（`2.17.0`）。
- **版本/ref/Commit**：`2.17.0`；`feb692f552e3ed4533cf4e3af4809908d84cd763`。
- **原始位置**：`scrapy/downloadermiddlewares/defaultheaders.py`。
- **支持说明**：默认头中间件在请求未显式设置时注入默认头。
- **适用条件**：诊断请求头缺失、被覆盖、UA/Cookie 等头配置异常时比对。
- **限制**：默认头内容随版本与设置变化；不得把某版本默认 UA 等当作通用规则。
- **关联 Skill**：crawler-debug-http-network。
- **状态**：有效。

### HN-HDR-002 HTTP 请求构造与版本行为

- **知识声明**：curl 在 `lib/http.c` 构造 HTTP 请求，`lib/http1.c`/`lib/http2.c` 分别实现 HTTP/1.1 与 HTTP/2 的请求/响应处理；不同 HTTP 版本行为不同。
- **证据类型/等级**：实现证据。
- **来源身份**：curl/curl（`curl-8_21_0`）。
- **版本/ref/Commit**：`curl-8_21_0`；`68720b4837284335b2d63cb358f8f6ce65f5bc55`。
- **原始位置**：`lib/http.c`、`lib/http1.c`、`lib/http2.c`。
- **支持说明**：`http.c` 负责请求构造与状态机，`http1.c`/`http2.c` 按协议版本实现传输细节。
- **适用条件**：诊断 HTTP/1.1 与 HTTP/2 行为差异、请求构造错误时比对。
- **限制**：HTTP/2 多路复用、头压缩等细节随实现与版本变化。
- **关联 Skill**：crawler-debug-http-network。
- **状态**：有效。

### HN-STATUS-001 状态码处理

- **知识声明**：Scrapy 的 `RedirectMiddleware` 只对 301/302/303/307/308 处理重定向；`RetryMiddleware` 对 `RETRY_HTTP_CODES` 集合内的状态码触发重试；其余状态码按正常响应处理。
- **证据类型/等级**：实现证据。
- **来源身份**：scrapy/scrapy（`2.17.0`）。
- **版本/ref/Commit**：`2.17.0`；`feb692f552e3ed4533cf4e3af4809908d84cd763`。
- **原始位置**：`scrapy/downloadermiddlewares/redirect.py`（状态码集合）；`scrapy/downloadermiddlewares/retry.py`（`RETRY_HTTP_CODES`，149 行）。
- **支持说明**：`retry_http_codes = {int(x) for x in settings.getlist("RETRY_HTTP_CODES")}`；`if response.status in self.retry_http_codes:` 触发 `_retry`。
- **适用条件**：诊断状态码处理路径（哪些码重试/重定向/直接返回）时比对。
- **限制**：默认 `RETRY_HTTP_CODES` 随版本变化；不得把某默认集合当作通用规则。
- **关联 Skill**：crawler-debug-http-network。
- **状态**：有效。

---

## 超时、重试与礼貌限流

### HN-TIMEOUT-001 超时语义与配置

- **知识声明**：Scrapy `DownloadTimeoutMiddleware` 用 `DOWNLOAD_TIMEOUT` 设置请求超时，并把超时写入 `request.meta["download_timeout"]`；`spider.download_timeout` 可覆盖（但已弃用告警）。
- **证据类型/等级**：实现证据。
- **来源身份**：scrapy/scrapy（`2.17.0`）。
- **版本/ref/Commit**：`2.17.0`；`feb692f552e3ed4533cf4e3af4809908d84cd763`。
- **原始位置**：`scrapy/downloadermiddlewares/downloadtimeout.py`（`DownloadTimeoutMiddleware`，23-43 行）。
- **支持说明**：`o = cls(crawler.settings.getfloat("DOWNLOAD_TIMEOUT"))`；`request.meta.setdefault("download_timeout", self._timeout)`；`spider.download_timeout` 已弃用告警。
- **适用条件**：诊断请求超时未生效、超时设置未传播到下载器时比对。
- **限制**：超时从请求 meta 读取的实际执行在下载器层；本卡描述中间件配置传播。
- **关联 Skill**：crawler-debug-http-network。
- **状态**：有效。

### HN-RETRY-001 重试策略与触发条件

- **知识声明**：Scrapy `RetryMiddleware` 按 `RETRY_TIMES`（最大重试次数）、`RETRY_HTTP_CODES`（触发重试的状态码）、`RETRY_EXCEPTIONS`（触发重试的异常）与 `max_retry_times` meta 配置重试；`RETRY_ENABLED=False` 时中间件不配置。
- **证据类型/等级**：实现证据。
- **来源身份**：scrapy/scrapy（`2.17.0`）。
- **版本/ref/Commit**：`2.17.0`；`feb692f552e3ed4533cf4e3af4809908d84cd763`。
- **原始位置**：`scrapy/downloadermiddlewares/retry.py`（`RetryMiddleware`，140-200 行）。
- **支持说明**：`max_retry_times`、`retry_http_codes`、`exceptions_to_retry` 从设置读取；`process_response` 对 `RETRY_HTTP_CODES` 内状态码触发 `_retry`；`process_exception` 对 `exceptions_to_retry` 内异常触发 `_retry`；`dont_retry` meta 可禁用。
- **适用条件**：诊断重试不足/过度、瞬时失败被丢弃、重试风暴时比对。
- **限制**：`RETRY_EXCEPTIONS` 默认值随版本变化；请求级 `max_retry_times` 覆盖全局 `RETRY_TIMES`。
- **关联 Skill**：crawler-debug-http-network。
- **状态**：有效。

### HN-RETRY-002 重试优先级调整

- **知识声明**：Scrapy 重试请求通过 `RETRY_PRIORITY_ADJUST`（或请求 `priority_adjust` meta）调整重试后的优先级，影响重试请求在队列中的顺序。
- **证据类型/等级**：实现证据。
- **来源身份**：scrapy/scrapy（`2.17.0`）。
- **版本/ref/Commit**：`2.17.0`；`feb692f552e3ed4533cf4e3af4809908d84cd763`。
- **原始位置**：`scrapy/downloadermiddlewares/retry.py`（`RETRY_PRIORITY_ADJUST`，114-126 行）；`_retry` 中 `priority_adjust = request.meta.get("priority_adjust", self.priority_adjust)`。
- **支持说明**：`priority_adjust = settings.getint("RETRY_PRIORITY_ADJUST")` 后传给 `get_retry_request`。
- **适用条件**：诊断重试请求被延迟/提前、与队列优先级交互时比对。
- **限制**：优先级调整影响的是队列调度（`crawler-tune-queues` 管辖），本卡只描述重试中间件的优先级参数。
- **关联 Skill**：crawler-debug-http-network。
- **状态**：有效。

---

## robots.txt 与响应完整性

### HN-ROBOTS-001 robots 执行

- **知识声明**：Scrapy `RobotsTxtMiddleware` 在下载请求前检查 `robots.txt` 规则；`ROBOTSTXT_OBEY=True` 时被禁止的请求被拒绝。
- **证据类型/等级**：实现证据。
- **来源身份**：scrapy/scrapy（`2.17.0`）。
- **版本/ref/Commit**：`2.17.0`；`feb692f552e3ed4533cf4e3af4809908d84cd763`。
- **原始位置**：`scrapy/downloadermiddlewares/robotstxt.py`。
- **支持说明**：RobotsTxt 中间件在请求处理链中执行 robots 规则检查。
- **适用条件**：诊断 robots 策略未生效、被禁止路径仍被抓取时比对。
- **限制**：robots 解析器（`crawler-commons` 等）行为随版本变化；本卡描述中间件执行边界。
- **关联 Skill**：crawler-debug-http-network。
- **状态**：有效。

### HN-ROBOTS-002 robots 解析器行为

- **知识声明**：Crawler-Commons `BaseRobotsParser` 与 `SimpleRobotRules` 提供 robots.txt 解析与规则匹配；解析器定义行为边界（如 match 规则、默认允许/拒绝）。
- **证据类型/等级**：实现证据。
- **来源身份**：crawler-commons/crawler-commons（`crawler-commons-1.6`）。
- **版本/ref/Commit**：`crawler-commons-1.6`；`ce0fcb3e26dd653af93434a4cd64b1be4f7bce01`。
- **原始位置**：`src/main/java/crawlercommons/robots/BaseRobotsParser.java`、`SimpleRobotRules.java`。
- **支持说明**：`BaseRobotsParser` 定义解析器接口与行为边界；`SimpleRobotRules` 提供规则表示与匹配。
- **适用条件**：诊断 robots 解析/匹配行为与预期不符时比对。
- **限制**：robots 协议存在不同解释；本卡是 Java 实现证据，行为以协议与实现共同为准。
- **关联 Skill**：crawler-debug-http-network。
- **状态**：有效。

### HN-COMPLETE-001 响应完整性（chunked 处理）

- **知识声明**：curl 在 `lib/http_chunks.c` 实现 chunked transfer encoding 解析：`Chunked-Body = *chunk last-chunk`，`chunk-size` 为十六进制长度，`chunk-extension` 可选；解析错误会导致响应不完整或被判定失败。
- **证据类型/等级**：实现证据。
- **来源身份**：curl/curl（`curl-8_21_0`）。
- **版本/ref/Commit**：`curl-8_21_0`；`68720b4837284335b2d63cb358f8f6ce65f5bc55`。
- **原始位置**：`lib/http_chunks.c`（39-67 行）。
- **支持说明**：文件头注释给出 chunked encoding 语法（`chunk = chunk-size [chunk-extension] CRLF chunk-data CRLF`）。
- **适用条件**：诊断响应体不完整、chunked 解析失败导致数据截断时比对。
- **限制**：不同 HTTP 客户端对 chunked 的容错不同；本卡是 curl 实现证据。
- **关联 Skill**：crawler-debug-http-network。
- **状态**：有效。

---

## 汇总

- 证据卡总数：15 张（HN-DNS 1＋HN-TLS 1＋HN-CONN 1＋HN-PROXY 1＋HN-REDIR 2＋HN-HDR 2＋HN-STATUS 1＋HN-TIMEOUT 1＋HN-RETRY 2＋HN-ROBOTS 2＋HN-COMPLETE 1）。
- 来源：批次 3 固定仓库 4 个（curl、scrapy、crawler-commons、whatwg/url）。
- 引用契约：下游 Skill 视图通过稳定 ID 引用本文件；原始证据通过 manifest 固定 Commit 与相对路径可追溯。
