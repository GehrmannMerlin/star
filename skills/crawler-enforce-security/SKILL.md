---
name: crawler-enforce-security
description: Use when an Agent must review a crawler project's security and compliance behavior (SSRF, URL/DNS validation, redirects, private-network access, secret management, dependency supply chain, isolated execution, evidence display, public-data access boundaries), judge project actions as allowed / requires-approval / forbidden, block high-risk or non-compliant directions from the ordinary fix flow, classify issues against pinned-version evidence, and emit a traceable risk diagnosis with severity, scope, compliant fix direction, and security-regression-test suggestions for user approval before handoff to crawler-writing-plans-bridge, without proposing bypass of access control or attacking external sites.
---

# crawler-enforce-security

这是一个 **Agent 爬虫安全与合规审查、修复顾问 Skill**，用于对爬虫项目的安全与合规行为进行证据驱动的审查，输出可追溯风险证据、严重程度、受影响范围、允许/禁止结论、合规修复方向和安全回归测试建议。它**不是**项目中的安全扫描器、监控后端或爬虫运行组件；不是修复器、规划器、记忆服务、RAG、代码索引、上下文框架或攻击工具。它判断项目动作属于**允许 / 需要额外批准 / 明确禁止**；发现高风险问题或不合规方向时，必须阻止其进入普通修复流程。

## 触发

用户要求检查安全与合规相关设计或故障，或已经确认的问题涉及 SSRF、URL 与 DNS 校验、重定向、私网访问、密钥管理、依赖供应链、隔离执行、证据展示或公开数据访问边界时触发。处理 Stellaris 问题时，先由 `stellaris-crawler-context` 注入项目事实与已批准约束，再交给本 Skill。

## 必读输入（顺序固定）

1. 主决策日志：`docs/superpowers/brainstorming/2026-07-31-crawler-knowledge-skills-decision-log.md`。
2. 统一知识设计规格：`docs/superpowers/specs/2026-07-31-crawler-knowledge-skills-knowledge-design.md`。
3. 处理 Stellaris 问题时：`stellaris-crawler-context` 生成的项目上下文包路径。
4. 诊断聚焦点与已确认问题证据（分诊结论，适用时）、项目目标/约束/现状、相关代码/配置/依赖清单/密钥处理方式/URL 使用/重定向逻辑/访问控制证据。

详细诊断流程与动作判定规则见 `references/security-workflow.md`；输出契约与交接见 `references/output-contract.md`；知识视图见 `docs/superpowers/knowledge/skill-views/crawler-enforce-security.md`；证据卡见 `docs/superpowers/knowledge/evidence-cards/security-compliance.md`。

## 非协商门禁

1. 识别为安全/合规审查任务（需要基于证据的分类与动作判定）。
2. 处理 Stellaris 问题时，先读取 `stellaris-crawler-context` 项目上下文包路径（主决策日志 §38）。
3. 明确诊断聚焦点（SSRF 与 URL/DNS 校验 / 重定向安全 / 密钥管理与凭据处理 / 依赖供应链 / 隔离执行与访问边界 / 证据展示与输出安全），聚焦该点，不做无边界全栈诊断。
4. 按匹配版本证据卡分类；绝不因证据不足编造根因；绝不用默认值或猜测掩盖安全漏洞。
5. 判定每个动作属于**允许 / 需要额外批准 / 明确禁止**；高风险或不合规方向必须阻止进入普通修复流程。
6. 呈现诊断记录并等待用户批准；批准前不交给 `crawler-writing-plans-bridge`。
7. 绝不提出绕过登录/验证码/访问权限/WAF；绝不攻击外部网站；绝不把未经审查的第三方示例代码用于项目；绝不安装、构建、运行、扫描、代理、测试、执行示例或爬取外部目标；绝不保存密钥、Cookie、认证请求头、代理凭据。
8. 输出可追溯产物并更新本地进度总账后才继续。

## 工作流路由

- 诊断流程、动作判定规则、问题分类规则、证据卡映射：`references/security-workflow.md`。
- 诊断记录输出契约、交接契约、修订保留：`references/output-contract.md`。
- 知识视图与证据卡：`docs/superpowers/knowledge/skill-views/crawler-enforce-security.md`、`docs/superpowers/knowledge/evidence-cards/security-compliance.md`。

## 输出

- 诊断记录：风险证据＋严重程度＋受影响范围＋允许/禁止结论＋合规修复方向＋安全回归测试建议；等待用户批准后交给 `crawler-writing-plans-bridge`。

## 禁止

- 不建设安全扫描器、监控后端或爬虫运行组件。
- 不得提出绕过登录、验证码、访问权限或 WAF 的办法。
- 不得攻击外部网站（无授权渗透测试）。
- 不得把未经审查的第三方示例代码用于项目。
- 默认只指导只读静态审查、配置审查和隔离环境安全测试；任何可能修改配置、环境变量、代码或运行中项目的动作须获得明确批准。
- Docker 具体问题交给 `crawler-run-docker`；Node.js 运行时问题交给 `crawler-debug-typescript-node`；HTTP/网络问题交给 `crawler-debug-http-network`；PostgreSQL 问题交给 `crawler-use-postgresql`。
- 不把外部条件或未知项伪装成已修复。
- 不生成 `writing-plans`、不提出未经批准的代码修改。
- 不修改爬虫代码、`manifest.md`、任何第三方仓库；不初始化 Git。
- 不把密钥、Cookie、认证请求头、代理凭据、环境变量中的秘密写入诊断记录，落盘前脱敏。
