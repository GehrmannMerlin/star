# 测试与回归证据卡（共享证据层）

> 本文件是共享可追溯证据层中与爬虫测试与回归验证相关的证据卡集合。每张卡表达一条可验证知识声明，绑定固定版本资料、原始位置与适用边界。
>
> 来源：批次 3 固定源码快照（locust）与批次 4 固定源码快照（pact-specification、JSON-Schema-Test-Suite、toxiproxy、in-toto），全部以 `third-party/crawler-knowledge-sources/manifest.md` 记录的 ref 与 Commit 为唯一版本基线。
>
> 证据等级：规范证据（官方规范/文档/Release）＞实现证据（同版本官方源码/测试）＞工程证据（官方运行指南/手册）＞案例证据（事故资料，只用于启发）。
>
> 维护规则：本文件由资料治理 Skill 按既定准入、许可证复核与版本固定流程维护；不得静默改写已固定证据卡，更新只通过新增修订进行。

## 来源身份与版本基线

| 仓库 | 权威 ref | Commit | 本地路径 |
|---|---|---|---|
| locustio/locust | `2.46.2` | `5493f2608a10c249233faa5d79955721326a2cb5` | `third-party/crawler-knowledge-sources/repos/batch-03-crawler-pipeline/locust` |
| pact-foundation/pact-specification | `master` | `2746817263962c3c470e2f16157153eb78c299bd` | `third-party/crawler-knowledge-sources/repos/batch-04-platform-assurance/pact-specification` |
| json-schema-org/JSON-Schema-Test-Suite | `23.1.0` | `ab4bd012fc9e536a55814f3f38e62bb28aa1dab3` | `third-party/crawler-knowledge-sources/repos/batch-04-platform-assurance/JSON-Schema-Test-Suite` |
| Shopify/toxiproxy | `v2.12.0` | `3ccd6a79cbc6c6a72b884d295ad314b75cdf3962` | `third-party/crawler-knowledge-sources/repos/batch-04-platform-assurance/toxiproxy` |
| in-toto/in-toto | `v3.1.0` | `c82fe5d21aaa61c7f1a213db20a46f10bb3f411a` | `third-party/crawler-knowledge-sources/repos/batch-04-platform-assurance/in-toto` |

---

## 单元/集成测试与断言

### TR-UNIT-001 Schema 校验语义作断言基础

- **知识声明**：JSON-Schema-Test-Suite 提供跨版本（draft3-draft2020-12）的 Schema 校验测试集，定义数据校验语义与边界；可作单元/集成测试断言的校验基础。
- **证据类型/等级**：规范证据（测试套件）。
- **来源身份**：json-schema-org/JSON-Schema-Test-Suite（`23.1.0`）。
- **版本/ref/Commit**：`23.1.0`；`ab4bd012fc9e536a55814f3f38e62bb28aa1dab3`。
- **原始位置**：`tests/`（draft3、draft4、draft6、draft7、draft2019-09、draft2020-12、draft-next、latest）。
- **支持说明**：测试套件覆盖各草案版本关键字语义，可作为断言结构与金标比对基础。
- **适用条件**：诊断测试断言缺失、Schema 校验语义不符、断言结构不完整。
- **限制**：不同草案版本关键字语义不同；本卡描述测试套件覆盖的规范语义。
- **关联 Skill**：crawler-test-regressions。
- **状态**：有效。

### TR-UNIT-002 断言结构跨草案版本

- **知识声明**：JSON-Schema-Test-Suite 各草案目录（draft7 等）包含按关键字组织的测试文件（additionalProperties、allOf、const、enum、format 等），可作跨版本断言结构参照。
- **证据类型/等级**：规范证据（测试套件）。
- **来源身份**：json-schema-org/JSON-Schema-Test-Suite（`23.1.0`）。
- **版本/ref/Commit**：`23.1.0`；`ab4bd012fc9e536a55814f3f38e62bb28aa1dab3`。
- **原始位置**：`tests/draft7/`（additionalItems.json、allOf.json、const.json、enum.json 等）。
- **支持说明**：测试套件按关键字组织断言文件，展示结构化断言的组织方式。
- **适用条件**：诊断断言组织零散、关键字覆盖不足、跨版本断言不一致。
- **限制**：具体关键字语义以对应草案为准；本卡描述断言组织结构。
- **关联 Skill**：crawler-test-regressions。
- **状态**：有效。

### TR-UNIT-003 测试套件组织与可复现

