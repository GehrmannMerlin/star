# Investigator Evidence and Position URL Candidate Implementation Plan

> **For agentic workers:** Execution mode is INLINE_FAST (pre-authorized by the user). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the Position Evidence phase to the agent runtime: after a frozen STEP 9 Investigation, a fresh INVESTIGATOR Evidence session gathers a **Position URL Candidate Pool** for the frozen PRIMARY_1 / PRIMARY_2, submits it through a Skill-schema-validated `submit_investigator_evidence` boundary, passes a per-candidate provenance gate (fetch/render + inspect), and moves the packet `EVIDENCE_PENDING → EVIDENCE_GATHERING → READY_FOR_REVIEW`.

**Architecture:** The runtime envelope stays thin: `InvestigatorEvidenceSubmissionPayload { candidates: UrlCandidatePoolRow[]; claims?: TargetClaimRow[] }`. Each artifact validates against the pinned Skill's `url-candidate-pool.schema.json` / `target-claim.schema.json` through `SkillSchemaRegistry`. `AgentRole` stays `INVESTIGATOR` (no new role); the Evidence runner builds a fresh Pi session and overrides the tool allowlist so `submit_investigator_evidence` replaces `submit_investigation`. No final URL selection, no ranking, no Reviewer, no Recovery, no persistence in this phase.

**Tech Stack:** TypeScript, `@earendil-works/pi-coding-agent` (Pi sessions), `Ajv2020` (Skill schema validation), `@sinclair/typebox` (tool input), vitest (targeted tests), tsx (smoke).

**Spec:** The user's STEP 10 brief (sections 0–103) + `third-party/china-official-url-evidence-suite/skills/official-biography-evidence/SKILL.md` (official-biography-evidence 3.1.0). Plan argues from the Skill's unique fact chain: `leadership_structure.json → person_decisions.jsonl → url_candidate_pool.jsonl`.

## Global Constraints

- **Canonical schemas (verbatim from Skill):** candidates validate against `url-candidate-pool.schema.json` (title "URL Candidate Pool Row"); claims against `target-claim.schema.json` (title "Target-level Evidence Claim"). The pool schema has **no** EMPTY/EXHAUSTED enum — "no admissible candidate" is expressed by absence of an `ACCEPTED_AS_FINAL` row, never by a synthetic enum.
- **Search snippets are never Evidence.** Every candidate URL must be really opened (`fetch_page` or `render_page` SUCCESS) and really inspected (`inspect_page` SUCCESS) in the SAME Evidence session; the runtime gate verifies this per-URL, not by the Agent's claim.
- **No FinalDecision / ranking in TypeScript.** Candidate `source_domain_class`, `page_shape_class`, `candidate_status`, and the accept/reject reason are Skill → Pi semantics. TypeScript validates, joins, gates, and freezes only.
- **PRIMARY_1 / PRIMARY_2 come from the frozen STEP 9 person decisions.** The Evidence session never re-derives them. Candidate `target_id` must join to one of the two frozen `target_id` values (deterministic gate).
- **`AgentRole.INVESTIGATOR` only.** No `EVIDENCE_AGENT` / `POSITION_AGENT`. No `submit_inventory` / `submit_investigation` / `read` / `bash` / `edit` / `write` in an Evidence session.
- **Skill 3.1.0 is unchanged.** Any schema/runtime mismatch is handled in the runtime envelope.
- **One submission per packet** (`INVESTIGATOR_EVIDENCE_ALREADY_SUBMITTED`), freeze on first accept.
- **No PostgreSQL, no Graphile, no Recovery, no Reviewer** in this phase.
- **Secrets never enter git / source / docs / logs / report.** Keys are loaded from `/root/.stellaris-evidence-smoke-secrets` (mode 600) at smoke time and removed after.
- **Fresh Evidence session per run** — never reuse a STEP 9 conversation.

---

### Task 1: Inspect STEP 9 contracts and Skill evidence/candidate schemas

**Files:**
- Read (no writes): `third-party/china-official-url-evidence-suite/skills/official-biography-evidence/SKILL.md`, `references/execution-contract.md`, `schemas/url-candidate-pool.schema.json`, `schemas/url-candidate-decision.schema.json`, `schemas/target-claim.schema.json`, `schemas/tool-event.schema.json`, `schemas/leadership-structure.schema.json`, `schemas/person-decision.schema.json`
- Read: `packages/agent-runtime/src/work-packet/institution-work-packet.ts`, `packages/agent-runtime/src/investigation/*`, `packages/agent-tools/src/tools/investigation/*`, `packages/agent-tools/src/telemetry/tool-event-sink.ts`, `packages/agent-runtime/src/session/session-factory.ts`, `packages/agent-runtime/src/session/role-tool-policy.ts`, `packages/agent-runtime/src/skill/skill-schema-registry.ts`, `packages/agent-runtime/src/smoke/investigation-smoke.ts`

**Findings (locked for later tasks):**
- Canonical candidate artifact = `url-candidate-pool.schema.json` (`candidate_id, target_id, evidence_id, url, source_domain_class, page_shape_class, supports_person, supports_institution, supports_role, supports_currentness, candidate_status, accept_or_reject_reason, superseded_by_candidate_id`). Candidate→PRIMARY join is via `target_id`.
- Canonical claim artifact = `target-claim.schema.json` (`claim_id, evidence_id, person_id, institution_id, target_id, role_supported, currentness_supported`).
- Packet states today: `PENDING → INVESTIGATING → READY_FOR_REVIEW`; the Investigator runner transitions to `READY_FOR_REVIEW` on success.
- Tool shape: opaque Skill artifacts in a thin envelope; validator = `SkillSchemaRegistry` + Ajv2020; sink = in-memory one-freeze.
- URL join inputs available from tool `data`: `fetch_page`/`render_page` → `{ requestedUrl, finalUrl }`; `inspect_page` → `{ url }`.

- [ ] **Step 1: Record the findings above in the plan header** (done — no code).

**Interfaces:**
- Produces: the exact canonical schema filenames/titles and the STEP 9 wiring pattern that Task 2 and Task 3 mirror.

---

### Task 2: Refine packet evidence states + evidence submission/provenance boundary

**Files:**
- Modify: `packages/agent-runtime/src/work-packet/institution-work-packet.ts`
- Modify: `packages/agent-runtime/src/work-packet/institution-work-packet.test.ts`
- Modify: `packages/agent-runtime/src/investigation/investigator-agent-runner.ts`
- Modify: `packages/agent-runtime/src/investigation/investigator-agent-runner.test.ts`
- Modify: `packages/agent-runtime/src/smoke/investigation-smoke.ts`
- Modify: `packages/agent-runtime/src/smoke/investigation-smoke.test.ts`
- Modify: `packages/agent-tools/src/contracts/tool-failure-codes.ts`
- Create: `packages/agent-tools/src/tools/evidence/investigator-evidence-submission.ts`
- Create: `packages/agent-tools/src/tools/evidence/submit-investigator-evidence.ts`
- Create: `packages/agent-tools/src/tools/evidence/submit-investigator-evidence.test.ts`
- Modify: `packages/agent-tools/src/registry/default-tool-registry.ts`
- Modify: `packages/agent-tools/src/index.ts`

**Interfaces:**
- Consumes: Task 1 findings (canonical schema titles + STEP 9 tool pattern).
- Produces (used by Task 3): `InvestigatorEvidenceSubmissionPayload`, `InvestigatorEvidenceSubmissionValidator`, `InvestigatorEvidenceSubmissionSink`, `InvestigatorEvidenceSubmitResult`, `SubmitInvestigatorEvidenceSuccess`, `EvidencePrimaryDecision`, `normalizeUrlForJoin`, `createSubmitInvestigatorEvidenceTool`, new `ToolFailureCode` entries.

- [ ] **Step 1: Add the two evidence states to the packet state machine**

```ts
export const PACKET_STATES = [
  "PENDING",
  "INVESTIGATING",
  "EVIDENCE_PENDING",
  "EVIDENCE_GATHERING",
  "READY_FOR_REVIEW",
  "FAILED",
  "CANCELLED",
] as const;
```

```ts
const ALLOWED_TRANSITIONS: Record<InstitutionWorkPacketState, readonly InstitutionWorkPacketState[]> = {
  PENDING: ["INVESTIGATING", "CANCELLED"],
  INVESTIGATING: ["EVIDENCE_PENDING", "FAILED", "CANCELLED"],
  EVIDENCE_PENDING: ["EVIDENCE_GATHERING", "FAILED", "CANCELLED"],
  EVIDENCE_GATHERING: ["READY_FOR_REVIEW", "FAILED", "CANCELLED"],
  READY_FOR_REVIEW: [],
  FAILED: [],
  CANCELLED: [],
};
```

- [ ] **Step 2: Point the Investigator runner success at EVIDENCE_PENDING**

In `packages/agent-runtime/src/investigation/investigator-agent-runner.ts` change:

```ts
const completedPacket = this.deps.packetStore.updateState(request.packetId, "EVIDENCE_PENDING");
```

(the only other behavioral change; comment above it: `// Investigator phase done; Evidence phase still follows — READY_FOR_REVIEW only after Evidence.`)

- [ ] **Step 3: Add the evidence tool failure codes**

In `packages/agent-tools/src/contracts/tool-failure-codes.ts` add to `ToolFailureCode`:

```ts
  INVESTIGATOR_EVIDENCE_ALREADY_SUBMITTED: "INVESTIGATOR_EVIDENCE_ALREADY_SUBMITTED",
  POSITION_CANDIDATE_UNKNOWN_PRIMARY: "POSITION_CANDIDATE_UNKNOWN_PRIMARY",
  POSITION_CANDIDATE_COVERAGE_REQUIRED: "POSITION_CANDIDATE_COVERAGE_REQUIRED",
```

