# Canonical Submission Contract 与有限自修复闭环

Date: 2026-08-20
Task: STEP 19.4 — Canonical Schema 单一真相源 + submit_investigation 有限自修复闭环
Server: 43.142.31.198 / /opt/Stellaris-PiAgent-Dev（branch `refactor/pi-agent-runtime-server-20260813`）

---

## 一、Production 回滚根因

最近一次 Production Cutover 中，真实 Agent 任务运行了十几分钟、产生大量 Tool Calls，
但最终卡死在 `submit_investigation`，连续出现约 23 次 `SCHEMA_VALIDATION_FAILED`。

主要失败字段：

- `person_status`
- `currentness_quality`

不符合 canonical Skill schema（`official-biography-evidence`）定义的 allowed enum values。

由于：

- Validator 只返回 `must be equal to one of the allowed values`，**不给 allowed_values**，Agent 无法正确修复；
- 无 Retry Budget，无 Repeated Error Circuit Breaker → 同一枚举错误连续重试 23 次；
- 无 Submission Repair Mode → Agent 可能继续 Search/Fetch；
- 最终 Reviewer 未启动、BiographyUrlResult 未产生 → 验收失败 → 系统按安全规则回滚。

本轮只修这一条链：**Investigator ↔ Canonical Skill Schema ↔ submit_investigation ↔ Schema Validator ↔ Repair Loop**。

## 二、原 Schema Contract 漂移

修改前（服务器只读审计，fresh evidence）：

| 组件 | 行为 |
|---|---|
| Canonical Skill Schema | `person-decision.schema.json` 平铺字段 `person_status`（enum 3 值）、`currentness_quality`（enum 6 值）；是唯一 enum 定义处 |
| Prompt | 只列字段名，**未硬编码 enum** → 模型自由发挥产生非法值 |
| Tool Schema | TypeBox `{ leadership: {}, selectedOfficials: [] }` opaque，无 enum 约束 |
| Validator | Ajv2020 用 canonical schema 校验；错误信息**不含 allowed_values / received_value** |
| Runner | 单次 prompt → frozen check；**无 repair loop / retry budget / circuit breaker / repair mode** |

任务描述中的 `selectedOfficials[0].person.status` 嵌套路径为示意/历史报错；
当前 canonical schema 与全部代码/测试 fixture 均为**平铺 `person_status`**（Skill submodule 仅一个 commit，schema 从未变更）。
实现以 schema 真实字段为准。

## 三、Canonical Submission Contract

新增极小的 Runtime 层（agent-runtime/src/investigation/）：

- `canonical-submission-contract.ts` — 只读解析 person-decision / leadership-structure schema：
  - schema identity / version
  - enum 字段 / allowed values
  - required / nullable
  - JSON pointer
- 不定义第二份 enum 副本，不做业务判断，不做语义归一化。
- contract 不可用时 fail-closed：Validator 仍会拒绝非法枚举（缺口由 validator 兜底）。

## 四、Enum SSoT（单一真相源）

`person_status` / `currentness_quality` 的 allowed values **只来自** canonical Skill schema。
本轮未新增任何 hardcoded enum 副本：

- Prompt：动态投影（见五）
- Tool Schema：保持 opaque（enum 只在 canonical schema 层），**未另建副本**
- Validator：直接编译 canonical schema，Ajv `params.allowedValues` 或 contract accessor 取 allowed values

结论：`MULTIPLE_SOURCE_OF_TRUTH = NO`（修改前就没有第二份 enum hardcode；
修改后仍保持唯一真相源，且 Prompt 也从缺失变为动态投影）。

## 五、Prompt Projection

`investigation-role-prompt.ts` 增加：

- `buildInvestigationRolePrompt`：从 `CanonicalSubmissionContract` 动态生成枚举提示
  （如 `person_status 必须严格从以下值中选择：PERSON_CONFIRMED / ... / VACANT`）。
- `buildInvestigationFinalizePrompt`：Finalizing 阶段短 steering（一次），含枚举投影。
- `buildInvestigationRepairPrompt`：Repair 阶段反馈结构化 issue（字段/收到值/允许值）。

禁止翻译、禁止缩写、禁止创建新枚举值。

## 六、Tool Schema Projection

Pi SDK 0.84.1 `ToolDefinition.parameters` 为 TypeBox schema。

submit_investigation 的 `leadership` / `selectedOfficials` 是 opaque artifact
（完整形状由 Skill canonical schema 强制），TypeBox 层不需要也不应重复 enum。
因此 **Tool Schema 保持 opaque**，enum 约束唯一来自 canonical validator ——
`TOOL_SCHEMA_ALIGNED = YES`（无第二套 enum）。

## 七、Validation Repair Packet

当 `submit_investigation` Schema validation 失败时，工具抛出 `ToolFailureError`：

