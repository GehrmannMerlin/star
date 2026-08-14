# Persistent Evidence and Tool Event Foundation (STEP 11)

**Date**: 2026-08-14
**Server**: 43.142.31.198 / `/opt/Stellaris-PiAgent-Dev`
**Branch**: `refactor/pi-agent-runtime-server-20260813`
**Start HEAD**: `bf43cfb` (STEP 10 Investigator Evidence / Position URL Candidate)
**Prerequisite state**: STEP 10 completed, packet `READY_FOR_REVIEW`, evidence smoke proven (region 320106 / 鼓楼区人民政府, 4+4 candidates, schema valid, frozen).

## Goal

Make what currently exists only in process memory durable and recoverable in PostgreSQL:

1. **Tool Events** (currently `MemoryToolEventSink` — lost on process exit).
2. **Investigator Evidence Submission** (currently `InMemoryInvestigatorEvidenceSubmissionSink` — lost on process exit).

Then prove restart-style rehydration: new repository instances read back the Evidence + Tool Events and the **existing Candidate Provenance Gate** re-passes.

## Verified architecture facts (from server source, not assumptions)

- **DB stack**: Kysely 0.29.4 + `pg` 8.22.0 (`PostgresDialect`), `createDb(config)` in `packages/db/src/client.ts`. Env config via `dbConfigFromEnv` (PGHOST/PGPORT/PGUSER/PGPASSWORD/PGDATABASE).
- **Migration**: Kysely `Migrator` + custom `migrationProvider` (`packages/db/src/migration-provider.ts`). Files `packages/db/src/migration-00N-*.ts`, names date-based (`2026-08-03-initial-schema`, `2026-08-03-invariants`, `2026-08-11-task-owner`). Down migrations exist for 003.
- **Schema**: `packages/db/src/schema.ts` — Kysely `Database` interface, snake_case, uuid PK `gen_random_uuid()`, `*_at` timestamps, jsonb columns typed `unknown` and JSON.stringify'd on insert (convention seen in `repos/url-candidate.ts`).
- **Repos**: `packages/db/src/repos/*.ts` — classes taking `Kysely<Database>`, exported via `repos/index.ts` + package `index.ts`. `TABLE_NAMES` const (25 tables) used by `db.smoke.test.ts` (asserts length 25).
- **Test DB**: `packages/db/src/testing/pg.ts` — Testcontainers **postgres:18** on random mapped port, wait-for-`SELECT 1`. This is the project's existing disposable DB helper; reused as-is.
- **Tool Event contract** (`packages/agent-tools/src/contracts/tool-types.ts` + `telemetry/tool-event-sink.ts`):
  - `ToolEventSink` (write): `onStart` / `onSuccess` / `onFailure` / `onCancelled`. `ToolGateway` is the producer (calls `onStart` then the terminal event; success `data` is the full tool output).
  - `ToolInvocationContext` carries `taskRunId`, `agentSessionId`, `agentRole`, `packetId?`, `targetRegionCode?`.
  - **Identity note**: only `ToolStartEvent` carries the context. Terminal events (`ToolSuccessResult` etc.) carry only `callId` + timestamps. A journal must correlate terminal → context by `callId`.
- **Evidence contract** (`packages/agent-tools/src/tools/evidence/investigator-evidence-submission.ts`):
  - `InvestigatorEvidenceSubmissionSink { submit(payload) → {ACCEPTED|ALREADY_SUBMITTED, payloadHash} | getSubmission() | isFrozen() }`. InMemory impl lives in `packages/agent-runtime/src/evidence/investigator-evidence-submission-sink.ts`.
  - `InvestigatorEvidenceSubmissionPayload { candidates: Record[]; claims?: Record[] }`. The submit tool already maps `ALREADY_SUBMITTED` → `INVESTIGATOR_EVIDENCE_ALREADY_SUBMITTED` ToolFailureError.
  - Canonical Skill: `official-biography-evidence` 3.1.0 at `third-party/china-official-url-evidence-suite/skills/official-biography-evidence`. Canonical schemas `url-candidate-pool.schema.json` ("URL Candidate Pool Row") and `target-claim.schema.json` — validated by `SkillSchemaRegistry` / `createSkillEvidenceValidator`.
