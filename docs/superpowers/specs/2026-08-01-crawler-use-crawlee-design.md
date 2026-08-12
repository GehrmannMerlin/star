# crawler-use-crawlee Skill 设计规格

日期：2026-08-02  
状态：书面规格待用户审阅  
适用范围：第 15 个独立 Agent Skill `crawler-use-crawlee` 的完整设计

## 1. 目标与边界

`crawler-use-crawlee` 是爬虫知识资料库当前重点技术栈方向下的 Agent Crawlee 专项实现诊断、修复顾问。其职责是：依托项目锁定 Crawlee 版本对应的官方文档、发布说明、故障案例和源码，帮助 Agent 检查 Crawler 选择、`RequestQueue`、`Dataset`、`AutoscaledPool`、`SessionPool`、代理、生命周期和配置，识别错误 API 用法、版本差异、生命周期误解、队列或会话配置错误和资源调节问题。它将领域 Skill 已经确认的方向转换为适合当前 Crawlee 版本的具体实现建议。

本 Skill **不是**项目爬虫运行时的替代品。它不重复跨框架方法论；跨领域根因仍由对应领域 Skill 判断。

本设计只规划 `crawler-use-crawlee`，不包含第 16 个及后续 Skill 的实施任务；不创建或实施本 Skill 本身（实施由 Claude Code 按后续写作计划执行）。

## 2. 已确认输入

- 主决策日志：`docs/superpowers/brainstorming/2026-07-31-crawler-knowledge-skills-decision-log.md`（已确认决策的最高权威；§60/§51/§26.2）。
- 统一知识设计规格：`docs/superpowers/specs/2026-07-31-crawler-knowledge-skills-knowledge-design.md`（公共知识契约）。
- 固定源码清单：`third-party/crawler-knowledge-sources/manifest.md`。
- 处理 Stellaris 问题时：`stellaris-crawler-context` 生成的项目上下文包路径。
- 已确认根因与方向（`crawler-triage-incidents` 分诊结论，适用时）。
- 相关 Crawlee 代码、配置、依赖版本、日志和最小复现证据（现场只读核验）。

## 3. 职责与排除项

### 3.1 职责

- 检查项目中的 Crawlee 专项实现相关问题：
  - Crawler 选择（BasicCrawler、CheerioCrawler、PlaywrightCrawler、PuppeteerCrawler 等）；
  - `RequestQueue` 与请求调度；
  - `Dataset` 与数据存储；
  - `AutoscaledPool` 与资源调节；
  - `SessionPool` 与会话管理；
  - 代理、生命周期和配置。
- 识别错误 API 用法、版本差异、生命周期误解、队列或会话配置错误和资源调节问题。
- 将领域 Skill 已经确认的方向转换为适合当前 Crawlee 版本的具体实现建议。
- 输出可追溯问题证据、根因或待验证假设、影响范围、修复方向（Crawlee 实现建议）、测试建议。

### 3.2 排除项

- 不替代项目爬虫运行时。
- 不重复跨框架方法论；跨领域根因仍由对应领域 Skill 判断（主决策日志 §60）。
- 不把"配置合法"误判为"运行行为正确"。
- 不引用不存在或已经变更的 API（版本差异）。
- 不越过用户批准边界或跳过 `crawler-writing-plans-bridge`。
- Docker 具体问题交给 `crawler-run-docker`。
- 不生成 `writing-plans`、不提出未经批准的代码修改。
- 不安装、构建或运行未经批准的项目或第三方代码。
- 不修改爬虫代码、`manifest.md`、第三方仓库；不初始化 Git。
- 不把密钥、Cookie、认证请求头、代理凭据、环境变量中的秘密写入诊断记录，落盘前脱敏。

## 4. 触发条件与输入

### 4.1 触发

用户要求检查 Crawlee 专项实现相关设计或故障，或已经确认的问题涉及 Crawler 选择、`RequestQueue`、`Dataset`、`AutoscaledPool`、`SessionPool`、代理、生命周期或配置时触发（主决策日志 §60）。通常由 `crawler-triage-incidents` 分诊路由进入（已确认根因后），或用户直接要求 Crawlee 专项诊断。

### 4.2 最低输入

- 项目上下文（处理 Stellaris 问题时为 `stellaris-crawler-context` 项目上下文包路径）。
- 已确认根因与方向（`crawler-triage-incidents` 分诊结论，适用时）。
- 相关 Crawlee 代码、配置、依赖版本、日志和最小复现证据。
- 固定版本资料（批次 5：apify/crawlee）。