- [ ] **Step 4: Create the evidence submission contracts**

`packages/agent-tools/src/tools/evidence/investigator-evidence-submission.ts`:

```ts
import type { SubmissionValidation } from "../inventory/inventory-submission.js";

/**
 * Provider-neutral Investigator Evidence submission contracts.
 *
 * `candidates` and `claims` are canonical Skill artifacts
 * (url-candidate-pool.schema.json / target-claim.schema.json) carried in a
 * light runtime envelope. The envelope is transport only — it does not
 * duplicate Skill fields. Canonical validation happens server-side against the
 * pinned Skill schemas (SkillSchemaRegistry).
 */

export type UrlCandidatePoolRow = Record<string, unknown>;
export type TargetClaimRow = Record<string, unknown>;

export type InvestigatorEvidenceSubmissionPayload = {
  /** URL Candidate Pool rows (url-candidate-pool.schema.json), PRIMARY_1+PRIMARY_2 targets. */
  candidates: UrlCandidatePoolRow[];
  /** Optional target-level evidence claims (target-claim.schema.json). */
  claims?: TargetClaimRow[];
};

export interface InvestigatorEvidenceSubmissionValidator {
  validate(payload: InvestigatorEvidenceSubmissionPayload): SubmissionValidation;
}

export type InvestigatorEvidenceSubmitResult =
  | { status: "ACCEPTED"; payloadHash: string }
  | { status: "ALREADY_SUBMITTED"; payloadHash: string };

export interface InvestigatorEvidenceSubmissionSink {
  submit(
    payload: InvestigatorEvidenceSubmissionPayload,
  ): Promise<InvestigatorEvidenceSubmitResult>;
  getSubmission(): Promise<InvestigatorEvidenceSubmissionPayload | null>;
  isFrozen(): Promise<boolean>;
}

export type SubmitInvestigatorEvidenceSuccess = {
  status: "ACCEPTED";
  frozen: true;
  candidatesValidated: true;
  claimsValidated: boolean;
  candidateCount: number;
  primary1TargetId: string | null;
  primary2TargetId: string | null;
  primary1CandidateCount: number;
  primary2CandidateCount: number;
  payloadHash: string;
};

/** Frozen PRIMARY join input, derived by the Evidence runner from the frozen
 *  person-decisions (never re-derived by the Agent or the tool). */
export type EvidencePrimaryDecision = {
  targetId: string;
  personId: string | null;
  personName: string | null;
  primarySlot: "PRIMARY_1" | "PRIMARY_2";
};

/**
 * Canonical URL normalization for the provenance join (requestedUrl / finalUrl
 * aware). Deliberately NOT a URL identity engine: lowercases scheme+host, drops
 * default ports, drops the fragment, and strips a trailing slash.
 */
export function normalizeUrlForJoin(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    if (parsed.port === "80" || parsed.port === "443") parsed.port = "";
    parsed.protocol = parsed.protocol.toLowerCase();
    parsed.hostname = parsed.hostname.toLowerCase();
    let pathname = parsed.pathname;
    while (pathname.length > 1 && pathname.endsWith("/")) pathname = pathname.slice(0, -1);
    parsed.pathname = pathname;
    return parsed.toString();
  } catch {
    return url.trim();
  }
}
```

- [ ] **Step 5: Create the submit_investigator_evidence tool**

`packages/agent-tools/src/tools/evidence/submit-investigator-evidence.ts`:

```ts
import { Type, type Static } from "@sinclair/typebox";
import { ToolFailureCode, ToolFailureError } from "../../contracts/tool-failure-codes.js";
import type { AgentToolDefinition } from "../../contracts/tool-types.js";
import type {
  EvidencePrimaryDecision,
  InvestigatorEvidenceSubmissionPayload,
  InvestigatorEvidenceSubmissionSink,
  InvestigatorEvidenceSubmissionValidator,
  SubmitInvestigatorEvidenceSuccess,
} from "./investigator-evidence-submission.js";

const candidateArtifact = Type.Object({}, { additionalProperties: true });
const claimArtifact = Type.Object({}, { additionalProperties: true });

export const SubmitInvestigatorEvidenceInput = Type.Object(
  {
    candidates: Type.Array(candidateArtifact, { minItems: 1 }),
    claims: Type.Optional(Type.Array(claimArtifact)),
  },
  { additionalProperties: false },
);

export type SubmitInvestigatorEvidenceInput = Static<typeof SubmitInvestigatorEvidenceInput>;

export type SubmitInvestigatorEvidenceToolDeps = {
  validator: InvestigatorEvidenceSubmissionValidator;
  sink: InvestigatorEvidenceSubmissionSink;
  /** Frozen PRIMARY person decisions (deterministic target join). */
  primaryDecisions: EvidencePrimaryDecision[];
};

/**
 * Evidence output boundary tool.
 *
 * Pi knows only `submit_investigator_evidence`. The tool validates the
 * canonical url-candidate-pool / target-claim schemas, enforces the
 * deterministic PRIMARY join (every candidate/claim target must belong to a
 * frozen PRIMARY), requires both PRIMARYs to be covered, and accepts exactly
 * one submission per packet. No final-URL selection is performed here.
 */
export function createSubmitInvestigatorEvidenceTool(
  deps: SubmitInvestigatorEvidenceToolDeps,
): AgentToolDefinition<typeof SubmitInvestigatorEvidenceInput, SubmitInvestigatorEvidenceSuccess> {
  return {
    name: "submit_investigator_evidence",
    description:
      "Submit the Position URL Candidate Pool for the frozen PRIMARY_1/PRIMARY_2 of the current institution. The payload must follow the official-biography-evidence url-candidate-pool and target-claim schemas; every candidate target must belong to a frozen PRIMARY and both PRIMARYs must be covered. Exactly one submission is accepted per packet.",
    inputSchema: SubmitInvestigatorEvidenceInput,
    async execute(_context, input) {
      const payload: InvestigatorEvidenceSubmissionPayload = {
        candidates: input.candidates as Record<string, unknown>[],
        ...(input.claims ? { claims: input.claims as Record<string, unknown>[] } : {}),
      };
      const validation = deps.validator.validate(payload);
      if (!validation.valid) {
        throw new ToolFailureError({
          code: ToolFailureCode.SCHEMA_VALIDATION_FAILED,
          message: `submit_investigator_evidence failed Skill schema validation: ${validation.errors.join("; ")}`,
          retryable: false,
        });
      }

      const primary1 = deps.primaryDecisions.find((d) => d.primarySlot === "PRIMARY_1");
      const primary2 = deps.primaryDecisions.find((d) => d.primarySlot === "PRIMARY_2");
      if (!primary1 || !primary2) {
        throw new ToolFailureError({
          code: ToolFailureCode.INVALID_INPUT,
          message: "submit_investigator_evidence requires both frozen PRIMARY decisions",
          retryable: false,
        });
      }

      // Deterministic PRIMARY join: every candidate target must be a frozen PRIMARY.
      for (const candidate of payload.candidates) {
        const targetId = typeof candidate.target_id === "string" ? candidate.target_id : "";
        if (targetId !== primary1.targetId && targetId !== primary2.targetId) {
          throw new ToolFailureError({
            code: ToolFailureCode.POSITION_CANDIDATE_UNKNOWN_PRIMARY,
            message: `candidate target_id ${targetId} does not belong to a frozen PRIMARY`,
            retryable: false,
          });
        }
      }
      // Claims join on target AND (when the frozen person is known) person.
      for (const claim of payload.claims ?? []) {
        const targetId = typeof claim.target_id === "string" ? claim.target_id : "";
        const personId = typeof claim.person_id === "string" ? claim.person_id : null;
        const decision = [primary1, primary2].find((d) => d.targetId === targetId);
        if (!decision) {
          throw new ToolFailureError({
            code: ToolFailureCode.POSITION_CANDIDATE_UNKNOWN_PRIMARY,
            message: `claim target_id ${targetId} does not belong to a frozen PRIMARY`,
            retryable: false,
          });
        }
        if (decision.personId !== null && personId !== decision.personId) {
          throw new ToolFailureError({
            code: ToolFailureCode.POSITION_CANDIDATE_UNKNOWN_PRIMARY,
            message: `claim person_id ${personId} does not match frozen PRIMARY ${decision.primarySlot}`,
            retryable: false,
          });
        }
      }

      // Coverage: both PRIMARYs must be covered by at least one candidate.
      const primary1CandidateCount = payload.candidates.filter(
        (candidate) => candidate.target_id === primary1.targetId,
      ).length;
      const primary2CandidateCount = payload.candidates.filter(
        (candidate) => candidate.target_id === primary2.targetId,
      ).length;
      if (primary1CandidateCount < 1 || primary2CandidateCount < 1) {
        throw new ToolFailureError({
          code: ToolFailureCode.POSITION_CANDIDATE_COVERAGE_REQUIRED,
          message: `PRIMARY_1 candidates=${primary1CandidateCount}, PRIMARY_2 candidates=${primary2CandidateCount}; both PRIMARYs must be covered`,
          retryable: false,
        });
      }

      const result = await deps.sink.submit(payload);
      if (result.status === "ALREADY_SUBMITTED") {
        throw new ToolFailureError({
          code: ToolFailureCode.INVESTIGATOR_EVIDENCE_ALREADY_SUBMITTED,
          message: "Investigator evidence already submitted and frozen for this packet",
          retryable: false,
        });
      }

      return {
        status: "ACCEPTED",
        frozen: true,
        candidatesValidated: true,
        claimsValidated: payload.claims !== undefined,
        candidateCount: payload.candidates.length,
        primary1TargetId: primary1.targetId,
        primary2TargetId: primary2.targetId,
        primary1CandidateCount,
        primary2CandidateCount,
        payloadHash: result.payloadHash,
      };
    },
  };
}
```

