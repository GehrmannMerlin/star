# Region Batch Biography Collection Orchestrator Implementation Plan

**STEP 16 — 2026-08-14**
**Execution mode:** INLINE_FAST (pre-authorized; no per-task approval)
**Skill scope:** `official-biography-evidence` 3.1.0 — `BIOGRAPHY_URL_ONLY`

## Goal

把已经真实验证过的**单机构** Biography URL Agent 主链：

```
InstitutionWorkPacket
→ InvestigatorAgentRunner            (Leadership + PRIMARY_1/PRIMARY_2 frozen)
→ InvestigatorEvidenceRunner         (Position URL Candidate Pool frozen)
→ ReviewerAgentRunner                (Round-1 Independent Review)
→ 如 REWORK_REQUIRED: RecoveryAgentRunner → RecoveryRereviewCoordinator (Round-2 Review)
→ BiographyUrlResultReader           (Latest Frozen APPROVED Review → final URLs)
```

正式接入现有的 **`MultiInstitutionBiographyCoordinator`**，形成：

```
Frozen Region Inventory
→ 多个 InstitutionWorkPacket（PostgresInstitutionWorkPacketStore 持久化）
→ bounded concurrency（默认 2）
→ 每 Packet 独立运行真实 Agent Workflow（每 Packet 独立 Pi Session / 独立状态 / 独立持久化 identity）
→ 多个 BiographyUrlResult（LATEST_FROZEN_APPROVED_REVIEW 唯一 SSoT）
→ per-packet result + failure isolation + 完成后重水合（不依赖 LLM）
```

并首次用 **2 个真实 Institution** 的 Real Agent Batch Smoke 证明主链成立。

## Architecture

```
Frozen Inventory
    │  packetStore.createFromFrozenInventory
    ▼
MultiInstitutionBiographyCoordinator ── bounded pool (concurrency=2)
    │  runPacket = createBiographyPacketWorkflowRunner(workflow)   [STEP 16 新增 adapter]
    ▼
InstitutionBiographyWorkflowRunner  (实现 InstitutionBiographyWorkflowPort)
    │  每 Packet：seed 一个 InMemoryInstitutionWorkPacketStore（仅该 Packet）
    │  ── 机械编排已有 Runner，不做任何业务语义决策 ──
    ▼
InvestigatorAgentRunner  → 捕获 leadership + selectedOfficials（thread 到后续阶段）
    │                      mirror 状态到 Postgres（INVESTIGATING → EVIDENCE_PENDING）
    │                      setPrimaryPersons（两 PRIMARY 身份写 Postgres + 内存）
    ▼
InvestigatorEvidenceRunner（注入 PostgresInvestigatorEvidenceSubmissionSink，persist 候选池）
    │                      mirror（EVIDENCE_GATHERING → READY_FOR_REVIEW）
    ▼
ReviewerAgentRunner（注入 PostgresReviewDecisionSink round=1，persist Round-1 Review）
    │  mirror（REVIEWING → POSITION_DECIDED | RECOVERY_REQUIRED | FAILED）
    ▼
POSITION_DECIDED ──► BiographyUrlResultReader.read(packetId) ──► RESOLVED/PARTIAL/UNRESOLVED
    │
RECOVERY_REQUIRED ──► RecoveryAgentRunner（PostgresRecoverySubmissionSink round=1）
    │                    mirror（RECOVERING → READY_FOR_REVIEW）
    ▼
RecoveryRereviewCoordinator（重水合 Composite Candidate View → 复用 ReviewerAgentRunner，
                            PostgresReviewDecisionSink round=2，persist Round-2 Review）
    │  mirror（REVIEWING → POSITION_DECIDED | RECOVERY_REQUIRED | FAILED）
    ▼
BiographyUrlResultReader.read(packetId) ──► 最终 BiographyUrlResult
```

**边界（严格保持）：**
- `MultiInstitutionBiographyCoordinator` = 只调度（schedule packets / bounded concurrency / per-packet failure isolation）。
- `InstitutionBiographyWorkflowRunner` = 只按结构化 outcome 编排已有阶段（sequence existing stages）。
- Agent + Skill = 所有语义决策（选人 / 选 PRIMARY / 选 URL / Review / Recovery / Search / Fetch / Inspect）。
- 不复制任何已有 Agent / Runner；不新建第二套 Batch Coordinator；不新建 `batch_run` 表；不新 Migration。

