# Institution Work Packet and Investigator Agent Foundation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:writing-plans. Execution is pre-authorized INLINE by the user (`EXECUTION_MODE: INLINE_FAST`). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove the real, minimal Investigator loop end-to-end on the dev server — Frozen TARGETED Inventory → `InstitutionWorkPacket` (runtime scheduling object) → one Investigator Agent (role `INVESTIGATOR`, Skill `official-biography-evidence` 3.1.0 loaded) → `get_region_context` / `search_web` (Bocha) / `fetch_page`|`render_page` / `inspect_page` → complete Leadership Structure → Skill-selected `PRIMARY_1` + `PRIMARY_2` → `submit_investigation` → canonical Skill schema validation + runtime Observation Gate → freeze → packet `READY_FOR_REVIEW`.

**Architecture:** The Skill's own workspace artifact `institution-work-packet.schema.json` is **not** reimplemented — it describes the Skill's `20_institutions/institution_work_packets.jsonl` (business fields: source routes, expected leader sections, `status` enum `NOT_STARTED…`). The new TypeScript `InstitutionWorkPacket` is a **pure Runtime scheduling object** (packetId, inventoryHash, regionCode, institution identity, state machine `PENDING→INVESTIGATING→READY_FOR_REVIEW` + `FAILED/CANCELLED`, attemptNo, timestamps) generated **mechanically** from a Frozen Inventory (only `decision === "INCLUDE"` → packet; EXCLUDE produces none). `submit_investigation` is a light Runtime Envelope `{ leadership: <canonical leadership-structure artifact>, selectedOfficials: [<canonical person-decision artifact PRIMARY_1>, <canonical person-decision artifact PRIMARY_2>] }`; each part is validated separately through `SkillSchemaRegistry`, the envelope itself is transport-only and does **not** duplicate Skill fields. PRIMARY ranking stays in Skill → Pi; TypeScript adds only a deterministic distinct-person gate (mechanical uniqueness, not a ranking rule). One freeze per packet. No Reviewer, no Recovery, no PostgreSQL, no Graphile, no Skill change.

**Tech Stack:** pnpm monorepo (`@stellaris/agent-runtime`, `@stellaris/agent-tools`, `@stellaris/contracts`), Pi SDK 0.84.1, DeepSeek `deepseek-v4-pro` (initial model provider, via `AGENT_MODEL_PROVIDER`/`AGENT_MODEL_ID` env), Bocha Web Search (initial search provider, via `WEB_SEARCH_PROVIDER`/`BOCHA_API_KEY` env), ajv 8.20.0, vitest, tsx.

**Spec:** `docs/agent-runtime/inventory-agent-foundation.md` (Step 8) · `docs/agent-runtime/full-inventory-discovery-and-freeze.md` (Step 8B) · Skill `official-biography-evidence` 3.1.0 `SKILL.md` + `references/execution-contract.md` + `schemas/`.

## Global Constraints

- Server: `/opt/Stellaris-PiAgent-Dev` on `43.142.31.198`, branch `refactor/pi-agent-runtime-server-20260813`, start HEAD `8948d29`. Worktree clean.
- Node `v24.19.0` via `source ~/.nvm/nvm.sh && nvm use 24.19.0`; run package scripts with `corepack pnpm`.
- Secrets live ONLY in `/root/.stellaris-investigator-smoke-secrets` (mode 600): `AGENT_MODEL_PROVIDER=deepseek`, `AGENT_MODEL_ID=deepseek-v4-pro`, `DEEPSEEK_API_KEY`, `WEB_SEARCH_PROVIDER=bocha`, `BOCHA_API_KEY`. Never echoed/committed/logged; delete file and unset env at the end.
- DeepSeek = initial model provider, Bocha = initial search provider. Provider-neutral architecture mandatory — no `if provider === "deepseek"`, no `if searchProvider === "bocha"`, no SDK imports in the investigation domain.
- Skill `official-biography-evidence` 3.1.0 pinned and UNMODIFIED. Leadership completeness / PRIMARY selection rules stay in Skill → Pi, never duplicated in TypeScript.
- INVESTIGATOR tool allowlist exactly: `get_region_context search_web fetch_page render_page inspect_page submit_investigation`. Default coding tools (`read`/`bash`/`edit`/`write`) stay DISABLED. `submit_inventory` NOT available to INVESTIGATOR.
- `submit_investigation` is the only Investigator output boundary; canonical schemas from `SkillSchemaRegistry` (`leadership-structure.schema.json`, `person-decision.schema.json`); exactly one freeze per packet (`INVESTIGATION_ALREADY_SUBMITTED` on repeat).
- Runtime Observation Gate (in `InvestigatorAgentRunner`, not just the prompt): the run may reach `READY_FOR_REVIEW` only if `MemoryToolEventSink` has ≥1 SUCCESS `fetch_page` **or** `render_page` **and** ≥1 SUCCESS `inspect_page`. Otherwise `FAILED` / `INVESTIGATION_OBSERVATION_REQUIRED` even if `submit_investigation` was called.
- In-memory only (`InMemoryInstitutionWorkPacketStore`, `InMemoryInvestigationSubmissionSink`, `MemoryToolEventSink`). No Graphile, no PostgreSQL, no Reviewer, no Recovery, no persistent Evidence.
- Test policy: TARGETED ONLY. No full workspace / crawler / backend / playwright / deploy suites. New tests ≈ 6–9.
- The smoke runs exactly **one** Institution Packet (a real Frozen TARGETED Inventory → 1 packet → 1 Investigator session). Never all institutions.
- Build: `@stellaris/agent-tools` exports change → rebuild `@stellaris/agent-tools` before agent-runtime typecheck/tests/smoke (workspace consumers resolve its `dist`).

