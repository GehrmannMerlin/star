# crawler-debug-typescript-node Skill 设计规格

日期：2026-08-02  
状态：书面规格待用户审阅  
适用范围：第 14 个独立 Agent Skill `crawler-debug-typescript-node` 的完整设计

## 1. 目标与边界

`crawler-debug-typescript-node` 是爬虫知识资料库当前重点技术栈方向下的 Agent TypeScript 与 Node.js 实现诊断、修复顾问。其职责是：依托项目锁定版本对应的官方资料、技术指南、故障案例和合规源码，帮助 Agent 检查 `package.json`、锁文件、`tsconfig`、构建配置、项目代码、错误日志和运行时证据，发现类型系统、ESM 与 CommonJS、异步控制、Stream、进程、错误处理、内存、构建和依赖兼容问题。它将领域 Skill 已经确认的修复方向转换为适合当前 TypeScript 与 Node.js 版本的具体实现建议。

本 Skill **不是**项目测试体系或构建系统的替代品。它不重复 URL、HTTP、浏览器、队列等跨框架通用方法论，只解决相关方向在 TypeScript 与 Node.js 中如何正确实现。

本设计只规划 `crawler-debug-typescript-node`，不包含第 15 个及后续 Skill 的实施任务；不创建或实施本 Skill 本身（实施由 Claude Code 按后续写作计划执行）。

## 2. 已确认输入

- 主决策日志：`docs/superpowers/brainstorming/2026-07-31-crawler-knowledge-skills-decision-log.md`（已确认决策的最高权威；§59/§51/§26.1）。
- 统一知识设计规格：`docs/superpowers/specs/2026-07-31-crawler-knowledge-skills-knowledge-design.md`（公共知识契约）。
- 固定源码清单：`third-party/crawler-knowledge-sources/manifest.md`。
- 处理 Stellaris 问题时：`stellaris-crawler-context` 生成的项目上下文包路径。
- 已确认根因与方向（`crawler-triage-incidents` 分诊结论，适用时）。
- 相关 `package.json`、锁文件、`tsconfig`、构建配置、项目代码、错误日志、运行时证据（现场只读核验）。

## 3. 职责与排除项

### 3.1 职责

- 检查项目中的 TypeScript 与 Node.js 实现相关问题：
  - 类型系统、`tsconfig`、模块类型解析；
  - ESM 与 CommonJS、模块加载；
  - 异步控制、事件循环、竞态；
  - Stream、进程、错误处理；
  - 内存、构建和依赖兼容。
- 识别"编译通过但运行行为错误"的缺陷。
- 将领域 Skill 已确认的修复方向转换为适合当前 TypeScript 与 Node.js 版本的具体实现建议。
- 输出可追溯问题证据、根因或待验证假设、影响范围、修复方向（TS/Node 实现建议）、测试建议。

### 3.2 排除项

- 不重复 URL、HTTP、浏览器、队列等跨框架通用方法论（交给对应领域 Skill）。
- 不越过用户批准边界或跳过 `crawler-writing-plans-bridge`。
- 不把编译通过误判为运行正确。
- Docker 具体问题交给 `crawler-run-docker`。
- 不生成 `writing-plans`、不提出未经批准的代码修改。
- 不安装、构建或运行未经批准的项目或第三方代码。
- 不修改爬虫代码、`manifest.md`、第三方仓库；不初始化 Git。
- 不把密钥、Cookie、认证请求头、代理凭据、环境变量中的秘密写入诊断记录，落盘前脱敏。

## 4. 触发条件与输入

### 4.1 触发

用户要求检查 TypeScript 与 Node.js 实现相关设计或故障，或已经确认的问题涉及类型系统、ESM/CommonJS、异步控制、Stream、进程、错误处理、内存、构建或依赖兼容时触发（主决策日志 §59）。通常由 `crawler-triage-incidents` 分诊路由进入（已确认根因后），或用户直接要求 TS/Node 实现诊断。

### 4.2 最低输入

- 项目上下文（处理 Stellaris 问题时为 `stellaris-crawler-context` 项目上下文包路径）。
- 已确认根因与方向（`crawler-triage-incidents` 分诊结论，适用时）。
- 相关 `package.json`、锁文件、`tsconfig`、构建配置、项目代码、错误日志、运行时证据。
- 固定版本资料（批次 5：microsoft/TypeScript、nodejs/node）。

## 5. 诊断流程

