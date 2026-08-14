# Reviewer and Final Position Decision Foundation (STEP 12)

**Date**: 2026-08-14
**Server**: 43.142.31.198 / `/opt/Stellaris-PiAgent-Dev`
**Branch**: `refactor/pi-agent-runtime-server-20260813`
**Start HEAD**: `dfc4c7f` (STEP 11 persistent evidence + tool event foundation)
**Prerequisite**: STEP 10 evidence `READY_FOR_REVIEW`; STEP 11 persistence proven.

## Goal

Establish the first truly independent Reviewer: a fresh Pi session reads frozen Leadership / PRIMARY / Candidate Evidence, independently searches for omissions, reopens + re-inspects the candidate it approves, submits a Skill-canonical `submit_review_decision`, and freezes the Final Position URL per PRIMARY — moving the packet `READY_FOR_REVIEW → REVIEWING → POSITION_DECIDED` (or `RECOVERY_REQUIRED` when the pool is insufficient). No fabricated Final URL. No Recovery Agent yet.

## Verified contracts (from server source, not assumptions)

### Skill canonical Reviewer artifact — `review-record.schema.json` ("Independent Review Record")
- `review_result`: enum `["APPROVED","REJECTED","REWORK_REQUIRED"]`
- `final_review_result`: enum `["APPROVED_STRICT_ADMISSIBLE","APPROVED_EMPTY_AFTER_EXHAUSTION","REJECTED_INVALID_URL","REWORK_REQUIRED"]`
- `currentness_quality`: enum (CURRENT_COLLECTION_MEMBER / DETAIL_LINKED_FROM_CURRENT_COLLECTION / RECENT_CURRENT_OFFICIAL_EVIDENCE / DETAIL_NOT_IN_CURRENT_COLLECTION / DETAIL_COLLECTION_CONFLICT / CURRENTNESS_UNRESOLVED)
- `checks`: 8 required booleans (person_and_institution, page_type, better_personal_page, news_or_function_page_rejected, currentness, all_discovered_evidence_consumed, empty_search_complete, dynamic_escalation_complete)
- Requires (29 required): review_id, assignment_id, target_id, investigator_agent_id, investigator_context_id, recovery_agent_id, recovery_context_id, reviewer_real_session_id, reviewer_agent_uuid, reviewer_agent_id, reviewer_context_id, review_tool_call_ids (minItems 1), review_open_event_id, review_search_event_ids (minItems 1 → **independent search is structurally required**), reopen_event_id, research_event_id, observed_page_title, observed_breadcrumb, observed_domain_owner, observed_page_shape, observed_source_domain_class, observed_page_shape_signals, final_page_type, currentness_quality, checks, review_result, final_review_result, review_reason, reviewed_at.
- Skill SKILL.md: Reviewer must differ from Investigator/Recovery; bind real session id + agent/context UUIDs + real tool-call IDs; non-empty URL must be really reopened; self-attested APPROVED or unmatched call IDs fail.

### Runtime facts
- `AgentRole.REVIEWER` exists (contracts/agent-role.ts). `ROLE_TOOL_POLICY.REVIEWER` = BASE_AGENT_TOOLS — must gain `submit_review_decision`.
- Packet states today: PENDING/INVESTIGATING/EVIDENCE_PENDING/EVIDENCE_GATHERING/READY_FOR_REVIEW/FAILED/CANCELLED. `READY_FOR_REVIEW: []` (no transitions) — must gain REVIEWING → POSITION_DECIDED / RECOVERY_REQUIRED / FAILED. No `COMPLETED` terminal state.
- Tool failure codes use `POSITION_CANDIDATE_*` / `INVESTIGATOR_EVIDENCE_ALREADY_SUBMITTED` style.
- `createAgentToolRegistry` has per-submit-tool options; add `submitReviewDecisionTool`.
- `createAgentSession(role, ctx, { tools })` allowlist comes from `roleToolsFor(role)`.
- Skill validator patterns: `createSkillEvidenceValidator` (url-candidate-pool / target-claim), `createSkillInvestigationValidator` (leadership + selectedOfficials) — reuse for frozen-input validation. New `createSkillReviewValidator` compiles `review-record.schema.json`.
- Model env: AGENT_MODEL_PROVIDER/AGENT_MODEL_ID (STEP 10 real value `deepseek-v4-flash`, verified present in `/root/.pi/agent/models.json`); search env WEB_SEARCH_PROVIDER=bocha + BOCHA_API_KEY; DEEPSEEK_API_KEY. Secrets file `/root/.stellaris-reviewer-smoke-secrets` (mode 600) already created + verified.

