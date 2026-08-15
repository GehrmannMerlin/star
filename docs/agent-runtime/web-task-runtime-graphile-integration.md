# Web Task Runtime and Graphile Integration

Date: 2026-08-14 · Step 17 · Branch `refactor/pi-agent-runtime-server-20260813`

## Purpose

Wire the already-proven STEP 16 Biography Agent batch runtime
(`MultiInstitutionBiographyCoordinator` + `InstitutionBiographyWorkflowRunner`) into the existing Web
project's Task API + Graphile Worker, so the real backend task chain becomes:

```
POST /api/tasks
  → Persist Task (task_run + target_scope / institution_snapshot)
  → Graphile enqueue (stellaris_task, payload {taskRunId})
  → Worker claim (atomic PENDING → PREPARING + started_at)
  → BiographyTaskExecutionService (Region Biography Collection Runtime)
  → Progress (task_run progress columns + SSE)
  → Biography Result (RegionBiographyBatchResult → task_run.result_summary)
  → Task Terminal Status (COMPLETED / PARTIAL_COMPLETED / FAILED)
```

Skill business scope stays strictly **BIOGRAPHY_URL_ONLY** (官员个人简历/个人信息页面 URL 搜集、核验、
最终结果)。No 任前公示 / 代理任命 / 选举任命 / 离任 / Multi-Evidence-Type.

## POST /api/tasks Contract Preservation

- `POST /api/tasks` is reused as-is — no `/api/v2/tasks`, no `/api/agent-tasks`, no second task API.
- The user request never carries `model` / `provider` / `apiKey` / `searchProvider`. Provider-neutral:
  model comes from `ModelPolicy` (server env `AGENT_MODEL_PROVIDER`/`AGENT_MODEL_ID`), search from the
  `SearchProvider` registry (server env `WEB_SEARCH_PROVIDER`).
- HTTP returns immediately (task persisted + enqueued); it never waits for the Pi Agent.

## Task Persistence

- `task_run` row (idempotent via `(owner_user_id, idempotency_key)`), plus `target_scope`
  (TARGETED / FULL) and `institution_snapshot` (TARGETED specified institution).
- Progress reuses existing `task_run` columns: `total_institutions`, `processed_institutions`,
  `reviewed_slots`, `recovery_count`, `blocked_count`.
- Migration 007 adds one nullable `task_run.result_summary jsonb` column for the Task Result
  projection (aggregation only — the PRIMARY Biography URL facts remain in `review_decision_submission`,
  the latest frozen APPROVED review is the single source of truth).

## Graphile Job Payload

- Job `stellaris_task`, payload `{ taskRunId }` only. No API keys, no model config, no inventory,
  no candidate pool. The worker reads the task request snapshot from the DB by `taskRunId`.

## Worker Claim / Duplicate Protection

- `TaskRunRepository.claimTask`: atomic `UPDATE task_run SET status='PREPARING', started_at=now()
  WHERE id=? AND status='PENDING' RETURNING *`. Only one worker wins.
- A second delivery for a task already in `PREPARING`/`CRAWLING`/terminal gets `undefined` → no second
  Agent workflow. Terminal tasks are a no-op fast-path in `runTaskJob`.
- No distributed lock framework (DB atomic state transition is enough). Retry/resume stays Deferred.

## Biography Task Execution Service

`apps/backend/src/workers/biography-task-service.ts` — orchestration only:

1. Load task → terminal fast-path → `claimTask`.
2. Resolve region from `target_scope` first row.
3. Resolve frozen inventory:
   - **TARGETED**: `buildTargetedFrozenInventory` from the `institution_snapshot` (1 INCLUDE record,
     `administrative_level` mapped from region level). No search — the specified institution is the boundary.
   - **FULL_INSTITUTION**: `InventoryAgentRunner` FULL (Pi + Skill discovers institutions) → frozen
     `InventorySubmissionPayload`. Never hardcoded.
4. `MultiInstitutionBiographyCoordinator` (bounded concurrency, default 2) with
   `createBiographyPacketWorkflowRunner(InstitutionBiographyWorkflowRunner, onResult)`.
