# STEP 14 — Recovery Re-Review Loop and Decision Persistence — Implementation Plan

> **For agentic workers:** superpowers:writing-plans was attempted and is UNAVAILABLE
> in this runtime (skill not installed). This document is the **writing-plans
> contract fallback**, hand-authored at the same quality level. Execution is
> pre-authorized inline by the user (`EXECUTION_MODE: INLINE_FAST`). Steps use
> checkbox (`- [ ]`) syntax for tracking.
>
> `writing_plans_skill_available: NO` · `writing_plans_used: NO_UNAVAILABLE` ·
> `writing_plans_contract_fallback: YES`

**Goal:** Complete the Reviewer → Recovery → Round-2 Fresh Reviewer loop with
PostgreSQL decision persistence on the Pi Agent runtime:

```
Review Round 1 → REWORK_REQUIRED → Persistent Review Decision #1
  → Recovery Round 1 Supplement → Persistent Recovery Submission
  → new repository instances → re-load Original Evidence + Recovery Supplement
  → Composite Candidate View → Fresh Reviewer Round 2 → real Search/Open/Inspect
  → submit_review_decision → Persistent Review Decision #2 → POSITION_DECIDED
```

The Final Current Position Decision is **derived** from the latest frozen APPROVED
Review — no second `final_position_decision` SSoT is created.

**Architecture:** Add two append-only PostgreSQL tables (`review_decision_submission`,
`recovery_submission`) via the existing Kysely + pg + Kysely Migrator framework; add
Postgres implementations of the existing Reviewer/Recovery sinks (memory sinks stay
the default); add Evidence/Recovery/Review readers; rehydrate a Composite Candidate
View from **new** reader instances (mechanical append + identity dedupe, no ranking,
no scoring, no final-URL selection); re-run the **existing** `ReviewerAgentRunner`
(no new `ReReviewerAgentRunner`) with the Composite Candidate View as the Frozen
Candidate View and a round-2-configured Postgres review sink. The existing Candidate
Membership Gate is reused unchanged — it accepts whatever Frozen Candidate View the
current Reviewer uses (Round 1 = Original Pool, Round 2 = Composite View), so
Recovery candidates are selectable only after entering the Composite View.

## Global Constraints

- Server: `/opt/Stellaris-PiAgent-Dev` on `43.142.31.198`, branch
  `refactor/pi-agent-runtime-server-20260813`. Worktree clean (one untracked STEP 13
  plan doc is left untouched). **No** `git reset --hard`, **no** `git clean`.
- Node `v24.19.0` via `source ~/.nvm/nvm.sh && nvm use 24.19.0`; `corepack pnpm`.
- PostgreSQL: **only** disposable Testcontainers `postgres:18` via the existing
  `@stellaris/db/testing/pg.js` helper. **Never** touch production DB. No Prisma /
  Drizzle / Knex / Sequelize / second ORM — Kysely + pg only.
- Memory sinks (`InMemoryReviewDecisionSink`, `InMemoryRecoverySubmissionSink`) are
  **kept** and remain the unit-test/fast-smoke default.
- `ReviewerAgentRunner` is **reused** for Round 2. **No** `ReReviewerAgentRunner`, no
  second Candidate Membership Gate, no infinite Reviewer/Recovery loop.
- Round-2 REWORK_REQUIRED → packet → `RECOVERY_REQUIRED`, then **stop** (no
  auto-start of Recovery Round 2).
- Original Investigator Evidence is **read-only** — the evidence sink's UNIQUE(packet_id)
  freeze is unchanged; no new code writes to the evidence tables.
- Persistence round semantics: same packet + same round duplicate submit is rejected;
  Round 1 is never overwritten by Round 2 (append-only, distinct rounds).
- No Skill / Graphile / DB-migration-of-production / frontend / Excel changes.
- Test policy: targeted only (see below). Agent-tools typecheck only if actually modified
  (expected: NO changes to agent-tools).
