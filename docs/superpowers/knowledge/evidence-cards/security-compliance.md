# 安全与合规证据卡（共享证据层）

> 本文件是共享可追溯证据层中与爬虫安全与合规审查相关的证据卡集合。每张卡表达一条可验证知识声明，绑定固定版本资料、原始位置与适用边界。
>
> 来源：批次 3 固定源码快照（whatwg/url、scrapy、curl）与批次 4 固定源码快照（in-toto、slsa、osv-schema），全部以 `third-party/crawler-knowledge-sources/manifest.md` 记录的 ref 与 Commit 为唯一版本基线。
>
> 证据等级：规范证据（官方规范/文档/Release）＞实现证据（同版本官方源码/测试）＞工程证据（官方运行指南/手册）＞案例证据（事故资料，只用于启发）。
>
> 维护规则：本文件由资料治理 Skill 按既定准入、许可证复核与版本固定流程维护；不得静默改写已固定证据卡，更新只通过新增修订进行。

## 来源身份与版本基线

| 仓库 | 权威 ref | Commit | 本地路径 |
|---|---|---|---|
| whatwg/url | `main` | `9dc3827fc722ac4af3f11061aa3e9adb44a17c8b` | `third-party/crawler-knowledge-sources/repos/batch-03-crawler-pipeline/url` |
| scrapy/scrapy | `2.17.0` | `feb692f552e3ed4533cf4e3af4809908d84cd763` | `third-party/crawler-knowledge-sources/repos/batch-03-crawler-pipeline/scrapy` |
| curl/curl | `curl-8_21_0` | `68720b4837284335b2d63cb358f8f6ce65f5bc55` | `third-party/crawler-knowledge-sources/repos/batch-03-crawler-pipeline/curl` |
| in-toto/in-toto | `v3.1.0` | `c82fe5d21aaa61c7f1a213db20a46f10bb3f411a` | `third-party/crawler-knowledge-sources/repos/batch-04-platform-assurance/in-toto` |
| slsa-framework/slsa | `v1.2` | `19e4e2f005f871270c4f555fc47afecfb37f3efe` | `third-party/crawler-knowledge-sources/repos/batch-04-platform-assurance/slsa` |
| ossf/osv-schema | `v1.8.0` | `b4f3e11785fd0e13636bcff3884766866d6dc8c6` | `third-party/crawler-knowledge-sources/repos/batch-04-platform-assurance/osv-schema` |

---

## URL 与 DNS 校验

### EC-URL-001 URL 解析语义

- **知识声明**：WHATWG URL 规范定义 URL 的标准解析语义；URL 的安全性是其运行环境的函数，渲染、解释和传递 URL 时须谨慎，接收方不得信任发送方的 URL（可能来自不受信任来源）。
- **证据类型/等级**：规范证据（官方规范）。
- **来源身份**：whatwg/url（`main`）。
- **版本/ref/Commit**：`main`；`9dc3827fc722ac4af3f11061aa3e9adb44a17c8b`。
- **原始位置**：`url.bs` §"Security considerations"、§"URL parsing"。
- **支持说明**：规范原文规定 URL 安全性依赖环境，传递 URL 时 B 应不信任 A；URL 可能来自不受信任来源。
- **适用条件**：诊断 URL 处理缺陷、不可信 URL 输入导致的 SSRF/数据泄露风险。
- **限制**：URL 解析实现可能偏离规范；本卡描述规范语义，具体实现行为以同版本源码为准。
- **关联 Skill**：crawler-enforce-security。
- **状态**：有效。

### EC-URL-002 host 解析与 IDNA

- **知识声明**：WHATWG URL 规范定义 host parser（含 IPv6/IPv4 校验）与 IDNA 处理；host 是判断 URL 指向域与地址的关键，host 混淆（相似字符、不可见控制字符）可能导致攻击面。
- **证据类型/等级**：规范证据（官方规范）。
- **来源身份**：whatwg/url（`main`）。
- **版本/ref/Commit**：`main`；`9dc3827fc722ac4af3f11061aa3e9adb44a17c8b`。
- **原始位置**：`url.bs` §"Host parsing"、§"IDNA"、§"Hosts (domains and IP addresses)"。
- **支持说明**：规范原文定义 host parser 步骤（IPv6-unclosed 等校验）与 host 混淆风险（1/l/I、0/O、U+202A 不可见字符）。
- **适用条件**：诊断 host 校验缺失、host 混淆绕过、IDNA 处理错误。
- **限制**：host 解析与 IDNA 实现依运行时而定；本卡描述规范要求的解析语义。
- **关联 Skill**：crawler-enforce-security。
- **状态**：有效。