- [ ] **Step 6: Register the tool + export**

In `packages/agent-tools/src/registry/default-tool-registry.ts` add to `CreateAgentToolRegistryOptions` and body:

```ts
  /** Adds the submit_investigator_evidence tool (Investigator Evidence phase; wired by the runner). */
  submitInvestigatorEvidenceTool?: AgentToolDefinition;
```

```ts
  if (options.submitInvestigatorEvidenceTool) {
    tools.push(options.submitInvestigatorEvidenceTool);
  }
```

In `packages/agent-tools/src/index.ts` add:

```ts
export * from "./tools/evidence/investigator-evidence-submission.js";
export * from "./tools/evidence/submit-investigator-evidence.js";
```

- [ ] **Step 7: Write the evidence tool tests**

`packages/agent-tools/src/tools/evidence/submit-investigator-evidence.test.ts` — five cases against a stub validator + in-memory sink:

1. valid canonical submission (two candidates, one per PRIMARY target, matching frozen target_ids) → `ACCEPTED`, `candidateCount === 2`, `primary1CandidateCount === 1`, `primary2CandidateCount === 1`.
2. invalid schema (stub validator returns `{ valid: false, errors: ["candidates[0]: missing required property 'url'"] }`) → `ToolFailureError` code `SCHEMA_VALIDATION_FAILED`.
3. second submission (after a first accepted) → `ToolFailureError` code `INVESTIGATOR_EVIDENCE_ALREADY_SUBMITTED`.
4. candidate with an unknown third target_id → `ToolFailureError` code `POSITION_CANDIDATE_UNKNOWN_PRIMARY`.
5. candidates only for PRIMARY_1 → `ToolFailureError` code `POSITION_CANDIDATE_COVERAGE_REQUIRED`.

```ts
// shared helpers (mirror the investigation tool test style)
const PRIMARY_1_TARGET = "glq-target-primary1";
const PRIMARY_2_TARGET = "glq-target-primary2";
const PRIMARY_DECISIONS = [
  { targetId: PRIMARY_1_TARGET, personId: "person-wang", personName: "王安伟", primarySlot: "PRIMARY_1" },
  { targetId: PRIMARY_2_TARGET, personId: "person-dong", personName: "董涵", primarySlot: "PRIMARY_2" },
] as const;
const stubValidator = { validate: () => ({ valid: true }) };
const candidate = (targetId: string, url: string) => ({
  candidate_id: `cand-${targetId}`,
  target_id: targetId,
  evidence_id: `evt-${targetId}-1`,
  url,
  source_domain_class: "OFFICIAL_GOV_DOMAIN",
  page_shape_class: "OFFICIAL_PERSON_PROFILE",
  supports_person: true,
  supports_institution: true,
  supports_role: true,
  supports_currentness: true,
  candidate_status: "ACCEPTED_AS_FINAL",
  accept_or_reject_reason: "official person profile for the frozen PRIMARY",
  superseded_by_candidate_id: null,
});
class Sink implements InvestigatorEvidenceSubmissionSink {
  private stored: InvestigatorEvidenceSubmissionPayload | null = null;
  async submit(payload: InvestigatorEvidenceSubmissionPayload) {
    if (this.stored) return { status: "ALREADY_SUBMITTED", payloadHash: "h" };
    this.stored = payload;
    return { status: "ACCEPTED", payloadHash: "h" };
  }
  async getSubmission() { return this.stored; }
  async isFrozen() { return this.stored !== null; }
}
```

- [ ] **Step 8: Update the packet-state and STEP 9 tests for the new semantics**

`packages/agent-runtime/src/work-packet/institution-work-packet.test.ts`:
- Rename/repurpose the `PENDING -> INVESTIGATING -> READY_FOR_REVIEW` test to `PENDING -> INVESTIGATING -> EVIDENCE_PENDING -> EVIDENCE_GATHERING -> READY_FOR_REVIEW` (assert each state and that `updatedAt` stamps).
- Add: `INVESTIGATING` cannot jump directly to `READY_FOR_REVIEW` (`expect(() => store.updateState(id, "READY_FOR_REVIEW")).toThrow(PacketStateError)`).
- The duplicate-start and FAILED tests still pass unchanged.

`packages/agent-runtime/src/investigation/investigator-agent-runner.test.ts`:
- In "returns a frozen COMPLETED result", change `expect(result.packet.state).toBe("READY_FOR_REVIEW")` → `toBe("EVIDENCE_PENDING")` and rename the `it(...)` title to "...and EVIDENCE_PENDING after a valid inspected submission".
- Other cases (NOT_SUBMITTED / OBSERVATION_REQUIRED / duplicate start / not found) unchanged.

`packages/agent-runtime/src/smoke/investigation-smoke.ts`:
- In `investigationSmokePassed`, change `report.packet_final_state === "READY_FOR_REVIEW"` → `report.packet_final_state === "EVIDENCE_PENDING"` (the COMPLETED branch of `buildInvestigationReport` already reads `result.packet.state`).

`packages/agent-runtime/src/smoke/investigation-smoke.test.ts`:
- In the `investigationSmokePassed` happy-path object, set `packet_final_state: "EVIDENCE_PENDING"`; keep the `packet_final_state: "FAILED"` negative case.

- [ ] **Step 9: Run targeted verification**

```bash
cd /opt/Stellaris-PiAgent-Dev
corepack pnpm --filter @stellaris/agent-tools test -- tools/evidence packages/agent-tools/src/tools/evidence
corepack pnpm --filter @stellaris/agent-runtime test -- src/work-packet src/investigation src/smoke
```

Expected: the new tool tests pass; work-packet + investigator runner + investigation-smoke tests pass with the updated state expectations.

- [ ] **Step 10: Build agent-tools (exports changed; agent-runtime imports it from dist)**

```bash
corepack pnpm --filter @stellaris/agent-tools build
```

- [ ] **Step 11: Commit**

```bash
git add packages/agent-tools packages/agent-runtime/src/work-packet packages/agent-runtime/src/investigation packages/agent-runtime/src/smoke
git commit -m "feat(agent): add investigator evidence submission boundary and packet evidence states"
```

---

### Task 3: Implement InvestigatorEvidenceRunner + fresh-session tool policy

**Files:**
- Modify: `packages/agent-runtime/src/session/role-tool-policy.ts`
- Modify: `packages/agent-runtime/src/session/session-factory.ts`
- Create: `packages/agent-runtime/src/evidence/evidence-types.ts`
- Create: `packages/agent-runtime/src/evidence/evidence-role-prompt.ts`
- Create: `packages/agent-runtime/src/evidence/skill-evidence-validator.ts`
- Create: `packages/agent-runtime/src/evidence/investigator-evidence-submission-sink.ts`
- Create: `packages/agent-runtime/src/evidence/evidence-provenance.ts`
- Create: `packages/agent-runtime/src/evidence/investigator-evidence-runner.ts`
- Modify: `packages/agent-runtime/src/index.ts`

**Interfaces:**
- Consumes: Task 2 contracts (`InvestigatorEvidenceSubmissionValidator/Sink`, `EvidencePrimaryDecision`, `createSubmitInvestigatorEvidenceTool`).
- Produces (used by Task 4): `InvestigatorEvidenceRequest`, `InvestigatorEvidenceResult`, `InvestigatorEvidenceRunner`, `buildEvidenceRolePrompt`, `createSkillEvidenceValidator`, `evaluateEvidenceProvenance`, `InMemoryInvestigatorEvidenceSubmissionSink`, `INVESTIGATOR_EVIDENCE_ROLE_TOOLS`.

- [ ] **Step 1: Add the Evidence tool allowlist (same INVESTIGATOR role, phase-scoped)**

In `packages/agent-runtime/src/session/role-tool-policy.ts`:

```ts
/** Tools the Investigator Agent may call during the Position Evidence phase
 *  (submit_investigator_evidence is the output boundary). Same INVESTIGATOR
 *  role; submit_investigation is intentionally not granted. */
export const INVESTIGATOR_EVIDENCE_ROLE_TOOLS = [
  ...BASE_AGENT_TOOLS,
  "submit_investigator_evidence",
] as const;
```

- [ ] **Step 2: Allow a per-session tool override in AgentSessionFactory**

In `packages/agent-runtime/src/session/session-factory.ts`, change the signature and the allowlist line:

```ts
  async createAgentSession(
    role: AgentRole,
    run: AgentRunRef = { taskRunId: "manual" },
    opts: { tools?: readonly string[] } = {},
  ): Promise<AgentSessionFactoryResult> {
```

```ts
    const allowedToolNames = (opts.tools ?? roleToolsFor(role)).filter((name) => this.registry.has(name));
```

(Backward compatible: existing call sites omit the third argument.)

- [ ] **Step 3: Create the evidence types**

`packages/agent-runtime/src/evidence/evidence-types.ts`:

