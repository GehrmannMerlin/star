# 爬虫知识资料库首遍资料审查——第 4 批：平台保障

> 审查日期：2026-07-31
>
> 对应一级方向：平台保障
>
> 对应 Skills：`crawler-manage-evidence-storage`、`crawler-observe-runtime`、`crawler-enforce-security`、`crawler-test-regressions`
>
> 状态：等待用户核对
>
> 边界：本文记录联网审查得到的当前事实与 Agent 建议，不是已确认决策。未下载、克隆或执行任何第三方源码，也未设计或实施 Skill，未修改爬虫代码、数据库、容器、证据文件或运行环境。

## 1. 审查口径

- 本批只收集跨技术栈的证据完整性与来源链、日志／指标／Trace 关联、安全与合规审查、回归与故障注入方法。
- PostgreSQL 与 Docker 的项目锁定版本、配置、API、SQL、镜像、卷和 WSL 行为留给第 5 批重点技术栈；本批资料不得覆盖其版本化实现依据。
- `crawler-manage-evidence-storage`、`crawler-observe-runtime`、`crawler-enforce-security` 和 `crawler-test-regressions` 都是面向 Agent 的诊断、审查和验证辅助能力，不是数据库、监控后端、安全扫描器或测试平台运行组件。
- Star、最后推送时间、最新 Release 和 GitHub `size` 字段均为 2026-07-31 的观察值，后续会变化。
- “预计体积”使用 GitHub `size` 字段换算，只是完整仓库体积风险代理，不等于第二遍固定 Commit 后的实际浅克隆大小。
- “准入”表示 Agent 建议允许进入第二遍资格范围；只有用户核对本报告且全部第一遍批次完成后，才可固定 Commit 并浅克隆。
- “候选”只保留元数据；“拒绝”记录排除理由。两者均不得下载，也不得作为 Skill 修复依据。
- 即使源码获准进入第二遍，仍只允许作为只读知识依据；不得安装依赖、构建、运行服务、扫描器、代理、混沌实验、测试套件或示例程序。

## 2. Agent 建议：准入的权威在线资料（未确认）

