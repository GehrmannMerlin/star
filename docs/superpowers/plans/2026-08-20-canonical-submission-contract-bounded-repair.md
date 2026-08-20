# Canonical Submission Contract & Bounded Repair — Plan

Date: 2026-08-20
Task: STEP 19.4 — Canonical Schema 单一真相源 + submit_investigation 有限自修复闭环
Server: 43.142.31.198 (root, SSH key ~/.ssh/stellaris_tencent_ed25519)
Worktree: /opt/Stellaris-PiAgent-Dev (branch refactor/pi-agent-runtime-server-20260813, head 88ef75a)

## writing-plans 状态

- `writing_plans_skill_available`: NO（superpowers:writing-plans 尝试调用一次返回 Unknown skill）
- `writing_plans_used`: NO_UNAVAILABLE
- `writing_plans_contract_fallback`: YES（本轮按 writing-plans contract 手工生成计划）

## 背景根因（Production Cutover 回滚）

Production Cutover 中真实 Agent 连续约 23 次 SCHEMA_VALIDATION_FAILED：
- `submit_investigation` 的 person_status / currentness_quality 不符合 canonical Skill schema 的 allowed enum values
- Validator 只返回 "must be equal to one of the allowed values"，不给 allowed_values，Agent 无法正确修复
- 无 Retry Budget、无 Repeated Error Circuit Breaker → 同一枚举错误反复重试
- 无 Submission Repair Mode → Agent 可能继续 Search/Fetch
- 最终 Reviewer 未启动、BiographyUrlResult 未产生 → 验收失败 → 回滚

## 本轮唯一目标

只修这条链：Investigator ↔ Canonical Skill Schema ↔ submit_investigation ↔ Schema Validator ↔ Repair Loop。
第一提交尽量合法；偶发 Schema Error 给精确错误+合法值；有限次数修复；禁止 23 次重试。

## 当前代码审计结论（fresh evidence，全部实读）

### 1. Canonical Skill Schema（SSoT，不可改）
- 路径：`third-party/china-official-url-evidence-suite/skills/official-biography-evidence/schemas/`
- `person-decision.schema.json`（title "Person Decision"，draft 2020-12）：
  - `person_status`（平铺字段）：enum [PERSON_CONFIRMED, PERSON_UNRESOLVED_AFTER_COMPLETE_SEARCH, VACANT]
  - `currentness_quality`：enum [CURRENT_COLLECTION_MEMBER, DETAIL_LINKED_FROM_CURRENT_COLLECTION, RECENT_CURRENT_OFFICIAL_EVIDENCE, DETAIL_NOT_IN_CURRENT_COLLECTION, DETAIL_COLLECTION_CONFLICT, CURRENTNESS_UNRESOLVED]
  - required 含 person_status、currentness_quality 等 17 个字段；additionalProperties false
- `leadership-structure.schema.json`（title "Leadership Structure"）
- 注意：任务描述中 `selectedOfficials[0].person.status` 嵌套路径是示意/历史报错；当前 canonical schema 与全部代码/测试 fixture 均为**平铺 person_status**。Skill submodule 只有一个 commit，schema 从未变过。实现以平铺 person_status 为准（schema 真实字段）。

### 2. Prompt（investigation-role-prompt.ts，59 行）
- 列出 selectedOfficials 字段名（含 person_status、currentness_quality），但**未硬编码 enum 值**
- 问题：未告知模型合法枚举值 → 模型自由发挥 → 产生非法值

### 3. Tool Schema（agent-tools submit-investigation.ts）
- TypeBox：`SubmitInvestigationInput = { leadership: {}, selectedOfficials: [] (minItems 2 maxItems 2) }`，additionalProperties false
- **无 enum 约束**（artifact 是 opaque，enum 只在 Skill schema 层）
- Pi 0.84.1 ToolDefinition.parameters 支持 TypeBox，也支持 enum

### 4. Validator（skill-investigation-validator.ts）
- Ajv2020 allErrors，加载 leadership-structure + person-decision canonical schema
- 报错格式：`selectedOfficials[0]: /person_status must be equal to one of the allowed values` —— 只有 message，没有 allowed_values / received_value
- 接口 SubmissionValidation = { valid, errors: string[] }，结构化丢失

### 5. Runner（investigator-agent-runner.ts，254 行）
- 单次 session.prompt → isFrozen check → observation gate → fail
- **无 repair loop / retry budget / circuit breaker / repair mode**
- ToolGateway 对 ToolFailureError 的 message 原样返回给 Agent（无结构化字段）