## Verified canonical artifacts (read from the pinned Skill, not guessed)

- `schemas/leadership-structure.schema.json` (title **"Leadership Structure"**). Required: `structure_id`, `institution_id`, `all_visible_leaders` (min 1; items `{person_name, visible_roles[], evidence_ids?}`, additionalProperties false), `official_order` (min 1), `party_head` (string|null), `administrative_head` (string|null), `party_deputy_secretaries[]`, `executive_deputies[]`, `other_deputies[]`, `vacancy_information[]`, `supporting_evidence_ids[]` (min 1), `structure_complete` (**const true**), `investigator_agent_id`, `investigator_context_id`, `decided_at`. `additionalProperties: false`.
- `schemas/person-decision.schema.json` (title **"Person Decision"**; one per selected official). Required: `person_decision_id`, `person_id` (string|null), `target_id`, `institution_id`, `primary_slot` (**enum `PRIMARY_1`/`PRIMARY_2`**), `leadership_structure_id`, `person_status` (enum `PERSON_CONFIRMED`/`PERSON_UNRESOLVED_AFTER_COMPLETE_SEARCH`/`VACANT`), `person_name` (string|null), `role_canonical` (string|null), `selection_basis` (min 1), `rank_information` (string|null), `responsibility_description` (string|null), `currentness_quality` (6-value enum), `supporting_evidence_ids[]`, `investigator_agent_id`, `investigator_context_id`, `decided_at`. `additionalProperties: false`.
- `schemas/institution-inventory.schema.json` (title **"Frozen Institution Inventory Record"**): `decision` enum includes `INCLUDE` and `EXCLUDE_*`; runtime builds packets only for `INCLUDE`.
- `references/execution-contract.md` line 50: complete leadership structure first, **then** select PRIMARY_1/PRIMARY_2; person decisions must reference the leadership structure; the same natural person must not occupy both slots.

## Task 1: Inspect frozen Inventory contracts, Skill Investigator schemas, runtime boundaries

**Files:** none (inspection already performed; findings recorded above and below)

- [ ] **Step 1: Confirm server state**
  `git branch --show-current` = `refactor/pi-agent-runtime-server-20260813`; `git rev-parse HEAD` = `8948d29`; `git status --short` clean; `node --version` = `v24.19.0`; `corepack pnpm --version` = 10.x.
- [ ] **Step 2: Record the verified boundary facts** (already captured in the plan preamble): existing `AgentRole.INVESTIGATOR`; `ROLE_TOOL_POLICY.INVESTIGATOR` currently = `BASE_AGENT_TOOLS`; `createAgentToolRegistry({ submitInventoryTool? })` extension point; `ToolGateway` + `MemoryToolEventSink`; `InventoryAgentRunner` pattern; `InMemoryInventorySubmissionSink` pattern; `createSkillInventoryValidator` pattern; `buildInventoryRolePrompt` pattern; `inventory-smoke.ts` pattern; root scripts `agent:smoke:*`.

## Task 2: Implement InstitutionWorkPacket + in-memory packet store/state transitions