5. Per-packet `onResult` → `incrementProcessed` + SSE `task.progress_changed`.
6. `buildRegionBiographyBatchResult` → deterministic `projectTaskTerminalStatus` → write
   `result_summary`, progress counts, `complete()`.

The service holds no business rules (no ranking, no PRIMARY selection, no URL selection, no
region-specific code). The full Agent chain (Investigator → Evidence → Reviewer → Recovery →
Re-review → `BiographyUrlResultReader`) is unchanged and reused.

## FULL Inventory Path

`FULL_INSTITUTION` (single scope) → `InventoryAgentRunner` FULL → frozen inventory →
`MultiInstitutionBiographyCoordinator`. Verified by a targeted integration test with a fake inventory
runner + fake workflow (no real agent this step; a full-region real run is Deferred).

## TARGETED Path

`TARGETED` (specified institution) → 1-record frozen inventory from the snapshot → the **same**
`MultiInstitutionBiographyCoordinator` / `InstitutionBiographyWorkflowRunner` — no second agent pipeline.

## MultiInstitutionBiographyCoordinator Reuse

Unchanged. The Web Task runtime only adapts it into the task lifecycle (progress + terminal projection).

## Task Progress Projection

- `task_run.status`: PENDING → PREPARING (claim) → CRAWLING (after inventory freeze) → terminal.
- `total_institutions` set to the INCLUDE packet count; `processed_institutions` incremented per packet
  completion; `reviewed_slots` = resolved PRIMARY slots.
- SSE (in-memory per task, `/api/tasks/:id/events`): `task.state_changed`, `task.progress_changed`,
  `task.completed` / `task.failed`. Per-tool events (`search_web`/`fetch_page`/`inspect_page`) are NOT
  emitted as task progress — they already have ToolEvent provenance.

## COMPLETED / PARTIAL_COMPLETED / FAILED semantics

Deterministic projection (`projectTaskTerminalStatus`), never LLM-decided:

- `resolvedPackets === totalPackets` → **COMPLETED**
- `failedPackets === totalPackets` (all runtime-failed, no usable result) → **FAILED**
- `totalPackets === 0` → **FAILED**
- otherwise → **PARTIAL_COMPLETED**

**PARTIAL_COMPLETED** means the Agent workflow completed normally, but some officials had no
`Biography URL` accepted by the Reviewer (business UNRESOLVED). It is NOT a runtime failure, and it is
NOT auto-retried / looped into FAILED. This matches the real STEP 16 batch result (Packet B
UNRESOLVED). `UNRESOLVED` never fabricates a URL.

## Biography Result Projection

- Task result summary (`GET /api/tasks/:id/biography-result`) is read from `task_run.result_summary`
  (JSON) — no LLM, no DeepSeek, no Bocha required.
- Per institution: `packetId`, `institutionName`, `status`, `packetState`, `primary1` / `primary2`
  `{ decisionStatus, biographyUrl }`.
- The final facts stay in the latest frozen APPROVED review; `result_summary` is only an aggregation.

## Real E2E Smoke (one institution)

`apps/backend/src/scripts/web-task-biography-smoke.ts` — the only real-Agent smoke this step:

- Disposable Testcontainers PostgreSQL + isolated dev backend on `127.0.0.1` + real Graphile Worker +
  real `BiographyTaskExecutionService`.
- Real `HTTP POST /api/tasks` (TARGETED, 320106 南京市鼓楼区, 鼓楼区人民政府 — the institution that reached
  both-PRIMARY RESOLVED in the STEP 16 verified batch fixture) → `GET /api/tasks/:id` poll → terminal →
  `GET /api/tasks/:id/biography-result`.
- Gate: task terminal ≠ FAILED, at least one real `https://` biography URL, result readable after the
  secrets file is removed and env cleared.
- Temporary secrets in `/root/.stellaris-web-task-smoke-secrets` (600), removed after the smoke.

## Out of Scope (this step)

- Retry / Resume (only duplicate-execution protection is implemented; full resume is Deferred)
- Full-region real batch (FULL is verified via fake-inventory integration test only)
- Excel result mapping (Step 18)
- Frontend task binding (later step)
- Production deployment (dev worktree only; production untouched)
