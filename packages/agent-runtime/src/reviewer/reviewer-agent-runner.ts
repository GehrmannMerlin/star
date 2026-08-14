import { createHash, randomUUID } from "node:crypto";
import { createAgentSession } from "@earendil-works/pi-coding-agent";
import {
  createAgentToolRegistry,
  createSubmitReviewDecisionTool,
  MemoryToolEventSink,
  ToolGateway,
  type InvestigationSubmissionValidator,
  type InvestigatorEvidenceSubmissionValidator,
  type ReviewerDecisionSink,
  type ReviewerSubmissionValidator,
} from "@stellaris/agent-tools";
import { ModelPolicy } from "../model/model-policy.js";
import { PiModelResolver } from "../model/pi-model-resolver.js";
import { AgentSessionFactory } from "../session/session-factory.js";
import { REVIEWER_ROLE_TOOLS } from "../session/role-tool-policy.js";
import { OFFICIAL_BIOGRAPHY_SKILL_NAME, SkillRuntime } from "../skill/skill-runtime.js";
import type { SkillIdentity } from "../skill/skill-identity.js";
import type { InMemoryInstitutionWorkPacketStore } from "../work-packet/institution-work-packet.js";
import { createSkillInvestigationValidator } from "../investigation/skill-investigation-validator.js";
import { createSkillEvidenceValidator } from "../evidence/skill-evidence-validator.js";
import { InMemoryReviewDecisionSink } from "./review-decision-sink.js";
import { createSkillReviewValidator } from "./skill-review-validator.js";
import { buildReviewerRolePrompt } from "./reviewer-role-prompt.js";
import {
  attestReviewRecords,
  evaluateReviewerObservation,
  poolById,
} from "./review-attestation.js";
import {
  extractReviewerPrimaryDecisions,
  REVIEW_OBSERVATION_REQUIRED,
  REVIEW_SCHEMA_INVALID,
  REVIEW_NOT_SUBMITTED,
  type ReviewerFailedResult,
  type ReviewerFrozenInput,
  type ReviewerRequest,
  type ReviewerResult,
  type ReviewerToolCallSummary,
} from "./reviewer-types.js";
import { ReviewerRuntimeError } from "./reviewer-types.js";

const REVIEWER_TOOL_NAMES = [
  "get_region_context",
  "search_web",
  "fetch_page",
  "render_page",
  "inspect_page",
  "submit_review_decision",
];

export type ReviewerRunnerDeps = {
  skillRuntime: SkillRuntime;
  packetStore: InMemoryInstitutionWorkPacketStore;
  /** Provider-neutral model wiring. Defaults are server-configured. */
  modelPolicy?: ModelPolicy;
  modelResolver?: PiModelResolver;
  /** Override for tests: intercept the options passed to Pi. */
  createSession?: typeof createAgentSession;
  /** Override for tests: pre-built review decision sink (in-memory default). */
  sink?: ReviewerDecisionSink;
  /** Override for tests: canonical review-record validator (Skill default). */
  reviewValidator?: ReviewerSubmissionValidator;
  /** Override for tests: frozen leadership/person-decisions validator. */
  investigationValidator?: InvestigationSubmissionValidator;
  /** Override for tests: frozen candidate-pool validator. */
  evidenceValidator?: InvestigatorEvidenceSubmissionValidator;
  /** Override for tests/observability: reviewer tool event sink (in-memory default). */
  eventSink?: MemoryToolEventSink;
  /** Dev-smoke-only budget: abort the Pi session on this signal. NEVER part of the business request. */
  abortSignal?: AbortSignal;
};

/**
 * Runs one fresh REVIEWER session for one Institution Work Packet whose STEP 10
 * Evidence is frozen (READY_FOR_REVIEW). Inputs are the frozen Leadership /
 * PRIMARY person decisions / Candidate Pool — never Investigator reasoning.
 * The Reviewer independently searches (omission check), reopens + re-inspects
 * the candidate it approves, and freezes a per-PRIMARY Review Decision through
 * submit_review_decision. The canonical Independent Review Record is built with
 * real session attestation and validated against the Skill schema.
 *
 * Packet: READY_FOR_REVIEW → REVIEWING → POSITION_DECIDED (both PRIMARYs
 * approved) | RECOVERY_REQUIRED (any rework) | FAILED (gate/schema failure).
 * No COMPLETED state; no Final URL outside the frozen pool; no ranking here.
 */