- **Provenance gate**: `packages/agent-runtime/src/evidence/evidence-provenance.ts` — `evaluateEvidenceProvenance(eventSink: MemoryToolEventSink, candidates)` iterates `eventSink.successes`; `fetch_page`/`render_page` `requestedUrl`/`finalUrl` → opened, `inspect_page` `url` → inspected. Coupled to `MemoryToolEventSink`.
- **Tool output shapes** (what we may safely project):
  - `fetch_page` → `{ requestedUrl, finalUrl, statusCode, contentType, content, bytes }` — `content` is full HTML, **must not persist**.
  - `render_page` → URL + status receipt shape.
  - `inspect_page` → `{ url, ...observations }` — observations (title/links/members/date) **must not persist**; gate reads `data.url`.
  - `search_web` → `{ provider, results[] }` — snippets **must not persist**; store `provider` + `resultCount`.
  - `submit_investigator_evidence` → `{ payloadHash, candidateCount, ... }` — store `payloadHash` + `candidateCount` only.
- **Dependency graph**: `@stellaris/db` depends only on `@stellaris/contracts`. `@stellaris/agent-runtime` currently depends on agent-tools/contracts/crawler/yaml/ajv — **not** on db. Adding `@stellaris/db` as a direct dep of agent-runtime creates no cycle (db ← nothing). tsconfig uses NodeNext + workspace node_modules symlinks; no `paths` aliases exist, so package.json dep + pnpm install suffices.

## Design decisions

1. **ToolEventReader (minimal read-side abstraction)** — add to `packages/agent-tools/src/telemetry/tool-event-sink.ts`:
   `interface ToolEventReader { listSuccesses(): Promise<ToolSuccessResult<unknown>[]> }`. `MemoryToolEventSink implements ToolEventSink, ToolEventReader` (`listSuccesses()` → `this.successes`). Write path (`ToolEventSink` / `ToolGateway`) is **unchanged**.
2. **Provenance gate decoupling (minimal)** — change `evaluateEvidenceProvenance(successes: readonly ToolSuccessResult<unknown>[], candidates)`; body byte-identical (iterates `successes`). Callers pass `eventSink.successes` (memory) or `await reader.listSuccesses()` (postgres). No gate rule rewrites.
3. **Postgres implementations live in `packages/agent-runtime/src/persistence/`** (typed adapters bridging agent-tools contracts → db repos; agent-runtime already imports agent-tools and gains db). Generic repos + schema + migration live in `packages/db` (existing home).
4. **Data minimization**: journal projects tool output into small metadata JSONB (`url` / `search` / `submission` groups) before storing. Raw HTML, inspection observations, search snippets, auth headers never persisted.
5. **DB-enforced freeze**: `investigator_evidence_submission` unique constraint on `packet_id`; sink maps pg unique-violation (code 23505) and pre-check to `{status:"ALREADY_SUBMITTED", payloadHash}` — the existing domain shape.
6. **Deterministic event order**: `tool_event.seq serial` (int4) + `ORDER BY seq ASC`. Uniqueness per `(call_id, status)` prevents silent history overwrite on retry.
7. **No new tables beyond the two** concerns. No Packet/AgentSession FKs (both deferred). Logical `packet_id` / `agent_session_id` text columns only.

## Task 1 — DB schema + migration 004 + generic repos (`packages/db`)

- `packages/db/src/schema.ts`: add `ToolEventTable` and `InvestigatorEvidenceSubmissionTable` interfaces; extend `Database`; add row aliases in `types.ts`; append both names to `TABLE_NAMES` (25 → 27).
  - `tool_event`: id uuid PK, `seq` serial, call_id text, tool_name text, `status` text, agent_session_id text, packet_id text null, agent_role text, task_run_id text, started_at timestamptz, finished_at timestamptz null, failure_code text null, failure_message text null, failure_retryable bool null, url_metadata jsonb null, search_metadata jsonb null, submission_metadata jsonb null, created_at timestamptz default now(). UNIQUE (call_id, status); INDEX (agent_session_id, seq).
  - `investigator_evidence_submission`: id uuid PK, packet_id text, agent_session_id text, agent_role text, skill_name text, skill_version text, canonical_schema text, payload jsonb, payload_hash text, frozen_at timestamptz default now(), created_at timestamptz default now(). UNIQUE (packet_id); INDEX (packet_id).