**Files:**
- Create: `packages/agent-runtime/src/work-packet/institution-work-packet.ts`
- Create: `packages/agent-runtime/src/work-packet/institution-work-packet.test.ts`
- Modify: `packages/agent-runtime/src/index.ts` (export `./work-packet/institution-work-packet.js`)

**Interfaces:**
- `InstitutionWorkPacketState = "PENDING" | "INVESTIGATING" | "READY_FOR_REVIEW" | "FAILED" | "CANCELLED"`
- `InstitutionWorkPacket = { packetId: string; inventoryHash: string; regionCode?: string; institutionId: string; institutionName: string; administrativeLevel: AdministrativeLevel; institutionType?: string; state: InstitutionWorkPacketState; attemptNo: number; investigatorSessionId?: string; failureCode?: string; createdAt: string; updatedAt: string }`
- `class InMemoryInstitutionWorkPacketStore`:
  - `createFromFrozenInventory(frozen: InventorySubmissionPayload, opts?: { regionCode?: string }): InstitutionWorkPacket[]` — sha256 of the frozen payload → `inventoryHash`; **only** records with `decision === "INCLUDE"` get a packet; `packetId = randomUUID()`; `state = "PENDING"`; `attemptNo = 1`.
  - `get(packetId): InstitutionWorkPacket | undefined`
  - `list(): InstitutionWorkPacket[]`
  - `updateState(packetId, to, meta?: { investigatorSessionId?; failureCode? }): InstitutionWorkPacket` — fail-closed transition map `PENDING→[INVESTIGATING, CANCELLED]`, `INVESTIGATING→[READY_FOR_REVIEW, FAILED, CANCELLED]`, others `[]`; invalid → throw `PacketStateError` (`INVALID_TRANSITION`); merges meta; stamps `updatedAt`.
- Consumes: `AdministrativeLevel`, `InventorySubmissionPayload`, `InstitutionInventoryRecord` from `@stellaris/agent-tools`.

- [ ] **Step 1:** Write `institution-work-packet.ts` with the store and fail-closed transitions.
- [ ] **Step 2:** Write `institution-work-packet.test.ts` (targeted, ≤5 cases):
  1. INCLUDE-only → packet created, `state: PENDING`, `inventoryHash` set.
  2. EXCLUDE / DUPLICATE_ENTRY records → no packet.
  3. `PENDING → INVESTIGATING → READY_FOR_REVIEW` transitions succeed and stamp `updatedAt`.
  4. Duplicate start rejected: second `updateState(pkt, "INVESTIGATING")` after already INVESTIGATING throws.
  5. `INVESTIGATING → FAILED` (with `failureCode`) retains the packet (`FAILED` retained, not deleted).

## Task 3: Implement submit_investigation + InvestigationSubmissionSink + Skill schema validation + tool policy

**Files:**
- Create: `packages/agent-tools/src/tools/investigation/investigation-submission.ts`
- Create: `packages/agent-tools/src/tools/investigation/submit-investigation.ts`
- Create: `packages/agent-tools/src/tools/investigation/submit-investigation.test.ts`
- Modify: `packages/agent-tools/src/contracts/tool-failure-codes.ts` (add `INVESTIGATION_ALREADY_SUBMITTED`, `PRIMARY_PEOPLE_NOT_DISTINCT`)
- Modify: `packages/agent-tools/src/registry/default-tool-registry.ts` (add `submitInvestigationTool?: AgentToolDefinition` option, like `submitInventoryTool`)
- Modify: `packages/agent-tools/src/index.ts` (export `./tools/investigation/investigation-submission.js`, `./tools/investigation/submit-investigation.js`)
- Create: `packages/agent-runtime/src/investigation/investigation-submission-sink.ts`
- Create: `packages/agent-runtime/src/investigation/skill-investigation-validator.ts`
- Create: `packages/agent-runtime/src/investigation/skill-investigation-validator.test.ts`
- Modify: `packages/agent-runtime/src/session/role-tool-policy.ts` (add `INVESTIGATOR_ROLE_TOOLS = [...BASE_AGENT_TOOLS, "submit_investigation"]`; point `ROLE_TOOL_POLICY.INVESTIGATOR` at it; keep RECOVERY/REVIEWER on `BASE_AGENT_TOOLS`)
- Modify: `packages/agent-runtime/src/session/role-tool-policy.test.ts` (INVESTIGATOR has exactly the six tools, no `submit_inventory`, no `read/bash/edit/write`; `submit_investigation` not in INVENTORY)
- Modify: `packages/agent-runtime/src/index.ts` (export investigation modules)