## Tech Stack

- `@stellaris/agent-runtime`（TypeScript ESM，`tsx` 运行 smoke，`vitest` 测试）
- `@stellaris/db`（Kysely/pg；Testcontainers `postgres:18` disposable DB）
- `@stellaris/agent-tools`（Submission Sinks / ToolGateway / Search Provider Registry / MemoryToolEventSink）
- `@earendil-works/pi-coding-agent`（Pi AgentSession；`DEEPSEEK_API_KEY` 由 runtime env 提供）

## Global Constraints

1. Skill `official-biography-evidence` 3.1.0 **完全不修改**；业务范围锁死 `BIOGRAPHY_URL_ONLY`。
2. **不创建** 第二个 Batch Coordinator；**不复制** Investigator/Evidence/Reviewer/Recovery Runner。
3. **不新增** DB Migration；**不创建** `batch_run` / `region_collection_run` / `workflow_run` 表。
4. **Provider-neutral**：Workflow Runner / Coordinator 禁止 `import DeepSeek` / `import Bocha` /
   `provider === "deepseek"` 判断。模型仍由 `ModelPolicy`（AGENT_MODEL_PROVIDER/ID）、Search 仍由
   `SearchProviderRegistry`（WEB_SEARCH_PROVIDER）配置。
5. **BiographyUrlResult 唯一 SSoT** = `LATEST_FROZEN_APPROVED_REVIEW`；不创建
   `biography_final_decision` 等第二张事实表；无最终 URL 时 UNRESOLVED，**绝不伪造 URL**。
6. **Postgres 持久化**用于真实 Batch Smoke（packet / evidence / review / recovery，全部按
   packetId + sessionId + reviewRound + recoveryRound 隔离）；Production DB 一律不动。
7. Batch Workflow 不重新选 PRIMARY、不 Ranking、不自己 Search/Fetch/Inspect、无地区-specific
   code、无省市区 Adapter。
8. 每 Packet 独立 Pi Session；两 Institution 之间不共享 Agent Conversation / SubmissionSink 状态 /
   ToolEvent 状态 / Session id。
9. 测试策略：**TARGETED ONLY**（6–10 个核心测试）；不跑 Full Workspace / Crawler / Backend /
   Playwright / Inventory / Standalone 各阶段 Real Smoke；`@stellaris/db`、`@stellaris/agent-tools`
   仅在真正修改时才 typecheck。
10. Frontend / Excel / Graphile / 生产部署本轮全部不改。

## File Structure

新增：
- `packages/agent-runtime/src/batch/institution-biography-workflow-runner.ts` —— Workflow Port +
  真实 Agent Workflow 编排 Runner（含 per-stage Postgres sink 注入 + Postgres mirror）。
- `packages/agent-runtime/src/batch/institution-biography-workflow-runner.test.ts` —— targeted tests。
- `packages/agent-runtime/src/batch/biography-batch-wiring.ts` —— `InstitutionBiographyWorkflowPort`
  → `MultiInstitutionBiographyCoordinator.runPacket`（`PacketWorkflowRunner`）薄 adapter。
- `packages/agent-runtime/src/smoke/batch-biography-smoke.ts` —— DEV-only 2-Institution Real Batch
  Smoke 入口（Testcontainers Postgres，完成后精确清理 secret + 容器）。
- `packages/agent-runtime/src/smoke/fixtures/batch-biography-gulou-input.json` —— 南京市鼓楼区
  2 个合法 Frozen Inventory Institution 的 DEV smoke fixture。

修改：
- `packages/agent-runtime/src/work-packet/institution-work-packet.ts` —— `InMemoryInstitutionWorkPacketStore`
  增加只读 seed 方法（Batch Workflow 从 Postgres 恢复 packet 后注入 Runner 链；additive，不改既有行为）。
