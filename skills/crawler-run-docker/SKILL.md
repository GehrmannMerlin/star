---
name: crawler-run-docker
description: Use when an Agent must diagnose a crawler project's Docker implementation behavior (Dockerfile, Compose, image build, container network, volume, permission, resource limits, healthcheck, runtime logs), detect build-cache errors, missing dependencies, DNS/network anomalies, volume-mount errors, permission issues, OOM, and resource-misconfiguration against current-version evidence (moby docker-v29.7.0, docker-cli v29.7.0, compose v5.3.1, compose-spec, WSL 2.7.11), accurately distinguish project-container-configuration problems from Docker/WSL-environment problems and application-code problems, convert runtime/observability/security Skill confirmed directions into current-environment implementation suggestions, and emit a traceable diagnosis with fix direction for user approval before handoff to crawler-writing-plans-bridge, without destructive operations unless separately explicitly approved, and keeping Docker/WSL bulk data on the E drive.
---

# crawler-run-docker

这是一个 **Agent Docker 专项实现诊断、修复顾问 Skill**，用于对爬虫项目的 Docker 实现行为进行证据驱动的分类诊断，输出可追溯问题证据、根因或待验证假设、影响范围、修复方向（Docker 实现建议）和测试建议。它**不是** Docker 引擎/运行时组件；不是修复器、规划器、记忆服务、RAG、代码索引、上下文框架或爬虫运行组件。它引用当前版本（moby docker-v29.7.0、docker-cli v29.7.0、compose v5.3.1、compose-spec、WSL 2.7.11）的配置语义，将运行环境、可观测性和安全 Skill 已确认的修复方向转换为当前环境实现建议，并准确区分项目容器配置问题、Docker/WSL 环境问题与应用代码问题。

## 触发

用户要求检查 Docker 专项实现相关设计或故障，或已经确认的问题涉及 Dockerfile、Compose、镜像构建、容器网络、卷、权限、资源限制、健康检查或运行日志时触发。处理 Stellaris 问题时，先由 `stellaris-crawler-context` 注入项目事实与已批准约束，再交给本 Skill。

## 必读输入（顺序固定）

1. 主决策日志：`docs/superpowers/brainstorming/2026-07-31-crawler-knowledge-skills-decision-log.md`。
2. 统一知识设计规格：`docs/superpowers/specs/2026-07-31-crawler-knowledge-skills-knowledge-design.md`。
3. 处理 Stellaris 问题时：`stellaris-crawler-context` 生成的项目上下文包路径。
4. 已确认根因与方向（`crawler-triage-incidents` 分诊结论，适用时）、项目目标/约束/现状、相关 Docker 配置/版本/运行状态/日志/环境证据。

详细诊断流程与实现转换规则见 `references/docker-workflow.md`；输出契约与交接见 `references/output-contract.md`；知识视图见 `docs/superpowers/knowledge/skill-views/crawler-run-docker.md`；证据卡见 `docs/superpowers/knowledge/evidence-cards/docker.md`。

## 非协商门禁

1. 识别为 Docker 实现诊断任务（需要基于证据的分类）。
2. 处理 Stellaris 问题时，先读取 `stellaris-crawler-context` 项目上下文包路径（主决策日志 §38）。
3. 明确诊断聚焦点（Dockerfile 与镜像构建 / Compose 与编排 / 容器网络 / 卷与权限 / 资源限制与健康检查 / 运行日志与环境），聚焦该点，不做无边界全栈诊断。
4. 按匹配版本证据卡分类；引用当前版本（moby docker-v29.7.0、docker-cli v29.7.0、compose v5.3.1、compose-spec、WSL 2.7.11）的配置语义；绝不因证据不足编造根因；**绝不以项目容器配置问题误判为应用代码问题或 Docker/WSL 环境问题**。
5. 外部条件（运行环境不可用/外部服务受限）只能给合规降级/等待/终止结论；绝不伪装成已修复。
6. 呈现诊断记录并等待用户批准；批准前不交给 `crawler-writing-plans-bridge`。
7. **绝不执行镜像清理、卷修改、数据迁移等破坏性操作（必须另行获得明确批准）；绝不把 Docker/WSL 大体量数据迁回 C 盘**；绝不生成 `writing-plans` 或越过批准边界；绝不安装、构建或运行未经批准的项目或第三方代码；绝不保存密钥、Cookie、认证请求头、代理凭据。
8. 输出可追溯产物并更新本地进度总账后才继续。

## 工作流路由

- 诊断流程、问题分类规则、实现转换规则、证据卡映射：`references/docker-workflow.md`。
- 诊断记录输出契约、交接契约、修订保留：`references/output-contract.md`。
- 知识视图与证据卡：`docs/superpowers/knowledge/skill-views/crawler-run-docker.md`、`docs/superpowers/knowledge/evidence-cards/docker.md`。

## 输出

- 诊断记录：问题证据＋分类＋根因或待验证假设＋影响范围＋修复方向＋测试建议；等待用户批准后交给 `crawler-writing-plans-bridge`。

## 禁止

- 不替代项目 Docker 运行时。
- 不把项目容器配置问题误判为应用代码问题或 Docker/WSL 环境问题。
- 不把外部条件或未知项伪装成已修复。
- 不引用审查时最新 Release 或历史草案版本；实现建议引用当前版本（moby docker-v29.7.0、docker-cli v29.7.0、compose v5.3.1、compose-spec、WSL 2.7.11）。
- 不越过用户批准边界、不跳过 `crawler-writing-plans-bridge`。
- 不安装、构建或运行未经批准的项目或第三方代码。
- 不执行镜像清理、卷修改、数据迁移等破坏性操作（必须另行获得明确批准）；不把 Docker/WSL 大体量数据迁回 C 盘。
- 不攻击外部网站、不绕过访问控制、不发起对目标站点的无授权请求。
- 不把未经审查的第三方示例代码用于项目。
- 不生成 `writing-plans`、不提出未经批准的代码修改。
- 不修改爬虫代码、`manifest.md`、任何第三方仓库；不初始化 Git。
- 不把密钥、Cookie、认证请求头、代理凭据、环境变量中的秘密写入诊断记录，落盘前脱敏。