**Interfaces (`investigation-submission.ts`, agent-tools):**
- `LeadershipStructureArtifact = Record<string, unknown>`; `PersonDecisionArtifact = Record<string, unknown>` (runtime transport only — no Skill field duplication).
- `InvestigationSubmissionPayload = { leadership: LeadershipStructureArtifact; selectedOfficials: PersonDecisionArtifact[] }`
- `SubmissionValidation = { valid: true } | { valid: false; errors: string[] }`
- `InvestigationSubmissionValidator { validate(payload): SubmissionValidation }`
- `InvestigationSubmitResult = { status: "ACCEPTED"; payloadHash } | { status: "ALREADY_SUBMITTED"; payloadHash }`
- `InvestigationSubmissionSink { submit; getSubmission; isFrozen }`
- `SubmitInvestigationSuccess = { status: "ACCEPTED"; frozen: true; leadershipValidated: true; selectedOfficialsValidated: true; primary1: string | null; primary2: string | null; primaryPeopleDistinct: boolean; payloadHash }`

**submit_investigation tool:**
- Input Typebox: `{ leadership: Type.Object({}, { additionalProperties: true }), selectedOfficials: Type.Array(Type.Object({}, { additionalProperties: true }), { minItems: 2, maxItems: 2 }) }`.
- execute: validator.validate → on fail `SCHEMA_VALIDATION_FAILED`; mechanical distinct-person gate → on same person `PRIMARY_PEOPLE_NOT_DISTINCT` (same `person_id` when both present, else same `person_name` when both present); sink.submit → on `ALREADY_SUBMITTED` `INVESTIGATION_ALREADY_SUBMITTED`; return success.

**`createSkillInvestigationValidator(identity)`** (agent-runtime): `SkillSchemaRegistry.load(identity.path + "/schemas")`; locate "Leadership Structure" and "Person Decision" by title (fallback filename); Ajv2020 compile each; validate `leadership` and every `selectedOfficials[i]`.

**`InMemoryInvestigationSubmissionSink`** (agent-runtime): exactly one accepted submission per instance (mirror `InMemoryInventorySubmissionSink`).

- [ ] **Step 1:** Add the two failure codes.
- [ ] **Step 2:** Write `investigation-submission.ts` and `submit-investigation.ts`.
- [ ] **Step 3:** Wire `submitInvestigationTool` into `createAgentToolRegistry` and export from `index.ts`.
- [ ] **Step 4:** Write `submit-investigation.test.ts` (stub validator + RecordingSink):
  1. valid canonical payload → `ACCEPTED`, frozen, `primaryPeopleDistinct: true`.
  2. invalid schema → rejected `SCHEMA_VALIDATION_FAILED`.
  3. second submission → rejected `INVESTIGATION_ALREADY_SUBMITTED`.
  4. PRIMARY_1 person_id == PRIMARY_2 person_id → rejected `PRIMARY_PEOPLE_NOT_DISTINCT`.
  5. more than two selectedOfficials → tool input `INVALID_INPUT` (Typebox).
- [ ] **Step 5:** Write the sink + validator + validator test (real Skill on disk, mirroring `skill-inventory-validator.test.ts`; assert a valid leadership + two person decisions pass and a broken one fails).
- [ ] **Step 6:** Update role tool policy + test.
- [ ] **Step 7:** Rebuild `@stellaris/agent-tools` (`corepack pnpm --filter @stellaris/agent-tools build`) so agent-runtime consumers see the new exports.

## Task 4: Implement InvestigatorAgentRunner + role tool policy wiring + one real packet smoke

**Files:**
- Create: `packages/agent-runtime/src/investigation/investigation-types.ts`
- Create: `packages/agent-runtime/src/investigation/investigation-role-prompt.ts`
- Create: `packages/agent-runtime/src/investigation/investigator-agent-runner.ts`
- Create: `packages/agent-runtime/src/investigation/investigator-agent-runner.test.ts`
- Create: `packages/agent-runtime/src/smoke/investigation-smoke.ts`
- Create: `packages/agent-runtime/src/smoke/investigation-smoke.test.ts`
- Modify: `packages/agent-runtime/src/index.ts` (export investigation runner/types)
- Modify: `packages/agent-runtime/package.json` (`smoke:investigation` script)
- Modify: `package.json` (root `agent:smoke:investigation` script)