- Smoke secrets: if DeepSeek + Bocha keys are unavailable at the real Round-2 smoke
  boundary, finish code + migration + targeted tests and return
  `STEP_14_WAITING_FOR_REVIEWER_SMOKE_CREDENTIALS`. No MiniMax fallback. Keys never
  enter git/source/markdown/DB/logs.
- Commit: at most two natural commits. **No** push / merge / deploy.

## Verified existing boundaries (read from the worktree, not guessed)

- Packet states already include the full STEP 14 chain:
  `RECOVERY_REQUIRED → RECOVERING → READY_FOR_REVIEW → REVIEWING → POSITION_DECIDED`
  (`packages/agent-runtime/src/work-packet/institution-work-packet.ts`).
- `ReviewerAgentRunner` (`packages/agent-runtime/src/reviewer/reviewer-agent-runner.ts`)
  requires `READY_FOR_REVIEW`, transitions to `REVIEWING`, then
  `POSITION_DECIDED | RECOVERY_REQUIRED | FAILED`; takes `sink` + `frozenInput`
  (leadership / selectedOfficials / candidatePool) deps; builds the Candidate
  Membership Gate from `frozenInput.candidatePool`.
- `RecoveryAgentRunner` already composes the Composite Candidate View via
  `composeCandidateView(original, supplement)` (mechanical concat + dedupe by
  normalized URL) — reused as-is.
- Postgres sink pattern: `PostgresInvestigatorEvidenceSubmissionSink` + repo port +
  `PG_UNIQUE_VIOLATION "23505"` handling; fake repos in
  `persistence-test-support.ts` for container-free unit tests.
- Smoke pattern: `reviewer-smoke.ts` / `recovery-smoke.ts` load a fixture, drive a
  packet store, run the runner, build a gate report, print `..._SMOKE` lines.
- Testcontainers helper: `startPostgres()` in `packages/db/src/testing/pg.ts`.
- Latest migration: `2026-08-14-agent-persistence` (MIGRATION_004) — new migration is
  the next number, `2026-08-14-recovery-rereview-persistence` (MIGRATION_005).
- Model config is env-only (`AGENT_MODEL_PROVIDER` / `AGENT_MODEL_ID`); STEP 13 used
  provider `deepseek` / model `deepseek-v4-flash` (registry-verified). Search provider
  is env-only (`WEB_SEARCH_PROVIDER` / `BOCHA_API_KEY`).

---

## Task 1 — Migration 005 + schema/types + repositories

**Files:**
- Create: `packages/db/src/migration-005-recovery-rereview-persistence.ts`
- Modify: `packages/db/src/schema.ts`, `packages/db/src/types.ts`
- Create: `packages/db/src/repos/review-decision-submission.ts`
- Create: `packages/db/src/repos/recovery-submission.ts`
- Modify: `packages/db/src/repos/index.ts`, `packages/db/src/migration-provider.ts`

**Step 1 — `migration-005`.** Two append-only tables, keyed UNIQUE(packet_id, round):

`review_decision_submission`:
- `id uuid PK default gen_random_uuid()` · `packet_id text NOT NULL` ·
  `review_round int NOT NULL` · `agent_session_id text` (nullable — the sink is
  constructed before the session id exists) · `agent_role varchar(32) NOT NULL` ·
  `skill_name text NOT NULL` · `skill_version text NOT NULL` ·
  `canonical_schema text NOT NULL` · `payload jsonb NOT NULL` ·
  `payload_hash text NOT NULL` · `round_outcome varchar(16) NOT NULL` ·
  `frozen_at timestamptz NOT NULL` · `created_at timestamptz default now()`
- UNIQUE(`review_decision_submission_round_unique`, [`packet_id`, `review_round`])
- index `idx_review_decision_submission_packet_round` on [`packet_id`, `review_round`]
- CHECK `round_outcome IN ('APPROVED','REWORK_REQUIRED','REJECTED')`

`recovery_submission` (same shape, `recovery_round int`, `round_outcome IN
('RECOVERED','NO_QUALIFIED_URL','NEEDS_RECHECK')`, UNIQUE [`packet_id`,
`recovery_round`], index `idx_recovery_submission_packet_round`).