### EC-URL-003 私网与环回地址判定

- **知识声明**：URL 指向的目标 host 解析为 IP 地址后，需要判定是否属于私网/环回地址（如 127.0.0.1、10.x、192.168.x），以识别 SSRF 到内部服务的风险。
- **证据类型/等级**：规范证据＋实现证据。
- **来源身份**：whatwg/url（`main`）；scrapy/scrapy（`2.17.0`）。
- **版本/ref/Commit**：`main`；`9dc3827fc722ac4af3f11061aa3e9adb44a17c8b`；scrapy `2.17.0` `feb692f552e3ed4533cf4e3af4809908d84cd763`。
- **原始位置**：whatwg/url `url.bs`（host 解析/IP 地址）；scrapy `downloadermiddlewares/redirect.py`（重定向目标校验）。
- **支持说明**：SSRF 防护要求把 URL 解析到 host/IP 后检查私网范围；重定向中间件通过 `safe_url_string` 与 scheme 校验防止跳转到非 http/https。
- **适用条件**：诊断 SSRF 到私网/环回地址、重定向到内部服务、URL 目标未校验。
- **限制**：私网范围判定依赖具体部署网络；DNS rebinding 等高级绕过需结合防御综合评估。
- **关联 Skill**：crawler-enforce-security。
- **状态**：有效。

---

## 重定向安全

### EC-REDIR-001 重定向状态码处理

- **知识声明**：scrapy RedirectMiddleware 仅对带 `Location` 头且状态码为 301/302/303/307/308 的响应处理重定向；重定向目标经 `safe_url_string` 规范化并校验 scheme 仅允许 http/https；非 http/https scheme 的直接返回原响应。
- **证据类型/等级**：实现证据（同版本官方源码）。
- **来源身份**：scrapy/scrapy（`2.17.0`）。
- **版本/ref/Commit**：`2.17.0`；`feb692f552e3ed4533cf4e3af4809908d84cd763`。
- **原始位置**：`scrapy/downloadermiddlewares/redirect.py` `process_response`。
- **支持说明**：源码检查 `response.status not in {301,302,303,307,308}` 则返回原响应；`safe_url_string` 规范化 Location；`urlparse_cached(redirected).scheme not in {"http","https"}` 则返回原响应。
- **适用条件**：诊断重定向目标未校验、scheme 绕过（如 javascript:/file: 跳转）、重定向链安全问题。
- **限制**：本卡描述 scrapy 2.17.0 的具体实现行为；其他框架实现可能不同。
- **关联 Skill**：crawler-enforce-security。
- **状态**：有效。

### EC-REDIR-002 重定向限制与 meta-refresh

- **知识声明**：scrapy 重定向中间件支持 meta-refresh 重定向检测、`REDIRECT_MAX_TIMES` 重定向次数限制，以及 `dont_redirect`/`handle_httpstatus_list` 控制；重定向到非 http/https scheme 时不跟进。
- **证据类型/等级**：实现证据（同版本官方源码）。
- **来源身份**：scrapy/scrapy（`2.17.0`）。
- **版本/ref/Commit**：`2.17.0`；`feb692f552e3ed4533cf4e3af4809908d84cd763`。
- **原始位置**：`scrapy/downloadermiddlewares/redirect.py`（`max_redirect_times`、`get_meta_refresh`）；`scrapy/utils/response.py` `get_meta_refresh`。
- **支持说明**：源码定义 `self.max_redirect_times`（`REDIRECT_MAX_TIMES`）与 `get_meta_refresh`（meta-refresh 解析）。
- **适用条件**：诊断重定向次数未限制、meta-refresh 重定向绕过、重定向链风险。
- **限制**：meta-refresh 检测实现依赖 `scrapy.utils.response`；本卡描述 scrapy 2.17.0 行为。
- **关联 Skill**：crawler-enforce-security。
- **状态**：有效。

