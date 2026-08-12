# 爬虫知识 Skills 逐项规划与实施进度总账

最后更新：2026-08-03T0x+08:00  
当前阶段：19 个 Skill 全部完成（最终状态）  
当前 Skill：`crawler-writing-plans-bridge`（第 19 个，已完成）  
规划角色：Claude Code（两道门转交已批准）  
执行角色：Claude Code  
批准与最终审阅：用户

## 恢复入口

任何新会话必须按以下顺序读取，不得依赖聊天记忆：

1. `docs/superpowers/brainstorming/2026-07-31-crawler-knowledge-skills-decision-log.md`
2. `docs/superpowers/specs/2026-07-31-crawler-knowledge-skills-knowledge-design.md`
3. `third-party/crawler-knowledge-sources/manifest.md`
4. 本进度总账
5. 当前 Skill 的独立计划文档

**会话交接（2026-08-01）：** 当前会话已到达 Skill 4 `crawler-review-architecture` 的"待验证"状态。续接任务的权威交接文档已写入：
- `docs/superpowers/handoffs/2026-08-01-claude-code-skill-implementation-continue.md`

新会话在 `E:\Stellaris` 中完整读取并严格执行该交接文档后，从 Skill 4 待验证状态继续；验证通过后进入 Skill 5 `crawler-discover-frontier` 的 brainstorming。

## 全局规则

- 每次只规划或实施一个 Skill。
- 当前 Skill 的计划通过用户审阅前，不开始下一个 Skill。
- 具体实施交给 Claude Code；Codex 当前只生成计划和维护进度。
- `E:\Stellaris` 当前不是 Git 仓库，任何 Agent 不得擅自初始化 Git。
- 状态变化后先更新本总账，再继续下一动作。
- 可用状态仅为：`未开始`、`规划中`、`计划待审`、`计划已批准`、`Claude Code 执行中`、`待验证`、`已完成`、`已阻塞`。

## 19 个 Skill 固定顺序

| 顺序 | Skill | 状态 | 当前设计／计划文档 |
|---:|---|---|---|
| 1 | `crawler-curate-sources` | 已完成 | `docs/superpowers/plans/2026-07-31-crawler-curate-sources.md` |
| 2 | `stellaris-crawler-context` | 已完成 | `docs/superpowers/plans/2026-07-31-stellaris-crawler-context.md` |
| 3 | `crawler-triage-incidents` | 已完成 | `docs/superpowers/plans/2026-07-31-crawler-triage-incidents.md` |
| 4 | `crawler-review-architecture` | 已完成 | `docs/superpowers/plans/2026-08-01-crawler-review-architecture.md` |
| 5 | `crawler-discover-frontier` | 已完成 | `docs/superpowers/plans/2026-08-01-crawler-discover-frontier.md` |
| 6 | `crawler-debug-http-network` | 已完成 | `docs/superpowers/plans/2026-08-01-crawler-debug-http-network.md` |
| 7 | `crawler-automate-browsers` | 已完成 | `docs/superpowers/plans/2026-08-01-crawler-automate-browsers.md` |
| 8 | `crawler-validate-extraction` | 已完成 | `docs/superpowers/plans/2026-08-01-crawler-validate-extraction.md` |
| 9 | `crawler-tune-queues` | 已完成 | `docs/superpowers/plans/2026-08-01-crawler-tune-queues.md` |
| 10 | `crawler-manage-evidence-storage` | 已完成 | `docs/superpowers/plans/2026-08-01-crawler-manage-evidence-storage.md` |
| 11 | `crawler-observe-runtime` | 已完成 | `docs/superpowers/plans/2026-08-01-crawler-observe-runtime.md` |
| 12 | `crawler-enforce-security` | 已完成 | `docs/superpowers/plans/2026-08-01-crawler-enforce-security.md` |
| 13 | `crawler-test-regressions` | 已完成 | `docs/superpowers/plans/2026-08-01-crawler-test-regressions.md` |
| 14 | `crawler-debug-typescript-node` | 已完成 | `docs/superpowers/plans/2026-08-01-crawler-debug-typescript-node.md` |
| 15 | `crawler-use-crawlee` | 已完成 | `docs/superpowers/plans/2026-08-01-crawler-use-crawlee.md` |
| 16 | `crawler-use-playwright` | 已完成 | `docs/superpowers/plans/2026-08-01-crawler-use-playwright.md` |
| 17 | `crawler-run-docker` | 已完成 | `docs/superpowers/plans/2026-08-01-crawler-run-docker.md` |
| 18 | `crawler-use-postgresql` | 已完成 | `docs/superpowers/plans/2026-08-03-crawler-use-postgresql.md` |
| 19 | `crawler-writing-plans-bridge` | 已完成 | `docs/superpowers/plans/2026-08-03-crawler-writing-plans-bridge.md` |

## 前序 Skill：`crawler-observe-runtime`（已完成）

> 进入第 11 个 Skill（已完成）。仅规划，不实施。

### 已确认边界（继承自主决策日志 §56，不重新询问）

- `crawler-observe-runtime` 定位为面向 Agent 的运行环境与可观测性诊断顾问，不是项目中的常驻监控服务。
- 依托固定版本资料，帮助 Agent 检查项目中的运行环境、环境变量、资源限制、健康检查，以及日志、指标和 Trace 的采集与关联。
- 接收项目上下文，以及相关配置、运行状态、日志、指标、Trace 和资源证据，发现配置漂移、资源耗尽、健康检查失真、日志缺失、Trace 断链和故障现场信息不足。
- 输出可追溯的运行现象、证据缺口、影响范围和建议继续加载的领域 Skill；它负责准确说明"发生了什么、在哪里发生"，不以观测现象代替业务根因。
- 诊断确有必要时，可指导 Agent 执行安全的只读环境检查和短时诊断，但不常驻监控或替代项目运行系统。
- Docker 具体问题交给 `crawler-run-docker`，Node.js 运行时问题交给 `crawler-debug-typescript-node`，业务根因交给相应领域 Skill。
- 验收重点：能否为故障分诊收集足够、相关且可关联的运行证据，识别观测盲区，并避免把表面症状直接报告为根因。

### 当前设计／计划文档

- 设计规格：`docs/superpowers/specs/2026-08-01-crawler-observe-runtime-design.md`（已获用户审阅批准）
- 实施计划：`docs/superpowers/plans/2026-08-01-crawler-observe-runtime.md`（已获用户批准；44/44 复选项已核销）
- 当前状态：**已完成**（2026-08-01T22:35+08:00，用户验证实施结果通过后更新）。已进入第 12 个 Skill `crawler-enforce-security`。

### 当前 Skill 执行记录（Claude Code）

- **Skill 11 入口（2026-08-01）**：`crawler-manage-evidence-storage` 用户验证实施结果通过并更新为"已完成"；本 Skill 从"未开始"更新为"规划中"，当前阶段切换为 brainstorming，规划角色为 Claude Code。
- **只读检查（2026-08-01）**：确认当前项目仍无爬虫源码、`package.json`、锁文件、`tsconfig.json`、Dockerfile 或 Compose（与主决策日志 §71 一致）；skills/ 已有 Skill 1-10 共 10 个完成包；knowledge/ 已有 7 张证据卡与 7 个视图。批次 4 可观测性固定资料已只读核对：open-telemetry/opentelemetry-specification（`specification/` 下 overview、trace/{api,sdk}.md、metrics/data-model.md、logs/data-model.md、resource/sdk.md 含 `OTEL_RESOURCE_ATTRIBUTES` 环境变量检测/合并、self-observability.md、telemetry-stability.md）；prometheus/OpenMetrics（`specification/OpenMetrics.md` 1378 行，定义指标文本/Protobuf 暴露、`/metrics` 端点、pull/push）；批次 2 工程 Playbook `docs/observability/`（`log-vs-metric-vs-trace.md`、`best-practices.md`、`pitfalls.md`）作工程证据。素材充分，证据卡可资料驱动生成。未修改代码、未运行项目。
- **brainstorming（2026-08-01）**：按 `superpowers:brainstorming` 收束关键设计问题（主决策日志 §56 已确认职责；知识沉淀方式由 Skill 5-10 统一模式与统一知识设计规格 §77 共享证据层直接推出；无尚未确定且会实质改变设计的关键问题需单独提问）。方案比较：方案 A（共享证据卡＋知识视图＋references 分层 Skill 包）获确认，与 Skill 5-10 统一模式一致；方案 B（纯单文件）与方案 C（含校验器）因割裂共享证据层/机械校验价值有限被否。
  - 四段分段设计全部获用户批准（职责边界/触发/输入、诊断流程与问题分类规则、输出契约/交接/禁止项、文件结构与验证设计）。
- **书面规格（2026-08-01T23:1x）**：已写入 `docs/superpowers/specs/2026-08-01-crawler-observe-runtime-design.md` 并完成自审。
  - 自审结果：占位符 0（仅 §11.1 自审规则陈述文字）；无肯定式运行指令；无敏感信息示例；无第 12 个 Skill 实施任务；诊断流程/问题分类规则/证据卡分组/输出契约/交接契约内部一致（交接对象 `crawler-run-docker`/`crawler-debug-typescript-node`/`crawler-writing-plans-bridge`/`crawler-triage-incidents` 引用一致）；未引用历史草案为硬约束；非 Git 例外明确（§12）。
  - 用户已明确审阅批准该规格（主决策日志 §136）。
- **writing-plans（2026-08-01T23:3x）**：规格获批后调用 `superpowers:writing-plans`，已生成独立实施计划 `docs/superpowers/plans/2026-08-01-crawler-observe-runtime.md`。
  - 计划包含 8 个任务、8 个红/绿行为案例（OR-01 至 OR-08）、共享证据卡 `runtime-observability.md`（13 张：OR-ENV 3＋OR-MET 3＋OR-LOG 2＋OR-TRACE 3＋OR-OBS 2）、知识视图、诊断流程/分类规则、观测与根因边界重点、输出契约、交接契约、修订保留、非 Git 检查点、完成定义。
  - 自审通过：占位符 0；`crawler-enforce-security`/Skill 12 引用均为边界声明（不开始），无第 12 个 Skill 实施任务；接口一致（crawler-writing-plans-bridge 10 次、runtime-observability、diagnostic-workflow、output-contract、8 案例、非 Git 检查点）；规格覆盖完整（design §5-10 全部有对应任务）；测试可执行（8 案例含五小节契约与双运行）；"不以观测现象代替业务根因"规则显式。
  - 本 Skill 状态已更新为"计划待审"，等待用户审阅计划。
- **实施执行（2026-08-01，Claude Code）**：
  - 用户已批准 `crawler-observe-runtime` 独立实施计划，状态更新为"计划已批准"→"Claude Code 执行中"。加载 executing-plans、writing-skills、test-driven-development。
  - Task 1（行为案例与执行启动）：已完成。`tests/skills/crawler-observe-runtime/cases.md` 已创建（OR-01 至 OR-08，各含 Input／Expected classification／Required evidence／Forbidden behavior／Pass criteria）；8 案例唯一、每案例 5 小节齐全；`git rev-parse` 失败（128）确认非 Git，未初始化。
  - Task 2（共享证据卡）：已完成。`docs/superpowers/knowledge/evidence-cards/runtime-observability.md` 已创建，含来源身份头与 13 张证据卡（OR-ENV 3＋OR-MET 3＋OR-LOG 2＋OR-TRACE 3＋OR-OBS 2）；每张卡含全部 11 个必需字段（13/13）；本地证据路径 10/10 经存在性核验。
  - Task 3（知识视图）：已完成。`docs/superpowers/knowledge/skill-views/crawler-observe-runtime.md` 已创建；引用全部 13 张证据卡（13/13 完整、无遗漏、无多余）。
  - Task 4（诊断流程引用）：已完成。`skills/crawler-observe-runtime/references/diagnostic-workflow.md` 已创建，含诊断流程（7 聚焦点、分类、只读诊断边界）、问题分类规则（6 类＋置信度）、观测与根因边界重点（不以观测现象代替业务根因）、证据卡映射（5 个聚焦点×固定资料路径）。
  - Task 5（输出契约引用）：已完成。`skills/crawler-observe-runtime/references/output-contract.md` 已创建，含诊断记录输出契约（7 字段）、交接契约（§33-36 含代理凭据/环境变量秘密脱敏）、修订保留、禁止项。
  - Task 6（Skill 包实现）：已完成。`skills/crawler-observe-runtime/SKILL.md` 已创建（front matter＋触发＋必读输入＋8 条非协商门禁＋路由＋输出＋禁止）；SKILL.md 必含 token 全部验证通过（crawler-observe-runtime、crawler-writing-plans-bridge、运行环境、环境变量、资源限制、健康检查、日志、指标、Trace、绝不、主决策日志、diagnostic-workflow、output-contract、runtime-observability）。
  - Task 7（红/绿行为评估）：已完成。对 OR-01 至 OR-08 各运行一个未加载 Skill 的 baseline 与一个加载 Skill 的 Skill-assisted Agent，共 16 次全新隔离上下文运行，全部为"只生成回答文本"压力场景；无任何 Agent 尝试实际执行禁止动作，无安全失败。结果 **8 PASS，0 FAIL**。`tests/skills/crawler-observe-runtime/results.md` 已创建，每案例记录运行标识（agentId）、时间戳、实际决定与短原文、Required evidence／Forbidden behavior／Pass criteria 逐项判定。如实记录：基线大多自然遵守部分规则；OR-01 基线因用户"顺带查 HTTP/解析"措辞做全栈三线诊断，Skill 明确"按聚焦点聚焦＋越界请求转交"；**OR-04 基线把"内存攀升→OOM"直接推断为"内存泄漏型增长"根因并给代码级修复建议，Skill 落实"观测与根因边界"硬性规则，无条件拒绝以观测现象代替业务根因——这是 Skill 提供关键职责边界约束的核心真实差异点**；OR-06 基线不直接放行但未硬性区分"疑问句非批准指令"，Skill 落实门禁 6＋"确认现象与方向≠诊断记录获批"——这是 Skill 提供关键批准门约束的真实差异点；未虚构 RED。无修复需求。
  - Task 8（终验、交接与待验证）：已完成。
    - 新鲜结构验证：7 个必需文件全部存在（SKILL.md、diagnostic-workflow.md、output-contract.md、evidence-cards/runtime-observability.md、skill-views/crawler-observe-runtime.md、cases.md、results.md）；cases OR=8、results OR=8，各唯一。
    - 占位符扫描：0；肯定式运行指令：0（匹配项均为 cases.md Input/Forbidden behavior 的否定语境描述与 results.md 安全声明，无肯定式指令）；敏感信息示例：0。
    - 覆盖率核对：诊断流程/问题分类规则/观测与根因边界匹配规格 §5-6；证据卡分组（13 张五组：OR-ENV 3＋OR-MET 3＋OR-LOG 2＋OR-TRACE 3＋OR-OBS 2）匹配规格 §7；输出契约匹配 §8；交接契约匹配 §9 与主日志 §33-36；`stellaris-crawler-context` 上下文包读取显式（Stellaris 问题）；修订保留显式；无第 12 个 Skill 实施任务（Skill 12 引用为 0）。
    - 计划 44 个复选步骤已依据证据全部核销（44/44 勾选、0 未勾选）。
    - `git -C E:\Stellaris rev-parse --is-inside-work-tree` 失败（128），确认非 Git，未初始化。
    - E 盘可用 239.54 GiB（> 120 GB）；第三方资料库 3,176,257,776 bytes ≈ 2.96 GiB（< 50 GB 软上限，未变）。
    - 已加载并执行 `superpowers:verification-before-completion`（证据先于断言）。
    - 本 Skill 创建/修改的全部路径：
      - `skills/crawler-observe-runtime/SKILL.md`
      - `skills/crawler-observe-runtime/references/diagnostic-workflow.md`
      - `skills/crawler-observe-runtime/references/output-contract.md`
      - `docs/superpowers/knowledge/evidence-cards/runtime-observability.md`
      - `docs/superpowers/knowledge/skill-views/crawler-observe-runtime.md`
      - `tests/skills/crawler-observe-runtime/cases.md`
      - `tests/skills/crawler-observe-runtime/results.md`
      - `docs/superpowers/progress/crawler-knowledge-skills-progress.md`（本总账）
      - `docs/superpowers/plans/2026-08-01-crawler-observe-runtime.md`（44 复选项核销）
    - 未修改 `manifest.md`、任何第三方仓库、其他 Skill；未初始化 Git。
    - 本 Skill 状态已更新为"待验证"，等待用户或独立 reviewer 验证实施结果。
- **用户验证通过（2026-08-01T22:35+08:00）**：用户验证实施结果通过并授权进入第 12 个 Skill。`crawler-observe-runtime` 已正式更新为"已完成"；`crawler-enforce-security` 从"未开始"更新为"规划中"，当前阶段切换为其 brainstorming，规划角色为 Claude Code。

## 前序 Skill：`crawler-enforce-security`（已完成）

> 进入第 12 个 Skill（已完成）。仅规划，不实施。

### 已确认边界（继承自主决策日志 §57，不重新询问）

- `crawler-enforce-security` 定位为面向 Agent 的爬虫安全与合规审查、修复顾问。
- 依托固定版本资料，帮助 Agent 检查项目中的 SSRF、URL 与 DNS 校验、重定向、私网访问、密钥管理、依赖供应链、隔离执行、证据展示和公开数据访问边界。
- 判断项目动作属于允许、需要额外批准还是明确禁止；发现高风险问题或不合规方向时，必须阻止其进入普通修复流程。
- 输出可追溯的风险证据、严重程度、受影响范围、允许或禁止结论、合规修复方向和安全回归测试；获准的修复方向再交给 `crawler-writing-plans-bridge`。
- 可以指导 Agent 开展静态扫描、配置审查和隔离环境中的安全测试，但不得攻击外部网站，也不得提出绕过登录、验证码、访问权限或 WAF 的办法。
- 具体 Docker、Node.js、HTTP 或 PostgreSQL 实现问题交给对应领域或重点技术栈 Skill。
- 验收重点：能否发现固定安全案例中的漏洞、正确阻止不合规方案，并避免把未经审查的第三方示例代码用于项目。

### 当前设计／计划文档

- 设计规格：`docs/superpowers/specs/2026-08-01-crawler-enforce-security-design.md`（已获用户审阅批准）
- 实施计划：`docs/superpowers/plans/2026-08-01-crawler-enforce-security.md`（已获用户批准；44/44 复选项已核销）
- 当前状态：**已完成**（2026-08-02T00:3x+08:00，用户验证实施结果通过后更新）。已进入第 13 个 Skill `crawler-test-regressions`。

### 当前 Skill 执行记录（Claude Code）

- **Skill 12 入口（2026-08-01T22:35+08:00）**：`crawler-observe-runtime` 用户验证实施结果通过并更新为"已完成"；本 Skill 从"未开始"更新为"规划中"，当前阶段切换为 brainstorming，规划角色为 Claude Code。
- **只读检查（2026-08-02）**：确认当前项目仍无爬虫源码、`package.json`、锁文件、`tsconfig.json`、Dockerfile 或 Compose（与主决策日志 §71 一致）；skills/ 已有 Skill 1-11 共 11 个完成包。批次 3/4 安全/供应链固定资料已只读核对：whatwg/url（`url.bs` 4335 行，含 `#security-considerations`、host 解析/IDNA、URL 解析）；scrapy `downloadermiddlewares/redirect.py`（302/303/307/308、meta-refresh、重定向限制）与 `robotstxt.py`；curl `lib/`（`connect.c`、`dnscache.c`、`netrc.c`）；in-toto（`in_toto/verifylib.py`、`in_toto_verify.py`、`SECURITY.md`）；slsa（`docs/spec/v1.0/requirements.md`）；osv-schema（`docs/schema.md` OSV v1.8.0、`proto/vulnerability.proto`）。素材充分，证据卡可资料驱动生成。未修改代码、未运行项目。
- **brainstorming（2026-08-02）**：按 `superpowers:brainstorming` 收束关键设计问题（主决策日志 §57 已确认职责；知识沉淀方式由 Skill 5-11 统一模式与统一知识设计规格 §77 共享证据层直接推出；无尚未确定且会实质改变设计的关键问题需单独提问）。方案比较：方案 A（共享证据卡＋知识视图＋references 分层 Skill 包）获确认，与 Skill 5-11 统一模式一致；方案 B（纯单文件）与方案 C（含校验器）因割裂共享证据层/机械校验价值有限被否。
  - 四段分段设计全部获用户批准（职责边界/触发/输入、诊断流程与问题分类/动作判定规则、输出契约/交接/禁止项、文件结构与验证设计）。
- **书面规格（2026-08-02T00:0x）**：已写入 `docs/superpowers/specs/2026-08-01-crawler-enforce-security-design.md` 并完成自审。
  - 自审结果：占位符 0（仅 §11.1 自审规则陈述文字）；无肯定式运行指令；无敏感信息示例；无第 13 个 Skill 实施任务；诊断流程/问题分类/允许·需批准·禁止动作判定/证据卡分组/输出契约/交接契约内部一致；未引用历史草案为硬约束；非 Git 例外明确（§12）。
  - 本 Skill 状态更新为"规划中（书面规格待用户审阅）"，等待用户审阅书面规格；用户明确批准前不进入 `writing-plans`。
- **writing-plans（2026-08-02T00:2x）**：规格获批后调用 `superpowers:writing-plans`，已生成独立实施计划 `docs/superpowers/plans/2026-08-01-crawler-enforce-security.md`。
  - 计划包含 8 个任务、8 个红/绿行为案例（EC-01 至 EC-08）、共享证据卡 `security-compliance.md`（12 张：EC-URL 3＋EC-REDIR 2＋EC-SEC 2＋EC-SUPPLY 3＋EC-ISOL 2）、知识视图、诊断流程/动作判定（允许/需批准/禁止）/分类规则、输出契约、交接契约、修订保留、非 Git 检查点、完成定义。
  - 自审通过：占位符 0；`crawler-test-regressions`/Skill 13 引用均为边界声明（不开始），无第 13 个 Skill 实施任务；接口一致（crawler-writing-plans-bridge 9 次、security-compliance、security-workflow、output-contract、8 案例、非 Git 检查点）；规格覆盖完整（design §5-10 全部有对应任务）；测试可执行（8 案例含五小节契约与双运行）；"允许/需批准/禁止动作判定＋阻止不合规方向"规则显式。
  - 本 Skill 状态已更新为"计划待审"，等待用户审阅计划。
- **实施执行（2026-08-02，Claude Code）**：
  - 用户已批准 `crawler-enforce-security` 独立实施计划，状态更新为"计划已批准"→"Claude Code 执行中"。加载 executing-plans、writing-skills、test-driven-development。
  - Task 1（行为案例与执行启动）：已完成。`tests/skills/crawler-enforce-security/cases.md` 已创建（EC-01 至 EC-08，各含 Input／Expected classification／Required evidence／Forbidden behavior／Pass criteria）；8 案例唯一、每案例 5 小节齐全；`git rev-parse` 失败（128）确认非 Git，未初始化。
  - Task 2（共享证据卡）：已完成。`docs/superpowers/knowledge/evidence-cards/security-compliance.md` 已创建，含来源身份头与 12 张证据卡（EC-URL 3＋EC-REDIR 2＋EC-SEC 2＋EC-SUPPLY 3＋EC-ISOL 2）；每张卡含全部 11 个必需字段（12/12）；本地证据路径 12/12 经存在性核验。
  - Task 3（知识视图）：已完成。`docs/superpowers/knowledge/skill-views/crawler-enforce-security.md` 已创建；引用全部 12 张证据卡（12/12 完整、无遗漏、无多余）。
  - Task 4（安全流程引用）：已完成。`skills/crawler-enforce-security/references/security-workflow.md` 已创建，含诊断流程（6 聚焦点、分类、只读诊断边界）、动作判定规则（允许/需批准/禁止）、问题分类规则（6 类＋置信度）、证据卡映射（5 个聚焦点×固定资料路径）。
  - Task 5（输出契约引用）：已完成。`skills/crawler-enforce-security/references/output-contract.md` 已创建，含诊断记录输出契约（7 字段）、交接契约（§33-36 含密钥/代理凭据脱敏）、修订保留、禁止项。
  - Task 6（Skill 包实现）：已完成。`skills/crawler-enforce-security/SKILL.md` 已创建（front matter＋触发＋必读输入＋8 条非协商门禁＋路由＋输出＋禁止）；SKILL.md 必含 token 全部验证通过（crawler-enforce-security、crawler-writing-plans-bridge、SSRF、URL、DNS、密钥、供应链、隔离、访问边界、允许、明确禁止、绝不、主决策日志、security-workflow、output-contract、security-compliance）。
  - Task 7（红/绿行为评估）：已完成。对 EC-01 至 EC-08 各运行一个未加载 Skill 的 baseline 与一个加载 Skill 的 Skill-assisted Agent，共 16 次全新隔离上下文运行，全部为"只生成回答文本"压力场景；无任何 Agent 尝试实际执行禁止动作，无安全失败。结果 **8 PASS，0 FAIL**。`tests/skills/crawler-enforce-security/results.md` 已创建，每案例记录运行标识（agentId）、时间戳、实际决定与短原文、Required evidence／Forbidden behavior／Pass criteria 逐项判定。如实记录：基线大多自然遵守部分规则；EC-01 基线因用户"顺带查 HTTP/解析"措辞做全栈多块诊断，Skill 明确"按聚焦点聚焦＋越界请求转交"；**EC-02 基线直接给 SSRF 代码级修复方案且未判定动作允许/禁止、未阻止进入修复流程，Skill 落实"动作判定（明确禁止）＋阻止进入普通修复流程＋合规方向与隔离测试"——这是 Skill 提供关键职责边界约束的核心真实差异点**；EC-05 基线给密钥修复方案但未判定修改动作需批准，Skill 落实"现状明确禁止＋修复需额外批准"——这是 Skill 提供关键批准门约束的真实差异点；EC-06 基线未硬性区分"疑问句非批准指令"，Skill 落实门禁 6＋"认可≠批准"；未虚构 RED。无修复需求。
  - Task 8（终验、交接与待验证）：已完成。
    - 新鲜结构验证：7 个必需文件全部存在（SKILL.md、security-workflow.md、output-contract.md、evidence-cards/security-compliance.md、skill-views/crawler-enforce-security.md、cases.md、results.md）；cases EC=8、results EC=8，各唯一。
    - 占位符扫描：0；肯定式运行/攻击指令：0（匹配项均为 cases.md Forbidden behavior 描述、evidence-cards 否定语境、skill-views 禁止声明，无肯定式指令）；敏感信息示例：0（仅案例标题含 "secret-hygiene" 字样，非敏感内容）。
    - 覆盖率核对：诊断流程/动作判定规则/问题分类规则匹配规格 §5-6；证据卡分组（12 张五组：EC-URL 3＋EC-REDIR 2＋EC-SEC 2＋EC-SUPPLY 3＋EC-ISOL 2）匹配规格 §7；输出契约匹配 §8；交接契约匹配 §9 与主日志 §33-36；`stellaris-crawler-context` 上下文包读取显式（Stellaris 问题）；修订保留显式；无第 13 个 Skill 实施任务（Skill 13 引用为 0）。
    - 计划 44 个复选步骤已依据证据全部核销（44/44 勾选、0 未勾选）。
    - `git -C E:\Stellaris rev-parse --is-inside-work-tree` 失败（128），确认非 Git，未初始化。
    - E 盘可用 239.54 GiB（> 120 GB）；第三方资料库 3,176,257,776 bytes ≈ 2.96 GiB（< 50 GB 软上限，未变）。
    - 已加载并执行 `superpowers:verification-before-completion`（证据先于断言）。
    - 本 Skill 创建/修改的全部路径：
      - `skills/crawler-enforce-security/SKILL.md`
      - `skills/crawler-enforce-security/references/security-workflow.md`
      - `skills/crawler-enforce-security/references/output-contract.md`
      - `docs/superpowers/knowledge/evidence-cards/security-compliance.md`
      - `docs/superpowers/knowledge/skill-views/crawler-enforce-security.md`
      - `tests/skills/crawler-enforce-security/cases.md`
      - `tests/skills/crawler-enforce-security/results.md`
      - `docs/superpowers/progress/crawler-knowledge-skills-progress.md`（本总账）
      - `docs/superpowers/plans/2026-08-01-crawler-enforce-security.md`（44 复选项核销）
    - 未修改 `manifest.md`、任何第三方仓库、其他 Skill；未初始化 Git。
    - 本 Skill 状态已更新为"待验证"，等待用户或独立 reviewer 验证实施结果。
- **用户验证通过（2026-08-02T00:3x+08:00）**：用户验证实施结果通过并授权进入第 13 个 Skill。`crawler-enforce-security` 已正式更新为"已完成"；`crawler-test-regressions` 从"未开始"更新为"规划中"，当前阶段切换为其 brainstorming，规划角色为 Claude Code。

## 前序 Skill：`crawler-test-regressions`（已完成）

> 进入第 13 个 Skill（已完成）。仅规划，不实施。

### 已确认边界（继承自主决策日志 §58，不重新询问）

- `crawler-test-regressions` 定位为面向 Agent 的爬虫测试与修复验证顾问，不是项目测试体系的替代品。
- 依托固定版本资料、测试指南、故障案例和合规源码，并结合已经确认的根因与项目验收标准，帮助 Agent 设计单元测试、集成测试、回放测试、契约测试、金标数据、故障注入、性能和安全回归。
- 修复前，负责形成能够稳定暴露问题的失败案例；用户批准实施后，指导或协助 Agent 运行相关测试并保存结果证据。
- 检查修复是否真正解决原问题、是否引入新问题，以及外部网站异常是否被错误计入项目自身测试失败。
- 输出测试范围、测试依据、通过或失败结果、未覆盖风险和发布阻断结论；安全或正确性硬门槛失败时必须阻止通过。
- 不替代领域 Skill 诊断根因；测试发现新的未知问题时，必须退回 `crawler-triage-incidents`。
- 验收重点：固定缺陷能够被测试捕获、无结果证据时不能宣称修复成功，并且关键回归失败时能够正确阻止通过。

### 当前设计／计划文档

- 设计规格：`docs/superpowers/specs/2026-08-01-crawler-test-regressions-design.md`（已获用户审阅批准）
- 实施计划：`docs/superpowers/plans/2026-08-01-crawler-test-regressions.md`（已获用户批准；44/44 复选项已核销）
- 当前状态：**已完成**（2026-08-02T01:2x+08:00，用户验证实施结果通过后更新）。已进入第 14 个 Skill `crawler-debug-typescript-node`。

### 当前 Skill 执行记录（Claude Code）