```ts
import type {
  InvestigatorEvidenceSubmissionPayload,
  TargetClaimRow,
  UrlCandidatePoolRow,
} from "@stellaris/agent-tools";
import type { InstitutionWorkPacket } from "../work-packet/institution-work-packet.js";

export const EVIDENCE_NOT_SUBMITTED = "EVIDENCE_NOT_SUBMITTED" as const;
export const POSITION_CANDIDATE_OBSERVATION_REQUIRED =
  "POSITION_CANDIDATE_OBSERVATION_REQUIRED" as const;

export type EvidenceFailureCode =
  | typeof EVIDENCE_NOT_SUBMITTED
  | typeof POSITION_CANDIDATE_OBSERVATION_REQUIRED;

export type EvidenceToolCallSummary = {
  toolName: string;
  called: boolean;
  succeeded: boolean;
};

export type CandidateProvenance = {
  url: string;
  targetId: string;
  opened: boolean;
  inspected: boolean;
};

export type EvidenceProvenanceGate = {
  candidates: CandidateProvenance[];
  passed: boolean;
};

/** Business request: gather Position URL candidates for a packet whose STEP 9
 *  Investigation is frozen (state EVIDENCE_PENDING). */
export type InvestigatorEvidenceRequest = {
  packetId: string;
  /** Frozen STEP 9 canonical output: leadership + exactly two person decisions. */
  frozenInput: InvestigatorEvidenceSubmissionPayload & {
    leadership: Record<string, unknown>;
    selectedOfficials: Record<string, unknown>[];
  };
};

export type InvestigatorEvidenceFreezeReceipt = {
  frozen: true;
  candidatesValidated: true;
  claimsValidated: boolean;
  primary1TargetId: string | null;
  primary2TargetId: string | null;
  primary1CandidateCount: number;
  primary2CandidateCount: number;
  allCandidatesOpened: boolean;
  allCandidatesInspected: boolean;
  payloadHash: string;
};

export type InvestigatorEvidenceCompletedResult = {
  status: "COMPLETED";
  packetId: string;
  packet: InstitutionWorkPacket;
  candidates: UrlCandidatePoolRow[];
  claims: TargetClaimRow[];
  frozen: true;
  agentSessionId: string;
  skill: { name: string; version: string };
  model: { provider: string; model: string };
  toolCalls: EvidenceToolCallSummary[];
  provenance: EvidenceProvenanceGate;
  receipt: InvestigatorEvidenceFreezeReceipt;
};

export type InvestigatorEvidenceFailedResult = {
  status: "FAILED";
  packetId: string;
  packet: InstitutionWorkPacket;
  failureCode: EvidenceFailureCode;
  agentSessionId: string;
  toolCalls: EvidenceToolCallSummary[];
};

export type InvestigatorEvidenceResult =
  | InvestigatorEvidenceCompletedResult
  | InvestigatorEvidenceFailedResult
  | { status: "INVALID_REQUEST"; reason: string }
  | { status: "PACKET_NOT_FOUND"; packetId: string }
  | { status: "PACKET_NOT_ELIGIBLE"; packetId: string; reason: string }
  | { status: "MODEL_NOT_CONFIGURED" }
  | { status: "MODEL_NOT_FOUND"; provider: string; model: string };

export class InvestigatorEvidenceRuntimeError extends Error {}
```

- [ ] **Step 4: Create the evidence role prompt**

`packages/agent-runtime/src/evidence/evidence-role-prompt.ts`:

```ts
import type { EvidencePrimaryDecision } from "@stellaris/agent-tools";
import type { InstitutionWorkPacket } from "../work-packet/institution-work-packet.js";

/**
 * Short Investigator Evidence role prompt. Leadership / PRIMARY are frozen
 * inputs; this prompt never re-derives them and never copies SKILL.md. The
 * exact candidate classification / status semantics stay in the Skill.
 */
export function buildEvidenceRolePrompt(
  packet: InstitutionWorkPacket,
  opts: {
    regionCode: string;
    agentSessionId: string;
    primary1: EvidencePrimaryDecision;
    primary2: EvidencePrimaryDecision;
    institutionId: string;
  },
): string {
  const lines = [
    "你正在执行 Stellaris 政务简历采集的 Investigator Agent 任务，当前阶段：Position Evidence（当前岗位信息 URL 候选）。",
    "你的角色：INVESTIGATOR。你只处理当前 Work Packet 中的这一个机构。",
    "",
    "当前 Work Packet：",
    `- packet_id：${packet.packetId}`,
    `- 机构：${packet.institutionName}`,
    `- 机构 id：${opts.institutionId}`,
    `- 行政区代码：${opts.regionCode}`,
    "",
    "Leadership Structure 与 PRIMARY_1 / PRIMARY_2 已经冻结，来自已完成的 STEP 9。",
    `- PRIMARY_1：${opts.primary1.personName ?? "(未确认)"}，target_id=${opts.primary1.targetId}`,
    `- PRIMARY_2：${opts.primary2.personName ?? "(未确认)"}，target_id=${opts.primary2.targetId}`,
    "你绝不能重新判断 PRIMARY_1 / PRIMARY_2，也绝不能重新构建 Leadership Structure。",
    "",
    "你的任务：严格遵循已加载的 official-biography-evidence Skill，为上面两位 PRIMARY 各搜索“当前岗位信息 URL”候选。",
    "对每个候选 URL：必须先用 fetch_page 或 render_page 成功打开页面，然后必须紧接着对同一页面调用一次 inspect_page 得到结构化观察。",
    "搜索摘要（search_web snippet）不是证据；只依据搜索摘要就提交的候选会被运行时拒绝。",
    "",
    "最终必须调用 submit_investigator_evidence 提交候选池：",
    "- candidates：url-candidate-pool 行数组（candidate_id、target_id、evidence_id、url、source_domain_class、page_shape_class、supports_person、supports_institution、supports_role、supports_currentness、candidate_status、accept_or_reject_reason、superseded_by_candidate_id）。",
    "  candidates 中每个 target_id 必须是 ${opts.primary1.targetId} 或 ${opts.primary2.targetId}；两位 PRIMARY 都必须至少有 1 个候选。",
    "- claims（可选）：target-claim 行数组（claim_id、evidence_id、person_id、institution_id、target_id、role_supported、currentness_supported）。",
    "",
    "本轮只收集候选池，不选择最终 URL，不生成 final decision。",
    "不要读取文件，不要执行 shell，不要使用聊天文本代替正式提交。",
    `investigator_agent_id / investigator_context_id 使用：${opts.agentSessionId}。`,
  ];
  return lines.join("\n");
}
```

- [ ] **Step 5: Create the Skill-schema evidence validator**

`packages/agent-runtime/src/evidence/skill-evidence-validator.ts` (mirror `skill-investigation-validator.ts`):

```ts
import path from "node:path";
import { Ajv2020 } from "ajv/dist/2020.js";
import type {
  InvestigatorEvidenceSubmissionPayload,
  InvestigatorEvidenceSubmissionValidator,
  SubmissionValidation,
} from "@stellaris/agent-tools";
import type { SkillIdentity } from "../skill/skill-identity.js";
import { SkillSchemaRegistry, type RegisteredSchema } from "../skill/skill-schema-registry.js";
import { InvestigatorEvidenceRuntimeError } from "./evidence-types.js";

export const URL_CANDIDATE_POOL_SCHEMA_TITLE = "URL Candidate Pool Row";
export const TARGET_CLAIM_SCHEMA_TITLE = "Target-level Evidence Claim";

function findSchema(
  registry: SkillSchemaRegistry,
  title: string,
  filenameSuffix: string,
): RegisteredSchema {
  const byTitle = registry.get(title);
  if (byTitle) return byTitle;
  const byPath = registry
    .list()
    .map((name) => registry.get(name))
    .find((schema) => schema?.filePath.endsWith(filenameSuffix));
  if (!byPath) {
    throw new InvestigatorEvidenceRuntimeError(`Schema not found in SkillSchemaRegistry: ${title}`);
  }
  return byPath;
}

/** Build an InvestigatorEvidenceSubmissionValidator over the pinned Skill's
 *  canonical url-candidate-pool and target-claim schemas. Candidate status and
 *  source/page classification are NOT judged here — only schema shape. */
export async function createSkillEvidenceValidator(
  identity: SkillIdentity,
): Promise<InvestigatorEvidenceSubmissionValidator> {
  const registry = await SkillSchemaRegistry.load(path.join(identity.path, "schemas"));
  const poolSchema = findSchema(registry, URL_CANDIDATE_POOL_SCHEMA_TITLE, "url-candidate-pool.schema.json");
  const claimSchema = findSchema(registry, TARGET_CLAIM_SCHEMA_TITLE, "target-claim.schema.json");
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  const validatePool = ajv.compile(poolSchema.schema as never);
  const validateClaim = ajv.compile(claimSchema.schema as never);

  return {
    validate(payload: InvestigatorEvidenceSubmissionPayload): SubmissionValidation {
      const errors: string[] = [];
      payload.candidates.forEach((candidate, index) => {
        if (!validatePool(candidate)) {
          const detail = (validatePool.errors ?? [])
            .map((error) => `${error.instancePath || "#"} ${error.message ?? ""}`.trim())
            .join("; ");
          errors.push(`candidates[${index}]: ${detail}`);
        }
      });
      (payload.claims ?? []).forEach((claim, index) => {
        if (!validateClaim(claim)) {
          const detail = (validateClaim.errors ?? [])
            .map((error) => `${error.instancePath || "#"} ${error.message ?? ""}`.trim())
            .join("; ");
          errors.push(`claims[${index}]: ${detail}`);
        }
      });
      return errors.length > 0 ? { valid: false, errors } : { valid: true };
    },
  };
}
```

- [ ] **Step 6: Create the in-memory evidence sink**

`packages/agent-runtime/src/evidence/investigator-evidence-submission-sink.ts`:

