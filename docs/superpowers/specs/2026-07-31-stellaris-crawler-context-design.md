# Stellaris 项目上下文 Skill 设计规格

日期：2026-07-31  
状态：书面规格待用户审阅  
适用范围：第 2 个独立 Agent Skill `stellaris-crawler-context` 的完整设计

## 1. 目标与边界

`stellaris-crawler-context` 是 Stellaris 项目专用层的 Agent 知识 Skill。其唯一职责是：处理 Stellaris 项目问题时，现场只读核验当前项目事实，结合主决策日志中已批准的要求，固定输出一份可追溯的项目上下文包，交给 `crawler-triage-incidents` 作为故障分诊的可信项目背景。

本 Skill **不是**诊断器、修复器、规划器、记忆服务、索引服务、RAG、上下文框架或爬虫运行组件。它不诊断根因、不提出修复方案、不替代分诊、领域诊断或架构评审。

本设计只规划 `stellaris-crawler-context`，不包含第 3 个及后续 Skill 的实施任务；不创建或实施本 Skill 本身（实施由 Claude Code 按后续写作计划执行）。

## 2. 已确认输入

- 主决策日志：`docs/superpowers/brainstorming/2026-07-31-crawler-knowledge-skills-decision-log.md`（已确认决策的最高权威，动态提取已批准要求）。
- 统一知识设计规格：`docs/superpowers/specs/2026-07-31-crawler-knowledge-skills-knowledge-design.md`（公共知识契约）。
- 第 6 批资料审查：`docs/superpowers/source-reviews/2026-07-31-batch-06-stellaris-project-context-review.md`（项目专用层的来源权威顺序、候选/拒绝来源）。
- 现场只读核验结果：每次处理时重新核验，不依赖旧快照。
- 两份 2026-07-30 文档只作为历史设计与业务背景，不覆盖主决策日志。

## 3. 职责与排除项

### 3.1 职责

- 现场只读核验当前项目事实（目录结构、依赖及锁文件、配置、测试、启动/验证命令的存在性、E 盘可用空间与第三方资料库容量）。
- 动态提取已批准要求（每次从主决策日志提取，不另建独立批准清单）。
- 区分当前代码事实、已批准要求、历史设计草案、冲突与未知项。
- 固定输出项目上下文包并落盘（修订保留，不静默覆盖）。
- 主交接给 `crawler-triage-incidents`；其余下游 Skill 经分诊链路且获用户批准可读同一份上下文包。

### 3.2 排除项

- 不诊断根因、不提出修复方案、不生成 Superpowers `writing-plans`。
- 不替代 `crawler-triage-incidents`、领域诊断或架构评审。
- 不建设 memory、RAG、代码索引、上下文框架或运行服务。
- 不复制其他 18 个 Skill 的通用知识。
- 不把历史草案或未批准建议升格为硬约束；冲突不静默消解。
- 不修改爬虫代码、manifest、第三方仓库；不初始化 Git。
- 快照只用于定位，不替代现场核验。

## 4. 触发条件与输入

### 4.1 触发

处理 Stellaris 项目的故障或设计问题、且需要项目上下文时触发（对应主决策日志第 38 节主调用入口：先注入项目上下文再交分诊）。通用或跨项目爬虫问题直接进入 `crawler-triage-incidents`，不强制加载本 Skill。

### 4.2 最低输入

- Stellaris 问题描述（由用户或分诊发起）。
- 固定必读（顺序固定）：主决策日志 → 统一知识设计规格 → 现场只读核验结果。
- 现场核验范围：目录结构、依赖及锁文件、配置、测试、启动/验证命令的存在性、E 盘可用空间与第三方资料库容量、`.superpowers` 与第三方快照的排除确认。

## 5. 动态核验流程

每次处理按以下顺序执行（全部只读，不运行项目、不修改文件）：

1. 读取固定必读（主决策日志→统一规格），动态提取已批准要求。
2. 现场只读核验当前项目事实：目录结构、依赖及锁文件、配置、测试、启动/验证命令的存在性；E 盘可用空间与第三方资料库容量；确认 `.superpowers/brainstorm/**` 工具依赖与 `third-party/crawler-knowledge-sources/repos/**` 快照不属于项目实现事实。
3. 识别冲突：现场事实 vs 批准要求 vs 历史草案（如主决策日志第 72 节状态差异、第 75 节版本基线）。冲突并列报告，不自行选择其一。
4. 按五类×固定字段组织输出上下文包。
5. 追加落盘到 `docs/superpowers/knowledge/context-packages/`，保留修订，不静默覆盖。

## 6. 上下文包：五类内容×固定字段契约