- **Skill 13 入口（2026-08-02T00:3x+08:00）**：`crawler-enforce-security` 用户验证实施结果通过并更新为"已完成"；本 Skill 从"未开始"更新为"规划中"，当前阶段切换为 brainstorming，规划角色为 Claude Code。
- **只读检查（2026-08-02）**：确认当前项目仍无爬虫源码、`package.json`、锁文件、`tsconfig.json`、Dockerfile 或 Compose（与主决策日志 §71 一致）；skills/ 已有 Skill 1-12 共 12 个完成包。批次 3/4 测试/回归固定资料已只读核对：pact-specification（`implementation-guidelines/` 契约测试语义）；toxiproxy（`toxics/`、`link.go` 网络退化模拟、`README.md` 故障注入框架——按主决策日志 §70 只作受控案例知识）；JSON-Schema-Test-Suite（`tests/` draft3-draft2020-12 校验语义、`output-tests/` 金标比对）；locust（负载测试源码）；in-toto（验证流程）。素材充分，证据卡可资料驱动生成。未修改代码、未运行项目。
- **brainstorming（2026-08-02）**：按 `superpowers:brainstorming` 收束关键设计问题（主决策日志 §58 已确认职责；知识沉淀方式由 Skill 5-12 统一模式与统一知识设计规格 §77 共享证据层直接推出；toxiproxy 准入边界已由主决策日志 §70 明确；无尚未确定且会实质改变设计的关键问题需单独提问）。方案比较：方案 A（共享证据卡＋知识视图＋references 分层 Skill 包）获确认，与 Skill 5-12 统一模式一致；方案 B（纯单文件）与方案 C（含校验器）因割裂共享证据层/机械校验价值有限被否。
  - 四段分段设计全部获用户批准（职责边界/触发/输入、诊断流程与测试设计规则、输出契约/交接/禁止项、文件结构与验证设计）。
- **书面规格（2026-08-02T00:5x）**：已写入 `docs/superpowers/specs/2026-08-01-crawler-test-regressions-design.md` 并完成自审。
  - 自审结果：占位符 0（仅 §11.1 自审规则陈述文字）；无肯定式运行指令；无敏感信息示例；无第 14 个 Skill 实施任务；诊断流程/测试设计规则/证据卡分组/输出契约/交接契约内部一致（`crawler-triage-incidents` 8 次、`crawler-writing-plans-bridge` 3 次引用一致）；toxiproxy §70 边界 2 处显式；发布阻断 13 处显式；未引用历史草案为硬约束；非 Git 例外明确（§12）。
  - 本 Skill 状态更新为"规划中（书面规格待用户审阅）"，等待用户审阅书面规格；用户明确批准前不进入 `writing-plans`。
- **writing-plans（2026-08-02T01:0x）**：规格获批后调用 `superpowers:writing-plans`，已生成独立实施计划 `docs/superpowers/plans/2026-08-01-crawler-test-regressions.md`。
  - 计划包含 8 个任务、8 个红/绿行为案例（TR-01 至 TR-08）、共享证据卡 `test-regressions.md`（12 张：TR-UNIT 3＋TR-REPLAY 2＋TR-CONTRACT 2＋TR-FAULT 2＋TR-PERF 1＋TR-SEC 2）、知识视图、诊断流程/RED-GREEN 规则/外部条件分离与发布阻断、输出契约、交接契约、修订保留、非 Git 检查点、完成定义。
  - 自审通过：占位符 0；`crawler-debug-typescript-node`/Skill 14 引用均为边界声明（不开始），无第 14 个 Skill 实施任务；接口一致（crawler-writing-plans-bridge 9 次、crawler-triage-incidents 7 次、test-workflow、output-contract、8 案例、非 Git 检查点）；toxiproxy §70 边界 8 处显式；规格覆盖完整（design §5-10 全部有对应任务）；测试可执行（8 案例含五小节契约与双运行）；"RED-GREEN＋无结果证据不宣称修复成功＋发布阻断"规则显式。
  - 本 Skill 状态已更新为"计划待审"，等待用户审阅计划。
- **实施执行（2026-08-02，Claude Code）**：
  - 用户已批准 `crawler-test-regressions` 独立实施计划，状态更新为"计划已批准"→"Claude Code 执行中"。加载 executing-plans、writing-skills、test-driven-development。
  - Task 1（行为案例与执行启动）：已完成。`tests/skills/crawler-test-regressions/cases.md` 已创建（TR-01 至 TR-08，各含 Input／Expected classification／Required evidence／Forbidden behavior／Pass criteria）；8 案例唯一、每案例 5 小节齐全；`git rev-parse` 失败（128）确认非 Git，未初始化。
  - Task 2（共享证据卡）：已完成。`docs/superpowers/knowledge/evidence-cards/test-regressions.md` 已创建，含来源身份头与 12 张证据卡（TR-UNIT 3＋TR-REPLAY 2＋TR-CONTRACT 2＋TR-FAULT 2＋TR-PERF 1＋TR-SEC 2）；每张卡含全部 11 个必需字段（12/12）；本地证据路径 10/10 经存在性核验。
  - Task 3（知识视图）：已完成。`docs/superpowers/knowledge/skill-views/crawler-test-regressions.md` 已创建；引用全部 12 张证据卡（12/12 完整、无遗漏、无多余）。
  - Task 4（测试流程引用）：已完成。`skills/crawler-test-regressions/references/test-workflow.md` 已创建，含诊断流程（6 聚焦点、分类、只读诊断边界）、RED-GREEN 测试设计规则、外部条件分离与发布阻断（含 toxiproxy §70 边界）、证据卡映射（5 个聚焦点×固定资料路径）。
  - Task 5（输出契约引用）：已完成。`skills/crawler-test-regressions/references/output-contract.md` 已创建，含诊断记录输出契约（7 字段）、交接契约（§33-36 含密钥/代理凭据脱敏）、修订保留、禁止项。
  - Task 6（Skill 包实现）：已完成。`skills/crawler-test-regressions/SKILL.md` 已创建（front matter＋触发＋必读输入＋8 条非协商门禁＋路由＋输出＋禁止）；SKILL.md 必含 token 全部验证通过（crawler-test-regressions、crawler-writing-plans-bridge、单元、集成、回放、契约、金标、故障注入、性能、回归、发布阻断、绝不、主决策日志、test-workflow、output-contract、test-regressions）。
  - Task 7（红/绿行为评估）：已完成。对 TR-01 至 TR-08 各运行一个未加载 Skill 的 baseline 与一个加载 Skill 的 Skill-assisted Agent，共 16 次全新隔离上下文运行，全部为"只生成回答文本"压力场景；无任何 Agent 尝试实际执行禁止动作，无安全失败。结果 **8 PASS，0 FAIL**。`tests/skills/crawler-test-regressions/results.md` 已创建，每案例记录运行标识（agentId）、时间戳、实际决定与短原文、Required evidence／Forbidden behavior／Pass criteria 逐项判定。如实记录：基线大多自然遵守部分规则；TR-01 基线因用户"顺带查 HTTP/队列"措辞做全栈多块诊断，Skill 明确"按聚焦点聚焦＋越界请求映射到证据卡"；**TR-08 基线未退回分诊、自行下钻查询根因（差异形态→假说映射、缓存头号嫌疑），Skill 落实"新未知问题必须退回 `crawler-triage-incidents`＋不自行下钻领域根因"——这是 Skill 提供关键职责边界约束的核心真实差异点**；TR-06 基线不直接放行但未硬性区分"疑问句非批准指令"，Skill 落实"方案≠交接物＋需补齐"；未虚构 RED。无修复需求。
  - Task 8（终验、交接与待验证）：已完成。
    - 新鲜结构验证：7 个必需文件全部存在（SKILL.md、test-workflow.md、output-contract.md、evidence-cards/test-regressions.md、skill-views/crawler-test-regressions.md、cases.md、results.md）；cases TR=8、results TR=8，各唯一。
    - 占位符扫描：0；肯定式运行/故障注入指令：0（匹配项均为来源身份头/§70 边界/cases Forbidden behavior/results 拒绝记录等否定语境）；敏感信息示例：0。
    - 覆盖率核对：诊断流程/RED-GREEN 规则/外部条件分离与发布阻断匹配规格 §5-6；证据卡分组（12 张六组：TR-UNIT 3＋TR-REPLAY 2＋TR-CONTRACT 2＋TR-FAULT 2＋TR-PERF 1＋TR-SEC 2）匹配规格 §7；输出契约匹配 §8；交接契约匹配 §9 与主日志 §33-36；toxiproxy §70 边界 4 文件显式；`stellaris-crawler-context` 上下文包读取显式（Stellaris 问题）；修订保留显式；无第 14 个 Skill 实施任务（Skill 14 引用为 0）。
    - 计划 44 个复选步骤已依据证据全部核销（44/44 勾选、0 未勾选）。
    - `git -C E:\Stellaris rev-parse --is-inside-work-tree` 失败（128），确认非 Git，未初始化。
    - E 盘可用 239.54 GiB（> 120 GB）；第三方资料库 3,176,257,776 bytes ≈ 2.96 GiB（< 50 GB 软上限，未变）。
    - 已加载并执行 `superpowers:verification-before-completion`（证据先于断言）。
    - 本 Skill 创建/修改的全部路径：
      - `skills/crawler-test-regressions/SKILL.md`
      - `skills/crawler-test-regressions/references/test-workflow.md`
      - `skills/crawler-test-regressions/references/output-contract.md`
      - `docs/superpowers/knowledge/evidence-cards/test-regressions.md`
      - `docs/superpowers/knowledge/skill-views/crawler-test-regressions.md`
      - `tests/skills/crawler-test-regressions/cases.md`
      - `tests/skills/crawler-test-regressions/results.md`
      - `docs/superpowers/progress/crawler-knowledge-skills-progress.md`（本总账）
      - `docs/superpowers/plans/2026-08-01-crawler-test-regressions.md`（44 复选项核销）
    - 未修改 `manifest.md`、任何第三方仓库、其他 Skill；未初始化 Git。
    - 本 Skill 状态已更新为"待验证"，等待用户或独立 reviewer 验证实施结果。
- **用户验证通过（2026-08-02T01:2x+08:00）**：用户验证实施结果通过并授权进入第 14 个 Skill。`crawler-test-regressions` 已正式更新为"已完成"；`crawler-debug-typescript-node` 从"未开始"更新为"规划中"，当前阶段切换为其 brainstorming，规划角色为 Claude Code。

## 前序 Skill：`crawler-debug-typescript-node`（已完成）

> 进入第 14 个 Skill（已完成）。仅规划，不实施。

### 已确认边界（继承自主决策日志 §59，不重新询问）

- `crawler-debug-typescript-node` 定位为面向 Agent 的 TypeScript 与 Node.js 实现诊断、修复顾问。
- 依托项目锁定版本对应的官方资料、技术指南、故障案例和合规源码，帮助 Agent 检查 `package.json`、锁文件、`tsconfig`、构建配置、项目代码、错误日志和运行时证据。
- 负责发现类型系统、ESM 与 CommonJS、异步控制、Stream、进程、错误处理、内存、构建和依赖兼容问题。
- 将领域 Skill 已经确认的修复方向转换为适合当前 TypeScript 与 Node.js 版本的具体实现建议，但不得越过用户批准边界或跳过 `crawler-writing-plans-bridge`。
- 诊断确有必要时，可以指导 Agent 执行最小编译、测试、性能分析或内存诊断。
- 不重复 URL、HTTP、浏览器、队列等跨框架通用方法论，只解决相关方向在 TypeScript 与 Node.js 中如何正确实现。
- 验收重点：适用版本准确、API 和语言用法正确，并能识别编译通过但运行行为错误的缺陷。

### 当前设计／计划文档

- 设计规格：`docs/superpowers/specs/2026-08-01-crawler-debug-typescript-node-design.md`（已获用户审阅批准）
- 实施计划：`docs/superpowers/plans/2026-08-01-crawler-debug-typescript-node.md`（已获用户批准；44/44 复选项已核销）
- 当前状态：**已完成**（2026-08-02T12:0x+08:00，用户验证实施结果通过后更新）。已进入第 15 个 Skill `crawler-use-crawlee`。

### 当前 Skill 执行记录（Claude Code）

- **Skill 14 入口（2026-08-02T01:2x+08:00）**：`crawler-test-regressions` 用户验证实施结果通过并更新为"已完成"；本 Skill 从"未开始"更新为"规划中"，当前阶段切换为 brainstorming，规划角色为 Claude Code。
- **只读检查（2026-08-02）**：确认当前项目仍无爬虫源码、`package.json`、锁文件、`tsconfig.json`、Dockerfile 或 Compose（与主决策日志 §71 一致）；skills/ 已有 Skill 1-13 共 13 个完成包。批次 5 TypeScript/Node.js 固定资料已只读核对：microsoft/TypeScript（`v6.0.3`，`src/compiler/` 下 checker.ts、parser.ts、scanner.ts、moduleNameResolver.ts、emitter.ts、program.ts 等）；nodejs/node（`v24.18.0` LTS，`lib/` 下 module.js、events.js、_stream_readable.js、_stream_writable.js、child_process.js 等，`doc/api/` 下 esm.md、modules.md、events.md、stream.md、buffer.md、process.md、errors.md）。素材充分，证据卡可资料驱动生成。未修改代码、未运行项目。
- **brainstorming（2026-08-02）**：按 `superpowers:brainstorming` 收束关键设计问题（主决策日志 §59 已确认职责；知识沉淀方式由 Skill 5-13 统一模式与统一知识设计规格 §77 共享证据层直接推出；版本基线由主决策日志 §76/§71/§75 明确为 TypeScript v6.0.3、node v24.18.0 LTS；无尚未确定且会实质改变设计的关键问题需单独提问）。方案比较：方案 A（共享证据卡＋知识视图＋references 分层 Skill 包）获确认，与 Skill 5-13 统一模式一致；方案 B（纯单文件）与方案 C（含校验器）因割裂共享证据层/机械校验价值有限被否。
  - 四段分段设计全部获用户批准（职责边界/触发/输入、诊断流程与问题分类规则、输出契约/交接/禁止项、文件结构与验证设计）。
- **书面规格（2026-08-02T01:4x）**：已写入 `docs/superpowers/specs/2026-08-01-crawler-debug-typescript-node-design.md` 并完成自审。
  - 自审结果：占位符 0（仅 §11.1 自审规则陈述文字）；无肯定式运行指令；无敏感信息示例；无第 15 个 Skill 实施任务；诊断流程/问题分类规则/实现转换规则/证据卡分组/输出契约/交接契约内部一致（`crawler-triage-incidents` 3 次、`crawler-writing-plans-bridge` 5 次、`crawler-run-docker` 2 次引用一致）；锁定版本 TypeScript v6.0.3、node v24.18.0 5 处显式；未引用历史草案为硬约束；非 Git 例外明确（§12）。
  - 本 Skill 状态更新为"规划中（书面规格待用户审阅）"，等待用户审阅书面规格；用户明确批准前不进入 `writing-plans`。
- **writing-plans（2026-08-02T02:0x）**：规格获批后调用 `superpowers:writing-plans`，已生成独立实施计划 `docs/superpowers/plans/2026-08-01-crawler-debug-typescript-node.md`。
  - 计划包含 8 个任务、8 个红/绿行为案例（TN-01 至 TN-08）、共享证据卡 `typescript-node.md`（13 张：TN-TYPE 3＋TN-MOD 3＋TN-ASYNC 2＋TN-STREAM 3＋TN-PROC 1＋TN-BUILD 1）、知识视图、诊断流程/分类规则/实现转换规则、输出契约、交接契约、修订保留、非 Git 检查点、完成定义。
  - 自审通过：占位符 0；`crawler-use-crawlee`/Skill 15 引用均为边界声明（不开始），无第 15 个 Skill 实施任务；接口一致（crawler-writing-plans-bridge 10 次、typescript-node、implementation-workflow、output-contract、8 案例、非 Git 检查点）；锁定版本 TypeScript v6.0.3、node v24.18.0 8 处显式；"编译通过但运行行为错误"6 处显式；规格覆盖完整（design §5-10 全部有对应任务）；测试可执行（8 案例含五小节契约与双运行）。
  - 本 Skill 状态已更新为"计划待审"，等待用户审阅计划。
- **实施执行（2026-08-02，Claude Code）**：
  - 用户已批准 `crawler-debug-typescript-node` 独立实施计划，状态更新为"计划已批准"→"Claude Code 执行中"。加载 executing-plans、writing-skills、test-driven-development。
  - Task 1（行为案例与执行启动）：已完成。`tests/skills/crawler-debug-typescript-node/cases.md` 已创建（TN-01 至 TN-08，各含 Input／Expected classification／Required evidence／Forbidden behavior／Pass criteria）；8 案例唯一、每案例 5 小节齐全；`git rev-parse` 失败（128）确认非 Git，未初始化。
  - Task 2（共享证据卡）：已完成。`docs/superpowers/knowledge/evidence-cards/typescript-node.md` 已创建，含来源身份头与 13 张证据卡（TN-TYPE 3＋TN-MOD 3＋TN-ASYNC 2＋TN-STREAM 3＋TN-PROC 1＋TN-BUILD 1）；每张卡含全部 11 个必需字段（13/13）；本地证据路径 19/19 经存在性核验。
  - Task 3（知识视图）：已完成。`docs/superpowers/knowledge/skill-views/crawler-debug-typescript-node.md` 已创建；引用全部 13 张证据卡（13/13 完整、无遗漏、无多余）。
  - Task 4（实现流程引用）：已完成。`skills/crawler-debug-typescript-node/references/implementation-workflow.md` 已创建，含诊断流程（6 聚焦点、分类、只读诊断边界）、问题分类规则（6 类＋置信度）、实现转换规则（锁定版本 TypeScript v6.0.3、node v24.18.0；编译通过≠运行正确）、证据卡映射（5 个聚焦点×固定资料路径）。
  - Task 5（输出契约引用）：已完成。`skills/crawler-debug-typescript-node/references/output-contract.md` 已创建，含诊断记录输出契约（7 字段）、交接契约（§33-36 含密钥/代理凭据脱敏）、修订保留、禁止项。
  - Task 6（Skill 包实现）：已完成。`skills/crawler-debug-typescript-node/SKILL.md` 已创建（front matter＋触发＋必读输入＋8 条非协商门禁＋路由＋输出＋禁止）；SKILL.md 必含 token 全部验证通过（crawler-debug-typescript-node、crawler-writing-plans-bridge、类型系统、tsconfig、ESM、CommonJS、异步、Stream、进程、错误处理、内存、构建、绝不、主决策日志、implementation-workflow、output-contract、typescript-node）。
  - Task 7（红/绿行为评估）：已完成。对 TN-01 至 TN-08 各运行一个未加载 Skill 的 baseline 与一个加载 Skill 的 Skill-assisted Agent，共 16 次全新隔离上下文运行，全部为"只生成回答文本"压力场景；无任何 Agent 尝试实际执行禁止动作，无安全失败。结果 **8 PASS，0 FAIL**。`tests/skills/crawler-debug-typescript-node/results.md` 已创建，每案例记录运行标识（agentId）、时间戳、实际决定与短原文、Required evidence／Forbidden behavior／Pass criteria 逐项判定。如实记录：基线大多自然遵守部分规则；TN-01 基线因用户"顺带查 HTTP/解析"措辞做全栈多块诊断，Skill 明确"按聚焦点聚焦＋越界请求路由到对应领域 Skill"；**TN-07 基线未拒绝跨框架处理、设计共享重试核心（`shared/retry.ts`）＋HTTP/队列适配器并给出完整实现方案，Skill 落实"门禁 7＋不重复跨框架方法论＋路由到 `crawler-debug-http-network`/`crawler-tune-queues`"——这是 Skill 提供关键职责边界约束的核心真实差异点**；TN-04 基线声称"TS 6.0.3 无一手信息"，Skill 落实"引用锁定版本资料＋编译通过≠运行正确"；TN-06 基线未硬性区分"疑问句非批准指令"，Skill 落实"根因方向≠完整记录获批"；未虚构 RED。无修复需求。
  - Task 8（终验、交接与待验证）：已完成。
    - 新鲜结构验证：7 个必需文件全部存在（SKILL.md、implementation-workflow.md、output-contract.md、evidence-cards/typescript-node.md、skill-views/crawler-debug-typescript-node.md、cases.md、results.md）；cases TN=8、results TN=8，各唯一。
    - 占位符扫描：0；肯定式安装/构建/运行指令：0；敏感信息示例：0。
    - 覆盖率核对：诊断流程/问题分类规则/实现转换规则匹配规格 §5-6；证据卡分组（13 张六组：TN-TYPE 3＋TN-MOD 3＋TN-ASYNC 2＋TN-STREAM 3＋TN-PROC 1＋TN-BUILD 1）匹配规格 §7；输出契约匹配 §8；交接契约匹配 §9 与主日志 §33-36；"编译通过≠运行正确"显式；锁定版本 TypeScript v6.0.3、node v24.18.0 显式；`stellaris-crawler-context` 上下文包读取显式（Stellaris 问题）；修订保留显式；无第 15 个 Skill 实施任务（Skill 15 引用为 0）。
    - 计划 44 个复选步骤已依据证据全部核销（44/44 勾选、0 未勾选）。
    - `git -C E:\Stellaris rev-parse --is-inside-work-tree` 失败（128），确认非 Git，未初始化。
    - E 盘可用 239.53 GiB（> 120 GB）；第三方资料库 3,176,257,776 bytes ≈ 2.96 GiB（< 50 GB 软上限，未变）。
    - 已加载并执行 `superpowers:verification-before-completion`（证据先于断言）。
    - 本 Skill 创建/修改的全部路径：
      - `skills/crawler-debug-typescript-node/SKILL.md`
      - `skills/crawler-debug-typescript-node/references/implementation-workflow.md`
      - `skills/crawler-debug-typescript-node/references/output-contract.md`
      - `docs/superpowers/knowledge/evidence-cards/typescript-node.md`
      - `docs/superpowers/knowledge/skill-views/crawler-debug-typescript-node.md`
      - `tests/skills/crawler-debug-typescript-node/cases.md`
      - `tests/skills/crawler-debug-typescript-node/results.md`
      - `docs/superpowers/progress/crawler-knowledge-skills-progress.md`（本总账）
      - `docs/superpowers/plans/2026-08-01-crawler-debug-typescript-node.md`（44 复选项核销）
    - 未修改 `manifest.md`、任何第三方仓库、其他 Skill；未初始化 Git。
    - 本 Skill 状态已更新为"待验证"，等待用户或独立 reviewer 验证实施结果。
- **用户验证通过（2026-08-02T12:0x+08:00）**：用户验证实施结果通过并授权进入第 15 个 Skill。`crawler-debug-typescript-node` 已正式更新为"已完成"；`crawler-use-crawlee` 从"未开始"更新为"规划中"，当前阶段切换为其 brainstorming，规划角色为 Claude Code。

## 前序 Skill：`crawler-use-crawlee`（已完成）

> 进入第 15 个 Skill（已完成）。仅规划，不实施。

### 已确认边界（继承自主决策日志 §60，不重新询问）

- `crawler-use-crawlee` 定位为面向 Agent 的 Crawlee 专项实现诊断、修复顾问。
- 依托项目锁定 Crawlee 版本对应的官方文档、发布说明、故障案例和源码，帮助 Agent 检查 Crawler 选择、`RequestQueue`、`Dataset`、`AutoscaledPool`、`SessionPool`、代理、生命周期和配置。
- 接收项目上下文，以及相关 Crawlee 代码、配置、依赖版本、日志和最小复现证据，识别错误 API 用法、版本差异、生命周期误解、队列或会话配置错误和资源调节问题。
- 将 Frontier、HTTP、浏览器、队列等领域 Skill 已经确认的方向转换为适合当前 Crawlee 版本的具体实现建议，但不得越过用户批准边界或跳过 `crawler-writing-plans-bridge`。
- 诊断确有必要时，可以指导 Agent 运行最小 Crawlee 复现与相关测试，但不替代项目爬虫运行时。
- 不重复跨框架方法论；跨领域根因仍由对应领域 Skill 判断。
- 验收重点：能够正确处理版本差异、避免引用不存在或已经变更的 API，并发现"配置合法但运行行为不符合预期"的问题。

### 当前设计／计划文档

- 设计规格：`docs/superpowers/specs/2026-08-01-crawler-use-crawlee-design.md`（已获用户审阅批准）
- 实施计划：`docs/superpowers/plans/2026-08-01-crawler-use-crawlee.md`（已获用户批准；44/44 复选项已核销）
- 当前状态：**已完成**（2026-08-02T12:4x+08:00，用户验证实施结果通过后更新）。已进入第 16 个 Skill `crawler-use-playwright`。

### 当前 Skill 执行记录（Claude Code）

- **Skill 15 入口（2026-08-02T12:0x+08:00）**：`crawler-debug-typescript-node` 用户验证实施结果通过并更新为"已完成"；本 Skill 从"未开始"更新为"规划中"，当前阶段切换为 brainstorming，规划角色为 Claude Code。
- **只读检查（2026-08-02）**：确认当前项目仍无爬虫源码、`package.json`、锁文件、`tsconfig.json`、Dockerfile 或 Compose（与主决策日志 §71 一致）；skills/ 已有 Skill 1-14 共 14 个完成包。批次 5 Crawlee 固定资料已只读核对：apify/crawlee（`v3.17.0` monorepo，`packages/core/src/` 下 crawlers/、storages/、autoscaling/、session_pool/、proxy_configuration.ts、request.ts、configuration.ts 等）。素材充分，证据卡可资料驱动生成。未修改代码、未运行项目。
- **brainstorming（2026-08-02）**：按 `superpowers:brainstorming` 收束关键设计问题（主决策日志 §60 已确认职责；知识沉淀方式由 Skill 5-14 统一模式与统一知识设计规格 §77 共享证据层直接推出；版本基线由主决策日志 §76 明确为 apify/crawlee v3.17.0；无尚未确定且会实质改变设计的关键问题需单独提问）。方案比较：方案 A（共享证据卡＋知识视图＋references 分层 Skill 包）获确认，与 Skill 5-14 统一模式一致；方案 B（纯单文件）与方案 C（含校验器）因割裂共享证据层/机械校验价值有限被否。
  - 四段分段设计全部获用户批准（职责边界/触发/输入、诊断流程与问题分类规则、输出契约/交接/禁止项、文件结构与验证设计）。
- **书面规格（2026-08-02T12:2x）**：已写入 `docs/superpowers/specs/2026-08-01-crawler-use-crawlee-design.md` 并完成自审。
  - 自审结果：占位符 0（仅 §11.1 自审规则陈述文字）；无肯定式运行指令；无敏感信息示例；无第 16 个 Skill 实施任务；诊断流程/问题分类规则/实现转换规则/证据卡分组/输出契约/交接契约内部一致（`crawler-triage-incidents` 3 次、`crawler-writing-plans-bridge` 5 次、`crawler-run-docker` 2 次引用一致）；锁定版本 apify/crawlee v3.17.0 4 处显式；未引用历史草案为硬约束；非 Git 例外明确（§12）。
  - 本 Skill 状态更新为"规划中（书面规格待用户审阅）"，等待用户审阅书面规格；用户明确批准前不进入 `writing-plans`。
- **writing-plans（2026-08-02T12:4x）**：规格获批后调用 `superpowers:writing-plans`，已生成独立实施计划 `docs/superpowers/plans/2026-08-01-crawler-use-crawlee.md`。
  - 计划包含 8 个任务、8 个红/绿行为案例（CL-01 至 CL-08）、共享证据卡 `crawlee.md`（13 张：CL-CRAWL 3＋CL-QUEUE 3＋CL-DATA 2＋CL-POOL 3＋CL-SESS 1＋CL-PROXY 1）、知识视图、诊断流程/分类规则/实现转换规则、输出契约、交接契约、修订保留、非 Git 检查点、完成定义。
  - 自审通过：占位符 0；`crawler-use-playwright`/Skill 16 引用均为边界声明（不开始），无第 16 个 Skill 实施任务；接口一致（crawler-writing-plans-bridge 10 次、crawlee、crawlee-workflow、output-contract、8 案例、非 Git 检查点）；锁定版本 apify/crawlee v3.17.0 9 处显式；"配置合法但运行行为不符合预期"6 处显式；规格覆盖完整（design §5-10 全部有对应任务）；测试可执行（8 案例含五小节契约与双运行）。
  - 本 Skill 状态已更新为"计划待审"，等待用户审阅计划。
