# Investigator Evidence and Position URL Candidate

**STEP 10** — the Position Evidence phase of the Pi Agent runtime: gather a Position URL
**Candidate Pool** for the frozen PRIMARY_1 / PRIMARY_2, validate it against the pinned Skill
schemas, and freeze it behind a real per-candidate provenance gate.

## Purpose

```text
Frozen STEP 9 Investigation (leadership + PRIMARY_1/PRIMARY_2)
→ fresh INVESTIGATOR Evidence session (Skill official-biography-evidence 3.1.0)
→ get_region_context / search_web (Bocha) / fetch_page|render_page / inspect_page
→ Position URL Candidate Pool (url-candidate-pool rows)
→ submit_investigator_evidence
→ canonical Skill schema validation + PRIMARY join gate + Candidate Provenance Gate
→ in-memory freeze
→ packet READY_FOR_REVIEW
```

Exactly one Institution Packet is processed per run. This phase produces a Candidate Pool,
**not** a final URL — no final URL selection, no ranking, no Reviewer, no Recovery.

## Fresh Evidence Session

Every Evidence run creates a brand-new Pi session through `AgentSessionFactory` with its own
`taskRunId`. The STEP 9 conversation is never reused — this keeps context small and prevents
tool drift. `AgentRole` stays `INVESTIGATOR`; the tool allowlist is phase-scoped via
`INVESTIGATOR_EVIDENCE_ROLE_TOOLS` (base tools + `submit_investigator_evidence`; no
`submit_investigation`, no `submit_inventory`, no coding tools).

## Frozen Investigation Input

The Evidence runner requires a packet in state `EVIDENCE_PENDING` (the STEP 9 Investigator
success state) plus the frozen STEP 9 canonical output as `frozenInput`
(`leadership` + exactly two `selectedOfficials`). The frozen input is re-validated against
the pinned `leadership-structure` / `person-decision` schemas before any session is created
(fail closed). PRIMARY_1 / PRIMARY_2 are **never** re-derived; the runner extracts only the
stable `target_id` / `person_id` identities and wires them into the submit tool's join gate.

## Current Position URL Scope

Only **current position information URL** candidates are gathered — the four deferred
categories (任前公示 / 代理任命 / 选举或任命 / 离任) are out of scope and explicitly excluded
by the Skill.

## Candidate Pool

The submission is a thin runtime envelope referencing canonical Skill artifacts:

```json
{
  "candidates": [ "…url-candidate-pool.schema.json rows…" ],
  "claims":     [ "…optional target-claim.schema.json rows…" ]
}
```

Each envelope part is validated separately through `SkillSchemaRegistry`. The envelope does
not duplicate Skill fields and does not select a final URL.

## Search Result Is Navigation Only

A `search_web` snippet is a navigation candidate, never Evidence. Runtime does not trust the
Agent's claim that pages were opened.

## Fetch/Render + Inspect Requirement

For each candidate URL the session must really open the page (`fetch_page` or `render_page`
SUCCESS) and really inspect it (`inspect_page` SUCCESS) — all in the same session.

## Candidate Provenance Gate

`evaluateEvidenceProvenance` joins every candidate URL against the session's tool events
using canonical URL normalization (`requestedUrl` / `finalUrl` aware). A candidate counts as
opened only when a fetch/render SUCCESS resolves to its normalized URL, and as inspected only
when an `inspect_page` SUCCESS names the same normalized URL. The gate passes only when
**every** candidate is opened and inspected. A submission whose candidates were never really
observed fails with `POSITION_CANDIDATE_OBSERVATION_REQUIRED`.

## PRIMARY Join Gate

The `submit_investigator_evidence` tool enforces a deterministic join: every candidate
`target_id` must equal one of the two frozen PRIMARY `target_id` values, and every optional
claim `target_id` (+ `person_id` when the frozen person is known) must match the frozen
decision. A candidate for a third person is rejected
(`POSITION_CANDIDATE_UNKNOWN_PRIMARY`). Both PRIMARYs must be covered by at least one
candidate (`POSITION_CANDIDATE_COVERAGE_REQUIRED`).

## Evidence Submission Freeze

`InMemoryInvestigatorEvidenceSubmissionSink` accepts exactly one submission per packet; a
second is rejected (`INVESTIGATOR_EVIDENCE_ALREADY_SUBMITTED`). No persistence in this phase.

## Packet State

```text
EVIDENCE_PENDING
  ↓ (Evidence session ready)
EVIDENCE_GATHERING
  ↓ (valid submit + Candidate Provenance Gate PASS + schema PASS)
READY_FOR_REVIEW
```

Failures keep the packet (never deleted):

```text
EVIDENCE_GATHERING → FAILED  (failureCode EVIDENCE_NOT_SUBMITTED | POSITION_CANDIDATE_OBSERVATION_REQUIRED)
EVIDENCE_PENDING   → CANCELLED
EVIDENCE_GATHERING → CANCELLED
```

`READY_FOR_REVIEW` is now the terminal gate of STEP 10: the packet carries a frozen, schema-
valid, provenance-verified Position URL Candidate Pool and is eligible for a later Reviewer.

## Deferred

- Persistent Evidence / persistent tool events
- Recovery Agent
- Reviewer Agent
- Final Position URL decision
- PostgreSQL packet / submission store
- Graphile packet scheduling

The Skill itself is unchanged (3.1.0).
