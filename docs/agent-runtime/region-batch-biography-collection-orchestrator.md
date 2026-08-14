# Region Batch Biography Collection Orchestrator

**STEP 16 — 2026-08-14**
**Runtime:** `@stellaris/agent-runtime` + `@stellaris/db`

## Purpose

把已经真实验证过的**单机构** Biography URL Agent 主链正式接入现有的
`MultiInstitutionBiographyCoordinator`，形成 **区域批量** 的 per-packet 真实 Agent 编排：

```
Frozen Region Inventory
→ 多个 InstitutionWorkPacket（PostgresInstitutionWorkPacketStore 持久化）
→ MultiInstitutionBiographyCoordinator（bounded concurrency = 2）
→ 每 Packet 独立运行 InstitutionBiographyWorkflowRunner（真实 Pi + DeepSeek + Bocha）
→ 多个 BiographyUrlResult（LATEST_FROZEN_APPROVED_REVIEW 唯一 SSoT）
→ per-packet result + failure isolation + 完成后重水合（不依赖 LLM）
```

本轮核心新增是 Coordinator 缺失的 **per-packet Workflow Executor**：
`InstitutionBiographyWorkflowPort` + `InstitutionBiographyWorkflowRunner`。

## Skill Scope

**Biography URL Collection Only**（`official-biography-evidence` 3.1.0，完全未修改）。

- 官员**个人简历 URL / 个人信息页面 URL** 的发现、核验、候选、审核与最终决策；
- 最终业务 Artifact 是 Skill 的 `final_url_decisions[].selected_url`。

硬边界（不得采集 / 填写）：任前公示、代理任命、选举/任命事件、离任事件、其它事件型 Evidence。

## Single-Institution Workflow Composition

`InstitutionBiographyWorkflowRunner` 对单个 `InstitutionWorkPacket` 机械编排已有阶段 Runner
（不复制任何 Agent、不做任何业务判断）：

```
InvestigatorAgentRunner        → Leadership + PRIMARY_1/PRIMARY_2 frozen（capture leadership/selectedOfficials）
InvestigatorEvidenceRunner     → Position URL Candidate Pool frozen（Postgres sink 持久化）
ReviewerAgentRunner (Round-1)  → APPROVED → POSITION_DECIDED
                             |→ REWORK_REQUIRED → RecoveryAgentRunner（Postgres sink）
                             |        → RecoveryRereviewCoordinator（Round-2 复用 ReviewerAgentRunner）
BiographyUrlResultReader      → Latest Frozen APPROVED Review → BiographyUrlResult
```

每 Packet 阶段结果机械 mirror 到 Postgres packet store（`INVESTIGATING → EVIDENCE_PENDING →
EVIDENCE_GATHERING → READY_FOR_REVIEW → REVIEWING → POSITION_DECIDED | RECOVERY_REQUIRED`），
并写入两个 PRIMARY 人员身份（`setPrimaryPersons`）。

## InstitutionBiographyWorkflowPort

- `InstitutionBiographyWorkflowPort.run(packet) → Promise<InstitutionBiographyWorkflowResult>`。
- `InstitutionBiographyWorkflowResult` 含 `status`（RESOLVED / PARTIAL / UNRESOLVED / FAILED）、
  `packetState`、每阶段 `WorkflowStageOutcome`（status / sessionId / model / toolCalls / bochaCalled）、
  最终 `biographyResult`（`BiographyUrlResultReader` 投影）、`failure`、`durationMs`。
- `WorkflowStageRunners` 是测试 seam：默认真实（包装 4 个既有 Runner，每 Packet 每次调用各建新实例）；
  测试注入 Fake，只验证编排状态机 / 状态推进 / 结果聚合。

## MultiInstitutionBiographyCoordinator Reuse

- **未创建第二个 Batch Coordinator**。复用现有 `MultiInstitutionBiographyCoordinator`。
- 通过薄 adapter `createBiographyPacketWorkflowRunner(workflow, onResult?)` 把
  `InstitutionBiographyWorkflowPort` 适配成 coordinator 需要的 `PacketWorkflowRunner`。