- **知识声明**：JSON-Schema-Test-Suite 以可复现的结构化测试集（tests/＋output-tests/）组织，测试用例可跨实现复现；可复现的测试套件是回归测试的基础。
- **证据类型/等级**：规范证据（测试套件）。
- **来源身份**：json-schema-org/JSON-Schema-Test-Suite（`23.1.0`）。
- **版本/ref/Commit**：`23.1.0`；`ab4bd012fc9e536a55814f3f38e62bb28aa1dab3`。
- **原始位置**：`tests/`、`output-tests/`、`test-schema.json`。
- **支持说明**：测试套件提供结构化测试输入与预期输出，支持跨实现复现。
- **适用条件**：诊断测试不可复现、无结果证据、回归测试套件缺失。
- **限制**：本卡描述测试套件的组织范式，具体测试实现依项目而定。
- **关联 Skill**：crawler-test-regressions。
- **状态**：有效。

---

## 回放测试与金标数据

### TR-REPLAY-001 金标数据比对

- **知识声明**：JSON-Schema-Test-Suite 的 `output-tests/` 提供输出比对用例（输入 Schema＋数据→预期输出），可作金标数据比对（golden comparison）的基础。
- **证据类型/等级**：规范证据（测试套件）。
- **来源身份**：json-schema-org/JSON-Schema-Test-Suite（`23.1.0`）。
- **版本/ref/Commit**：`23.1.0`；`ab4bd012fc9e536a55814f3f38e62bb28aa1dab3`。
- **原始位置**：`output-tests/`（draft2019-09、draft2020-12、draft-next）。
- **支持说明**：`output-tests/` 定义校验输出比对，展示金标数据的组织方式。
- **适用条件**：诊断回放测试缺失、金标数据生成方式错误、输出比对不一致。
- **限制**：金标数据必须基于已保存证据生成，不依赖实时抓取。
- **关联 Skill**：crawler-test-regressions。
- **状态**：有效。

### TR-REPLAY-002 已保存证据验证

- **知识声明**：in-toto 通过布局/链接/签名验证构建证据链，验证流程可对已保存证据执行只读验证；回放测试基于已保存证据验证历史行为，不依赖实时抓取。
- **证据类型/等级**：实现证据（同版本官方源码）。
- **来源身份**：in-toto/in-toto（`v3.1.0`）。
- **版本/ref/Commit**：`v3.1.0`；`c82fe5d21aaa61c7f1a213db20a46f10bb3f411a`。
- **原始位置**：`in_toto/in_toto_verify.py`、`in_toto/verifylib.py`。
- **支持说明**：源码实现布局/链接/签名验证流程，支持对已保存证据的只读验证。
- **适用条件**：诊断回放测试依赖实时抓取、已保存证据验证缺失。
- **限制**：in-toto 验证只证明证据链，不替代沙箱执行；回放测试应基于离线证据。
- **关联 Skill**：crawler-test-regressions。
- **状态**：有效。

---

## 契约测试

### TR-CONTRACT-001 契约测试语义

- **知识声明**：Pact 契约测试定义消费者（consumer）与提供者（provider）之间的契约：消费者侧启动 mock service 定义 interactions（请求→预期响应），验证接口一致性。
- **证据类型/等级**：规范证据（官方规范）。
- **来源身份**：pact-foundation/pact-specification（`master`）。
- **版本/ref/Commit**：`master`；`2746817263962c3c470e2f16157153eb78c299bd`。
- **原始位置**：`implementation-guidelines/README.md` §"Consumer"。
- **支持说明**：规范原文定义 Pact DSL 与 mock service 交互定义（method/path/query/status/headers/body）。
- **适用条件**：诊断契约测试缺失、生产者/消费者接口不一致、mock 交互定义错误。
- **限制**：本卡描述 Pact 契约测试语义，具体实现依语言/框架而定。
- **关联 Skill**：crawler-test-regressions。
- **状态**：有效。

### TR-CONTRACT-002 生产者/消费者接口一致性

- **知识声明**：Pact 契约测试用于验证生产者（provider）与消费者（consumer）之间的接口一致性；契约变化需双方同步更新，接口漂移会导致契约测试失败。
- **证据类型/等级**：规范证据（官方规范）。
- **来源身份**：pact-foundation/pact-specification（`master`）。
- **版本/ref/Commit**：`master`；`2746817263962c3c470e2f16157153eb78c299bd`。
- **原始位置**：`implementation-guidelines/README.md`。
- **支持说明**：规范原文描述契约如何定义并用于生产者/消费者验证。
- **适用条件**：诊断接口漂移、契约不同步、生产者/消费者不一致。
- **限制**：本卡描述契约一致性原理；具体契约格式以 pact 规范版本为准。
- **关联 Skill**：crawler-test-regressions。
- **状态**：有效。

---

## 故障注入与性能测试

### TR-FAULT-001 受控网络退化案例

