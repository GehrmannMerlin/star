# Web Task Runtime and Graphile Integration Implementation Plan

Date: 2026-08-14
Step: STEP 17 — Web Task Runtime and Graphile Integration
Branch: refactor/pi-agent-runtime-server-20260813
Start HEAD: b21e320ce817169307cd3f606c62fd40b434a7f0
Execution mode: INLINE_FAST (user pre-authorized)

## Goal

Connect the already-proven STEP 16 Agent batch runtime (`MultiInstitutionBiographyCoordinator` +
`InstitutionBiographyWorkflowRunner`) to the existing Web project's Task API + Graphile Worker, so the
real backend chain becomes:

```
POST /api/tasks
  → Persist Task (task_run + target_scope / institution_snapshot)
  → Graphile enqueue (stellaris_task, payload {taskRunId})
  → Worker claim (atomic QUEUED→RUNNING)
  → Biography Task Execution Service (Region Biography Collection Runtime)
  → Progress (task_run progress columns + SSE)
  → Biography Result (RegionBiographyBatchResult)
  → Task Terminal Status (COMPLETED / PARTIAL_COMPLETED / FAILED)
```

Skill business scope is strictly **BIOGRAPHY_URL_ONLY**. No 任前公示 / 代理任命 / 选举任命 / 离任 /
Multi-Evidence-Type / other 任免事件 Evidence. No Excel. No Frontend change. No Production deploy.

## Architecture

Current (legacy crawler pipeline, unchanged):
`POST /api/tasks` (task-routes.ts) → persist → `enqueueTask(task)` → Graphile `stellaris_task`
(queue.ts `runTaskJob`) → route by `task.mode` → `runTaskPipeline` (TARGETED) /
`runMultiInstitutionPipeline` (FULL single-scope) / `runMultiRegionPipeline` (FULL multi-scope).

New (STEP 17, minimal adapter — reuse the same job boundary, swap the executor):
`runTaskJob` gains an optional `biographyExecutor`. When the server is configured with
`STELLARIS_TASK_RUNTIME=biography`, TARGETED and FULL_INSTITUTION(single scope) tasks route to
`BiographyTaskExecutionService` instead of the legacy drivers. Multi-scope FULL_INSTITUTION stays on
`runMultiRegionPipeline`. When no biography executor is configured (tests / legacy), existing routing
is preserved unchanged.

`BiographyTaskExecutionService` orchestration only — no business semantics:

```
load task → terminal fast-path → atomic claim (PENDING|PREPARING → PREPARING + started_at)
→ resolve region (target_scope first row)
→ resolve inventory:
    TARGETED        → build 1-record InventorySubmissionPayload from institution_snapshot
    FULL_INSTITUTION→ InventoryAgentRunner FULL (Pi + Skill) → frozen InventorySubmissionPayload
→ MultiInstitutionBiographyCoordinator({packetStore, concurrency, runPacket})
    runPacket = createBiographyPacketWorkflowRunner(InstitutionBiographyWorkflowRunner, onResult)
→ onResult per packet → incrementProcessed + SSE task.progress_changed
→ buildRegionBiographyBatchResult → deterministic terminal projection
    → task_run.complete(COMPLETED | PARTIAL_COMPLETED | FAILED)
    → task_run.result_summary (jsonb) = RegionBiographyBatchResult + taskId/regionName
    → SSE task.completed / task.failed
```

Result SSoT unchanged: PRIMARY Biography URL facts remain in `review_decision_submission` (latest
frozen APPROVED review). `result_summary` is an aggregation/projection only.

## Tech Stack

- Fastify 5.11.0 (`apps/backend`), graphile-worker 0.17.3 (`apps/backend/src/workers/queue.ts`), pg 8.22.0.
- Kysely 0.29.4 + Postgres 18 (Testcontainers `packages/db/src/testing/pg.ts`).
- `@stellaris/agent-runtime` (workspace) — reused as-is: `InventoryAgentRunner`,
  `MultiInstitutionBiographyCoordinator`, `InstitutionBiographyWorkflowRunner`,
  `createBiographyPacketWorkflowRunner`, `buildRegionBiographyBatchResult`,
  `PostgresInstitutionWorkPacketStore`, `createPostgres*Sink`, `createRehydrationReaders`,
  `SkillRuntime`, `ModelPolicy`, `PiModelResolver`, `OFFICIAL_BIOGRAPHY_SKILL_NAME`.