### 6. 错误码（agent-tools tool-failure-codes.ts）
- 已有 SCHEMA_VALIDATION_FAILED、INVALID_INPUT 等
- 需新增：INVESTIGATION_SCHEMA_REPAIR_EXHAUSTED、INVESTIGATION_REPEATED_SCHEMA_ERROR、INVESTIGATION_TOOL_NOT_CALLED、INVESTIGATION_PROVIDER_TOOL_CALL_INVALID、RESEARCH_TOOL_NOT_ALLOWED_DURING_SUBMISSION_REPAIR

### 7. Pi SDK 0.84.1
- ToolDefinition：parameters(TypeBox TSchema)、prepareArguments、constrainedSampling、executionMode
- 支持动态 TypeBox enum 构造

### 8. Session / Tool Policy
- role-tool-policy.ts：INVESTIGATOR_ROLE_TOOLS = [get_region_context, search_web, fetch_page, render_page, inspect_page, submit_investigation]
- AgentSessionFactory 以 tools allowlist 传入 Pi；Pi 只激活 allowlist 中的工具
- Pi 0.84.1 每个 session 的 tools 固定（创建时传入）；动态切 allowlist 不可行 → 用 ToolGateway / Runner 层拦截

## Contract Matrix（修改前）

| 字段 | Canonical Schema | Prompt | Tool Schema | Validator | 一致? |
|---|---|---|---|---|---|
| person_status | [PERSON_CONFIRMED, PERSON_UNRESOLVED_AFTER_COMPLETE_SEARCH, VACANT] | 未列 enum（字段名有） | 无 enum（opaque） | 同 canonical | NO（Prompt 缺 enum） |
| currentness_quality | [6 个值] | 未列 enum（字段名有） | 无 enum（opaque） | 同 canonical | NO（Prompt 缺 enum） |

Enum 真相源：Canonical Schema 是唯一 enum 定义处；Prompt/Tool 没有维护副本 enum。
MULTIPLE_SOURCE_OF_TRUTH：NO（当前没有第二份 enum hardcode）——但 Prompt 缺 enum 导致模型自由发挥。

## 字段 Ownership 判断

- person_status / currentness_quality 属于 **AGENT_SEMANTIC_DECISION** 字段：
  - Skill 中 person_status 表示"该职位人员是否已确认/空缺"，需要 Agent 综合搜索结果判断
  - currentness_quality 表示证据时新性质量，需要 Agent 判断
  - **没有** deterministic runtime 推导路径（现有 person-decision 记录不含可推导这些状态的数据）
  - 结论：不能 Runtime 填，必须由 Agent 选择，但必须严格限定在 canonical enum 内

## 目标设计（Canonical Submission Contract）

新增一个极小的 Runtime 层（名称服从项目命名），只读 canonical Skill schema，投影 enum contract：

### 概念组件
1. **CanonicalSubmissionContract**（agent-runtime/src/investigation/）
   - 从 SkillSchemaRegistry 读取 person-decision / leadership-structure schema
   - 解析 schema identity / version / enum 字段 / allowed values / required / nullable
   - 提供 person_status_allowed_values()、currentness_quality_allowed_values() 等只读访问器
   - 不做业务判断，不做语义归一化

2. **Prompt 动态投影**（investigation-role-prompt.ts 改）
   - 从 CanonicalSubmissionContract 动态生成枚举提示（禁止手写 const 副本）
   - 例如：`person_status 必须严格从以下值中选择：PERSON_CONFIRMED / PERSON_UNRESOLVED_AFTER_COMPLETE_SEARCH / VACANT`
   - 禁止翻译/缩写/新增枚举值

3. **Validation Repair Packet**（validator 返回结构化错误）
   - SubmissionValidation 扩展为结构化：{ valid, errors: [{ errorCode, fieldPath, receivedValue, validationKeyword, allowedValues, repairInstruction }] }
   - Ajv error 解析用 instancePath / schemaPath / keyword / params.allowedValues，不用正则拆字符串
   - received_value 从 payload 按 instancePath 安全读取（不 dump 整个 payload）
   - 错误码：SUBMISSION_SCHEMA_VALIDATION_FAILED（映射到 ToolFailureCode.SCHEMA_VALIDATION_FAILED）