```ts
import { createHash } from "node:crypto";
import type {
  InvestigatorEvidenceSubmissionPayload,
  InvestigatorEvidenceSubmissionSink,
  InvestigatorEvidenceSubmitResult,
} from "@stellaris/agent-tools";

/** Runtime freeze boundary (NOT persistence): exactly one accepted submission. */
export class InMemoryInvestigatorEvidenceSubmissionSink
  implements InvestigatorEvidenceSubmissionSink
{
  private submission: InvestigatorEvidenceSubmissionPayload | null = null;
  private payloadHash = "";

  async submit(
    payload: InvestigatorEvidenceSubmissionPayload,
  ): Promise<InvestigatorEvidenceSubmitResult> {
    if (this.submission) {
      return { status: "ALREADY_SUBMITTED", payloadHash: this.payloadHash };
    }
    this.submission = payload;
    this.payloadHash = createHash("sha256").update(JSON.stringify(payload)).digest("hex");
    return { status: "ACCEPTED", payloadHash: this.payloadHash };
  }

  async getSubmission(): Promise<InvestigatorEvidenceSubmissionPayload | null> {
    return this.submission;
  }

  async isFrozen(): Promise<boolean> {
    return this.submission !== null;
  }
}
```

- [ ] **Step 7: Create the provenance gate**

`packages/agent-runtime/src/evidence/evidence-provenance.ts`:

```ts
import { normalizeUrlForJoin, type UrlCandidatePoolRow } from "@stellaris/agent-tools";
import type { MemoryToolEventSink } from "@stellaris/agent-tools";
import type { CandidateProvenance, EvidenceProvenanceGate } from "./evidence-types.js";

/**
 * Deterministic per-candidate provenance gate. Every candidate URL must be
 * really opened (fetch_page/render_page SUCCESS — requestedUrl OR finalUrl
 * match) and really inspected (inspect_page SUCCESS — url match) within this
 * session. Search snippets never count.
 */
export function evaluateEvidenceProvenance(
  eventSink: MemoryToolEventSink,
  candidates: UrlCandidatePoolRow[],
): EvidenceProvenanceGate {
  const openedUrls = new Set<string>();
  const inspectedUrls = new Set<string>();
  for (const event of eventSink.successes) {
    if (event.toolName === "fetch_page" || event.toolName === "render_page") {
      const data = event.data as { requestedUrl?: unknown; finalUrl?: unknown };
      for (const url of [data.requestedUrl, data.finalUrl]) {
        if (typeof url === "string" && url.length > 0) {
          openedUrls.add(normalizeUrlForJoin(url));
        }
      }
    }
    if (event.toolName === "inspect_page") {
      const data = event.data as { url?: unknown };
      if (typeof data.url === "string" && data.url.length > 0) {
        inspectedUrls.add(normalizeUrlForJoin(data.url));
      }
    }
  }

  const rows: CandidateProvenance[] = candidates.map((candidate) => {
    const url = typeof candidate.url === "string" ? candidate.url : "";
    const targetId = typeof candidate.target_id === "string" ? candidate.target_id : "";
    const normalized = url.length > 0 ? normalizeUrlForJoin(url) : "";
    return {
      url,
      targetId,
      opened: normalized.length > 0 && openedUrls.has(normalized),
      inspected: normalized.length > 0 && inspectedUrls.has(normalized),
    };
  });

  const passed = rows.length > 0 && rows.every((row) => row.opened && row.inspected);
  return { candidates: rows, passed };
}
```

- [ ] **Step 8: Create the InvestigatorEvidenceRunner**

`packages/agent-runtime/src/evidence/investigator-evidence-runner.ts`:

```ts
import { createHash } from "node:crypto";
import { createAgentSession } from "@earendil-works/pi-coding-agent";
import {
  createAgentToolRegistry,
  createSubmitInvestigatorEvidenceTool,
  MemoryToolEventSink,
  ToolGateway,
  type EvidencePrimaryDecision,
  type InvestigatorEvidenceSubmissionSink,
  type InvestigatorEvidenceSubmissionValidator,
} from "@stellaris/agent-tools";
import { ModelPolicy } from "../model/model-policy.js";
import { PiModelResolver } from "../model/pi-model-resolver.js";
import { AgentSessionFactory } from "../session/session-factory.js";
import { INVESTIGATOR_EVIDENCE_ROLE_TOOLS } from "../session/role-tool-policy.js";
import { OFFICIAL_BIOGRAPHY_SKILL_NAME, SkillRuntime } from "../skill/skill-runtime.js";
import type { SkillIdentity } from "../skill/skill-identity.js";
import type { InMemoryInstitutionWorkPacketStore } from "../work-packet/institution-work-packet.js";
import { createSkillInvestigationValidator } from "../investigation/skill-investigation-validator.js";
import { InMemoryInvestigatorEvidenceSubmissionSink } from "./investigator-evidence-submission-sink.js";
import { createSkillEvidenceValidator } from "./skill-evidence-validator.js";
import { buildEvidenceRolePrompt } from "./evidence-role-prompt.js";
import { evaluateEvidenceProvenance } from "./evidence-provenance.js";
import type {
  EvidenceToolCallSummary,
  InvestigatorEvidenceRequest,
  InvestigatorEvidenceResult,
} from "./evidence-types.js";
import { InvestigatorEvidenceRuntimeError } from "./evidence-types.js";

const EVIDENCE_TOOL_NAMES = [
  "get_region_context",
  "search_web",
  "fetch_page",
  "render_page",
  "inspect_page",
  "submit_investigator_evidence",
];

export type InvestigatorEvidenceRunnerDeps = {
  skillRuntime: SkillRuntime;
  packetStore: InMemoryInstitutionWorkPacketStore;
  modelPolicy?: ModelPolicy;
  modelResolver?: PiModelResolver;
  createSession?: typeof createAgentSession;
  sink?: InvestigatorEvidenceSubmissionSink;
  validator?: InvestigatorEvidenceSubmissionValidator;
  eventSink?: MemoryToolEventSink;
  abortSignal?: AbortSignal;
};

/**
 * Runs one fresh INVESTIGATOR Evidence session for one Institution Work Packet.
 *
 * The packet must be EVIDENCE_PENDING (STEP 9 frozen). The runner wires the
 * Skill-schema validator + in-memory sink + PRIMARY join -> evidence registry
 * -> ToolGateway -> AgentSessionFactory (INVESTIGATOR role, evidence tool
 * allowlist) -> fresh Pi session -> short evidence role prompt. On completion
 * it checks freeze + the per-candidate provenance gate, then moves the packet
 * EVIDENCE_GATHERING -> READY_FOR_REVIEW. No PRIMARY re-selection, no final URL
 * selection, no ranking, no provider hardcoding here.
 */
export class InvestigatorEvidenceRunner {
  constructor(private readonly deps: InvestigatorEvidenceRunnerDeps) {}

  async run(request: InvestigatorEvidenceRequest): Promise<InvestigatorEvidenceResult> {
    const packet = this.deps.packetStore.get(request.packetId);
    if (!packet) return { status: "PACKET_NOT_FOUND", packetId: request.packetId };
    if (packet.state !== "EVIDENCE_PENDING") {
      return {
        status: "PACKET_NOT_ELIGIBLE",
        packetId: request.packetId,
        reason: `packet state is ${packet.state}; expected EVIDENCE_PENDING`,
      };
    }

    await this.deps.skillRuntime.reload();
    let identity: SkillIdentity;
    try {
      identity = await this.deps.skillRuntime.resolveSkill(OFFICIAL_BIOGRAPHY_SKILL_NAME);
    } catch (error) {
      throw new InvestigatorEvidenceRuntimeError(
        `Investigator evidence skill unavailable: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    // Fail closed on a non-canonical frozen STEP 9 input (fixture or real).
    const investigationValidator = await createSkillInvestigationValidator(identity);
    const frozenValidation = investigationValidator.validate(request.frozenInput);
    if (!frozenValidation.valid) {
      return {
        status: "INVALID_REQUEST",
        reason: `frozen STEP 9 input failed Skill schema validation: ${frozenValidation.errors.join("; ")}`,
      };
    }
    const primaryDecisions = extractPrimaryDecisions(request.frozenInput.selectedOfficials);
    if (!primaryDecisions) {
      return {
        status: "INVALID_REQUEST",
        reason: "frozen STEP 9 input must contain exactly PRIMARY_1 and PRIMARY_2 person decisions",
      };
    }

    const validator = this.deps.validator ?? (await createSkillEvidenceValidator(identity));
    const sink = this.deps.sink ?? new InMemoryInvestigatorEvidenceSubmissionSink();
    const eventSink = this.deps.eventSink ?? new MemoryToolEventSink();
    const registry = createAgentToolRegistry({
      submitInvestigatorEvidenceTool: createSubmitInvestigatorEvidenceTool({
        validator,
        sink,
        primaryDecisions,
      }),
    });
    const gateway = new ToolGateway(registry, eventSink);

    const modelPolicy = this.deps.modelPolicy ?? new ModelPolicy();
    const resolved = modelPolicy.resolve("INVESTIGATOR");
    if (!resolved.ok) return { status: "MODEL_NOT_CONFIGURED" };

    const modelResolver = this.deps.modelResolver ?? (await PiModelResolver.create());
    const model = modelResolver.resolveConfiguredModel(resolved.provider, resolved.model);
    if (!model.ok) {
      return { status: "MODEL_NOT_FOUND", provider: model.provider, model: model.modelId };
    }

    const factory = new AgentSessionFactory({
      modelPolicy,
      modelResolver,
      resourceLoader: this.deps.skillRuntime.getResourceLoader(),
      gateway,
      eventSink,
      registry,
      ...(this.deps.createSession ? { createSession: this.deps.createSession } : {}),
    });
    const created = await factory.createAgentSession(
      "INVESTIGATOR",
      { taskRunId: `evidence-${request.packetId}-${Date.now()}` },
      { tools: INVESTIGATOR_EVIDENCE_ROLE_TOOLS },
    );
    if (created.status !== "READY") {
      return { status: "MODEL_NOT_CONFIGURED" };
    }
    const { session, agentSessionId } = created;

    this.deps.packetStore.updateState(request.packetId, "EVIDENCE_GATHERING", {
      investigatorSessionId: agentSessionId,
    });

    const promptText = buildEvidenceRolePrompt(packet, {
      regionCode: packet.regionCode ?? "",
      agentSessionId,
      primary1: primaryDecisions[0],
      primary2: primaryDecisions[1],
      institutionId: packet.institutionId,
    });
    if (this.deps.abortSignal) {
      const onAbort = () => {
        void session.abort();
      };
      this.deps.abortSignal.addEventListener("abort", onAbort, { once: true });
      try {
        await session.prompt(promptText);
      } catch (error) {
        if (!this.deps.abortSignal.aborted) throw error;
      } finally {
        this.deps.abortSignal.removeEventListener("abort", onAbort);
      }
    } else {
      await session.prompt(promptText);
    }

    const frozen = await sink.isFrozen();
    const toolCalls = summarizeEvidenceToolCalls(eventSink, frozen);
    if (!frozen) {
      return this.fail(request.packetId, "EVIDENCE_NOT_SUBMITTED", agentSessionId, toolCalls);
    }

    const submission = await sink.getSubmission();
    if (!submission) {
      return this.fail(request.packetId, "EVIDENCE_NOT_SUBMITTED", agentSessionId, toolCalls);
    }

    const provenance = evaluateEvidenceProvenance(eventSink, submission.candidates);
    if (!provenance.passed) {
      return this.fail(
        request.packetId,
        "POSITION_CANDIDATE_OBSERVATION_REQUIRED",
        agentSessionId,
        toolCalls,
      );
    }

    const completedPacket = this.deps.packetStore.updateState(request.packetId, "READY_FOR_REVIEW");
    const primary1 = primaryDecisions.find((d) => d.primarySlot === "PRIMARY_1");
    const primary2 = primaryDecisions.find((d) => d.primarySlot === "PRIMARY_2");
    const primary1CandidateCount = submission.candidates.filter(
      (candidate) => candidate.target_id === primary1?.targetId,
    ).length;
    const primary2CandidateCount = submission.candidates.filter(
      (candidate) => candidate.target_id === primary2?.targetId,
    ).length;

    return {
      status: "COMPLETED",
      packetId: request.packetId,
      packet: completedPacket,
      candidates: submission.candidates,
      claims: submission.claims ?? [],
      frozen: true,
      agentSessionId,
      skill: { name: identity.name, version: identity.version },
      model: { provider: resolved.provider, model: resolved.model },
      toolCalls,
      provenance,
      receipt: {
        frozen: true,
        candidatesValidated: true,
        claimsValidated: submission.claims !== undefined,
        primary1TargetId: primary1?.targetId ?? null,
        primary2TargetId: primary2?.targetId ?? null,
        primary1CandidateCount,
        primary2CandidateCount,
        allCandidatesOpened: provenance.candidates.every((row) => row.opened),
        allCandidatesInspected: provenance.candidates.every((row) => row.inspected),
        payloadHash: createHash("sha256").update(JSON.stringify(submission)).digest("hex"),
      },
    };
  }

  private fail(
    packetId: string,
    failureCode: "EVIDENCE_NOT_SUBMITTED" | "POSITION_CANDIDATE_OBSERVATION_REQUIRED",
    agentSessionId: string,
    toolCalls: EvidenceToolCallSummary[],
  ): InvestigatorEvidenceResult {
    // A failed packet is retained (FAILED + failureCode) for a later
    // Recovery/Retry phase; it is never deleted.
    const packet = this.deps.packetStore.updateState(packetId, "FAILED", { failureCode });
    return { status: "FAILED", packetId, packet, failureCode, agentSessionId, toolCalls };
  }
}