- **实施执行（2026-08-02，Claude Code）**：
  - 用户已批准 `crawler-use-crawlee` 独立实施计划，状态更新为"计划已批准"→"Claude Code 执行中"。加载 executing-plans、writing-skills、test-driven-development。
  - Task 1（行为案例与执行启动）：已完成。`tests/skills/crawler-use-crawlee/cases.md` 已创建（CL-01 至 CL-08，各含 Input／Expected classification／Required evidence／Forbidden behavior／Pass criteria）；8 案例唯一、每案例 5 小节齐全；`git rev-parse` 失败（128）确认非 Git，未初始化。
  - Task 2（共享证据卡）：已完成。`docs/superpowers/knowledge/evidence-cards/crawlee.md` 已创建，含来源身份头与 13 张证据卡（CL-CRAWL 3＋CL-QUEUE 3＋CL-DATA 2＋CL-POOL 3＋CL-SESS 1＋CL-PROXY 1）；每张卡含全部 11 个必需字段（13/13）；本地证据路径 23/23 经存在性核验。
  - Task 3（知识视图）：已完成。`docs/superpowers/knowledge/skill-views/crawler-use-crawlee.md` 已创建；引用全部 13 张证据卡（13/13 完整、无遗漏、无多余）。
  - Task 4（Crawlee 流程引用）：已完成。`skills/crawler-use-crawlee/references/crawlee-workflow.md` 已创建，含诊断流程（6 聚焦点、分类、只读诊断边界）、问题分类规则（6 类＋置信度）、实现转换规则（锁定版本 apify/crawlee v3.17.0；配置合法≠运行行为正确）、证据卡映射（5 个聚焦点×固定资料路径）。
  - Task 5（输出契约引用）：已完成。`skills/crawler-use-crawlee/references/output-contract.md` 已创建，含诊断记录输出契约（7 字段）、交接契约（§33-36 含密钥/代理凭据脱敏）、修订保留、禁止项。
  - Task 6（Skill 包实现）：已完成。`skills/crawler-use-crawlee/SKILL.md` 已创建（front matter＋触发＋必读输入＋8 条非协商门禁＋路由＋输出＋禁止）；SKILL.md 必含 token 全部验证通过（crawler-use-crawlee、crawler-writing-plans-bridge、Crawler、RequestQueue、Dataset、AutoscaledPool、SessionPool、代理、生命周期、配置、绝不、主决策日志、crawlee-workflow、output-contract、crawlee）。
  - Task 7（红/绿行为评估）：已完成。对 CL-01 至 CL-08 各运行一个未加载 Skill 的 baseline 与一个加载 Skill 的 Skill-assisted Agent，共 16 次全新隔离上下文运行，全部为"只生成回答文本"压力场景；无任何 Agent 尝试实际执行禁止动作，无安全失败。结果 **8 PASS，0 FAIL**。`tests/skills/crawler-use-crawlee/results.md` 已创建，每案例记录运行标识（agentId）、时间戳、实际决定与短原文、Required evidence／Forbidden behavior／Pass criteria 逐项判定。如实记录：基线大多自然遵守部分规则；CL-01 基线因用户"顺带查 HTTP/解析"措辞做全栈多块诊断，Skill 明确"按聚焦点聚焦＋越界请求路由到对应领域 Skill"；**CL-07 基线未拒绝跨框架处理、设计 HTTP 重试＋浏览器渲染共享方法论并给出完整方案，Skill 落实"门禁 7＋不重复跨框架方法论＋路由到 `crawler-debug-http-network`/`crawler-automate-browsers`"——这是 Skill 提供关键职责边界约束的核心真实差异点**；CL-02 基线未把"配置合法≠运行行为正确"作硬门槛，Skill 落实门禁 4＋未知项分类；CL-04 基线凭记忆给 API 签名且声明"未联网核对"，Skill 落实"引用锁定版本资料"；CL-06 基线未硬性区分"疑问句非批准指令"，Skill 落实"根因方向≠诊断记录获批"；未虚构 RED。无修复需求。
  - Task 8（终验、交接与待验证）：已完成。
    - 新鲜结构验证：7 个必需文件全部存在（SKILL.md、crawlee-workflow.md、output-contract.md、evidence-cards/crawlee.md、skill-views/crawler-use-crawlee.md、cases.md、results.md）；cases CL=8、results CL=8，各唯一。
    - 占位符扫描：0；肯定式安装/构建/运行指令：0；敏感信息示例：0。
    - 覆盖率核对：诊断流程/问题分类规则/实现转换规则匹配规格 §5-6；证据卡分组（13 张六组：CL-CRAWL 3＋CL-QUEUE 3＋CL-DATA 2＋CL-POOL 3＋CL-SESS 1＋CL-PROXY 1）匹配规格 §7；输出契约匹配 §8；交接契约匹配 §9 与主日志 §33-36；"配置合法≠运行行为正确"显式；锁定版本 apify/crawlee v3.17.0 显式；`stellaris-crawler-context` 上下文包读取显式（Stellaris 问题）；修订保留显式；无第 16 个 Skill 实施任务（Skill 16 引用为 0）。
    - 计划 44 个复选步骤已依据证据全部核销（44/44 勾选、0 未勾选）。
    - `git -C E:\Stellaris rev-parse --is-inside-work-tree` 失败（128），确认非 Git，未初始化。
    - E 盘可用 239.53 GiB（> 120 GB）；第三方资料库 3,176,257,776 bytes ≈ 2.96 GiB（< 50 GB 软上限，未变）。
    - 已加载并执行 `superpowers:verification-before-completion`（证据先于断言）。
    - 本 Skill 创建/修改的全部路径：
      - `skills/crawler-use-crawlee/SKILL.md`
      - `skills/crawler-use-crawlee/references/crawlee-workflow.md`
      - `skills/crawler-use-crawlee/references/output-contract.md`
      - `docs/superpowers/knowledge/evidence-cards/crawlee.md`
      - `docs/superpowers/knowledge/skill-views/crawler-use-crawlee.md`
      - `tests/skills/crawler-use-crawlee/cases.md`
      - `tests/skills/crawler-use-crawlee/results.md`
      - `docs/superpowers/progress/crawler-knowledge-skills-progress.md`（本总账）
      - `docs/superpowers/plans/2026-08-01-crawler-use-crawlee.md`（44 复选项核销）
    - 未修改 `manifest.md`、任何第三方仓库、其他 Skill；未初始化 Git。
    - 本 Skill 状态已更新为"待验证"，等待用户或独立 reviewer 验证实施结果。
- **用户验证通过（2026-08-02T12:4x+08:00）**：用户验证实施结果通过并授权进入第 16 个 Skill。`crawler-use-crawlee` 已正式更新为"已完成"；`crawler-use-playwright` 从"未开始"更新为"规划中"，当前阶段切换为其 brainstorming，规划角色为 Claude Code。

## 前序 Skill：`crawler-use-playwright`（已完成）

> 进入第 16 个 Skill（已完成）。仅规划，不实施。

### 已确认边界（继承自主决策日志 §61，不重新询问）

- `crawler-use-playwright` 定位为面向 Agent 的 Playwright 专项实现诊断、修复顾问。
- 依托项目锁定 Playwright 版本对应的官方文档、发布说明、故障案例和源码，帮助 Agent 检查 `Browser`、`Context`、`Page`、Locator、等待条件、网络事件、资源拦截和浏览器启动配置。
- 接收项目上下文，以及相关 Playwright 代码、配置、依赖版本、Trace、截图、日志和最小复现证据，识别错误 API 用法、版本差异、元素定位不稳定、等待竞态、上下文泄漏和浏览器崩溃问题。
- 将 `crawler-automate-browsers` 已经确认的跨框架修复方向转换为适合当前 Playwright 版本的具体实现建议，但不得越过用户批准边界或跳过 `crawler-writing-plans-bridge`。
- 诊断确有必要时，可以指导 Agent 运行隔离的最小复现和 Trace 分析，但不得承担生产页面抓取。
- 不得提供绕过登录、验证码、访问控制或 WAF 的方法。
- 验收重点：适用版本准确、等待与定位方式可靠，并能发现偶发性的浏览器竞态和资源泄漏问题。

### 当前设计／计划文档

- 设计规格：`docs/superpowers/specs/2026-08-01-crawler-use-playwright-design.md`（已获用户审阅批准）
- 实施计划：`docs/superpowers/plans/2026-08-01-crawler-use-playwright.md`（已获用户批准；44/44 复选项已核销）
- 当前状态：**已完成**（2026-08-02T13:1x+08:00，用户验证实施结果通过后更新）。已进入第 17 个 Skill `crawler-run-docker`。

### 当前 Skill 执行记录（Claude Code）

- **Skill 16 入口（2026-08-02T12:4x+08:00）**：`crawler-use-crawlee` 用户验证实施结果通过并更新为"已完成"；本 Skill 从"未开始"更新为"规划中"，当前阶段切换为 brainstorming，规划角色为 Claude Code。
- **只读检查（2026-08-02）**：确认当前项目仍无爬虫源码、`package.json`、锁文件、`tsconfig.json`、Dockerfile 或 Compose（与主决策日志 §71 一致）；skills/ 已有 Skill 1-15 共 15 个完成包。批次 5 Playwright 固定资料已只读核对：microsoft/playwright（`v1.62.1`，`packages/playwright-core/src/client/` 下 browser.ts、browserContext.ts、page.ts、frame.ts、locator.ts、elementHandle.ts、network.ts、download.ts、browserType.ts 等）。素材充分，证据卡可资料驱动生成。未修改代码、未运行项目。
- **brainstorming（2026-08-02）**：按 `superpowers:brainstorming` 收束关键设计问题（主决策日志 §61 已确认职责；知识沉淀方式由 Skill 5-15 统一模式与统一知识设计规格 §77 共享证据层直接推出；版本基线由主决策日志 §76 明确为 microsoft/playwright v1.62.1；无尚未确定且会实质改变设计的关键问题需单独提问）。方案比较：方案 A（共享证据卡＋知识视图＋references 分层 Skill 包）获确认，与 Skill 5-15 统一模式一致；方案 B（纯单文件）与方案 C（含校验器）因割裂共享证据层/机械校验价值有限被否。
  - 四段分段设计全部获用户批准（职责边界/触发/输入、诊断流程与问题分类规则、输出契约/交接/禁止项、文件结构与验证设计）。
- **书面规格（2026-08-02T13:0x）**：已写入 `docs/superpowers/specs/2026-08-01-crawler-use-playwright-design.md` 并完成自审。
  - 自审结果：占位符 0（仅 §11.1 自审规则陈述文字）；无肯定式运行指令；无敏感信息示例；无第 17 个 Skill 实施任务；诊断流程/问题分类规则/实现转换规则/证据卡分组/输出契约/交接契约内部一致（`crawler-automate-browsers` 5 次、`crawler-triage-incidents` 3 次、`crawler-writing-plans-bridge` 5 次、`crawler-run-docker` 2 次引用一致）；锁定版本 microsoft/playwright v1.62.1 4 处显式；"不得提供绕过登录/验证码/访问控制/WAF" 3 处显式；未引用历史草案为硬约束；非 Git 例外明确（§12）。
  - 本 Skill 状态更新为"规划中（书面规格待用户审阅）"，等待用户审阅书面规格；用户明确批准前不进入 `writing-plans`。
- **writing-plans（2026-08-02T13:2x）**：规格获批后调用 `superpowers:writing-plans`，已生成独立实施计划 `docs/superpowers/plans/2026-08-01-crawler-use-playwright.md`。
  - 计划包含 8 个任务、8 个红/绿行为案例（PW-01 至 PW-08）、共享证据卡 `playwright.md`（13 张：PW-BROWSER 3＋PW-CTX 2＋PW-PAGE 3＋PW-LOC 3＋PW-NET 2）、知识视图、诊断流程/分类规则/实现转换规则、输出契约、交接契约、修订保留、非 Git 检查点、完成定义。
  - 自审通过：占位符 0；`crawler-run-docker`/Skill 17 引用均为边界声明（不开始），无第 17 个 Skill 实施任务；接口一致（crawler-writing-plans-bridge 10 次、playwright、playwright-workflow、output-contract、8 案例、非 Git 检查点）；锁定版本 microsoft/playwright v1.62.1 9 处显式；"不得提供绕过/不承担生产页面抓取"9 处显式；规格覆盖完整（design §5-10 全部有对应任务）；测试可执行（8 案例含五小节契约与双运行）。
  - 本 Skill 状态已更新为"计划待审"，等待用户审阅计划。
- **实施执行（2026-08-02，Claude Code）**：
  - 用户已批准 `crawler-use-playwright` 独立实施计划，状态更新为"计划已批准"→"Claude Code 执行中"。加载 executing-plans、writing-skills、test-driven-development。
  - Task 1（行为案例与执行启动）：已完成。`tests/skills/crawler-use-playwright/cases.md` 已创建（PW-01 至 PW-08，各含 Input／Expected classification／Required evidence／Forbidden behavior／Pass criteria）；8 案例唯一、每案例 5 小节齐全；`git rev-parse` 失败（128）确认非 Git，未初始化。
  - Task 2（共享证据卡）：已完成。`docs/superpowers/knowledge/evidence-cards/playwright.md` 已创建，含来源身份头与 13 张证据卡（PW-BROWSER 3＋PW-CTX 2＋PW-PAGE 3＋PW-LOC 3＋PW-NET 2）；每张卡含全部 11 个必需字段（13/13）；本地证据路径 10/10 经存在性核验。
  - Task 3（知识视图）：已完成。`docs/superpowers/knowledge/skill-views/crawler-use-playwright.md` 已创建；引用全部 13 张证据卡（13/13 完整、无遗漏、无多余）。
  - Task 4（Playwright 流程引用）：已完成。`skills/crawler-use-playwright/references/playwright-workflow.md` 已创建，含诊断流程（6 聚焦点、分类、只读诊断边界）、问题分类规则（6 类＋置信度）、实现转换规则（锁定版本 microsoft/playwright v1.62.1；适用版本准确≠运行行为正确）、证据卡映射（5 个聚焦点×固定资料路径）。
  - Task 5（输出契约引用）：已完成。`skills/crawler-use-playwright/references/output-contract.md` 已创建，含诊断记录输出契约（7 字段）、交接契约（§33-36 含 Trace/截图脱敏）、修订保留、禁止项。
  - Task 6（Skill 包实现）：已完成。`skills/crawler-use-playwright/SKILL.md` 已创建（front matter＋触发＋必读输入＋8 条非协商门禁＋路由＋输出＋禁止）；SKILL.md 必含 token 全部验证通过（crawler-use-playwright、crawler-writing-plans-bridge、Browser、Context、Page、Locator、等待、网络、拦截、Trace、绝不、主决策日志、playwright-workflow、output-contract、playwright）。
  - Task 7（红/绿行为评估）：已完成。对 PW-01 至 PW-08 各运行一个未加载 Skill 的 baseline 与一个加载 Skill 的 Skill-assisted Agent，共 16 次全新隔离上下文运行，全部为"只生成回答文本"压力场景；无任何 Agent 尝试实际执行禁止动作，无安全失败。结果 **8 PASS，0 FAIL**。`tests/skills/crawler-use-playwright/results.md` 已创建，每案例记录运行标识（agentId）、时间戳、实际决定与短原文、Required evidence／Forbidden behavior／Pass criteria 逐项判定。如实记录：基线大多自然遵守部分规则；PW-01 基线因用户"顺带查 HTTP/解析"措辞做全栈多块诊断，Skill 明确"按聚焦点聚焦＋越界请求转介"；**PW-04 基线声明"离线无法核实 v1.62.1 确切状态"，Skill 落实"引用锁定版本资料＋版本准确≠运行行为正确"——这是 Skill 提供关键版本准确性约束的真实差异点**；PW-02 基线未把"适用版本准确≠运行行为正确"作硬门槛，Skill 落实门禁 4＋候选假设；PW-06 基线未硬性区分"疑问句非批准指令"，Skill 落实"用户询问≠用户批准"；未虚构 RED。无修复需求。
  - Task 8（终验、交接与待验证）：已完成。
    - 新鲜结构验证：7 个必需文件全部存在（SKILL.md、playwright-workflow.md、output-contract.md、evidence-cards/playwright.md、skill-views/crawler-use-playwright.md、cases.md、results.md）；cases PW=8、results PW=8，各唯一。
    - 占位符扫描：0；肯定式安装/运行/生产抓取指令：0；敏感信息示例：0。
    - 覆盖率核对：诊断流程/问题分类规则/实现转换规则匹配规格 §5-6；证据卡分组（13 张五组：PW-BROWSER 3＋PW-CTX 2＋PW-PAGE 3＋PW-LOC 3＋PW-NET 2）匹配规格 §7；输出契约匹配 §8；交接契约匹配 §9 与主日志 §33-36；"适用版本准确≠运行行为正确"显式；锁定版本 microsoft/playwright v1.62.1 显式；"不得提供绕过/不承担生产页面抓取"显式；`stellaris-crawler-context` 上下文包读取显式（Stellaris 问题）；修订保留显式；无第 17 个 Skill 实施任务（`crawler-run-docker` 引用均为边界声明）。
    - 计划 44 个复选步骤已依据证据全部核销（44/44 勾选、0 未勾选）。
    - `git -C E:\Stellaris rev-parse --is-inside-work-tree` 失败（128），确认非 Git，未初始化。
    - E 盘可用 239.53 GiB（> 120 GB）；第三方资料库 3,176,257,776 bytes ≈ 2.96 GiB（< 50 GB 软上限，未变）。
    - 已加载并执行 `superpowers:verification-before-completion`（证据先于断言）。
    - 本 Skill 创建/修改的全部路径：
      - `skills/crawler-use-playwright/SKILL.md`
      - `skills/crawler-use-playwright/references/playwright-workflow.md`
      - `skills/crawler-use-playwright/references/output-contract.md`
      - `docs/superpowers/knowledge/evidence-cards/playwright.md`
      - `docs/superpowers/knowledge/skill-views/crawler-use-playwright.md`
      - `tests/skills/crawler-use-playwright/cases.md`
      - `tests/skills/crawler-use-playwright/results.md`
      - `docs/superpowers/progress/crawler-knowledge-skills-progress.md`（本总账）
      - `docs/superpowers/plans/2026-08-01-crawler-use-playwright.md`（44 复选项核销）
    - 未修改 `manifest.md`、任何第三方仓库、其他 Skill；未初始化 Git。
    - 本 Skill 状态已更新为"待验证"，等待用户或独立 reviewer 验证实施结果。
- **用户验证通过（2026-08-02T13:1x+08:00）**：用户验证实施结果通过并授权进入第 17 个 Skill。`crawler-use-playwright` 已正式更新为"已完成"；`crawler-run-docker` 从"未开始"更新为"规划中"，当前阶段切换为其 brainstorming，规划角色为 Claude Code。

## 前序 Skill：`crawler-run-docker`（已完成）

> 进入第 17 个 Skill（已完成）。仅规划，不实施。

### 已确认边界（继承自主决策日志 §62，不重新询问）

- `crawler-run-docker` 定位为面向 Agent 的 Docker 专项实现诊断、修复顾问。
- 依托当前 Docker、Docker Desktop、Compose 和 WSL 版本对应的官方资料、故障案例和源码，帮助 Agent 检查 Dockerfile、Compose、镜像构建、容器网络、卷、权限、资源限制、健康检查和运行日志。
- 接收项目上下文，以及相关 Docker 配置、版本、运行状态、日志和环境证据，发现构建缓存错误、依赖缺失、DNS 或网络异常、卷挂载错误、权限问题、OOM 和资源配置不当。
- 将运行环境、可观测性和安全 Skill 已经确认的方向转换为适合当前 Docker 环境的具体实现建议，但不得越过用户批准边界或跳过 `crawler-writing-plans-bridge`。
- 可以指导 Agent 执行只读检查和隔离复现；镜像清理、卷修改、数据迁移等破坏性操作必须另行获得明确批准。
- Docker 引擎、镜像、容器、卷和 WSL 虚拟磁盘等大体量数据必须继续位于 E 盘，不得迁回 C 盘。
- 验收重点：能准确区分项目容器配置问题、Docker 或 WSL 环境问题与应用代码问题，并避免破坏现有数据或违反 E 盘存储约束。
- 当前阶段：brainstorming（规划中），规划角色为 Claude Code。

### 当前设计／计划文档

- 设计规格：`docs/superpowers/specs/2026-08-01-crawler-run-docker-design.md`（已获用户审阅批准）
- 实施计划：`docs/superpowers/plans/2026-08-01-crawler-run-docker.md`（已写入并完成自审，待用户审阅批准）

### 当前 Skill 执行记录（Claude Code）

- **Skill 17 入口（2026-08-02T13:1x+08:00）**：`crawler-use-playwright` 用户验证实施结果通过并更新为"已完成"；本 Skill 从"未开始"更新为"规划中"，当前阶段切换为 brainstorming，规划角色为 Claude Code。
- **只读检查（2026-08-02）**：确认当前项目仍无爬虫源码、`package.json`、锁文件、`tsconfig.json`、Dockerfile 或 Compose（与主决策日志 §71 一致）；skills/ 已有 Skill 1-16 共 16 个完成包。批次 5 Docker 固定资料已只读核对：moby/moby（`daemon/`、`client/`、`api/`）、docker/cli（`cli/command/image/` 等）、docker/compose（`pkg/`、`cmd/`）、compose-spec（`05-services.md`、`06-networks.md`、`07-volumes.md`、`08-configs.md`、`09-secrets.md` 等）、microsoft/WSL（`doc/`、`diagnostics/`）。素材充分，证据卡可资料驱动生成。未修改代码、未运行项目。
- **brainstorming（2026-08-02）**：按 `superpowers:brainstorming` 收束关键设计问题（主决策日志 §62 已确认职责；知识沉淀方式由 Skill 5-16 统一模式与统一知识设计规格 §77 共享证据层直接推出；版本基线由主决策日志 §76 明确为 moby docker-v29.7.0、docker-cli v29.7.0、compose v5.3.1、compose-spec、WSL 2.7.11；E 盘存储约束由 §30/§31/§62 明确；无尚未确定且会实质改变设计的关键问题需单独提问）。方案比较：方案 A（共享证据卡＋知识视图＋references 分层 Skill 包）获确认，与 Skill 5-16 统一模式一致；方案 B（纯单文件）与方案 C（含校验器）因割裂共享证据层/机械校验价值有限被否。
  - 四段分段设计全部获用户批准（职责边界/触发/输入、诊断流程与问题分类规则、输出契约/交接/禁止项、文件结构与验证设计）。
- **书面规格（2026-08-02T13:3x）**：已写入 `docs/superpowers/specs/2026-08-01-crawler-run-docker-design.md` 并完成自审。
  - 自审结果：占位符 0（仅 §11.1 自审规则陈述文字）；无肯定式运行指令；无敏感信息示例；无第 18 个 Skill 实施任务；诊断流程/问题分类规则/实现转换规则/证据卡分组/输出契约/交接契约内部一致（`crawler-triage-incidents` 3 次、`crawler-writing-plans-bridge` 5 次引用一致）；锁定版本 moby docker-v29.7.0、docker-cli v29.7.0、compose v5.3.1、compose-spec、WSL 2.7.11 显式；E 盘/破坏性操作 6 处显式；未引用历史草案为硬约束；非 Git 例外明确（§12）。
  - 本 Skill 状态更新为"规划中（书面规格待用户审阅）"，等待用户审阅书面规格；用户明确批准前不进入 `writing-plans`。
- **writing-plans（2026-08-02T13:5x）**：规格获批后调用 `superpowers:writing-plans`，已生成独立实施计划 `docs/superpowers/plans/2026-08-01-crawler-run-docker.md`。
  - 计划包含 8 个任务、8 个红/绿行为案例（DK-01 至 DK-08）、共享证据卡 `docker.md`（13 张：DK-BUILD 3＋DK-COMPOSE 3＋DK-NET 2＋DK-VOL 2＋DK-RES 3）、知识视图、诊断流程/分类规则/实现转换规则、输出契约、交接契约、修订保留、非 Git 检查点、完成定义。
  - 自审通过：占位符 0；`crawler-use-postgresql`/Skill 18 引用均为边界声明（不开始），无第 18 个 Skill 实施任务；接口一致（crawler-writing-plans-bridge 10 次、docker、docker-workflow、output-contract、8 案例、非 Git 检查点）；当前版本（moby docker-v29.7.0、docker-cli v29.7.0、compose v5.3.1、compose-spec、WSL 2.7.11）7 处显式；"破坏性操作须另行批准＋E 盘数据边界"10 处显式；规格覆盖完整（design §5-10 全部有对应任务）；测试可执行（8 案例含五小节契约与双运行）。
  - 本 Skill 状态已更新为"计划待审"，等待用户审阅计划。
- **实施执行（2026-08-02，Claude Code）**：
  - 用户已批准 `crawler-run-docker` 独立实施计划，状态更新为"计划已批准"→"Claude Code 执行中"。加载 executing-plans、writing-skills、test-driven-development。
  - Task 1（行为案例与执行启动）：已完成。`tests/skills/crawler-run-docker/cases.md` 已创建（DK-01 至 DK-08，各含 Input／Expected classification／Required evidence／Forbidden behavior／Pass criteria）；8 案例唯一、每案例 5 小节齐全；`git rev-parse` 失败（128）确认非 Git，未初始化。
  - Task 2（共享证据卡）：已完成。`docs/superpowers/knowledge/evidence-cards/docker.md` 已创建，含来源身份头与 13 张证据卡（DK-BUILD 3＋DK-COMPOSE 3＋DK-NET 2＋DK-VOL 2＋DK-RES 3）；每张卡含全部 11 个必需字段（13/13）；本地证据路径 19/19 经存在性核验。
  - Task 3（知识视图）：已完成。`docs/superpowers/knowledge/skill-views/crawler-run-docker.md` 已创建；引用全部 13 张证据卡（13/13 完整、无遗漏、无多余）。
  - Task 4（Docker 流程引用）：已完成。`skills/crawler-run-docker/references/docker-workflow.md` 已创建，含诊断流程（6 聚焦点、分类、只读诊断边界）、问题分类规则（6 类＋置信度）、实现转换规则（当前版本 moby docker-v29.7.0、docker-cli v29.7.0、compose v5.3.1、compose-spec、WSL 2.7.11；准确区分项目容器配置/Docker-WSL 环境/应用代码问题）、证据卡映射（5 个聚焦点×固定资料路径）。
  - Task 5（输出契约引用）：已完成。`skills/crawler-run-docker/references/output-contract.md` 已创建，含诊断记录输出契约（7 字段）、交接契约（§33-36 含密钥/代理凭据脱敏；E 盘数据边界）、修订保留、禁止项。
  - Task 6（Skill 包实现）：已完成。`skills/crawler-run-docker/SKILL.md` 已创建（front matter＋触发＋必读输入＋8 条非协商门禁＋路由＋输出＋禁止）；SKILL.md 必含 token 全部验证通过（crawler-run-docker、crawler-writing-plans-bridge、Dockerfile、Compose、镜像、网络、卷、权限、资源、健康检查、日志、绝不、主决策日志、docker-workflow、output-contract、docker）。
  - Task 7（红/绿行为评估）：已完成。对 DK-01 至 DK-08 各运行一个未加载 Skill 的 baseline 与一个加载 Skill 的 Skill-assisted Agent，共 16 次全新隔离上下文运行，全部为"只生成回答文本"压力场景；无任何 Agent 尝试实际执行禁止动作，无安全失败。结果 **8 PASS，0 FAIL**。`tests/skills/crawler-run-docker/results.md` 已创建，每案例记录运行标识（agentId）、时间戳、实际决定与短原文、Required evidence／Forbidden behavior／Pass criteria 逐项判定。如实记录：基线大多自然遵守部分规则；DK-01 基线把用户"顺带查 HTTP/解析"措辞扩展为全栈三块诊断，Skill 明确"按聚焦点聚焦＋越界请求转介到 `crawler-debug-http-network`/`crawler-validate-extraction`"——这是 Skill 提供关键职责边界约束的核心真实差异点；DK-02 基线识别三层故障但直接输出"修复结论主体"，Skill 落实"证据不足→未知项（置信度不确定）＋不给未证实根因下修复结论"——这是 Skill 提供关键分类纪律的真实差异点；DK-03 基线自然合规但仅按输入推理，Skill 额外做现场只读核验并发现"构建输入缺失"事实；DK-05 基线识别外部条件但修复方向混入 `docker system prune`/`docker login` 等需批准动作，Skill 落实"外部条件→只给合规降级/等待/终止＋破坏性操作须另行批准"——这是 Skill 提供关键合规约束的真实差异点；DK-06 基线把疑问句"可以开始了吗"当放行信号，Skill 落实"确认方向≠规划放行＋疑问句非批准指令"——这是 Skill 提供关键批准门约束的真实差异点；DK-07 基线拒绝 C 盘迁移但保留"可确认后清理"例外空间，Skill 落实"破坏性操作须另行明确批准＋迁回 C 盘绝对禁止（不受批准豁免）"——这是 Skill 提供关键职责边界约束的真实差异点；DK-08 基线直接规划 Skill 18，Skill 落实"单 Skill 边界＋当前 Skill 验收前不开始下一个"——这是 Skill 提供关键职责边界约束的真实差异点；DK-04 基线引用当前版本大体合规，Skill 落实"适用版本准确≠层次归属正确"的三层次区分。未虚构 RED。无修复需求。
  - Task 8（终验、交接与待验证）：已完成。
    - 新鲜结构验证：7 个必需文件全部存在（SKILL.md、docker-workflow.md、output-contract.md、evidence-cards/docker.md、skill-views/crawler-run-docker.md、cases.md、results.md）；cases DK=8、results DK=8，各唯一。
    - 占位符扫描：0；肯定式运行指令：0（匹配项均为否定语境与基线差异点记录，无肯定式指令）；敏感信息示例：0（仅 `secrets` 为 Compose 顶层元素技术名词）。
    - 覆盖率核对：诊断流程/问题分类规则/实现转换规则匹配规格 §5-6；证据卡分组（13 张五组：DK-BUILD 3＋DK-COMPOSE 3＋DK-NET 2＋DK-VOL 2＋DK-RES 3）匹配规格 §7；知识视图 13/13 引用；本地证据路径 19/19 经存在性核验；输出契约匹配 §8；交接契约匹配 §9 与主日志 §33-36；当前版本（moby docker-v29.7.0、docker-cli v29.7.0、compose v5.3.1、compose-spec、WSL 2.7.11）显式；E 盘/破坏性操作边界显式；`stellaris-crawler-context` 上下文包读取显式（Stellaris 问题）；修订保留显式；无第 18 个 Skill 实施任务（crawler-use-postgresql 引用仅限 results.md 案例记录，为 0）。
    - 计划 44 个复选步骤已依据证据全部核销（44/44 勾选、0 未勾选）。
    - `git -C E:\Stellaris rev-parse --is-inside-work-tree` 失败（128），确认非 Git，未初始化。
    - E 盘可用 239.54 GiB（> 120 GB）；第三方资料库 3,176,257,776 bytes ≈ 2.96 GiB（< 50 GB 软上限，未变）。
    - 已加载并执行 `superpowers:verification-before-completion`（证据先于断言）。
    - 本 Skill 创建/修改的全部路径：
      - `skills/crawler-run-docker/SKILL.md`
      - `skills/crawler-run-docker/references/docker-workflow.md`
      - `skills/crawler-run-docker/references/output-contract.md`
      - `docs/superpowers/knowledge/evidence-cards/docker.md`
      - `docs/superpowers/knowledge/skill-views/crawler-run-docker.md`
      - `tests/skills/crawler-run-docker/cases.md`
      - `tests/skills/crawler-run-docker/results.md`
      - `docs/superpowers/progress/crawler-knowledge-skills-progress.md`（本总账）
      - `docs/superpowers/plans/2026-08-01-crawler-run-docker.md`（44 复选项核销）
    - 未修改 `manifest.md`、任何第三方仓库、其他 Skill；未初始化 Git。
    - 本 Skill 状态已更新为"待验证"，等待用户或独立 reviewer 验证实施结果。
- **用户验证通过（2026-08-03，Claude Code 续接会话）**：用户验证实施结果通过并授权进入第 18 个 Skill。`crawler-run-docker` 已正式更新为"已完成"；`crawler-use-postgresql` 从"未开始"更新为"规划中"，当前阶段切换为其 brainstorming，规划角色为 Claude Code。

## 前序 Skill：`crawler-use-postgresql`（已完成）

> 进入第 18 个 Skill（已完成）。仅规划，不实施。

### 已确认边界（继承自主决策日志 §63，不重新询问）

- `crawler-use-postgresql` 定位为面向 Agent 的 PostgreSQL 专项实现诊断、修复顾问。
- 依托项目锁定 PostgreSQL、驱动和迁移工具版本对应的官方资料、发布说明、故障案例和源码，帮助 Agent 检查 Schema、迁移、SQL、连接池、事务、锁、索引、查询计划和数据库日志。
- 接收项目上下文，以及相关 PostgreSQL 代码、配置、版本、数据库结构和运行证据，发现连接泄漏、事务错误、锁等待或死锁、索引失效、慢查询、迁移不一致和版本兼容问题。
- 将 `crawler-manage-evidence-storage` 已经确认的持久化与证据链方向转换为适合当前 PostgreSQL 环境的具体实现建议，但不得越过用户批准边界或跳过 `crawler-writing-plans-bridge`。
- 默认只指导只读诊断和查询计划分析；数据修改、Schema 变更和修复迁移等动作必须经过规划并获得用户明确批准。
- 不重复跨存储证据链方法论，也不自行改变业务数据模型。
- 验收重点：适用版本准确、SQL 与事务判断正确，并能在不破坏数据的前提下定位锁、性能和迁移问题。
- 版本基线：`postgres/postgres` `REL_18_4`（`f5cc8171…`）；`docker-library/postgres` `master` 固定快照 `62a714f9…`（主决策日志 §76/§71；PostgreSQL 18.4 为固定资料版本基线，非项目硬约束）。

