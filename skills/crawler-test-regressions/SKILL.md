---
name: crawler-test-regressions
description: Use when an Agent must design crawler tests and verify fixes (unit/integration/replay/contract tests, golden data, fault injection, performance, and security regression), form a stable failing case before a fix (RED) and guide evidence-captured runs after user approval (GREEN), check whether a fix truly resolves the original problem or introduces new problems, separate external-site anomalies from project defects, and emit test scope + evidence + pass/fail + unverified risk + release-block conclusion, blocking release on security/correctness hard-gate failure, before handoff to crawler-writing-plans-bridge, without replacing the project test system or claiming a fix as successful without result evidence.
---

# crawler-test-regressions

这是一个 **Agent 爬虫测试与修复验证顾问 Skill**，用于对爬虫项目的测试设计与修复验证进行证据驱动的设计，输出可追溯测试范围、测试依据、通过/失败结果、未覆盖风险和发布阻断结论。它**不是**项目测试体系的替代品；不是修复器、规划器、记忆服务、RAG、代码索引、上下文框架或爬虫运行组件。它修复前形成能稳定暴露问题的失败案例（RED），用户批准实施后指导运行并保存结果证据（GREEN）；**无结果证据时不宣称修复成功，关键回归失败时不放行**。

## 触发

用户要求检查测试与修复验证相关设计或故障，或已经确认的问题需要形成回归测试、验证修复有效性、设计测试体系或判定发布阻断时触发。处理 Stellaris 问题时，先由 `stellaris-crawler-context` 注入项目事实与已批准约束，再交给本 Skill。

## 必读输入（顺序固定）

1. 主决策日志：`docs/superpowers/brainstorming/2026-07-31-crawler-knowledge-skills-decision-log.md`。
2. 统一知识设计规格：`docs/superpowers/specs/2026-07-31-crawler-knowledge-skills-knowledge-design.md`。
3. 处理 Stellaris 问题时：`stellaris-crawler-context` 生成的项目上下文包路径。
4. 已确认根因与方向（`crawler-triage-incidents` 分诊结论，适用时）、项目目标/约束/现状、相关代码/测试体系/依赖版本/验收标准/复现证据。

详细诊断流程与测试设计规则见 `references/test-workflow.md`；输出契约与交接见 `references/output-contract.md`；知识视图见 `docs/superpowers/knowledge/skill-views/crawler-test-regressions.md`；证据卡见 `docs/superpowers/knowledge/evidence-cards/test-regressions.md`。

## 非协商门禁

1. 识别为测试设计/修复验证任务（需要基于证据的测试设计）。
2. 处理 Stellaris 问题时，先读取 `stellaris-crawler-context` 项目上下文包路径（主决策日志 §38）。
3. 明确诊断聚焦点（单元/集成测试设计 / 回放测试与金标数据 / 契约测试 / 故障注入与性能测试 / 安全回归 / 修复验证与发布阻断），聚焦该点，不做无边界全栈诊断。
4. 修复前形成能稳定暴露问题的失败案例（RED）；按匹配版本证据卡分类；**绝不无结果证据宣称修复成功**。
5. 外部网站异常与项目自身缺陷必须分离；外部条件只能给合规降级/等待/终止结论，绝不把外部网站异常误计入项目自身测试失败。
6. 呈现诊断记录并等待用户批准；批准前不交给 `crawler-writing-plans-bridge`。
7. 安全或正确性硬门槛失败时必须阻止通过（发布阻断）；绝不放行关键回归失败；绝不按 toxiproxy §70 授权启动代理/影响环境/注入故障；绝不安装、构建、运行、扫描、代理、测试、执行示例或爬取外部目标；绝不保存密钥、Cookie、认证请求头、代理凭据。
8. 输出可追溯产物并更新本地进度总账后才继续。

## 工作流路由

- 诊断流程、测试设计规则、外部条件分离与发布阻断、证据卡映射：`references/test-workflow.md`。
- 诊断记录输出契约、交接契约、修订保留：`references/output-contract.md`。
- 知识视图与证据卡：`docs/superpowers/knowledge/skill-views/crawler-test-regressions.md`、`docs/superpowers/knowledge/evidence-cards/test-regressions.md`。

## 输出

- 诊断记录：测试范围＋测试依据＋通过/失败结果＋未覆盖风险＋发布阻断结论；等待用户批准后交给 `crawler-writing-plans-bridge`。

## 禁止

- 不替代项目测试体系，不替代领域 Skill 诊断根因。
- 无结果证据时不宣称修复成功；关键回归失败时不放行（发布阻断）。
- 不把外部网站异常错误计入项目自身测试失败；外部条件只能给合规降级/等待/终止结论。
- toxiproxy 按主决策日志 §70：只作受控案例知识，不授权启动代理/影响环境/注入故障。
- 不攻击外部网站、不绕过访问控制、不发起对目标站点的无授权请求。
- 不把未经审查的第三方示例代码用于项目。
- 不生成 `writing-plans`、不提出未经批准的代码修改。
- 不修改爬虫代码、`manifest.md`、任何第三方仓库；不初始化 Git。
- 不把密钥、Cookie、认证请求头、代理凭据、环境变量中的秘密写入诊断记录，落盘前脱敏。