export class ReviewerAgentRunner {
  constructor(private readonly deps: ReviewerRunnerDeps) {}

  async run(request: ReviewerRequest): Promise<ReviewerResult> {
    const packet = this.deps.packetStore.get(request.packetId);
    if (!packet) return { status: "PACKET_NOT_FOUND", packetId: request.packetId };
    if (packet.state !== "READY_FOR_REVIEW") {
      return {
        status: "PACKET_NOT_ELIGIBLE",
        packetId: request.packetId,
        reason: `packet state is ${packet.state}; expected READY_FOR_REVIEW`,
      };
    }

    await this.deps.skillRuntime.reload();
    let identity: SkillIdentity;
    try {
      identity = await this.deps.skillRuntime.resolveSkill(OFFICIAL_BIOGRAPHY_SKILL_NAME);
    } catch (error) {
      throw new ReviewerRuntimeError(
        `Reviewer skill unavailable: ${error instanceof Error ? error.message : String(error)}`,
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
        reason: `frozen candidate pool failed Skill schema validation: ${poolValidation.errors.join("; ")}`,
      };
    }

    const primaryDecisions = extractReviewerPrimaryDecisions(request.frozenInput.selectedOfficials);
    if (!primaryDecisions) {
      return {
        status: "INVALID_REQUEST",
        reason: "frozen input must contain exactly PRIMARY_1 and PRIMARY_2 person decisions",
      };
    }

    const sink = this.deps.sink ?? new InMemoryReviewDecisionSink();
    const eventSink = this.deps.eventSink ?? new MemoryToolEventSink();
    const registry = createAgentToolRegistry({
      submitReviewDecisionTool: createSubmitReviewDecisionTool({
        sink,
        primaryDecisions: [primaryDecisions.primary1, primaryDecisions.primary2],
        candidatePool: request.frozenInput.candidatePool,
      }),
    });
    const gateway = new ToolGateway(registry, eventSink);

    const modelPolicy = this.deps.modelPolicy ?? new ModelPolicy();
    const resolved = modelPolicy.resolve("REVIEWER");
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
      "REVIEWER",
      { taskRunId: `review-${request.packetId}-${Date.now()}` },
      { tools: REVIEWER_ROLE_TOOLS },
    );
    if (created.status !== "READY") {
      return { status: "MODEL_NOT_CONFIGURED" };
    }
    const { session, agentSessionId } = created;

    // Claim the packet only after the session is ready. A non-READY_FOR_REVIEW
    // packet never reaches this point (fail closed on duplicate start).
    this.deps.packetStore.updateState(request.packetId, "REVIEWING", {
      investigatorSessionId: agentSessionId,
    });