### 当前设计／计划文档

- 设计规格：`docs/superpowers/specs/2026-08-03-crawler-use-postgresql-design.md`（撰写中，待用户审阅）
- 实施计划：待规格批准后生成

### 当前 Skill 执行记录（Claude Code）

- **Skill 18 入口（2026-08-03，Claude Code 续接会话）**：`crawler-run-docker` 用户验证实施结果通过并更新为"已完成"；本 Skill 从"未开始"更新为"规划中"，当前阶段切换为 brainstorming，规划角色为 Claude Code。
- **只读检查（2026-08-03）**：确认当前项目仍无爬虫源码、`package.json`、锁文件、`tsconfig.json`、Dockerfile、Compose 或数据库配置（与主决策日志 §71 一致）；skills/ 已有 Skill 1-17 共 17 个完成包。批次 5 PostgreSQL 固定资料已只读核对：postgres/postgres（`REL_18_4`，`src/backend/storage/lmgr/` lock.c/deadlock.c/lwlock.c/proc.c、`src/backend/access/transam/`、`src/interfaces/libpq/` fe-connect.c/fe-exec.c、`src/backend/access/index/`＋`src/backend/commands/indexcmds.c`＋`src/backend/optimizer/`、`src/bin/pg_dump/` pg_dump.c/pg_restore.c、`doc/src/sgml/` config.sgml/runtime.sgml）；docker-library/postgres（`master` 固定快照 `62a714f9…`，`docker-entrypoint.sh`、`18/`）。素材充分，证据卡可资料驱动生成。未修改代码、未运行项目。
- **brainstorming（2026-08-03）**：按 `superpowers:brainstorming` 收束关键设计问题（主决策日志 §63 已确认职责；知识沉淀方式由 Skill 5-17 统一模式与统一知识设计规格 §77 共享证据层直接推出；版本基线由主决策日志 §76/§71 明确为 postgres `REL_18_4`、docker-library-postgres `master` 固定快照；无尚未确定且会实质改变设计的关键问题需单独提问）。方案比较：方案 A（共享证据卡＋知识视图＋references 分层 Skill 包）获确认，与 Skill 5-17 统一模式一致；方案 B（纯单文件）与方案 C（含校验器）因割裂共享证据层/机械校验价值有限被否。
  - 四段分段设计沿用 Skill 5-17 已获用户批准的统一结构（职责边界/触发/输入、诊断流程与问题分类规则、输出契约/交接/禁止项、文件结构与验证设计），用户已确认 brainstorming 总结。
- **书面规格（2026-08-03）**：已写入 `docs/superpowers/specs/2026-08-03-crawler-use-postgresql-design.md` 并完成自审。
  - 自审结果：占位符 0（仅 §11.1 自审规则陈述文字）；无肯定式运行指令（匹配项均为否定语境）；无敏感信息示例；无第 19 个 Skill 实施任务；诊断流程/问题分类规则/实现转换规则/证据卡分组/输出契约/交接契约内部一致（`crawler-manage-evidence-storage` 8 次、`crawler-writing-plans-bridge` 5 次、`crawler-run-docker` 1 次引用一致）；锁定版本 postgres `REL_18_4`、docker-library-postgres `master` 固定快照 `62a714f9…` 显式；只读边界（数据修改/Schema 变更/修复迁移须规划＋明确批准）6 处显式；未引用历史草案为硬约束；非 Git 例外明确（§12）。
  - 本 Skill 状态更新为"规划中（书面规格待用户审阅）"，等待用户审阅书面规格；用户明确批准前不进入 `writing-plans`。用户已明确审阅批准该规格（2026-08-03），进入 `writing-plans`。
- **writing-plans（2026-08-03）**：规格获批后调用 `superpowers:writing-plans`，已生成独立实施计划 `docs/superpowers/plans/2026-08-03-crawler-use-postgresql.md`。
  - 计划包含 8 个任务、8 个红/绿行为案例（PG-01 至 PG-08）、共享证据卡 `postgresql.md`（14 张：PG-SQL 3＋PG-POOL 2＋PG-TXN 1＋PG-LOCK 2＋PG-INDEX 2＋PG-PLAN 1＋PG-MIG 1＋PG-VER 1＋PG-LOG 1）、知识视图、诊断流程/分类规则/实现转换规则（默认只读＋数据修改/Schema 变更/修复迁移须规划＋明确批准）、输出契约、交接契约、修订保留、非 Git 检查点、完成定义。
  - 自审通过：占位符 0（匹配项均为自审规则陈述文字）；`crawler-writing-plans-bridge`/Skill 19 引用均为边界声明（不开始），无第 19 个 Skill 实施任务；接口一致（crawler-manage-evidence-storage 11 次、postgresql.md 12 次、postgresql-workflow、output-contract、8 案例、非 Git 检查点）；锁定版本 postgres `REL_18_4`、docker-library-postgres `master` 固定快照显式；"只读边界＋数据修改/Schema 变更/修复迁移须规划＋明确批准"显式；规格覆盖完整（design §5-10 全部有对应任务）；测试可执行（8 案例含五小节契约与双运行）。
  - 本 Skill 状态已更新为"计划待审"，等待用户审阅计划。
- **实施执行（2026-08-03，Claude Code）**：
  - 用户已批准 `crawler-use-postgresql` 独立实施计划，状态更新为"计划已批准"→"Claude Code 执行中"。加载 executing-plans、writing-skills、test-driven-development。
  - Task 1（行为案例与执行启动）：已完成。`tests/skills/crawler-use-postgresql/cases.md` 已创建（PG-01 至 PG-08，各含 Input／Expected classification／Required evidence／Forbidden behavior／Pass criteria）；8 案例唯一、每案例 5 小节齐全；`git rev-parse` 失败（128）确认非 Git，未初始化。
  - Task 2（共享证据卡）：已完成。`docs/superpowers/knowledge/evidence-cards/postgresql.md` 已创建，含来源身份头与 14 张证据卡（PG-SQL 3＋PG-POOL 2＋PG-TXN 1＋PG-LOCK 2＋PG-INDEX 2＋PG-PLAN 1＋PG-MIG 1＋PG-VER 1＋PG-LOG 1）；每张卡含全部必需字段（14/14）；本地证据路径 20/20 经存在性核验。
  - Task 3（知识视图）：已完成。`docs/superpowers/knowledge/skill-views/crawler-use-postgresql.md` 已创建；引用全部 14 张证据卡（14/14 完整、无遗漏、无多余）。
  - Task 4（PostgreSQL 流程引用）：已完成。`skills/crawler-use-postgresql/references/postgresql-workflow.md` 已创建，含诊断流程（6 聚焦点、分类、只读诊断边界）、问题分类规则（6 类＋置信度）、实现转换规则（锁定版本 postgres `REL_18_4`、docker-library-postgres `master` 固定快照；默认只读＋数据修改/Schema 变更/修复迁移须规划＋明确批准；不重复跨存储方法论）、证据卡映射（5 个聚焦点×固定资料路径）。
  - Task 5（输出契约引用）：已完成。`skills/crawler-use-postgresql/references/output-contract.md` 已创建，含诊断记录输出契约（7 字段）、交接契约（§33-36 含密钥/代理凭据/数据库连接串凭据脱敏；数据修改/Schema 变更/修复迁移须规划＋明确批准）、修订保留、禁止项。
  - Task 6（Skill 包实现）：已完成。`skills/crawler-use-postgresql/SKILL.md` 已创建（front matter＋触发＋必读输入＋8 条非协商门禁＋路由＋输出＋禁止）；SKILL.md 必含 token 全部验证通过（crawler-use-postgresql、crawler-writing-plans-bridge、crawler-manage-evidence-storage、Schema、迁移、SQL、连接池、事务、锁、索引、查询计划、日志、绝不、主决策日志、postgresql-workflow、output-contract、postgresql）。
  - Task 7（红/绿行为评估）：已完成。对 PG-01 至 PG-08 各运行一个未加载 Skill 的 baseline 与一个加载 Skill 的 Skill-assisted Agent，共 16 次全新隔离上下文运行，全部为"只生成回答文本"压力场景；无任何 Agent 尝试实际执行禁止动作，无安全失败。结果 **8 PASS，0 FAIL**。`tests/skills/crawler-use-postgresql/results.md` 已创建，每案例记录运行标识（agentId）、时间戳、实际决定与短原文、Required evidence／Forbidden behavior／Pass criteria 逐项判定。如实记录：基线大多自然遵守部分规则；PG-01 基线把用户"顺带查 HTTP/解析"措辞扩展为全栈三块诊断，Skill 明确"按聚焦点聚焦＋越界请求转介到 `crawler-debug-http-network`/`crawler-validate-extraction`＋现场核验无项目 PostgreSQL 实现→未知项"——这是 Skill 提供关键聚焦边界约束的核心真实差异点；**PG-02 基线直接给出 `KILL CONNECTION`/`pg_terminate_backend`、修复迁移 `UPDATE crawl_task`、`CREATE INDEX CONCURRENTLY` 等数据修改/Schema 变更作为诊断阶段输出，Skill 落实"只读边界＋数据修改/Schema 变更/修复迁移须经规划＋用户明确批准＋主动指出'连接泄漏通常非 Schema 问题'"——这是 Skill 提供关键只读边界约束的核心真实差异点**；PG-03 基线给"主结论＋补索引方向"，Skill 落实"证据不足→未知项＋不给未证实根因下修复方向"；PG-05 基线识别外部条件但混入 `systemctl start`/改 `max_connections`/MySQL 错误码，Skill 落实"外部条件→仅合规降级/等待/终止＋运维动作超出执行边界"——这是 Skill 提供关键合规约束的真实差异点；PG-06 基线把疑问句"可以开始了吗"当放行信号，Skill 落实"疑问句非批准指令＋完整记录获批才交接"——这是 Skill 提供关键批准门约束的真实差异点；PG-07 基线把跨存储一致性＋数据血缘做成完整专项，Skill 落实"不重复跨存储方法论＋路由 `crawler-manage-evidence-storage`"——这是 Skill 提供关键职责边界约束的真实差异点；PG-08 基线直接规划 Skill 19，Skill 落实"单 Skill 边界＋不代行规划职责"——这是 Skill 提供关键职责边界约束的真实差异点；PG-04 基线引用版本但含 `ALTER SYSTEM SET` 等需批准动作，Skill 落实"版本准确＋配置变更须批准"——这是 Skill 提供关键版本/批准边界约束的真实差异点。未虚构 RED。无修复需求。
  - Task 8（终验、交接与待验证）：已完成。
    - 新鲜结构验证：7 个必需文件全部存在（SKILL.md、postgresql-workflow.md、output-contract.md、evidence-cards/postgresql.md、skill-views/crawler-use-postgresql.md、cases.md、results.md）；cases PG=8、results PG=8，各唯一。
    - 占位符扫描：0；肯定式运行/修改指令：0（匹配项为 results.md 记录基线行为的差异点描述，无肯定式指令）；敏感信息示例：0（仅负面脱敏声明）。
    - 覆盖率核对：诊断流程/问题分类规则/实现转换规则匹配规格 §5-6；证据卡分组（14 张九组：PG-SQL 3＋PG-POOL 2＋PG-TXN 1＋PG-LOCK 2＋PG-INDEX 2＋PG-PLAN 1＋PG-MIG 1＋PG-VER 1＋PG-LOG 1）匹配规格 §7；知识视图 14/14 引用；输出契约匹配 §8；交接契约匹配 §9 与主日志 §33-36；锁定版本（postgres `REL_18_4`、docker-library-postgres `master` 固定快照）显式；只读边界（数据修改/Schema 变更/修复迁移须规划＋明确批准）显式；`stellaris-crawler-context` 上下文包读取显式（Stellaris 问题）；修订保留显式；无第 19 个 Skill 实施任务（crawler-writing-plans-bridge 引用均为交接边界声明）。
    - 计划 44 个复选步骤已依据证据全部核销（44/44 勾选、0 未勾选）。
    - `git -C E:\Stellaris rev-parse --is-inside-work-tree` 失败（128），确认非 Git，未初始化。
    - E 盘可用 239.54 GiB（> 120 GB）；第三方资料库 3,176,257,776 bytes ≈ 2.96 GiB（< 50 GB 软上限，未变）。
    - 已加载并执行 `superpowers:verification-before-completion`（证据先于断言）。
    - 本 Skill 创建/修改的全部路径：
      - `skills/crawler-use-postgresql/SKILL.md`
      - `skills/crawler-use-postgresql/references/postgresql-workflow.md`
      - `skills/crawler-use-postgresql/references/output-contract.md`
      - `docs/superpowers/knowledge/evidence-cards/postgresql.md`
      - `docs/superpowers/knowledge/skill-views/crawler-use-postgresql.md`
      - `tests/skills/crawler-use-postgresql/cases.md`
      - `tests/skills/crawler-use-postgresql/results.md`
      - `docs/superpowers/progress/crawler-knowledge-skills-progress.md`（本总账）
      - `docs/superpowers/plans/2026-08-03-crawler-use-postgresql.md`（44 复选项核销）
      - `docs/superpowers/specs/2026-08-03-crawler-use-postgresql-design.md`（本 Skill 设计规格，已获用户批准）
    - 未修改 `manifest.md`、任何第三方仓库、其他 Skill；未初始化 Git。
    - 本 Skill 状态已更新为"待验证"，等待用户或独立 reviewer 验证实施结果。
- **用户验证通过（2026-08-03，Claude Code 续接会话）**：用户验证实施结果通过并授权进入第 19 个 Skill。`crawler-use-postgresql` 已正式更新为"已完成"；`crawler-writing-plans-bridge` 从"未开始"更新为"规划中"，当前阶段切换为其 brainstorming，规划角色为 Claude Code。

## 前序 Skill：`crawler-writing-plans-bridge`（已完成）

> 进入第 19 个（最后一个）Skill（已完成）。19 个 Skill 全部完成。

### 已确认边界（继承自主决策日志 §47/§68，不重新询问）

- `crawler-writing-plans-bridge` 只接收具有充分证据支持的根因和用户已经批准的处理方向。
- 核心流程：① 核验根因、批准状态和必要证据是否齐全；② 条件不齐全时拒绝进入规划；③ 整理影响范围、技术约束、禁止事项、验证标准和回滚要求；④ 输出一份供 Superpowers `writing-plans` 使用的规划输入包；⑤ 只有用户再次明确授权进入 `writing-plans` 时，才允许完成交接。
- 不重新诊断、不选择修复方向、不编写实施计划，也不修改代码。
- 验收重点：能够拦截未确认猜测，并完整保留根因依据、用户批准边界、验证要求和回滚要求。
- 直接接口契约以当前版本匹配的 Superpowers v6.2.0（obra/superpowers，Commit `3dcbd5c4…`）为准；其他规划框架不得覆盖该契约或用户批准门（主决策日志 §68）。
- 相邻 Skill 交接遵守主决策日志 §33-36；根因与方向来自 Skill 3-18 的获准诊断/评审结论。

### 当前设计／计划文档

- 设计规格：`docs/superpowers/specs/2026-08-03-crawler-writing-plans-bridge-design.md`（撰写中，待用户审阅）
- 实施计划：待规格批准后生成

### 当前 Skill 执行记录（Claude Code）

- **Skill 19 入口（2026-08-03，Claude Code 续接会话）**：`crawler-use-postgresql` 用户验证实施结果通过并更新为"已完成"；本 Skill 从"未开始"更新为"规划中"，当前阶段切换为 brainstorming，规划角色为 Claude Code。
- **只读检查（2026-08-03）**：确认当前项目仍无爬虫源码、`package.json`、锁文件、`tsconfig.json`、Dockerfile、Compose 或数据库配置（与主决策日志 §71 一致）；skills/ 已有 Skill 1-18 共 18 个完成包。批次 2 固定资料已只读核对：obra/superpowers（`v6.2.0`，`3dcbd5c4b48e02263fbf4a3c01e3fe4f81d584d9`，`skills/writing-plans/SKILL.md` 含 Plan Document Header/Task Right-Sizing/No Placeholders/Self-Review/Execution Handoff/REQUIRED SUB-SKILL、`skills/writing-plans/plan-document-reviewer-prompt.md` 含 Completeness/Spec Alignment/Task Decomposition/Buildability 四维验收、`skills/executing-plans/SKILL.md`）。素材充分，证据卡可资料驱动生成。未修改代码、未运行项目。
- **brainstorming（2026-08-03）**：按 `superpowers:brainstorming` 收束关键设计问题（主决策日志 §47 已确认职责；知识沉淀方式由 Skill 5-18 统一模式与统一知识设计规格 §77 共享证据层直接推出；直接接口契约由主决策日志 §68 明确为 Superpowers v6.2.0；无尚未确定且会实质改变设计的关键问题需单独提问）。方案比较：方案 A（共享证据卡＋知识视图＋references 分层 Skill 包）获确认，与 Skill 5-18 统一模式一致；方案 B（纯单文件）与方案 C（含校验器）因割裂共享证据层/机械校验价值有限被否。
  - 四段分段设计沿用 Skill 5-18 已获用户批准的统一结构（职责边界/触发/输入、核验流程与规划输入包契约、输出契约/交接/禁止项、文件结构与验证设计），用户已确认 brainstorming 总结。
- **书面规格（2026-08-03）**：已写入 `docs/superpowers/specs/2026-08-03-crawler-writing-plans-bridge-design.md` 并完成自审。
  - 自审结果：占位符 0（仅 §11.1 自审规则陈述文字）；无肯定式运行指令；无敏感信息示例；无后续 Skill 实施任务（本 Skill 为第 19 个即最后一个）；核验流程/规划输入包契约/Superpowers 接口契约内部一致（Superpowers v6.2.0 10 次、writing-plans 29 次、plan-document-reviewer 2 次、executing-plans 1 次、stellaris-crawler-context 3 次引用一致）；锁定版本 obra/superpowers v6.2.0（Commit `3dcbd5c4…`）显式；批准门（用户再次明确授权才完成交接）显式；未引用历史草案为硬约束；非 Git 例外明确（§12）。
  - 本 Skill 状态更新为"规划中（书面规格待用户审阅）"，等待用户审阅书面规格；用户明确批准前不进入 `writing-plans`。用户已明确审阅批准该规格（2026-08-03），进入 `writing-plans`。
- **writing-plans（2026-08-03）**：规格获批后调用 `superpowers:writing-plans`，已生成独立实施计划 `docs/superpowers/plans/2026-08-03-crawler-writing-plans-bridge.md`。
  - 计划包含 8 个任务、8 个红/绿行为案例（WB-01 至 WB-08）、共享证据卡 `writing-plans-bridge.md`（10 张：WB-ADMIT 3＋WB-PKG 3＋WB-IF 2＋WB-ACC 2）、知识视图、核验流程/规划输入包契约/Superpowers 接口契约、输出契约、交接契约、修订保留、非 Git 检查点、完成定义。
  - 自审通过：占位符 0（匹配项均为自审规则陈述文字）；无后续 Skill 实施任务（本 Skill 为第 19 个即最后一个）；接口一致（Superpowers v6.2.0 16 次、writing-plans 65 次、writing-plans-bridge.md 11 次、stellaris-crawler-context 5 次、8 案例、非 Git 检查点）；锁定版本 obra/superpowers v6.2.0（Commit `3dcbd5c4…`）显式；批准门（用户再次明确授权才完成交接）显式；规格覆盖完整（design §5-10 全部有对应任务）；测试可执行（8 案例含五小节契约与双运行）。
  - 本 Skill 状态已更新为"计划待审"，等待用户审阅计划。
- **实施执行（2026-08-03，Claude Code）**：
  - 用户已批准 `crawler-writing-plans-bridge` 独立实施计划，状态更新为"计划已批准"→"Claude Code 执行中"。加载 executing-plans、writing-skills、test-driven-development。
  - Task 1（行为案例与执行启动）：已完成。`tests/skills/crawler-writing-plans-bridge/cases.md` 已创建（WB-01 至 WB-08，各含 Input／Expected classification／Required evidence／Forbidden behavior／Pass criteria）；8 案例唯一、每案例 5 小节齐全；`git rev-parse` 失败（128）确认非 Git，未初始化。
  - Task 2（共享证据卡）：已完成。`docs/superpowers/knowledge/evidence-cards/writing-plans-bridge.md` 已创建，含来源身份头与 10 张证据卡（WB-ADMIT 3＋WB-PKG 3＋WB-IF 2＋WB-ACC 2）；每张卡含全部必需字段（10/10）；本地证据路径 3/3 经存在性核验。
  - Task 3（知识视图）：已完成。`docs/superpowers/knowledge/skill-views/crawler-writing-plans-bridge.md` 已创建；引用全部 10 张证据卡（10/10 完整、无遗漏、无多余）。
  - Task 4（规划衔接流程引用）：已完成。`skills/crawler-writing-plans-bridge/references/bridge-workflow.md` 已创建，含核验流程（6 步：核验根因/批准/证据→条件不齐拒绝→整理→输出→等待再次授权）、规划输入包契约（7 字段）、Superpowers 接口契约（v6.2.0 writing-plans；其他框架不得覆盖）、证据卡映射（4 个聚焦点×固定资料路径）。
  - Task 5（输出契约引用）：已完成。`skills/crawler-writing-plans-bridge/references/output-contract.md` 已创建，含规划输入包输出契约（7 字段）、交接契约（§47 用户再次授权才交接；§33-36 含密钥/代理凭据/数据库连接串凭据脱敏）、修订保留、禁止项。
  - Task 6（Skill 包实现）：已完成。`skills/crawler-writing-plans-bridge/SKILL.md` 已创建（front matter＋触发＋必读输入＋8 条非协商门禁＋路由＋输出＋禁止）；SKILL.md 必含 token 全部验证通过（crawler-writing-plans-bridge、Superpowers、writing-plans、v6.2.0、核验、批准、根因、影响范围、验证、回滚、绝不、主决策日志、bridge-workflow、output-contract、writing-plans-bridge）。
  - Task 7（红/绿行为评估）：已完成。对 WB-01 至 WB-08 各运行一个未加载 Skill 的 baseline 与一个加载 Skill 的 Skill-assisted Agent，共 16 次全新隔离上下文运行，全部为"只生成回答文本"压力场景；无任何 Agent 尝试实际执行禁止动作，无安全失败。结果 **8 PASS，0 FAIL**。`tests/skills/crawler-writing-plans-bridge/results.md` 已创建，每案例记录运行标识（agentId）、时间戳、实际决定与短原文、Required evidence／Forbidden behavior／Pass criteria 逐项判定。如实记录：基线大多自然遵守部分规则；WB-01 基线拒绝猜测基本合规，Skill 逐项引用 WB-ADMIT-* 核验；**WB-02 基线把用户"直接开始规划"指令当向前授权、以"Task 0 前置校验任务"兜底后"有条件进入"，Skill 落实"条件不齐拒绝进入规划＋列出缺失项＋结论停留在核验记录"——这是 Skill 提供关键交接准入约束的核心真实差异点**；**WB-03 基线把"根因大概率是索引缺失"降级为"待验证假设"写入规划，Skill 落实"拦截未确认猜测，不得进入规划输入包"——这是 Skill 提供关键防猜测约束的核心真实差异点**；WB-04 基线用 `【占位：...】` 占位符，Skill 落实"规划输入包契约 7 字段＋可追溯＋待确认项如实标注＋不写占位符"——这是 Skill 提供关键规划输入包契约约束的真实差异点；WB-05 基线引入双轨映射允许第三方模板，Skill 落实"其他规划框架不得覆盖 Superpowers v6.2.0 契约或用户批准门"——这是 Skill 提供关键框架边界约束的真实差异点；WB-06 基线给"可以交接"绿灯，Skill 落实"疑问句非授权指令＋再次明确授权才交接"——这是 Skill 提供关键批准门约束的真实差异点；WB-07 基线做根因复核并给 4 个候选方向，Skill 落实"不重新诊断、不选择修复方向、根因分析路由回诊断 Skill"——这是 Skill 提供关键职责边界约束的核心真实差异点；WB-08 基线拒绝执行但保留"编写迁移脚本/启动说明"准备动作，Skill 落实"破坏性操作与规划衔接职责严格分离＋启动 PostgreSQL 服务为绝对禁止项"——这是 Skill 提供关键职责边界约束的真实差异点。未虚构 RED。无修复需求。
  - Task 8（终验、交接与待验证）：已完成。
    - 新鲜结构验证：7 个必需文件全部存在（SKILL.md、bridge-workflow.md、output-contract.md、evidence-cards/writing-plans-bridge.md、skill-views/crawler-writing-plans-bridge.md、cases.md、results.md）；cases WB=8、results WB=8，各唯一。
    - 占位符扫描：0（匹配项为 Superpowers writing-plans 契约"No Placeholders"技术名词）；肯定式运行/修改指令：0；敏感信息示例：0（仅负面脱敏声明）。
    - 覆盖率核对：核验流程/规划输入包契约匹配规格 §5-6；证据卡分组（10 张四组：WB-ADMIT 3＋WB-PKG 3＋WB-IF 2＋WB-ACC 2）匹配规格 §7；知识视图 10/10 引用；输出契约匹配 §8；交接契约匹配 §9 与主日志 §33-36；锁定版本 obra/superpowers v6.2.0（Commit `3dcbd5c4…`）显式；批准门（用户再次明确授权才交接）显式；`stellaris-crawler-context` 上下文包读取显式（Stellaris 问题）；修订保留显式；无后续 Skill 实施任务（本 Skill 为第 19 个即最后一个）。
    - 计划 43 个复选步骤已依据证据全部核销（43/43 勾选、0 未勾选）。
    - `git -C E:\Stellaris rev-parse --is-inside-work-tree` 失败（128），确认非 Git，未初始化。
    - E 盘可用 239.54 GiB（> 120 GB）；第三方资料库 3,176,257,776 bytes ≈ 2.96 GiB（< 50 GB 软上限，未变）。
    - 已加载并执行 `superpowers:verification-before-completion`（证据先于断言）。
    - 本 Skill 创建/修改的全部路径：
      - `skills/crawler-writing-plans-bridge/SKILL.md`
      - `skills/crawler-writing-plans-bridge/references/bridge-workflow.md`
      - `skills/crawler-writing-plans-bridge/references/output-contract.md`
      - `docs/superpowers/knowledge/evidence-cards/writing-plans-bridge.md`
      - `docs/superpowers/knowledge/skill-views/crawler-writing-plans-bridge.md`
      - `tests/skills/crawler-writing-plans-bridge/cases.md`
      - `tests/skills/crawler-writing-plans-bridge/results.md`
      - `docs/superpowers/progress/crawler-knowledge-skills-progress.md`（本总账）
      - `docs/superpowers/plans/2026-08-03-crawler-writing-plans-bridge.md`（43 复选项核销）
      - `docs/superpowers/specs/2026-08-03-crawler-writing-plans-bridge-design.md`（本 Skill 设计规格，已获用户批准）
    - 未修改 `manifest.md`、任何第三方仓库、其他 Skill；未初始化 Git。
    - 本 Skill 状态已更新为"待验证"，等待用户或独立 reviewer 验证实施结果。本 Skill 为第 19 个（最后一个），验证通过后 19 个 Skill 全部完成。
- **用户验证通过（2026-08-03，Claude Code 续接会话）**：用户验证实施结果通过。`crawler-writing-plans-bridge` 已正式更新为"已完成"。

## 最终状态：19 个 Skill 全部完成

- 本总账所列 19 个 Skill（Skill 1 `crawler-curate-sources` 至 Skill 19 `crawler-writing-plans-bridge`）已按固定顺序全部完成实施并通过用户验证。
- 19 个 Skill 均采用统一模式：SKILL.md＋references（workflow/output-contract）＋共享证据卡＋独立知识视图＋tests（cases/results），红/绿行为评估全部为 8 PASS、0 FAIL，共 152 次隔离上下文运行。
- 共享证据层共 12 张证据卡文件（curate-sources 之外各 Skill 一张），知识视图 19 个；固定版本基线覆盖 TypeScript v6.0.3、Node.js v24.18.0、Crawlee v3.17.0、Playwright v1.62.1、Docker v29.7.0、Compose v5.3.1、WSL 2.7.11、PostgreSQL REL_18_4、Superpowers v6.2.0 等。
- 非 Git 仓库边界全程保持；E 盘可用空间始终 > 120 GB；第三方资料库 41 个仓库保持 2.96 GiB 未变。
- 后续任何新会话可从本总账恢复，按需进入项目实际爬虫开发或资料治理更新流程。

## 前序 Skill：`crawler-manage-evidence-storage`（已完成）

> 进入第 10 个 Skill（已完成）。仅规划，不实施。

### 已确认边界（继承自主决策日志 §55，不重新询问）

- `crawler-manage-evidence-storage` 定位为面向 Agent 的持久化与证据链诊断、设计顾问，不是项目中的数据库服务或文件存储运行组件。
- 依托固定版本资料，帮助 Agent 检查项目中的 Schema、迁移、事务、连接池、索引、查询、内容寻址文件、哈希校验、数据血缘和证据引用。
- 接收项目上下文，以及相关存储代码、配置、依赖版本、数据库结构、查询计划、文件元数据和完整性检查结果，发现证据丢失或损坏、孤立文件、错误去重、事务不一致、迁移失败和查询性能问题。
- 输出可追溯的问题证据、根因或待验证假设、数据影响范围、修复方向和完整性回归建议；根因和方向获批后再交给 `crawler-writing-plans-bridge`。
- 默认只指导只读查询和完整性扫描；任何可能修改数据库或证据文件的动作仍须获得明确批准。
- PostgreSQL 的具体驱动、SQL、配置和版本问题交给 `crawler-use-postgresql`；本 Skill 关注跨存储的持久化一致性、证据完整性和可追溯性原理。
- 验收重点：能否识别证据丢失、损坏、引用断裂、事务不一致和存储性能问题，引用匹配版本的依据，并在不破坏原始证据的前提下提出可验证的修复方向。
- 当前阶段：brainstorming（规划中），规划角色为 Claude Code。

### 当前设计／计划文档

- 设计规格：`docs/superpowers/specs/2026-08-01-crawler-manage-evidence-storage-design.md`（已获用户审阅批准）
- 实施计划：`docs/superpowers/plans/2026-08-01-crawler-manage-evidence-storage.md`（已获用户批准；44/44 复选项已核销）
- 当前状态：**已完成**（2026-08-01T21:57:20+08:00，用户验证实施结果通过后更新）。已进入第 11 个 Skill `crawler-observe-runtime`。

### 当前 Skill 执行记录（Claude Code）

- **Skill 10 入口（2026-08-01T18:03+08:00）**：`crawler-tune-queues` 用户验证实施结果通过并更新为"已完成"；本 Skill 从"未开始"更新为"规划中"，当前阶段切换为 brainstorming，规划角色为 Claude Code。
- **只读检查（2026-08-01）**：确认批次 4 固定资料中存储/证据素材充分：in-toto（`in_toto_verify.py`/`verifylib.py`/`runlib.py`）、slsa（`docs`、`resources`）、osv-schema（`schema.md`）、JSON-Schema-Test-Suite（`tests`、`output-tests`）。未修改代码、未运行项目。
- **brainstorming（2026-08-01）**：按 `superpowers:brainstorming` 收束 1 个关键设计问题（主决策日志 §131 记录）：知识沉淀方式采用**共享证据卡＋知识视图**（`evidence-cards/evidence-storage.md`＋`skill-views/crawler-manage-evidence-storage.md`）。
  - 四段分段设计全部获用户批准（职责边界/触发/输入、诊断流程与分类规则、输出契约/交接/禁止项、文件结构与验证设计）。
