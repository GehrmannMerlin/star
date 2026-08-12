# TypeScript 与 Node.js 实现证据卡（共享证据层）

> 本文件是共享可追溯证据层中与 TypeScript/Node.js 实现诊断相关的证据卡集合。每张卡表达一条可验证知识声明，绑定固定版本资料、原始位置与适用边界。
>
> 来源：批次 5 固定源码快照（microsoft/TypeScript、nodejs/node），全部以 `third-party/crawler-knowledge-sources/manifest.md` 记录的 ref 与 Commit 为唯一版本基线。
>
> 证据等级：规范证据（官方规范/文档/Release）＞实现证据（同版本官方源码/测试）＞工程证据（官方运行指南/手册）＞案例证据（事故资料，只用于启发）。
>
> 维护规则：本文件由资料治理 Skill 按既定准入、许可证复核与版本固定流程维护；不得静默改写已固定证据卡，更新只通过新增修订进行。

## 来源身份与版本基线

| 仓库 | 权威 ref | Commit | 本地路径 |
|---|---|---|---|
| microsoft/TypeScript | `v6.0.3` | `050880ce59e30b356b686bd3144efe24f875ebc8` | `third-party/crawler-knowledge-sources/repos/batch-05-core-stack/TypeScript` |
| nodejs/node | `v24.18.0` | `20da4aeadabc5b0a01e3fcf520f91df8285c68a2` | `third-party/crawler-knowledge-sources/repos/batch-05-core-stack/node` |

---

## 类型系统与 tsconfig

### TN-TYPE-001 类型检查语义

- **知识声明**：TypeScript 编译器通过 checker（`checker.ts`）执行类型检查，验证类型兼容性、泛型约束与类型推断；类型检查失败会产生编译诊断。
- **证据类型/等级**：实现证据（同版本官方源码）。
- **来源身份**：microsoft/TypeScript（`v6.0.3`）。
- **版本/ref/Commit**：`v6.0.3`；`050880ce59e30b356b686bd3144efe24f875ebc8`。
- **原始位置**：`src/compiler/checker.ts`。
- **支持说明**：checker.ts 实现类型检查核心逻辑；类型错误会在编译阶段被捕获。
- **适用条件**：诊断类型检查失败、类型误用、`any` 掩盖错误。
- **限制**：类型检查只能捕获静态类型错误；"编译通过但运行行为错误"（如 `any` 掩盖、异步竞态）仍需运行时证据。
- **关联 Skill**：crawler-debug-typescript-node。
- **状态**：有效。

### TN-TYPE-002 解析与扫描语义

- **知识声明**：TypeScript 编译器通过 scanner（`scanner.ts`）与 parser（`parser.ts`）完成词法扫描与语法解析；解析错误会阻止后续类型检查。
- **证据类型/等级**：实现证据（同版本官方源码）。
- **来源身份**：microsoft/TypeScript（`v6.0.3`）。
- **版本/ref/Commit**：`v6.0.3`；`050880ce59e30b356b686bd3144efe24f875ebc8`。
- **原始位置**：`src/compiler/scanner.ts`、`src/compiler/parser.ts`。
- **支持说明**：scanner/parser 实现词法/语法分析；语法错误会导致编译失败。
- **适用条件**：诊断语法错误、解析失败、Token 处理异常。
- **限制**：本卡描述编译器解析语义；具体语法以 TypeScript v6.0.3 为准。
- **关联 Skill**：crawler-debug-typescript-node。
- **状态**：有效。

### TN-TYPE-003 tsconfig 选项与 strict 模式

- **知识声明**：TypeScript `tsconfig` 配置编译选项（如 `strict`、`target`、`module`、`noImplicitAny`）；strict 模式开启更强类型检查，`noImplicitAny` 禁止隐式 `any`。
- **证据类型/等级**：规范证据（官方文档）＋实现证据。
- **来源身份**：microsoft/TypeScript（`v6.0.3`）。
- **版本/ref/Commit**：`v6.0.3`；`050880ce59e30b356b686bd3144efe24f875ebc8`。
- **原始位置**：`package.json`（版本基线）；TypeScript 官方 tsconfig 文档。
- **支持说明**：tsconfig 编译选项控制类型检查强度；`strict`/`noImplicitAny` 影响类型误用是否被捕获。
- **适用条件**：诊断 `tsconfig` 配置不当导致类型错误被忽略、编译行为不符预期。
- **限制**：tsconfig 选项行为以 TypeScript v6.0.3 为准；不得用历史草案版本假设。
- **关联 Skill**：crawler-debug-typescript-node。
- **状态**：有效。

---

## 模块系统 ESM·CommonJS

### TN-MOD-001 ESM 语义