function extractPrimaryDecisions(
  selectedOfficials: Array<Record<string, unknown>>,
): EvidencePrimaryDecision[] | null {
  if (selectedOfficials.length !== 2) return null;
  const decisions: EvidencePrimaryDecision[] = [];
  for (const record of selectedOfficials) {
    const targetId = typeof record.target_id === "string" ? record.target_id : "";
    if (!targetId) return null;
    const primarySlot = record.primary_slot === "PRIMARY_2" ? "PRIMARY_2" : "PRIMARY_1";
    decisions.push({
      targetId,
      personId: typeof record.person_id === "string" ? record.person_id : null,
      personName: typeof record.person_name === "string" ? record.person_name : null,
      primarySlot,
    });
  }
  if (decisions.some((d) => d.primarySlot === "PRIMARY_1") &&
      decisions.some((d) => d.primarySlot === "PRIMARY_2")) {
    return decisions;
  }
  return null;
}

function summarizeEvidenceToolCalls(
  eventSink: MemoryToolEventSink,
  evidenceFrozen: boolean,
): EvidenceToolCallSummary[] {
  return EVIDENCE_TOOL_NAMES.map((toolName) => {
    if (toolName === "submit_investigator_evidence" && evidenceFrozen) {
      return { toolName, called: true, succeeded: true };
    }
    return {
      toolName,
      called: eventSink.starts.some((event) => event.toolName === toolName),
      succeeded: eventSink.successes.some((event) => event.toolName === toolName),
    };
  });
}
```

- [ ] **Step 9: Export the evidence module**

In `packages/agent-runtime/src/index.ts` add:

```ts
export * from "./evidence/evidence-types.js";
export * from "./evidence/evidence-role-prompt.js";
export * from "./evidence/skill-evidence-validator.js";
export * from "./evidence/investigator-evidence-submission-sink.js";
export * from "./evidence/evidence-provenance.js";
export * from "./evidence/investigator-evidence-runner.js";
```

- [ ] **Step 10: Verify the tool policy + typecheck**

```bash
cd /opt/Stellaris-PiAgent-Dev
corepack pnpm --filter @stellaris/agent-runtime typecheck
```

Expected: no type errors (note `exactOptionalPropertyTypes` — spread optional fields conditionally as above).

- [ ] **Step 11: Commit**

```bash
git add packages/agent-runtime/src/evidence packages/agent-runtime/src/session
git commit -m "feat(agent): add InvestigatorEvidenceRunner with fresh-session tool policy"
```

---

### Task 4: Targeted tests + one real Position Evidence smoke

**Files:**
- Create: `packages/agent-runtime/src/evidence/investigator-evidence-runner.test.ts`
- Create: `packages/agent-runtime/src/evidence/evidence-provenance.test.ts`
- Create: `packages/agent-runtime/src/evidence/skill-evidence-validator.test.ts`
- Create: `packages/agent-runtime/src/smoke/evidence-smoke.ts`
- Create: `packages/agent-runtime/src/smoke/evidence-smoke.test.ts`
- Create: `packages/agent-runtime/src/smoke/fixtures/step9-gulou-investigation.json`
- Modify: `packages/agent-runtime/package.json`
- Modify: `package.json`

**Interfaces:**
- Consumes: Task 3 (`InvestigatorEvidenceRunner`, `evaluateEvidenceProvenance`, `createSkillEvidenceValidator`), Task 2 contracts.
- Produces: the real Evidence smoke command `agent:smoke:evidence` and the DEV-ONLY canonical STEP 9 fixture.

- [ ] **Step 1: Write the evidence runner tests (fake Pi session)**

`packages/agent-runtime/src/evidence/investigator-evidence-runner.test.ts` — mirror `investigator-agent-runner.test.ts` (stub SkillRuntime, `ModelPolicy(() => ({ provider: "deepseek", model: "deepseek-v4-pro" }))`, `createSession` returning a `fakeSession`). Fixture:

```ts
const FROZEN_INPUT = {
  leadership: LEADERSHIP, // schema-valid leadership artifact (see test below)
  selectedOfficials: [PRIMARY_1, PRIMARY_2], // schema-valid person-decision artifacts
};
const PRIMARY_1_TARGET = "glq-target-primary1";
const PRIMARY_2_TARGET = "glq-target-primary2";
const FROZEN_INVENTORY = {
  inventory: [{ institution_id: "glq-people-gov", standard_name: "鼓楼区人民政府", administrative_level: "COUNTY", decision: "INCLUDE" }],
};