- Coordinator 只负责：Frozen Inventory → packets → bounded execution → per-packet result。

## Bounded Concurrency

- 复用 coordinator 现有 in-process bounded pool，默认并发 **2**（server 4 vCPU 开发值）。
- 不新建第二套 semaphore；不把并发暴露给前端。

## Session Isolation

- 每 Packet：独立 `InMemoryInstitutionWorkPacketStore`（`seed` 该 Packet）、独立 eventSink、
  独立 Pi Session（Investigator / Evidence / Reviewer / Recovery 各自 Fresh Session）。
- 两个 Institution 之间**不共享** Agent Conversation / SubmissionSink 状态 / ToolEvent 状态 /
  Session id。

## Failure Isolation

- 单个 Packet 失败 → per-packet result `{ status: "FAILED", error }`，不 crash、不取消其它 Packet。
- adapter 捕获 workflow 抛错；coordinator 另有 per-packet catch 兜底。
- 失败 Packet 保留 `packetId` / `institution` / `stage` / failureCode / final state（无 secret）。

## BiographyUrlResult Projection

- 最终 URL 唯一 SSoT = `LATEST_FROZEN_APPROVED_REVIEW`（`BiographyUrlResultReader`）。
- 无最终 URL 时对应 slot `UNRESOLVED`、`biographyUrl = null`，**绝不伪造 URL**。
- 读取 Result 不需要任何 Agent / DeepSeek / Bocha / Pi。

## Persistent Packet Result Rehydration

- 真实 Batch 全程使用 disposable Testcontainers PostgreSQL：
  Packet / Evidence / Review / Recovery 全部按 `packetId` / `reviewRound` / `recoveryRound`
  identity 持久化隔离。
- Batch 完成后销毁 batch 实例，创建**全新** `PostgresInstitutionWorkPacketStore` +
  `PostgresReviewDecisionReader` + `PostgresEvidenceReader` → 重水合 2 个 Packet + 2 个 Result。
- 重水合后结果与 batch 时一致（`packet_*_reloaded / *_result_rebuilt / *_same_result`），
  证明最终结果查询不依赖 LLM。

## 2-Institution Smoke

真实 Batch Smoke（`smoke:batch-biography`，DEV-only）用南京市鼓楼区 2 个合法机构
（`鼓楼区人民政府`、`鼓楼区教育局`），concurrency = 2：

- **Packet A（鼓楼区人民政府）**：Investigator → Evidence → Reviewer 全链 COMPLETED →
  `POSITION_DECIDED` → **RESOLVED**（PRIMARY_1 / PRIMARY_2 各得一个官方简历 URL）。
- **Packet B（鼓楼区教育局）**：同样全链 COMPLETED → `POSITION_DECIDED` → **PARTIAL**
  （PRIMARY_1 RESOLVED；PRIMARY_2 被 Reviewer 判定无 admissible Biography URL → UNRESOLVED，
  **未伪造 URL** —— 正确的系统行为）。
- 真实工具调用：`search_web`（Bocha）`fetch/render` `inspect` `submit_investigation`
  `submit_evidence` `submit_review_decision` 全部发生；模型 provider = `deepseek`。
- 重水合：两个 packet 均 reloaded、结果均 rebuilt、与 batch 时一致。
- 批次汇总：total=2, resolved=1, partial=1, unresolved=0, failed=0, failure_isolation=YES。

## Out of Scope

以下**明确不属于**本阶段：

- **Other Evidence Types**（任前公示 / 代理任命 / 选举任命 / 离任 等事件 Evidence）
- **Region-specific adapters**（无地区 Adapter / 省市区硬编码）
- **Retry / Resume**（batch 只执行一次；失败 Packet 保留失败状态，Deferred）
- **Graphile Worker / Job Queue / POST /api/tasks 集成**（下一阶段）
- **Frontend Task 绑定**（前端已完成的行政区三级选择本轮不动）
- **Excel Biography Result Mapping**（Excel Renderer 本轮不动）
- **Production Deployment / Migration**（所有代码仍在 dev worktree；不新 DB Migration）