- **知识声明**：Node.js 支持 ECMAScript modules（ESM）；`esm.md` 定义 import/export 语法、Import attributes、加载语义与限制。
- **证据类型/等级**：规范证据（官方文档）。
- **来源身份**：nodejs/node（`v24.18.0`）。
- **版本/ref/Commit**：`v24.18.0`；`20da4aeadabc5b0a01e3fcf520f91df8285c68a2`。
- **原始位置**：`doc/api/esm.md`。
- **支持说明**：esm.md 定义 ESM 模块加载语义、Import attributes 等。
- **适用条件**：诊断 ESM 模块加载错误、import/export 用法、ESM/CJS 互操作。
- **限制**：ESM 语义以 Node.js v24.18.0 为准；不同版本行为可能不同。
- **关联 Skill**：crawler-debug-typescript-node。
- **状态**：有效。

### TN-MOD-002 CommonJS 语义

- **知识声明**：Node.js 通过 `lib/module.js` 与内部 CJS loader（`internal/modules/cjs/loader`）实现 CommonJS 模块加载（`module.exports`、`require`）。
- **证据类型/等级**：实现证据（同版本官方源码）。
- **来源身份**：nodejs/node（`v24.18.0`）。
- **版本/ref/Commit**：`v24.18.0`；`20da4aeadabc5b0a01e3fcf520f91df8285c68a2`。
- **原始位置**：`lib/module.js`、`doc/api/modules.md`。
- **支持说明**：module.js 使用 CJS loader；`module.exports = Module` 暴露 CommonJS 模块语义。
- **适用条件**：诊断 CommonJS 加载错误、`require`/`module.exports` 用法、ESM/CJS 互操作。
- **限制**：本卡描述 Node.js v24.18.0 的 CJS 语义。
- **关联 Skill**：crawler-debug-typescript-node。
- **状态**：有效。

### TN-MOD-003 模块解析

- **知识声明**：TypeScript `moduleNameResolver.ts` 与 Node.js 模块解析规则决定模块路径解析；解析失败会导致模块加载错误。
- **证据类型/等级**：实现证据（同版本官方源码）。
- **来源身份**：microsoft/TypeScript（`v6.0.3`）；nodejs/node（`v24.18.0`）。
- **版本/ref/Commit**：TypeScript `v6.0.3` `050880ce59e30b356b686bd3144efe24f875ebc8`；node `v24.18.0` `20da4aeadabc5b0a01e3fcf520f91df8285c68a2`。
- **原始位置**：TypeScript `src/compiler/moduleNameResolver.ts`；node `lib/module.js`、`doc/api/modules.md`。
- **支持说明**：模块解析规则决定 import/require 路径解析；解析失败产生模块加载错误。
- **适用条件**：诊断模块路径解析失败、依赖缺失、锁文件不一致。
- **限制**：模块解析行为以对应版本为准；不同模块系统（ESM/CJS）解析规则不同。
- **关联 Skill**：crawler-debug-typescript-node。
- **状态**：有效。

---

## 异步控制

### TN-ASYNC-001 事件发射器语义

- **知识声明**：Node.js EventEmitter（`events.js`）实现事件发射/监听；`on`/`once`/`emit` 语义决定事件驱动行为。
- **证据类型/等级**：实现证据（同版本官方源码）。
- **来源身份**：nodejs/node（`v24.18.0`）。
- **版本/ref/Commit**：`v24.18.0`；`20da4aeadabc5b0a01e3fcf520f91df8285c68a2`。
- **原始位置**：`lib/events.js`、`doc/api/events.md`。
- **支持说明**：events.js 实现 EventEmitter；事件监听语义影响异步行为。
- **适用条件**：诊断事件监听错误、`once`/`on` 误用、事件竞态。
- **限制**：本卡描述 Node.js v24.18.0 的事件语义。
- **关联 Skill**：crawler-debug-typescript-node。
- **状态**：有效。

### TN-ASYNC-002 异步与事件循环顺序

- **知识声明**：Node.js 事件循环决定 Promise/microtask 与 timer/macrotask 的执行顺序；异步代码（Promise、async/await、回调）的执行顺序影响并发行为。
- **证据类型/等级**：规范证据（官方文档）＋实现证据。
- **来源身份**：nodejs/node（`v24.18.0`）。
- **版本/ref/Commit**：`v24.18.0`；`20da4aeadabc5b0a01e3fcf520f91df8285c68a2`。
- **原始位置**：`doc/api/events.md`；Node.js 事件循环文档。
- **支持说明**：事件循环阶段决定微任务/宏任务执行顺序；异步竞态源于执行顺序未按预期。
- **适用条件**：诊断异步竞态、Promise/async 顺序错误、回调乱序。
- **限制**：事件循环行为以 Node.js v24.18.0 为准；"编译通过但运行行为错误"常源于此。
- **关联 Skill**：crawler-debug-typescript-node。
- **状态**：有效。

---

## Stream 与内存

### TN-STREAM-001 可读流语义

