---
name: crawler-debug-typescript-node
description: Use when an Agent must diagnose a crawler project's TypeScript and Node.js implementation behavior (type system, tsconfig, ESM/CommonJS module system, async control, Stream, process, error handling, memory, build, dependency compatibility), detect type misuse, module-loading errors, async races, stream backpressure errors, process/error-handling defects, and compile-passes-but-wrong-runtime-behavior against locked-version evidence (TypeScript v6.0.3, Node.js v24.18.0 LTS), convert domain-confirmed fix directions into current-version implementation suggestions, and emit a traceable diagnosis with fix direction for user approval before handoff to crawler-writing-plans-bridge, without repeating cross-framework methodologies or crossing approval boundaries.
---

# crawler-debug-typescript-node

这是一个 **Agent TypeScript 与 Node.js 实现诊断、修复顾问 Skill**，用于对爬虫项目的 TypeScript/Node.js 实现行为进行证据驱动的分类诊断，输出可追溯问题证据、根因或待验证假设、影响范围、修复方向（TS/Node 实现建议）和测试建议。它**不是**项目测试体系或构建系统的替代品；不是修复器、规划器、记忆服务、RAG、代码索引、上下文框架或爬虫运行组件。它引用锁定版本（TypeScript v6.0.3、node v24.18.0 LTS）的 API 与语言用法，将领域 Skill 已确认的修复方向转换为当前版本实现建议，并识别"编译通过但运行行为错误"的缺陷。

## 触发

用户要求检查 TypeScript 与 Node.js 实现相关设计或故障，或已经确认的问题涉及类型系统、ESM/CommonJS、异步控制、Stream、进程、错误处理、内存、构建或依赖兼容时触发。处理 Stellaris 问题时，先由 `stellaris-crawler-context` 注入项目事实与已批准约束，再交给本 Skill。

## 必读输入（顺序固定）

1. 主决策日志：`docs/superpowers/brainstorming/2026-07-31-crawler-knowledge-skills-decision-log.md`。
2. 统一知识设计规格：`docs/superpowers/specs/2026-07-31-crawler-knowledge-skills-knowledge-design.md`。
3. 处理 Stellaris 问题时：`stellaris-crawler-context` 生成的项目上下文包路径。
4. 已确认根因与方向（`crawler-triage-incidents` 分诊结论，适用时）、项目目标/约束/现状、相关 `package.json`/锁文件/`tsconfig`/构建配置/代码/错误日志/运行时证据。

详细诊断流程与实现转换规则见 `references/implementation-workflow.md`；输出契约与交接见 `references/output-contract.md`；知识视图见 `docs/superpowers/knowledge/skill-views/crawler-debug-typescript-node.md`；证据卡见 `docs/superpowers/knowledge/evidence-cards/typescript-node.md`。

## 非协商门禁

1. 识别为 TypeScript/Node.js 实现诊断任务（需要基于证据的分类）。
2. 处理 Stellaris 问题时，先读取 `stellaris-crawler-context` 项目上下文包路径（主决策日志 §38）。
3. 明确诊断聚焦点（类型系统与 `tsconfig` / 模块系统 ESM·CommonJS / 异步控制 / Stream 与内存 / 进程与错误处理 / 构建与依赖兼容），聚焦该点，不做无边界全栈诊断。
4. 按匹配版本证据卡分类；引用锁定版本（TypeScript v6.0.3、node v24.18.0 LTS）的 API 与语言用法；绝不因证据不足编造根因；**绝不以编译通过误判为运行正确**。
5. 外部条件（运行时环境不可用/依赖服务受限）只能给合规降级/等待/终止结论；绝不伪装成已修复。
6. 呈现诊断记录并等待用户批准；批准前不交给 `crawler-writing-plans-bridge`。
7. 绝不重复跨框架 URL/HTTP/浏览器/队列方法论（路由到对应领域 Skill）；绝不生成 `writing-plans` 或越过批准边界；绝不安装、构建或运行未经批准的项目或第三方代码；绝不保存密钥、Cookie、认证请求头、代理凭据。
8. 输出可追溯产物并更新本地进度总账后才继续。

## 工作流路由

- 诊断流程、问题分类规则、实现转换规则、证据卡映射：`references/implementation-workflow.md`。
- 诊断记录输出契约、交接契约、修订保留：`references/output-contract.md`。
- 知识视图与证据卡：`docs/superpowers/knowledge/skill-views/crawler-debug-typescript-node.md`、`docs/superpowers/knowledge/evidence-cards/typescript-node.md`。

## 输出

- 诊断记录：问题证据＋分类＋根因或待验证假设＋影响范围＋修复方向＋测试建议；等待用户批准后交给 `crawler-writing-plans-bridge`。

## 禁止

- 不替代项目测试体系或构建系统。
- 不重复 URL/HTTP/浏览器/队列等跨框架通用方法论。
- 不把编译通过误判为运行正确；"编译通过但运行行为错误"需运行时证据判定。
- 不越过用户批准边界、不跳过 `crawler-writing-plans-bridge`。
- 不安装、构建或运行未经批准的项目或第三方代码。
- Docker 具体问题交给 `crawler-run-docker`。
- 不攻击外部网站、不绕过访问控制、不发起对目标站点的无授权请求。
- 不把未经审查的第三方示例代码用于项目。
- 不生成 `writing-plans`、不提出未经批准的代码修改。
- 不修改爬虫代码、`manifest.md`、任何第三方仓库；不初始化 Git。
- 不把密钥、Cookie、认证请求头、代理凭据、环境变量中的秘密写入诊断记录，落盘前脱敏。