---

## 密钥与凭据管理

### EC-SEC-001 密钥与凭据处理卫生

- **知识声明**：爬虫项目中的密钥、Cookie、认证请求头、代理凭据、环境变量中的秘密不得硬编码到配置文件或写入日志；应按环境变量注入/密钥存储方式管理，落盘前脱敏（主决策日志 §36）。
- **证据类型/等级**：工程证据＋决策要求。
- **来源身份**：主决策日志 §36（敏感信息脱敏）；in-toto（`SECURITY.md` 安全报告流程）。
- **版本/ref/Commit**：in-toto `v3.1.0`；`c82fe5d21aaa61c7f1a213db20a46f10bb3f411a`。
- **原始位置**：`docs/superpowers/brainstorming/2026-07-31-crawler-knowledge-skills-decision-log.md` §36；in-toto `SECURITY.md`。
- **支持说明**：决策日志 §36 要求交接记录与普通证据中禁止保存密钥等秘密，落盘前脱敏；in-toto SECURITY.md 规定安全漏洞通过保密渠道报告。
- **适用条件**：诊断密钥硬编码、日志泄露凭据、环境变量秘密泄露、安全报告渠道。
- **限制**：密钥管理方案（vault/KMS/环境变量）取决于项目基础设施；本卡描述脱敏底线与保密报告纪律。
- **关联 Skill**：crawler-enforce-security。
- **状态**：有效。

### EC-SEC-002 敏感信息脱敏与隔离保留

- **知识声明**：确因故障取证必须保留的敏感原件，只能隔离、加密保存并限制访问；普通结构化记录不得复制敏感原件内容，只能通过内容哈希引用获准保留的隔离证据（主决策日志 §36）。
- **证据类型/等级**：决策要求。
- **来源身份**：主决策日志 §36。
- **版本/ref/Commit**：不适用（本地项目决策）。
- **原始位置**：`docs/superpowers/brainstorming/2026-07-31-crawler-knowledge-skills-decision-log.md` §36。
- **支持说明**：决策日志 §36 规定敏感原件隔离/加密/限访问，普通记录以内容哈希引用。
- **适用条件**：诊断中遇到敏感证据时决定保存与引用方式。
- **限制**：隔离存储的物理实现取决于项目基础设施；本卡描述保留与引用的边界纪律。
- **关联 Skill**：crawler-enforce-security。
- **状态**：有效。

---

## 依赖供应链

### EC-SUPPLY-001 OSV 漏洞数据格式

- **知识声明**：OSV（Open Source Vulnerability）格式 v1.8.0 是描述开源包漏洞的标准交换格式，定义 schema_version、id、modified、affected（含 package/ecosystem/ranges/versions）、references 等字段，供漏洞数据库导出与交叉校验。
- **证据类型/等级**：规范证据（官方规范）。
- **来源身份**：ossf/osv-schema（`v1.8.0`）。
- **版本/ref/Commit**：`v1.8.0`；`b4f3e11785fd0e13636bcff3884766866d6dc8c6`。
- **原始位置**：`docs/schema.md`（OSV v1.8.0）；`proto/vulnerability.proto`。
- **支持说明**：`docs/schema.md` 定义 JSON 格式字段与语义；`proto/vulnerability.proto` 定义对应 protobuf 结构。
- **适用条件**：诊断依赖漏洞数据读取/校验、漏洞记录结构不一致、供应链漏洞评估。
- **限制**：OSV 格式的字段语义以 v1.8.0 为准；不同版本字段可能演进。
- **关联 Skill**：crawler-enforce-security。
- **状态**：有效。

### EC-SUPPLY-002 供应链安全要求