### Real smoke targets (verified fetchable, current, support person+role+institution)
- PRIMARY_1 董涵 (区长): `http://www.njgl.gov.cn/xxgk/qczc/dh/` → "区委副书记 / 区长、党组书记"
- PRIMARY_2 石磊 (副区长): `http://www.njgl.gov.cn/xxgk/qczc/sl/` → "区委常委 / 副区长（正局）、党组副书记"
- (STEP 9 fixture's 王安伟 区委书记 has no official per-person page — official hits are news/work-dynamic only. Per the Skill those are REJECTED_NEWS_OR_WORK_DYNAMIC, so the reviewer smoke uses two 区政府领导 with real official profile pages; fixture stays schema-valid and institution-consistent.)

## Design decisions

1. **Thin runtime envelope over the canonical artifact.** `ReviewerSubmissionPayload { reviews: ReviewerTargetReviewInput[] }`; each review carries the canonical outcome enums + judgment fields + a runtime `selected_candidate_id` pointer (null on rework). The full canonical `review-record` is constructed by the runtime with session attestation (session id, UUIDs, real tool-call IDs, observed page fields from inspect) and validated against `review-record.schema.json` via `SkillSchemaRegistry`. No second reviewer schema; envelope only transports + selects.
2. **Deterministic gates.** Tool: PRIMARY join (only frozen PRIMARY_1/PRIMARY_2 targets, both covered exactly once), candidate membership (selected_candidate_id must be a frozen-pool candidate), outcome consistency (APPROVED ⇒ candidate + APPROVED_STRICT_ADMISSIBLE/EMPTY; REWORK/REJECTED ⇒ null candidate), freeze (second submit → `REVIEW_DECISION_ALREADY_SUBMITTED`). Runner: canonical schema gate, reviewer observation gate (each APPROVED candidate URL must have reviewer-session fetch_page/render_page SUCCESS + inspect_page SUCCESS), independent-search gate (structural via `review_search_event_ids` ≥ 1), packet-state mapping (both approved → POSITION_DECIDED; any rework → RECOVERY_REQUIRED).
3. **No TypeScript candidate ranking, no DeepSeek/Bocha hardcoding, no region-specific code.** Judgment is Pi + Skill; runtime validates/joins/gates/freezes only.
4. **In-memory only.** `InMemoryReviewDecisionSink`; no Migration 005, no Postgres changes. STEP 11 persistence pattern already proven and reused by interface shape only.
5. **Reviewer session tool events stay in-memory** (`MemoryToolEventSink`), keyed by `reviewerSessionId`; Investigator/Evidence tool events are never touched.

## Task 1 — Review decision submission + freeze + tool policy (agent-tools + role policy)

- `packages/agent-tools/src/contracts/tool-failure-codes.ts`: add `REVIEW_DECISION_ALREADY_SUBMITTED`, `REVIEW_UNKNOWN_PRIMARY_TARGET`, `REVIEW_TARGET_COVERAGE_REQUIRED`, `REVIEW_CANDIDATE_NOT_IN_POOL`, `REVIEW_OUTCOME_INCONSISTENT`, `REVIEW_OBSERVATION_REQUIRED`.
- `packages/agent-tools/src/tools/reviewer/review-decision-submission.ts`: contracts (enums above, `ReviewerTargetReviewInput`, `ReviewerSubmissionPayload`, `ReviewerDecisionSink` (submit/getSubmission/isFrozen), `ReviewerDecisionSubmitResult`, `ReviewerSubmissionValidator`).
- `packages/agent-tools/src/tools/reviewer/submit-review-decision.ts`: `submit_review_decision` custom tool (typebox input, deps `{ sink, primaryDecisions, candidatePool }`, gates above, freeze).
- `packages/agent-tools/src/registry/default-tool-registry.ts`: add `submitReviewDecisionTool` option.
- `packages/agent-tools/src/index.ts`: export reviewer tools.
- `packages/agent-runtime/src/session/role-tool-policy.ts`: `REVIEWER_ROLE_TOOLS = [...BASE_AGENT_TOOLS, "submit_review_decision"]`; set `ROLE_TOOL_POLICY.REVIEWER`.

## Task 2 — Packet review states + reviewer decision sink (agent-runtime)

- `packages/agent-runtime/src/work-packet/institution-work-packet.ts`: add states `REVIEWING`, `POSITION_DECIDED`, `RECOVERY_REQUIRED`; transitions `READY_FOR_REVIEW → [REVIEWING]`, `REVIEWING → [POSITION_DECIDED, RECOVERY_REQUIRED, FAILED]`. No `COMPLETED`.
- `packages/agent-runtime/src/reviewer/review-decision-sink.ts`: `InMemoryReviewDecisionSink` (submit/getSubmission/isFrozen, sha256 hash, second submit → ALREADY_SUBMITTED).
- `packages/agent-runtime/src/reviewer/skill-review-validator.ts`: `createSkillReviewValidator(identity)` compiling `review-record.schema.json` ("Independent Review Record").
- `packages/agent-runtime/src/reviewer/reviewer-types.ts`: `ReviewerRequest` (packetId + frozenInput { leadership, selectedOfficials, candidatePool }), result types (COMPLETED / RECOVERY_REQUIRED / FAILED / INVALID_REQUEST / PACKET_NOT_FOUND / PACKET_NOT_ELIGIBLE / MODEL_NOT_CONFIGURED / MODEL_NOT_FOUND), `ReviewerFreezeReceipt`, `ReviewerFinalDecision { targetId, primarySlot, selectedCandidateId, finalUrl, reviewResult }`.

## Task 3 — ReviewerAgentRunner + attestation + gates

- `packages/agent-runtime/src/reviewer/review-attestation.ts`: `attestReviewRecords(submission, { reviewerSessionId, agentUuids, eventSink, frozenInput })` builds canonical review-records (runtime backfills event IDs, UUIDs, session id, observed page fields from inspect output); `evaluateReviewerObservation(successes, submission, poolById)` (per APPROVED candidate URL: fetch/render SUCCESS + inspect SUCCESS; search SUCCESS ≥ 1).
- `packages/agent-runtime/src/reviewer/reviewer-role-prompt.ts`: short prompt (independent reviewer, frozen inputs, CURRENT POSITION URL only, independent search as omission check, reopen+inspect the approved candidate, submit_review_decision, REWORK on insufficient pool, never fabricate/select outside pool).
- `packages/agent-runtime/src/reviewer/reviewer-agent-runner.ts`: `ReviewerAgentRunner` — fresh REVIEWER session, validates frozen inputs (existing investigation + evidence validators), wires submit_review_decision tool + gates + InMemory sink + MemoryToolEventSink, runs prompt, attests records, validates canonical schema, observation gate, maps packet state (POSITION_DECIDED / RECOVERY_REQUIRED / FAILED).
- `packages/agent-runtime/src/index.ts`: export `./reviewer/index.js` (or the module files).

## Task 4 — Targeted tests + one real Reviewer smoke

- Tests (6–10, no full runs): `reviewer/review-decision-submission.test.ts` (valid approved → frozen; duplicate → REJECTED; unknown candidate ref → REJECTED; unknown third target → REJECTED); `reviewer/reviewer-gates.test.ts` (approved without reviewer inspect → reject; with reviewer fetch+inspect → accept; REWORK → RECOVERY_REQUIRED mapping); `reviewer/reviewer-agent-runner.test.ts` (fake Pi: session ends without submit → FAILED; valid frozen review → POSITION_DECIDED; recovery submission → RECOVERY_REQUIRED); `session/role-tool-policy.test.ts` (REVIEWER has the 6 tools, lacks submit_inventory/submit_investigation/submit_investigator_evidence/read/bash/edit/write); `work-packet/institution-work-packet.test.ts` (READY_FOR_REVIEW → REVIEWING → POSITION_DECIDED and → RECOVERY_REQUIRED).
- `packages/agent-runtime/src/smoke/fixtures/reviewer-gulou-input.json`: schema-valid frozen input (leadership + selectedOfficials 董涵/石磊 + candidate pool with the two real URLs above).
- `packages/agent-runtime/src/smoke/reviewer-smoke.ts` (+ `.test.ts` for the gate function): real smoke — fresh session, real DeepSeek + Bocha, independent search, reopen + inspect the two candidates, submit_review_decision → both APPROVED → POSITION_DECIDED. Budget ~9 min (retry once at 11 min if external-site-slow only). Secrets from `/root/.stellaris-reviewer-smoke-secrets`.

## Task 5 — Docs + self-review + secret cleanup + commit

- Docs: `docs/agent-runtime/reviewer-final-position-decision-foundation.md` (purpose, fresh session, frozen inputs, independent search, read-only pool rule, reopen/re-inspect gate, membership gate, PRIMARY join, outcomes POSITION_DECIDED / RECOVERY_REQUIRED, Final Position Decision SSOT, Deferred list). No SQL.
- Verification: `corepack pnpm -r typecheck`; targeted tests above; one real Reviewer smoke.
- Secret cleanup: `rm -f /root/.stellaris-reviewer-smoke-secrets`; unset env; scan tracked files for the two keys (must be absent); delete `/tmp/probe-gulou.mjs`.
- Commit (max 2 natural commits, no push): `feat(agent): add reviewer final position decision foundation` (+ optional docs commit).

## Prohibitions (hard)

- No Skill modification (official-biography-evidence 3.1.0). No DB migration / Postgres change. No Graphile / Worker / POST /api/tasks. No Frontend / Excel. No Recovery Agent. No COMPLETED state. No other evidence types (pre-appointment / acting / election / departure). No TypeScript candidate ranking. No hardcoded deepseek/bocha/region. No secrets in repo/docs/logs/report. No full workspace tests. No production change.
- Reviewer never mutates the frozen candidate pool; a pool-external better URL found by search may only produce REWORK/RECOVERY_REQUIRED.

## Architecture self-review

- [x] Fresh Pi session; Investigator/Evidence contexts NOT reused.
- [x] Input = frozen/durable evidence (structured artifacts; runner depends on the frozen-input interface, never a Postgres class).
- [x] Leadership/PRIMARY never recomputed; PRIMARYs come from frozen person decisions.
- [x] Candidate pool read-only; final URL must be a pool member.
- [x] Search snippets never become Final Evidence.
- [x] Approved candidate must be reopened + re-inspected by the Reviewer session.
- [x] Independent search structurally required (review_search_event_ids ≥ 1).
- [x] Pool-insufficient / better-outside-candidate → RECOVERY_REQUIRED.
- [x] No semantic ranking in TypeScript; Skill is semantic authority.
- [x] No DeepSeek/Bocha hardcoding; provider-neutral (ModelPolicy + SearchProvider).
- [x] read/bash/edit/write disabled; no submit_inventory/investigation/investigator_evidence.
- [x] Skill unchanged; no DB migration; no Graphile; no Recovery; no production.

## Execution footer

SELF_REVIEW: PASS
ARCHITECTURE_CONFLICT: NONE
EXECUTION_PREAUTHORIZED_BY_USER: YES
EXECUTION_MODE: INLINE_FAST
TEST_POLICY: TARGETED_ONLY