- `code`：`SCHEMA_VALIDATION_FAILED`（兼容既有契约）
- `message`：结构化可读消息（字段 / 收到值 / 允许值 / 修复指令）
- `details`：`ValidationIssue[]`，每个 issue 含：
  - `errorCode`：`SUBMISSION_SCHEMA_VALIDATION_FAILED`
  - `fieldPath`：Ajv `instancePath`（含 selectedOfficials 下标前缀，如 `/0/person_status`）
  - `receivedValue`：从 payload 按 instancePath 安全读取
  - `validationKeyword`：Ajv keyword（`enum` / `required` / `type` 等，通用）
  - `allowedValues`：enum 时从 canonical contract 读取
  - `repairInstruction`：中文修复指令

Ajv 结构化 error（instancePath / schemaPath / keyword / params）被复用，**不正则拆字符串**。

## 八、Retry Budget

硬约束（不可通过配置扩大）：

- 初始提交 Attempt 1
- Schema Repair 最多 2 次（`SCHEMA_REPAIR_MAX_ATTEMPTS = 2`）
- 总 submit_investigation attempts 最多 3 次（`SUBMIT_INVESTIGATION_MAX_ATTEMPTS = 3`）
- 仍失败 → `INVESTIGATION_SCHEMA_REPAIR_EXHAUSTED`

## 九、Repeated Error Circuit Breaker

- 每次 validation error 生成 fingerprint：
  `hash(tool=submit_investigation + instancePath + keyword + receivedValue + schema identity)`
- 连续两次 fingerprint 完全一致 → 立即 STOP（`INVESTIGATION_REPEATED_SCHEMA_ERROR`），不再消耗模型。
- 绝不出现 attempt 4。

## 十、Submission Repair Mode

Runner 阶段化：

```
INVESTIGATING → FINALIZING → SUBMISSION_REPAIR → SUBMITTED
```

`SubmissionRepairGateway` 包装底层 `ToolGateway`：
- Repair 阶段拒绝 `search_web` / `fetch_page` / `render_page` / `inspect_page` / `get_region_context`
- 返回 `RESEARCH_TOOL_NOT_ALLOWED_DURING_SUBMISSION_REPAIR`，并记录 ToolEvent
- `submit_investigation` 始终放行

Pi 0.84.1 每 session tools 固定（创建时传入），动态切 allowlist 不可行 →
**在 Gateway 层拦截**（应用级 contract，不依赖 provider strict tool calling）。

## 十一、Finalization Context

- 调查完成后，Finalizing / Repair steering 只携带必要数据：机构、行政区、
  leadership facts、PRIMARY_1/PRIMARY_2 决定、canonical enum contract、提交指令。
- 不把全部 ToolEvents / Raw HTML / 完整 Skill 塞给模型。
- 完整 Evidence 仍在 persistence / provenance 保留（不删除）。
- 本轮只做 Investigator Finalization Context Projection，不做通用 Context Compression。

## 十二、Submission-only Real DeepSeek Smoke

用已持久化的合法调查结果（`step9-gulou-investigation.json`，真实结构）作为 Frozen
Finalization Input，强制 Submission Repair Mode（研究工具全部拒绝），真实 Pi Agent +
真实 DeepSeek 只做提交。

结果：

- pi_session_created: YES
- provider / model: deepseek / deepseek-v4-flash
- model_request: YES
- submit_investigation_called: YES
- submit_attempts: 1
- schema_validation_failures: 0
- repair_attempts: 0（第一次即成功，最佳结果）
- schema_valid: YES
- search_calls: 0 / fetch_calls: 0 / render_calls: 0 / inspect_calls: 0
- research_tool_calls_total: 0
- duration_ms: 13217

## 十三、完整 Targeted Smoke

真实 TARGETED 鼓楼区人民政府（region 320106），Investigator 完整链路：

- get_region_context: YES / search_web: YES（bocha）/ fetch_page: YES / inspect_page: YES
- submit_investigation: YES
- leadership_schema_valid: YES / selected_officials_schema_valid: YES
- submission_frozen: YES / observation_gate: PASS
- packet_final_state: EVIDENCE_PENDING
- primary_1: 董涵 / primary_2: 石磊（真实调查结果，leadership_entry_count=9）
- 新指标：submit_attempts=1，schema_validation_failures=0，repair_attempts=0，
  repeated_error_breaker_triggered=NO，research_calls_after_first_submit_failure=0

Reviewer 阶段 smoke（真实 Reviewer Agent）另行验证 Reviewer 启动；BiographyUrlResult
属 Evidence/Reviewer 阶段产物，本轮未修改这些模块，保留现有已验证能力。

## 十四、Deferred

- DeepSeek strict Tool Calling A/B experiment（本轮不实现，保留 future experiment）
- 通用 Context Compression framework（本轮只做 Investigator Finalization Projection）
- schema 失败时 ReceivedValue 深度对象 / 敏感字段的进一步脱敏策略

## 验证结论

- Canonical Schema 唯一真相源：YES
- Prompt 动态投影：YES（无 hardcode 副本）
- Tool Schema 对齐：YES（opaque，无第二套 enum）
- Validator 同源：YES
- Repair 反馈精确 allowed_values：YES
- Repair Max 2 / Total Submit Max 3：YES
- Repeated Error Circuit Breaker：YES
- Repair 阶段禁止研究工具：YES
- 未加 DeepSeek domain if：YES
- 未做 semantic enum 归一化：YES
- Skill / Reviewer / Frontend / Cancel / Production：未修改
