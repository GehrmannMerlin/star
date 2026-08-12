# 存储与证据链证据卡（共享证据层）

> 本文件是共享可追溯证据层中与持久化与证据链诊断相关的证据卡集合。每张卡表达一条可验证知识声明，绑定固定版本资料、原始位置与适用边界。
>
> 来源：批次 4 固定源码快照，全部以 `third-party/crawler-knowledge-sources/manifest.md` 记录的 ref 与 Commit 为唯一版本基线。
>
> 证据等级：规范证据（官方规范/文档/Release）＞实现证据（同版本官方源码/测试）＞工程证据（官方运行指南/手册）＞案例证据（事故资料，只用于启发）。
>
> 维护规则：本文件由资料治理 Skill 按既定准入、许可证复核与版本固定流程维护；不得静默改写已固定证据卡，更新只通过新增修订进行。

## 来源身份与版本基线

| 仓库 | 权威 ref | Commit | 本地路径 |
|---|---|---|---|
| in-toto/in-toto | `v3.1.0` | `c82fe5d21aaa61c7f1a213db20a46f10bb3f411a` | `third-party/crawler-knowledge-sources/repos/batch-04-platform-assurance/in-toto` |
| slsa-framework/slsa | `v1.2` | `19e4e2f005f871270c4f555fc47afecfb37f3efe` | `third-party/crawler-knowledge-sources/repos/batch-04-platform-assurance/slsa` |
| ossf/osv-schema | `v1.8.0` | `b4f3e11785fd0e13636bcff3884766866d6dc8c6` | `third-party/crawler-knowledge-sources/repos/batch-04-platform-assurance/osv-schema` |
| json-schema-org/JSON-Schema-Test-Suite | `23.1.0` | `ab4bd012fc9e536a55814f3f38e62bb28aa1dab3` | `third-party/crawler-knowledge-sources/repos/batch-04-platform-assurance/JSON-Schema-Test-Suite` |

---

## Schema/迁移/事务

### ES-SCHEMA-001 Schema 校验语义

- **知识声明**：JSON-Schema-Test-Suite 提供跨版本（draft3-draft2020-12）的 Schema 校验测试集，定义数据 Schema 校验的语义与边界；Schema 校验失败会导致数据被拒绝或结构不一致。
- **证据类型/等级**：规范证据（测试套件）。
- **来源身份**：json-schema-org/JSON-Schema-Test-Suite（`23.1.0`）。
- **版本/ref/Commit**：`23.1.0`；`ab4bd012fc9e536a55814f3f38e62bb28aa1dab3`。
- **原始位置**：`tests/`（draft3、draft4、draft6、draft7、draft2019-09、draft2020-12、draft-next、latest）。
- **支持说明**：测试套件覆盖各草案版本关键字语义。
- **适用条件**：诊断 Schema 校验失败、数据结构不一致时比对。
- **限制**：不同草案版本关键字语义不同；本卡描述测试套件覆盖的规范语义。
- **关联 Skill**：crawler-manage-evidence-storage。
- **状态**：有效。

### ES-SCHEMA-002 结构化数据 Schema

- **知识声明**：osv-schema `schema.md` 定义漏洞记录（OSV）的结构化数据 Schema（字段如 schema_version、id、affected）；结构不一致会导致数据校验失败。
- **证据类型/等级**：规范证据。
- **来源身份**：ossf/osv-schema（`v1.8.0`）。
- **版本/ref/Commit**：`v1.8.0`；`b4f3e11785fd0e13636bcff3884766866d6dc8c6`。
- **原始位置**：`schema.md`、`docs/`。
- **支持说明**：OSV Schema 定义漏洞记录字段结构与版本。
- **适用条件**：诊断结构化数据 Schema 不一致、字段缺失时比对。
- **限制**：具体 Schema 字段随版本变化；本卡描述 OSV 结构。
- **关联 Skill**：crawler-manage-evidence-storage。
- **状态**：有效。

### ES-SCHEMA-003 迁移/事务一致性

- **知识声明**：数据结构迁移与事务须保持一致性；Schema 变更未同步迁移或事务未提交会导致结构/数据不一致。
- **证据类型/等级**：工程证据（结合实现证据推导）。
- **来源身份**：json-schema-org/JSON-Schema-Test-Suite（`23.1.0`）与 ossf/osv-schema（`v1.8.0`）。
- **版本/ref/Commit**：`23.1.0`（`ab4bd012fc9e536a55814f3f38e62bb28aa1dab3`）；`v1.8.0`（`b4f3e11785fd0e13636bcff3884766866d6dc8c6`）。
- **原始位置**：`tests/`（Schema 校验）、`schema.md`（结构定义）。
- **支持说明**：Schema 版本演进与数据校验关联；迁移未对齐会导致不一致。
- **适用条件**：诊断迁移失败、事务不一致时比对。
- **限制**：本卡是工程推断（`推断`）；具体迁移/事务语义随存储实现与版本变化。
- **关联 Skill**：crawler-manage-evidence-storage。
- **状态**：有效。

