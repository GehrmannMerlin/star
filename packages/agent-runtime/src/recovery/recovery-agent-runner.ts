import { createHash, randomUUID } from "node:crypto";
import { createAgentSession } from "@earendil-works/pi-coding-agent";
import {
  createAgentToolRegistry,
  createSubmitRecoveryEvidenceTool,
  MemoryToolEventSink,
  ToolGateway,
  type InvestigationSubmissionValidator,
  type InvestigatorEvidenceSubmissionValidator,
  type RecoverySubmissionSink,
  type RecoverySubmissionValidator,
  type ReviewerSubmissionValidator,
} from "@stellaris/agent-tools";
import { ModelPolicy } from "../model/model-policy.js";
import { PiModelResolver } from "../model/pi-model-resolver.js";
import { AgentSessionFactory } from "../session/session-factory.js";
import { RECOVERY_ROLE_TOOLS } from "../session/role-tool-policy.js";
import { OFFICIAL_BIOGRAPHY_SKILL_NAME, SkillRuntime } from "../skill/skill-runtime.js";
import type { SkillIdentity } from "../skill/skill-identity.js";
import type { InMemoryInstitutionWorkPacketStore } from "../work-packet/institution-work-packet.js";
import { createSkillInvestigationValidator } from "../investigation/skill-investigation-validator.js";
import { createSkillEvidenceValidator } from "../evidence/skill-evidence-validator.js";
import { createSkillReviewValidator } from "../reviewer/skill-review-validator.js";
import { extractReviewerPrimaryDecisions } from "../reviewer/reviewer-types.js";
import { InMemoryRecoverySubmissionSink } from "./recovery-submission-sink.js";
import { createSkillRecoveryValidator } from "./skill-recovery-validator.js";
import { buildRecoveryRolePrompt } from "./recovery-role-prompt.js";
import { attestRecoveryRecords, composeCandidateView } from "./recovery-attestation.js";
import {
  RECOVERY_NOT_SUBMITTED,
  RECOVERY_SCHEMA_INVALID,
  type RecoveryFailedResult,
  type RecoveryFrozenInput,
  type RecoveryRequest,
  type RecoveryResult,
  type RecoveryToolCallSummary,
} from "./recovery-types.js";
import { RecoveryRunnerRuntimeError } from "./recovery-types.js";

const RECOVERY_TOOL_NAMES = [
  "get_region_context",
  "search_web",
  "fetch_page",
  "render_page",
  "inspect_page",
  "submit_recovery_evidence",
];

export type RecoveryRunnerDeps = {
  skillRuntime: SkillRuntime;
  packetStore: InMemoryInstitutionWorkPacketStore;
  /** Provider-neutral model wiring. Defaults are server-configured. */
  modelPolicy?: ModelPolicy;
  modelResolver?: PiModelResolver;
  /** Override for tests: intercept the options passed to Pi. */
  createSession?: typeof createAgentSession;
  /** Override for tests: pre-built recovery submission sink (in-memory default). */
  sink?: RecoverySubmissionSink;
  /** Override for tests: canonical recovery-record validator (Skill default). */
  recoveryValidator?: RecoverySubmissionValidator;
  /** Override for tests: frozen leadership/person-decisions validator. */
  investigationValidator?: InvestigationSubmissionValidator;
  /** Override for tests: frozen candidate-pool validator. */
  evidenceValidator?: InvestigatorEvidenceSubmissionValidator;
  /** Override for tests: frozen review-record validator. */
  reviewValidator?: ReviewerSubmissionValidator;
  /** Override for tests/observability: recovery tool event sink (in-memory default). */
  eventSink?: MemoryToolEventSink;
  /** Dev-smoke-only budget: abort the Pi session on this signal. NEVER part of the business request. */
  abortSignal?: AbortSignal;
};