- `packages/db/src/migration-004-agent-persistence.ts`: `name: "2026-08-14-agent-persistence"`, `up` = create both tables (Kysely schema builder; CHECK on `status` values), `down` = drop both (matches 003 down convention).
- `packages/db/src/migration-provider.ts`: register MIGRATION_004.
- `packages/db/src/repos/tool-event.ts`: `ToolEventRepository` — `insertEvent(row: Insertable<ToolEventTable>)` (JSON.stringify jsonb groups), `listSuccessEvents()` ordered by `seq ASC`, `listEvents(opts?)` for audit. `jsonb` read returns parsed objects (pg default).
- `packages/db/src/repos/investigator-evidence.ts`: `InvestigatorEvidenceSubmissionRepository` — `insertSubmission(row)` (throws on unique violation), `getSubmissionByPacketId(packetId)`, `isFrozen(packetId)`.
- Wire both into `repos/index.ts` (`Repositories` + `createRepositories` + exports) and package `index.ts`.
- Update `packages/db/src/db.smoke.test.ts` TABLE_NAMES length 25 → 27.

## Task 2 — Persistent Tool Event journal + projection (`packages/agent-tools`, `packages/agent-runtime`)

- `packages/agent-tools/src/telemetry/tool-event-sink.ts`: add `ToolEventReader` interface; `MemoryToolEventSink` implements it. Export from `packages/agent-tools/src/index.ts` if not already re-exported.
- `packages/agent-runtime/src/persistence/tool-event-projection.ts`:
  - `projectToolEventData(toolName, data)` → `{ url?, search?, submission? }` groups (tolerant extraction; strips content).
  - `toolEventDataFromProjection(groups)` → reconstructed `data` for the gate (requestedUrl/finalUrl/statusCode / url / provider+resultCount / payloadHash+candidateCount).
- `packages/agent-runtime/src/persistence/postgres-tool-event-journal.ts`: `PostgresToolEventJournal implements ToolEventSink, ToolEventReader`.
  - `onStart`: remember `contextsByCallId[callId]`, insert STARTED row with context identity.
  - `onSuccess/onFailure/onCancelled`: correlate context by callId (fallback nulls), insert terminal row with projection (+ failure fields).
  - `listSuccesses()`: `repo.listSuccessEvents()` → reconstruct `ToolSuccessResult` with projected data.
  - `dispose()`/no long-lived handles: stateless beyond the per-instance context map.
- `packages/agent-runtime/src/persistence/index.ts`: export journal + projection; minimal factory `createPostgresToolEventJournal(db: Kysely<Database> | Repositories)`.

## Task 3 — Persistent Evidence submission sink + freeze uniqueness

- `packages/agent-runtime/src/persistence/postgres-investigator-evidence-sink.ts`: `PostgresInvestigatorEvidenceSubmissionSink implements InvestigatorEvidenceSubmissionSink`.
  - Constructor binds packet identity + skill identity (packetId, agentSessionId, agentRole, skill name/version, canonical schema name) — the runner stays Memory-default; this sink is injected where durable persistence is needed.
  - `submit(payload)`: compute `payloadHash` (same sha256-over-JSON as InMemory sink); pre-check `getSubmissionByPacketId` → ALREADY_SUBMITTED; insert; on pg unique-violation (code 23505) re-read → ALREADY_SUBMITTED.
  - `getSubmission()` → payload from row; `isFrozen()` → row exists.
  - `canonical_schema` = `"url-candidate-pool.schema.json"` (+ `",target-claim.schema.json"` when claims present).
- Add `@stellaris/db` to `packages/agent-runtime/package.json` dependencies; `corepack pnpm install`.
- `packages/agent-runtime/src/index.ts`: export `./persistence/index.js`.

## Task 4 — Provenance rehydration + disposable PostgreSQL smoke

- Update `packages/agent-runtime/src/evidence/evidence-provenance.ts` signature to `(successes, candidates)`; update runner call (`eventSink.successes`) and `evidence-provenance.test.ts` call sites.
- `packages/agent-runtime/src/persistence/persistence-smoke.ts` (+ `.test.ts`): one disposable PostgreSQL flow reusing `startPostgres()` from `@stellaris/db/testing/pg.js`:
  1. start container → `createDb` → `migrateToLatest` (migration 004 applied).
  2. Journal: append representative events (search_web SUCCESS; fetch_page SUCCESS candidate A/B; inspect_page SUCCESS A/B; submit_investigator_evidence SUCCESS).
  3. Evidence sink: submit canonical payload (PRIMARY_1 one candidate + PRIMARY_2 one candidate, schema-validated shape from `url-candidate-pool.schema.json`) → ACCEPTED; `isFrozen()`.
  4. **Destroy** journal + sink instances; create **new** repo/journal/sink instances.
  5. New reader: `listSuccesses()` → events reloaded, ordered, url metadata present.
  6. New evidence sink: `getSubmission()` → payload + hash match; `isFrozen()`.
  7. Rerun existing `evaluateEvidenceProvenance(await reader.listSuccesses(), submission.candidates)` → **PASS**.
  8. Duplicate `submit` → **REJECTED** (ALREADY_SUBMITTED).
  9. Assert no raw HTML / secret-like field persisted (inspect stored rows).
  10. `stop()` container — exact cleanup, no prune.