function freshPacket() {
  const store = new InMemoryInstitutionWorkPacketStore();
  const packets = store.createFromFrozenInventory(FROZEN_INVENTORY, { regionCode: "320106" });
  const packet = packets[0];
  if (!packet) throw new Error("test setup");
  store.updateState(packet.packetId, "INVESTIGATING", { investigatorSessionId: "step9-session" });
  store.updateState(packet.packetId, "EVIDENCE_PENDING");
  return { store, packetId: packet.packetId };
}
function successEvent(toolName: string, data: Record<string, unknown> = {}) {
  const now = new Date().toISOString();
  return { callId: `call-${toolName}-${Math.random()}`, toolName, status: "SUCCESS" as const, data, startedAt: now, finishedAt: now };
}
const CANDIDATE_URL_1 = "https://www.njgl.gov.cn/zfxxgk/ldzc/1.html";
const CANDIDATE_URL_2 = "https://www.njgl.gov.cn/zfxxgk/ldzc/2.html";
```

Test cases:

```ts
it("fails with EVIDENCE_NOT_SUBMITTED when the session never submits", async () => { ... });
it("fails with POSITION_CANDIDATE_OBSERVATION_REQUIRED when candidates are submitted without real open+inspect events", async () => {
  // fakeSession: sink.submit(payload with 2 candidates) but NO fetch/render/inspect events pushed.
});
it("returns a frozen COMPLETED result and READY_FOR_REVIEW for a fully observed candidate pool", async () => {
  // fakeSession pushes successEvent("fetch_page", { requestedUrl: CANDIDATE_URL_1, finalUrl: CANDIDATE_URL_1 })
  //   + successEvent("inspect_page", { url: CANDIDATE_URL_1 })
  //   + same for CANDIDATE_URL_2, then sink.submit(payload with both candidates)
  // asserts: result.packet.state === "READY_FOR_REVIEW", provenance.passed === true,
  //   receipt.primary1CandidateCount === 1, primary2CandidateCount === 1, frozen === true
});
it("returns PACKET_NOT_ELIGIBLE when the packet is not EVIDENCE_PENDING", async () => { ... });
it("returns INVALID_REQUEST when frozenInput fails the Skill schemas", async () => { ... });
```

(The runner test needs the payload builder to produce `target_id` values that equal the frozen target_ids.)

- [ ] **Step 2: Write the provenance gate tests**

`packages/agent-runtime/src/evidence/evidence-provenance.test.ts`:

```ts
it("rejects a candidate that only ever appeared in a search result (no open, no inspect)", () => {
  const sink = new MemoryToolEventSink();
  // only search_web success event
  const gate = evaluateEvidenceProvenance(sink, [candidateRow(URL, TARGET)]);
  expect(gate.passed).toBe(false);
  expect(gate.candidates[0]?.opened).toBe(false);
  expect(gate.candidates[0]?.inspected).toBe(false);
});
it("accepts a candidate whose URL was opened (finalUrl) and inspected in-session", () => {
  const sink = new MemoryToolEventSink();
  sink.successes.push(successEvent("fetch_page", { requestedUrl: URL, finalUrl: URL }));
  sink.successes.push(successEvent("inspect_page", { url: URL }));
  const gate = evaluateEvidenceProvenance(sink, [candidateRow(URL, TARGET)]);
  expect(gate.passed).toBe(true);
});
it("matches a candidate whose requestedUrl redirected to the finalUrl", () => {
  // fetch success with requestedUrl: OLD, finalUrl: URL; inspect on URL; candidate uses URL
});
```

- [ ] **Step 3: Write the validator test**

`packages/agent-runtime/src/evidence/skill-evidence-validator.test.ts`:

```ts
it("accepts a canonical url-candidate-pool payload and rejects a malformed one", async () => {
  const identity = { name: "official-biography-evidence", id: "official-biography-evidence", version: "3.1.0",
    path: "<repo>/third-party/china-official-url-evidence-suite/skills/official-biography-evidence", skmdPath: "", yamlPath: "" };
  const validator = await createSkillEvidenceValidator(identity);
  expect(validator.validate({ candidates: [VALID_CANDIDATE_ROW] }).valid).toBe(true);
  const bad = validator.validate({ candidates: [{ candidate_id: "x" }] }); // missing required fields
  expect(bad.valid).toBe(false);
  expect(bad.errors.length).toBeGreaterThan(0);
});
```

The test must resolve the real skill path — use `path.resolve` from the test file up to the repo root, or read from `process.cwd()`. Safer: build the path from the repo root using `import.meta.url` (test lives at `packages/agent-runtime/src/evidence/`, repo root is 4 levels up). The identity `path` is only used to load `schemas/`, so a correct absolute path is required.

- [ ] **Step 4: Create the DEV-ONLY canonical STEP 9 fixture**

`packages/agent-runtime/src/smoke/fixtures/step9-gulou-investigation.json` (schema-valid; real public figures with findable official pages; clearly a dev fixture, never a production default):

```json
{
  "region_code": "320106",
  "institution_id": "glq-people-gov",
  "institution_name": "鼓楼区人民政府",
  "administrative_level": "COUNTY",
  "inventory": [
    { "institution_id": "glq-people-gov", "standard_name": "鼓楼区人民政府", "administrative_level": "COUNTY", "decision": "INCLUDE" }
  ],
  "leadership": {
    "structure_id": "ldr-gulou-step9-fixture",
    "institution_id": "glq-people-gov",
    "all_visible_leaders": [
      { "person_name": "王安伟", "visible_roles": ["区委书记"] },
      { "person_name": "董涵", "visible_roles": ["区委副书记", "区长"] }
    ],
    "official_order": ["王安伟", "董涵"],
    "party_head": "王安伟",
    "administrative_head": "董涵",
    "party_deputy_secretaries": ["董涵"],
    "executive_deputies": ["董涵"],
    "other_deputies": [],
    "vacancy_information": [],
    "supporting_evidence_ids": ["evt-gulou-step9-1"],
    "structure_complete": true,
    "investigator_agent_id": "step9-fixture-agent",
    "investigator_context_id": "step9-fixture-context",
    "decided_at": "2026-08-14T00:00:00.000Z"
  },
  "selectedOfficials": [
    {
      "person_decision_id": "pd-gulou-primary1",
      "person_id": "person-wang-anwei",
      "target_id": "glq-target-primary1",
      "institution_id": "glq-people-gov",
      "primary_slot": "PRIMARY_1",
      "leadership_structure_id": "ldr-gulou-step9-fixture",
      "person_status": "PERSON_CONFIRMED",
      "person_name": "王安伟",
      "role_canonical": "区委书记",
      "selection_basis": "official order head of 鼓楼区 leadership",
      "rank_information": null,
      "responsibility_description": null,
      "currentness_quality": "CURRENT_COLLECTION_MEMBER",
      "supporting_evidence_ids": ["evt-gulou-step9-1"],
      "investigator_agent_id": "step9-fixture-agent",
      "investigator_context_id": "step9-fixture-context",
      "decided_at": "2026-08-14T00:00:01.000Z"
    },
    {
      "person_decision_id": "pd-gulou-primary2",
      "person_id": "person-dong-han",
      "target_id": "glq-target-primary2",
      "institution_id": "glq-people-gov",
      "primary_slot": "PRIMARY_2",
      "leadership_structure_id": "ldr-gulou-step9-fixture",
      "person_status": "PERSON_CONFIRMED",
      "person_name": "董涵",
      "role_canonical": "区委副书记、区长",
      "selection_basis": "administrative head of 鼓楼区 government",
      "rank_information": null,
      "responsibility_description": null,
      "currentness_quality": "CURRENT_COLLECTION_MEMBER",
      "supporting_evidence_ids": ["evt-gulou-step9-1"],
      "investigator_agent_id": "step9-fixture-agent",
      "investigator_context_id": "step9-fixture-context",
      "decided_at": "2026-08-14T00:00:02.000Z"
    }
  ]
}
```

- [ ] **Step 5: Create the evidence smoke runner**

`packages/agent-runtime/src/smoke/evidence-smoke.ts` — mirror `investigation-smoke.ts`:

```ts
export const EVIDENCE_ARGS_REQUIRED = "EVIDENCE_ARGS_REQUIRED" as const;
export const EVIDENCE_SMOKE_FAILED = "EVIDENCE_SMOKE_FAILED" as const;
export const FIXTURE_LOAD_FAILED = "FIXTURE_LOAD_FAILED" as const;
export const MODEL_NOT_CONFIGURED = "MODEL_NOT_CONFIGURED" as const;
export const MODEL_NOT_FOUND = "MODEL_NOT_FOUND" as const;