| 来源 | 官方性与适用版本 | 用途 | 对应 Skill | 使用边界 |
|---|---|---|---|---|
| [W3C PROV-O](https://www.w3.org/TR/prov-o/) | W3C Recommendation；2013-04-30 | Entity、Activity、Agent 及生成、使用、归属关系的可交换来源模型 | `crawler-manage-evidence-storage` | 年代较早但规范稳定；只选用满足项目证据链的最小术语，不建设通用语义网平台 |
| [RFC 8493：BagIt](https://www.rfc-editor.org/info/rfc8493/) | RFC Editor 官方；BagIt 1.0，2018 | Payload、Manifest、Checksum、包完整性、文件名与跨平台保存边界 | `crawler-manage-evidence-storage`、`crawler-test-regressions` | 是证据打包与验证参考，不直接规定 Stellaris 目录结构 |
| [RFC 8785：JSON Canonicalization Scheme](https://www.rfc-editor.org/rfc/rfc8785.html) | RFC Editor 官方；2020 Informational | JSON 的确定性表示、哈希和签名前规范化 | `crawler-manage-evidence-storage` | 只有符合 I-JSON 等前提时才能使用；不得把重新序列化后的文本冒充原始证据字节 |
| [OpenTelemetry Specification](https://opentelemetry.io/docs/specs/otel/) | OpenTelemetry 官方；1.59.0，OTLP 1.11.0 | Trace、Metric、Log、Resource、Context、协议与稳定性边界 | `crawler-observe-runtime` | 规范定义信号和关联，不要求项目部署 Collector 或任何观测后端 |
| [OpenTelemetry Logs Data Model](https://opentelemetry.io/docs/specs/otel/logs/data-model/) | OpenTelemetry 官方；Stable | 事件时间与观察时间、TraceId、SpanId、Resource、Severity 和属性 | `crawler-observe-runtime`、`crawler-manage-evidence-storage` | 日志关联只证明事件同属上下文，不自动证明业务根因 |
| [W3C Trace Context](https://www.w3.org/TR/trace-context/) | W3C Recommendation；2021-11-23 | `traceparent`、`tracestate`、跨组件关联及安全／隐私考虑 | `crawler-observe-runtime` | Trace ID 是关联标识，不是访问凭据、完整性签名或业务实体主键 |
| [OpenMetrics 1.0](https://github.com/prometheus/OpenMetrics/blob/main/specification/OpenMetrics.md) | Prometheus／OpenMetrics 官方；1.0.0 | Counter、Gauge、Histogram、Label、Exemplar、时间序列与传输格式 | `crawler-observe-runtime` | 指标聚合会丢失事件细节；不得以单一指标替代日志、Trace 或原始证据 |
| [OWASP SSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html) | OWASP 官方；滚动更新 | URL、域名、IP、DNS、协议、网络层 allowlist 与重绑定风险 | `crawler-enforce-security` | 只用于防御；不得从引用资料衍生外部攻击、绕过或扫描步骤 |
| [OWASP ASVS](https://owasp.org/www-project-application-security-verification-standard/) | OWASP 官方；5.0.0，2025-05-30 | 输入、文件、通信、配置、日志、依赖和验证要求的可追溯检查项 | `crawler-enforce-security`、`crawler-test-regressions` | ASVS 是通用 Web 应用标准，必须筛选与爬虫相关的条目，不把全部要求机械套用 |
| [NIST SP 800-218 SSDF 1.1](https://csrc.nist.gov/pubs/sp/800/218/final) | NIST 官方；2022 Final | 准备、保护软件、生产安全软件和响应漏洞的开发过程基线 | `crawler-enforce-security`、`crawler-test-regressions` | 高层实践不能替代具体漏洞证据和项目批准门 |
| [MITRE CWE-918：SSRF](https://cwe.mitre.org/data/definitions/918.html) | MITRE CWE 官方；审查时 CWE 4.20 | SSRF 定义、后果、检测和缓解分类 | `crawler-enforce-security` | CWE 分类用于识别和沟通，不提供对外部目标进行利用验证的授权 |
| [OSV Schema](https://ossf.github.io/osv-schema/) | OpenSSF 官方；源码 Release v1.8.0，在线 Schema 当前示例为 1.2.0 | 受影响包、版本范围、修复事件、严重性和来源引用 | `crawler-enforce-security`、`crawler-test-regressions` | 漏洞记录必须与项目实际依赖、锁文件和版本相交后才能形成结论 |
| [SLSA 1.2](https://slsa.dev/spec/v1.2/) | Linux Foundation／SLSA 官方；Approved 1.2 | 来源、构建、证明、验证属性和供应链威胁模型 | `crawler-enforce-security`、`crawler-manage-evidence-storage` | 只吸收与第三方资料及项目制品来源相关的部分，不要求建设 SLSA 平台 |
| [JSON Schema Draft 2020-12](https://json-schema.org/draft/2020-12) | JSON Schema 官方；2020-12，发布于 2022-06-16 | Schema、验证词汇、动态引用、格式断言与输出结构 | `crawler-test-regressions`、`crawler-manage-evidence-storage` | Schema 合法不等于业务数据正确；必须结合金标和领域断言 |
| [JSON Schema Test Suite](https://github.com/json-schema-org/JSON-Schema-Test-Suite) | JSON Schema 官方；稳定 `main` 覆盖 2020-12 等发布版 | 语言无关的正反例、版本目录、远程引用与一致性测试结构 | `crawler-test-regressions` | 测试数据是规范符合性依据，不是 Stellaris 字段金标 |
| [Pact Specification](https://docs.pact.io/implementation_guides/pact_specification) | Pact Foundation 官方；当前规范 v4 | HTTP／消息交互、Provider State、匹配规则与跨语言契约一致性 | `crawler-test-regressions` | 契约测试只覆盖约定的交互，不证明页面内容、UI 或全部业务行为正确 |
| [wpt.fyi](https://wpt.fyi/about) | WPT 官方结果面板；每日运行 Chrome、Edge、Firefox、Safari | 跨浏览器规范测试、互操作差异与回归证据组织方法 | `crawler-test-regressions`、`crawler-observe-runtime` | 在线结果可作浏览器差异证据；完整 WPT 仓库未直接准入，也不在本阶段执行 |
| [Google SRE：Testing for Reliability](https://sre.google/sre-book/testing-reliability/) | Google SRE 官方；CC BY-NC-ND 4.0 | 测试层级、回放、统计不确定性、故障注入、Flaky Test 与发布阻断 | `crawler-test-regressions` | 只引用和提炼事实／方法，不复制或改编大段受限文本；生产破坏实验不在 Skill 权限内 |

## 3. Agent 建议：准入清单（未确认）

| 仓库 | 官方性／作用 | Star | 维护状态 | 许可证 | 适用版本 | GitHub 体积代理 | 对应 Skill | 建议理由 |
|---|---|---:|---|---|---|---:|---|---|
| [in-toto/in-toto](https://github.com/in-toto/in-toto) | in-toto 官方；可验证供应链步骤、Link／Layout 元数据与签名检查 | 1,024 | 活跃；最后推送 2026-07-20 | Apache-2.0；已直接核对根许可证 | v3.1.0 | 约 3.2 MiB | 证据存储、安全 | 体积小，能为来源声明、步骤证据、材料／产物哈希和验证失败提供可审查案例，不要求运行 in-toto 工具链 |
| [open-telemetry/opentelemetry-specification](https://github.com/open-telemetry/opentelemetry-specification) | OpenTelemetry 官方规范、数据模型、协议和一致性要求 | 4,295 | 活跃；最后推送 2026-07-31 | Apache-2.0 | v1.59.0 | 约 20.5 MiB | `crawler-observe-runtime` | 一处覆盖日志、指标、Trace、Context 和 Resource 的跨语言规范，可替代收集多个观测后端源码 |
| [prometheus/OpenMetrics](https://github.com/prometheus/OpenMetrics) | Prometheus／OpenMetrics 官方规范源码与模式文件 | 2,534 | 活跃；最后推送 2026-07-19 | Apache-2.0 | v1.0.0；活跃 `main` 同时记录后续规范工作 | 约 3.6 MiB | `crawler-observe-runtime` | 提供指标类型、Label、Exemplar、编码与验证边界，不引入 Prometheus 服务运行时 |
| [ossf/osv-schema](https://github.com/ossf/osv-schema) | OpenSSF 官方漏洞交换格式、Schema、测试与示例 | 262 | 活跃；最后推送 2026-07-30 | Apache-2.0 | v1.8.0 | 约 1.3 MiB | 安全、测试 | Star 低但官方性和直接相关性强，可准确组织依赖版本、修复区间与来源证据 |
| [slsa-framework/slsa](https://github.com/slsa-framework/slsa) | SLSA 官方规范源码；来源、构建、证明和验证要求 | 1,898 | 活跃；最后推送 2026-07-29 | Community Specification License 1.0；已直接核对根许可证 | Approved 1.2；第二遍固定对应 Commit | 约 18.3 MiB | 安全、证据存储 | 提供供应链证明与验证模型，许可证明确；只沉淀规范知识，不建设或运行证明平台 |
| [json-schema-org/JSON-Schema-Test-Suite](https://github.com/json-schema-org/JSON-Schema-Test-Suite) | JSON Schema 官方语言无关符合性测试套件 | 740 | 活跃；最后推送 2026-07-30 | MIT | 稳定 `main`；覆盖 Draft 2020-12 等版本 | 约 1.9 MiB | `crawler-test-regressions` | Star 不足 1000，但官方、体积小且直接提供正反例与版本化测试组织方式 |
| [pact-foundation/pact-specification](https://github.com/pact-foundation/pact-specification) | Pact Foundation 官方跨语言契约格式和匹配测试 | 317 | 规范稳定；最后推送 2024-04-11 | MIT | Pact Specification v4；无独立 Release | 约 0.3 MiB | `crawler-test-regressions` | 维护节奏慢但规范仍为当前 v4，提供 HTTP 与消息契约的语言无关基准，不引入 Pact Broker 运行时 |
| [Shopify/toxiproxy](https://github.com/Shopify/toxiproxy) | Shopify 官方；受控 TCP 故障注入、延迟、断连和带宽异常案例 | 12,205 | 活跃；最后推送 2026-07-28 | MIT | v2.12.0；同时固定活跃分支 Commit | 约 3.5 MiB | 测试、可观测性 | 小体积集中覆盖网络退化回归场景；第二遍仍只读源码与测试，不启动代理或对外部站点注入故障 |

准入仓库 GitHub 体积代理合计约 **52.8 MiB（0.052 GiB）**。该数值不是实际浅克隆大小；本批目前不触发任何下载。

## 4. Agent 建议：候选清单（未确认，不下载）

| 仓库 | Star | 维护状态 | 许可证 | 适用版本 | GitHub 体积代理 | 对应 Skill | 暂不准入原因 |
|---|---:|---|---|---|---:|---|---|
| [w3c/prov](https://github.com/w3c/prov) | 1 | 活跃；最后推送 2026-07-03 | GitHub 为 `NONE`，未确认根仓库复制许可 | 无正式 Release；滚动 `main` | 约 191.6 MiB | `crawler-manage-evidence-storage` | 官方新整合仓库但 Star、许可和体积信号不足；W3C PROV Recommendation 在线资料已满足当前需要 |
| [LibraryOfCongress/bagit-python](https://github.com/LibraryOfCongress/bagit-python) | 263 | 活跃；最后推送 2026-06-18 | GitHub 为 `NONE`，根目录未找到独立许可证文件 | v1.9.0 | 约 1.5 MiB | 证据存储、测试 | 官方性和相关性高，但不能仅凭美国政府机构身份推断可复制许可；先使用 RFC 8493 |
| [sigstore/rekor](https://github.com/sigstore/rekor) | 1,184 | 活跃；最后推送 2026-07-28 | Apache-2.0 | v1.5.3 | 约 17.4 MiB | 证据存储、安全 | 透明日志和包含证明有参考价值，但属于可运行服务，当前证据链骨架可由 PROV、in-toto 和 SLSA 覆盖 |
| [prometheus/prometheus](https://github.com/prometheus/prometheus) | 65,376 | 活跃；最后推送 2026-07-30 | Apache-2.0 | v3.13.2 | 约 280.2 MiB | `crawler-observe-runtime` | 高质量但为完整监控系统运行时；本批只需 OpenMetrics 与 OpenTelemetry 规范源码 |
| [open-telemetry/opentelemetry-collector](https://github.com/open-telemetry/opentelemetry-collector) | 7,317 | 活跃；最后推送 2026-07-30 | Apache-2.0 | v0.157.0 | 约 70.7 MiB | `crawler-observe-runtime` | Collector 生命周期和重试案例有价值，但本 Skill 不部署采集服务，先以规范为主 |
| [jaegertracing/jaeger](https://github.com/jaegertracing/jaeger) | 23,045 | 活跃；最后推送 2026-07-30 | Apache-2.0 | v2.20.0 | 约 39.9 MiB | `crawler-observe-runtime` | 完整 Trace 后端与存储实现超出当前最小知识范围，且与 OpenTelemetry 规范重复 |
| [OWASP/CheatSheetSeries](https://github.com/OWASP/CheatSheetSeries) | 32,722 | 活跃；最后推送 2026-07-30 | CC-BY-SA-4.0 | 无正式 Release；滚动 `master` | 约 2.31 GiB | `crawler-enforce-security` | 在线单页资料权威且可按需引用，但完整历史体积过大；不为少量爬虫相关条目下载整个仓库 |
| [OWASP/ASVS](https://github.com/OWASP/ASVS) | 3,527 | 活跃；最后推送 2026-07-30 | CC-BY-SA-4.0 | 5.0.0；GitHub `latest` 为滚动构建 | 约 155.1 MiB | 安全、测试 | 规范权威但完整仓库体积较大；当前官方在线版足够，后续若需离线逐条映射再复审 |
| [aquasecurity/trivy](https://github.com/aquasecurity/trivy) | 37,155 | 活跃；最后推送 2026-07-30 | Apache-2.0 | v0.72.0 | 约 916.0 MiB | `crawler-enforce-security` | 多类型扫描器覆盖广但体积大、运行时化强；本批已有 OSV Schema 与供应链规范，不执行扫描器 |
| [google/osv-scanner](https://github.com/google/osv-scanner) | 10,711 | 活跃；最后推送 2026-07-30 | Apache-2.0 | v2.4.0 | 约 41.4 MiB | 安全、测试 | OSV 消费和修复建议实现有价值，但当前先保留语言无关 OSV Schema；待实际依赖诊断需要再升级 |
| [web-platform-tests/wpt](https://github.com/web-platform-tests/wpt) | 6,020 | 活跃；最后推送 2026-07-31 | GitHub 为 `NOASSERTION`，仓库内容存在多来源许可边界 | 滚动 `master`；自动合并标签不视为稳定 Release | 约 2.53 GiB | 测试、可观测性 | 官方且价值高，但体积、历史和许可边界复杂；先使用 wpt.fyi 在线结果和按规范定位的测试链接 |
| [wiremock/wiremock](https://github.com/wiremock/wiremock) | 7,314 | 活跃；最后推送 2026-07-30 | Apache-2.0 | 3.13.2 | 约 51.4 MiB | `crawler-test-regressions` | HTTP Stub、录制和故障响应案例有价值，但为 Java 运行时；项目栈具体 Mock 工具留到后续版本化资料 |

## 5. Agent 建议：拒绝清单（未确认，不下载）

| 仓库 | Star | 维护状态 | 许可证 | 适用版本 | GitHub 体积代理 | 对应 Skill | 拒绝原因 |
|---|---:|---|---|---|---:|---|---|
| [multiformats/cid](https://github.com/multiformats/cid) | 487 | 已归档；最后推送 2026-06-30 | GitHub 为 `NOASSERTION` | 无正式 Release | 约 0.06 MiB | `crawler-manage-evidence-storage` | 仓库已归档且许可证不明确；内容寻址原理可由哈希、Manifest、in-toto 和 SLSA 资料覆盖 |
| [grafana/loki](https://github.com/grafana/loki) | 28,647 | 活跃；最后推送 2026-07-31 | AGPL-3.0 | v3.7.4 | 约 490.4 MiB | `crawler-observe-runtime` | 完整日志后端、查询与分布式存储运行时，体积大且不提供本批不可替代的跨技术栈知识 |
| [projectdiscovery/nuclei](https://github.com/projectdiscovery/nuclei) | 30,110 | 活跃；最后推送 2026-07-30 | MIT | v3.11.0 | 约 44.1 MiB | `crawler-enforce-security` | 以外部漏洞扫描和模板执行为核心，容易越过“不得攻击外部网站”的硬边界；本 Skill 只做防御性审查和隔离验证 |
| [chaos-mesh/chaos-mesh](https://github.com/chaos-mesh/chaos-mesh) | 7,820 | 活跃；最后推送 2026-07-30 | Apache-2.0 | v2.8.3 | 约 71.4 MiB | 测试、可观测性 | Kubernetes 混沌平台运行时，操作破坏性强且与 Stellaris 当前最小故障注入知识需求不匹配 |
| [keploy/keploy](https://github.com/keploy/keploy) | 18,366 | 活跃；最后推送 2026-07-30 | Apache-2.0 | v3.6.4 | 约 229.5 MiB | `crawler-test-regressions` | 完整录制回放和测试生成平台，运行时化、体积大；JSON Schema、Pact 与受控 Toxiproxy 案例已覆盖当前最小骨架 |

## 6. 当前事实、Agent 推断与待确认项

### 当前事实

- 本批共审查 25 个有效仓库：8 个建议准入、12 个候选、5 个拒绝；其中 `multiformats/cid` 已归档，其余 24 个未归档。
- SLSA 当前 Approved 版本为 1.2；仓库无独立 GitHub Release，第二遍若获准必须固定与 1.2 内容对应的具体 Commit。
- OpenTelemetry 规范 Release 为 v1.59.0；规范明确各信号和组件具有不同成熟度，不能只凭“OpenTelemetry”名称假定全部稳定。
- `LibraryOfCongress/bagit-python` 根目录未找到独立许可证文件；本报告没有把机构身份推断成许可证。
- WPT 的 GitHub “最新 Release”是自动合并标签，不代表稳定版本；本报告按滚动 `master` 和 wpt.fyi 结果看待。
- OWASP Cheat Sheet、WPT、Trivy 三个仓库的 GitHub 体积代理合计约 5.73 GiB，均未直接准入。
- 本轮只读取官方网页、公共仓库元数据和三个根许可证位置，没有下载仓库、执行第三方代码、启动服务、扫描目标或运行故障注入。

### Agent 推断

- 8 个准入仓库和第 2 节权威在线资料形成平台保障的最小充分骨架：来源链与哈希、遥测数据模型、安全分类与供应链证明、语言无关测试和受控故障场景都有直接证据。
- OpenTelemetry Specification 与 OpenMetrics 足以支撑“发生了什么、如何关联”的跨平台知识；Prometheus、Collector、Jaeger 和 Loki 的完整运行时在当前阶段属于过度收集。
- OWASP 在线资料、NIST SSDF、CWE、OSV 和 SLSA 已覆盖主要安全审查层次；下载大型扫描器不会自动提高结论可靠性。
- Toxiproxy 的准入只表示其源码和测试可作为网络退化案例库，不授权启动代理、影响现有环境或向外部站点注入故障。

### 待用户核对

- 是否接受第 2、3、4、5 节中的权威在线资料、准入、候选和拒绝分类。
- 未获核对前，不把本批分类写入主决策日志，不固定 Commit、不浅克隆，也不进入下一批资料审查。