## 5. 诊断流程

1. 读取项目上下文（Stellaris 问题先读 `stellaris-crawler-context` 项目上下文包）、目标、约束与已确认根因。
2. 确定诊断聚焦点：Crawler 选择与生命周期 / `RequestQueue` 与请求调度 / `Dataset` 与数据存储 / `AutoscaledPool` 与资源调节 / `SessionPool` 与会话管理 / 代理与配置。
3. 检查相关 Crawlee 代码、配置、依赖版本、日志和最小复现证据，定位具体证据位置。
4. 引用匹配版本的证据卡（`crawlee.md`）比对项目行为与规范/实现/工程证据。
5. 分类：代码缺陷 / 配置错误 / 版本兼容 / 设计不足 / 外部条件 / 未知项。
6. 证据不足时只提出最小补充取证（最小 Crawlee 复现、相关测试）；根因未证实前不提出代码修改。
7. 将领域 Skill 已确认的方向转换为适合当前 Crawlee 版本的具体实现建议。
8. 输出可追溯问题证据、根因或待验证假设、影响范围、修复方向、测试建议。
9. 获准的修复方向交给 `crawler-writing-plans-bridge`。

## 6. 问题分类规则

- **代码缺陷**：Crawlee 代码未按锁定版本行为处理（如错误 API 用法、生命周期误解、资源调节错误）。
- **配置错误**：Crawlee 配置与锁定版本行为不符（如队列、会话、代理配置错误）。
- **版本兼容**：Crawlee 版本与 API 行为不匹配（如引用已变更或已移除的 API）。
- **设计不足**：缺乏请求调度、会话管理、资源调节等设计层面缺失。
- **外部条件**：运行时环境不可用、外部服务受限等——只能给合规降级/等待/终止结论，不得伪装成已修复（主决策日志 §12/§60）。
- **未知项**：证据不足或冲突，保持候选假设，显式标记，不判定为确定根因。

每条结论必须明确区分：事实、证据、综合推断、待确认项。综合推断必须显式标记为"推断"，不得伪装成资料中的确定结论（主决策日志 §14）。

置信度使用固定枚举：高（证据充分且指向唯一分类）、中（证据充分但多个分类可能）、低（证据不足或冲突，仅候选假设）、不确定（无法判断）。

**实现转换规则**：将领域 Skill 已确认方向转换为 Crawlee 实现建议时，必须引用锁定版本（apify/crawlee v3.17.0）的 API 与配置语义；不得默认采用审查时最新 Release 或历史草案版本（主决策日志 §71/§75）。识别"配置合法但运行行为不符合预期"是验收重点。

## 7. 证据卡主题分组

共享证据卡 `docs/superpowers/knowledge/evidence-cards/crawlee.md` 从批次 5 固定资料筛选，按以下主题分组（实施时按实际固定资料筛选具体卡片）：

1. **Crawler 选择与生命周期**：Crawlee `packages/core/src/crawlers/`（BasicCrawler、CheerioCrawler 等）；`packages/core/src/configuration.ts`（`Configuration`、生命周期钩子）。
2. **`RequestQueue` 与请求调度**：Crawlee `packages/core/src/storages/`（RequestQueue 相关）；`packages/core/src/request.ts`。
3. **`Dataset` 与数据存储**：Crawlee `packages/core/src/storages/`（Dataset 相关）。
4. **`AutoscaledPool` 与资源调节**：Crawlee `packages/core/src/autoscaling/`（并发、背压、快照）。
5. **`SessionPool` 与代理**：Crawlee `packages/core/src/session_pool/`；`packages/core/src/proxy_configuration.ts`（代理配置）。

## 8. 输出契约

诊断记录采用可落盘结构化记录＋简短人类可读摘要（主决策日志 §33 节），每条结论可追溯。固定字段：

- 问题证据（定位到的 Crawlee 代码/配置/依赖版本/日志/复现证据位置）。
- 分类（代码缺陷 / 配置错误 / 版本兼容 / 设计不足 / 外部条件 / 未知项；含置信度：高/中/低/不确定）。
- 根因或待验证假设（区分事实、证据、推断、待确认项）。
- 影响范围（受影响的 Crawler、队列、数据集、会话、代理链）。
- 修复方向（适合当前 Crawlee 版本的具体实现建议，指向匹配版本资料）。
- 测试建议（最小 Crawlee 复现、相关测试方法）。
- 依据（关联证据卡 ID、固定资料路径、代码/配置/日志位置）。