4. **Retry Budget + Repeated Error Circuit Breaker**（runner）
   - MAX submit attempts = 3；Schema Repair MAX = 2
   - fingerprint = hash(toolName + instancePath + keyword + receivedValue + schemaIdentity)
   - 连续两次 fingerprint 相同 → STOP（INVESTIGATION_REPEATED_SCHEMA_ERROR）
   - Repair 次数耗尽 → INVESTIGATION_SCHEMA_REPAIR_EXHAUSTED
   - 新错误码加入 ToolFailureCode

5. **Submission Repair Mode**（runner 状态机）
   - INVESTIGATING → FINALIZING → SUBMISSION_REPAIR → SUBMITTED
   - REPAIR 阶段：ToolGateway / Runner 拒绝 search_web/fetch_page/render_page/inspect_page/get_region_context
   - 返回 RESEARCH_TOOL_NOT_ALLOWED_DURING_SUBMISSION_REPAIR
   - 只允许 submit_investigation

6. **Finalization Context Projection**（runner）
   - 进入 FINALIZING 阶段，只保留必要数据（region/institution/leadership facts/已接受的 candidate URLs/证据摘要/required role info/枚举 contract/submission 指令）
   - 不把全部 tool events / raw HTML / 完整 Skill 塞给模型

7. **Tool Not Called Steering**
   - Finalizing 阶段模型输出纯文本未调用 submit_investigation → 一次短 steering
   - 仍不调用 → INVESTIGATION_TOOL_NOT_CALLED

## 本轮明确禁止修改

- Graphile architecture / BiographyTaskExecutionService / FULL/TARGETED dispatcher
- Inventory Agent / Crawler HTTP / BrowserPool / search_web architecture
- Reviewer semantic rules / Recovery semantic rules / Excel contract
- Frontend layout / Frontend progress / Cancellation architecture
- Nginx / Production Docker / Production database schema
- Skill business scope（BIOGRAPHY_URL_ONLY 锁死）

## 测试范围（只跑 targeted）

- Test 1: Canonical Enum Extraction（runtime 读出与 schema 一致）
- Test 2: Prompt Projection（enum 值一致）
- Test 3: Tool Schema Projection（若动态投影则一致）
- Test 4: Invalid Enum Repair（Tool Error 含 field/received/allowed_values/instruction）
- Test 5: Successful Repair（第一次 invalid → 第二次 corrected → PASS）
- Test 6: Repeated Error Circuit Breaker（连续相同错误 → 停止，无 attempt 4）
- Test 7: Repair Tool Policy（REPAIR 阶段 search_web 拒绝、submit_investigation 允许）
- Test 8: Tool Not Called（text-only → steering 一次 → 仍 text-only → fail fast）
- Affected Typecheck（agent-runtime + agent-tools）
- Submission-only Real DeepSeek Smoke（Frozen Finalization Input → Pi → DeepSeek → submit_investigation → canonical validator，search/fetch/inspect = 0）
- 完整 TARGETED Real Smoke（一个已验证稳定的机构）

## 禁止

- 不跑全量测试 / Crawler Full / Backend Full / Playwright Full / 全国测试
- 不部署 Production / 不改 Production / 不 merge Production
- 不做 semantic enum 归一化（如"在任"→某 enum 的偷偷映射）
- 不为 DeepSeek 写 domain-specific if
- 不关闭 Schema validation
- 不修改 Skill business rules
- 不 push / 不 merge

## 成功门禁

- person.status Enum Source: CANONICAL_ONLY
- Multiple Enum Truth Sources: REMOVED/UNUSED
- Prompt/Tool/Validator 均 CANONICAL
- Schema Repair Max 2 / Submit Max 3
- Repeated Error Circuit Breaker: YES
- Repair Mode: YES；Search/Fetch/Render/Inspect During Repair: BLOCKED
- Text-only Finalization Steering: MAX_1
- Targeted Tests: PASS / Typecheck: PASS
- Submission-only Real DeepSeek Smoke: PASS（repair_count <= 1）
- 完整 TARGETED Real Smoke: PASS（submit <= 3, schema failures <= 2, research calls after failure = 0, reviewer started, BiographyUrlResult YES）

## 交付物

- 代码实现（agent-runtime + agent-tools 小范围）
- 文档 docs/agent-runtime/canonical-submission-contract-and-bounded-repair.md（全中文）
- 1~2 个 commit（不 push 不 merge）