- `packages/agent-runtime/src/coordination/multi-institution-biography-coordinator.test.ts` —— 增加
  Coordinator→WorkflowPort 真实 wiring 测试。
- `packages/agent-runtime/src/index.ts` —— export batch 模块（不 export smoke，与 inventory-smoke 一致）。
- `packages/agent-runtime/package.json` —— 增加 `smoke:batch-biography` script。

文档：
- `docs/superpowers/plans/2026-08-14-region-batch-biography-collection-orchestrator.md`（本计划）
- `docs/agent-runtime/region-batch-biography-collection-orchestrator.md`（STEP 16 报告文档）

## Tasks

### Task 1 — Inspect existing single-institution runners and coordinator boundaries

**Files:** 只读：`coordination/multi-institution-biography-coordinator.ts`、
`work-packet/institution-work-packet.ts`、`results/biography-url-result.ts`、
`persistence/{index,evidence-reader,review-decision-reader,recovery-reader,
composite-candidate-rehydration,recovery-rereview-coordinator,persistence-test-support}.ts`、
`investigation/investigator-agent-runner.ts`、`evidence/investigator-evidence-runner.ts`、
`reviewer/reviewer-agent-runner.ts`、`recovery/recovery-agent-runner.ts`、
`smoke/recovery-rereview-smoke.ts`、`persistence/work-packet-result-smoke.ts`。

**Interfaces（已确认真实签名）：**
- `MultiInstitutionBiographyCoordinatorDeps = { packetStore: InstitutionWorkPacketStorePort;
  runPacket: PacketWorkflowRunner; concurrency?: number }`
- `PacketWorkflowRunner = (packet: InstitutionWorkPacket) => Promise<PacketRunResult>`
- `PacketRunResult = { packetId; status: "SUCCESS"|"FAILED"; state: InstitutionWorkPacketState; error?: string }`
- `InstitutionWorkPacketStorePort`（异步：createFromFrozenInventory / get / list / updateState /
  setPrimaryPersons），`PostgresInstitutionWorkPacketStore` 实现之；
  `InMemoryInstitutionWorkPacketStore`（同步）供 Runner 使用。
- 4 个阶段 Runner 的 `packetStore` 依赖为同步 `InMemoryInstitutionWorkPacketStore`；
  每个 Runner 内部：`get` 校验状态 → 建 Pi Session → `updateState` 推进 → 返回含 `packet` 的 result。
- `ReviewerResult` 含 `reviews`（canonical Review Records）、`finalDecisions`、`packetFinalState`。
- `RecoveryResult` 含 `recoveryRecords`、`compositeCandidateView`。
- `RecoveryRereviewCoordinatorDeps = { rehydrator; frozenLeadership; frozenSelectedOfficials;
  createRoundTwoSink?; runReviewer: RoundTwoReviewerRun }`。
- `BiographyUrlResultReaderDeps = { packetStore; reviewReader: ReviewDecisionReaderPort;
  loadCandidatePool }`。
- Postgres sink 工厂：`persistence/index.ts` 的 `createPostgresEvidenceSink(db, identity)` /
  `createPostgresReviewDecisionSink(db, identity)` / `createPostgresRecoverySubmissionSink(db, identity)`。

**具体步骤：**
1. 记录 4 个阶段 Runner 的请求/结果类型与状态链（见下文 Task 2）。
2. 记录 coordinator 现有 bounded pool 与 failure isolation（已确认：catch 内写 per-packet FAILED）。
3. 确认 `InMemoryInstitutionWorkPacketStore` 缺 seed 能力 → 需要在 Task 2 加 `seed`。

**Targeted Verification：** 无代码修改；以本计划「Architecture / Interfaces」两节作为验收基线。

**Commit：** 无。

---

### Task 2 — Implement `InstitutionBiographyWorkflowPort` + real Agent workflow composition

**Files：**
- 修改 `packages/agent-runtime/src/work-packet/institution-work-packet.ts`（InMemory store + seed）。
- 新增 `packages/agent-runtime/src/batch/institution-biography-workflow-runner.ts`。

**Interfaces：**