- Vitest 4.1.10.

## Global Constraints

1. Reuse `POST /api/tasks` — no second task API, no `/api/v2/tasks`, no `/api/agent-tasks`.
2. Reuse Graphile `stellaris_task` boundary — no second worker framework (no BullMQ/Celery/etc.).
3. Graphile job payload stays `{ taskRunId }` only. No secrets, no model config, no inventory.
4. No `model/provider/apiKey/searchProvider` fields on any request; server-side env config only.
5. Do NOT modify Biography Agent business logic (Investigator/Evidence/Reviewer/Recovery/Coordinator).
6. PARTIAL_COMPLETED is a legal terminal. Reviewer legitimately finding no admissible URL =
   business UNRESOLVED, never runtime FAILED. No fabricated URLs.
7. Task Terminal Status is a deterministic projection — never decided by an LLM.
8. Duplicate-execution protection via atomic DB claim; no distributed lock framework.
9. No retry/resume this step (deferred). No Excel (Step 18). No frontend (later step).
10. All work on the dev worktree `/opt/Stellaris-PiAgent-Dev`; production untouched.
11. No secrets in Git/logs/job payload/task row. Temporary smoke secrets in
    `/root/.stellaris-web-task-smoke-secrets` (600), removed after smoke.
12. No region-specific code (`if regionCode === ...`) in runtime.

## File Structure

New files:
- `packages/db/src/migration-007-task-runtime-result.ts` — `task_run.result_summary jsonb`.
- `packages/db/src/repos/task-run.ts` — add `claimTask`, `setProgress`, `setResultSummary`.
- `apps/backend/src/workers/biography-task-service.ts` — `BiographyTaskExecutionService` + projections.
- `apps/backend/src/workers/biography-task-service.test.ts` — executor + projection + progress tests.
- `apps/backend/src/workers/web-task-graphile.e2e.test.ts` — real-PG HTTP→Graphile→executor wiring test.
- `apps/backend/src/scripts/web-task-biography-smoke.ts` — real one-institution HTTP→Graphile→Agent smoke.
- `docs/agent-runtime/web-task-runtime-graphile-integration.md` — docs.
- `docs/superpowers/plans/2026-08-14-web-task-runtime-graphile-integration.md` — this plan.

Modified files:
- `packages/db/src/migration-provider.ts` — register migration-007.
- `packages/db/src/schema.ts` — add `result_summary` to `TaskRunTable` + `TaskRunRow`.
- `packages/contracts/src/task.ts` — add `BiographyTaskResultView` schema (+ index.ts re-export).
- `apps/backend/src/workers/queue.ts` — `WorkerDeps.biographyExecutor`, `runTaskJob` routing.
- `apps/backend/src/workers/queue.test.ts` — biography routing tests.
- `apps/backend/src/server.ts` — build executor when `STELLARIS_TASK_RUNTIME=biography`, pass to worker.
- `apps/backend/src/contracts/task-routes.ts` — add `GET /api/tasks/:id/biography-result`.
- `apps/backend/package.json` — add `@stellaris/agent-runtime` workspace dep + smoke script.

## Tasks

### Task 1 — DB + task-run repository primitives

Files:
- `packages/db/src/migration-007-task-runtime-result.ts`
- `packages/db/src/migration-provider.ts`
- `packages/db/src/schema.ts`
- `packages/db/src/repos/task-run.ts`
- `packages/db/src/repos/repos.test.ts` (extend: repository unit tests)

Interfaces:
- Migration 007 `2026-08-14-task-runtime-result`: `ALTER TABLE task_run ADD COLUMN result_summary jsonb`
  (nullable). Down: drop column.
- `TaskRunRepository.claimTask(taskRunId: string): Promise<TaskRunRow | undefined>` —
  `UPDATE task_run SET status='PREPARING', started_at=now() WHERE id=? AND status IN ('PENDING','PREPARING') RETURNING *`.
  Returns undefined when another worker claimed or status is not claimable → duplicate protection.