- **知识声明**：Node.js Readable stream（`_stream_readable.js`）实现可读流语义（`data`/`end` 事件、`read`/`pause`/`resume`）；未正确处理流事件会导致数据丢失或阻塞。
- **证据类型/等级**：实现证据（同版本官方源码）。
- **来源身份**：nodejs/node（`v24.18.0`）。
- **版本/ref/Commit**：`v24.18.0`；`20da4aeadabc5b0a01e3fcf520f91df8285c68a2`。
- **原始位置**：`lib/_stream_readable.js`、`doc/api/stream.md`。
- **支持说明**：_stream_readable.js 实现可读流语义；流事件处理影响数据消费。
- **适用条件**：诊断可读流数据丢失、`data`/`end` 事件误用、流阻塞。
- **限制**：本卡描述 Node.js v24.18.0 的流语义。
- **关联 Skill**：crawler-debug-typescript-node。
- **状态**：有效。

### TN-STREAM-002 可写流与背压

- **知识声明**：Node.js Writable stream（`_stream_writable.js`）实现可写流与背压（backpressure）；`write` 返回 `false` 表示需等待 `drain` 事件；未处理背压会导致内存攀升或数据丢失。
- **证据类型/等级**：实现证据（同版本官方源码）。
- **来源身份**：nodejs/node（`v24.18.0`）。
- **版本/ref/Commit**：`v24.18.0`；`20da4aeadabc5b0a01e3fcf520f91df8285c68a2`。
- **原始位置**：`lib/_stream_writable.js`、`doc/api/stream.md`。
- **支持说明**：_stream_writable.js 实现背压机制；`drain` 事件与 `write` 返回值配合控制写入节奏。
- **适用条件**：诊断 Stream 背压未处理、内存攀升、写入阻塞。
- **限制**：背压行为以 Node.js v24.18.0 为准；"编译通过但运行行为错误"常源于背压误用。
- **关联 Skill**：crawler-debug-typescript-node。
- **状态**：有效。

### TN-STREAM-003 Buffer 与内存处理

- **知识声明**：Node.js Buffer（`doc/api/buffer.md`）定义二进制数据处理语义；Buffer 分配与释放影响内存使用，未正确释放会导致内存泄漏。
- **证据类型/等级**：规范证据（官方文档）。
- **来源身份**：nodejs/node（`v24.18.0`）。
- **版本/ref/Commit**：`v24.18.0`；`20da4aeadabc5b0a01e3fcf520f91df8285c68a2`。
- **原始位置**：`doc/api/buffer.md`。
- **支持说明**：buffer.md 定义 Buffer 语义；内存处理影响资源使用。
- **适用条件**：诊断 Buffer 误用、内存泄漏、大数据缓冲。
- **限制**：本卡描述 Node.js v24.18.0 的 Buffer 语义。
- **关联 Skill**：crawler-debug-typescript-node。
- **状态**：有效。

---

## 进程/错误处理/构建

### TN-PROC-001 进程与子进程语义

- **知识声明**：Node.js `child_process`（`child_process.js`）与 `process`（`doc/api/process.md`）定义子进程派生、信号、退出码与未捕获异常语义；错误处理不当会导致进程挂死或退出异常。
- **证据类型/等级**：实现证据（同版本官方源码）。
- **来源身份**：nodejs/node（`v24.18.0`）。
- **版本/ref/Commit**：`v24.18.0`；`20da4aeadabc5b0a01e3fcf520f91df8285c68a2`。
- **原始位置**：`lib/child_process.js`、`doc/api/process.md`、`doc/api/errors.md`。
- **支持说明**：child_process.js 实现子进程；process/errors 文档定义退出码、信号与错误处理。
- **适用条件**：诊断子进程错误、信号处理、未捕获异常、错误吞没。
- **限制**：本卡描述 Node.js v24.18.0 的进程/错误处理语义。
- **关联 Skill**：crawler-debug-typescript-node。
- **状态**：有效。

### TN-BUILD-001 构建与发射语义

- **知识声明**：TypeScript 编译器通过 program（`program.ts`）与 emitter（`emitter.ts`）构建程序并发射 JavaScript 输出；构建配置（tsconfig、package.json 脚本）决定编译产物与行为。
- **证据类型/等级**：实现证据（同版本官方源码）。
- **来源身份**：microsoft/TypeScript（`v6.0.3`）。
- **版本/ref/Commit**：`v6.0.3`；`050880ce59e30b356b686bd3144efe24f875ebc8`。
- **原始位置**：`src/compiler/program.ts`、`src/compiler/emitter.ts`。
- **支持说明**：program/emitter 实现构建与发射；构建产物影响运行时行为。
- **适用条件**：诊断构建失败、发射产物错误、构建配置不符预期。
- **限制**：构建行为以 TypeScript v6.0.3 为准；构建通过不等于运行正确。
- **关联 Skill**：crawler-debug-typescript-node。
- **状态**：有效。