```ts
// institution-work-packet.ts（新增，additive）
export class InMemoryInstitutionWorkPacketStore {
  /** 用既有 packet 内容恢复/seed（Batch Workflow 从 Postgres 恢复 packet 后注入 Runner 链）。 */
  seed(packet: InstitutionWorkPacket): InstitutionWorkPacket; // 纯内存写入，不改既有方法
}

// batch/institution-biography-workflow-runner.ts
export type InstitutionBiographyWorkflowResult = {
  packetId: string;
  institutionId: string;
  institutionName: string;
  status: "RESOLVED" | "PARTIAL" | "UNRESOLVED" | "FAILED";
  packetState: InstitutionWorkPacketState;
  stages: {
    investigation: WorkflowStageOutcome;
    evidence: WorkflowStageOutcome;
    review: WorkflowStageOutcome & { reviewRound: number };
    recovery?: WorkflowStageOutcome & { recoveryRound: number };
    rereview?: WorkflowStageOutcome & { reviewRound: number };
  };
  biographyResult: BiographyUrlResult | null;   // 来自 BiographyUrlResultReader
  failure?: { stage: string; code?: string; message?: string };
  durationMs: number;
};

export type WorkflowStageOutcome = {
  status: string;                 // 阶段 runner 的 status 字符串
  agentSessionId?: string;
  toolCalls: Record<string, { called: boolean; succeeded: boolean }>;
  bochaCalled: boolean;
};

export type WorkflowStageRunners = {            // 测试 seam；默认 = 真实 Runner 包装
  runInvestigator(input: { packetId; store; eventSink }): Promise<InvestigationAgentResult>;
  runEvidence(input: { packetId; store; eventSink; frozenInput }): Promise<InvestigatorEvidenceResult>;
  runReviewer(input: { packetId; store; eventSink; frozenInput; sink: ReviewerDecisionSink }): Promise<ReviewerResult>;
  runRecovery(input: { packetId; store; eventSink; frozenInput }): Promise<RecoveryResult>;
};

export type InstitutionBiographyWorkflowRunnerDeps = {
  skillRuntime: SkillRuntime;
  modelPolicy?: ModelPolicy;
  modelResolver?: PiModelResolver;
  abortSignal?: AbortSignal;
  skill: { name: string; version: string };           // 已解析的 official-biography-evidence identity
  persistence: {
    packetStore: InstitutionWorkPacketStorePort;      // Postgres（真实 batch）/ FakeRepo-backed（测试）
    createEvidenceSink: (id: PostgresEvidenceSinkIdentity) => InvestigatorEvidenceSubmissionSink;
    createReviewSink: (id: PostgresReviewSinkIdentity) => ReviewerDecisionSink;
    createRecoverySink: (id: PostgresRecoverySinkIdentity) => RecoverySubmissionSink;
    evidenceReader: EvidenceReaderPort;
    reviewReader: ReviewDecisionReaderPort;
    reviewRepo: ReviewDecisionSubmissionRepositoryPort;   // 供 CompositeCandidateViewRehydrator
    recoveryRepo: RecoverySubmissionRepositoryPort;
  };
  stages?: WorkflowStageRunners;                    // 测试注入 fake；默认真实
};

export interface InstitutionBiographyWorkflowPort {
  run(packet: InstitutionWorkPacket): Promise<InstitutionBiographyWorkflowResult>;
}
export class InstitutionBiographyWorkflowRunner implements InstitutionBiographyWorkflowPort { ... }
```

**具体步骤：**
1. `InMemoryInstitutionWorkPacketStore.seed(packet)`：`this.packets.set(packet.packetId, packet)`。
2. 默认 `WorkflowStageRunners` 工厂：闭包 `skillRuntime/modelPolicy/modelResolver/abortSignal/
   persistence/skill`，构造 4 个真实 Runner；Evidence/Reviewer/Recovery 分别注入
   `createEvidenceSink` / 传入的 `sink` / `createRecoverySink`（identity 中
   `packetId`、`agentRole`、`skill`；Evidence sink `agentSessionId` 用 `evidence-<packetId>`，
   与 STEP 14 smoke 先验 id 的既有约定一致）。