- `TaskRunRepository.setProgress(taskRunId, patch: { totalInstitutions?; processedInstitutions?; reviewedSlots?; recoveryCount?; blockedCount? }): Promise<TaskRunRow>`.
- `TaskRunRepository.setResultSummary(taskRunId, summary: unknown): Promise<TaskRunRow>` —
  `UPDATE task_run SET result_summary=:summary WHERE id=?`.

Steps:
1. Add migration file following `migration-006` pattern; register in `migration-provider.ts` + `LATEST_MIGRATION_NAME`.
2. Add `result_summary: unknown | null` to `TaskRunTable` in `schema.ts`.
3. Add the three repository methods to `TaskRunRepository`.
4. Unit-test the SQL via `startPostgres` (disposable PG) in `repos.test.ts` — insert task via
   `createWithIdempotency`, claim twice (second returns undefined), setProgress, setResultSummary round-trip,
   migrate to 007 on a fresh DB.

Targeted Verification:
- `cd /opt/Stellaris-PiAgent-Dev && corepack pnpm --filter @stellaris/db typecheck && corepack pnpm --filter @stellaris/db test` (db package only).

Commit: no standalone commit — folded into final code commit (keeps STEP 17 to one code commit).

### Task 2 — Biography Task Execution Service

Files:
- `apps/backend/src/workers/biography-task-service.ts`
- `apps/backend/src/workers/biography-task-service.test.ts`

Interfaces (in `biography-task-service.ts`):

```ts
export type BiographyTaskTerminalStatus = "COMPLETED" | "PARTIAL_COMPLETED" | "FAILED";

export type BiographyTaskExecutionServiceDeps = {
  db: ReturnType<typeof createDb>;
  repos: Repositories;
  emit: (taskId: string, e: SseEvent) => void;
  skillRuntime: SkillRuntime;
  modelPolicy?: ModelPolicy;
  modelResolver?: PiModelResolver;
  inventoryRunner?: Pick<InventoryAgentRunner, "run">;      // test seam; real default built in ctor
  workflow?: InstitutionBiographyWorkflowPort;              // test seam; real runner built in ctor
  concurrency?: number;                                     // default 2 (DEFAULT_BIOGRAPHY_COORDINATOR_CONCURRENCY)
  abortSignal?: AbortSignal;                                // dev budget / cancel propagation (minimal)
};

export class BiographyTaskExecutionService {
  constructor(deps: BiographyTaskExecutionServiceDeps);
  async run(taskRunId: string): Promise<void>;
}
```

Deterministic pure functions (exported for tests):
- `projectTaskTerminalStatus(batch: RegionBiographyBatchResult): BiographyTaskTerminalStatus`
  - `totalPackets === 0` → `FAILED`
  - `failedPackets === totalPackets` → `FAILED` (all runtime-failed, no usable business result)
  - `resolvedPackets === totalPackets` → `COMPLETED`
  - otherwise → `PARTIAL_COMPLETED` (includes business-UNRESOLVED-only and mixed; UNRESOLVED ≠ failure)
- `buildTargetedFrozenInventory(snapshot, regionLevel): InventorySubmissionPayload`
  - `{ institution_id: snapshot.id, standard_name: snapshot.official_name,
       administrative_level: mapLevel(regionLevel), core_institution_type: snapshot.institution_type,
       decision: "INCLUDE" }`
  - `mapLevel`: `province→PROVINCIAL`, `city→PREFECTURE`, `county→COUNTY`, `town→COUNTY`.
- `buildTaskBiographyResultSummary(taskRunId, regionCode, regionName, batch): TaskResultSummaryRow`
  - `{ taskId, regionCode, regionName, ...batch }`.

Steps:
1. Ctor builds real `workflow` (if not injected): `InstitutionBiographyWorkflowRunner` with persistence
   assembled from `db`/`repos` exactly like the STEP 16 smoke (`PostgresInstitutionWorkPacketStore`,
   `createPostgresEvidenceSink`, `createPostgresReviewDecisionSink`, `createPostgresRecoverySubmissionSink`,
   `createRehydrationReaders(db)`).
