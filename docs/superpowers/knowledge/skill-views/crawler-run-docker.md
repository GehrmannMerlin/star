# crawler-run-docker 知识视图

> 本视图是 `crawler-run-docker` Skill 的独立知识视图，只保留与"Docker 专项实现诊断、修复顾问"职责相关的知识。来源身份、版本与许可证事实由共享证据层统一维护，本视图通过稳定证据卡 ID 引用，不复制原始来源元数据。

## 定位、触发与排除项

- **定位**：面向 Agent 的 Docker 专项实现诊断、修复顾问；依托当前 Docker、Docker Desktop、Compose 和 WSL 版本对应的官方资料、故障案例和源码，帮助 Agent 检查 Dockerfile、Compose、镜像构建、容器网络、卷、权限、资源限制、健康检查和运行日志，发现构建缓存错误、依赖缺失、DNS 或网络异常、卷挂载错误、权限问题、OOM 和资源配置不当。
- **不是**：Docker 引擎/运行时组件。
- **触发**：用户要求检查 Docker 专项实现相关设计或故障；已确认问题涉及 Dockerfile、Compose、镜像构建、容器网络、卷、权限、资源限制、健康检查或运行日志。
- **排除**：镜像清理、卷修改、数据迁移等破坏性操作必须另行获得明确批准；Docker/WSL 大体量数据必须位于 E 盘，不得迁回 C 盘；不越批准边界/不跳过 `crawler-writing-plans-bridge`；不生成 `writing-plans`。

## 最低证据输入

- 项目上下文（处理 Stellaris 问题时为 `stellaris-crawler-context` 项目上下文包路径）。
- 已确认根因与方向（`crawler-triage-incidents` 分诊结论，适用时）。
- 相关 Docker 配置、版本、运行状态、日志和环境证据。
- 固定版本资料（批次 5：moby/moby、docker/cli、docker/compose、compose-spec、microsoft/WSL）。

## 知识主题与证据卡映射

### Dockerfile 与镜像构建

- 判断镜像构建语义、构建缓存、构建失败是否符合当前版本行为；构建缓存错误、依赖缺失是常见问题。
- 证据卡：[[DK-BUILD-001]]（镜像构建语义）、[[DK-BUILD-002]]（构建缓存行为）、[[DK-BUILD-003]]（构建失败与依赖缺失）。
- 依据固定版本：moby `daemon/build.go`、`api/`；docker-cli `cli/command/image/`。

### Compose 与编排

- 判断 services 语义、networks/volumes/configs/secrets、Compose 文件版本是否符合当前版本行为；服务配置错误、版本兼容是常见问题。
- 证据卡：[[DK-COMPOSE-001]]（services 语义）、[[DK-COMPOSE-002]]（networks/volumes/configs/secrets）、[[DK-COMPOSE-003]]（Compose 文件版本与模型）。
- 依据固定版本：compose-spec `05-services.md`、`06-networks.md`、`07-volumes.md`、`08-configs.md`、`09-secrets.md`；docker-compose `pkg/`、`cmd/`。

### 容器网络

- 判断容器网络语义、DNS/端口映射是否符合当前版本行为；容器间通信失败、DNS 异常是常见问题。
- 证据卡：[[DK-NET-001]]（容器网络语义）、[[DK-NET-002]]（DNS/端口映射/容器间通信）。
- 依据固定版本：moby `daemon/network/`；compose-spec `06-networks.md`。

### 卷与权限

- 判断卷挂载语义、权限与所有权是否符合当前版本行为；卷挂载错误、权限问题、数据访问失败是常见问题。
- 证据卡：[[DK-VOL-001]]（卷挂载语义）、[[DK-VOL-002]]（权限与所有权）。
- 依据固定版本：moby `daemon/volume/`、`daemon/volumes.go`；compose-spec `07-volumes.md`。

### 资源限制/健康检查/运行日志

- 判断资源限制/OOM、健康检查、运行日志/WSL 集成是否符合当前版本行为；OOM、健康状态失真、WSL 环境问题是常见问题。
- 证据卡：[[DK-RES-001]]（资源限制与 OOM）、[[DK-RES-002]]（健康检查语义）、[[DK-RES-003]]（运行日志与 WSL 集成）。
- 依据固定版本：moby `daemon/health.go`、`daemon/container/health.go`；WSL `doc/`、`diagnostics/`。

## 实现转换规则

- 将运行环境、可观测性和安全 Skill 已确认的修复方向转换为适合当前 Docker 环境的具体实现建议。
- 引用当前版本（moby docker-v29.7.0、docker-cli v29.7.0、compose v5.3.1、compose-spec、WSL 2.7.11）的配置语义；不默认采用最新 Release 或历史草案版本。
- 准确区分项目容器配置问题、Docker/WSL 环境问题与应用代码问题是验收重点。

## 版本化判断规则

- 每条判断依据必须追溯到固定版本资料（ref＋Commit）、证据卡、上下文包条目或决策日志节号；只给仓库首页或没有版本的引用不满足要求。
- 明确区分事实、证据、综合推断与未知项；综合推断必须显式标记"推断"，不得伪装成资料中的确定结论。
- 不得因新技术更新默认要求升级；是否升级以证据和项目约束为准。
- 案例证据与工程证据不得单独升格为跨项目通用规范或确定根因。

## 输出、交接与禁止越权

- **输出**：可追溯问题证据、根因或待验证假设、影响范围、修复方向（Docker 实现建议）、测试建议。
- **交接**：将运行环境/可观测性/安全 Skill 已确认方向转换为 Docker 实现建议，不越过批准边界/不跳过 `crawler-writing-plans-bridge`；获准修复方向→`crawler-writing-plans-bridge`。
- **禁止越权**：不执行未经批准的破坏性操作、不把 Docker/WSL 数据迁回 C 盘、不把项目配置问题误判为应用代码/环境问题、不生成 `writing-plans`、不初始化 Git、不记录敏感信息原件。

## 视图自检

- 全部证据卡 ID（DK-BUILD-*、DK-COMPOSE-*、DK-NET-*、DK-VOL-*、DK-RES-*）在 `docker.md` 中存在且被本视图引用。
- 无未标注的推断；每条判断可追溯到证据卡或固定资料。
- 未复制相邻 Skill（`crawler-observe-runtime`、`crawler-debug-typescript-node`）的职责。