3. `run(packet)` 编排（状态链 + Postgres mirror 机械推进）：
   - seed 每 Packet 一个 `InMemoryInstitutionWorkPacketStore`（仅该 Packet，session/state 完全隔离）。
   - **Investigator**：`runInvestigator` → COMPLETED 才继续；捕获 `leadership`、`selectedOfficials`；
     mirror `INVESTIGATING(+investigatorSessionId)` → `EVIDENCE_PENDING`；
     用 `extractReviewerPrimaryDecisions(selectedOfficials)` 得 primary1/primary2 → 若非空则
     `packetStore.setPrimaryPersons`（Postgres + InMemory）。
   - **Evidence**：`runEvidence(packetId, store, { leadership, selectedOfficials })` →
     COMPLETED 才继续；捕获 `candidatePool = result.candidates`；mirror
     `EVIDENCE_GATHERING(+investigatorSessionId)` → `READY_FOR_REVIEW`。
   - **Reviewer Round-1**：`runReviewer(..., { leadership, selectedOfficials, candidatePool },
     createReviewSink({ packetId, reviewRound: 1, agentRole: "REVIEWER", skill }))`。
     - `COMPLETED`/`packetFinalState === "POSITION_DECIDED"` → mirror
       `REVIEWING(+investigatorSessionId)` → `POSITION_DECIDED` → 读 Result 返回。
     - `RECOVERY_REQUIRED` → mirror `REVIEWING(+investigatorSessionId)` → `RECOVERY_REQUIRED` → 继续 Recovery。
     - `FAILED` / 其它 → mirror 失败并返回 FAILED（见步骤 5）。
   - **Recovery**：`runRecovery(..., { leadership, selectedOfficials, candidatePool:
     reviewer 输入的原始候选池, reviewRecords: reviewerResult.reviews })` → COMPLETED 才继续；
     mirror `RECOVERING(+investigatorSessionId)` → `READY_FOR_REVIEW`。
   - **Re-review（Round 2）**：构造 `RecoveryRereviewCoordinator({ rehydrator:
     new CompositeCandidateViewRehydrator({evidenceReader, recoveryRepo, reviewRepo}),
     frozenLeadership, frozenSelectedOfficials, createRoundTwoSink: persistence.createReviewSink,
     runReviewer: (input) => stages.runReviewer({ ...input, store }) })` →
     `coordinator.run(packetId, { agentRole: "REVIEWER", skill })` → 按 `reviewerResult` 同 Reviewer
     规则 mirror + 读 Result 返回。
   - **收尾**：用 `BiographyUrlResultReader({ packetStore, reviewReader, loadCandidatePool:
     async (id) => (await rehydrator.rehydrate(id)).compositeCandidateView })` 读最终
     `BiographyUrlResult`（不依赖任何 Agent / LLM）。状态映射：任一阶段 FAILED → `status:"FAILED"`；
     否则按 `biographyResult.status`（RESOLVED/PARTIAL/UNRESOLVED）。
4. **Postgres mirror helper**（机械推进；每步都是合法 `ALLOWED_TRANSITIONS` 链）：
   `mirrorChain(packetId, steps: Array<[state, meta?]>)` —— 逐 `updateState`；失败阶段用
   `failureCode` 作为 meta。
5. **阶段未推进状态**（`MODEL_NOT_CONFIGURED` / `MODEL_NOT_FOUND` / `PACKET_NOT_FOUND` /
   `INVALID_REQUEST` / `PACKET_ALREADY_STARTED`）：不强行改动 Postgres 状态；result.status="FAILED"，
   `failure={stage, code: status, message: reason}`，`packetState` 取当前已知状态。
6. **异常边界**：`run()` 整体 try/catch —— 捕获后返回 `status:"FAILED"` result（含 message，无 secret）；
   不抛给 coordinator（coordinator 另有兜底 catch）。
7. `batch` 目录新增并写入 `index.ts` 不建（直接由 root `index.ts` export 两个文件）。

**Targeted Verification：** `corepack pnpm --filter @stellaris/agent-runtime typecheck`。

**Commit：** 不单独 commit（与 Task 3 同批或按最终结果）。

---