2. Ctor builds real `inventoryRunner` (if not injected): `new InventoryAgentRunner({ skillRuntime, modelPolicy, modelResolver })`.
3. `run(taskRunId)`:
   - `findById`; if missing throw `任务不存在`; if terminal (`COMPLETED/PARTIAL_COMPLETED/FAILED/CANCELLED/CANCELLING`) return (no-op).
   - `claimTask`; if `undefined` return (another worker owns it → duplicate protection).
   - emit `task.state_changed` PREPARING; resolve region from `targetScope.listByTask` first row.
   - TARGETED: `buildTargetedFrozenInventory` from `institutionSnapshot.listByTask` (require ≥1 → else throw).
   - FULL_INSTITUTION: `inventoryRunner.run({ regionCode, mode: "FULL" })`; non-COMPLETED → mark FAILED
     with structured `error_message`, emit `task.failed`, return (no rethrow). emit `task.state_changed` PREPARING→CRAWLING after freeze.
   - emit `task.state_changed` CRAWLING; `setProgress({ totalInstitutions: packets.length })` after coordinator creates packets.
   - Coordinator: `new MultiInstitutionBiographyCoordinator({ packetStore, concurrency, runPacket:
       createBiographyPacketWorkflowRunner(workflow, onResult) })`.
   - `onResult`: `incrementProcessed(taskRunId)` + emit `task.progress_changed { processedInstitutions, totalInstitutions }`.
   - After coordinator.run: collect workflow results (map via collected Map by packetId), `buildRegionBiographyBatchResult`,
     `setResultSummary(buildTaskBiographyResultSummary(...))`, `setProgress({ reviewedSlots })`,
     `complete(taskRunId, projectTaskTerminalStatus(batch))`, emit `task.completed`/`task.failed` with `statusZh`.
   - Catch: `complete(taskRunId, "FAILED", redactedMessage)` then rethrow (Graphile retry → terminal fast-path no-ops).
4. All business outcomes return without rethrow; only infra errors rethrow.

Tests (targeted, fakes only — no real agent):
- FULL integration: fake inventoryRunner returns 2 INCLUDE records; fake workflow returns RESOLVED + PARTIAL
  → `projectTaskTerminalStatus` = PARTIAL_COMPLETED; task row status + result_summary + progress 2/2.
- COMPLETED: fake workflow 2 RESOLVED → COMPLETED.
- FAILED: fake workflow 2 FAILED → FAILED.
- all-UNRESOLVED → PARTIAL_COMPLETED (business unresolved ≠ runtime failure).
- TARGETED: one snapshot row → 1 packet → RESOLVED → COMPLETED.
- Progress projection: 0/2 → 1/2 → 2/2 observed via emit + task_run counts.
- Claim gate: first `claimTask` succeeds, second returns undefined → single execution.
- Result read without LLM: after run, `getBiographyResult(taskRunId)` (reads `result_summary`) is non-null.

Targeted Verification:
- `corepack pnpm --filter @stellaris/backend typecheck`
- `corepack pnpm --filter @stellaris/backend test -- biography-task-service` (vitest file filter)

### Task 3 — Graphile worker + server wiring

Files:
- `apps/backend/src/workers/queue.ts`
- `apps/backend/src/workers/queue.test.ts`
- `apps/backend/src/server.ts`
- `apps/backend/package.json`

Interfaces:
- `WorkerDeps.biographyExecutor?: Pick<BiographyTaskExecutionService, "run">`.
- `runTaskJob`: if `deps.biographyExecutor` and `task.mode === "TARGETED"` or
  (`FULL_INSTITUTION` with `targetScope` count === 1) → `await deps.biographyExecutor.run(taskRunId)` and return.
  Otherwise existing mode switch (multi-scope FULL → `runMultiRegionPipeline`; legacy when no executor).

Steps:
1. `queue.ts`: add optional `biographyExecutor` to `WorkerDeps`; route in `runTaskJob` before the legacy switch.
2. `server.ts`: when `process.env.STELLARIS_TASK_RUNTIME === "biography"`, construct
   `BiographyTaskExecutionService` (requires `db` + `repos`, async `PiModelResolver.create()`, `SkillRuntime`,
   `ModelPolicy`) and pass it to the `runWorker` call (worker path only). When env absent/legacy → no executor
   (existing behavior/tests unchanged).
