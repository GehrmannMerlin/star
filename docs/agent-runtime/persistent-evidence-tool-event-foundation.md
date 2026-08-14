# Persistent Evidence and Tool Event Foundation (STEP 11)

**Date**: 2026-08-14
**Branch**: `refactor/pi-agent-runtime-server-20260813`
**Prerequisite**: STEP 10 (Investigator Evidence / Position URL Candidate) completed — packet `READY_FOR_REVIEW`, evidence smoke proven.

## Purpose

STEP 10 proved that a fresh INVESTIGATOR Evidence session can search → fetch/render → inspect → submit a canonical url-candidate-pool and reach `READY_FOR_REVIEW`. But everything lived in process memory (`MemoryToolEventSink`, `InMemoryInvestigatorEvidenceSubmissionSink`). STEP 11 makes those two facts **durable in PostgreSQL** and proves **restart-style rehydration**: new repository instances re-read the Evidence + Tool Events and the existing **Candidate Provenance Gate** re-passes.

No LLM / Search / Browser re-smoke was run — this step is offline code + disposable PostgreSQL only.

## Tool Event Persistence

- **Write contract unchanged**: `ToolEventSink` (onStart / onSuccess / onFailure / onCancelled) is untouched; `ToolGateway` keeps emitting full tool results into the sink.
- **New read abstraction**: `ToolEventReader.listSuccesses()` added in `@stellaris/agent-tools`. `MemoryToolEventSink` now implements both sides; the new `PostgresToolEventJournal` implements both too.
- **Projection before persistence**: tool output is reduced to a small metadata JSONB group before storing — URL proof (`requestedUrl`/`finalUrl`/`url`/`statusCode`/`bytes`), search summary (`provider`/`resultCount`), or submit summary (`payloadHash`/`candidateCount`). Raw HTML, DOM, inspection observations, search snippets, and any secret-like field are never persisted.
- **Deterministic order**: `tool_event.seq` (serial) + `ORDER BY seq ASC`; a `(call_id, status)` unique constraint prevents a retry from silently overwriting history.

## Evidence Submission Persistence

- `PostgresInvestigatorEvidenceSubmissionSink` implements the existing `InvestigatorEvidenceSubmissionSink` contract (submit / getSubmission / isFrozen), with the same sha256-over-JSON payload hash as the in-memory sink.
- Stores packet identity, agent session identity, skill name/version, canonical schema identity (`url-candidate-pool.schema.json`), the canonical payload as JSONB, and the payload hash. It only **stores / reads / enforces uniqueness** — it never re-ranks, re-selects PRIMARYs, or re-interprets schema semantics (validation stays at the `SkillSchemaRegistry` runtime boundary).
- **Freeze is DB-enforced**: `UNIQUE(packet_id)` guarantees exactly one frozen submission per packet. A normal duplicate returns `ALREADY_SUBMITTED` (pre-check); a concurrent race that trips the unique violation (pg code `23505`) is caught and re-read to the same domain result. The submit tool continues to map that to `INVESTIGATOR_EVIDENCE_ALREADY_SUBMITTED`.

## Database uniqueness / Freeze summary

| Concern | Table | Key constraint / index | Meaning |
| --- | --- | --- | --- |
| Tool events | `tool_event` | `UNIQUE (call_id, status)`; index `(agent_session_id, seq)`; `CHECK status IN (…)` | append-only history, deterministic read order |
| Evidence freeze | `investigator_evidence_submission` | `UNIQUE (packet_id)` | exactly one Evidence submission per packet |

Both `packet_id` and `agent_session_id` are logical identity columns — **no FK** to a Packet / AgentSession table, because those persistent stores are still Deferred.

## Data Minimization & No Raw HTML Policy

- No `content` / HTML / DOM / page text is written to `tool_event`.
- No search snippets or full result arrays are written.
- No `Authorization` header, API key, cookie, or other secret-like payload is written.
- The persistence smoke actively asserts `rawHtmlPersisted === false` and `secretLikePersisted === false`.
- Future Persistent Page Snapshot is a separate phase and is deliberately out of scope.

## Provenance Rehydration

The gate was decoupled from the sink in the smallest way possible: `evaluateEvidenceProvenance(successes: readonly ToolSuccessResult<unknown>[], candidates)` now takes the SUCCESS events array directly (memory: `eventSink.successes`; durable: `await reader.listSuccesses()`). Its judgment rules are byte-identical.

Smoke flow that proves durability:

1. disposable PostgreSQL (Testcontainers `postgres:18`, the project's existing helper) → migrate → write representative tool events + canonical evidence;
2. **destroy** journal/sink instances;
3. create **new** journal/sink/repo instances → re-read events + evidence;
4. rerun the existing Candidate Provenance Gate → **PASS**;
5. duplicate submit → **REJECTED**.

Because the repos are stateless and the journal keeps no read-side cache, fresh instances prove the data really comes from PostgreSQL.

## Memory vs PostgreSQL implementations

| Concern | Memory (default for unit tests / fast smoke) | PostgreSQL (durable, injectable) |
| --- | --- | --- |
| Tool events | `MemoryToolEventSink` (write+read) | `PostgresToolEventJournal` (`postgres-tool-event-journal.ts`) |
| Evidence | `InMemoryInvestigatorEvidenceSubmissionSink` | `PostgresInvestigatorEvidenceSubmissionSink` (`postgres-investigator-evidence-sink.ts`) |

The Evidence runner stays Memory-default; persistence is injected where durable storage is required (a future production runtime). Minimal factories exist (`createPostgresToolEventJournal`, `createPostgresEvidenceSink`) but no DI container / persistence platform was introduced.

## Disposable DB Smoke

The one-shot smoke (`packages/agent-runtime/src/persistence/persistence-smoke.ts` + vitest wrapper) reports:

```
migration: PASS            eventsInserted: 12
evidenceInserted: true     payloadHashMatch: true
evidenceFrozen: true       eventsReloaded: 6
evidenceReloaded: true     provenanceAfterReload: PASS
duplicateSubmit: REJECTED  rawHtmlPersisted: false
secretLikePersisted: false
```

The container is stopped precisely on exit; no `docker prune`; production containers and DB are untouched.

## Deferred (explicitly not in this phase)

- Persistent Packet Store
- Persistent Agent Session Store
- Persistent Page Snapshot
- Final Position URL decision
- Reviewer agent
- Recovery agent
- Graphile packet scheduler

## Files

- `packages/db/src/migration-004-agent-persistence.ts` (+ `migration-provider.ts` registration, `schema.ts`, `types.ts`, `TABLE_NAMES`)
- `packages/db/src/repos/tool-event.ts`, `packages/db/src/repos/investigator-evidence.ts`
- `packages/agent-tools/src/telemetry/tool-event-sink.ts` (`ToolEventReader`)
- `packages/agent-runtime/src/persistence/*` (projection, journal, evidence sink, smoke, tests, factories)
- `packages/agent-runtime/src/evidence/evidence-provenance.ts` (storage-decoupled signature only)