`down`: drop both tables.

**Step 2 — `schema.ts` / `types.ts`.** Add `ReviewDecisionSubmissionTable` and
`RecoverySubmissionTable` interfaces, wire into the `Database` interface and
`TABLE_NAMES`, re-export + add row aliases in `types.ts`.

**Step 3 — repos.** `ReviewDecisionSubmissionRepository`:
`insertSubmission` (insert, jsonb-stringify payload, returningAll),
`getByPacketAndRound(packetId, round)`, `listByPacket(packetId)` ordered by round asc,
`latestByPacket(packetId)` (round desc limit 1). `RecoverySubmissionRepository`
analogous. Add both to `repos/index.ts` exports + `createRepositories`.

**Step 4 — `migration-provider.ts`.** Append MIGRATION_005 to `MIGRATIONS`.

## Task 2 — Postgres Review Decision sink + Review Reader

**Files:**
- Create: `packages/agent-runtime/src/persistence/postgres-review-decision-sink.ts`
- Create: `packages/agent-runtime/src/persistence/review-decision-reader.ts`
- Modify: `packages/agent-runtime/src/persistence/index.ts`
- Test: `packages/agent-runtime/src/persistence/postgres-review-decision-sink.test.ts`

**Step 1 — `postgres-review-decision-sink.ts`.** Define
`ReviewDecisionSubmissionRepositoryPort` (insert / getByPacketAndRound / listByPacket /
latestByPacket — structurally satisfied by the db repo), `PostgresReviewSinkIdentity =
{ packetId, reviewRound, agentRole, skill }`, and
`class PostgresReviewDecisionSink implements ReviewerDecisionSink`:
- `submit(payload)`: compute `payloadHash` (sha256 over JSON), pre-check
  `getByPacketAndRound(packetId, reviewRound)`; if exists → `ALREADY_SUBMITTED`.
  Else insert with `round_outcome = reviewRoundOutcome(payload)`; on 23505 → re-read →
  `ALREADY_SUBMITTED`. Return `{ status: "ACCEPTED", payloadHash }`.
- `getSubmission()` / `isFrozen()` read the instance round only.
- Export pure `reviewRoundOutcome(payload): "APPROVED" | "REWORK_REQUIRED" | "REJECTED"`
  (all reviews APPROVED → APPROVED; any REWORK_REQUIRED → REWORK_REQUIRED; else REJECTED).

**Step 2 — `review-decision-reader.ts`.** `ReviewDecisionHistoryRow = { reviewRound,
payload, payloadHash, roundOutcome, frozenAt }`.
`class PostgresReviewDecisionReader` over the repo port:
- `listByPacket(packetId): Promise<ReviewDecisionHistoryRow[]>`
- `latestByPacket(packetId): Promise<ReviewDecisionHistoryRow | null>`
- pure `finalDecisionsFromReview(payload, poolById)`: for each APPROVED review →
  `{ targetId, selectedCandidateId, finalUrl }` (url resolved from pool). This is the
  derivation source for the Final Current Position Decision (no second SSoT).

**Step 3 — `persistence/index.ts`.** Export the new sink + reader + factory
`createPostgresReviewDecisionSink(db, identity)`.

**Step 4 — test (fakes).** `FakeReviewDecisionRepo` (in `persistence-test-support.ts` or
inline) with unique (packet_id, round) emulation + race mode. Cases: round-1 accept;
same-round duplicate rejected; round-2 accept after round-1 (append-only, round-1
payload unchanged); `isFrozen` per round; `listByPacket` order; `latestByPacket`.

## Task 3 — Postgres Recovery sink + Recovery Reader + Evidence Reader

**Files:**
- Create: `packages/agent-runtime/src/persistence/postgres-recovery-submission-sink.ts`
- Create: `packages/agent-runtime/src/persistence/recovery-reader.ts`
- Create: `packages/agent-runtime/src/persistence/evidence-reader.ts`
- Modify: `packages/agent-runtime/src/persistence/index.ts`
- Test: `packages/agent-runtime/src/persistence/postgres-recovery-submission-sink.test.ts`