export type EvidenceSmokeArgs = {
  regionCode: string | undefined;
  institution: string | undefined;
  budgetMs: number | undefined;
  fixture: string | undefined;
};
export function parseEvidenceSmokeArgs(argv: string[]): EvidenceSmokeArgs;
export function evidenceSmokePassed(report: Record<string, unknown>): boolean;
export async function runEvidenceSmoke(args: EvidenceSmokeArgs): Promise<{ status: "OK" | EvidenceSmokeStatus; report: Record<string, unknown> }>;
export function formatEvidenceSmokeResult(status, report): string;
```

`runEvidenceSmoke` flow:

```ts
const fixturePath = args.fixture ?? path.join(dirname, "fixtures", "step9-gulou-investigation.json");
const fixture = JSON.parse(await readFile(fixturePath, "utf8"));
const { regionCode, institution } = args; // default from fixture when absent
// skill + model like the investigation smoke
const packetStore = new InMemoryInstitutionWorkPacketStore();
const packets = packetStore.createFromFrozenInventory({ inventory: fixture.inventory }, { regionCode });
const packet = packets.find((p) => p.institutionName === institution) ?? packets[0];
packetStore.updateState(packet.packetId, "INVESTIGATING", { investigatorSessionId: "step9-fixture-session" });
packetStore.updateState(packet.packetId, "EVIDENCE_PENDING");
const evidenceRunner = new InvestigatorEvidenceRunner({ skillRuntime, packetStore, modelPolicy, modelResolver, eventSink, ...(controller ? { abortSignal } : {}) });
const result = await evidenceRunner.run({ packetId: packet.packetId, frozenInput: { leadership: fixture.leadership, selectedOfficials: fixture.selectedOfficials } });
report = buildEvidenceReport(result, { skill, regionCode, institution, packetId, packetInitialState: "EVIDENCE_PENDING", eventSink });
```

`evidenceSmokePassed(report)`:

```ts
const called = (name: string) => report[`${name}_called`] === true;
return (
  report.evidence_session_created === true &&
  report.step9_conversation_reused === false &&
  report.skill_loaded === true &&
  report.role === "INVESTIGATOR" &&
  called("search_web") &&
  report.bocha_called === true &&
  (called("fetch_page") || called("render_page")) &&
  called("inspect_page") &&
  called("submit_investigator_evidence") &&
  report.candidates_schema_valid === true &&
  report.primary_1_candidate_count >= 1 &&
  report.primary_2_candidate_count >= 1 &&
  report.all_candidates_opened === true &&
  report.all_candidates_inspected === true &&
  report.candidate_provenance_gate === "PASS" &&
  report.submission_frozen === true &&
  report.packet_final_state === "READY_FOR_REVIEW" &&
  report.agent_completed === true
);
```

`buildEvidenceReport` reads the COMPLETED result: `result.receipt.primary1CandidateCount`, `primary2CandidateCount`, `allCandidatesOpened`, `allCandidatesInspected`, `result.provenance.passed`, and from the event sink `bocha_called` (search_web success with `data.provider === "bocha"`).

- [ ] **Step 6: Write the smoke test**

`packages/agent-runtime/src/smoke/evidence-smoke.test.ts` — test `parseEvidenceSmokeArgs` (`--region-code`, `--institution`, `--budget-ms`, `--fixture`) and `evidenceSmokePassed` happy-path + negatives (bocha false, inspect false, submit false, primary count 0, packet state FAILED).

- [ ] **Step 7: Add the scripts**

`packages/agent-runtime/package.json` scripts += `"smoke:evidence": "tsx src/smoke/evidence-smoke.ts"`.

Root `package.json` scripts += `"agent:smoke:evidence": "pnpm --filter @stellaris/agent-runtime smoke:evidence"`.

- [ ] **Step 8: Run the targeted test suite**

```bash
cd /opt/Stellaris-PiAgent-Dev
corepack pnpm --filter @stellaris/agent-tools build
corepack pnpm --filter @stellaris/agent-runtime test -- src/evidence src/smoke src/work-packet src/investigation src/session
corepack pnpm --filter @stellaris/agent-runtime typecheck
corepack pnpm --filter @stellaris/agent-tools test
```

Expected: all targeted tests pass; typecheck clean.

- [ ] **Step 9: Run the real Position Evidence smoke (server, real DeepSeek + Bocha)**

```bash
cat > /root/.stellaris-evidence-smoke-secrets <<'EOF'
DEEPSEEK_API_KEY=<redacted-at-runtime>
BOCHA_API_KEY=<redacted-at-runtime>
AGENT_MODEL_PROVIDER=deepseek
AGENT_MODEL_ID=deepseek-v4-flash
WEB_SEARCH_PROVIDER=bocha
EOF
chmod 600 /root/.stellaris-evidence-smoke-secrets
# load the secrets and run with a dev budget (~12 min)
set -a; source /root/.stellaris-evidence-smoke-secrets; set +a
cd /opt/Stellaris-PiAgent-Dev
corepack pnpm agent:smoke:evidence -- --region-code 320106 --institution 鼓楼区人民政府 --budget-ms 720000
```

Expected: `status: OK` with every smoke gate field `YES`/`PASS`, `primary_1_candidate_count >= 1`, `primary_2_candidate_count >= 1`, `packet_final_state: READY_FOR_REVIEW`. If the run is only a few steps short (external site slowness), re-run once with `--budget-ms 900000`; no third retry.

- [ ] **Step 10: Commit**

```bash
git add packages/agent-runtime packages/agent-tools package.json
git commit -m "feat(agent): add position evidence smoke and canonical STEP 9 fixture"
```

---

### Task 5: Docs + architecture self-review + secret cleanup + commit

**Files:**
- Create: `docs/agent-runtime/investigator-evidence-position-url-candidate.md`
- Modify: `docs/agent-runtime/institution-work-packet-investigator-foundation.md`
- Create: `docs/superpowers/plans/2026-08-14-investigator-evidence-position-url-candidate.md` (this plan)

**Interfaces:**
- Consumes: Task 4 (verified states, gates, smoke).

- [ ] **Step 1: Update the STEP 9 doc state machine**

In `docs/agent-runtime/institution-work-packet-investigator-foundation.md`, change the state-machine block to `PENDING → INVESTIGATING → EVIDENCE_PENDING` (Investigator success) and note that `READY_FOR_REVIEW` is only reached after the Evidence phase.

- [ ] **Step 2: Write the STEP 10 doc**

`docs/agent-runtime/investigator-evidence-position-url-candidate.md` — Purpose; Fresh Evidence Session; Frozen Investigation Input; Current Position URL scope; Candidate Pool (not Final URL); Search Result is Navigation Only; Fetch/Render + Inspect requirement; Candidate Provenance Gate; PRIMARY Join Gate; Evidence Submission Freeze; Packet State `EVIDENCE_PENDING → EVIDENCE_GATHERING → READY_FOR_REVIEW`; Deferred: Persistent Evidence, Recovery, Reviewer, Final URL Decision.

- [ ] **Step 3: Implementation self-review (89-point checklist)**

Verify (by reading the merged diff): fresh session; no Leadership/PRIMARY recompute; candidates join to frozen PRIMARY target_ids; search snippets not evidence; every candidate opened+inspected via the gate; single submit boundary; Skill unchanged; no TypeScript ranking/final URL; no DeepSeek/Bocha/region hardcoding; no DB/Graphile/Recovery/Reviewer; targeted-only test footprint.

- [ ] **Step 4: Secret cleanup**

```bash
rm -f /root/.stellaris-evidence-smoke-secrets
test ! -e /root/.stellaris-evidence-smoke-secrets && echo EVIDENCE_SMOKE_SECRETS_REMOVED
unset DEEPSEEK_API_KEY BOCHA_API_KEY AGENT_MODEL_PROVIDER AGENT_MODEL_ID WEB_SEARCH_PROVIDER
# secret scan of git tracked/modified files:
cd /opt/Stellaris-PiAgent-Dev
git grep -nE 'sk-REDACTED|sk-REDACTED' -- . ':!node_modules' || echo SECRET_SCAN_CLEAN
```

- [ ] **Step 5: Final build + typecheck (exports changed)**

```bash
corepack pnpm --filter @stellaris/agent-tools build
corepack pnpm --filter @stellaris/agent-runtime build
```

- [ ] **Step 6: Commit**

```bash
git add docs
git commit -m "docs(agent): record investigator evidence position URL candidate phase"
```

- [ ] **Step 7: Confirm worktree clean + final HEAD**

```bash
git status --short
git rev-parse HEAD
```

---

## Self-Review

**[ ] Evidence stage uses a fresh Pi Session** — Task 3 creates a brand-new session via `AgentSessionFactory` with a new `taskRunId`; STEP 9 conversation is never reused.

**[ ] Does not continue STEP 9 long context** — Evidence role prompt is short; only the packet + frozen PRIMARY decisions are injected.

**[ ] Frozen Leadership / PRIMARY are Evidence-session input facts** — `frozenInput` is validated and wired as `primaryDecisions`; the Agent is told explicitly not to re-judge.

**[ ] Does not redo Leadership Discovery** — no Leadership tool path in the Evidence prompt; no `assembleLeadership` touch.

**[ ] Does not re-decide PRIMARY** — `primaryDecisions` come from the frozen person decisions; the tool rejects any candidate targeting a non-PRIMARY target.

**[ ] PRIMARY still from frozen Person Decision** — join via `target_id` (+ `person_id` for claims) from `selectedOfficials`.

**[ ] Current Position Evidence only does Candidate Pool, no FinalDecision** — no `final-url-decision` artifact, no `FINAL_POSITION_URL`.

**[ ] Search snippet is not Evidence** — `evaluateEvidenceProvenance` requires real open + inspect events per URL.

**[ ] Each candidate really opens a page** — gate checks fetch/render SUCCESS (requestedUrl OR finalUrl normalized match).

**[ ] Each candidate has an inspect_page Observation** — gate checks inspect SUCCESS on the same normalized URL.

**[ ] Candidate corresponds to current PRIMARY person** — tool-level deterministic `POSITION_CANDIDATE_UNKNOWN_PRIMARY` gate.

**[ ] TypeScript does not rank URLs** — no scoring/ranking; `candidate_status` is the Agent's Skill-schema value.

**[ ] Skill is Evidence/Candidate semantic authority** — canonical schemas only from `SkillSchemaRegistry`; Skill untouched.

**[ ] Does not copy Skill candidate scoring rules** — TypeScript only validates/joins/gates/freezes.

**[ ] No hardcoded DeepSeek / Bocha / region logic** — provider/model/search resolve from runtime env (`ModelPolicy`, `resolveSearchRuntimeConfig`); region values only in fixtures/smoke args.

**[ ] No Reviewer / Recovery / PostgreSQL / Graphile** — none introduced.

**[ ] Skill unchanged** — no edits under `third-party/`.

**[ ] No Full Workspace Test** — targeted packages only (agent-tools, agent-runtime).

**Gap fixes applied inline:** `investigationSmokePassed` gate updated to `EVIDENCE_PENDING`; work-packet and investigator runner tests updated to the new state semantics; session-factory gains a backward-compatible optional `tools` override; evidence tool enforces both schema + PRIMARY join + coverage so the runner only re-checks submission + provenance (mirrors the STEP 9 tool/runner split).

SELF_REVIEW: PASS
ARCHITECTURE_CONFLICT: NONE
EXECUTION_PREAUTHORIZED_BY_USER: YES
EXECUTION_MODE: INLINE_FAST
TEST_POLICY: TARGETED_ONLY
