# Docker 专项实现证据卡（共享证据层）

> 本文件是共享可追溯证据层中与 Docker 专项实现诊断相关的证据卡集合。每张卡表达一条可验证知识声明，绑定固定版本资料、原始位置与适用边界。
>
> 来源：批次 5 固定源码快照（moby/moby、docker/cli、docker/compose、compose-spec、microsoft/WSL），全部以 `third-party/crawler-knowledge-sources/manifest.md` 记录的 ref 与 Commit 为唯一版本基线。
>
> 证据等级：规范证据（官方规范/文档/Release）＞实现证据（同版本官方源码/测试）＞工程证据（官方运行指南/手册）＞案例证据（事故资料，只用于启发）。
>
> 维护规则：本文件由资料治理 Skill 按既定准入、许可证复核与版本固定流程维护；不得静默改写已固定证据卡，更新只通过新增修订进行。

## 来源身份与版本基线

| 仓库 | 权威 ref | Commit | 本地路径 |
|---|---|---|---|
| moby/moby | `docker-v29.7.0` | `4b5cb715735a1b7000093bb2ab54295dfedfebfe` | `third-party/crawler-knowledge-sources/repos/batch-05-core-stack/moby` |
| docker/cli | `v29.7.0` | `c1eba931e3d15d204bedeadeb55ad8880be14ad3` | `third-party/crawler-knowledge-sources/repos/batch-05-core-stack/docker-cli` |
| docker/compose | `v5.3.1` | `f32009d4a2c687dd405398cc7975d12dccaf8dff` | `third-party/crawler-knowledge-sources/repos/batch-05-core-stack/docker-compose` |
| compose-spec/compose-spec | `main` | `11296e387ba76c77db1db768b9153a4304a3c9bd` | `third-party/crawler-knowledge-sources/repos/batch-05-core-stack/compose-spec` |
| microsoft/WSL | `2.7.11` | `acbcb81fc61079b74835ea7dc2563046b2557033` | `third-party/crawler-knowledge-sources/repos/batch-05-core-stack/WSL` |

---

## Dockerfile 与镜像构建

### DK-BUILD-001 镜像构建语义

- **知识声明**：moby daemon（`daemon/build.go`）执行镜像构建；构建指令与缓存行为决定镜像产物；构建失败（依赖缺失、缓存错误）会中断镜像生成。
- **证据类型/等级**：实现证据（同版本官方源码）。
- **来源身份**：moby/moby（`docker-v29.7.0`）。
- **版本/ref/Commit**：`docker-v29.7.0`；`4b5cb715735a1b7000093bb2ab54295dfedfebfe`。
- **原始位置**：`daemon/build.go`、`api/`。
- **支持说明**：moby daemon 实现镜像构建；构建行为决定镜像产物。
- **适用条件**：诊断镜像构建失败、构建行为异常。
- **限制**：镜像构建行为以 moby docker-v29.7.0 为准。
- **关联 Skill**：crawler-run-docker。
- **状态**：有效。

### DK-BUILD-002 构建缓存行为

- **知识声明**：Docker 镜像构建利用层缓存加速；构建缓存错误（缓存失效/错误复用）导致构建失败或产物不一致。
- **证据类型/等级**：实现证据（同版本官方源码）。
- **来源身份**：moby/moby（`docker-v29.7.0`）；docker/cli（`v29.7.0`）。
- **版本/ref/Commit**：moby `docker-v29.7.0` `4b5cb715…`；docker-cli `v29.7.0` `c1eba931…`。
- **原始位置**：moby `daemon/build.go`；docker-cli `cli/command/image/`。
- **支持说明**：构建缓存行为影响镜像构建；缓存错误导致失败。
- **适用条件**：诊断构建缓存错误、缓存失效、缓存复用错误。
- **限制**：缓存语义以 moby docker-v29.7.0 为准。
- **关联 Skill**：crawler-run-docker。
- **状态**：有效。

### DK-BUILD-003 构建失败与依赖缺失

- **知识声明**：Docker 镜像构建失败（依赖缺失、基础镜像不可达）会中断镜像生成；构建失败常属外部条件（注册表不可达）或配置错误（依赖声明错误）。
- **证据类型/等级**：实现证据（同版本官方源码）。
- **来源身份**：moby/moby（`docker-v29.7.0`）；docker/cli（`v29.7.0`）。
- **版本/ref/Commit**：moby `docker-v29.7.0` `4b5cb715…`；docker-cli `v29.7.0` `c1eba931…`。
- **原始位置**：docker-cli `cli/command/image/`。
- **支持说明**：构建失败路径与错误处理。
- **适用条件**：诊断构建失败、依赖缺失、注册表不可达。
- **限制**：构建失败归因须运行时证据；外部条件不得伪装成已修复。
- **关联 Skill**：crawler-run-docker。
- **状态**：有效。

