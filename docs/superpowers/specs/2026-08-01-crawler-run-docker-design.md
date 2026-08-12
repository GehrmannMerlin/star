# crawler-run-docker Skill 设计规格

日期：2026-08-02  
状态：书面规格待用户审阅  
适用范围：第 17 个独立 Agent Skill `crawler-run-docker` 的完整设计

## 1. 目标与边界

`crawler-run-docker` 是爬虫知识资料库当前重点技术栈方向下的 Agent Docker 专项实现诊断、修复顾问。其职责是：依托当前 Docker、Docker Desktop、Compose 和 WSL 版本对应的官方资料、故障案例和源码，帮助 Agent 检查 Dockerfile、Compose、镜像构建、容器网络、卷、权限、资源限制、健康检查和运行日志，发现构建缓存错误、依赖缺失、DNS 或网络异常、卷挂载错误、权限问题、OOM 和资源配置不当。它将运行环境、可观测性和安全 Skill 已经确认的方向转换为适合当前 Docker 环境的具体实现建议。

本 Skill 可以指导 Agent 执行只读检查和隔离复现；**镜像清理、卷修改、数据迁移等破坏性操作必须另行获得明确批准**。Docker 引擎、镜像、容器、卷和 WSL 虚拟磁盘等大体量数据必须继续位于 E 盘，不得迁回 C 盘。

本设计只规划 `crawler-run-docker`，不包含第 18 个及后续 Skill 的实施任务；不创建或实施本 Skill 本身（实施由 Claude Code 按后续写作计划执行）。

## 2. 已确认输入

- 主决策日志：`docs/superpowers/brainstorming/2026-07-31-crawler-knowledge-skills-decision-log.md`（已确认决策的最高权威；§62/§51/§26.4）。
- 统一知识设计规格：`docs/superpowers/specs/2026-07-31-crawler-knowledge-skills-knowledge-design.md`（公共知识契约）。
- 固定源码清单：`third-party/crawler-knowledge-sources/manifest.md`。
- 处理 Stellaris 问题时：`stellaris-crawler-context` 生成的项目上下文包路径。
- 已确认根因与方向（`crawler-triage-incidents` 分诊结论，适用时）。
- 相关 Docker 配置、版本、运行状态、日志和环境证据（现场只读核验）。

## 3. 职责与排除项

### 3.1 职责

- 检查项目中的 Docker 专项实现相关问题：
  - Dockerfile 与镜像构建；
  - Compose 与编排；
  - 容器网络；
  - 卷与权限；
  - 资源限制与健康检查；
  - 运行日志与环境。
- 发现构建缓存错误、依赖缺失、DNS 或网络异常、卷挂载错误、权限问题、OOM 和资源配置不当。
- 准确区分项目容器配置问题、Docker 或 WSL 环境问题与应用代码问题。
- 将运行环境、可观测性和安全 Skill 已经确认的方向转换为适合当前 Docker 环境的具体实现建议。
- 输出可追溯问题证据、根因或待验证假设、影响范围、修复方向（Docker 实现建议）、测试建议。

### 3.2 排除项

- 镜像清理、卷修改、数据迁移等破坏性操作必须另行获得明确批准（主决策日志 §62）。
- Docker 引擎、镜像、容器、卷和 WSL 虚拟磁盘等大体量数据必须继续位于 E 盘，不得迁回 C 盘（主决策日志 §30/§31/§62）。
- 不把项目容器配置问题误判为应用代码问题或 Docker/WSL 环境问题。
- 不越过用户批准边界或跳过 `crawler-writing-plans-bridge`。
- 不生成 `writing-plans`、不提出未经批准的代码修改。
- 不安装、构建或运行未经批准的项目或第三方代码。
- 不修改爬虫代码、`manifest.md`、第三方仓库；不初始化 Git。
- 不把密钥、Cookie、认证请求头、代理凭据、环境变量中的秘密写入诊断记录，落盘前脱敏。

## 4. 触发条件与输入

### 4.1 触发

用户要求检查 Docker 专项实现相关设计或故障，或已经确认的问题涉及 Dockerfile、Compose、镜像构建、容器网络、卷、权限、资源限制、健康检查或运行日志时触发（主决策日志 §62）。通常由 `crawler-triage-incidents` 分诊路由进入（已确认根因后），或用户直接要求 Docker 专项诊断。

### 4.2 最低输入