- **知识声明**：toxiproxy 提供确定性网络条件模拟（延迟、带宽、超时、断开、数据切片等 toxic），用于测试环境验证应用在受控网络退化下的行为。
- **证据类型/等级**：实现证据（同版本官方源码）。
- **来源身份**：Shopify/toxiproxy（`v2.12.0`）。
- **版本/ref/Commit**：`v2.12.0`；`3ccd6a79cbc6c6a72b884d295ad314b75cdf3962`。
- **原始位置**：`toxics/`（bandwidth.go、latency.go、limit_data.go、reset_peer.go、slicer.go、slow_close.go、timeout.go）；`README.md`。
- **支持说明**：toxics/ 定义各类网络退化毒剂；README 说明故障注入框架用于测试/CI/开发环境。
- **适用条件**：诊断故障注入测试缺失、网络退化模拟设计。
- **限制**：按主决策日志 §70，toxiproxy 只作受控网络退化案例的知识来源；不授权启动代理、影响现有环境或注入故障。
- **关联 Skill**：crawler-test-regressions。
- **状态**：有效。

### TR-FAULT-002 toxiproxy 准入边界

- **知识声明**：主决策日志 §70 规定 toxiproxy 的准入只允许将其源码和测试作为受控网络退化案例，不授权启动代理、影响现有环境或向外部站点注入故障。
- **证据类型/等级**：决策要求。
- **来源身份**：主决策日志 §70。
- **版本/ref/Commit**：不适用（本地项目决策）。
- **原始位置**：`docs/superpowers/brainstorming/2026-07-31-crawler-knowledge-skills-decision-log.md` §70。
- **支持说明**：决策日志 §70 限定 toxiproxy 只作受控案例知识，不授权实际启动代理或注入故障。
- **适用条件**：诊断中涉及 toxiproxy 时判定其边界（只读知识 vs 禁止运行动作）。
- **限制**：本卡描述准入边界纪律；测试设计的故障注入动作须另获明确批准。
- **关联 Skill**：crawler-test-regressions。
- **状态**：有效。

### TR-PERF-001 负载测试基线

- **知识声明**：locust 提供负载测试框架（客户端、环境、事件、调度），用于建立性能基线与负载测试；性能回归依赖可比较基线。
- **证据类型/等级**：实现证据（同版本官方源码）。
- **来源身份**：locustio/locust（`2.46.2`）。
- **版本/ref/Commit**：`2.46.2`；`5493f2608a10c249233faa5d79955721326a2cb5`。
- **原始位置**：`locust/`（clients.py、env.py、event.py、dispatch.py）。
- **支持说明**：源码实现负载测试客户端/环境/事件框架，支持建立性能基线。
- **适用条件**：诊断性能回归测试缺失、性能基线不可比、负载测试设计。
- **限制**：本卡描述 locust 负载测试框架语义；性能基线须可复现并记录门槛。
- **关联 Skill**：crawler-test-regressions。
- **状态**：有效。

---

## 安全回归与发布阻断

### TR-SEC-001 安全回归验证

- **知识声明**：安全修复的回归验证须引用匹配版本的安全证据（如 SSRF 防护、URL 校验），运行安全回归测试确认修复有效且未引入新漏洞；无结果证据时不宣称安全修复成功。
- **证据类型/等级**：决策要求＋工程证据。
- **来源身份**：主决策日志 §58；in-toto（`v3.1.0`）验证流程。
- **版本/ref/Commit**：in-toto `v3.1.0`；`c82fe5d21aaa61c7f1a213db20a46f10bb3f411a`。
- **原始位置**：`docs/superpowers/brainstorming/2026-07-31-crawler-knowledge-skills-decision-log.md` §58；in-toto `in_toto/verifylib.py`。
- **支持说明**：决策日志 §58 要求安全回归并阻止硬门槛失败；in-toto 验证流程体现证据驱动验证。
- **适用条件**：诊断安全修复回归验证缺失、无结果证据宣称安全修复成功。
- **限制**：本卡描述安全回归纪律；安全修复的有效性须有运行证据支撑。
- **关联 Skill**：crawler-test-regressions。
- **状态**：有效。

### TR-SEC-002 发布阻断硬门槛

- **知识声明**：安全或正确性硬门槛测试失败时，必须阻止通过（发布阻断）；无结果证据时不得宣称修复成功；关键回归失败时不得放行。
- **证据类型/等级**：决策要求。
- **来源身份**：主决策日志 §58。
- **版本/ref/Commit**：不适用（本地项目决策）。
- **原始位置**：`docs/superpowers/brainstorming/2026-07-31-crawler-knowledge-skills-decision-log.md` §58。
- **支持说明**：决策日志 §58 规定安全或正确性硬门槛失败时必须阻止通过。
- **适用条件**：诊断发布阻断判定、关键回归失败放行风险。
- **限制**：本卡描述发布阻断纪律；阻断结论须基于可复现的测试运行证据。
- **关联 Skill**：crawler-test-regressions。
- **状态**：有效。