| 内容类别 | 固定字段 |
|---|---|
| 当前代码事实 | 标签（current fact）、值/内容、来源位置（可核验路径）、验证时间、证据等级 |
| 已批准要求 | 标签（approved requirement）、值/内容、来源位置（主决策日志节号）、批准状态 |
| 历史设计草案 | 标签（historical draft）、值/内容、来源位置（2026-07-30 文档节号）、不得覆盖硬约束声明 |
| 冲突与未知项 | 标签（conflict/unknown）、冲突双方或未知描述、相关来源位置、状态（保持可见/不确定） |
| 建议分诊重点 | 标签（triage focus）、建议领域、依据（引用上文条目）、非根因结论声明 |

标签规则复用四类标签（已确认决策／当前事实／历史草案／Agent 推荐），并补充 conflict／unknown 标记。每条结论必须可追溯：从上下文包追到来源位置，再追到现场文件或主决策日志章节。

## 7. 上下文包模板

```markdown
# <主题> 项目上下文包
> 生成时间 / 现场核验时间 / 生成角色
## 1. 当前代码事实
## 2. 已批准要求
## 3. 历史设计草案
## 4. 冲突与未知项
## 5. 建议分诊重点
## 6. 修订记录（只追加，指向被替代版本）
```

## 8. 交接契约

- 主交接：`crawler-triage-incidents` 接收上下文包路径并读取。
- 其余下游 Skill（如 `crawler-review-architecture`、`crawler-writing-plans-bridge`）在通过分诊链路且获用户批准的诊断流程中可读取同一份上下文包。
- 上下文包含建议分诊重点，不含根因结论、修复方案或实施计划。
- 交接记录遵守：可落盘结构化记录＋简短人类可读摘要（主决策日志第 33 节）；小型记录项目内保存、大型证据以内容哈希和相对路径引用（第 35 节）；密钥、Cookie、认证请求头等敏感信息不得入包、落盘前脱敏（第 36 节）。

## 9. 文件结构

```text
skills/stellaris-crawler-context/
  SKILL.md                       # 精简触发＋门禁＋路由＋禁止项
  references/
    project-context.md           # 动态核验流程、五类字段契约、上下文包模板
    handoff-contract.md          # 与分诊的交接契约、标签规则、修订保留
docs/superpowers/knowledge/
  context-packages/              # 每次生成的上下文包（YYYY-MM-DD-<主题>-context-package.md）
tests/skills/stellaris-crawler-context/
  cases.md                       # 行为/安全案例（RED/GREEN 用）
  results.md                     # 红/绿行为评估记录
```

不引入 `validate.ps1`：上下文包依赖现场动态事实，机械结构校验价值有限，按最小充分原则（主决策日志第 42、94 节）以行为案例验证为主。

## 10. 验证设计

### 10.1 结构验证

静态检查：
- Skill 包文件齐全（SKILL.md、project-context.md、handoff-contract.md）。
- 五类字段契约在 project-context.md 中明确定义，模板与字段契约一致。
- 无 `TBD`、`TODO`、`FIXME` 占位符。
- 无肯定式运行指令；仅有负面安全声明与只读核验流程描述。
- 不含敏感信息示例（密钥、Cookie、认证头）。
- 非 Git 边界：项目根目录不是 Git worktree；不初始化 Git。

### 10.2 行为验证（RED/GREEN）

按 `superpowers:writing-skills` 方法运行固定行为案例，每个案例使用全新隔离的 Agent 上下文：

- 正常项目核验：正确识别模式、执行动态核验、输出上下文包。
- 代码事实缺失/无源码：如实记录"现场无实现制品"，不推测。
- 历史草案冲突：历史草案标注为历史，不覆盖主日志，冲突保持可见。
- 外部限制 vs 内部缺陷区分：只输出建议分诊重点，不越权判定根因。
- 越权诊断请求：拒绝提出修复方案、根因结论或 writing-plans 输入。
- 敏感信息入包请求：拒绝并脱敏。

### 10.3 验收标准（对应主决策日志第 43 节）

- 能够动态核验项目事实。
- 能够区分代码事实、已批准要求和历史设计草案。
- 能够暴露冲突与未知项。
- 能够把问题正确交给故障分诊领域。
- 不越权诊断根因或提出修复方案。

达到上述标准即视为本 Skill 当前细节设计充分，不再扩展低优先级内部设计。

## 11. 阶段门

本规格经用户审阅批准后，才可调用 `superpowers:writing-plans` 生成 `stellaris-crawler-context` 的单 Skill 实施计划。用户未明确批准前，不进入 `writing-plans`，不实施本 Skill，不开始第 3 个 Skill。

`E:\Stellaris` 当前不是 Git 仓库。本设计只要求把文档可靠保存在本地项目中，不得为了满足提交步骤擅自初始化 Git。