---

## 连接池/索引/查询

### ES-POOL-001 连接池与一致性

- **知识声明**：存储连接池管理并发连接；连接泄漏或池耗尽导致查询失败/阻塞，且可能掩盖事务状态不一致。
- **证据类型/等级**：工程证据（结合实现证据推导）。
- **来源身份**：json-schema-org/JSON-Schema-Test-Suite（`23.1.0`）的校验语义（数据一致性）。
- **版本/ref/Commit**：`23.1.0`；`ab4bd012fc9e536a55814f3f38e62bb28aa1dab3`。
- **原始位置**：`tests/`（数据校验）。
- **支持说明**：连接池管理影响数据读写一致性。
- **适用条件**：诊断连接池耗尽、查询阻塞时比对。
- **限制**：连接池实现随存储驱动/版本变化；本卡是工程推断（`推断`）。
- **关联 Skill**：crawler-manage-evidence-storage。
- **状态**：有效。

### ES-POOL-002 索引与查询正确性

- **知识声明**：索引与查询的正确性影响存储性能与数据检索完整性；索引缺失或查询计划不当导致查询性能下降或数据检索偏差。
- **证据类型/等级**：工程证据（结合实现证据推导）。
- **来源身份**：json-schema-org/JSON-Schema-Test-Suite（`23.1.0`）。
- **版本/ref/Commit**：`23.1.0`；`ab4bd012fc9e536a55814f3f38e62bb28aa1dab3`。
- **原始位置**：`tests/`（数据校验）。
- **支持说明**：数据校验与查询结果一致性相关。
- **适用条件**：诊断查询性能下降、检索结果不一致时比对。
- **限制**：索引/查询语义随存储实现与版本变化；本卡是工程推断（`推断`）。
- **关联 Skill**：crawler-manage-evidence-storage。
- **状态**：有效。

---

## 内容寻址/哈希校验

### ES-HASH-001 内容哈希

- **知识声明**：in-toto `record_artifacts_as_dict` 对材料/产品文件逐一哈希，记录文件状态；哈希用于内容寻址与完整性校验。
- **证据类型/等级**：实现证据。
- **来源身份**：in-toto/in-toto（`v3.1.0`）。
- **版本/ref/Commit**：`v3.1.0`；`c82fe5d21aaa61c7f1a213db20a46f10bb3f411a`。
- **原始位置**：`in_toto/runlib.py`（`record_artifacts_as_dict`，69-127 行附近）。
- **支持说明**：`record_artifacts_as_dict` 哈希文件并记录为材料/产品状态。
- **适用条件**：诊断内容寻址错误、文件哈希不匹配时比对。
- **限制**：哈希算法与寻址规则随实现/版本变化；本卡描述 in-toto 哈希机制。
- **关联 Skill**：crawler-manage-evidence-storage。
- **状态**：有效。

### ES-HASH-002 链接元数据完整性

- **知识声明**：in-toto 链接元数据（Link）记录材料/产品哈希与命令；链接元数据被篡改或丢失会导致证据链断裂。
- **证据类型/等级**：实现证据。
- **来源身份**：in-toto/in-toto（`v3.1.0`）。
- **版本/ref/Commit**：`v3.1.0`；`c82fe5d21aaa61c7f1a213db20a46f10bb3f411a`。
- **原始位置**：`in_toto/models/link.py`、`in_toto/runlib.py`。
- **支持说明**：Link 模型记录材料/产品哈希与命令。
- **适用条件**：诊断链接元数据丢失/篡改导致证据链断裂时比对。
- **限制**：链接元数据格式随版本变化；本卡描述 in-toto Link 机制。
- **关联 Skill**：crawler-manage-evidence-storage。
- **状态**：有效。

### ES-HASH-003 阈值验证

- **知识声明**：in-toto `load_links_for_layout` 检查每个 Step 的 Link 元数据数量是否达到阈值；少于阈值即抛 `LinkNotFoundError`，证据不足不可验证。
- **证据类型/等级**：实现证据。
- **来源身份**：in-toto/in-toto（`v3.1.0`）。
- **版本/ref/Commit**：`v3.1.0`；`c82fe5d21aaa61c7f1a213db20a46f10bb3f411a`。
- **原始位置**：`in_toto/verifylib.py`（`load_links_for_layout`，100-140 行）。
- **支持说明**：`load_links_for_layout` 若某 step 链接文件少于 threshold 则抛异常（初步阈值检查）。
- **适用条件**：诊断证据数量不足、证据链无法验证时比对。
- **限制**：阈值语义随 in-toto 配置/版本变化；本卡描述阈值验证机制。
- **关联 Skill**：crawler-manage-evidence-storage。
- **状态**：有效。

---

## 数据血缘/证据引用

### ES-LINE-001 证据链验证

