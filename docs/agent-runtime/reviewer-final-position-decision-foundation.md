# Reviewer and Final Position Decision Foundation (STEP 12)

**Date**: 2026-08-14
**Branch**: `refactor/pi-agent-runtime-server-20260813`
**Prerequisite**: STEP 10 evidence frozen (`READY_FOR_REVIEW`); STEP 11 persistence proven.

## Purpose

STEP 10 produced a frozen Position URL Candidate Pool. STEP 12 establishes the **first truly independent Reviewer**: a fresh REVIEWER Pi session reads only frozen Leadership / PRIMARY person decisions / Candidate Evidence, independently searches for omissions, reopens + re-inspects the candidate it approves, and freezes a per-PRIMARY Review Decision through a Skill-canonical `submit_review_decision`. The packet moves `READY_FOR_REVIEW → REVIEWING → POSITION_DECIDED` (both PRIMARYs approved) or `RECOVERY_REQUIRED` (any rework). No fabricated Final URL; no Recovery Agent yet.

## Independent Reviewer Fresh Session

- A brand-new Pi session with `AgentRole.REVIEWER`; the Investigator and Evidence contexts are **never reused** (smoke asserts `investigator_session_reused: NO`, `evidence_session_reused: NO`).
- Inputs are structured frozen artifacts (Leadership Structure, Person Decisions, Candidate Pool) — never Investigator reasoning, chat, or hidden chains.
- The reviewer is told it did not participate in the Investigator's decisions.

## Frozen Investigator Inputs

- `leadership` — canonical Leadership Structure (`leadership-structure.schema.json`), validated at the runtime boundary by `createSkillInvestigationValidator`.
- `selectedOfficials` — frozen Person Decisions (`person-decision.schema.json`) carrying PRIMARY_1 / PRIMARY_2. The reviewer never re-selects or swaps PRIMARYs (deterministic join gate).
- `candidatePool` — frozen Position URL Candidate Pool (`url-candidate-pool.schema.json`), validated by `createSkillEvidenceValidator`.

## Independent Search Check

- The Reviewer must run at least one real `search_web` (Bocha) as an omission cross-check. This is structurally required: the canonical Independent Review Record (`review-record.schema.json`) demands `review_search_event_ids` with `minItems: 1`, so a reviewer that never searched fails the Skill schema gate.
- Search snippets are **never** the Final Position URL — they are navigation/omission checks only.

## Candidate Pool Read-only Rule

The reviewer cannot add, remove, rewrite, or re-rank candidates. The runtime candidate-membership gate rejects any `selected_candidate_id` that is not a frozen-pool member. If the reviewer's independent search finds a better page outside the pool, it must produce `REWORK_REQUIRED` (`RECOVERY_REQUIRED`) and record it — a future Recovery Agent folds it into Candidate Evidence.

## Reviewer Re-open / Re-inspect Gate

Before approval, the Reviewer session itself must produce `fetch_page`/`render_page` SUCCESS and `inspect_page` SUCCESS for the approved candidate URL. The runtime observation gate verifies this per-URL (normalized), and the canonical record is built with the real tool-call IDs matched to those events — self-attested approval never passes.

## Deterministic Gates (TypeScript)

| Gate | Behavior |
| --- | --- |
| PRIMARY join | every review targets a frozen PRIMARY; no third person; PRIMARY_1 and PRIMARY_2 each reviewed exactly once |
| Candidate membership | approved `selected_candidate_id` must be a frozen-pool candidate |
| Outcome consistency | APPROVED ⇒ pool candidate + `APPROVED_*` result; REWORK/REJECTED ⇒ null candidate |
| Freeze | exactly one submission per packet → `REVIEW_DECISION_ALREADY_SUBMITTED` on repeat |
| Observation | every APPROVED candidate reopened + inspected in the Reviewer session |
| Independent search | ≥ 1 `search_web` SUCCESS (via canonical `review_search_event_ids`) |
| Canonical schema | runtime-attested Independent Review Record validated against `review-record.schema.json` |

No candidate ranking, no source/page re-classification, no DeepSeek/Bocha hardcoding in TypeScript — judgment stays Pi + Skill.

## Review Outcomes

- Per PRIMARY, the reviewer submits `review_result` (APPROVED / REJECTED / REWORK_REQUIRED) and `final_review_result` (APPROVED_STRICT_ADMISSIBLE / APPROVED_EMPTY_AFTER_EXHAUSTION / REJECTED_INVALID_URL / REWORK_REQUIRED) with `review_reason`, `currentness_quality`, and the 8 canonical `checks`.
- **POSITION_DECIDED**: both PRIMARY_1 and PRIMARY_2 approved with frozen-pool candidates.
- **RECOVERY_REQUIRED**: any PRIMARY is rework/rejected or has no admissible frozen candidate.
- **FAILED**: no submission, canonical schema invalid, or observation gate failed.
- The packet **never** reaches `COMPLETED` — future evidence types (pre-appointment, acting, election/appointment, departure) are still to come.

## Final Position Decision SSOT

On approval, the frozen Review Decision per target (selected candidate + final URL) is the **single source of truth** for the Current Position URL. Excel must later read the Final Decision — never the first candidate-pool row and never a re-select. Excel integration is Deferred.

## In-memory Scope

`InMemoryReviewDecisionSink` freezes the decision; the canonical record is constructed and validated in-process. No Migration 005, no Postgres change, no Tool Event persistence change (the Reviewer session uses `MemoryToolEventSink` keyed by `reviewerSessionId`). STEP 11's persistence pattern remains the durable boundary for the future Persistent Review Decision step.

## Real Reviewer Smoke (verified)

`packages/agent-runtime/src/smoke/reviewer-smoke.ts` against 鼓楼区人民政府 (real current leader profile pages):

```
status: OK
role: REVIEWER  skill: official-biography-evidence 3.1.0
reviewer_session_created: YES  fresh_session: YES
investigator_session_reused: NO  evidence_session_reused: NO
search_web_called: YES  bocha_called: YES
fetch_page_called: YES  render_page_called: NO (static enough)
inspect_page_called: YES  submit_review_decision_called: YES
PRIMARY_1: APPROVED → cand-gulou-p1-dh → http://www.njgl.gov.cn/xxgk/qczc/dh/ (董涵 区长)
PRIMARY_2: APPROVED → cand-gulou-p2-sl → http://www.njgl.gov.cn/xxgk/qczc/sl/ (石磊 副区长)
candidate_in_pool: YES ×2  reopened: YES ×2  inspected: YES ×2
observation_gate: PASS  decision_frozen: YES
packet_final_state: POSITION_DECIDED  duration_ms: ~40s
```

## Files

- `packages/agent-tools/src/tools/reviewer/*` (contracts + `submit_review_decision`), failure codes, default tool registry, index
- `packages/agent-runtime/src/session/role-tool-policy.ts` (`REVIEWER_ROLE_TOOLS`)
- `packages/agent-runtime/src/work-packet/institution-work-packet.ts` (REVIEWING / POSITION_DECIDED / RECOVERY_REQUIRED)
- `packages/agent-runtime/src/reviewer/*` (runner, sink, validator, attestation, gates, prompt, types)
- `packages/agent-runtime/src/smoke/reviewer-smoke.ts` + fixture
- Root + package `agent:smoke:reviewer` scripts

## Deferred

- Persistent Review Decision (PostgreSQL)
- Recovery Agent
- Pre-appointment / acting / election-or-appointment / departure evidence
- Excel Final Decision integration
- Persistent Packet Store
- Graphile scheduler
