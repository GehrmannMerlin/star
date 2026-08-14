# Recovery Agent Foundation (STEP 13)

Date: 2026-08-14

## Purpose

STEP 12 added an independent Reviewer that freezes per-PRIMARY Review Decisions
and, when the frozen candidate pool is insufficient, marks a packet
`RECOVERY_REQUIRED`. STEP 13 adds the missing **Recovery Agent**: a fresh Pi
session that fills the Reviewer-identified gap with new CURRENT POSITION URL
candidates, then returns the packet to Review. The Reviewer re-review loop itself
is deferred to STEP 14.

## RECOVERY_REQUIRED meaning

The Reviewer found the frozen Candidate Pool insufficient for at least one
PRIMARY (review `review_result`/`final_review_result` = `REWORK_REQUIRED`). The
packet transitions `READY_FOR_REVIEW → REVIEWING → RECOVERY_REQUIRED`. Recovery
does not re-run the Reviewer and does not finalize any position URL.

## Fresh Recovery Session

Each Recovery run creates a brand-new Pi session (role `RECOVERY`). It never
reuses the Investigator, Evidence, or Reviewer conversation, and it only reads
structured frozen artifacts — never hidden reasoning or long tool transcripts.

## Frozen Reviewer Input

Recovery input is: frozen Leadership, frozen PRIMARY person decisions, frozen
ORIGINAL Candidate Pool, and frozen canonical Independent Review Records
(`review-record.schema.json`). The runner validates all of them against the
pinned Skill schemas and fails closed on any non-canonical input.

## Original Candidate Pool Immutable

Recovery is append-only. It cannot modify, delete, or overwrite any original
candidate, and it cannot change a candidate's person binding. The frozen
original pool is untouched; the runtime asserts this in the result receipt.

## Recovery Supplement

The Recovery Agent submits a thin envelope through `submit_recovery_evidence`:
NEW `url-candidate-pool.schema.json` rows (the Supplement) plus one per-target
supplement envelope. The runtime freezes the envelope and attests the full
canonical `recovery-record.schema.json` records with real session tool-call IDs
(session id, agent/context UUIDs, matched fetch/render + inspect call IDs,
access-attempt sequence derived from real events) and validates them.

## Candidate Provenance Gate

Every new Recovery candidate must be really opened (`fetch_page`/`render_page`
SUCCESS) **and** really inspected (`inspect_page` SUCCESS) in the Recovery
session itself. Investigator provenance never counts. A submission that lists a
search-only candidate is rejected with `RECOVERY_OBSERVATION_REQUIRED`.

## PRIMARY Join Gate

Every new candidate and supplement must target a frozen PRIMARY
(`PRIMARY_1`/`PRIMARY_2`). No third person, no person identity change. The
duplicate gate rejects any new candidate URL that already exists in the frozen
original pool or within the supplement.

## Composite Candidate View

On success the runtime mechanically composes a read model for the NEXT Reviewer
session: frozen original pool + frozen supplement, identity-deduped by
normalized URL. No ranking, no scoring, no semantic selection — selection is the
Reviewer's job.

## Packet

```
RECOVERY_REQUIRED → RECOVERING → READY_FOR_REVIEW | FAILED
```

Recovery has no final-URL authority, so a successful run returns the packet to
`READY_FOR_REVIEW` for a fresh Reviewer session over the Composite Candidate
View. `FAILED` carries a failure code (`RECOVERY_NOT_SUBMITTED`,
`RECOVERY_SCHEMA_INVALID`, `RECOVERY_OBSERVATION_REQUIRED`).

## Deferred

- Reviewer Re-review Loop (STEP 14)
- Persistent Recovery Submission
- Persistent Review Decision
- Other Evidence Types (pre-appointment / acting / election / departure)
- Persistent Packet Store
- Graphile Scheduler