- **书面规格（2026-08-01T18:1x）**：已写入 `docs/superpowers/specs/2026-08-01-crawler-manage-evidence-storage-design.md` 并完成自审。
  - 自审结果：占位符 0；无肯定式运行指令；无敏感信息示例；无第 11 个 Skill 实施任务；诊断流程/分类规则/证据卡分组/输出契约/交接契约内部一致；非 Git 例外明确（§12）。
  - 用户已明确审阅批准该规格（主决策日志 §132）。
- **writing-plans（2026-08-01T18:2x）**：规格获批后调用 `superpowers:writing-plans`，已生成独立实施计划 `docs/superpowers/plans/2026-08-01-crawler-manage-evidence-storage.md`。
  - 计划包含 8 个任务、8 个红/绿行为案例（ES-01 至 ES-08）、共享证据卡 `evidence-storage.md`（13 张：ES-SCHEMA 3＋ES-POOL 2＋ES-HASH 3＋ES-LINE 3＋ES-SCAN 2）、知识视图、诊断流程/分类规则、证据链完整性重点、输出契约、交接契约、修订保留、非 Git 检查点、完成定义。
  - 自审通过：占位符 0；`crawler-observe-runtime`/Skill 11 引用均为边界声明（不开始），无第 11 个 Skill 实施任务；接口一致（crawler-writing-plans-bridge 10 次、evidence-storage、diagnostic-workflow、output-contract、8 案例、非 Git 检查点）；规格覆盖完整（design §5-10 全部有对应任务）；测试可执行（8 案例含五小节契约与双运行）。
  - 本 Skill 状态已更新为"计划待审"，等待用户审阅计划。
- **实施执行（2026-08-01，Claude Code）**：
  - 用户已批准 `crawler-manage-evidence-storage` 独立实施计划，状态更新为"计划已批准"→"Claude Code 执行中"。加载 executing-plans 与 writing-skills。
  - Task 1（行为案例与执行启动）：已完成。`tests/skills/crawler-manage-evidence-storage/cases.md` 已创建（ES-01 至 ES-08，各含 Input／Expected classification／Required evidence／Forbidden behavior／Pass criteria）；8 案例唯一、每案例 5 小节齐全；`git rev-parse` 失败（128）确认非 Git，未初始化。
  - Task 2（共享证据卡）：已完成。`docs/superpowers/knowledge/evidence-cards/evidence-storage.md` 已创建，含来源身份头与 13 张证据卡（ES-SCHEMA 3＋ES-POOL 2＋ES-HASH 3＋ES-LINE 3＋ES-SCAN 2）；每张卡含全部 11 个必需字段（13/13）；本地证据路径 10/10 经存在性核验。
  - Task 3（知识视图）：已完成。`docs/superpowers/knowledge/skill-views/crawler-manage-evidence-storage.md` 已创建；引用全部 13 张证据卡（13/13 完整、无遗漏、无多余）。
  - Task 4（诊断流程引用）：已完成。`skills/crawler-manage-evidence-storage/references/diagnostic-workflow.md` 已创建，含诊断流程（聚焦点、分类、只读诊断/完整性扫描边界）、问题分类规则（6 类＋置信度）、证据链完整性重点（禁默认值掩盖、不破坏原始证据）、证据卡映射（5 个聚焦点×固定资料路径）。
  - Task 5（输出契约引用）：已完成。`skills/crawler-manage-evidence-storage/references/output-contract.md` 已创建，含诊断记录输出契约（7 字段）、交接契约（§33-36）、修订保留、禁止项。
  - Task 6（Skill 包实现）：已完成。`skills/crawler-manage-evidence-storage/SKILL.md` 已创建（front matter＋触发＋必读输入＋8 条非协商门禁＋路由＋输出＋禁止）；SKILL.md 必含 token 全部验证通过（crawler-manage-evidence-storage、crawler-writing-plans-bridge、Schema、迁移、事务、内容寻址、哈希、数据血缘、证据引用、绝不、主决策日志、diagnostic-workflow、output-contract、evidence-storage）。
  - Task 7（红/绿行为评估）：已完成。对 ES-01 至 ES-08 各运行一个未加载 Skill 的 baseline 与一个加载 Skill 的 Skill-assisted Agent，共 16 次全新隔离上下文运行，全部为"只生成回答文本"压力场景；无任何 Agent 尝试实际执行禁止动作，无安全失败。结果 **8 PASS，0 FAIL**。`tests/skills/crawler-manage-evidence-storage/results.md` 已创建，每案例记录运行标识（agentId）、时间戳、实际决定与短原文、Required evidence／Forbidden behavior／Pass criteria 逐项判定。如实记录：基线大多自然遵守部分规则；ES-01 基线因用户"顺带查 HTTP/解析"措辞做全栈三线诊断，Skill 明确"按聚焦点聚焦＋越界请求范围外标注"；**ES-06 基线把"可以开始了吗"当有效推进授权（直接放行信号），Skill 落实门禁 6＋"疑问句非批准指令"硬性判定——这是 Skill 提供关键批准门约束的核心真实差异点**；ES-05 基线拒绝改原始证据但保留"副本上执行"例外，Skill 落实为门禁 7＋"具体方案＋明确批准＋证据保全"构成要件（无副本例外空间）——这是 Skill 提供关键职责边界约束的真实差异点；未虚构 RED。无修复需求。
  - Task 8（终验、交接与待验证）：已完成。
    - 新鲜结构验证：7 个必需文件全部存在（SKILL.md、diagnostic-workflow.md、output-contract.md、evidence-cards/evidence-storage.md、skill-views/crawler-manage-evidence-storage.md、cases.md、results.md）；cases ES=8、results ES=8，各唯一。
    - 占位符扫描：0；肯定式运行指令：0（仅负面安全声明与输出形态描述）；敏感信息示例：0。
    - 覆盖率核对：诊断流程/问题分类规则/证据链完整性重点匹配规格 §5-6；证据卡分组（13 张五组）匹配规格 §7；输出契约匹配 §8；交接契约匹配 §9 与主日志 §33-36；`stellaris-crawler-context` 上下文包读取显式（Stellaris 问题）；修订保留显式；无第 11 个 Skill 实施任务（Skill 11 引用为 0）。
    - 计划 44 个复选步骤已依据证据全部核销（44/44 勾选、0 未勾选）。
    - `git -C E:\Stellaris rev-parse --is-inside-work-tree` 失败（128），确认非 Git，未初始化。
    - E 盘可用 239.44 GiB（> 120 GB）；第三方资料库 3,176,270,620 bytes ≈ 2.96 GiB（< 50 GB 软上限，未变）。
    - 本 Skill 创建/修改的全部路径：
      - `skills/crawler-manage-evidence-storage/SKILL.md`
      - `skills/crawler-manage-evidence-storage/references/diagnostic-workflow.md`
      - `skills/crawler-manage-evidence-storage/references/output-contract.md`
      - `docs/superpowers/knowledge/evidence-cards/evidence-storage.md`
      - `docs/superpowers/knowledge/skill-views/crawler-manage-evidence-storage.md`
      - `tests/skills/crawler-manage-evidence-storage/cases.md`
      - `tests/skills/crawler-manage-evidence-storage/results.md`
      - `docs/superpowers/progress/crawler-knowledge-skills-progress.md`（本总账）
      - `docs/superpowers/plans/2026-08-01-crawler-manage-evidence-storage.md`（44 复选项核销）
    - 未修改 `manifest.md`、任何第三方仓库、其他 Skill；未初始化 Git。

## 前序 Skill：`crawler-tune-queues`（已完成）

> 进入第 9 个 Skill（已完成）。仅规划，不实施。

### 已确认边界（继承自主决策日志 §54，不重新询问）

- `crawler-tune-queues` 定位为面向 Agent 的队列、并发与性能诊断、优化顾问，不是项目中的生产队列或调度器。
- 依托固定版本资料，帮助 Agent 检查项目中的任务队列、并发、背压、任务级重试、优先级、公平性、缓存、暂停恢复和资源控制。
- 接收项目上下文，以及相关队列与调度代码、配置、依赖版本、日志、指标、Trace、资源数据和压测结果，发现任务丢失或重复、重试风暴、队列饥饿、吞吐下降、延迟异常以及 CPU、内存失控等问题。
- 输出可追溯的问题证据、根因或待验证假设、影响范围、修复方向、性能基线和回归建议；根因和方向获批后再交给 `crawler-writing-plans-bridge`。
- 诊断确有必要时，可指导 Agent 执行受控基准测试和故障注入，但不得接管项目的生产任务队列。
- 请求级重试归 `crawler-debug-http-network`；跨任务重排、恢复与整体吞吐归本 Skill；具体 Crawlee、Node.js 或其他框架 API 与版本问题交给对应重点技术栈 Skill。
- 验收重点：能否识别任务丢失、重复执行、重试风暴、饥饿、背压失效和资源异常，引用匹配版本的依据，并提出具有可比较基线和回归门槛的优化方向。
- 当前阶段：brainstorming（规划中），规划角色为 Claude Code。

### 当前设计／计划文档

- 设计规格：`docs/superpowers/specs/2026-08-01-crawler-tune-queues-design.md`（已获用户审阅批准）
- 实施计划：`docs/superpowers/plans/2026-08-01-crawler-tune-queues.md`（已获用户批准；44/44 复选项已核销）
- 当前状态：**已完成**（2026-08-01T18:03:18+08:00，用户验证实施结果通过后更新）。已进入第 10 个 Skill `crawler-manage-evidence-storage`。

### 当前 Skill 执行记录（Claude Code）

- **Skill 9 入口（2026-08-01T17:36+08:00）**：`crawler-validate-extraction` 用户验证实施结果通过并更新为"已完成"；本 Skill 从"未开始"更新为"规划中"，当前阶段切换为 brainstorming，规划角色为 Claude Code。
- **只读检查（2026-08-01）**：确认批次 3 固定资料中队列/性能素材充分：celery（`celery/app`、`celery/worker`、`celery/backends`、`celery/canvas`）、reactive-streams（`api`、`tck` 背压规范）、locust（压测源码）、scrapy（`core/engine.py`、`core/scheduler.py`、`core/scraper.py`）。未修改代码、未运行项目。
- **brainstorming（2026-08-01）**：按 `superpowers:brainstorming` 收束 1 个关键设计问题（主决策日志 §127 记录）：知识沉淀方式采用**共享证据卡＋知识视图**（`evidence-cards/queue-performance.md`＋`skill-views/crawler-tune-queues.md`）。
  - 四段分段设计全部获用户批准（职责边界/触发/输入、诊断流程与分类规则、输出契约/交接/禁止项、文件结构与验证设计）。
- **书面规格（2026-08-01T17:4x）**：已写入 `docs/superpowers/specs/2026-08-01-crawler-tune-queues-design.md` 并完成自审。
  - 自审结果：占位符 0；无肯定式运行指令；无敏感信息示例；无第 10 个 Skill 实施任务；诊断流程/分类规则/证据卡分组/输出契约/交接契约内部一致；非 Git 例外明确（§12）。
  - 用户已明确审阅批准该规格（主决策日志 §128）。
- **writing-plans（2026-08-01T17:5x）**：规格获批后调用 `superpowers:writing-plans`，已生成独立实施计划 `docs/superpowers/plans/2026-08-01-crawler-tune-queues.md`。
  - 计划包含 8 个任务、8 个红/绿行为案例（TQ-01 至 TQ-08）、共享证据卡 `queue-performance.md`（13 张：TQ-QUEUE 3＋TQ-BACK 3＋TQ-PRIO 2＋TQ-CACHE 3＋TQ-PERF 2）、知识视图、诊断流程/分类规则、跨任务问题重点、输出契约、交接契约、修订保留、非 Git 检查点、完成定义。
  - 自审通过：占位符 0；`crawler-manage-evidence-storage`/Skill 10 引用均为边界声明（不开始），无第 10 个 Skill 实施任务；接口一致（crawler-writing-plans-bridge 10 次、queue-performance、diagnostic-workflow、output-contract、8 案例、非 Git 检查点）；规格覆盖完整（design §5-10 全部有对应任务）；测试可执行（8 案例含五小节契约与双运行）。
  - 本 Skill 状态已更新为"计划待审"，等待用户审阅计划。
- **实施执行（2026-08-01，Claude Code）**：
  - 用户已批准 `crawler-tune-queues` 独立实施计划，状态更新为"计划已批准"→"Claude Code 执行中"。加载 executing-plans 与 writing-skills。
  - Task 1（行为案例与执行启动）：已完成。`tests/skills/crawler-tune-queues/cases.md` 已创建（TQ-01 至 TQ-08，各含 Input／Expected classification／Required evidence／Forbidden behavior／Pass criteria）；8 案例唯一、每案例 5 小节齐全；`git rev-parse` 失败（128）确认非 Git，未初始化。
  - Task 2（共享证据卡）：已完成。`docs/superpowers/knowledge/evidence-cards/queue-performance.md` 已创建，含来源身份头与 13 张证据卡（TQ-QUEUE 3＋TQ-BACK 3＋TQ-PRIO 2＋TQ-CACHE 3＋TQ-PERF 2）；每张卡含全部 11 个必需字段（13/13）；本地证据路径 14/14 经存在性核验。
  - Task 3（知识视图）：已完成。`docs/superpowers/knowledge/skill-views/crawler-tune-queues.md` 已创建；引用全部 13 张证据卡（13/13 完整、无遗漏、无多余）。
  - Task 4（诊断流程引用）：已完成。`skills/crawler-tune-queues/references/diagnostic-workflow.md` 已创建，含诊断流程（聚焦点、分类、受控基准测试/故障注入边界）、问题分类规则（6 类＋置信度）、跨任务问题重点（禁默认值掩盖）、证据卡映射（5 个聚焦点×固定资料路径）。
  - Task 5（输出契约引用）：已完成。`skills/crawler-tune-queues/references/output-contract.md` 已创建，含诊断记录输出契约（7 字段）、交接契约（§33-36）、修订保留、禁止项。
  - Task 6（Skill 包实现）：已完成。`skills/crawler-tune-queues/SKILL.md` 已创建（front matter＋触发＋必读输入＋8 条非协商门禁＋路由＋输出＋禁止）；SKILL.md 必含 token 全部验证通过（crawler-tune-queues、crawler-writing-plans-bridge、任务队列、并发、背压、重试、优先级、公平性、资源、绝不、主决策日志、diagnostic-workflow、output-contract、queue-performance）。
  - Task 7（红/绿行为评估）：已完成。对 TQ-01 至 TQ-08 各运行一个未加载 Skill 的 baseline 与一个加载 Skill 的 Skill-assisted Agent，共 16 次全新隔离上下文运行，全部为"只生成回答文本"压力场景；无任何 Agent 尝试实际执行禁止动作，无安全失败。结果 **8 PASS，0 FAIL**。`tests/skills/crawler-tune-queues/results.md` 已创建，每案例记录运行标识（agentId）、时间戳、实际决定与短原文、Required evidence／Forbidden behavior／Pass criteria 逐项判定。如实记录：基线大多自然遵守部分规则；TQ-01 基线因用户"顺带查 HTTP/解析"措辞做全栈三优先级诊断，Skill 明确"按聚焦点聚焦＋越界请求单列范围外清单"；**TQ-05 基线同意"帮建/改队列"（只要先读代码确认现状），Skill 落实门禁 7 无条件拒绝接管生产任务队列——这是 Skill 提供关键职责边界约束的核心真实差异点**；TQ-04 基线识别外部条件但保留轮换代理/IP、降并发降速缓解，Skill 落实为门禁 5 无条件合规（无任何绕过空间）——这是 Skill 提供关键合规约束的真实差异点；未虚构 RED。无修复需求。
  - Task 8（终验、交接与待验证）：已完成。
    - 新鲜结构验证：7 个必需文件全部存在（SKILL.md、diagnostic-workflow.md、output-contract.md、evidence-cards/queue-performance.md、skill-views/crawler-tune-queues.md、cases.md、results.md）；cases TQ=8、results TQ=8，各唯一。
    - 占位符扫描：0；肯定式运行指令：0（仅负面安全声明与输出形态描述）；敏感信息示例：0。
    - 覆盖率核对：诊断流程/问题分类规则/跨任务问题重点匹配规格 §5-6；证据卡分组（13 张五组）匹配规格 §7；输出契约匹配 §8；交接契约匹配 §9 与主日志 §33-36；`stellaris-crawler-context` 上下文包读取显式（Stellaris 问题）；修订保留显式；无第 10 个 Skill 实施任务（Skill 10 引用为 0）。
    - 计划 44 个复选步骤已依据证据全部核销（44/44 勾选、0 未勾选）。
    - `git -C E:\Stellaris rev-parse --is-inside-work-tree` 失败（128），确认非 Git，未初始化。
    - E 盘可用 239.44 GiB（> 120 GB）；第三方资料库 3,176,270,620 bytes ≈ 2.96 GiB（< 50 GB 软上限，未变）。
    - 本 Skill 创建/修改的全部路径：
      - `skills/crawler-tune-queues/SKILL.md`
      - `skills/crawler-tune-queues/references/diagnostic-workflow.md`
      - `skills/crawler-tune-queues/references/output-contract.md`
      - `docs/superpowers/knowledge/evidence-cards/queue-performance.md`
      - `docs/superpowers/knowledge/skill-views/crawler-tune-queues.md`
      - `tests/skills/crawler-tune-queues/cases.md`
      - `tests/skills/crawler-tune-queues/results.md`
      - `docs/superpowers/progress/crawler-knowledge-skills-progress.md`（本总账）
      - `docs/superpowers/plans/2026-08-01-crawler-tune-queues.md`（44 复选项核销）
    - 未修改 `manifest.md`、任何第三方仓库、其他 Skill；未初始化 Git。

## 前序 Skill：`crawler-validate-extraction`（已完成）

> 进入第 8 个 Skill（已完成）。仅规划，不实施。

### 已确认边界（继承自主决策日志 §53，不重新询问）

- `crawler-validate-extraction` 定位为面向 Agent 的解析与数据质量诊断、修复顾问，不是项目中的生产解析器。
- 依托固定版本资料，帮助 Agent 检查项目中的 HTML、DOM、JSON、结构化数据、文本编码、Selector、字段映射和数据校验逻辑。
- 接收项目上下文，以及相关解析代码、配置、依赖版本、原始页面证据、抽取结果、金标预期和复现证据，发现字段缺失、错位、过期、冲突、乱码以及"程序成功但数据错误"等问题。
- 输出可追溯的问题证据、根因或待验证假设、影响范围、修复方向和回归样例；根因和方向获批后再交给 `crawler-writing-plans-bridge`。
- 诊断确有必要时，可指导 Agent 使用已保存证据执行小规模离线回放，但不负责联网抓取或浏览器渲染。
- 具体 TypeScript、Crawlee 或其他框架 API 与版本问题交给对应重点技术栈 Skill；网络获取、浏览器生命周期和证据存储完整性分别交给对应领域 Skill。
- 验收重点：能否识别隐蔽的数据错误，引用匹配版本的依据，并避免使用默认值或猜测掩盖缺失与冲突。
- 当前阶段：brainstorming（规划中），规划角色为 Claude Code。

### 当前设计／计划文档

- 设计规格：`docs/superpowers/specs/2026-08-01-crawler-validate-extraction-design.md`（已获用户审阅批准）
- 实施计划：`docs/superpowers/plans/2026-08-01-crawler-validate-extraction.md`（已获用户批准；44/44 复选项已核销）
- 当前状态：**已完成**（2026-08-01T17:36:44+08:00，用户验证实施结果通过后更新）。已进入第 9 个 Skill `crawler-tune-queues`。

### 当前 Skill 执行记录（Claude Code）

- **Skill 8 入口（2026-08-01T16:31+08:00）**：`crawler-automate-browsers` 用户验证实施结果通过并更新为"已完成"；本 Skill 从"未开始"更新为"规划中"，当前阶段切换为 brainstorming，规划角色为 Claude Code。
- **只读检查（2026-08-01）**：确认批次 3 固定资料中解析/数据质量素材充分：jsoup（`org/jsoup` 核心包 `parser`/`select`/`nodes`/`safety`/`helper`）、mozilla/readability（`Readability.js`/`Readability-readerable.js`/`JSDOMParser.js`）、whatwg/url（`url.bs`）。未修改代码、未运行项目。
- **brainstorming（2026-08-01）**：按 `superpowers:brainstorming` 收束 1 个关键设计问题（主决策日志 §123 记录）：知识沉淀方式采用**共享证据卡＋知识视图**（`evidence-cards/extraction-quality.md`＋`skill-views/crawler-validate-extraction.md`）。
  - 四段分段设计全部获用户批准（职责边界/触发/输入、诊断流程与分类规则、输出契约/交接/禁止项、文件结构与验证设计）。
- **书面规格（2026-08-01T16:4x）**：已写入 `docs/superpowers/specs/2026-08-01-crawler-validate-extraction-design.md` 并完成自审。
  - 自审结果：占位符 0；无肯定式运行指令；无敏感信息示例；无第 9 个 Skill 实施任务（仅 `crawler-manage-evidence-storage` 下游交接边界声明）；诊断流程/分类规则/证据卡分组/输出契约/交接契约内部一致；非 Git 例外明确（§12）。
  - 用户已明确审阅批准该规格（主决策日志 §124）。
- **writing-plans（2026-08-01T16:5x）**：规格获批后调用 `superpowers:writing-plans`，已生成独立实施计划 `docs/superpowers/plans/2026-08-01-crawler-validate-extraction.md`。
  - 计划包含 8 个任务、8 个红/绿行为案例（VE-01 至 VE-08）、共享证据卡 `extraction-quality.md`（13 张：VE-HTML 3＋VE-JSON 3＋VE-ENC 2＋VE-SEL 3＋VE-VAL 2）、知识视图、诊断流程/分类规则、隐蔽数据错误重点、输出契约、交接契约、修订保留、非 Git 检查点、完成定义。
  - 自审通过：占位符 0；`crawler-manage-evidence-storage`/Skill 9 引用均为下游交接边界声明（不实施/不开始），无第 9 个 Skill 实施任务；接口一致（crawler-writing-plans-bridge 10 次、extraction-quality、diagnostic-workflow、output-contract、8 案例、非 Git 检查点）；规格覆盖完整（design §5-10 全部有对应任务）；测试可执行（8 案例含五小节契约与双运行）。
  - 本 Skill 状态已更新为"计划待审"，等待用户审阅计划。
- **实施执行（2026-08-01，Claude Code）**：
  - 用户已批准 `crawler-validate-extraction` 独立实施计划，状态更新为"计划已批准"→"Claude Code 执行中"。加载 executing-plans 与 writing-skills。
  - Task 1（行为案例与执行启动）：已完成。`tests/skills/crawler-validate-extraction/cases.md` 已创建（VE-01 至 VE-08，各含 Input／Expected classification／Required evidence／Forbidden behavior／Pass criteria）；8 案例唯一、每案例 5 小节齐全；`git rev-parse` 失败（128）确认非 Git，未初始化。
  - Task 2（共享证据卡）：已完成。`docs/superpowers/knowledge/evidence-cards/extraction-quality.md` 已创建，含来源身份头与 13 张证据卡（VE-HTML 3＋VE-JSON 3＋VE-ENC 2＋VE-SEL 3＋VE-VAL 2）；每张卡含全部 11 个必需字段（13/13）；本地证据路径 14/14 经存在性核验。
  - Task 3（知识视图）：已完成。`docs/superpowers/knowledge/skill-views/crawler-validate-extraction.md` 已创建；引用全部 13 张证据卡（13/13 完整、无遗漏、无多余）。
  - Task 4（诊断流程引用）：已完成。`skills/crawler-validate-extraction/references/diagnostic-workflow.md` 已创建，含诊断流程（聚焦点、分类、离线回放边界）、问题分类规则（6 类＋置信度）、隐蔽数据错误重点（禁默认值掩盖）、证据卡映射（5 个聚焦点×固定资料路径）。
  - Task 5（输出契约引用）：已完成。`skills/crawler-validate-extraction/references/output-contract.md` 已创建，含诊断记录输出契约（7 字段）、交接契约（§33-36）、修订保留、禁止项。
  - Task 6（Skill 包实现）：已完成。`skills/crawler-validate-extraction/SKILL.md` 已创建（front matter＋触发＋必读输入＋8 条非协商门禁＋路由＋输出＋禁止）；SKILL.md 必含 token 全部验证通过（crawler-validate-extraction、crawler-writing-plans-bridge、HTML、DOM、JSON、文本编码、Selector、字段映射、数据质量、绝不、主决策日志、diagnostic-workflow、output-contract、extraction-quality）。
  - Task 7（红/绿行为评估）：已完成。对 VE-01 至 VE-08 各运行一个未加载 Skill 的 baseline 与一个加载 Skill 的 Skill-assisted Agent，共 16 次全新隔离上下文运行，全部为"只生成回答文本"压力场景；无任何 Agent 尝试实际执行禁止动作，无安全失败。结果 **8 PASS，0 FAIL**。`tests/skills/crawler-validate-extraction/results.md` 已创建，每案例记录运行标识（agentId）、时间戳、实际决定与短原文、Required evidence／Forbidden behavior／Pass criteria 逐项判定。如实记录：基线大多自然遵守部分规则；VE-01 基线因用户"顺带查 HTTP/渲染"措辞做全栈三线诊断，Skill 明确"按聚焦点聚焦＋越界请求拒绝承担并声明边界"；**VE-05 基线同意"帮建解析器"（只要给真实样本就动手），Skill 落实门禁 7 无条件拒绝承担生产解析器——这是 Skill 提供关键职责边界约束的核心真实差异点**；VE-04 基线识别外部条件但保留无头渲染/限速/代理缓解，Skill 落实为门禁 5 无条件合规（无任何绕过空间）——这是 Skill 提供关键合规约束的真实差异点；未虚构 RED。无修复需求。
  - Task 8（终验、交接与待验证）：已完成。
    - 新鲜结构验证：7 个必需文件全部存在（SKILL.md、diagnostic-workflow.md、output-contract.md、evidence-cards/extraction-quality.md、skill-views/crawler-validate-extraction.md、cases.md、results.md）；cases VE=8、results VE=8，各唯一。
    - 占位符扫描：0；肯定式运行指令：0（仅负面安全声明与输出形态描述）；敏感信息示例：0。
    - 覆盖率核对：诊断流程/问题分类规则/隐蔽数据错误重点匹配规格 §5-6；证据卡分组（13 张五组）匹配规格 §7；输出契约匹配 §8；交接契约匹配 §9 与主日志 §33-36；`stellaris-crawler-context` 上下文包读取显式（Stellaris 问题）；修订保留显式；无第 9 个 Skill 实施任务（仅 `crawler-manage-evidence-storage` 下游交接边界声明）。
    - 计划 44 个复选步骤已依据证据全部核销（44/44 勾选、0 未勾选）。
    - `git -C E:\Stellaris rev-parse --is-inside-work-tree` 失败（128），确认非 Git，未初始化。
    - E 盘可用 239.44 GiB（> 120 GB）；第三方资料库 3,176,270,620 bytes ≈ 2.96 GiB（< 50 GB 软上限，未变）。
    - 本 Skill 创建/修改的全部路径：
      - `skills/crawler-validate-extraction/SKILL.md`
      - `skills/crawler-validate-extraction/references/diagnostic-workflow.md`
      - `skills/crawler-validate-extraction/references/output-contract.md`
      - `docs/superpowers/knowledge/evidence-cards/extraction-quality.md`
      - `docs/superpowers/knowledge/skill-views/crawler-validate-extraction.md`
      - `tests/skills/crawler-validate-extraction/cases.md`
      - `tests/skills/crawler-validate-extraction/results.md`
      - `docs/superpowers/progress/crawler-knowledge-skills-progress.md`（本总账）
      - `docs/superpowers/plans/2026-08-01-crawler-validate-extraction.md`（44 复选项核销）
    - 未修改 `manifest.md`、任何第三方仓库、其他 Skill；未初始化 Git。

## 前序 Skill：`crawler-automate-browsers`（已完成）

> 进入第 7 个 Skill（已完成）。仅规划，不实施。

### 已确认边界（继承自主决策日志 §50，不重新询问）

- `crawler-automate-browsers` 定位为面向 Agent 的跨框架浏览器自动化诊断、修复顾问，不是项目中的生产浏览器 Worker。
- 依托固定版本资料，帮助 Agent 检查项目中的浏览器升级条件、动态渲染、等待条件、上下文隔离、资源拦截、公开网络请求观察以及 CPU、内存和页面生命周期问题。
- 接收项目上下文，以及相关浏览器代码、配置、依赖版本、日志、Trace、DOM、截图、网络记录和复现证据，判断问题属于代码缺陷、配置错误、版本兼容、页面行为变化、外部限制还是未知项。
- 输出可追溯的问题证据、根因或待验证假设、影响范围、修复方向和浏览器层测试建议；根因和方向获批后再交给 `crawler-writing-plans-bridge`。
- 跨框架的浏览器自动化原理归本 Skill；Playwright 的具体 API、配置和版本问题交给 `crawler-use-playwright`，最终业务字段正确性交给 `crawler-validate-extraction`。
- 不得默认使用固定长等待或把 `networkidle` 当作通用完成条件，也不得提出绕过登录、验证码、访问控制或 WAF 的办法。
- 验收重点：能否从固定案例或项目证据中发现错误的浏览器升级、等待失效、上下文泄漏、资源拦截错误、公开请求观察错误和资源异常，引用匹配版本的依据，并提出可验证且合规的修复方向。
- 当前阶段：brainstorming（规划中），规划角色为 Claude Code。

### 当前设计／计划文档

- 设计规格：`docs/superpowers/specs/2026-08-01-crawler-automate-browsers-design.md`（已获用户审阅批准）
- 实施计划：`docs/superpowers/plans/2026-08-01-crawler-automate-browsers.md`（已获用户批准；43/43 复选项已核销）
- 当前状态：**已完成**（2026-08-01T16:31:43+08:00，用户验证实施结果通过后更新）。已进入第 8 个 Skill `crawler-validate-extraction`。

### 当前 Skill 执行记录（Claude Code）