---

## Compose 与编排

### DK-COMPOSE-001 services 语义

- **知识声明**：Compose 规范定义 `services` 顶层元素，每个服务由镜像与运行时参数定义；服务定义决定容器行为。
- **证据类型/等级**：规范证据（官方规范）。
- **来源身份**：compose-spec/compose-spec（`main` 固定快照）。
- **版本/ref/Commit**：`main`；`11296e387ba76c77db1db768b9153a4304a3c9bd`。
- **原始位置**：`05-services.md`。
- **支持说明**：规范定义 services 语义与服务定义结构。
- **适用条件**：诊断 Compose services 配置错误、服务定义不符预期。
- **限制**：Compose 语义以 compose-spec 固定快照为准。
- **关联 Skill**：crawler-run-docker。
- **状态**：有效。

### DK-COMPOSE-002 networks/volumes/configs/secrets

- **知识声明**：Compose 规范定义 networks、volumes、configs、secrets 顶层元素；网络、卷、配置、密钥配置错误导致编排行为异常。
- **证据类型/等级**：规范证据（官方规范）。
- **来源身份**：compose-spec/compose-spec（`main` 固定快照）。
- **版本/ref/Commit**：`main`；`11296e387ba76c77db1db768b9153a4304a3c9bd`。
- **原始位置**：`06-networks.md`、`07-volumes.md`、`08-configs.md`、`09-secrets.md`。
- **支持说明**：规范定义各顶层元素的语义。
- **适用条件**：诊断 Compose 网络/卷/配置/密钥配置错误。
- **限制**：本卡描述 Compose 规范语义；具体实现以 docker/compose v5.3.1 为准。
- **关联 Skill**：crawler-run-docker。
- **状态**：有效。

### DK-COMPOSE-003 Compose 文件版本与模型

- **知识声明**：Compose 规范定义 Compose 文件版本/模型（services 必须声明）；docker/compose（`pkg/`、`cmd/`）实现 Compose 解析与编排；Compose 文件版本与配置行为不匹配导致版本兼容问题。
- **证据类型/等级**：规范证据＋实现证据。
- **来源身份**：compose-spec/compose-spec（`main`）；docker/compose（`v5.3.1`）。
- **版本/ref/Commit**：compose-spec `main` `11296e38…`；compose `v5.3.1` `f32009d4…`。
- **原始位置**：compose-spec `02-model.md`、`04-version-and-name.md`；docker-compose `pkg/`、`cmd/`。
- **支持说明**：Compose 文件模型与版本语义；docker-compose 实现解析。
- **适用条件**：诊断 Compose 文件版本错误、模型不符、配置兼容问题。
- **限制**：Compose 行为以 docker/compose v5.3.1 为准。
- **关联 Skill**：crawler-run-docker。
- **状态**：有效。

---

## 容器网络

### DK-NET-001 容器网络语义

- **知识声明**：moby daemon 实现容器网络（`daemon/network/`）；Compose networks 定义网络拓扑；容器网络配置错误导致容器间通信失败。
- **证据类型/等级**：实现证据（同版本官方源码）。
- **来源身份**：moby/moby（`docker-v29.7.0`）；compose-spec（`main`）。
- **版本/ref/Commit**：moby `docker-v29.7.0` `4b5cb715…`；compose-spec `main` `11296e38…`。
- **原始位置**：moby `daemon/network/`；compose-spec `06-networks.md`。
- **支持说明**：moby 实现容器网络；Compose 定义网络拓扑。
- **适用条件**：诊断容器网络配置错误、容器间通信失败。
- **限制**：网络语义以 moby docker-v29.7.0 为准。
- **关联 Skill**：crawler-run-docker。
- **状态**：有效。

### DK-NET-002 DNS/端口映射/容器间通信

- **知识声明**：容器网络涉及 DNS、端口映射与容器间通信；DNS/端口映射错误导致网络访问失败或容器无法互相发现。
- **证据类型/等级**：实现证据（同版本官方源码）。
- **来源身份**：moby/moby（`docker-v29.7.0`）；compose-spec（`main`）。
- **版本/ref/Commit**：moby `docker-v29.7.0` `4b5cb715…`；compose-spec `main` `11296e38…`。
- **原始位置**：moby `daemon/network/`；compose-spec `06-networks.md`。
- **支持说明**：网络实现覆盖 DNS、端口映射、容器间通信。
- **适用条件**：诊断 DNS 异常、端口映射错误、容器间通信失败。
- **限制**：网络行为以 moby docker-v29.7.0 为准。
- **关联 Skill**：crawler-run-docker。
- **状态**：有效。