1. 读取项目上下文（Stellaris 问题先读 `stellaris-crawler-context` 项目上下文包）、目标、约束与已确认根因。
2. 确定诊断聚焦点：类型系统与 `tsconfig` / 模块系统 ESM·CommonJS / 异步控制 / Stream 与内存 / 进程与错误处理 / 构建与依赖兼容。
3. 检查相关 `package.json`、锁文件、`tsconfig`、构建配置、项目代码、错误日志、运行时证据，定位具体证据位置。
4. 引用匹配版本的证据卡（`typescript-node.md`）比对项目行为与规范/实现/工程证据。
5. 分类：代码缺陷 / 配置错误 / 版本兼容 / 设计不足 / 外部条件 / 未知项。
6. 证据不足时只提出最小补充取证（最小编译、测试、性能分析、内存诊断）；根因未证实前不提出代码修改。
7. 将领域 Skill 已确认的修复方向转换为适合当前 TypeScript 与 Node.js 版本的具体实现建议。
8. 输出可追溯问题证据、根因或待验证假设、影响范围、修复方向、测试建议。
9. 获准的修复方向交给 `crawler-writing-plans-bridge`。

## 6. 问题分类规则

- **代码缺陷**：TypeScript/Node.js 代码未按锁定版本行为处理（如类型误用、模块加载错误、异步竞态、Stream 未正确背压）。
- **配置错误**：`tsconfig`、`package.json`、构建配置与锁定版本行为不符。
- **版本兼容**：依赖版本与 API 行为不匹配（如 Node 24 API 与旧依赖不兼容）。
- **设计不足**：缺乏类型安全、模块隔离、错误处理、内存管理等设计层面缺失。
- **外部条件**：运行时环境不可用、依赖服务受限等——只能给合规降级/等待/终止结论，不得伪装成已修复（主决策日志 §12/§59）。
- **未知项**：证据不足或冲突，保持候选假设，显式标记，不判定为确定根因。

每条结论必须明确区分：事实、证据、综合推断、待确认项。综合推断必须显式标记为"推断"，不得伪装成资料中的确定结论（主决策日志 §14）。

置信度使用固定枚举：高（证据充分且指向唯一分类）、中（证据充分但多个分类可能）、低（证据不足或冲突，仅候选假设）、不确定（无法判断）。

**实现转换规则**：将领域 Skill 已确认方向转换为 TS/Node 实现建议时，必须引用锁定版本（TypeScript v6.0.3、node v24.18.0 LTS）的 API 与语言用法；不得默认采用审查时最新 Release 或历史草案版本（主决策日志 §71/§75）。识别"编译通过但运行行为错误"是验收重点。

## 7. 证据卡主题分组

共享证据卡 `docs/superpowers/knowledge/evidence-cards/typescript-node.md` 从批次 5 固定资料筛选，按以下主题分组（实施时按实际固定资料筛选具体卡片）：

1. **类型系统与 `tsconfig`**：TypeScript `src/compiler/checker.ts`、`parser.ts`、`scanner.ts`；`tsconfig` 相关文档。
2. **模块系统 ESM·CommonJS**：node `lib/module.js`、`doc/api/esm.md`、`doc/api/modules.md`；TypeScript 模块解析。
3. **异步控制**：node `lib/events.js`、`doc/api/events.md`、事件循环文档。
4. **Stream 与内存**：node `lib/_stream_readable.js`、`_stream_writable.js`、`doc/api/stream.md`、`doc/api/buffer.md`。
5. **进程/错误处理/构建**：node `lib/child_process.js`、`doc/api/process.md`、`doc/api/errors.md`；TypeScript `src/compiler/emitter.ts`、`program.ts`。

## 8. 输出契约

诊断记录采用可落盘结构化记录＋简短人类可读摘要（主决策日志 §33 节），每条结论可追溯。固定字段：

- 问题证据（定位到的 `package.json`/锁文件/`tsconfig`/构建配置/代码/错误日志/运行时证据位置）。
- 分类（代码缺陷 / 配置错误 / 版本兼容 / 设计不足 / 外部条件 / 未知项；含置信度：高/中/低/不确定）。
- 根因或待验证假设（区分事实、证据、推断、待确认项）。
- 影响范围（受影响的模块、功能面、依赖链、构建产物）。
- 修复方向（适合当前 TS/Node 版本的具体实现建议，指向匹配版本资料）。
- 测试建议（最小编译、测试、性能分析、内存诊断方法）。
- 依据（关联证据卡 ID、固定资料路径、代码/配置/日志位置）。