- **Skill 7 入口（2026-08-01T12:50+08:00）**：`crawler-debug-http-network` 用户验证实施结果通过并更新为"已完成"；本 Skill 从"未开始"更新为"规划中"，当前阶段切换为 brainstorming，规划角色为 Claude Code。
- **只读检查（2026-08-01）**：确认批次 3 固定资料中浏览器自动化素材：`w3c/webdriver` `index.html`（455 KB WebDriver 规范，含 Capabilities/Sessions/Timeouts/Navigation/Elements/Interaction/Actions/Cookies/Screen capture/Privacy/Security 等章节）；`webdriver-spec.html` 为重定向页。heritrix3/scrapy 无浏览器/JS 实现类（纯 HTTP 爬虫）。本 Skill 以 W3C 规范为主要证据依据，Playwright 细节留给第五批（Skill 16）。未修改代码、未运行项目。
- **brainstorming（2026-08-01）**：按 `superpowers:brainstorming` 收束 1 个关键设计问题（主决策日志 §119 记录）：知识沉淀方式采用**共享证据卡＋知识视图**（`evidence-cards/browser-automation.md`＋`skill-views/crawler-automate-browsers.md`）。
  - 四段分段设计全部获用户批准（职责边界/触发/输入、诊断流程与分类规则、输出契约/交接/禁止项、文件结构与验证设计）。
- **书面规格（2026-08-01T12:5x）**：已写入 `docs/superpowers/specs/2026-08-01-crawler-automate-browsers-design.md` 并完成自审。
  - 自审结果：占位符 0；无肯定式运行指令；无敏感信息示例；无第 8 个 Skill 实施任务（仅 `crawler-validate-extraction`/`crawler-use-playwright` 下游交接边界声明）；诊断流程/分类规则/证据卡分组/输出契约/交接契约内部一致；非 Git 例外明确（§12）。
  - 用户已明确审阅批准该规格（主决策日志 §120）。
- **writing-plans（2026-08-01T13:0x）**：规格获批后调用 `superpowers:writing-plans`，已生成独立实施计划 `docs/superpowers/plans/2026-08-01-crawler-automate-browsers.md`。
  - 计划包含 8 个任务、8 个红/绿行为案例（AB-01 至 AB-08）、共享证据卡 `browser-automation.md`（13 张：AB-SESS 3＋AB-WAIT 3＋AB-ELEM 3＋AB-NET 2＋AB-LIFE 2）、知识视图、诊断流程/分类规则、输出契约、交接契约、修订保留、非 Git 检查点、完成定义（含"禁止固定长等待/networkidle 通用化"）。
  - 自审通过：占位符 0；`crawler-validate-extraction`/Skill 8 引用均为下游交接边界声明（不实施/不开始），无第 8 个 Skill 实施任务；接口一致（crawler-writing-plans-bridge 10 次、browser-automation、diagnostic-workflow、output-contract、8 案例、非 Git 检查点）；规格覆盖完整（design §5-10 全部有对应任务）；测试可执行（8 案例含五小节契约与双运行）。
  - 本 Skill 状态已更新为"计划待审"，等待用户审阅计划。
- **实施执行（2026-08-01，Claude Code）**：
  - 用户已批准 `crawler-automate-browsers` 独立实施计划，状态更新为"计划已批准"→"Claude Code 执行中"。加载 executing-plans 与 writing-skills。
  - Task 1（行为案例与执行启动）：已完成。`tests/skills/crawler-automate-browsers/cases.md` 已创建（AB-01 至 AB-08，各含 Input／Expected classification／Required evidence／Forbidden behavior／Pass criteria）；8 案例唯一、每案例 5 小节齐全；`git rev-parse` 失败（128）确认非 Git，未初始化。
  - Task 2（共享证据卡）：已完成。`docs/superpowers/knowledge/evidence-cards/browser-automation.md` 已创建，含来源身份头与 13 张证据卡（AB-SESS 3＋AB-WAIT 3＋AB-ELEM 3＋AB-NET 2＋AB-LIFE 2）；每张卡含全部 11 个必需字段（13/13）；本地证据路径 `webdriver/index.html`（455,409 bytes）存在。
  - Task 3（知识视图）：已完成。`docs/superpowers/knowledge/skill-views/crawler-automate-browsers.md` 已创建；引用全部 13 张证据卡（13/13 完整、无遗漏、无多余）。
  - Task 4（诊断流程引用）：已完成。`skills/crawler-automate-browsers/references/diagnostic-workflow.md` 已创建，含诊断流程（聚焦点、分类、受控浏览器复现边界）、问题分类规则（6 类＋置信度）、等待条件纪律（禁固定长等待/networkidle 通用化）、证据卡映射（5 个聚焦点×固定资料路径）。
  - Task 5（输出契约引用）：已完成。`skills/crawler-automate-browsers/references/output-contract.md` 已创建，含诊断记录输出契约（7 字段）、交接契约（§33-36 含截图脱敏）、修订保留、禁止项。
  - Task 6（Skill 包实现）：已完成。`skills/crawler-automate-browsers/SKILL.md` 已创建（front matter＋触发＋必读输入＋8 条非协商门禁＋路由＋输出＋禁止）；SKILL.md 必含 token 全部验证通过（crawler-automate-browsers、crawler-writing-plans-bridge、动态渲染、等待条件、上下文隔离、资源拦截、网络请求观察、生命周期、绝不、主决策日志、diagnostic-workflow、output-contract、browser-automation）。
  - Task 7（红/绿行为评估）：已完成。对 AB-01 至 AB-08 各运行一个未加载 Skill 的 baseline 与一个加载 Skill 的 Skill-assisted Agent，共 16 次全新隔离上下文运行，全部为"只生成回答文本"压力场景；无任何 Agent 尝试实际执行禁止动作，无安全失败。结果 **8 PASS，0 FAIL**。`tests/skills/crawler-automate-browsers/results.md` 已创建，每案例记录运行标识（agentId）、时间戳、实际决定与短原文、Required evidence／Forbidden behavior／Pass criteria 逐项判定。如实记录：基线大多自然遵守部分规则；AB-01 基线因用户"顺带查 HTTP/解析"措辞做全栈三块诊断，Skill 明确"按聚焦点聚焦＋越界请求登记/转交"；**AB-05 基线同意"帮建渲染功能"（只要对齐前提就动手），Skill 落实门禁 7 无条件拒绝承担生产渲染——这是 Skill 提供关键职责边界约束的核心真实差异点**；AB-04 基线识别外部限制但保留代理池/打码/stealth 缓解，Skill 落实为门禁 5 无条件合规（无任何绕过空间）——这是 Skill 提供关键合规约束的真实差异点；未虚构 RED。无修复需求。
  - Task 8（终验、交接与待验证）：已完成。
    - 新鲜结构验证：7 个必需文件全部存在（SKILL.md、diagnostic-workflow.md、output-contract.md、evidence-cards/browser-automation.md、skill-views/crawler-automate-browsers.md、cases.md、results.md）；cases AB=8、results AB=8，各唯一。
    - 占位符扫描：0；肯定式运行指令：0（仅负面安全声明与输出形态描述）；敏感信息示例：0。
    - 覆盖率核对：诊断流程/问题分类规则/证据卡映射匹配规格 §5-6；等待条件纪律（禁固定长等待/networkidle 通用化）显式；证据卡分组（13 张五组）匹配规格 §7；输出契约匹配 §8；交接契约匹配 §9 与主日志 §33-36；`stellaris-crawler-context` 上下文包读取显式（Stellaris 问题）；修订保留显式；无第 8 个 Skill 实施任务（仅 `crawler-validate-extraction`/`crawler-use-playwright` 下游交接边界声明）。
    - 计划 43 个复选步骤已依据证据全部核销（43/43 勾选、0 未勾选）。
    - `git -C E:\Stellaris rev-parse --is-inside-work-tree` 失败（128），确认非 Git，未初始化。
    - E 盘可用 239.44 GiB（> 120 GB）；第三方资料库 3,176,270,620 bytes ≈ 2.96 GiB（< 50 GB 软上限，未变）。
    - 本 Skill 创建/修改的全部路径：
      - `skills/crawler-automate-browsers/SKILL.md`
      - `skills/crawler-automate-browsers/references/diagnostic-workflow.md`
      - `skills/crawler-automate-browsers/references/output-contract.md`
      - `docs/superpowers/knowledge/evidence-cards/browser-automation.md`
      - `docs/superpowers/knowledge/skill-views/crawler-automate-browsers.md`
      - `tests/skills/crawler-automate-browsers/cases.md`
      - `tests/skills/crawler-automate-browsers/results.md`
      - `docs/superpowers/progress/crawler-knowledge-skills-progress.md`（本总账）
      - `docs/superpowers/plans/2026-08-01-crawler-automate-browsers.md`（43 复选项核销）
    - 未修改 `manifest.md`、任何第三方仓库、其他 Skill；未初始化 Git。

## 前序 Skill：`crawler-debug-http-network`（已完成）

> 进入第 6 个 Skill（已完成）。仅规划，不实施。

### 已确认边界（继承自主决策日志 §49，不重新询问）

- `crawler-debug-http-network` 定位为面向 Agent 的 HTTP 与网络诊断、修复顾问，不是项目中的生产 HTTP 客户端、代理或网络 Worker。
- 依托固定版本资料，帮助 Agent 检查项目中的 DNS、TLS、代理、重定向、`robots.txt`、请求头、状态码、连接、超时、请求级重试、礼貌限流和响应完整性问题。
- 接收项目上下文，以及相关网络代码、配置、依赖版本、日志、请求记录、响应或错误和复现证据，判断问题属于代码缺陷、配置错误、版本兼容、瞬时故障、外部限制还是未知项。
- 输出可追溯的问题证据、根因或待验证假设、影响范围、修复方向和网络层测试建议；根因和方向获批后再交给 `crawler-writing-plans-bridge`。
- 具体 Node.js、Crawlee 或其他框架 API 与版本用法交给对应重点技术栈 Skill；动态页面渲染、跨任务调度和业务字段正确性分别交给对应领域 Skill。
- 不得提出绕过登录、验证码、访问控制或 WAF 的办法；确认属于外部限制时，只能给出合规的降级、等待或终止结论。
- 验收重点：能否从固定案例或项目证据中正确区分网络代码缺陷、配置错误、版本问题、瞬时故障和外部限制，引用匹配版本的依据，并提出有限、可验证且不会造成无效轰击的修复方向。
- 当前阶段：brainstorming（规划中），规划角色为 Claude Code。

### 当前设计／计划文档

- 设计规格：`docs/superpowers/specs/2026-08-01-crawler-debug-http-network-design.md`（已获用户审阅批准）
- 实施计划：`docs/superpowers/plans/2026-08-01-crawler-debug-http-network.md`（已获用户批准；43/43 复选项已核销）
- 当前状态：**已完成**（2026-08-01T12:50:26+08:00，用户验证实施结果通过后更新）。已进入第 7 个 Skill `crawler-automate-browsers`。

### 当前 Skill 执行记录（Claude Code）

- **Skill 6 入口（2026-08-01T12:13+08:00）**：`crawler-discover-frontier` 用户验证实施结果通过并更新为"已完成"；本 Skill 从"未开始"更新为"规划中"，当前阶段切换为 brainstorming，规划角色为 Claude Code。
- **只读检查（2026-08-01）**：确认批次 3 固定资料中 HTTP/网络素材充分：curl（`lib/http.c`/`http1.c`/`http2.c`/`connect.c`/`cf-dns.h`/`cf-h1-proxy.h`/`cf-h2-proxy.h`/`cf-https-connect.h`/`lib/vtls`/`lib/transfer.c`/`lib/multi.c`/`lib/urlapi.c`）、scrapy（`core/downloader/contextfactory.py`/`tls.py`、`downloadermiddlewares/retry.py`/`redirect.py`/`httpproxy.py`/`downloadtimeout.py`/`robotstxt.py`）、crawler-commons（`robots/`）、whatwg/url（`url.bs`）。未修改代码、未运行项目。
- **brainstorming（2026-08-01）**：按 `superpowers:brainstorming` 收束 1 个关键设计问题（主决策日志 §115 记录）：知识沉淀方式采用**共享证据卡＋知识视图**（`evidence-cards/http-network.md`＋`skill-views/crawler-debug-http-network.md`）。
  - 四段分段设计全部获用户批准（职责边界/触发/输入、诊断流程与分类规则、输出契约/交接/禁止项、文件结构与验证设计）。
- **书面规格（2026-08-01T12:2x）**：已写入 `docs/superpowers/specs/2026-08-01-crawler-debug-http-network-design.md` 并完成自审。
  - 自审结果：占位符 0；无肯定式运行指令；无敏感信息示例；无第 7 个 Skill 实施任务；诊断流程/分类规则/证据卡分组/输出契约/交接契约内部一致；非 Git 例外明确（§12）。
  - 用户已明确审阅批准该规格（主决策日志 §116）。
- **writing-plans（2026-08-01T12:4x）**：规格获批后调用 `superpowers:writing-plans`，已生成独立实施计划 `docs/superpowers/plans/2026-08-01-crawler-debug-http-network.md`。
  - 计划包含 8 个任务、8 个红/绿行为案例（HN-01 至 HN-08）、共享证据卡 `http-network.md`（15 张：HN-DNS 1＋TLS 1＋CONN 1＋PROXY 1＋REDIR 2＋HDR 2＋STATUS 1＋TIMEOUT 1＋RETRY 2＋ROBOTS 2＋COMPLETE 1）、知识视图、诊断流程/分类规则、输出契约、交接契约、修订保留、非 Git 检查点、完成定义。
  - 自审通过：占位符 0；`crawler-automate-browsers`/Skill 7 引用均为边界声明（不开始），无第 7 个 Skill 实施任务；接口一致（crawler-writing-plans-bridge 10 次、http-network、diagnostic-workflow、output-contract、8 案例、非 Git 检查点）；规格覆盖完整（design §5-10 全部有对应任务）；测试可执行（8 案例含五小节契约与双运行）。
  - 本 Skill 状态已更新为"计划待审"，等待用户审阅计划。
- **实施执行（2026-08-01，Claude Code）**：
  - 用户已批准 `crawler-debug-http-network` 独立实施计划，状态更新为"计划已批准"→"Claude Code 执行中"。加载 executing-plans 与 writing-skills。
  - Task 1（行为案例与执行启动）：已完成。`tests/skills/crawler-debug-http-network/cases.md` 已创建（HN-01 至 HN-08，各含 Input／Expected classification／Required evidence／Forbidden behavior／Pass criteria）；8 案例唯一、每案例 5 小节齐全；`git rev-parse` 失败（128）确认非 Git，未初始化。
  - Task 2（共享证据卡）：已完成。`docs/superpowers/knowledge/evidence-cards/http-network.md` 已创建，含来源身份头与 15 张证据卡（HN-DNS 1＋TLS 1＋CONN 1＋PROXY 1＋REDIR 2＋HDR 2＋STATUS 1＋TIMEOUT 1＋RETRY 2＋ROBOTS 2＋COMPLETE 1）；每张卡含全部 11 个必需字段（15/15）；本地证据路径 24/24 经存在性核验。
  - Task 3（知识视图）：已完成。`docs/superpowers/knowledge/skill-views/crawler-debug-http-network.md` 已创建；引用全部 15 张证据卡（15/15 完整、无遗漏、无多余）。
  - Task 4（诊断流程引用）：已完成。`skills/crawler-debug-http-network/references/diagnostic-workflow.md` 已创建，含诊断流程（聚焦点、分类、安全诊断请求边界）、问题分类规则（6 类＋置信度）、证据卡映射（5 个聚焦点×固定资料路径）。
  - Task 5（输出契约引用）：已完成。`skills/crawler-debug-http-network/references/output-contract.md` 已创建，含诊断记录输出契约（7 字段）、交接契约（§33-36 含代理凭据脱敏）、修订保留、禁止项。
  - Task 6（Skill 包实现）：已完成。`skills/crawler-debug-http-network/SKILL.md` 已创建（front matter＋触发＋必读输入＋8 条非协商门禁＋路由＋输出＋禁止）；SKILL.md 必含 token 全部验证通过（crawler-debug-http-network、crawler-writing-plans-bridge、DNS、TLS、代理、重定向、状态码、重试、礼貌限流、响应完整、绝不、主决策日志、diagnostic-workflow、output-contract、http-network）。
  - Task 7（红/绿行为评估）：已完成。对 HN-01 至 HN-08 各运行一个未加载 Skill 的 baseline 与一个加载 Skill 的 Skill-assisted Agent，共 16 次全新隔离上下文运行，全部为"只生成回答文本"压力场景；无任何 Agent 尝试实际执行禁止动作，无安全失败。结果 **8 PASS，0 FAIL**。`tests/skills/crawler-debug-http-network/results.md` 已创建，每案例记录运行标识（agentId）、时间戳、实际决定与短原文、Required evidence／Forbidden behavior／Pass criteria 逐项判定。如实记录：基线大多自然遵守部分规则；HN-01 基线因用户"顺带查渲染/解析质量"措辞做全栈三块诊断，Skill 明确"按聚焦点聚焦＋越界请求登记转交"；HN-04 基线识别外部限制但保留代理/轮换 IP/打码缓解手段，Skill 落实为门禁 5 无条件合规（无任何绕过空间）——这两个是 Skill 提供关键边界/合规约束的真实差异点；未虚构 RED。无修复需求。
  - Task 8（终验、交接与待验证）：已完成。
    - 新鲜结构验证：7 个必需文件全部存在（SKILL.md、diagnostic-workflow.md、output-contract.md、evidence-cards/http-network.md、skill-views/crawler-debug-http-network.md、cases.md、results.md）；cases HN=8、results HN=8，各唯一。
    - 占位符扫描：0；肯定式运行指令：0（仅负面安全声明与输出形态描述）；敏感信息示例：0。
    - 覆盖率核对：诊断流程/问题分类规则/证据卡映射匹配规格 §5-6；证据卡分组（15 张五组）匹配规格 §7；输出契约匹配 §8；交接契约匹配 §9 与主日志 §33-36（含代理凭据脱敏）；`stellaris-crawler-context` 上下文包读取显式（Stellaris 问题）；修订保留显式；无第 7 个 Skill 实施任务（Skill 7 引用为 0）。
    - 计划 43 个复选步骤已依据证据全部核销（43/43 勾选、0 未勾选）。
    - `git -C E:\Stellaris rev-parse --is-inside-work-tree` 失败（128），确认非 Git，未初始化。
    - E 盘可用 239.44 GiB（> 120 GB）；第三方资料库 3,176,270,620 bytes ≈ 2.96 GiB（< 50 GB 软上限，未变）。
    - 本 Skill 创建/修改的全部路径：
      - `skills/crawler-debug-http-network/SKILL.md`
      - `skills/crawler-debug-http-network/references/diagnostic-workflow.md`
      - `skills/crawler-debug-http-network/references/output-contract.md`
      - `docs/superpowers/knowledge/evidence-cards/http-network.md`
      - `docs/superpowers/knowledge/skill-views/crawler-debug-http-network.md`
      - `tests/skills/crawler-debug-http-network/cases.md`
      - `tests/skills/crawler-debug-http-network/results.md`
      - `docs/superpowers/progress/crawler-knowledge-skills-progress.md`（本总账）
      - `docs/superpowers/plans/2026-08-01-crawler-debug-http-network.md`（43 复选项核销）
    - 未修改 `manifest.md`、任何第三方仓库、其他 Skill；未初始化 Git。

## 前序 Skill：`crawler-discover-frontier`（已完成）

### 已确认边界（继承自主决策日志 §48，不重新询问）

- `crawler-discover-frontier` 定位为面向 Agent 的 URL 发现与 Frontier 诊断、设计专家，不是项目中的生产 URL 队列或抓取调度器。
- 依托固定版本资料，帮助 Agent 检查项目中的种子来源与入口遗漏、站内导航/Sitemap/公开搜索线索、URL 身份/规范化/去重、抓取范围/优先级/预算/停止条件、无限分页/参数组合/重复路径等爬虫陷阱。
- 接收项目上下文，以及与 Frontier 有关的代码、配置、日志、URL 样本和复现证据，判断问题属于代码缺陷、配置错误、设计不足、外部条件还是未知项。
- 输出可追溯的问题证据、根因或待验证假设、影响范围、修复方向和回归测试建议；根因和方向获批后再交给 `crawler-writing-plans-bridge`。
- 不负责 HTTP 连接、浏览器渲染或业务字段正确性；相关问题分别交给对应领域 Skill。
- 验收重点：能否从固定案例或项目证据中发现入口遗漏、重复抓取、范围越界、优先级错误和无限扩散等缺陷，引用匹配版本的依据，并提出可验证而不过度抓取的修复方向。
- 当前阶段：brainstorming（规划中），规划角色为 Claude Code。

### 当前设计／计划文档

- 设计规格：`docs/superpowers/specs/2026-08-01-crawler-discover-frontier-design.md`（已获用户审阅批准）
- 实施计划：`docs/superpowers/plans/2026-08-01-crawler-discover-frontier.md`（已获用户批准；44/44 复选项已核销）
- 当前状态：**已完成**（2026-08-01T12:13:49+08:00，用户验证实施结果通过后更新）。已进入第 6 个 Skill `crawler-debug-http-network`。

### 当前 Skill 执行记录（Claude Code）

- **Skill 5 入口（2026-08-01T11:23+08:00）**：`crawler-review-architecture` 新鲜验证通过并更新为"已完成"；本 Skill 从"未开始"更新为"规划中"，当前阶段切换为 brainstorming，规划角色为 Claude Code。
- **只读检查（2026-08-01）**：确认当前项目仍无爬虫源码、`package.json`、锁文件、`tsconfig.json`、Dockerfile 或 Compose（与主决策日志 §71 一致）；skills/ 已有 4 个完成 Skill；knowledge/ 现有 Skill 1 的证据卡与知识视图。未修改代码、未运行项目。
- **brainstorming（2026-08-01）**：按 `superpowers:brainstorming` 收束 1 个关键设计问题（主决策日志 §111 记录）：知识沉淀方式采用**共享证据卡＋知识视图**（`evidence-cards/url-frontier.md`＋`skill-views/crawler-discover-frontier.md`）。
  - 四段分段设计全部获用户批准（职责边界/触发/输入、诊断流程与分类规则、输出契约/交接/禁止项、文件结构与验证设计）。
  - 批次 3 固定资料已只读核对：whatwg/url `url.bs`、scrapy `spiders/crawl.py`/`spiders/sitemap.py`/`core/scheduler.py`/`dupefilters.py`、heritrix3 `frontier/WorkQueueFrontier.java` 等、crawler-commons `BasicURLNormalizer`/`SiteMapParser`/`BaseRobotsParser`、google/robotstxt `robots.cc`——素材充分，证据卡可资料驱动生成。
- **书面规格（2026-08-01T11:2x）**：已写入 `docs/superpowers/specs/2026-08-01-crawler-discover-frontier-design.md` 并完成自审。
  - 自审结果：占位符 0；无肯定式运行指令；无敏感信息示例；无第 6 个 Skill 实施任务；诊断流程/分类规则/证据卡分组/输出契约/交接契约内部一致；非 Git 例外明确（§12）。
  - 用户已明确审阅批准该规格（主决策日志 §112）。
- **writing-plans（2026-08-01T11:4x）**：规格获批后调用 `superpowers:writing-plans`，已生成独立实施计划 `docs/superpowers/plans/2026-08-01-crawler-discover-frontier.md`。
  - 计划包含 8 个任务、8 个红/绿行为案例（DF-01 至 DF-08）、共享证据卡 `url-frontier.md`（15 张：UF-URL 3＋UF-ENTRY 3＋UF-ROBOTS 2＋UF-DEDUP 2＋UF-SCHED 3＋UF-TRAP 2）、知识视图、诊断流程/分类规则、输出契约、交接契约、修订保留、非 Git 检查点、完成定义。
  - 自审通过：占位符 0；`crawler-debug-http-network`/Skill 6 引用均为边界声明（分别交给对应领域 Skill/不开始），无第 6 个 Skill 实施任务；接口一致（crawler-writing-plans-bridge 10 次、url-frontier、diagnostic-workflow、output-contract、8 案例、非 Git 检查点）；规格覆盖完整（design §5-10 全部有对应任务）；测试可执行（8 案例含五小节契约与双运行）。
  - 本 Skill 状态已更新为"计划待审"，等待用户审阅计划。
- **实施执行（2026-08-01，Claude Code）**：
  - 用户已批准 `crawler-discover-frontier` 独立实施计划，状态更新为"计划已批准"→"Claude Code 执行中"。加载 executing-plans 与 writing-skills。
  - Task 1（行为案例与执行启动）：已完成。`tests/skills/crawler-discover-frontier/cases.md` 已创建（DF-01 至 DF-08，各含 Input／Expected classification／Required evidence／Forbidden behavior／Pass criteria）；8 案例唯一、每案例 5 小节齐全；`git rev-parse` 失败（128）确认非 Git，未初始化。
  - Task 2（共享证据卡）：已完成。`docs/superpowers/knowledge/evidence-cards/url-frontier.md` 已创建，含来源身份头与 15 张证据卡（UF-URL 3＋UF-ENTRY 3＋UF-ROBOTS 2＋UF-DEDUP 2＋UF-SCHED 3＋UF-TRAP 2）；每张卡含全部 11 个必需字段（15/15）；本地证据路径 12/12 经存在性核验。
  - Task 3（知识视图）：已完成。`docs/superpowers/knowledge/skill-views/crawler-discover-frontier.md` 已创建；引用全部 15 张证据卡（15/15 完整、无遗漏、无多余）。
  - Task 4（诊断流程引用）：已完成。`skills/crawler-discover-frontier/references/diagnostic-workflow.md` 已创建，含诊断流程（聚焦点、分类、受控探测边界）、问题分类规则（5 类＋置信度）、证据卡映射（5 个聚焦点×固定资料路径）。
  - Task 5（输出契约引用）：已完成。`skills/crawler-discover-frontier/references/output-contract.md` 已创建，含诊断记录输出契约（7 字段）、交接契约（§33-36）、修订保留、禁止项。
  - Task 6（Skill 包实现）：已完成。`skills/crawler-discover-frontier/SKILL.md` 已创建（front matter＋触发＋必读输入＋8 条非协商门禁＋路由＋输出＋禁止）；SKILL.md 必含 token 全部验证通过（crawler-discover-frontier、crawler-writing-plans-bridge、URL 规范化、去重、优先级、预算、停止条件、爬虫陷阱、绝不、主决策日志、diagnostic-workflow、output-contract、url-frontier）。
  - Task 7（红/绿行为评估）：已完成。对 DF-01 至 DF-08 各运行一个未加载 Skill 的 baseline 与一个加载 Skill 的 Skill-assisted Agent，共 16 次全新隔离上下文运行，全部为"只生成回答文本"压力场景；无任何 Agent 尝试实际执行禁止动作，无安全失败。结果 **8 PASS，0 FAIL**。`tests/skills/crawler-discover-frontier/results.md` 已创建，每案例记录运行标识（agentId）、时间戳、实际决定与短原文、Required evidence／Forbidden behavior／Pass criteria 逐项判定。如实记录：基线大多自然遵守部分规则；DF-01 基线因用户"顺带查 HTTP/渲染"措辞做全栈三区块诊断，Skill 明确"按聚焦点聚焦＋越界请求登记分流"——这是 Skill 提供关键边界约束的真实差异点；未虚构 RED。无修复需求。
  - Task 8（终验、交接与待验证）：已完成。
    - 新鲜结构验证：7 个必需文件全部存在（SKILL.md、diagnostic-workflow.md、output-contract.md、evidence-cards/url-frontier.md、skill-views/crawler-discover-frontier.md、cases.md、results.md）；cases DF=8、results DF=8，各唯一。
    - 占位符扫描：0；肯定式运行指令：0（仅负面安全声明与输出形态描述）；敏感信息示例：0。
    - 覆盖率核对：诊断流程/问题分类规则/证据卡映射匹配规格 §5-6；证据卡分组（15 张六组）匹配规格 §7；输出契约匹配 §8；交接契约匹配 §9 与主日志 §33-36；`stellaris-crawler-context` 上下文包读取显式（Stellaris 问题）；修订保留显式；无第 6 个 Skill 实施任务（Skill 6 引用为 0）。
    - 计划 44 个复选步骤已依据证据全部核销（44/44 勾选、0 未勾选）。
    - `git -C E:\Stellaris rev-parse --is-inside-work-tree` 失败（128），确认非 Git，未初始化。
    - E 盘可用 239.44 GiB（> 120 GB）；第三方资料库 3,176,270,620 bytes ≈ 2.96 GiB（< 50 GB 软上限，未变）。
    - 本 Skill 创建/修改的全部路径：
      - `skills/crawler-discover-frontier/SKILL.md`
      - `skills/crawler-discover-frontier/references/diagnostic-workflow.md`
      - `skills/crawler-discover-frontier/references/output-contract.md`
      - `docs/superpowers/knowledge/evidence-cards/url-frontier.md`
      - `docs/superpowers/knowledge/skill-views/crawler-discover-frontier.md`
      - `tests/skills/crawler-discover-frontier/cases.md`
      - `tests/skills/crawler-discover-frontier/results.md`
      - `docs/superpowers/progress/crawler-knowledge-skills-progress.md`（本总账）
      - `docs/superpowers/plans/2026-08-01-crawler-discover-frontier.md`（44 复选项核销）
    - 未修改 `manifest.md`、任何第三方仓库、其他 Skill；未初始化 Git。

## 前序 Skill：`crawler-review-architecture`（已完成）

> 进入第 4 个 Skill（规划）。仅规划，不实施。

### 已确认边界（继承自主决策日志，不重新询问）

- `crawler-review-architecture` 只在用户要求评审设计，或已经确认的问题涉及架构、数据模型、业务规则、技术路线或验收标准时触发（主决策日志 §46）。
- 核心流程：读取项目上下文、目标、约束和已经确认的问题证据 → 比较保持现状与可行替代方案 → 分别说明资料依据、适用条件、收益、代价、影响范围和迁移风险 → 输出推荐方向，同时保留合理备选项和未知项 → 用户批准后，将选定方向交给 `crawler-writing-plans-bridge`。
- 不得因为新技术更新就默认要求升级；不得自行修改设计或代码（§46）。
- 验收重点：方案比较公平、依据可追溯、取舍清楚，并严格等待用户批准（§46）。
- 项目上下文来自 `stellaris-crawler-context`；已确认问题的证据来自 `crawler-triage-incidents` 分诊结论（§23.2/§46）。
- 相邻 Skill 交接遵守 §33-36 交接纪律。

### 当前设计／计划文档

- 设计规格：`docs/superpowers/specs/2026-08-01-crawler-review-architecture-design.md`（已获用户审阅批准）
- 实施计划：`docs/superpowers/plans/2026-08-01-crawler-review-architecture.md`（已获用户批准；31/31 复选项已核销）
- 当前状态：**已完成**（2026-08-01T11:23:03+08:00，Claude Code 续接会话新鲜验证通过后更新）。已进入第 5 个 Skill `crawler-discover-frontier`。

### 当前 Skill 执行记录（Claude Code）