- **知识声明**：SLSA v1.2 定义软件供应链安全等级要求：生产者必须选择可达成目标构建等级的构建平台、遵循一致构建流程、分发 provenance（来源证明）；构建平台必须强化安全控制并生成 provenance。
- **证据类型/等级**：规范证据（官方规范）。
- **来源身份**：slsa-framework/slsa（`v1.2`）。
- **版本/ref/Commit**：`v1.2`；`19e4e2f005f871270c4f555fc47afecfb37f3efe`。
- **原始位置**：`docs/spec/v1.0/requirements.md` §"Overview"、§"Producer"、§"Build Platform"。
- **支持说明**：规范原文规定 Producer 的 Choose an appropriate build platform / Follow a consistent build process / Distribute provenance 三项要求，以及 Build platform 的 Provenance generation 要求（L1/L2/L3）。
- **适用条件**：诊断依赖供应链缺少 provenance、构建流程不一致、来源证明缺失。
- **限制**：SLSA 等级（L1/L2/L3）为渐进安全要求；本卡描述 v1.2 要求。
- **关联 Skill**：crawler-enforce-security。
- **状态**：有效。

### EC-SUPPLY-003 依赖来源与锁文件

- **知识声明**：依赖供应链风险评估依赖锁文件/依赖清单与来源证明的交叉核对；锁文件固定依赖版本，provenance 证明产物来源，二者结合可识别依赖投毒或来源不明依赖。
- **证据类型/等级**：工程证据（官方指南）。
- **来源身份**：slsa-framework/slsa（`v1.2`）`docs/`。
- **版本/ref/Commit**：`v1.2`；`19e4e2f005f871270c4f555fc47afecfb37f3efe`。
- **原始位置**：`docs/spec/draft/dependency-track.md`、`docs/spec/draft/distributing-provenance.md`。
- **支持说明**：slsa 文档讨论依赖跟踪与 provenance 分发作为供应链验证手段。
- **适用条件**：诊断依赖来源不明、锁文件缺失、provenance 未分发。
- **限制**：工程证据只用于诊断步骤与验证方法；不得单独升格为强制规范。
- **关联 Skill**：crawler-enforce-security。
- **状态**：有效。

---

## 隔离执行与访问边界

### EC-ISOL-001 隔离验证流程

- **知识声明**：in-toto 通过布局（layout）、链接（link）、签名验证构建软件供应链证据链；验证流程在隔离环境中执行，不信任未经校验的第三方内容，确保产物完整性与来源可信。
- **证据类型/等级**：实现证据（同版本官方源码）。
- **来源身份**：in-toto/in-toto（`v3.1.0`）。
- **版本/ref/Commit**：`v3.1.0`；`c82fe5d21aaa61c7f1a213db20a46f10bb3f411a`。
- **原始位置**：`in_toto/in_toto_verify.py`、`in_toto/verifylib.py`。
- **支持说明**：源码实现布局/链接/签名验证流程，确认证据链完整。
- **适用条件**：诊断第三方内容未经校验直接执行、证据链验证缺失、隔离执行不足。
- **限制**：in-toto 验证只证明证据链，不替代沙箱执行；本卡描述验证流程语义。
- **关联 Skill**：crawler-enforce-security。
- **状态**：有效。

### EC-ISOL-002 robots.txt 与公开数据访问边界

- **知识声明**：scrapy RobotsTxtMiddleware 在启用时检查 `robots.txt` 策略，对被禁止的 URL 抛 `IgnoreRequest`（"Forbidden by robots.txt"）；`dont_obey_robotstxt` 可显式跳过，但默认应尊重公开数据访问边界。
- **证据类型/等级**：实现证据（同版本官方源码）。
- **来源身份**：scrapy/scrapy（`2.17.0`）。
- **版本/ref/Commit**：`2.17.0`；`feb692f552e3ed4533cf4e3af4809908d84cd763`。
- **原始位置**：`scrapy/downloadermiddlewares/robotstxt.py`。
- **支持说明**：源码检查 `rp.allowed(request.url, useragent)`，不通过则抛 `IgnoreRequest`；跳过需显式 `dont_obey_robotstxt`。
- **适用条件**：诊断跳过 robots.txt 限制、访问受限路径、公开数据边界越界。
- **限制**：robots.txt 是礼仪性协议，非强制访问控制；本卡描述 scrapy 2.17.0 实现行为与边界纪律。
- **关联 Skill**：crawler-enforce-security。
- **状态**：有效。