**Interfaces (`investigation-types.ts`):**
- `InvestigationToolCallSummary = { toolName; called; succeeded }`
- `InvestigationObservationGate = { fetchOrRenderSucceeded: boolean; inspectSucceeded: boolean; passed: boolean }`
- `InvestigationAgentRequest = { packetId: string }`
- `InvestigationCompletedResult = { status: "COMPLETED"; packetId; packet: InstitutionWorkPacket; leadership: LeadershipStructureArtifact; selectedOfficials: PersonDecisionArtifact[]; frozen: true; agentSessionId; skill: { name; version }; model: { provider; model }; toolCalls: InvestigationToolCallSummary[]; observationGate: InvestigationObservationGate; receipt: { frozen: true; leadershipValidated: true; selectedOfficialsValidated: true; primary1: string | null; primary2: string | null; primaryPeopleDistinct: boolean; payloadHash } }`
- `InvestigationAgentResult = COMPLETED | { status: "INVALID_REQUEST"; reason } | { status: "PACKET_NOT_FOUND"; packetId } | { status: "PACKET_ALREADY_STARTED"; packetId } | { status: "MODEL_NOT_CONFIGURED" } | { status: "MODEL_NOT_FOUND"; provider; model } | { status: "FAILED"; packetId; packet; failureCode: "INVESTIGATION_NOT_SUBMITTED" | "INVESTIGATION_OBSERVATION_REQUIRED"; agentSessionId; toolCalls }`
- `InvestigationRuntimeError`

**`InvestigatorAgentRunner` (deps: `skillRuntime`, `packetStore`, optional `modelPolicy`, `modelResolver`, `createSession`, `sink`, `validator`, `eventSink`, `abortSignal`):**
1. `packet = packetStore.get(packetId)`; missing → `PACKET_NOT_FOUND`.
2. `packet.state !== "PENDING"` → `PACKET_ALREADY_STARTED` (fail closed; duplicate start rejected).
3. `skillRuntime.reload()` + `resolveSkill("official-biography-evidence")` (throw `InvestigationRuntimeError` on failure).
4. Build `validator`, `sink`, `eventSink`, `registry = createAgentToolRegistry({ submitInvestigationTool })`, `gateway = new ToolGateway(registry, eventSink)`.
5. `ModelPolicy.resolve("INVESTIGATOR")` → `MODEL_NOT_CONFIGURED` if none; `PiModelResolver.resolveConfiguredModel` → `MODEL_NOT_FOUND` if none.
6. `AgentSessionFactory.createAgentSession("INVESTIGATOR", { taskRunId: "investigate-<packetId>-<ts>" })`; not READY → `MODEL_NOT_CONFIGURED`.
7. `packetStore.updateState(packetId, "INVESTIGATING", { investigatorSessionId: agentSessionId })` — claim the packet only after the session is ready.
8. `buildInvestigationRolePrompt(packet, { regionCode, agentSessionId })`; `session.prompt(...)` with abortSignal handling (mirror InventoryAgentRunner).
9. If `!sink.isFrozen()` → `updateState(packetId, "FAILED", { failureCode: "INVESTIGATION_NOT_SUBMITTED" })`; return FAILED.
10. Observation Gate from `eventSink.successes`: `fetchOrRenderSucceeded = any(fetch_page|render_page)`, `inspectSucceeded = any(inspect_page)`, `passed = both`. If not passed → `updateState(packetId, "FAILED", { failureCode: "INVESTIGATION_OBSERVATION_REQUIRED" })`; return FAILED.
11. `sink.getSubmission()`; `updateState(packetId, "READY_FOR_REVIEW")`; return COMPLETED (with leadership/selectedOfficials + receipt + gate).

**Role prompt (`buildInvestigationRolePrompt`)** — short, never copies SKILL.md:
- You are the INVESTIGATOR Agent; you handle ONLY the one institution in the current Work Packet.
- Packet: packet_id, institution name, regionCode.
- Follow the loaded `official-biography-evidence` workflow: `get_region_context` → `search_web` locate official site / current-leader section → `fetch_page`/`render_page` open → `inspect_page` structured observation (never decide from a search snippet alone).
- **Leadership completeness first**: build the full Leadership Structure (`all_visible_leaders`, `official_order`, `party_head`/`administrative_head`, `structure_complete: true`) before selecting anyone.
- Then per Skill select PRIMARY_1 and PRIMARY_2 (two distinct natural persons) as Person Decision artifacts.
- Submit only via `submit_investigation` with `leadership` + `selectedOfficials` (exactly two, one PRIMARY_1 and one PRIMARY_2). Person decisions must reference the leadership `structure_id`. Use `<agentSessionId>` for `investigator_agent_id`/`investigator_context_id`.
- Forbidden: read/bash/edit/write, free-text submission, search-snippet-only conclusions.