3. `package.json`: add `"@stellaris/agent-runtime": "workspace:*"` dependency; add
   `"smoke:web-task-biography": "tsx src/scripts/web-task-biography-smoke.ts"` script.

Tests:
- `queue.test.ts`: when `biographyExecutor` present, TARGETED routes to it (not `runTaskPipeline`);
  FULL single-scope routes to it; multi-scope FULL still routes to `runMultiRegionPipeline`.
  Existing tests (no executor) stay green unchanged.

Targeted Verification:
- `corepack pnpm --filter @stellaris/backend typecheck`
- `corepack pnpm --filter @stellaris/backend test -- queue`

### Task 4 — API read surface + real-PG e2e wiring test

Files:
- `packages/contracts/src/task.ts` (+ index.ts re-export)
- `apps/backend/src/contracts/task-routes.ts`
- `apps/backend/src/workers/web-task-graphile.e2e.test.ts`

Interfaces:
- `BiographyTaskResultView` (TypeBox): `{ taskId, regionCode, regionName?, status: BiographyTaskTerminalStatus,
  totalPackets, resolvedPackets, partialPackets, unresolvedPackets, failedPackets,
  results: [{ packetId, institutionId, institutionName, status, packetState,
    primary1: { decisionStatus, biographyUrl } | null, primary2: { decisionStatus, biographyUrl } | null }] }`.
- `GET /api/tasks/:id/biography-result` → `{ taskId, taskStatus, biographyResult: BiographyTaskResultView | null }`.
  Reads `task_run.result_summary` only — no LLM, no agent tables. `biographyResult: null` when task has none.

Steps:
1. Add TypeBox schema + type to `contracts/src/task.ts`.
2. `task-routes.ts`: register `GET /api/tasks/:id/biography-result` (auth + ownership via `requireOwnedTask`),
   read `taskRun` row, `JSON.parse(result_summary)`, return view.
3. `web-task-graphile.e2e.test.ts`: disposable PG (`startPostgres`), `pg.Pool`, `createDb`, `migrateToLatest`,
   `buildApp({ db, pgPool })`, `runWorker` with a **fake** `biographyExecutor` (records invocations), then:
   - `POST /api/tasks` (TARGETED) → `idempotencyResult: "created"`, task row persisted, `status=PENDING`.
   - assert Graphile job enqueued (`task:{id}:TARGETED:v1`) and worker handler invoked the executor.
   - assert duplicate delivery (call `runTaskJob` twice on same id) → executor invoked exactly once
     (terminal/claimed fast-path).
   - `POST` again with same idempotency key → `replayed`, same id, executor NOT invoked again.
   - No real Agent anywhere in this test.

Targeted Verification:
- `corepack pnpm --filter @stellaris/backend typecheck && corepack pnpm --filter @stellaris/contracts typecheck`
- `corepack pnpm --filter @stellaris/backend test -- web-task-graphile`

### Task 5 — Real E2E smoke + docs + self-review + cleanup + commit

Files:
- `apps/backend/src/scripts/web-task-biography-smoke.ts`
- `docs/agent-runtime/web-task-runtime-graphile-integration.md`

Smoke CLI (real chain, isolated dev runtime):
1. Require `/root/.stellaris-web-task-smoke-secrets` (600) containing `DEEPSEEK_API_KEY`,
   `BOCHA_API_KEY`, `AGENT_MODEL_PROVIDER=deepseek`, `AGENT_MODEL_ID=<verified tool-calling model>`,
   `WEB_SEARCH_PROVIDER=bocha`. Load env without printing. Output `WEB_TASK_SMOKE_SECRETS_READY`.
2. `startPostgres` (disposable), `createDb`, `migrateToLatest`, `pg.Pool`.
3. Build real biography executor (SkillRuntime reload, ModelPolicy, PiModelResolver, real sinks).
4. `runWorker` (Graphile, biography executor) + `buildApp({ db, pgPool })` listen on `127.0.0.1:<random port>`,
   with `STELLARIS_TASK_RUNTIME=biography`.