- 项目上下文（处理 Stellaris 问题时为 `stellaris-crawler-context` 项目上下文包路径）。
- 已确认根因与方向（`crawler-triage-incidents` 分诊结论，适用时）。
- 相关 Docker 配置、版本、运行状态、日志和环境证据。
- 固定版本资料（批次 5：moby/moby、docker/cli、docker/compose、compose-spec、microsoft/WSL）。

## 5. 诊断流程

1. 读取项目上下文（Stellaris 问题先读 `stellaris-crawler-context` 项目上下文包）、目标、约束与已确认根因。
2. 确定诊断聚焦点：Dockerfile 与镜像构建 / Compose 与编排 / 容器网络 / 卷与权限 / 资源限制与健康检查 / 运行日志与环境。
3. 检查相关 Docker 配置、版本、运行状态、日志和环境证据，定位具体证据位置。
4. 引用匹配版本的证据卡（`docker.md`）比对项目行为与规范/实现/工程证据。
5. 分类：代码缺陷 / 配置错误 / 版本兼容 / 设计不足 / 外部条件 / 未知项。
6. 证据不足时只提出最小补充取证（只读检查、隔离复现）；根因未证实前不提出代码修改。
7. 将运行环境、可观测性和安全 Skill 已确认的方向转换为适合当前 Docker 环境的具体实现建议。
8. 输出可追溯问题证据、根因或待验证假设、影响范围、修复方向、测试建议。
9. 获准的修复方向交给 `crawler-writing-plans-bridge`。

## 6. 问题分类规则

- **代码缺陷**：Docker 配置或项目代码未按当前版本行为处理（如构建指令错误、健康检查判定错误）。
- **配置错误**：Docker/Compose 配置与当前版本行为不符（如网络、卷、资源限制配置错误）。
- **版本兼容**：Docker/Compose 版本与配置行为不匹配（如配置引用已变更的指令）。
- **设计不足**：缺乏镜像分层、卷隔离、资源限制、健康检查等设计层面缺失。
- **外部条件**：运行环境不可用、外部服务受限等——只能给合规降级/等待/终止结论，不得伪装成已修复（主决策日志 §12/§62）。
- **未知项**：证据不足或冲突，保持候选假设，显式标记，不判定为确定根因。

每条结论必须明确区分：事实、证据、综合推断、待确认项。综合推断必须显式标记为"推断"，不得伪装成资料中的确定结论（主决策日志 §14）。

置信度使用固定枚举：高（证据充分且指向唯一分类）、中（证据充分但多个分类可能）、低（证据不足或冲突，仅候选假设）、不确定（无法判断）。

**实现转换规则**：将运行环境、可观测性和安全 Skill 已确认方向转换为 Docker 实现建议时，必须引用当前版本（moby docker-v29.7.0、docker-cli v29.7.0、compose v5.3.1、compose-spec、WSL 2.7.11）的 API 与配置语义；不得默认采用审查时最新 Release 或历史草案版本（主决策日志 §71/§75）。识别"准确区分项目容器配置问题、Docker/WSL 环境问题与应用代码问题"是验收重点。

## 7. 证据卡主题分组

共享证据卡 `docs/superpowers/knowledge/evidence-cards/docker.md` 从批次 5 固定资料筛选，按以下主题分组（实施时按实际固定资料筛选具体卡片）：

1. **Dockerfile 与镜像构建**：moby `daemon/build.go`、`api/`；docker-cli `cli/command/image/`。
2. **Compose 与编排**：compose-spec `05-services.md`、`06-networks.md`、`07-volumes.md`、`08-configs.md`、`09-secrets.md`；docker-compose `pkg/`、`cmd/`。
3. **容器网络**：moby `daemon/network/`；compose-spec `06-networks.md`。
4. **卷与权限**：moby `daemon/volumes/`；compose-spec `07-volumes.md`。
5. **资源限制/健康检查/运行日志**：moby `daemon/`（OOM、healthcheck 相关）；WSL `doc/`、`diagnostics/`。

## 8. 输出契约

诊断记录采用可落盘结构化记录＋简短人类可读摘要（主决策日志 §33 节），每条结论可追溯。固定字段：

- 问题证据（定位到的 Docker 配置/版本/运行状态/日志/环境证据位置）。
- 分类（代码缺陷 / 配置错误 / 版本兼容 / 设计不足 / 外部条件 / 未知项；含置信度：高/中/低/不确定）。
- 根因或待验证假设（区分事实、证据、推断、待确认项）。
- 影响范围（受影响的容器、镜像、网络、卷、部署面）。
- 修复方向（适合当前 Docker 环境的具体实现建议，指向匹配版本资料）。
- 测试建议（只读检查、隔离复现、健康检查验证方法）。
- 依据（关联证据卡 ID、固定资料路径、Docker 配置/日志位置）。