### Task 3 — Wire real workflow executor into `MultiInstitutionBiographyCoordinator`

**Files：**
- 新增 `packages/agent-runtime/src/batch/biography-batch-wiring.ts`。
- 修改 `packages/agent-runtime/src/coordination/multi-institution-biography-coordinator.test.ts`。
- 修改 `packages/agent-runtime/src/index.ts`、`packages/agent-runtime/package.json`。

**Interfaces：**

```ts
export function createBiographyPacketWorkflowRunner(
  workflow: InstitutionBiographyWorkflowPort,
): PacketWorkflowRunner {
  return async (packet) => {
    try {
      const result = await workflow.run(packet);
      return {
        packetId: packet.packetId,
        status: result.status === "FAILED" ? "FAILED" : "SUCCESS",
        state: result.packetState,
        ...(result.failure ? { error: result.failure.message } : {}),
      };
    } catch (error) {
      return { packetId: packet.packetId, status: "FAILED", state: packet.state,
               error: error instanceof Error ? error.message : String(error) };
    }
  };
}
```

**具体步骤：**
1. 新建 `biography-batch-wiring.ts`（如上 adapter；不含任何业务语义）。
2. Coordinator wiring 测试（追加到 `multi-institution-biography-coordinator.test.ts`）：
   - Fake `InstitutionBiographyWorkflowPort`（记录调用 packetId，返回 RESOLVED result）；
   - `runPacket = createBiographyPacketWorkflowRunner(fakeWorkflow)`；
   - `new MultiInstitutionBiographyCoordinator({ packetStore: new PostgresInstitutionWorkPacketStore(
     new FakePacketRepo()), concurrency: 1, runPacket })`；
   - 断言：`results.length === 2`、`workflowCalls` 覆盖两 packetId、`results` 均为 SUCCESS。
   - 同时断言：workflow 抛错时 adapter 返回 `status:"FAILED"`（failure isolation 由 coordinator
     已有 catch 兜底，adapter 再包一层）。
3. `index.ts`：`export * from "./batch/institution-biography-workflow-runner.js";`
   `export * from "./batch/biography-batch-wiring.js";`
4. `package.json`：`"smoke:batch-biography": "tsx src/smoke/batch-biography-smoke.ts"`。

**Targeted Verification：** `corepack pnpm --filter @stellaris/agent-runtime exec vitest run
coordination/multi-institution-biography-coordinator.test.ts`。

**Commit：** 不单独 commit。

---

### Task 4 — Targeted tests + affected-package typecheck + 2-Institution real batch smoke

**Files：**
- 新增 `packages/agent-runtime/src/batch/institution-biography-workflow-runner.test.ts`。
- 新增 `packages/agent-runtime/src/smoke/batch-biography-smoke.ts`、
  `packages/agent-runtime/src/smoke/fixtures/batch-biography-gulou-input.json`。

**具体步骤（测试，6–9 个用例；全部用 Fake stage runners + Fake repos）：**
1. **Workflow happy path**：Investigator COMPLETED → Evidence COMPLETED → Reviewer
   `POSITION_DECIDED` → `biographyResult.status === "RESOLVED"`、两 PRIMARY URL 非空、
   `packetState === "POSITION_DECIDED"`（用现有 Fake repos 建 Postgres 语义 reader/sink）。
2. **Review rework → Recovery → Re-review → RESOLVED**：Round-1 `RECOVERY_REQUIRED` →
   Recovery COMPLETED → Round-2 Reviewer `POSITION_DECIDED` → `RESOLVED`；
   断言 recovery/rereview 阶段出现、review history round 1+2、final 来自 round 2。
3. **Investigator fails → workflow FAILED**：`runInvestigator` 返回 FAILED → result.status
   `"FAILED"`、`failure.stage === "investigation"`。
4. **Coordinator real-workflow wiring**（Task 3 追加的用例）。
5. **Failure isolation regression**：Packet A `runPacket` 抛错 / 返回 FAILED，Packet B SUCCESS →
   batch `results` 含 `A: FAILED`、`B: SUCCESS`（fake workflow port）。
