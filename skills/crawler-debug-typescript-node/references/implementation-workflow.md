# `crawler-debug-typescript-node` 诊断流程与实现转换规则

> 本文件定义本 Skill 的诊断流程、问题分类规则、实现转换规则与证据卡映射。判断依据与边界以主决策日志与已批准设计规格为准。

## 诊断流程

1. 读取项目上下文、目标、约束与已确认根因。处理 Stellaris 问题时，先读取 `stellaris-crawler-context` 生成的项目上下文包路径。
2. 确定诊断聚焦点（类型系统与 `tsconfig` / 模块系统 ESM·CommonJS / 异步控制 / Stream 与内存 / 进程与错误处理 / 构建与依赖兼容），聚焦该点，不做无边界全栈诊断。
3. 检查相关 `package.json`、锁文件、`tsconfig`、构建配置、项目代码、错误日志、运行时证据，定位具体证据位置。
4. 引用匹配版本的证据卡（`typescript-node.md`）比对项目行为与规范/实现/工程证据。
5. 分类：代码缺陷 / 配置错误 / 版本兼容 / 设计不足 / 外部条件 / 未知项。
6. 证据不足时只提出最小补充取证（最小编译、测试、性能分析、内存诊断）；根因未证实前不提出代码修改。
7. 将领域 Skill 已确认的修复方向转换为适合当前 TypeScript 与 Node.js 版本的具体实现建议。
8. 输出可追溯问题证据、根因或待验证假设、影响范围、修复方向、测试建议。
9. 获准的修复方向交给 `crawler-writing-plans-bridge`。

## 问题分类规则

- **代码缺陷**：TypeScript/Node.js 代码未按锁定版本行为处理（如类型误用、模块加载错误、异步竞态、Stream 未正确背压）。
- **配置错误**：`tsconfig`、`package.json`、构建配置与锁定版本行为不符。
- **版本兼容**：依赖版本与 API 行为不匹配（如 Node 24 API 与旧依赖不兼容）。
- **设计不足**：缺乏类型安全、模块隔离、错误处理、内存管理等设计层面缺失。
- **外部条件**：运行时环境不可用、依赖服务受限等——只能给合规降级/等待/终止结论，不得伪装成已修复（主决策日志 §12/§59）。
- **未知项**：证据不足或冲突，保持候选假设，显式标记，不判定为确定根因。

每条结论必须明确区分：事实、证据、综合推断、待确认项。综合推断必须显式标记为"推断"，不得伪装成资料中的确定结论（主决策日志 §14）。

置信度使用固定枚举：高（证据充分且指向唯一分类）、中（证据充分但多个分类可能）、低（证据不足或冲突，仅候选假设）、不确定（无法判断）。

## 实现转换规则

- 将领域 Skill 已确认的修复方向转换为适合当前 TypeScript 与 Node.js 版本的具体实现建议。
- 引用锁定版本（TypeScript v6.0.3、node v24.18.0 LTS）的 API 与语言用法；不默认采用审查时最新 Release 或历史草案版本（主决策日志 §71/§75）。
- 识别"编译通过但运行行为错误"是验收重点——编译通过不等于运行正确；`any` 掩盖、异步竞态、Stream 背压误用等需运行时证据判定。
- 不重复 URL/HTTP/浏览器/队列等跨框架通用方法论；相关方向交给对应领域 Skill。

## 证据卡映射

共享证据卡：`docs/superpowers/knowledge/evidence-cards/typescript-node.md`；知识视图：`docs/superpowers/knowledge/skill-views/crawler-debug-typescript-node.md`。

| 诊断聚焦点 | 证据卡 | 固定资料路径 |
|---|---|---|
| 类型系统与 `tsconfig` | TN-TYPE-001、TN-TYPE-002、TN-TYPE-003 | TypeScript `src/compiler/checker.ts`、`parser.ts`、`scanner.ts`；`package.json` |
| 模块系统 ESM·CommonJS | TN-MOD-001、TN-MOD-002、TN-MOD-003 | node `lib/module.js`、`doc/api/esm.md`、`doc/api/modules.md`；TypeScript `src/compiler/moduleNameResolver.ts` |
| 异步控制 | TN-ASYNC-001、TN-ASYNC-002 | node `lib/events.js`、`doc/api/events.md` |
| Stream 与内存 | TN-STREAM-001、TN-STREAM-002、TN-STREAM-003 | node `lib/_stream_readable.js`、`_stream_writable.js`、`doc/api/stream.md`、`doc/api/buffer.md` |
| 进程/错误处理/构建 | TN-PROC-001、TN-BUILD-001 | node `lib/child_process.js`、`doc/api/process.md`、`doc/api/errors.md`；TypeScript `src/compiler/emitter.ts`、`program.ts` |

每条依据必须可追溯：从诊断记录追到固定版本资料、证据卡、上下文包条目或决策日志节号。只给仓库首页、模糊文件夹或没有版本的引用不满足要求。

## 只读诊断边界

- 诊断默认只指导只读静态审查、配置审查和锁定版本资料比对。
- 任何最小编译、测试、性能分析或内存诊断动作须获得明确批准。
- 不安装、构建或运行未经批准的项目或第三方代码。
- 不攻击外部网站、不绕过访问控制、不发起对目标站点的无授权请求。
- 诊断复现限受控、合规；不得发起新的对外抓取或绕过访问控制。

## 证据不足与冲突

- 证据不足时不得把结论判定为确定根因；保留候选状态并标记未知项。
- 现场证据、项目上下文、已批准要求冲突时并列报告，不静默覆盖任一来源。
- 未解决的声明标记为不确定（非确定性），不得伪装成确定结论。
- 固定版本证据卡与既有诊断记录不得被静默改写；更新只通过新增修订进行。
- 不把编译通过误判为运行正确；"编译通过但运行行为错误"需运行时证据判定。
- 外部条件（运行时环境不可用/依赖服务受限）只能给合规降级/等待/终止结论，不得伪装成已修复。
- 不得因新技术更新默认要求升级；是否升级以证据和项目约束为准。