---

## 卷与权限

### DK-VOL-001 卷挂载语义

- **知识声明**：moby daemon 实现卷挂载（`daemon/volume/`、`daemon/volumes.go`）；Compose volumes 定义卷挂载；卷挂载错误导致数据丢失或容器无法访问数据。
- **证据类型/等级**：实现证据（同版本官方源码）。
- **来源身份**：moby/moby（`docker-v29.7.0`）；compose-spec（`main`）。
- **版本/ref/Commit**：moby `docker-v29.7.0` `4b5cb715…`；compose-spec `main` `11296e38…`。
- **原始位置**：moby `daemon/volume/`、`daemon/volumes.go`；compose-spec `07-volumes.md`。
- **支持说明**：moby 实现卷挂载；Compose 定义卷语义。
- **适用条件**：诊断卷挂载错误、数据访问失败、卷丢失。
- **限制**：卷语义以 moby docker-v29.7.0 为准。
- **关联 Skill**：crawler-run-docker。
- **状态**：有效。

### DK-VOL-002 权限与所有权

- **知识声明**：容器卷挂载涉及权限与文件所有权；权限问题导致容器无法读写卷数据（权限拒绝）。
- **证据类型/等级**：实现证据（同版本官方源码）。
- **来源身份**：moby/moby（`docker-v29.7.0`）。
- **版本/ref/Commit**：`docker-v29.7.0`；`4b5cb715735a1b7000093bb2ab54295dfedfebfe`。
- **原始位置**：`daemon/volume/`、`daemon/volumes.go`。
- **支持说明**：卷挂载与权限处理影响容器数据访问。
- **适用条件**：诊断卷权限问题、文件所有权错误、权限拒绝。
- **限制**：权限语义以 moby docker-v29.7.0 为准。
- **关联 Skill**：crawler-run-docker。
- **状态**：有效。

---

## 资源限制/健康检查/运行日志

### DK-RES-001 资源限制与 OOM

- **知识声明**：moby daemon 支持容器资源限制（CPU/内存）与 OOM 处理；资源限制配置不当导致 OOM 或容器被杀死。
- **证据类型/等级**：实现证据（同版本官方源码）。
- **来源身份**：moby/moby（`docker-v29.7.0`）。
- **版本/ref/Commit**：`docker-v29.7.0`；`4b5cb715735a1b7000093bb2ab54295dfedfebfe`。
- **原始位置**：`daemon/`（资源限制、OOM 处理）。
- **支持说明**：moby daemon 实现资源限制与 OOM 语义。
- **适用条件**：诊断资源限制配置不当、OOM、容器被杀死。
- **限制**：资源语义以 moby docker-v29.7.0 为准。
- **关联 Skill**：crawler-run-docker。
- **状态**：有效。

### DK-RES-002 健康检查语义

- **知识声明**：moby daemon（`daemon/health.go`、`daemon/container/health.go`）实现容器健康检查；健康检查配置错误导致健康状态失真。
- **证据类型/等级**：实现证据（同版本官方源码）。
- **来源身份**：moby/moby（`docker-v29.7.0`）。
- **版本/ref/Commit**：`docker-v29.7.0`；`4b5cb715735a1b7000093bb2ab54295dfedfebfe`。
- **原始位置**：`daemon/health.go`、`daemon/container/health.go`。
- **支持说明**：moby daemon 实现健康检查语义。
- **适用条件**：诊断健康检查配置错误、健康状态失真。
- **限制**：健康检查语义以 moby docker-v29.7.0 为准。
- **关联 Skill**：crawler-run-docker。
- **状态**：有效。

### DK-RES-003 运行日志与 WSL 集成

- **知识声明**：Docker 运行日志与环境证据用于诊断容器行为；WSL（`doc/`、`diagnostics/`）提供 Docker Desktop 集成与 WSL 环境诊断；WSL 集成错误导致 Docker/WSL 环境问题。
- **证据类型/等级**：规范证据＋工程证据。
- **来源身份**：microsoft/WSL（`2.7.11`）。
- **版本/ref/Commit**：`2.7.11`；`acbcb81fc61079b74835ea7dc2563046b2557033`。
- **原始位置**：`doc/`、`diagnostics/`。
- **支持说明**：WSL 文档与诊断工具提供 WSL 环境信息；区分 Docker/WSL 环境问题与项目配置问题。
- **适用条件**：诊断 WSL 集成错误、Docker Desktop 环境问题、运行日志分析。
- **限制**：WSL 语义以 2.7.11 为准；Docker/WSL 大体量数据必须位于 E 盘（主决策日志 §30/§31/§62）。
- **关联 Skill**：crawler-run-docker。
- **状态**：有效。