6. **Batch result aggregation**：两 packet RESOLVED → `totalPackets=2 / resolved=2`（经
   `RegionBiographyBatchResult` 或现有结果聚合辅助；见步骤 7）。
7. 新增极薄 `RegionBiographyBatchResult` 聚合 helper（若 coordinator result 已够则不加；
   YAGNI——先评估）。
8. **Session isolation**：两次 `run(packet)` 使用不同 packet → 断言两 packet 的
   `investigatorSessionId`/stage session id 不同、InMemory store 实例不同。
9. **Rehydration（unit 版）**：写 packet + round-1/round-2 review + evidence 到 Fake repos →
   新建 store/reader → `BiographyUrlResultReader.read` 复得相同 Result（复用现有
   `biography-url-result-rehydrate.test.ts` 的既有覆盖，仅补 batch 路径不重复实现）。

**具体步骤（真实 Batch Smoke — `smoke/batch-biography-smoke.ts`）：**
1. 读取 fixture `batch-biography-gulou-input.json`（region `320106`，2 个 INCLUDE Institution）。
2. 检查 `/root/.stellaris-batch-biography-smoke-secrets` 存在（否则返回
   `BATCH_SECRETS_REQUIRED`）；读取并仅 `process.env` 设置：
   `DEEPSEEK_API_KEY / BOCHA_API_KEY / AGENT_MODEL_PROVIDER=deepseek /
   AGENT_MODEL_ID=<fixture/文件中的实际 model，如 deepseek-v4-pro> / WEB_SEARCH_PROVIDER=bocha`。
   只允许 `test -s` + `BATCH_BIOGRAPHY_SMOKE_SECRETS_READY`，**不打印 secret**。
3. `startPostgres()` → `migrateToLatest`（001..006，无新 migration）。
4. `PostgresInstitutionWorkPacketStore` 建 packet（2 个）；共享 `db` 建 Postgres
   evidence/review/recovery sink、reader、rehydrator、resultReader。
5. 共享 `skillRuntime`（reload + resolveSkill）、`ModelPolicy`、`PiModelResolver`；
   构造默认真实 `WorkflowStageRunners`；`InstitutionBiographyWorkflowRunner`；
   `MultiInstitutionBiographyCoordinator({ packetStore, runPacket:
   createBiographyPacketWorkflowRunner(workflow), concurrency: 2 })`。
6. 整体 `AbortController` budget（默认 20 分钟）；`coordinator.run(frozen, { regionCode })`。
7. 构建简洁报告：region/inventory FROZEN/packet_count/coordinator/real_workflow_executor/
   bounded_concurrency、每 Packet（institution、各 stage status + session id、PRIMARY_1/2
   decision + biographyUrl、result_source=LATEST_FROZEN_APPROVED_REVIEW）、
   search_web/bocha/fetch_or_render/inspect/submit_* called 汇总、batch total/resolved/
   unresolved/failed、duration。不输出模型对话 / HTML / secret / search snippet。
8. **重水合 Gate**：`db.destroy()` → `createDb(pg.config)` 新实例 →
   `new PostgresInstitutionWorkPacketStore / PostgresReviewDecisionReader / PostgresEvidenceReader` →
   `resultReader.read(packetA/B)` → `packet_a_reloaded/result_a_rebuilt/...`、
   `same_results_after_reload` 对比 batch 时结果。
9. **清理**：`db2/db.destroy()` → `pg.stop()` → `rm -f` secret 文件 → `unset` 上述 env。
   （不在 smoke 内做 docker prune。）
10. 产出 `formatBatchBiographySmokeResult`，entry-point 化与既有 smoke 一致。

**Targeted Verification（fresh 只跑这些）：**
- `vitest run batch/institution-biography-workflow-runner.test.ts`
- `vitest run coordination/multi-institution-biography-coordinator.test.ts`
- `corepack pnpm --filter @stellaris/agent-runtime typecheck`
- （若修改 `@stellaris/db` 或 `@stellaris/agent-tools` 才额外 typecheck 对应包）
- 一次 `corepack pnpm --filter @stellaris/agent-runtime smoke:batch-biography`

**Commit：** 不单独 commit。

---