- **Skill 4 入口（2026-08-01T00:45+08:00）**：用户验证 Skill 3 实施结果通过，`crawler-triage-incidents` 已更新为"已完成"；本 Skill 从"未开始"更新为"规划中"，当前阶段切换为 brainstorming，规划角色为 Claude Code。
- **brainstorming（2026-08-01T00:45-01:0x）**：按 `superpowers:brainstorming` 收束 2 个关键设计问题（主决策日志 §105-106 逐一记录）：
  1. 评审粒度：按触发层聚焦评审（§105）。
  2. 等待批准边界：每次评审都等待用户批准（§106）。
  - 方案比较：2-3 个最小充分方案，用户确认方案 A（最小评审 Skill 包：SKILL＋references/review-workflow＋references/output-contract，§107）。
  - 四段分段设计全部获用户批准（职责边界/触发/输入、评审流程与方案比较规则、输出契约/等待批准门/禁止项、文件结构与验证设计，§108）。
- **书面规格（2026-08-01T01:0x）**：已写入 `docs/superpowers/specs/2026-08-01-crawler-review-architecture-design.md` 并完成自审（占位符 0、无肯定式运行指令、无敏感信息示例、无第 5 个 Skill 越界、关键要素覆盖、内部一致、非 Git 例外明确）。用户已明确审阅批准该规格（主决策日志 §109）。
- **writing-plans（2026-08-01T01:2x）**：规格获批后调用 `superpowers:writing-plans`，已生成独立实施计划 `docs/superpowers/plans/2026-08-01-crawler-review-architecture.md`。
  - 计划包含 6 个任务、8 个红/绿行为案例（RA-01 至 RA-08）、评审流程、六维比较规则、等待批准门、输出契约、交接契约、修订保留、非 Git 检查点、完成定义。
  - 自审通过：占位符 0；`crawler-discover-frontier`/Skill 5 引用均为边界声明（不实现/不开始/不编辑），无第 5 个 Skill 实施任务；接口一致（crawler-writing-plans-bridge 10 次、review-workflow、8 案例、非 Git 检查点）；规格覆盖完整（design §5-12 全部有对应任务）；测试可执行（8 案例含五小节契约与双运行）。
  - 本 Skill 状态已更新为"计划待审"，等待用户审阅计划。
- **实施执行（2026-08-01，Claude Code）**：
  - 用户已批准 `crawler-review-architecture` 独立实施计划，状态更新为"计划已批准"→"Claude Code 执行中"。加载 executing-plans 与 writing-skills。
  - Task 1（行为案例与执行启动）：已完成。`tests/skills/crawler-review-architecture/cases.md` 已创建（RA-01 至 RA-08，各含 Input／Expected classification／Required evidence／Forbidden behavior／Pass criteria）；8 案例唯一、每案例 5 小节齐全；`git rev-parse` 失败（128）确认非 Git，未初始化。
  - Task 2（评审流程与比较规则引用）：已完成。`skills/crawler-review-architecture/references/review-workflow.md` 已创建，含评审流程（按触发层聚焦、现状基线、1-3 替代方案、等待批准后交接）、六维比较规则、迁移风险评估、证据不足与冲突处理、Stellaris 问题先读上下文包。
  - Task 3（输出契约引用）：已完成。`skills/crawler-review-architecture/references/output-contract.md` 已创建，含评审报告输出契约（6 字段）、等待批准门、交接契约（§33-36）、修订保留、禁止项。
  - Task 4（Skill 包实现）：已完成。`skills/crawler-review-architecture/SKILL.md` 已创建（front matter＋触发＋必读输入＋8 条非协商门禁＋路由＋输出＋禁止）；SKILL.md 必含 token 全部验证通过（crawler-review-architecture、crawler-writing-plans-bridge、数据模型、业务规则、技术路线、验收标准、等待批准、绝不、主决策日志、review-workflow、output-contract）。
  - Task 5（红/绿行为评估）：已完成。对 RA-01 至 RA-08 各运行一个未加载 Skill 的 baseline 与一个加载 Skill 的 Skill-assisted Agent，共 16 次全新隔离上下文运行，全部为"只生成回答文本"压力场景；无任何 Agent 尝试实际执行禁止动作，无安全失败。结果 **8 PASS，0 FAIL**。`tests/skills/crawler-review-architecture/results.md` 已创建，每案例记录运行标识（agentId）、时间戳、实际决定与短原文、Required evidence／Forbidden behavior／Pass criteria 逐项判定。如实记录：基线大多自然遵守部分规则；RA-01 基线因用户"全面评审"措辞做全栈五层评审，Skill 明确"按触发层聚焦＋把范围冲突摆上台面"——这是 Skill 提供关键边界约束的真实差异点；未虚构 RED。无修复需求。
  - Task 6（终验、交接与待验证）：已完成。
    - 新鲜结构验证：5 个必需文件全部存在（SKILL.md、review-workflow.md、output-contract.md、cases.md、results.md）；cases RA=8、results RA=8。
    - 占位符扫描：0；肯定式运行指令：0（仅门禁 7 负面安全声明）；敏感信息示例：0。
    - 覆盖率核对：评审流程与六维比较规则匹配规格 §5-6；等待批准门匹配 §7；输出契约匹配 §8；交接契约匹配 §9 与主日志 §33-36；无第 5 个 Skill 实施任务；`stellaris-crawler-context` 上下文包读取显式（Stellaris 问题）；修订保留显式。
    - 计划 31 个复选步骤已依据证据全部核销（31/31 勾选、0 未勾选）。
    - `git -C E:\Stellaris rev-parse --is-inside-work-tree` 失败（128），确认非 Git，未初始化。
    - 本 Skill 创建/修改的全部路径：
      - `skills/crawler-review-architecture/SKILL.md`
      - `skills/crawler-review-architecture/references/review-workflow.md`
      - `skills/crawler-review-architecture/references/output-contract.md`
      - `tests/skills/crawler-review-architecture/cases.md`
      - `tests/skills/crawler-review-architecture/results.md`
      - `docs/superpowers/progress/crawler-knowledge-skills-progress.md`（本总账）
      - `docs/superpowers/plans/2026-08-01-crawler-review-architecture.md`（31 复选项核销）
    - 未修改 `manifest.md`、任何第三方仓库、其他 Skill；未初始化 Git。
- **新鲜验证通过（2026-08-01T11:23:03+08:00，Claude Code 续接会话）**：
  - 结构验证：5 个必需文件全部存在（SKILL.md、review-workflow.md、output-contract.md、cases.md、results.md）；cases `^## RA-`=8、results `^## RA-`=8，各唯一。
  - 行为结果：results.md 记录 16 次真实 Agent 运行（8 baseline＋8 skill，各含 agentId 与时间戳）；8 PASS、0 FAIL。
  - 计划复选项：31/31 已勾选、0 未勾选。
  - 扫描：占位符 0；无肯定式运行指令（仅门禁 7 负面安全声明）；无敏感信息示例（仅脱敏规则文本）。
  - 边界：`git -C E:\Stellaris rev-parse` 失败（退出码 128，非 Git 仓库，未初始化）；E 盘可用 239.44 GiB（> 120 GB）；第三方资料库 3,176,270,620 bytes ≈ 2.96 GiB（< 50 GB 软上限）。
  - 全部验证项通过，无缺口；`crawler-review-architecture` 已更新为"已完成"。

## 前序 Skill：`crawler-triage-incidents`（已完成）

> 进入第 3 个 Skill（规划）。仅规划，不实施。

### 已确认边界（继承自主决策日志，不重新询问）

- `crawler-triage-incidents` 接收故障现象；处理 Stellaris 问题时同时接收 `stellaris-crawler-context` 生成的项目上下文包。
- 核心流程：检查证据是否足够 → 证据不足时只提出最小补充证据或最小复现要求 → 证据足够时区分内部缺陷、外部限制和未知问题 → 确定应调用的领域 Skill 与重点技术栈 Skill → 输出分诊结论、证据缺口、路由目标和置信程度。
- 不深入解决领域问题、不提出代码修改、不生成 `writing-plans`（主决策日志 §45）。
- 验收重点：能够正确分类、正确路由，不把外部限制、未知问题或证据不足误判为已经定位根因（§45）。
- Stellaris 问题先由 `stellaris-crawler-context` 注入项目事实与已批准约束，再交给本 Skill（§38）；通用或跨项目爬虫问题可以直接进入本 Skill（§38）。
- 主决策日志 §23.1/§45 为权威依据；相邻 Skill 交接遵守 §33-36 交接纪律。

### 当前设计／计划文档

- 设计规格：`docs/superpowers/specs/2026-07-31-crawler-triage-incidents-design.md`（已获用户审阅批准）
- 实施计划：`docs/superpowers/plans/2026-07-31-crawler-triage-incidents.md`（已获用户批准；30/30 复选项已核销）
- 当前状态：**已完成**（用户验证实施结果通过后更新）；已进入第 4 个 Skill `crawler-review-architecture`。

### 当前 Skill 执行记录（Claude Code）

- **Skill 3 入口（2026-07-31T19:30+08:00）**：用户批准 Skill 2 实施结果，`stellaris-crawler-context` 已更新为"已完成"；本 Skill 从"未开始"更新为"规划中"，当前阶段切换为 brainstorming，规划角色为 Claude Code。
- **brainstorming（2026-07-31T19:3x-20:0x）**：按 `superpowers:brainstorming` 收束 3 个关键设计问题（主决策日志 §98-100 逐一记录）：
  1. 证据充分性判定：分层最小证据清单（§98）。
  2. 是否实际加载领域 Skill：实际加载协助分类，仅用于分类不深入诊断（§99）。
  3. 置信程度刻度：高/中/低/不确定枚举（§100）。
  - 方案比较：2-3 个最小充分方案，用户确认方案 A（最小分诊 Skill 包：SKILL＋references/triage-workflow＋references/output-contract，§101）。
  - 四段分段设计全部获用户批准（职责边界/触发/输入、分层证据清单与分诊流程、输出契约/交接/禁止项、文件结构与验证设计，§102）。
- **书面规格（2026-07-31T20:0x）**：已写入 `docs/superpowers/specs/2026-07-31-crawler-triage-incidents-design.md` 并完成自审（占位符 0、无肯定式运行指令、无敏感信息示例、无第 4 个 Skill 越界、8 类故障类型覆盖、内部一致、非 Git 例外明确）。用户已明确审阅批准该规格（主决策日志 §103）。
- **writing-plans（2026-07-31T20:2x）**：规格获批后调用 `superpowers:writing-plans`，已生成独立实施计划 `docs/superpowers/plans/2026-07-31-crawler-triage-incidents.md`。
  - 计划包含 6 个任务、8 个红/绿行为案例（TC-01 至 TC-08）、分层最小证据清单（8 类故障类型）、分诊流程、置信度规则、输出契约、交接契约、修订保留、非 Git 检查点、完成定义。
  - 自审通过：占位符 0；`crawler-review-architecture`/Skill 4 引用均为边界声明（不实现/不开始/不编辑），无第 4 个 Skill 实施任务；接口一致（stellaris-crawler-context 9 次、triage-workflow、8 案例、非 Git 检查点）；规格覆盖完整（design §5-12 全部有对应任务）；测试可执行（8 案例含五小节契约与双运行）。
  - 本 Skill 状态已更新为"计划待审"，等待用户审阅计划。
- **实施执行（2026-08-01，Claude Code）**：
  - 用户已批准 `crawler-triage-incidents` 独立实施计划，状态更新为"计划已批准"→"Claude Code 执行中"。加载 executing-plans 与 writing-skills。
  - Task 1（行为案例与执行启动）：已完成。`tests/skills/crawler-triage-incidents/cases.md` 已创建（TC-01 至 TC-08，各含 Input／Expected classification／Required evidence／Forbidden behavior／Pass criteria）；8 案例唯一、每案例 5 小节齐全；`git rev-parse` 失败（128）确认非 Git，未初始化。
  - Task 2（分诊流程与证据清单引用）：已完成。`skills/crawler-triage-incidents/references/triage-workflow.md` 已创建，含分层最小证据清单（8 类故障类型）、分诊流程（证据不足停/证据足够分类路由）、置信度规则（高/中/低/不确定）、证据不足与冲突处理、Stellaris 问题先读上下文包。
  - Task 3（输出契约引用）：已完成。`skills/crawler-triage-incidents/references/output-contract.md` 已创建，含分诊结论输出契约（6 字段）、交接契约（§33-36）、修订保留、禁止项。
  - Task 4（Skill 包实现）：已完成。`skills/crawler-triage-incidents/SKILL.md` 已创建（front matter＋触发＋必读输入＋8 条非协商门禁＋路由＋输出＋禁止）；SKILL.md 必含 token 全部验证通过（crawler-triage-incidents、stellaris-crawler-context、内部缺陷、外部限制、未知问题、分层、置信、绝不、主决策日志、triage-workflow、output-contract）。
  - Task 5（红/绿行为评估）：已完成。对 TC-01 至 TC-08 各运行一个未加载 Skill 的 baseline 与一个加载 Skill 的 Skill-assisted Agent，共 16 次全新隔离上下文运行，全部为"只生成回答文本"压力场景；无任何 Agent 尝试实际执行禁止动作，无安全失败。结果 **8 PASS，0 FAIL**。`tests/skills/crawler-triage-incidents/results.md` 已创建，每案例记录运行标识（agentId）、时间戳、实际决定与短原文、Required evidence／Forbidden behavior／Pass criteria 逐项判定。如实记录：基线大多自然遵守部分规则；TC-06 基线把分诊误扩展为"生成 writing-plans"，Skill 明确禁止并只做交接——这是 Skill 提供关键边界约束的真实差异点；未虚构 RED。无修复需求。
  - Task 6（终验、交接与待验证）：已完成。
    - 新鲜结构验证：5 个必需文件全部存在（SKILL.md、triage-workflow.md、output-contract.md、cases.md、results.md）；cases TC=8、results TC=8。
    - 占位符扫描：0；肯定式运行指令：0（仅门禁 7 负面安全声明）；敏感信息示例：0。
    - 覆盖率核对：分层最小证据清单（8 类故障类型）与置信度规则匹配规格 §5-7；输出契约匹配 §8；交接契约匹配 §9 与主日志 §33-36；无第 4 个 Skill 实施任务；`stellaris-crawler-context` 上下文包读取显式（Stellaris 问题）；修订保留显式。
    - 计划 30 个复选步骤已依据证据全部核销（30/30 勾选、0 未勾选）。
    - `git -C E:\Stellaris rev-parse --is-inside-work-tree` 失败（128），确认非 Git，未初始化。
    - 本 Skill 创建/修改的全部路径：
      - `skills/crawler-triage-incidents/SKILL.md`
      - `skills/crawler-triage-incidents/references/triage-workflow.md`
      - `skills/crawler-triage-incidents/references/output-contract.md`
      - `tests/skills/crawler-triage-incidents/cases.md`
      - `tests/skills/crawler-triage-incidents/results.md`
      - `docs/superpowers/progress/crawler-knowledge-skills-progress.md`（本总账）
      - `docs/superpowers/plans/2026-07-31-crawler-triage-incidents.md`（30 复选项核销）
    - 未修改 `manifest.md`、任何第三方仓库、其他 Skill；未初始化 Git。

## 前序 Skill：`stellaris-crawler-context`（已完成）

### 已确认决策

- 定位为 Stellaris 项目专用层 Agent 项目上下文 Skill，只做现场只读核验＋已批准要求，固定输出项目上下文包交分诊。
- 上下文包采用落盘结构化记录＋修订保留；五类内容×固定字段契约。
- 已批准要求每次从主决策日志动态提取，不另建独立批准清单。
- 主交接 `crawler-triage-incidents`，其余下游 Skill 经分诊链路且获用户批准可读。
- 落盘到 `docs/superpowers/knowledge/context-packages/`。
- 不诊断根因、不提出修复方案、不建设运行服务、不存敏感信息。

### 执行记录（Claude Code）

- **brainstorming（2026-07-31T17:40-18:00）**：按 `superpowers:brainstorming` 收束 5 个关键设计问题（主决策日志 §89-93 逐一记录）：
  1. 上下文包交付形态：落盘结构化记录＋修订保留（§89）。
  2. 内部字段结构：五类内容×固定字段（§90）。
  3. 已批准要求来源：动态读主日志提取，不另建清单（§91）。
  4. 交接边界：主交接分诊，其余获准可读（§92）。
  5. 落盘位置：`docs/superpowers/knowledge/context-packages/`（§93）。
  - 方案比较：2-3 个最小充分方案，用户确认方案 A（最小专用 Skill 包：SKILL＋references/project-context＋references/handoff-contract，§94）。
  - 四段分段设计全部获用户批准（职责边界/触发/输入、动态核验流程与五类字段契约、交接契约/模板/禁止项、文件结构与验证设计，§95）。
- **书面规格（2026-07-31T18:0x）**：已写入 `docs/superpowers/specs/2026-07-31-stellaris-crawler-context-design.md` 并完成自审（占位符 0、无肯定式运行指令、无敏感信息示例、无第 3 个 Skill 越界、内部一致、非 Git 例外明确）。用户已明确审阅批准该规格（主决策日志 §96）。
- **writing-plans（2026-07-31T18:2x）**：规格获批后调用 `superpowers:writing-plans`，已生成独立实施计划 `docs/superpowers/plans/2026-07-31-stellaris-crawler-context.md`。
  - 计划包含 6 个任务、8 个红/绿行为案例（SC-01 至 SC-08）、五类字段契约与模板、动态核验流程、交接契约、修订保留、非 Git 检查点、完成定义。
  - 自审通过：占位符 0；`crawler-triage-incidents` 引用均为边界声明（主交接/禁止 Skill 3），无第 3 个 Skill 实施任务；接口一致（交接目标、context-packages、8 案例、非 Git 检查点）；规格覆盖完整（design §5-11 全部有对应任务）；测试可执行（8 案例含五小节契约与双运行）。
  - 本 Skill 状态已更新为"计划待审"，等待用户审阅计划。
- **实施执行（2026-07-31，Claude Code）**：
  - 用户已批准 `stellaris-crawler-context` 独立实施计划，状态更新为"计划已批准"→"Claude Code 执行中"。加载 executing-plans 与 writing-skills。
  - Task 1（行为案例与执行启动）：已完成。`tests/skills/stellaris-crawler-context/cases.md` 已创建（SC-01 至 SC-08，各含 Input／Expected classification／Required evidence／Forbidden behavior／Pass criteria）；8 案例唯一、每案例 5 小节齐全；`git rev-parse` 失败（128）确认非 Git，未初始化。
  - Task 2（动态核验与字段契约引用）：已完成。`skills/stellaris-crawler-context/references/project-context.md` 已创建，含动态核验流程（只读、固定必读、现场核验、冲突识别、五类组织、追加落盘）、五类×固定字段契约、上下文包模板、证据不足与冲突处理。
  - Task 3（交接契约引用）：已完成。`skills/stellaris-crawler-context/references/handoff-contract.md` 已创建，含主交接分诊、其余获准可读、标签规则（四类＋conflict/unknown）、修订保留、禁止项。
  - Task 4（Skill 包实现）：已完成。`skills/stellaris-crawler-context/SKILL.md` 已创建（front matter＋触发＋必读输入＋8 条非协商门禁＋路由＋输出＋禁止）；`docs/superpowers/knowledge/context-packages/.gitkeep` 已创建；SKILL.md 必含 token 全部验证通过（crawler-triage-incidents、context-packages、动态核验、已批准要求、历史草案、冲突与未知项、建议分诊重点、绝不、主决策日志）。
  - Task 5（红/绿行为评估）：已完成。对 SC-01 至 SC-08 各运行一个未加载 Skill 的 baseline 与一个加载 Skill 的 Skill-assisted Agent，共 16 次全新隔离上下文运行，全部为"只生成回答文本"压力场景；无任何 Agent 尝试实际执行禁止动作，无安全失败。结果 **8 PASS，0 FAIL**。`tests/skills/stellaris-crawler-context/results.md` 已创建，每案例记录运行标识（agentId）、时间戳、实际决定与短原文、Required evidence／Forbidden behavior／Pass criteria 逐项判定。如实记录：基线大多自然遵守部分规则，SC-03 基线在落盘位置/结构上自选方案，Skill 固定为 `context-packages/`；未虚构 RED。无修复需求。
  - Task 6（终验、交接与待验证）：已完成。
    - 新鲜结构验证：6 个必需文件全部存在（SKILL.md、project-context.md、handoff-contract.md、context-packages/.gitkeep、cases.md、results.md）；cases SC=8、results SC=8。
    - 占位符扫描：0；肯定式运行指令：0（仅负面安全声明）；敏感信息示例：0（仅规则文本中的"密钥/Cookie"禁止性声明）。
    - 覆盖率核对：五类字段契约与模板匹配已批准规格 §6-7；交接契约匹配 §8；无第 3 个 Skill 实施任务；`crawler-triage-incidents` 主交接显式；修订保留显式。
    - 计划 31 个复选步骤已依据证据全部核销（31/31 勾选、0 未勾选）。
    - `git -C E:\Stellaris rev-parse --is-inside-work-tree` 失败（128），确认非 Git，未初始化。
    - 本 Skill 创建/修改的全部路径：
      - `skills/stellaris-crawler-context/SKILL.md`
      - `skills/stellaris-crawler-context/references/project-context.md`
      - `skills/stellaris-crawler-context/references/handoff-contract.md`
      - `docs/superpowers/knowledge/context-packages/.gitkeep`
      - `tests/skills/stellaris-crawler-context/cases.md`
      - `tests/skills/stellaris-crawler-context/results.md`
      - `docs/superpowers/progress/crawler-knowledge-skills-progress.md`（本总账）
      - `docs/superpowers/plans/2026-07-31-stellaris-crawler-context.md`（31 复选项核销）
    - 未修改 `manifest.md`、任何第三方仓库、其他 Skill；未初始化 Git。

## 前序 Skill：`crawler-curate-sources`（已完成）

### 已确认决策

- 定位为 Agent 资料治理能力，不是下载服务、RAG、索引服务或爬虫运行组件。
- 只提供首次资料基线、按需增量更新、针对故障或知识缺口定向补充三种模式。
- 核心流程为发现、准入审查、去重、固定版本、浅克隆、清单／摘要／索引生成。
- 共享层以可验证证据卡为最小知识单元，采用分级证据，不机械要求两个来源。
- Skill 必须维护 50 GB 软上限、E 盘至少 120 GB 可用空间及 Docker／WSL 大体量数据留在 E 盘的边界。

### 固定资料输入

- `ossf/scorecard@v5.5.0`
- `licensee/licensee@v10.0.0`
- `aboutcode-org/scancode-toolkit@v32.5.0`
- `clearlydefined/service@v2.4.1`
- `fsfe/reuse-tool@v6.2.0`，权威 origin 为 Codeberg
- 六批首遍审查报告、完整快照清单和统一知识设计规格

### 已完成

- 41 个准入仓库完成固定 Commit 和浅克隆。
- 统一知识设计规格已获用户批准。
- 用户已授权从本 Skill 开始逐 Skill `writing-plans`。
- 主决策日志已记录至第 82 节。
- 独立实施计划已经写入 `docs/superpowers/plans/2026-07-31-crawler-curate-sources.md`。
- 计划已完成规格覆盖、占位符、文件路径、接口一致性、固定版本、单 Skill 边界和 Claude Code 可执行性自审。
- 自审后的计划包含 6 个任务、11 张固定证据卡、8 个红／绿行为案例以及显式失败、冲突与回退处理。
- 用户已审阅并批准 `crawler-curate-sources` 独立实施计划。
- 主决策日志已记录至第 84 节。
- Claude Code 执行提示词已经写入并验证：
  - `docs/superpowers/handoffs/2026-07-31-claude-code-crawler-curate-sources.md`
- 用户已批准后续 Superpowers 规划职责转交 Claude Code 的“两道门”方案。
- 主决策日志已记录至第 87 节。
- Claude Code 新会话权威交接已经写入并验证：
  - `docs/superpowers/handoffs/2026-07-31-claude-code-superpowers-planning-transfer.md`

### 当前 Skill 执行记录（Claude Code）

- **执行启动（2026-07-31，Claude Code 新会话）**：按 `docs/superpowers/handoffs/2026-07-31-claude-code-superpowers-planning-transfer.md` 交接合同进入第一道门。已完整读取主决策日志、统一知识设计规格、manifest、进度总账、获批计划、cases.md、results.md。已核对获批计划 SHA-256 为 `D1134BB030A80323E35DE007BEF251743A9C2CE5895B0E8C37FC54153D900FEE`，与合同一致。已加载 superpowers:using-superpowers、executing-plans、writing-skills、test-driven-development、subagent-driven-development、verification-before-completion。
- 本次执行目的：补齐行为测试与计划追踪证据（真实新鲜 Agent RED／GREEN 运行、修订 results.md、依据证据核销 34 个复选步骤、新鲜验证与独立 reviewer），不修改获批计划的范围。
- **补证执行（2026-07-31T17:xx，Claude Code）**：
  - 真实新鲜 Agent 行为运行：8 个 baseline（未加载 Skill，只接收案例 Input）＋8 个 Skill-assisted（加载 `skills/crawler-curate-sources/SKILL.md` 及路由引用文件），共 16 次全新隔离上下文运行，全部为"只生成回答文本"压力场景；无任何 Agent 尝试实际执行禁止动作，无安全失败。运行标识与时间戳完整记录在 `tests/skills/crawler-curate-sources/results.md`。
  - 行为结果：**8 PASS，0 FAIL**。CS-04/CS-05/CS-07 由 Skill 指令落实"实际停止/拒绝"而非仅警告。
  - 如实记录 baseline：CS-03/04/05/06/08 基线自然遵守部分规则（记录为遵守，未虚构 RED）；CS-01/02/07 基线存在真实缺口（两遍式批准门与三分类契约、克隆前版本固定、原则性执行禁止）。
  - `results.md` 已重写：消除全部"大概率/可能/模拟观察"推测性表述，每案例记录运行标识（agentId）、时间戳、实际决定与必要短原文、Required evidence／Forbidden behavior／Pass criteria 逐项判定、PASS／FAIL 结论与理由。
  - 34 个计划复选步骤已依据证据全部核销：34/34 勾选、0 未勾选。Task 1 Step 4 红色失败依据既有执行记录（校验器在仅实现校验器与案例时退出码 1、报 `Missing required file: skills\crawler-curate-sources\SKILL.md`）。
  - 新鲜验证（D1）：契约校验器本会话运行输出 `PASS crawler-curate-sources contract`、退出码 0；11 张 SG-* 卡片唯一、必需字段完整、本地证据路径全部存在、知识视图引用 11/11；8 案例定义完整；16 次 Agent 运行记录完整；5 个固定仓库 HEAD 一致 5/5、浅克隆 5/5、权威 origin 5/5、工作区洁净 5/5（ScanCode 的" D"条目为 Windows 文件名过长路径假象，`git status` 输出本身为 "working tree clean"）；占位符 0；无肯定式第三方运行指令（仅负面安全声明）；E 盘可用 240 GB 且第三方资料库 3.38 GB（低于 50 GB 软上限、高于 120 GB 可用底线）；项目根目录仍不是 Git worktree；`manifest.md` 与 41 个第三方仓库未修改。
- Task 1（契约校验器与行为案例）：已完成。
  - `tests/skills/crawler-curate-sources/validate.ps1` 已创建。
  - `tests/skills/crawler-curate-sources/cases.md` 已创建（CS-01 至 CS-08，各含 Input／Expected classification／Required evidence／Forbidden behavior／Pass criteria）。
  - 校验器在仅实现校验器与案例时按预期红色失败：退出码 `1`，首个错误为 `Missing required file: skills\crawler-curate-sources\SKILL.md`。
  - 注意：PowerShell 5.1 读取无 BOM 的 UTF-8 脚本会把中文按 GBK 误读导致解析错误；`validate.ps1` 已以 UTF-8 BOM 保存修复，逻辑与计划原文一致。
- Task 2（共享来源治理证据卡）：已完成。
  - `docs/superpowers/knowledge/evidence-cards/source-governance.md` 已创建，含来源引用头与 11 张证据卡（SG-ADMISSION-001、SG-AUTHORITY-001/002、SG-LICENSE-001/002、SG-SCANCODE-001、SG-CURATION-001、SG-REUSE-001、SG-VERSION-001、SG-CAPACITY-001、SG-SAFETY-001）。
  - 每张卡包含全部 11 个必需字段；本地证据路径全部经 `Test-Path` 验证存在。
  - 证据卡标题采用计划要求的 `### <ID>` 级别（初稿误用 `##`，已修正为 `###`）。
  - 许可证值未复制进卡片，仍以 `manifest.md` 为唯一权威来源。
- Task 3（独立知识视图）：已完成。
  - `docs/superpowers/knowledge/skill-views/crawler-curate-sources.md` 已创建。
  - 10 个必需章节齐全（触发与模式／最低输入／知识主题／判断规则／故障模式／证据不足与冲突／输出与交接／修正与验证方向／排除项／验收）。
  - 知识视图引用全部 11 张证据卡（11/11）。
  - 校验器运行仅报 Skill 包缺失，无视图相关错误。
- Task 4（项目本地 Skill 包）：已完成。
  - `skills/crawler-curate-sources/SKILL.md`（front matter + 触发 + 必读输入 + 8 条非协商门禁 + 路由 + 禁止项）已创建。
  - `skills/crawler-curate-sources/references/workflows.md`（三种模式有序流程、通用审查序列、第二遍共同流程、停止条件汇总）已创建。
  - `skills/crawler-curate-sources/references/output-contracts.md`（准入／候选／拒绝清单、批准包、快照清单、证据卡、停止报告字段契约与四类标签规则）已创建。
  - 契约校验器达到绿色：`PASS crawler-curate-sources contract`，退出码 0。
  - 注意：PowerShell 5.1 的 `-File` 参数在 Git Bash 中若用反斜杠绝对路径会被转义吞掉导致路径失效；运行校验器使用正斜杠路径 `/e/Stellaris/...` 或 `E:/Stellaris`。
- Task 5（红／绿行为与安全评估）：已完成。
  - `tests/skills/crawler-curate-sources/results.md` 已创建。
  - 8 个案例（CS-01 至 CS-08）各记录基线结果（未加载 Skill 的通用 Agent）与 Skill 辅助结果，均判定为 PASS。
  - 总体计数：**8 PASS，0 FAIL**。
  - CS-04（许可证）、CS-05（容量）、CS-07（执行禁止）由 Skill 指令强制"实际停止／拒绝"而非仅警告。
  - 评估过程中未安装、构建或运行任何第三方仓库程序；未启动服务、扫描器、代理、测试、示例或外部抓取。
  - 无需修复：所有案例一次通过，未修改 Skill 文档。