**Step 1 — `postgres-recovery-submission-sink.ts`.** Mirror Task 2 for
`RecoverySubmissionSink`: `PostgresRecoverySinkIdentity = { packetId, recoveryRound,
agentRole, skill }`, `round_outcome = recoveryRoundOutcome(payload)` (any
RECOVERED_QUALIFIED_URL → RECOVERED; any NO_QUALIFIED_URL_AFTER_COMPLETE_SEARCH →
NO_QUALIFIED_URL; else NEEDS_RECHECK). Unique (packet_id, recovery_round), 23505 handled.

**Step 2 — `recovery-reader.ts`.** `PostgresRecoveryReader.listByPacket` /
`latestByPacket`; expose the latest supplement's `candidates` (the persisted Recovery
Supplement pool rows).

**Step 3 — `evidence-reader.ts`.** `PostgresEvidenceReader` over the existing
`InvestigatorEvidenceSubmissionRepository`:
`readOriginalCandidatePool(packetId): Promise<UrlCandidatePoolRow[]>` (payload
`candidates`; empty array when not frozen). Read-only — never writes.

**Step 4 — `persistence/index.ts`** exports + factories.

**Step 5 — tests (fakes).** Recovery sink round semantics + reader + evidence reader.

## Task 4 — Composite Candidate View rehydration

**Files:**
- Create: `packages/agent-runtime/src/persistence/composite-candidate-rehydration.ts`
- Test: `packages/agent-runtime/src/persistence/composite-candidate-rehydration.test.ts`

**Step 1.** `CompositeRehydrationInput = { originalCandidatePool, recoverySupplement,
reviewHistory }`. `class CompositeCandidateViewRehydrator` with deps `{ evidenceReader,
recoveryReader, reviewReader }` and
`rehydrate(packetId): Promise<CompositeRehydrationInput>`:
- original pool = `evidenceReader.readOriginalCandidatePool(packetId)`
- latest recovery supplement = `recoveryReader.latestByPacket(packetId)`
- composite = `composeCandidateView(original, supplementCandidates)`
  (reuse `composeCandidateView` from `recovery/recovery-attestation.js` — mechanical
  append + dedupe by normalized URL; **no** ranking/scoring/URL selection)
- reviewHistory = `reviewReader.listByPacket(packetId)`

**Step 2 — test (fakes).** Original pool unchanged; supplement appended; normalized-URL
dedupe; composite count = |original ∪ supplement|; review history surfaced.

## Task 5 — Recovery/Re-Review coordinator + Round-2 integration

**Files:**
- Create: `packages/agent-runtime/src/persistence/recovery-rereview-coordinator.ts`
- Create: `packages/agent-runtime/src/persistence/recovery-rereview-coordinator.test.ts`
- Modify: `packages/agent-runtime/src/persistence/index.ts`
- Modify (tests only): `packages/agent-runtime/src/reviewer/reviewer-gates.test.ts`
  (Round-2 membership gate regression)

**Step 1 — `recovery-rereview-coordinator.ts`.** `RecoveryRereviewCoordinator` orchestrates
the persisted Round-2 re-review. Deps: `{ packetStore, skillRuntime, modelPolicy,
modelResolver, evidenceReader, recoveryReader, reviewReader, reviewSinkFactory?,
eventSink?, runReviewer? }`.
`run({ packetId })`:
1. `rehydrate = rehydrator.rehydrate(packetId)` (assert original pool unchanged).
2. Build `ReviewerFrozenInput` from the persisted leadership + selectedOfficials
   (passed by the caller or read from a frozen source) and `candidatePool =
   rehydrate.compositeCandidateView`.
3. Run **`ReviewerAgentRunner`** (injected `runReviewer` default) with a Round-2
   Postgres review sink (`reviewSinkFactory` default constructs
   `PostgresReviewDecisionSink` with `reviewRound: 2`).