### Task 5 — Docs + architecture self-review + secret cleanup + commit

**Files：**
- 新增 `docs/agent-runtime/region-batch-biography-collection-orchestrator.md`（简洁：
  Purpose / Skill Scope: BIOGRAPHY_URL_ONLY / Single-Institution Workflow Composition /
  InstitutionBiographyWorkflowPort / MultiInstitutionBiographyCoordinator Reuse /
  Bounded Concurrency / Session Isolation / Failure Isolation / BiographyUrlResult Projection /
  Persistent Packet Result Rehydration / 2-Institution Smoke / Out of Scope）。

**具体步骤：**
1. 写 STEP 16 文档（简洁，Out of Scope 明确列 Other Evidence Types / Region-specific adapters /
   Retry-Resume / Graphile / Frontend / Excel / Production Deployment）。
2. **Secret Scan**：`git status --short` + `git diff` 确认 DEEPSEEK/BOCHA key 不在 tracked/
   modified 文件；`rm -f /root/.stellaris-batch-biography-smoke-secrets` 并确认不存在。
3. **Implementation Self Review**（对照本计划 Global Constraints + 附件 Checklist）：
   - 无第二个 Batch Coordinator、无复制 Runner、无 batch 内 Search/选 PRIMARY/选 URL；
   - 每 Packet 独立 session / store / eventSink；Postgres identity 按 packet/reviewRound 隔离；
   - Biography Result 仍来自 latest frozen APPROVED review；无最终 URL 不伪造；
   - 无地区-specific / 无任前公示等业务 / 无 Multi Evidence；无 DeepSeek/Bocha hardcode；
   - 未改 Skill / 未新 Migration / 未动 Frontend/Excel/Graphile/Production DB。
4. **Commit**（尽量一个）：`git add` 新文件 + 修改文件（不含遗留 untracked plan
   `2026-08-14-recovery-agent-foundation.md`）→
   `git commit -m "feat(agent): run regional biography collection batches"`。

**Targeted Verification：** `git status --short` 只剩预期文件；`git log -1 --oneline`。

**Commit：** 最终 commit。

---

## Targeted Verification（汇总 / 只 fresh 跑）

- `vitest run batch/institution-biography-workflow-runner.test.ts`
- `vitest run coordination/multi-institution-biography-coordinator.test.ts`
- `corepack pnpm --filter @stellaris/agent-runtime typecheck`
- `@stellaris/db` / `@stellaris/agent-tools` typecheck：仅实际修改时
- 一次 `smoke:batch-biography`（2-Institution Real Batch）

**不跑**：Full Workspace Tests、Crawler/Backend/Playwright Full Tests、FULL Inventory Real Smoke、
单独 Investigator/Evidence/Reviewer/Recovery Real Smoke、旧 Persistence Smoke、Deployment Tests、
Production Acceptance。

## Plan Self-Review（Claude 自检后记录）

- [x] 没有创建第二个 Batch Coordinator（复用 `MultiInstitutionBiographyCoordinator`）
- [x] 没有复制 Investigator/Evidence/Reviewer/Recovery Runner（新增的是编排层 + 薄 adapter）
- [x] Batch Workflow 不重新选择 PRIMARY / 不做 Candidate Ranking / 不自己 Search / Fetch/Inspect
- [x] 每 Packet 有独立 Pi Sessions / 独立 InMemory store / 独立 eventSink；两 Institution 不共享
      Agent Conversation / SubmissionSink / ToolEvent 状态
- [x] Postgres 持久化 identity 按 packetId / sessionId / reviewRound / recoveryRound 隔离
- [x] Biography Result 仍来自 Latest Frozen APPROVED Review（`BiographyUrlResultReader`）
- [x] unresolved 不伪造成 URL
- [x] 无地区-specific logic / 无省市区 Adapter / 无 Multi Evidence Type / 无任前公示等业务
- [x] DeepSeek / Bocha 不 hardcode（模型=ModelPolicy，Search=Registry）
- [x] Frontend / Excel / Graphile / Production DB 不改
- [x] 不新增 DB Migration、不建 batch_run 表
- [x] 不跑 Full Workspace Tests