- Targeted tests (6–10, no full workspace runs):
  - `packages/db`: `agent-persistence.integration.test.ts` — migration 004 applies + idempotent; tool_event repo insert/order/status-filter; evidence repo unique-violation on duplicate packet_id.
  - `packages/agent-runtime/src/persistence/tool-event-projection.test.ts` — projection keeps url metadata, strips content; no secret-like fields.
  - `packages/agent-runtime/src/persistence/postgres-tool-event-journal.test.ts` — journal over a fake in-memory repo: append → rows projected; `listSuccesses()` reconstructs gate-usable data.
  - `packages/agent-runtime/src/persistence/postgres-investigator-evidence-sink.test.ts` — fake repo: accept → frozen; duplicate → ALREADY_SUBMITTED; 23505 race → ALREADY_SUBMITTED.
  - `packages/agent-runtime/src/persistence/provenance-reload.test.ts` — journal1 writes to a shared fake repo; journal2 (new instance) reads → gate **PASS**.

## Task 5 — Targeted verification + docs + self-review + commit

- Build order: `corepack pnpm --filter @stellaris/db build`, `--filter @stellaris/agent-tools build`, then targeted agent-runtime tests.
- Run: A) db `agent-persistence.integration.test.ts` (+ `db.smoke.test.ts`), B) agent-runtime persistence tests + `evidence-provenance.test.ts` + `investigator-evidence-runner.test.ts`, C) provenance reload test, D) migration validation (disposable), E) `corepack pnpm -r typecheck`, F) one disposable persistence smoke.
- Docs: `docs/agent-runtime/persistent-evidence-tool-event-foundation.md` (purpose, Tool Event persistence, Evidence persistence, freeze, data minimization, no-raw-HTML policy, ToolEventReader abstraction, provenance rehydration, memory vs postgres, disposable smoke; Deferred list). No SQL dumps.
- Implementation self-review checklist (see below). Fix findings minimally; re-run only affected targeted tests + smoke.
- Commit (max 2 natural commits, no push, no prod merge).

## Prohibitions (hard)

- No second ORM/query layer; reuse Kysely + existing repos.
- No `production` DB migration/CREATE/ALTER/INSERT/UPDATE/DELETE. Migration only on disposable testcontainer.
- No changes to: Skill `official-biography-evidence` 3.1.0, ToolGateway, agent tool semantics, Graphile, POST /api/tasks, Packet state machine.
- No new packet/agent-session/page-snapshot/reviewer/recovery tables.
- No raw HTML / search snippets / auth secrets persisted.
- No LLM/Search/Browser smoke; no full workspace tests.
- No `docker system prune` / `docker volume prune`; only exact stop of the disposable container.

## Architecture self-review

- [x] Reuses existing PostgreSQL infrastructure (Kysely + pg + existing testcontainers helper).
- [x] No second ORM.
- [x] `MemoryToolEventSink` preserved (unit-test default).
- [x] InMemory Evidence sink preserved.
- [x] New Persistent sinks implement the same contracts (`ToolEventSink`/`ToolEventReader`, `InvestigatorEvidenceSubmissionSink`).
- [x] Runner/gate depend on interfaces/arrays, not Postgres classes (gate now takes `ToolSuccessResult[]`).
- [x] ToolGateway unchanged; persistence at journal/sink layer.
- [x] No PostgreSQL logic in Agent role prompts.
- [x] Evidence canonical payload still from Skill (schema-validated at runtime boundary; Postgres sink only stores/reads/enforces uniqueness).
- [x] No raw HTML persisted.
- [x] No API Key / Authorization Header persisted.
- [x] No re-run of DeepSeek/Bocha.
- [x] Skill unchanged.
- [x] Graphile unchanged.
- [x] No production DB migration.
- [x] No region-specific logic.
- [x] No full workspace test.

## Execution footer

SELF_REVIEW: PASS
ARCHITECTURE_CONFLICT: NONE
EXECUTION_PREAUTHORIZED_BY_USER: YES
EXECUTION_MODE: INLINE_FAST
TEST_POLICY: TARGETED_ONLY
PRODUCTION_DB_MIGRATION_ALLOWED: NO