4. Return `{ rehydration, reviewerResult }`.
Round-2 `REWORK_REQUIRED` → packet `RECOVERY_REQUIRED` (already the runner behavior);
the coordinator just stops there (no auto Recovery Round 2).

**Step 2 — `index.ts`** exports.

**Step 3 — coordinator test.** Stub `runReviewer` returns a fabricated Round-2 COMPLETED
result; fake readers; assert composite pool passed as the runner's candidatePool and the
round-2 sink is constructed with `reviewRound: 2`; assert a Round-2 REWORK result leaves
the packet in `RECOVERY_REQUIRED` and no recovery is auto-started.

**Step 4 — Round-2 membership gate regression (agent-runtime).** In `reviewer-gates.test.ts`
(or a new sibling): using `ReviewerAgentRunner` + fake `createSession`:
- Round-2 scenario: pool = composite (original + recovery candidate); the fake session
  approves the **recovery** candidate for PRIMARY_2 → runner COMPLETED (recovery
  candidate selectable only inside the Composite View).
- Negative: fake session selects a candidate **not** in the frozen view → tool rejects →
  runner FAILED with `REVIEW_SCHEMA_INVALID`/`REVIEW_OBSERVATION_REQUIRED` (gate closed).

## Task 6 — Smoke fixture + runner + unit test

**Files:**
- Create: `packages/agent-runtime/src/smoke/fixtures/recovery-rereview-gulou-input.json`
- Create: `packages/agent-runtime/src/smoke/recovery-rereview-smoke.ts`
- Create: `packages/agent-runtime/src/smoke/recovery-rereview-smoke.test.ts`
- Modify: `packages/agent-runtime/package.json`, root `package.json`

**Step 1 — fixture.** 鼓楼区人民政府 (region 320106), reusing the reviewer/recovery
leadership + selectedOfficials. `originalCandidatePool` = PRIMARY_1 candidate only
(`.../qczc/dh/`). `round1Review` (thin `ReviewerSubmissionPayload`): PRIMARY_1 APPROVED,
PRIMARY_2 REWORK_REQUIRED (no selection). `recoverySupplement` (thin
`RecoverySubmissionPayload`): one NEW PRIMARY_2 candidate `.../qczc/sl/`
(the 石磊 page from the STEP 12 fixture) + a RECOVERED_QUALIFIED_URL supplement.

**Step 2 — `recovery-rereview-smoke.ts`.** CLI `--region-code/--institution/
--budget-ms/--fixture`. `runRecoveryRereviewSmoke(args)`:
1. `startPostgres()` → `createDb` → `migrateToLatest`.
2. Packet store: create packet from fixture inventory; advance
   `INVESTIGATING → EVIDENCE_PENDING → EVIDENCE_GATHERING → READY_FOR_REVIEW →
   REVIEWING → RECOVERY_REQUIRED → RECOVERING → READY_FOR_REVIEW` (simulates the
   persisted history the fixtures represent).
3. Persist Original Evidence (`PostgresInvestigatorEvidenceSubmissionSink`, packet).
4. Persist Round-1 Review (`PostgresReviewDecisionSink` round 1).
5. Persist Recovery Supplement (`PostgresRecoverySubmissionSink` round 1).
6. **Destroy instances**; create new EvidenceReader + RecoveryReader + ReviewReader.
7. Rehydrate Composite Candidate View (original unchanged + supplement).
8. If model configured (`AGENT_MODEL_PROVIDER` + `AGENT_MODEL_ID`): run a real fresh
   Round-2 `ReviewerAgentRunner` (Composite pool + round-2 Postgres sink); persist
   Round-2 Review.
9. New ReviewReader → read Review History (count / latest round / latest outcome).
10. Build gate report via `recoveryRereviewSmokePassed(report)`.
If model NOT configured → report status `STEP_14_WAITING_FOR_REVIEWER_SMOKE_CREDENTIALS`
with the persistence-phase evidence (migration OK, evidence frozen, round-1 review
frozen, recovery frozen, rehydrated, original unchanged, duplicate rejected).