**Smoke (`investigation-smoke.ts`) — one real packet:**
- Args: `--region-code` (required), `--institution` (required, a real core institution for the smoke region), `--budget-ms` (optional).
- Flow: (1) run the real TARGETED Inventory via `InventoryAgentRunner` to produce a **frozen** inventory; (2) `InMemoryInstitutionWorkPacketStore.createFromFrozenInventory({ inventory })` → packets; (3) select the packet matching `--institution` (fall back to first INCLUDE); (4) run `InvestigatorAgentRunner` on that single packet; (5) build the report from the runner result + the smoke's own `eventSink` (`bocha_called` = a `search_web` SUCCESS whose `data.provider === "bocha"`).
- `investigationSmokePassed(report)` gate: `packet_created`, `packet_initial_state == "PENDING"`, `investigator_session_created`, `skill_loaded`, `role == "INVESTIGATOR"`, `get_region_context_called`, `search_web_called`, `bocha_called`, `fetch_page_called | render_page_called`, `inspect_page_called`, `submit_investigation_called`, `leadership_schema_valid`, `selected_officials_schema_valid`, `primary_1_present`, `primary_2_present`, `primary_people_distinct`, `submission_frozen`, `packet_final_state == "READY_FOR_REVIEW"`, `agent_completed`.
- Runner tests (fake Pi session, mirroring inventory runner tests):
  1. no submit → `FAILED` / `INVESTIGATION_NOT_SUBMITTED`, packet `FAILED` + failureCode.
  2. submit without any fetch/render/inspect success → `FAILED` / `INVESTIGATION_OBSERVATION_REQUIRED`.
  3. valid submit + fetch/render success + inspect success → `COMPLETED`, packet `READY_FOR_REVIEW`.
  4. packet already INVESTIGATING/READY_FOR_REVIEW → `PACKET_ALREADY_STARTED`.
- Smoke test: arg parsing + `investigationSmokePassed` gate (no network).

- [ ] **Step 1:** Write `investigation-types.ts`, `investigation-role-prompt.ts`, `investigation-submission-sink.ts` (if not already in Task 3), `investigator-agent-runner.ts`.
- [ ] **Step 2:** Write `investigator-agent-runner.test.ts` (fake session; sink + eventSink injected; push success events into `eventSink.successes` directly).
- [ ] **Step 3:** Write `investigation-smoke.ts` + `investigation-smoke.test.ts`; add package scripts.
- [ ] **Step 4:** Run targeted tests + typechecks (Task 5 order) and then the real smoke with the temporary secrets (below).

## Task 5: Targeted verification, docs, secret cleanup, self-review and commit

**Files:**
- Create: `docs/agent-runtime/institution-work-packet-investigator-foundation.md`

- [ ] **Step 1: Local targeted tests (no network)**
```bash
corepack pnpm --filter @stellaris/agent-tools build
corepack pnpm --filter @stellaris/agent-tools exec vitest run src/tools/investigation
corepack pnpm --filter @stellaris/agent-runtime exec vitest run src/work-packet src/investigation src/session/role-tool-policy.test.ts src/smoke/investigation-smoke.test.ts
```
Expected: all pass.

- [ ] **Step 2: Typecheck**
```bash
corepack pnpm --filter @stellaris/agent-tools typecheck
corepack pnpm --filter @stellaris/agent-runtime typecheck
```
Expected: no errors.

- [ ] **Step 3: Create temporary secrets (never printed)**
```bash
umask 077
cat > /root/.stellaris-investigator-smoke-secrets <<'EOF'
export DEEPSEEK_API_KEY=<user-authorized DeepSeek key>
export BOCHA_API_KEY=<user-authorized Bocha key>
export AGENT_MODEL_PROVIDER=deepseek
export AGENT_MODEL_ID=deepseek-v4-pro
export WEB_SEARCH_PROVIDER=bocha
EOF
chmod 600 /root/.stellaris-investigator-smoke-secrets
test -s /root/.stellaris-investigator-smoke-secrets && echo INVESTIGATOR_SMOKE_SECRETS_READY
```
Expected: `INVESTIGATOR_SMOKE_SECRETS_READY`.