- **知识声明**：in-toto `in_toto_verify` 验证交付物的供应链 layout：布局被持有密钥签名、布局未过期、每个 step 的链接证据存在且可验证。
- **证据类型/等级**：实现证据。
- **来源身份**：in-toto/in-toto（`v3.1.0`）。
- **版本/ref/Commit**：`v3.1.0`；`c82fe5d21aaa61c7f1a213db20a46f10bb3f411a`。
- **原始位置**：`in_toto/in_toto_verify.py`（58-70 行 docstring：layout 签名、未过期、链接证据）。
- **支持说明**：`in_toto_verify` 验证 layout 签名、过期与链接证据。
- **适用条件**：诊断证据链验证失败、引用断裂时比对。
- **限制**：验证语义随版本变化；本卡描述 in-toto 验证流程。
- **关联 Skill**：crawler-manage-evidence-storage。
- **状态**：有效。

### ES-LINE-002 溯源/血缘

- **知识声明**：SLSA（Supply-chain Levels for Software Artifacts）定义供应链溯源（Provenance）要求；溯源记录建立工件与生成过程的数据血缘。
- **证据类型/等级**：规范证据。
- **来源身份**：slsa-framework/slsa（`v1.2`）。
- **版本/ref/Commit**：`v1.2`；`19e4e2f005f871270c4f555fc47afecfb37f3efe`。
- **原始位置**：`docs/`（SLSA 规范、Provenance 章节）。
- **支持说明**：SLSA 定义溯源要求与等级。
- **适用条件**：诊断数据血缘缺失、溯源记录不完整时比对。
- **限制**：SLSA 规范随版本演进；本卡描述 SLSA 1.2 语义。
- **关联 Skill**：crawler-manage-evidence-storage。
- **状态**：有效。

### ES-LINE-003 引用完整性

- **知识声明**：证据引用（内容寻址引用/ID 引用）须指向存在的证据；引用断裂会导致孤立文件或证据丢失。
- **证据类型/等级**：工程证据（结合实现证据推导）。
- **来源身份**：in-toto/in-toto（`v3.1.0`）的链接/验证机制。
- **版本/ref/Commit**：`v3.1.0`；`c82fe5d21aaa61c7f1a213db20a46f10bb3f411a`。
- **原始位置**：`in_toto/models/link.py`、`in_toto/verifylib.py`。
- **支持说明**：链接元数据引用材料/产品；引用指向缺失文件即断裂。
- **适用条件**：诊断引用断裂、孤立文件时比对。
- **限制**：本卡是工程推断（`推断`）；引用格式随实现/版本变化。
- **关联 Skill**：crawler-manage-evidence-storage。
- **状态**：有效。

---

## 完整性扫描

### ES-SCAN-001 完整性扫描方法

- **知识声明**：in-toto 验证流程（哈希校验、签名验证、阈值检查）提供完整性扫描方法；只读完整性扫描不修改原始证据。
- **证据类型/等级**：实现证据。
- **来源身份**：in-toto/in-toto（`v3.1.0`）。
- **版本/ref/Commit**：`v3.1.0`；`c82fe5d21aaa61c7f1a213db20a46f10bb3f411a`。
- **原始位置**：`in_toto/verifylib.py`、`in_toto/runlib.py`。
- **支持说明**：哈希记录与验证构成完整性扫描基础。
- **适用条件**：诊断完整性扫描方法缺失、扫描结果不可靠时比对。
- **限制**：完整性扫描流程随版本/实现变化；本卡描述 in-toto 验证流程。
- **关联 Skill**：crawler-manage-evidence-storage。
- **状态**：有效。

### ES-SCAN-002 结构一致性检查

- **知识声明**：JSON-Schema-Test-Suite 与 osv-schema 提供数据/结构一致性检查基础；结构不一致（字段缺失/类型错误）通过 Schema 校验暴露。
- **证据类型/等级**：规范证据。
- **来源身份**：json-schema-org/JSON-Schema-Test-Suite（`23.1.0`）与 ossf/osv-schema（`v1.8.0`）。
- **版本/ref/Commit**：`23.1.0`（`ab4bd012fc9e536a55814f3f38e62bb28aa1dab3`）；`v1.8.0`（`b4f3e11785fd0e13636bcff3884766866d6dc8c6`）。
- **原始位置**：`tests/`、`schema.md`。
- **支持说明**：Schema 校验暴露结构不一致。
- **适用条件**：诊断结构一致性扫描、数据校验失败时比对。
- **限制**：Schema 语义随草案/版本变化；本卡描述校验基础。
- **关联 Skill**：crawler-manage-evidence-storage。
- **状态**：有效。

---

## 汇总

- 证据卡总数：13 张（ES-SCHEMA 3＋ES-POOL 2＋ES-HASH 3＋ES-LINE 3＋ES-SCAN 2）。
- 来源：批次 4 固定仓库 4 个（in-toto、slsa、osv-schema、JSON-Schema-Test-Suite）。
- 引用契约：下游 Skill 视图通过稳定 ID 引用本文件；原始证据通过 manifest 固定 Commit 与相对路径可追溯。