5. Real HTTP `POST /api/tasks` (header `x-ifc-user-id: smoke-user`), TARGETED, region 320106 南京市鼓楼区,
   institution 鼓楼区人民政府 (from STEP 16 verified fixture `batch-biography-gulou-input.json`, Packet A,
   the institution that reached both-PRIMARY RESOLVED), `institutionType: government`.
6. Poll real `GET /api/tasks/:id` until terminal (COMPLETED or PARTIAL_COMPLETED); record intermediate statuses.
7. `GET /api/tasks/:id/biography-result` → assert ≥1 real `https://` biography URL (from
   `BiographyUrlResultReader` projection via `result_summary`), primary_1/primary_2 statuses, counts.
8. Remove secrets file + `unset` env; `GET` again → still readable (no LLM required for result read).
9. Stop worker, close app, stop PG (precise container stop — no docker prune).
10. Report structure per STEP 17 contract (task terminal, primary urls, tool evidence, duration).

Smoke institution comes only from the verified fixture/smoke data — no region-specific code in runtime.

Docs (`docs/agent-runtime/web-task-runtime-graphile-integration.md`): Purpose; POST /api/tasks contract
preservation; Task persistence; Graphile job payload (taskId only); worker claim / duplicate protection;
Biography Task Execution Service; FULL Inventory path; TARGETED path; MultiInstitutionBiographyCoordinator
reuse; Task progress projection; COMPLETED/PARTIAL_COMPLETED/FAILED semantics (PARTIAL = agent workflow
completed but some officials lacked an acceptable biography URL — NOT a runtime failure, matching STEP 16);
Biography result projection; one-institution HTTP E2E smoke; Out of Scope (retry/resume, full-region real
batch, Excel, frontend binding, production deploy).

Self-review checklist (run after code, fix issues found, re-run only affected targeted tests):
- POST /api/tasks contract unchanged; no model/provider/apiKey added.
- HTTP returns immediately (no sync agent wait).
- Graphile payload `{ taskRunId }` only; no secrets.
- No second Task API / worker framework / agent pipeline.
- FULL still uses InventoryAgentRunner; TARGETED reuses same coordinator/workflow backend.
- PARTIAL_COMPLETED not mapped to FAILED; UNRESOLVED not fabricated.
- result_summary is aggregation only (SSoT = latest frozen APPROVED review).
- No hardcoded DeepSeek/Bocha/region; skill/frontend/excel/production untouched.

Cleanup + commit:
- Remove `/root/.stellaris-web-task-smoke-secrets`; unset env; stop dev backend/worker/PG.
- Secret scan of git-tracked/modified files for both keys.
- Single code commit: `feat(agent): integrate biography runtime with web tasks`
  (docs committed separately only if cleaner; otherwise one commit).

Targeted Verification (final, fresh):
- A. `corepack pnpm --filter @stellaris/backend test -- biography-task-service web-task-graphile queue`
- B. `corepack pnpm --filter @stellaris/agent-runtime typecheck` (only if agent-runtime shared code touched — intended NOT to be)
- C. `corepack pnpm --filter @stellaris/db typecheck && corepack pnpm --filter @stellaris/db test`
- D. `corepack pnpm --filter @stellaris/contracts typecheck`
- E. `corepack pnpm --filter @stellaris/backend typecheck`
- F. One real HTTP→Graphile→Pi Agent→Task Result smoke (one institution).

## Targeted tests to add (≈8–11)

1. claimTask duplicate guard (unit, repo)
2. migration 007 applies + result_summary round-trip (repo)
3. FULL → PARTIAL_COMPLETED projection (executor fake)
4. FULL → COMPLETED projection (executor fake)
5. FULL → FAILED (all runtime-failed) projection (executor fake)
6. all-UNRESOLVED → PARTIAL_COMPLETED (executor fake)
7. TARGETED → COMPLETED via snapshot (executor fake)
8. progress 0/2→1/2→2/2 + result readable without LLM (executor fake)
9. queue biography routing (TARGETED/FULL-single → executor; multi → legacy)
10. web-task-graphile e2e: POST → persisted → enqueued → worker invokes executor; duplicate delivery → single run; idempotency replay no re-run.

Not re-run: Investigator/Evidence/Reviewer/Recovery/Coordinator test suites, full workspace, crawler full,
playwright full, full-region real batch, 2-institution real batch.