- [ ] **Step 4: Real one-packet Investigator smoke**
```bash
source /root/.stellaris-investigator-smoke-secrets
corepack pnpm agent:smoke:investigation --region-code 320106 --institution <real core institution> --budget-ms 420000
```
Expected: `INVESTIGATION_SMOKE`, `status: OK`, `packet_created: YES`, `packet_initial_state: PENDING`, `investigator_session_created: YES`, `skill_loaded: YES`, `role: INVESTIGATOR`, `search_web_called: YES`, `bocha_called: YES`, `fetch_page_called`/`render_page_called: YES`, `inspect_page_called: YES`, `submit_investigation_called: YES`, `leadership_schema_valid: YES`, `selected_officials_schema_valid: YES`, `primary_1_present: YES`, `primary_2_present: YES`, `primary_people_distinct: YES`, `submission_frozen: YES`, `packet_final_state: READY_FOR_REVIEW`, `agent_completed: YES`.
- Failure gates: if the chosen institution's site fails externally (WAF/timeout/403), retry once with another same-level, clear-leadership public institution (never a region adapter). If the Agent submits without inspecting, the Observation Gate must reject; then fix the role prompt / tool feedback and re-run. If the Agent cannot select PRIMARY, check leadership completeness / skill load / inspection observations first — never call the legacy `selectTwoPrimary`, never auto-pick people in TypeScript.

- [ ] **Step 5: Remove temporary secrets**
```bash
rm -f /root/.stellaris-investigator-smoke-secrets
test ! -e /root/.stellaris-investigator-smoke-secrets && echo INVESTIGATOR_TEMP_SECRETS_REMOVED
unset DEEPSEEK_API_KEY BOCHA_API_KEY AGENT_MODEL_PROVIDER AGENT_MODEL_ID WEB_SEARCH_PROVIDER
```
Expected: `INVESTIGATOR_TEMP_SECRETS_REMOVED`.

- [ ] **Step 6: Secret scan** — scan only the repo's tracked/modified files for the two `sk-` values and env names; confirm neither key is in git/source/docs. Do not scan the whole server. Final Report never repeats the keys.

- [ ] **Step 7: Docs** — `docs/agent-runtime/institution-work-packet-investigator-foundation.md`: Purpose; Frozen Inventory → Work Packet; packet state machine; Investigator role; tool policy; leadership-before-PRIMARY boundary; `submit_investigation`; Skill schema validation; Observation Gate; in-memory freeze; `READY_FOR_REVIEW` meaning. Deferred: Position URL Candidate, Persistent Evidence, Recovery, Reviewer, PostgreSQL, Graphile.

- [ ] **Step 8: Commit** (single commit; no push, no merge)
```bash
git add -A
git status --short
git commit -m "feat(agent): add investigator work packet foundation"
```
Expected: worktree clean after commit.

## Self-Review (writing-plans + user gates)

- `InstitutionWorkPacket` is a Runtime scheduling object only; it does **not** re-copy Skill business semantics (source routes, expected leader sections, Skill `status` enum stay in the Skill's own schema).
- Packets come **only** from a Frozen Inventory; INCLUDE/EXCLUDE are honored mechanically, never re-judged by the packet builder.
- Investigator handles **exactly one** packet/institution per session; role `INVESTIGATOR`; Skill `official-biography-evidence` loaded via ResourceLoader.
- No TypeScript copy of Leadership / PRIMARY ranking rules; PRIMARY is Skill → Pi. TypeScript only adds the deterministic distinct-person gate.
- No hardcoded DeepSeek / Bocha; model + search provider come from runtime env; tools go through `ToolGateway`; agent-tools stays Pi-agnostic.
- No region-specific code; smoke region/institution are CLI args only.
- `read`/`bash`/`edit`/`write` remain disabled; `submit_inventory` not granted to INVESTIGATOR.
- No Reviewer, no Recovery, no PostgreSQL, no Graphile, no Skill change, no full-workspace tests.

SELF_REVIEW: PASS
ARCHITECTURE_CONFLICT: NONE
EXECUTION_PREAUTHORIZED_BY_USER: YES
EXECUTION_MODE: INLINE_FAST
TEST_POLICY: TARGETED_ONLY
