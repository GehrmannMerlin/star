import { createHash } from "node:crypto";
import { createAgentSession } from "@earendil-works/pi-coding-agent";
import {
  createAgentToolRegistry,
  createSubmitInvestigatorEvidenceTool,
  MemoryToolEventSink,
  ToolGateway,
  type EvidencePrimaryDecision,
  type InvestigationSubmissionValidator,
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
  /** Provider-neutral model wiring. Defaults are server-configured. */
  modelPolicy?: ModelPolicy;
  modelResolver?: PiModelResolver;
  /** Override for tests: intercept the options passed to Pi. */
  createSession?: typeof createAgentSession;
  /** Override for tests: pre-built sink (in-memory default). */
  sink?: InvestigatorEvidenceSubmissionSink;
  /** Override for tests: pre-built validator (Skill-schema default). */
  validator?: InvestigatorEvidenceSubmissionValidator;
  /** Override for tests: frozen-input (leadership/person-decision) validator. */
  investigationValidator?: InvestigationSubmissionValidator;
  /** Override for tests/observability: tool event sink (in-memory default). */
  eventSink?: MemoryToolEventSink;
  /** Dev-smoke-only budget: abort the Pi session on this signal. NEVER part of the business request. */
  abortSignal?: AbortSignal;
};

/** PRIMARY_1 / PRIMARY_2 frozen decisions (both guaranteed present). */
type PrimaryDecisionPair = {
  primary1: EvidencePrimaryDecision;
  primary2: EvidencePrimaryDecision;
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
    const investigationValidator =
      this.deps.investigationValidator ?? (await createSkillInvestigationValidator(identity));
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
        primaryDecisions: [primaryDecisions.primary1, primaryDecisions.primary2],
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

    // Claim the packet only after the session is ready. A non-EVIDENCE_PENDING
    // packet never reaches this point, so two Evidence sessions on one packet
    // are impossible (fail closed on duplicate start).
    this.deps.packetStore.updateState(request.packetId, "EVIDENCE_GATHERING", {
      investigatorSessionId: agentSessionId,
    });

    const promptText = buildEvidenceRolePrompt(packet, {
      regionCode: packet.regionCode ?? "",
      agentSessionId,
      primary1: primaryDecisions.primary1,
      primary2: primaryDecisions.primary2,
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

    // Runtime per-candidate provenance gate: search snippets alone never count.
    // The packet may reach READY_FOR_REVIEW only when every candidate URL was
    // really opened (fetch/render SUCCESS) and really inspected.
    const provenance = evaluateEvidenceProvenance(eventSink.successes, submission.candidates);
    if (!provenance.passed) {
      return this.fail(
        request.packetId,
        "POSITION_CANDIDATE_OBSERVATION_REQUIRED",
        agentSessionId,
        toolCalls,
      );
    }

    const completedPacket = this.deps.packetStore.updateState(request.packetId, "READY_FOR_REVIEW");
    const primary1CandidateCount = submission.candidates.filter(
      (candidate) => candidate.target_id === primaryDecisions.primary1.targetId,
    ).length;
    const primary2CandidateCount = submission.candidates.filter(
      (candidate) => candidate.target_id === primaryDecisions.primary2.targetId,
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
        primary1TargetId: primaryDecisions.primary1.targetId,
        primary2TargetId: primaryDecisions.primary2.targetId,
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

/** Read only the frozen PRIMARY identities; returns null unless both slots exist. */
function extractPrimaryDecisions(
  selectedOfficials: Array<Record<string, unknown>>,
): PrimaryDecisionPair | null {
  let primary1: EvidencePrimaryDecision | undefined;
  let primary2: EvidencePrimaryDecision | undefined;
  for (const record of selectedOfficials) {
    const targetId = typeof record.target_id === "string" ? record.target_id : "";
    if (!targetId) return null;
    const decision: EvidencePrimaryDecision = {
      targetId,
      personId: typeof record.person_id === "string" ? record.person_id : null,
      personName: typeof record.person_name === "string" ? record.person_name : null,
      primarySlot: record.primary_slot === "PRIMARY_2" ? "PRIMARY_2" : "PRIMARY_1",
    };
    if (record.primary_slot === "PRIMARY_2") primary2 = decision;
    else primary1 = decision;
  }
  if (!primary1 || !primary2) return null;
  return { primary1, primary2 };
}

function summarizeEvidenceToolCalls(
  eventSink: MemoryToolEventSink,
  evidenceFrozen: boolean,
): EvidenceToolCallSummary[] {
  return EVIDENCE_TOOL_NAMES.map((toolName) => {
    // The sink is only reachable through the submit_investigator_evidence tool,
    // so a frozen submission implies the tool was called and succeeded.
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