记录必须明确区分：事实、证据、推断、待确认项与用户批准状态。

## 9. 交接契约

- 遵守主决策日志第 33-36 节：可落盘结构化记录＋简短人类摘要；双层存储（小型记录项目内保存、大型证据以内容哈希和相对路径引用）；敏感信息落盘前脱敏。
- 将领域 Skill 已确认的修复方向转换为 TS/Node 实现建议，但不得越过用户批准边界或跳过 `crawler-writing-plans-bridge`。
- 获准的修复方向交给 `crawler-writing-plans-bridge` 作为规划输入，不取代其规划职责。
- Docker 具体问题交给 `crawler-run-docker`；URL/HTTP/浏览器/队列等跨框架通用方法论交给对应领域 Skill。
- 诊断结论明确区分事实、证据、推断、待确认项与用户批准状态。

## 10. 文件结构

```text
skills/crawler-debug-typescript-node/
  SKILL.md                              # 精简触发＋门禁＋路由＋输出＋禁止项
  references/
    implementation-workflow.md          # 诊断流程、问题分类规则、实现转换规则、证据卡映射
    output-contract.md                  # 输出契约、交接契约、修订保留
docs/superpowers/knowledge/
  evidence-cards/
    typescript-node.md                  # 共享证据卡（从批次 5 固定资料筛选）
  skill-views/
    crawler-debug-typescript-node.md    # Skill 14 独立知识视图（引用证据卡）
tests/skills/crawler-debug-typescript-node/
  cases.md                              # 行为/安全案例（RED/GREEN 用）
  results.md                            # 红/绿行为评估记录
```

不引入 `validate.ps1`：实现诊断报告依赖动态项目证据与判断，机械结构校验价值有限，按最小充分原则（主决策日志 §107 先例）以行为案例验证为主。

## 11. 验证设计

### 11.1 结构验证

静态检查：
- Skill 包文件齐全（SKILL.md、implementation-workflow.md、output-contract.md）。
- 共享证据卡 `typescript-node.md` 与知识视图 `crawler-debug-typescript-node.md` 存在；知识视图引用证据卡。
- 诊断流程与问题分类规则、实现转换规则在 references 中明确定义。
- 无 `TBD`、`TODO`、`FIXME` 占位符。
- 无肯定式运行指令；仅有负面安全声明与诊断流程描述。
- 不含敏感信息示例（密钥、Cookie、认证头、代理凭据）。
- 非 Git 边界：项目根目录不是 Git worktree；不初始化 Git。

### 11.2 行为验证（RED/GREEN）

按 `superpowers:writing-skills` 方法运行固定行为案例，每个案例使用全新隔离的 Agent 上下文：

- 按诊断聚焦点聚焦：只诊断触发问题对应的聚焦点，不无边界扩展。
- 问题分类正确：代码缺陷 / 配置错误 / 版本兼容 / 设计不足 / 外部条件 / 未知项。
- 识别 TS/Node 缺陷：能识别类型误用、模块加载错误、异步竞态、Stream 背压错误、进程/错误处理缺陷、编译通过但运行行为错误。
- 版本准确：引用锁定版本（TypeScript v6.0.3、node v24.18.0）的 API 与语言用法。
- 不越过批准边界：不把编译通过误判为运行正确；获准前不交给 `crawler-writing-plans-bridge`。
- 证据不足不判根因：证据不足时只提出最小补充取证，不把未知项误判为已定位根因。
- 不重复跨框架方法论：不替代 URL/HTTP/浏览器/队列领域 Skill。
- 敏感信息脱敏：诊断记录不含密钥/Cookie/认证头/代理凭据/环境变量中的秘密。

### 11.3 验收标准（对应主决策日志 §59）

- 适用版本准确。
- API 和语言用法正确。
- 能识别编译通过但运行行为错误的缺陷。

达到上述标准即视为本 Skill 当前细节设计充分，不再扩展低优先级内部设计。

## 12. 阶段门

本规格经用户审阅批准后，才可调用 `superpowers:writing-plans` 生成 `crawler-debug-typescript-node` 的单 Skill 实施计划。用户未明确批准前，不进入 `writing-plans`，不实施本 Skill，不开始第 15 个 Skill。

`E:\Stellaris` 当前不是 Git 仓库。本设计只要求把文档可靠保存在本地项目中，不得为了满足提交步骤擅自初始化 Git。