/**
 * Runs one fresh RECOVERY session for one Institution Work Packet in state
 * RECOVERY_REQUIRED. Inputs are the frozen Leadership / PRIMARY person
 * decisions / ORIGINAL Candidate Pool / frozen Review Records — never
 * Investigator or Reviewer reasoning. The Recovery Agent searches with a
 * different method, opens + inspects NEW candidates for the reviewer-identified
 * gap, and freezes a thin supplement through submit_recovery_evidence. The
 * runtime attests full canonical Recovery Records (recovery-record.schema.json)
 * with real session tool-call IDs, validates them, and mechanically composes a
 * Composite Candidate View (original + supplement) for the NEXT Reviewer
 * session. Recovery has NO final-URL authority.
 *
 * Packet: RECOVERY_REQUIRED → RECOVERING → READY_FOR_REVIEW | FAILED.
 * No Candidate Pool overwrite; no PRIMARY recomputation; no ranking here.
 */
export class RecoveryAgentRunner {
  constructor(private readonly deps: RecoveryRunnerDeps) {}

  async run(request: RecoveryRequest): Promise<RecoveryResult> {
    const packet = this.deps.packetStore.get(request.packetId);
    if (!packet) return { status: "PACKET_NOT_FOUND", packetId: request.packetId };
    if (packet.state !== "RECOVERY_REQUIRED") {
      return {
        status: "PACKET_NOT_ELIGIBLE",
        packetId: request.packetId,
        reason: `packet state is ${packet.state}; expected RECOVERY_REQUIRED`,
      };
    }

    await this.deps.skillRuntime.reload();
    let identity: SkillIdentity;
    try {
      identity = await this.deps.skillRuntime.resolveSkill(OFFICIAL_BIOGRAPHY_SKILL_NAME);
    } catch (error) {
      throw new RecoveryRunnerRuntimeError(
        `Recovery skill unavailable: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    // Fail closed on non-canonical frozen inputs (fixture or real).
    const investigationValidator =
      this.deps.investigationValidator ??
      (await createSkillInvestigationValidator(identity));
    const frozenValidation = investigationValidator.validate({
      leadership: request.frozenInput.leadership,
      selectedOfficials: request.frozenInput.selectedOfficials,
    } as never);
    if (!frozenValidation.valid) {
      return {
        status: "INVALID_REQUEST",
        reason: `frozen leadership/person-decisions failed Skill schema validation: ${frozenValidation.errors.join("; ")}`,
      };
    }
    const evidenceValidator =
      this.deps.evidenceValidator ?? (await createSkillEvidenceValidator(identity));
    const poolValidation = evidenceValidator.validate({
      candidates: request.frozenInput.candidatePool,
    });
    if (!poolValidation.valid) {
      return {
        status: "INVALID_REQUEST",
        reason: `frozen original candidate pool failed Skill schema validation: ${poolValidation.errors.join("; ")}`,
      };
    }
    const reviewValidator =
      this.deps.reviewValidator ?? (await createSkillReviewValidator(identity));
    const reviewValidation = reviewValidator.validate(request.frozenInput.reviewRecords);
    if (!reviewValidation.valid) {
      return {
        status: "INVALID_REQUEST",
        reason: `frozen review records failed Skill schema validation: ${reviewValidation.errors.join("; ")}`,
      };
    }

    const primaryDecisions = extractReviewerPrimaryDecisions(request.frozenInput.selectedOfficials);
    if (!primaryDecisions) {
      return {
        status: "INVALID_REQUEST",
        reason: "frozen input must contain exactly PRIMARY_1 and PRIMARY_2 person decisions",
      };
    }

    const sink = this.deps.sink ?? new InMemoryRecoverySubmissionSink();
    const eventSink = this.deps.eventSink ?? new MemoryToolEventSink();
    const registry = createAgentToolRegistry({
      submitRecoveryEvidenceTool: createSubmitRecoveryEvidenceTool({
        sink,
        validator: evidenceValidator,
        primaryDecisions: [primaryDecisions.primary1, primaryDecisions.primary2],
        originalCandidatePool: request.frozenInput.candidatePool,
        eventSink,
      }),
    });
    const gateway = new ToolGateway(registry, eventSink);

    const modelPolicy = this.deps.modelPolicy ?? new ModelPolicy();
    const resolved = modelPolicy.resolve("RECOVERY");
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
      "RECOVERY",
      { taskRunId: `recovery-${request.packetId}-${Date.now()}` },
      { tools: RECOVERY_ROLE_TOOLS },
    );
    if (created.status !== "READY") {
      return { status: "MODEL_NOT_CONFIGURED" };
    }
    const { session, agentSessionId } = created;

    // Claim the packet only after the session is ready.
    this.deps.packetStore.updateState(request.packetId, "RECOVERING", {
      investigatorSessionId: agentSessionId,
    });

    const promptText = buildRecoveryRolePrompt(packet, {
      regionCode: packet.regionCode ?? "",
      institutionId: packet.institutionId,
      agentSessionId,
      primary1: primaryDecisions.primary1,
      primary2: primaryDecisions.primary2,
      candidates: request.frozenInput.candidatePool,
      reviewRecords: request.frozenInput.reviewRecords,
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

    const toolCalls = summarizeRecoveryToolCalls(eventSink);
    const frozen = await sink.isFrozen();
    if (!frozen) {
      return this.fail(request.packetId, RECOVERY_NOT_SUBMITTED, agentSessionId, toolCalls);
    }
    const submission = await sink.getSubmission();
    if (!submission) {
      return this.fail(request.packetId, RECOVERY_NOT_SUBMITTED, agentSessionId, toolCalls);
    }

    // Build canonical recovery records with real session attestation.
    const attested = attestRecoveryRecords(submission, {
      recoverySessionId: agentSessionId,
      recoveryAgentUuid: randomUUID(),
      recoveryContextId: randomUUID(),
      eventSink,
      candidates: submission.candidates,
    });

    const recoveryValidator =
      this.deps.recoveryValidator ?? (await createSkillRecoveryValidator(identity));
    const validation = recoveryValidator.validate(attested.map((record) => record.record));
    if (!validation.valid) {
      return this.fail(
        request.packetId,
        RECOVERY_SCHEMA_INVALID,
        agentSessionId,
        toolCalls,
        validation.errors.join("; "),
      );
    }

    // Composite Candidate View: mechanical concat + identity dedupe (no ranking).
    const compositeCandidateView = composeCandidateView(
      request.frozenInput.candidatePool,
      submission.candidates,
    );

    const completedPacket = this.deps.packetStore.updateState(request.packetId, "READY_FOR_REVIEW");

    return {
      status: "COMPLETED",
      packetId: request.packetId,
      packet: completedPacket,
      packetFinalState: "READY_FOR_REVIEW",
      recoveryRecords: attested.map((record) => record.record),
      newCandidates: submission.candidates,
      compositeCandidateView,
      originalCandidatePoolUnchanged: true,
      frozen: true,
      agentSessionId,
      skill: { name: identity.name, version: identity.version },
      model: { provider: resolved.provider, model: resolved.model },
      toolCalls,
      receipt: {
        frozen: true,
        supplementValidated: validation.valid,
        reviewRecordsValidated: reviewValidation.valid,
        supplementCount: submission.supplements.length,
        recoveredCount: submission.supplements.filter(
          (supplement) => supplement.outcome === "RECOVERED_QUALIFIED_URL",
        ).length,
        originalCandidatePoolUnchanged: true,
        compositeCandidateViewCount: compositeCandidateView.length,
        provenanceGate: "PASS",
        payloadHash: createHash("sha256").update(JSON.stringify(submission)).digest("hex"),
      },
    };
  }

  private fail(
    packetId: string,
    failureCode: "RECOVERY_NOT_SUBMITTED" | "RECOVERY_SCHEMA_INVALID" | "RECOVERY_OBSERVATION_REQUIRED",
    agentSessionId: string,
    toolCalls: RecoveryToolCallSummary[],
    detail?: string,
  ): RecoveryFailedResult {
    const packet = this.deps.packetStore.updateState(packetId, "FAILED", { failureCode });
    return {
      status: "FAILED",
      packetId,
      packet,
      packetFinalState: "FAILED",
      failureCode,
      agentSessionId,
      toolCalls,
      ...(detail ? { failureDetail: detail } : {}),
    };
  }
}

function summarizeRecoveryToolCalls(eventSink: MemoryToolEventSink): RecoveryToolCallSummary[] {
  return RECOVERY_TOOL_NAMES.map((toolName) => ({
    toolName,
    called: eventSink.starts.some((event) => event.toolName === toolName),
    succeeded: eventSink.successes.some((event) => event.toolName === toolName),
  }));
}