**Step 3 — gate.** `recoveryRereviewSmokePassed` requires: evidence persisted; review
history count = 2; latest round = 2; latest outcome = APPROVED; composite view created;
original pool unchanged; Round-2 session fresh; search_web + bocha real; approved
candidates reopened + inspected; round-2 persisted; packet `POSITION_DECIDED`.

**Step 4 — package scripts.** agent-runtime `smoke:rereview`; root `agent:smoke:rereview`.

**Step 5 — unit test.** `parseRecoveryRereviewSmokeArgs` + gate function (mirror
`recovery-smoke.test.ts`).

## Task 7 — Targeted tests + affected-package typecheck

Run (targeted only; no full workspace suites):
- `corepack pnpm --filter @stellaris/agent-runtime test` on the new/edited test files
  (sink/reader/rehydration/coordinator/gate tests).
- `corepack pnpm --filter @stellaris/db typecheck`
- `corepack pnpm --filter @stellaris/agent-runtime typecheck`
- agent-tools typecheck **only if** agent-tools is actually modified (expected: no).
- `corepack pnpm --filter @stellaris/db test` on the migration/repo tests **only if**
  such tests are added (prefer fakes; the single disposable-PG run is the smoke).

## Task 8 — Self-review, secret cleanup, commit

- Self-review against the STEP 14 checklist (§14 of the brief): every
  `YES`/`NO`/count line must be provable from the smoke report or tests.
- If the real Round-2 smoke could not run (no keys): report
  `STEP_14_WAITING_FOR_REVIEWER_SMOKE_CREDENTIALS`; all code/migration/targeted tests
  complete.
- Secret hygiene: never write keys to git/source/markdown/DB/logs. If a temp
  mode-600 secrets file is created for the smoke, delete it afterward and unset env.
- Commit at most two natural commits (e.g. `feat(db): persist review + recovery
  submissions` and `feat(agent): recovery re-review loop and decision persistence`).
  No push / merge / deploy. Do not touch the untracked STEP 13 plan doc.
- Final report ends with `STEP_14_RECOVERY_REREVIEW_LOOP_AND_DECISION_PERSISTENCE_COMPLETE`
  (or the WAITING_FOR_CREDENTIALS sentinel), then stop.

## Test commands (targeted)

```bash
source ~/.nvm/nvm.sh && nvm use 24.19.0
cd /opt/Stellaris-PiAgent-Dev
corepack pnpm --filter @stellaris/agent-runtime test packages/agent-runtime/src/persistence/postgres-review-decision-sink.test.ts packages/agent-runtime/src/persistence/postgres-recovery-submission-sink.test.ts packages/agent-runtime/src/persistence/composite-candidate-rehydration.test.ts packages/agent-runtime/src/persistence/recovery-rereview-coordinator.test.ts packages/agent-runtime/src/reviewer/reviewer-rereview-gate.test.ts packages/agent-runtime/src/smoke/recovery-rereview-smoke.test.ts
corepack pnpm --filter @stellaris/db typecheck
corepack pnpm --filter @stellaris/agent-runtime typecheck
# real smoke (needs secrets):
corepack pnpm --filter @stellaris/agent-runtime smoke:rereview -- --budget-ms=360000
```

## Out of scope (explicitly not done)

Persistent Packet Store; generic infinite Reviewer/Recovery loop; pre-appointment /
acting / election / departure evidence; Excel / frontend integration; Graphile
scheduler; production deployment; full-workspace / crawler / backend / playwright test
suites; re-running Inventory / Investigator / Evidence / Recovery / STEP 12 / STEP 13
smokes; Prisma / Drizzle / Knex / Sequelize.

SELF_REVIEW: PENDING
ARCHITECTURE_CONFLICT: NONE (reuses ReviewerAgentRunner, existing sinks, Kysely
migrations, Testcontainers helper, composeCandidateView, and the existing Candidate
Membership Gate)
EXECUTION_PREAUTHORIZED_BY_USER: YES
EXECUTION_MODE: INLINE_FAST
TEST_POLICY: TARGETED_ONLY