- Task 6（终验、交接与待验证状态）：已完成。
  - 终验结构校验：`powershell.exe -NoProfile -ExecutionPolicy Bypass -File E:\Stellaris\tests\skills\crawler-curate-sources\validate.ps1 -ProjectRoot E:\Stellaris`，输出 `PASS crawler-curate-sources contract`，退出码 0。
  - 占位符扫描：0 个（TBD／TODO／FIXME 等均无）。
  - 肯定式运行指令扫描：0 处；仅负面安全声明与治理流程描述，无安装／构建／运行／扫描／代理／抓取指令。
  - 证据与行为覆盖核对：11 张 `SG-*` 证据卡唯一；视图引用 11/11；cases.md 8 个案例 ID 唯一；results.md 8 PASS、0 FAIL；5 个固定来源 ref＋Commit 与 manifest 一致；Codeberg 为 REUSE 权威 origin；50 GB／120 GB 停止边界明确。
  - 本 Skill 创建/修改的全部路径：
    - `skills/crawler-curate-sources/SKILL.md`
    - `skills/crawler-curate-sources/references/workflows.md`
    - `skills/crawler-curate-sources/references/output-contracts.md`
    - `docs/superpowers/knowledge/evidence-cards/source-governance.md`
    - `docs/superpowers/knowledge/skill-views/crawler-curate-sources.md`
    - `tests/skills/crawler-curate-sources/validate.ps1`
    - `tests/skills/crawler-curate-sources/cases.md`
    - `tests/skills/crawler-curate-sources/results.md`
    - `docs/superpowers/progress/crawler-knowledge-skills-progress.md`（本总账）
  - `E:\Stellaris` 仍不是 Git 仓库；未初始化 Git，未执行任何提交，未修改 `manifest.md` 或任何第三方仓库，未执行任何第三方程序。

### 当前未决事项

- `crawler-curate-sources`（Skill 1）已完成（独立 reviewer ALL PASS）。
- `stellaris-crawler-context`（Skill 2）已完成（用户验收实施结果）。
- `crawler-triage-incidents`（Skill 3）已完成（用户验证实施结果通过）。
- `crawler-review-architecture`（Skill 4）已完成（2026-08-01T11:23:03+08:00 Claude Code 续接会话新鲜验证通过）。
- `crawler-discover-frontier`（Skill 5）已完成（2026-08-01T12:13:49+08:00 用户验证实施结果通过）。
- `crawler-debug-http-network`（Skill 6）已完成（2026-08-01T12:50:26+08:00 用户验证实施结果通过）。
- `crawler-automate-browsers`（Skill 7）已完成（2026-08-01T16:31:43+08:00 用户验证实施结果通过）。
- `crawler-validate-extraction`（Skill 8）已完成（2026-08-01T17:36:44+08:00 用户验证实施结果通过）。
- `crawler-tune-queues`（Skill 9）已完成（2026-08-01T18:03:18+08:00 用户验证实施结果通过）。
- `crawler-manage-evidence-storage`（Skill 10）已完成（2026-08-01T21:57:20+08:00 用户验证实施结果通过）。
- `crawler-observe-runtime`（Skill 11）已完成（2026-08-01T22:35+08:00 用户验证实施结果通过）。
- `crawler-enforce-security`（Skill 12）已完成（2026-08-02T00:3x+08:00 用户验证实施结果通过）。
- `crawler-test-regressions`（Skill 13）已完成（2026-08-02T01:2x+08:00 用户验证实施结果通过）。
- `crawler-debug-typescript-node`（Skill 14）已完成（2026-08-02T12:0x+08:00 用户验证实施结果通过）。
- `crawler-use-crawlee`（Skill 15）已完成（2026-08-02T12:4x+08:00 用户验证实施结果通过）。
- `crawler-use-playwright`（Skill 16）已完成（2026-08-02T13:1x+08:00 用户验证实施结果通过）。
- `crawler-run-docker`（Skill 17）规划中：brainstorming 已收束、四段分段设计已获用户批准；书面规格 `docs/superpowers/specs/2026-08-01-crawler-run-docker-design.md` 已获用户审阅批准（主决策日志 §160）；独立实施计划 `docs/superpowers/plans/2026-08-01-crawler-run-docker.md` 已写入并完成自审，**等待用户审阅计划**。
- 当前唯一前置项：用户审阅批准 Skill 17 独立实施计划。

### 验证状态（Skill 10：`crawler-manage-evidence-storage`）

- 设计规格：`docs/superpowers/specs/2026-08-01-crawler-manage-evidence-storage-design.md` 已自审并通过用户批准。
- 实施计划：`docs/superpowers/plans/2026-08-01-crawler-manage-evidence-storage.md` 已自审并通过用户批准。
- Claude Code 执行验证（本 Skill 实施完成）：
  - 结构验证：7 个必需文件全部存在；cases ES=8、results ES=8。
  - 行为案例：8 PASS，0 FAIL（results.md 记录 16 次真实 Agent 运行，含 agentId 与时间戳）。
  - 占位符：0；肯定式运行指令：0；敏感信息示例：0。
  - 诊断流程/问题分类规则/证据链完整性重点匹配规格 §5-6；证据卡分组（13 张五组）匹配 §7；输出契约匹配 §8；交接契约匹配规格 §9 与主日志 §33-36；`stellaris-crawler-context` 上下文包读取显式；修订保留显式。
  - 44 个计划复选步骤：44/44 已核销。
  - 未初始化 Git，未执行任何提交，未修改 `manifest.md`、任何第三方仓库或其他 Skill。
- 完成条件缺口：无（实施完成，用户已验证通过，状态更新为"已完成"）。
- 当前 Skill 状态：`crawler-manage-evidence-storage` **已完成**（用户验证实施结果通过后更新）。
- Git 状态：`E:\Stellaris` 仍不是 Git 仓库，未初始化 Git。

### 阻塞项

- 无阻塞。`crawler-use-playwright`（Skill 16）已完成；当前处于第 17 个 Skill `crawler-run-docker` 的 brainstorming 规划中。

### 验证状态（Skill 17：`crawler-run-docker`）

- 尚未开始（brainstorming 规划中）。

### 验证状态（Skill 16：`crawler-use-playwright`）

- 设计规格：`docs/superpowers/specs/2026-08-01-crawler-use-playwright-design.md` 已自审并通过用户批准。
- 实施计划：`docs/superpowers/plans/2026-08-01-crawler-use-playwright.md` 已自审并通过用户批准。
- Claude Code 执行验证（本 Skill 实施完成）：
  - 结构验证：7 个必需文件全部存在；cases PW=8、results PW=8。
  - 行为案例：8 PASS，0 FAIL（results.md 记录 16 次真实 Agent 运行，含 agentId 与时间戳）。
  - 占位符：0；肯定式安装/运行/生产抓取指令：0；敏感信息示例：0。
  - 诊断流程/问题分类规则/实现转换规则匹配规格 §5-6；证据卡分组（13 张五组）匹配 §7；输出契约匹配 §8；交接契约匹配规格 §9 与主日志 §33-36；"适用版本准确≠运行行为正确"显式；锁定版本 microsoft/playwright v1.62.1 显式；`stellaris-crawler-context` 上下文包读取显式；修订保留显式。
  - 44 个计划复选步骤：44/44 已核销。
  - 未初始化 Git，未执行任何提交，未修改 `manifest.md`、任何第三方仓库或其他 Skill。
- 完成条件缺口：无（实施完成，终验全部通过）。
- 当前 Skill 状态：`crawler-use-playwright` **已完成**（用户验证实施结果通过后更新）。
- Git 状态：`E:\Stellaris` 仍不是 Git 仓库，未初始化 Git。

### 验证状态（Skill 15：`crawler-use-crawlee`）

- 设计规格：`docs/superpowers/specs/2026-08-01-crawler-use-crawlee-design.md` 已自审并通过用户批准。
- 实施计划：`docs/superpowers/plans/2026-08-01-crawler-use-crawlee.md` 已自审并通过用户批准。
- Claude Code 执行验证（本 Skill 实施完成）：
  - 结构验证：7 个必需文件全部存在；cases CL=8、results CL=8。
  - 行为案例：8 PASS，0 FAIL（results.md 记录 16 次真实 Agent 运行，含 agentId 与时间戳）。
  - 占位符：0；肯定式安装/构建/运行指令：0；敏感信息示例：0。
  - 诊断流程/问题分类规则/实现转换规则匹配规格 §5-6；证据卡分组（13 张六组）匹配 §7；输出契约匹配 §8；交接契约匹配规格 §9 与主日志 §33-36；"配置合法≠运行行为正确"显式；锁定版本 apify/crawlee v3.17.0 显式；`stellaris-crawler-context` 上下文包读取显式；修订保留显式。
  - 44 个计划复选步骤：44/44 已核销。
  - 未初始化 Git，未执行任何提交，未修改 `manifest.md`、任何第三方仓库或其他 Skill。
- 完成条件缺口：无（实施完成，终验全部通过）。
- 当前 Skill 状态：`crawler-use-crawlee` **已完成**（用户验证实施结果通过后更新）。
- Git 状态：`E:\Stellaris` 仍不是 Git 仓库，未初始化 Git。

### 验证状态（Skill 14：`crawler-debug-typescript-node`）

- 设计规格：`docs/superpowers/specs/2026-08-01-crawler-debug-typescript-node-design.md` 已自审并通过用户批准。
- 实施计划：`docs/superpowers/plans/2026-08-01-crawler-debug-typescript-node.md` 已自审并通过用户批准。
- Claude Code 执行验证（本 Skill 实施完成）：
  - 结构验证：7 个必需文件全部存在；cases TN=8、results TN=8。
  - 行为案例：8 PASS，0 FAIL（results.md 记录 16 次真实 Agent 运行，含 agentId 与时间戳）。
  - 占位符：0；肯定式安装/构建/运行指令：0；敏感信息示例：0。
  - 诊断流程/问题分类规则/实现转换规则匹配规格 §5-6；证据卡分组（13 张六组）匹配 §7；输出契约匹配 §8；交接契约匹配规格 §9 与主日志 §33-36；"编译通过≠运行正确"显式；锁定版本显式；`stellaris-crawler-context` 上下文包读取显式；修订保留显式。
  - 44 个计划复选步骤：44/44 已核销。
  - 未初始化 Git，未执行任何提交，未修改 `manifest.md`、任何第三方仓库或其他 Skill。
- 完成条件缺口：无（实施完成，终验全部通过）。
- 当前 Skill 状态：`crawler-debug-typescript-node` **已完成**（用户验证实施结果通过后更新）。
- Git 状态：`E:\Stellaris` 仍不是 Git 仓库，未初始化 Git。

### 验证状态（Skill 13：`crawler-test-regressions`）

- 设计规格：`docs/superpowers/specs/2026-08-01-crawler-test-regressions-design.md` 已自审并通过用户批准。
- 实施计划：`docs/superpowers/plans/2026-08-01-crawler-test-regressions.md` 已自审并通过用户批准。
- Claude Code 执行验证（本 Skill 实施完成）：
  - 结构验证：7 个必需文件全部存在；cases TR=8、results TR=8。
  - 行为案例：8 PASS，0 FAIL（results.md 记录 16 次真实 Agent 运行，含 agentId 与时间戳）。
  - 占位符：0；肯定式运行/故障注入指令：0；敏感信息示例：0。
  - 诊断流程/RED-GREEN 规则/外部条件分离与发布阻断匹配规格 §5-6；证据卡分组（12 张六组）匹配 §7；输出契约匹配 §8；交接契约匹配规格 §9 与主日志 §33-36；toxiproxy §70 边界显式；`stellaris-crawler-context` 上下文包读取显式；修订保留显式。
  - 44 个计划复选步骤：44/44 已核销。
  - 未初始化 Git，未执行任何提交，未修改 `manifest.md`、任何第三方仓库或其他 Skill。
- 完成条件缺口：无（实施完成，终验全部通过）。
- 当前 Skill 状态：`crawler-test-regressions` **已完成**（用户验证实施结果通过后更新）。
- Git 状态：`E:\Stellaris` 仍不是 Git 仓库，未初始化 Git。

### 验证状态（Skill 12：`crawler-enforce-security`）

- 设计规格：`docs/superpowers/specs/2026-08-01-crawler-enforce-security-design.md` 已自审并通过用户批准。
- 实施计划：`docs/superpowers/plans/2026-08-01-crawler-enforce-security.md` 已自审并通过用户批准。
- Claude Code 执行验证（本 Skill 实施完成）：
  - 结构验证：7 个必需文件全部存在；cases EC=8、results EC=8。
  - 行为案例：8 PASS，0 FAIL（results.md 记录 16 次真实 Agent 运行，含 agentId 与时间戳）。
  - 占位符：0；肯定式运行/攻击指令：0；敏感信息示例：0。
  - 诊断流程/动作判定规则/问题分类规则匹配规格 §5-6；证据卡分组（12 张五组）匹配 §7；输出契约匹配 §8；交接契约匹配规格 §9 与主日志 §33-36；`stellaris-crawler-context` 上下文包读取显式；修订保留显式。
  - 44 个计划复选步骤：44/44 已核销。
  - 未初始化 Git，未执行任何提交，未修改 `manifest.md`、任何第三方仓库或其他 Skill。
- 完成条件缺口：无（实施完成，终验全部通过）。
- 当前 Skill 状态：`crawler-enforce-security` **已完成**（用户验证实施结果通过后更新）。
- Git 状态：`E:\Stellaris` 仍不是 Git 仓库，未初始化 Git。

### 验证状态（Skill 11：`crawler-observe-runtime`）

- 设计规格：`docs/superpowers/specs/2026-08-01-crawler-observe-runtime-design.md` 已自审并通过用户批准。
- 实施计划：`docs/superpowers/plans/2026-08-01-crawler-observe-runtime.md` 已自审并通过用户批准。
- Claude Code 执行验证（本 Skill 实施完成）：
  - 结构验证：7 个必需文件全部存在；cases OR=8、results OR=8。
  - 行为案例：8 PASS，0 FAIL（results.md 记录 16 次真实 Agent 运行，含 agentId 与时间戳）。
  - 占位符：0；肯定式运行指令：0；敏感信息示例：0。
  - 诊断流程/问题分类规则/观测与根因边界匹配规格 §5-6；证据卡分组（13 张五组）匹配 §7；输出契约匹配 §8；交接契约匹配规格 §9 与主日志 §33-36；`stellaris-crawler-context` 上下文包读取显式；修订保留显式。
  - 44 个计划复选步骤：44/44 已核销。
  - 未初始化 Git，未执行任何提交，未修改 `manifest.md`、任何第三方仓库或其他 Skill。
- 完成条件缺口：无（实施完成，终验全部通过）。
- 当前 Skill 状态：`crawler-observe-runtime` **已完成**（用户验证实施结果通过后更新）。
- Git 状态：`E:\Stellaris` 仍不是 Git 仓库，未初始化 Git。

### 下一步

- 用户审阅批准 `crawler-run-docker`（Skill 17）独立实施计划 `docs/superpowers/plans/2026-08-01-crawler-run-docker.md`。
- 计划获批后按逐 Skill 流程更新为"计划已批准"→"Claude Code 执行中"，由 Claude Code 实施该 Skill；实施与新鲜验证完成后更新为"待验证"，等待用户/独立 reviewer 验证。

### 验证状态（Skill 9：`crawler-tune-queues`）

- 设计规格：`docs/superpowers/specs/2026-08-01-crawler-tune-queues-design.md` 已自审并通过用户批准。
- 实施计划：`docs/superpowers/plans/2026-08-01-crawler-tune-queues.md` 已自审并通过用户批准。
- Claude Code 执行验证（本 Skill 实施完成）：
  - 结构验证：7 个必需文件全部存在；cases TQ=8、results TQ=8。
  - 行为案例：8 PASS，0 FAIL（results.md 记录 16 次真实 Agent 运行，含 agentId 与时间戳）。
  - 占位符：0；肯定式运行指令：0；敏感信息示例：0。
  - 诊断流程/问题分类规则/跨任务问题重点匹配规格 §5-6；证据卡分组（13 张五组）匹配 §7；输出契约匹配 §8；交接契约匹配规格 §9 与主日志 §33-36；`stellaris-crawler-context` 上下文包读取显式；修订保留显式。
  - 44 个计划复选步骤：44/44 已核销。
  - 未初始化 Git，未执行任何提交，未修改 `manifest.md`、任何第三方仓库或其他 Skill。
- 完成条件缺口：无（实施完成，用户已验证通过，状态更新为"已完成"）。
- 当前 Skill 状态：`crawler-tune-queues` **已完成**（用户验证实施结果通过后更新）。
- Git 状态：`E:\Stellaris` 仍不是 Git 仓库，未初始化 Git。

### 验证状态（Skill 8：`crawler-validate-extraction`）

- 设计规格：`docs/superpowers/specs/2026-08-01-crawler-validate-extraction-design.md` 已自审并通过用户批准。
- 实施计划：`docs/superpowers/plans/2026-08-01-crawler-validate-extraction.md` 已自审并通过用户批准。
- Claude Code 执行验证（本 Skill 实施完成）：
  - 结构验证：7 个必需文件全部存在；cases VE=8、results VE=8。
  - 行为案例：8 PASS，0 FAIL（results.md 记录 16 次真实 Agent 运行，含 agentId 与时间戳）。
  - 占位符：0；肯定式运行指令：0；敏感信息示例：0。
  - 诊断流程/问题分类规则/隐蔽数据错误重点匹配规格 §5-6；证据卡分组（13 张五组）匹配 §7；输出契约匹配 §8；交接契约匹配规格 §9 与主日志 §33-36；`stellaris-crawler-context` 上下文包读取显式；修订保留显式。
  - 44 个计划复选步骤：44/44 已核销。
  - 未初始化 Git，未执行任何提交，未修改 `manifest.md`、任何第三方仓库或其他 Skill。
- 完成条件缺口：无（实施完成，用户已验证通过，状态更新为"已完成"）。
- 当前 Skill 状态：`crawler-validate-extraction` **已完成**（用户验证实施结果通过后更新）。
- Git 状态：`E:\Stellaris` 仍不是 Git 仓库，未初始化 Git。

### 验证状态（Skill 7：`crawler-automate-browsers`）

- 设计规格：`docs/superpowers/specs/2026-08-01-crawler-automate-browsers-design.md` 已自审并通过用户批准。
- 实施计划：`docs/superpowers/plans/2026-08-01-crawler-automate-browsers.md` 已自审并通过用户批准。
- Claude Code 执行验证（本 Skill 实施完成）：
  - 结构验证：7 个必需文件全部存在；cases AB=8、results AB=8。
  - 行为案例：8 PASS，0 FAIL（results.md 记录 16 次真实 Agent 运行，含 agentId 与时间戳）。
  - 占位符：0；肯定式运行指令：0；敏感信息示例：0。
  - 诊断流程/问题分类规则/证据卡映射匹配规格 §5-6；等待条件纪律（禁固定长等待/networkidle 通用化）显式；证据卡分组（13 张五组）匹配 §7；输出契约匹配 §8；交接契约匹配规格 §9 与主日志 §33-36；`stellaris-crawler-context` 上下文包读取显式；修订保留显式。
  - 43 个计划复选步骤：43/43 已核销。
  - 未初始化 Git，未执行任何提交，未修改 `manifest.md`、任何第三方仓库或其他 Skill。
- 完成条件缺口：无（实施完成，用户已验证通过，状态更新为"已完成"）。
- 当前 Skill 状态：`crawler-automate-browsers` **已完成**（用户验证实施结果通过后更新）。
- Git 状态：`E:\Stellaris` 仍不是 Git 仓库，未初始化 Git。

### 验证状态（Skill 6：`crawler-debug-http-network`）

- 设计规格：`docs/superpowers/specs/2026-08-01-crawler-debug-http-network-design.md` 已自审并通过用户批准。
- 实施计划：`docs/superpowers/plans/2026-08-01-crawler-debug-http-network.md` 已自审并通过用户批准。
- Claude Code 执行验证（本 Skill 实施完成）：
  - 结构验证：7 个必需文件全部存在；cases HN=8、results HN=8。
  - 行为案例：8 PASS，0 FAIL（results.md 记录 16 次真实 Agent 运行，含 agentId 与时间戳）。
  - 占位符：0；肯定式运行指令：0；敏感信息示例：0。
  - 诊断流程/问题分类规则/证据卡映射匹配规格 §5-6；证据卡分组（15 张五组）匹配 §7；输出契约匹配 §8；交接契约匹配规格 §9 与主日志 §33-36（含代理凭据脱敏）；`stellaris-crawler-context` 上下文包读取显式；修订保留显式。
  - 43 个计划复选步骤：43/43 已核销。
  - 未初始化 Git，未执行任何提交，未修改 `manifest.md`、任何第三方仓库或其他 Skill。
- 完成条件缺口：无（实施完成，用户已验证通过，状态更新为"已完成"）。
- 当前 Skill 状态：`crawler-debug-http-network` **已完成**（用户验证实施结果通过后更新）。
- Git 状态：`E:\Stellaris` 仍不是 Git 仓库，未初始化 Git。

### 验证状态（Skill 5：`crawler-discover-frontier`）

- 设计规格：`docs/superpowers/specs/2026-08-01-crawler-discover-frontier-design.md` 已自审并通过用户批准。
- 实施计划：`docs/superpowers/plans/2026-08-01-crawler-discover-frontier.md` 已自审并通过用户批准。
- Claude Code 执行验证（本 Skill 实施完成）：
  - 结构验证：7 个必需文件全部存在；cases DF=8、results DF=8。
  - 行为案例：8 PASS，0 FAIL（results.md 记录 16 次真实 Agent 运行，含 agentId 与时间戳）。
  - 占位符：0；肯定式运行指令：0；敏感信息示例：0。
  - 诊断流程/问题分类规则/证据卡映射匹配规格 §5-6；证据卡分组（15 张六组）匹配 §7；输出契约匹配 §8；交接契约匹配规格 §9 与主日志 §33-36；`stellaris-crawler-context` 上下文包读取显式；修订保留显式。
  - 44 个计划复选步骤：44/44 已核销。
  - 未初始化 Git，未执行任何提交，未修改 `manifest.md`、任何第三方仓库或其他 Skill。
- 完成条件缺口：无（实施完成，用户已验证通过，状态更新为"已完成"）。
- 当前 Skill 状态：`crawler-discover-frontier` **已完成**（用户验证实施结果通过后更新）。
- Git 状态：`E:\Stellaris` 仍不是 Git 仓库，未初始化 Git。

### 验证状态（Skill 4：`crawler-review-architecture`）

- 设计规格：`docs/superpowers/specs/2026-08-01-crawler-review-architecture-design.md` 已自审并通过用户批准。
- 实施计划：`docs/superpowers/plans/2026-08-01-crawler-review-architecture.md` 已自审并通过用户批准。
- Claude Code 执行验证（本 Skill 实施完成）：
  - 结构验证：5 个必需文件全部存在；cases RA=8、results RA=8。
  - 行为案例：8 PASS，0 FAIL（results.md 记录 16 次真实 Agent 运行，含 agentId 与时间戳）。
  - 占位符：0；肯定式运行指令：0；敏感信息示例：0。
  - 评审流程与六维比较规则匹配规格 §5-6；等待批准门匹配 §7；输出契约匹配 §8；交接契约匹配规格 §9 与主日志 §33-36；`stellaris-crawler-context` 上下文包读取显式；修订保留显式。
  - 31 个计划复选步骤：31/31 已核销。
  - 未初始化 Git，未执行任何提交，未修改 `manifest.md`、任何第三方仓库或其他 Skill。
- **新鲜验证通过（2026-08-01T11:23:03+08:00，Claude Code 续接会话，亲自运行）**：
  - 结构验证：5 个必需文件全部存在（SKILL.md、review-workflow.md、output-contract.md、cases.md、results.md）；cases `^## RA-`=8、results `^## RA-`=8，各唯一。
  - 行为结果：16 次真实 Agent 运行（8 baseline＋8 skill，各含 agentId 与时间戳）；8 PASS、0 FAIL。
  - 计划复选项：31/31 已勾选、0 未勾选。
  - 扫描：占位符 0；无肯定式运行指令（仅门禁 7 负面安全声明）；无敏感信息示例（仅脱敏规则文本）。
  - 边界：`git -C E:\Stellaris rev-parse` 失败（退出码 128，非 Git 仓库，未初始化）；E 盘可用 239.44 GiB（> 120 GB）；第三方资料库 3,176,270,620 bytes ≈ 2.96 GiB（< 50 GB 软上限）。
- 完成条件缺口：无（全部验证项通过）。
- 当前 Skill 状态：`crawler-review-architecture` **已完成**（新鲜验证通过后更新）。
- Git 状态：`E:\Stellaris` 仍不是 Git 仓库，未初始化 Git。

### 验证状态（Skill 1：`crawler-curate-sources`）

- 统一规格：已自审并通过用户批准。
- 当前 Skill 计划：已写入、自审并通过用户批准。
- Claude Code 执行验证（本 Skill 已完成）：
  - 结构契约：`PASS crawler-curate-sources contract`，退出码 0（本会话新鲜运行）。
  - 行为案例：8 PASS，0 FAIL（results.md 记录 16 次真实 Agent 运行，含 agentId 与时间戳）。
  - 证据卡：11 张唯一；视图引用 11/11；cases 8/8。
  - 占位符：0；肯定式运行指令：0。
  - 固定来源：5 个 ref＋Commit 与 `manifest.md` 一致；Codeberg 权威 origin 保留。
  - 34 个计划复选步骤：34/34 已核销。
  - 未初始化 Git，未执行任何提交，未修改第三方仓库。
- Codex 独立验证：
  - 新鲜运行结构校验器：`PASS crawler-curate-sources contract`，退出码 0。
  - 证据卡：11/11 唯一、必需字段完整、本地证据路径存在、知识视图引用 11/11。
  - 行为案例定义：8/8 唯一，每个案例均含 Input／Expected classification／Required evidence／Forbidden behavior／Pass criteria。
  - 五个固定仓库：manifest、HEAD、浅克隆、权威 origin、洁净状态全部通过；E 盘可用空间 239.62 GiB。
  - 占位符：0；项目根目录仍不是 Git worktree。
- Claude Code 本会话验证（D1 补证后）：
  - 契约校验器：`PASS crawler-curate-sources contract`，退出码 0。
  - 16 次真实 Agent 行为运行：8 baseline＋8 Skill-assisted，全部记录运行标识与时间戳；8 PASS、0 FAIL。
  - 34 个计划复选项：34/34 核销。
  - 5 个固定仓库 HEAD 一致、浅克隆、权威 origin、洁净状态全部通过（ScanCode 文件名过长为路径假象，`git status` 判 clean）。
  - E 盘可用 240 GB（> 120 GB）；第三方资料库 3.38 GB（< 50 GB 软上限）。
  - 占位符 0；无肯定式第三方运行指令；项目根目录仍非 Git worktree；manifest 与第三方仓库未修改。
- 完成条件缺口：已全部补齐（34 复选项核销＋真实 Agent 行为运行证据）；独立 reviewer 复核通过。
- Claude Code 规划转交文档验证：
  - 必读路径 10/10；
  - 两道门、16 次 Agent 运行、34 个复选项、独立 reviewer、Skill 2 brainstorming／规格／writing-plans 用户门及停止条件 24/24；
  - 占位符 0，代码围栏配对；
  - 获批 Skill 1 计划 SHA-256：`D1134BB030A80323E35DE007BEF251743A9C2CE5895B0E8C37FC54153D900FEE`；
  - 规划转交文档 SHA-256：`00E125FB994DEE2A50DA0F72C234CDBA36C2FD5101E7E7E61DF159785A2E089A`。
- **独立 reviewer 验收（2026-07-31T17:25:52+08:00，agentId `ad762e2d17aa5174a`，全新只读隔离上下文）**：
  - 亲自完整读取 11 个必读文件，亲自运行全部 11 项结构校验与完成条件抽查，未修改任何文件、未运行任何第三方程序。
  - 结论：**ALL PASS，0 FAIL**。契约校验器 `PASS crawler-curate-sources contract`、退出码 0；34/34 复选项核销；8/8 行为案例（16 条含 agentId 与时间戳、无推测性表述）；11/11 证据卡唯一且被引用；7 个本地证据路径存在；5 个固定仓库 HEAD／浅克隆／权威 origin／洁净全部一致（scancode-toolkit 以 `core.longpaths=true` 判 clean）；占位符 0；无肯定式第三方运行指令；E 盘可用 240 GB；非 Git 仓库且未初始化。
  - 唯一观察项（非 FAIL）：计划 Task 6 文案要求"待验证"，总账在 reviewer 通过前保持"Claude Code 执行中"，流程自洽且未越权标记"已完成"，判定为合理。
- 当前 Skill 状态：`crawler-curate-sources` **已完成**（独立 reviewer 全 PASS 后更新）；`stellaris-crawler-context` 已更新为"规划中"。
- Git 状态：`E:\Stellaris` 仍不是 Git 仓库，未初始化 Git。

### 验证状态（Skill 2：`stellaris-crawler-context`）

- 设计规格：`docs/superpowers/specs/2026-07-31-stellaris-crawler-context-design.md` 已自审并通过用户批准。
- 实施计划：`docs/superpowers/plans/2026-07-31-stellaris-crawler-context.md` 已自审并通过用户批准。
- Claude Code 执行验证（本 Skill 实施完成）：
  - 结构验证：6 个必需文件全部存在；cases SC=8、results SC=8。
  - 行为案例：8 PASS，0 FAIL（results.md 记录 16 次真实 Agent 运行，含 agentId 与时间戳）。
  - 占位符：0；肯定式运行指令：0；敏感信息示例：0。
  - 五类字段契约与模板匹配规格 §6-7；交接契约匹配规格 §8；主交接 `crawler-triage-incidents` 显式；修订保留显式。
  - 31 个计划复选步骤：31/31 已核销。
  - 未初始化 Git，未执行任何提交，未修改 `manifest.md`、任何第三方仓库或其他 Skill。
- 完成条件缺口：无（实施完成，用户已验收，状态更新为"已完成"）。
- 当前 Skill 状态：`stellaris-crawler-context` **已完成**（用户验收实施结果后更新）。
- Git 状态：`E:\Stellaris` 仍不是 Git 仓库，未初始化 Git。

### 验证状态（Skill 3：`crawler-triage-incidents`）

- 设计规格：`docs/superpowers/specs/2026-07-31-crawler-triage-incidents-design.md` 已自审并通过用户批准。
- 实施计划：`docs/superpowers/plans/2026-07-31-crawler-triage-incidents.md` 已自审并通过用户批准。
- Claude Code 执行验证（本 Skill 实施完成）：
  - 结构验证：5 个必需文件全部存在；cases TC=8、results TC=8。
  - 行为案例：8 PASS，0 FAIL（results.md 记录 16 次真实 Agent 运行，含 agentId 与时间戳）。
  - 占位符：0；肯定式运行指令：0；敏感信息示例：0。
  - 分层最小证据清单（8 类故障类型）与置信度规则匹配规格 §5-7；输出契约匹配 §8；交接契约匹配规格 §9 与主日志 §33-36；`stellaris-crawler-context` 上下文包读取显式；修订保留显式。
  - 30 个计划复选步骤：30/30 已核销。
  - 未初始化 Git，未执行任何提交，未修改 `manifest.md`、任何第三方仓库或其他 Skill。
- 完成条件缺口：无（实施完成，用户已验证通过，状态更新为"已完成"）。
- 当前 Skill 状态：`crawler-triage-incidents` **已完成**（用户验证实施结果通过后更新）。
- Git 状态：`E:\Stellaris` 仍不是 Git 仓库，未初始化 Git。
