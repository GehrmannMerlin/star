# crawler-debug-typescript-node 知识视图

> 本视图是 `crawler-debug-typescript-node` Skill 的独立知识视图，只保留与"TypeScript 与 Node.js 实现诊断、修复顾问"职责相关的知识。来源身份、版本与许可证事实由共享证据层统一维护，本视图通过稳定证据卡 ID 引用，不复制原始来源元数据。

## 定位、触发与排除项

- **定位**：面向 Agent 的 TypeScript 与 Node.js 实现诊断、修复顾问；依托项目锁定版本对应的官方资料、技术指南、故障案例和合规源码，帮助 Agent 检查 `package.json`、锁文件、`tsconfig`、构建配置、项目代码、错误日志和运行时证据，发现类型系统、ESM 与 CommonJS、异步控制、Stream、进程、错误处理、内存、构建和依赖兼容问题。
- **不是**：项目测试体系或构建系统的替代品。
- **触发**：用户要求检查 TypeScript 与 Node.js 实现相关设计或故障；已确认问题涉及类型系统、ESM/CommonJS、异步控制、Stream、进程、错误处理、内存、构建或依赖兼容。
- **排除**：不重复 URL/HTTP/浏览器/队列等跨框架通用方法论（交给对应领域 Skill）；Docker→`crawler-run-docker`；不越过批准边界/不跳过 `crawler-writing-plans-bridge`；不生成 `writing-plans`。

## 最低证据输入

- 项目上下文（处理 Stellaris 问题时为 `stellaris-crawler-context` 项目上下文包路径）。
- 已确认根因与方向（`crawler-triage-incidents` 分诊结论，适用时）。
- 相关 `package.json`、锁文件、`tsconfig`、构建配置、项目代码、错误日志、运行时证据。
- 固定版本资料（批次 5：TypeScript v6.0.3、node v24.18.0 LTS）。

## 知识主题与证据卡映射

### 类型系统与 tsconfig

- 判断类型检查、解析/扫描、tsconfig 选项是否符合锁定版本行为；类型误用、`any` 掩盖、strict 配置不当是常见问题。
- 证据卡：[[TN-TYPE-001]]（类型检查语义）、[[TN-TYPE-002]]（解析与扫描语义）、[[TN-TYPE-003]]（tsconfig 选项与 strict 模式）。
- 依据固定版本：TypeScript `src/compiler/checker.ts`、`parser.ts`、`scanner.ts`；`package.json`。

### 模块系统 ESM·CommonJS

- 判断 ESM/CJS 语义、模块解析是否符合锁定版本行为；模块加载错误、ESM/CJS 互操作错误、路径解析失败是常见问题。
- 证据卡：[[TN-MOD-001]]（ESM 语义）、[[TN-MOD-002]]（CommonJS 语义）、[[TN-MOD-003]]（模块解析）。
- 依据固定版本：node `lib/module.js`、`doc/api/esm.md`、`doc/api/modules.md`；TypeScript `src/compiler/moduleNameResolver.ts`。

### 异步控制

- 判断事件发射器、事件循环顺序是否符合锁定版本行为；异步竞态、事件监听误用是常见问题。
- 证据卡：[[TN-ASYNC-001]]（事件发射器语义）、[[TN-ASYNC-002]]（异步与事件循环顺序）。
- 依据固定版本：node `lib/events.js`、`doc/api/events.md`。

### Stream 与内存

- 判断可读流、可写流/背压、Buffer/内存是否符合锁定版本行为；背压未处理、内存攀升、Buffer 误用是常见问题。
- 证据卡：[[TN-STREAM-001]]（可读流语义）、[[TN-STREAM-002]]（可写流与背压）、[[TN-STREAM-003]]（Buffer 与内存处理）。
- 依据固定版本：node `lib/_stream_readable.js`、`_stream_writable.js`、`doc/api/stream.md`、`doc/api/buffer.md`。

### 进程/错误处理/构建

- 判断进程/子进程、构建/发射是否符合锁定版本行为；子进程错误、未捕获异常、构建失败是常见问题。
- 证据卡：[[TN-PROC-001]]（进程与子进程语义）、[[TN-BUILD-001]]（构建与发射语义）。
- 依据固定版本：node `lib/child_process.js`、`doc/api/process.md`、`doc/api/errors.md`；TypeScript `src/compiler/emitter.ts`、`program.ts`。

## 实现转换规则

- 将领域 Skill 已确认的修复方向转换为适合当前 TypeScript 与 Node.js 版本的具体实现建议。
- 引用锁定版本（TypeScript v6.0.3、node v24.18.0 LTS）的 API 与语言用法；不默认采用最新 Release 或历史草案版本。
- 识别"编译通过但运行行为错误"是验收重点——编译通过不等于运行正确。

## 版本化判断规则

- 每条判断依据必须追溯到固定版本资料（ref＋Commit）、证据卡、上下文包条目或决策日志节号；只给仓库首页或没有版本的引用不满足要求。
- 明确区分事实、证据、综合推断与未知项；综合推断必须显式标记"推断"，不得伪装成资料中的确定结论。
- 不得因新技术更新默认要求升级；是否升级以证据和项目约束为准。
- 案例证据与工程证据不得单独升格为跨项目通用规范或确定根因。

## 输出、交接与禁止越权

- **输出**：可追溯问题证据、根因或待验证假设、影响范围、修复方向（TS/Node 实现建议）、测试建议。
- **交接**：将领域确认方向转换为 TS/Node 实现建议，不越过批准边界/不跳过 `crawler-writing-plans-bridge`；获准修复方向→`crawler-writing-plans-bridge`；Docker→`crawler-run-docker`；跨框架方法论→对应领域 Skill。
- **禁止越权**：不重复跨框架方法论、不把编译通过误判为运行正确、不生成 `writing-plans`、不初始化 Git、不记录敏感信息原件。

## 视图自检

- 全部证据卡 ID（TN-TYPE-*、TN-MOD-*、TN-ASYNC-*、TN-STREAM-*、TN-PROC-*、TN-BUILD-*）在 `typescript-node.md` 中存在且被本视图引用。
- 无未标注的推断；每条判断可追溯到证据卡或固定资料。
- 未复制相邻 Skill（`crawler-debug-http-network`、`crawler-tune-queues`、`crawler-run-docker`）的职责。