记录必须明确区分：事实、证据、推断、待确认项与用户批准状态。

## 9. 交接契约

- 遵守主决策日志第 33-36 节：可落盘结构化记录＋简短人类摘要；双层存储（小型记录项目内保存、大型证据以内容哈希和相对路径引用）；敏感信息落盘前脱敏。
- 将运行环境、可观测性和安全 Skill 已确认方向转换为 Docker 实现建议，但不得越过用户批准边界或跳过 `crawler-writing-plans-bridge`。
- 获准的修复方向交给 `crawler-writing-plans-bridge` 作为规划输入，不取代其规划职责。
- Docker 引擎/镜像/容器/卷/WSL 数据必须位于 E 盘（主决策日志 §30/§31/§62）。
- 诊断结论明确区分事实、证据、推断、待确认项与用户批准状态。

## 10. 文件结构

```text
skills/crawler-run-docker/
  SKILL.md                              # 精简触发＋门禁＋路由＋输出＋禁止项
  references/
    docker-workflow.md                  # 诊断流程、问题分类规则、实现转换规则、证据卡映射
    output-contract.md                  # 输出契约、交接契约、修订保留
docs/superpowers/knowledge/
  evidence-cards/
    docker.md                           # 共享证据卡（从批次 5 固定资料筛选）
  skill-views/
    crawler-run-docker.md               # Skill 17 独立知识视图（引用证据卡）
tests/skills/crawler-run-docker/
  cases.md                              # 行为/安全案例（RED/GREEN 用）
  results.md                            # 红/绿行为评估记录
```

不引入 `validate.ps1`：Docker 专项诊断报告依赖动态项目证据与判断，机械结构校验价值有限，按最小充分原则（主决策日志 §107 先例）以行为案例验证为主。

## 11. 验证设计

### 11.1 结构验证

静态检查：
- Skill 包文件齐全（SKILL.md、docker-workflow.md、output-contract.md）。
- 共享证据卡 `docker.md` 与知识视图 `crawler-run-docker.md` 存在；知识视图引用证据卡。
- 诊断流程与问题分类规则、实现转换规则在 references 中明确定义。
- 无 `TBD`、`TODO`、`FIXME` 占位符。
- 无肯定式运行指令；仅有负面安全声明与诊断流程描述。
- 不含敏感信息示例（密钥、Cookie、认证头、代理凭据）。
- 非 Git 边界：项目根目录不是 Git worktree；不初始化 Git。

### 11.2 行为验证（RED/GREEN）

按 `superpowers:writing-skills` 方法运行固定行为案例，每个案例使用全新隔离的 Agent 上下文：

- 按诊断聚焦点聚焦：只诊断触发问题对应的聚焦点，不无边界扩展。
- 问题分类正确：代码缺陷 / 配置错误 / 版本兼容 / 设计不足 / 外部条件 / 未知项。
- 识别 Docker 缺陷：能识别构建缓存错误、依赖缺失、DNS/网络异常、卷挂载错误、权限问题、OOM、资源配置不当。
- 准确区分：能区分项目容器配置问题、Docker/WSL 环境问题与应用代码问题。
- 破坏性操作批准：镜像清理、卷修改、数据迁移等破坏性操作必须另行获得明确批准。
- 不越过批准边界：获准前不交给 `crawler-writing-plans-bridge`。
- 证据不足不判根因：证据不足时只提出最小补充取证，不把未知项误判为已定位根因。
- 敏感信息脱敏：诊断记录不含密钥/Cookie/认证头/代理凭据/环境变量中的秘密。

### 11.3 验收标准（对应主决策日志 §62）

- 能准确区分项目容器配置问题、Docker 或 WSL 环境问题与应用代码问题。
- 能避免破坏现有数据。
- 能遵守 E 盘存储约束（Docker/WSL 数据不得迁回 C 盘）。

达到上述标准即视为本 Skill 当前细节设计充分，不再扩展低优先级内部设计。

## 12. 阶段门

本规格经用户审阅批准后，才可调用 `superpowers:writing-plans` 生成 `crawler-run-docker` 的单 Skill 实施计划。用户未明确批准前，不进入 `writing-plans`，不实施本 Skill，不开始第 18 个 Skill。

`E:\Stellaris` 当前不是 Git 仓库。本设计只要求把文档可靠保存在本地项目中，不得为了满足提交步骤擅自初始化 Git。