    const promptText = buildReviewerRolePrompt(packet, {
      regionCode: packet.regionCode ?? "",
      institutionId: packet.institutionId,
      agentSessionId,
      primary1: primaryDecisions.primary1,
      primary2: primaryDecisions.primary2,
      candidates: request.frozenInput.candidatePool,
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

    const toolCalls = summarizeReviewerToolCalls(eventSink);
    const frozen = await sink.isFrozen();
    if (!frozen) {
      return this.fail(request.packetId, REVIEW_NOT_SUBMITTED, agentSessionId, toolCalls);
    }
    const submission = await sink.getSubmission();
    if (!submission) {
      return this.fail(request.packetId, REVIEW_NOT_SUBMITTED, agentSessionId, toolCalls);
    }

    // Build canonical review records with real session attestation.
    const leadership = request.frozenInput.leadership;
    const attested = attestReviewRecords(submission, {
      reviewerSessionId: agentSessionId,
      reviewerAgentUuid: randomUUID(),
      reviewerAgentId: randomUUID(),
      reviewerContextId: randomUUID(),
      investigatorAgentId:
        typeof leadership.investigator_agent_id === "string"
          ? leadership.investigator_agent_id
          : "unknown-investigator",
      investigatorContextId:
        typeof leadership.investigator_context_id === "string"
          ? leadership.investigator_context_id
          : "unknown-investigator-context",
      eventSink,
      candidatePool: request.frozenInput.candidatePool,
    });

    const reviewValidator =
      this.deps.reviewValidator ?? (await createSkillReviewValidator(identity));
    const validation = reviewValidator.validate(attested.map((review) => review.record));
    if (!validation.valid) {
      return this.fail(
        request.packetId,
        REVIEW_SCHEMA_INVALID,
        agentSessionId,
        toolCalls,
        validation.errors.join("; "),
      );
    }

    // Reviewer observation gate: every APPROVED candidate really reopened +
    // really inspected in THIS session; independent search really happened.
    const byId = poolById(request.frozenInput.candidatePool);
    const observation = evaluateReviewerObservation(eventSink.successes, submission, byId);
    if (!observation.passed) {
      return this.fail(request.packetId, REVIEW_OBSERVATION_REQUIRED, agentSessionId, toolCalls);
    }

    const reviewFor = (targetId: string) => attested.find((review) => review.targetId === targetId);
    const primary1Review = reviewFor(primaryDecisions.primary1.targetId);
    const primary2Review = reviewFor(primaryDecisions.primary2.targetId);
    if (!primary1Review || !primary2Review) {
      return this.fail(
        request.packetId,
        REVIEW_SCHEMA_INVALID,
        agentSessionId,
        toolCalls,
        "frozen PRIMARY review missing after attestation",
      );
    }

    const finalDecisions = [
      {
        targetId: primary1Review.targetId,
        primarySlot: "PRIMARY_1" as const,
        selectedCandidateId: primary1Review.selectedCandidateId,
        finalUrl: primary1Review.finalUrl,
        reviewResult: primary1Review.reviewResult,
      },
      {
        targetId: primary2Review.targetId,
        primarySlot: "PRIMARY_2" as const,
        selectedCandidateId: primary2Review.selectedCandidateId,
        finalUrl: primary2Review.finalUrl,
        reviewResult: primary2Review.reviewResult,
      },
    ];

    const approvedCount = attested.filter((review) => review.reviewResult === "APPROVED").length;
    const reworkCount = attested.length - approvedCount;
    const bothApproved = approvedCount === 2;

    const completedPacket = this.deps.packetStore.updateState(
      request.packetId,
      bothApproved ? "POSITION_DECIDED" : "RECOVERY_REQUIRED",
    );

    const base = {
      packetId: request.packetId,
      packet: completedPacket,
      reviews: attested.map((review) => review.record),
      finalDecisions,
      frozen: true as const,
      agentSessionId,
      skill: { name: identity.name, version: identity.version },
      model: { provider: resolved.provider, model: resolved.model },
      toolCalls,
      receipt: {
        frozen: true as const,
        reviewsValidated: validation.valid,
        reviewCount: attested.length,
        approvedCount,
        reworkCount,
        primary1Outcome: primary1Review.reviewResult,
        primary2Outcome: primary2Review.reviewResult,
        primary1FinalUrl: primary1Review.finalUrl,
        primary2FinalUrl: primary2Review.finalUrl,
        observationGate: observation.passed ? ("PASS" as const) : ("FAIL" as const),
        independentSearch: observation.searchSucceeded,
        payloadHash: createHash("sha256").update(JSON.stringify(submission)).digest("hex"),
      },
    };

    if (bothApproved) {
      return { status: "COMPLETED", ...base, packetFinalState: "POSITION_DECIDED" as const };
    }
    return { status: "RECOVERY_REQUIRED", ...base, packetFinalState: "RECOVERY_REQUIRED" as const };
  }

  private fail(
    packetId: string,
    failureCode: typeof REVIEW_NOT_SUBMITTED | typeof REVIEW_SCHEMA_INVALID | typeof REVIEW_OBSERVATION_REQUIRED,
    agentSessionId: string,
    toolCalls: ReviewerToolCallSummary[],
    detail?: string,
  ): ReviewerFailedResult {
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

function summarizeReviewerToolCalls(eventSink: MemoryToolEventSink): ReviewerToolCallSummary[] {
  return REVIEWER_TOOL_NAMES.map((toolName) => ({
    toolName,
    called: eventSink.starts.some((event) => event.toolName === toolName),
    succeeded: eventSink.successes.some((event) => event.toolName === toolName),
  }));
}