记录必须明确区分：事实、证据、推断、待确认项与用户批准状态。

## 9. 交接契约

- 遵守主决策日志第 33-36 节：可落盘结构化记录＋简短人类摘要；双层存储（小型记录项目内保存、大型证据以内容哈希和相对路径引用）；敏感信息落盘前脱敏。
- 将领域 Skill 已确认方向转换为 Crawlee 实现建议，但不得越过用户批准边界或跳过 `crawler-writing-plans-bridge`。
- 获准的修复方向交给 `crawler-writing-plans-bridge` 作为规划输入，不取代其规划职责。
- 跨领域根因仍由对应领域 Skill 判断；Docker 具体问题交给 `crawler-run-docker`。
- 诊断结论明确区分事实、证据、推断、待确认项与用户批准状态。

## 10. 文件结构

```text
skills/crawler-use-crawlee/
  SKILL.md                              # 精简触发＋门禁＋路由＋输出＋禁止项
  references/
    crawlee-workflow.md                 # 诊断流程、问题分类规则、实现转换规则、证据卡映射
    output-contract.md                  # 输出契约、交接契约、修订保留
docs/superpowers/knowledge/
  evidence-cards/
    crawlee.md                          # 共享证据卡（从批次 5 固定资料筛选）
  skill-views/
    crawler-use-crawlee.md              # Skill 15 独立知识视图（引用证据卡）
tests/skills/crawler-use-crawlee/
  cases.md                              # 行为/安全案例（RED/GREEN 用）
  results.md                            # 红/绿行为评估记录
```

不引入 `validate.ps1`：Crawlee 专项诊断报告依赖动态项目证据与判断，机械结构校验价值有限，按最小充分原则（主决策日志 §107 先例）以行为案例验证为主。

## 11. 验证设计

### 11.1 结构验证

静态检查：
- Skill 包文件齐全（SKILL.md、crawlee-workflow.md、output-contract.md）。
- 共享证据卡 `crawlee.md` 与知识视图 `crawler-use-crawlee.md` 存在；知识视图引用证据卡。
- 诊断流程与问题分类规则、实现转换规则在 references 中明确定义。
- 无 `TBD`、`TODO`、`FIXME` 占位符。
- 无肯定式运行指令；仅有负面安全声明与诊断流程描述。
- 不含敏感信息示例（密钥、Cookie、认证头、代理凭据）。
- 非 Git 边界：项目根目录不是 Git worktree；不初始化 Git。

### 11.2 行为验证（RED/GREEN）

按 `superpowers:writing-skills` 方法运行固定行为案例，每个案例使用全新隔离的 Agent 上下文：

- 按诊断聚焦点聚焦：只诊断触发问题对应的聚焦点，不无边界扩展。
- 问题分类正确：代码缺陷 / 配置错误 / 版本兼容 / 设计不足 / 外部条件 / 未知项。
- 识别 Crawlee 缺陷：能识别错误 API 用法、Crawler 选择错误、队列/会话/代理配置错误、资源调节问题、"配置合法但运行行为不符合预期"。
- 版本准确：引用锁定版本（apify/crawlee v3.17.0）的 API 与配置语义；不引用不存在或已变更的 API。
- 不越过批准边界：不把"配置合法"误判为"运行行为正确"；获准前不交给 `crawler-writing-plans-bridge`。
- 证据不足不判根因：证据不足时只提出最小补充取证，不把未知项误判为已定位根因。
- 不重复跨框架方法论：不替代 Frontier/HTTP/浏览器/队列领域 Skill。
- 敏感信息脱敏：诊断记录不含密钥/Cookie/认证头/代理凭据/环境变量中的秘密。

### 11.3 验收标准（对应主决策日志 §60）

- 能够正确处理版本差异。
- 避免引用不存在或已经变更的 API。
- 发现"配置合法但运行行为不符合预期"的问题。

达到上述标准即视为本 Skill 当前细节设计充分，不再扩展低优先级内部设计。

## 12. 阶段门

本规格经用户审阅批准后，才可调用 `superpowers:writing-plans` 生成 `crawler-use-crawlee` 的单 Skill 实施计划。用户未明确批准前，不进入 `writing-plans`，不实施本 Skill，不开始第 16 个 Skill。

`E:\Stellaris` 当前不是 Git 仓库。本设计只要求把文档可靠保存在本地项目中，不得为了满足提交步骤擅自初始化 Git。
