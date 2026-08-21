import { createHash } from "node:crypto";
import { createAgentSession } from "@earendil-works/pi-coding-agent";
import {
  composeToolEventSinks,
  createAgentToolRegistry,
  createSubmitInvestigatorEvidenceTool,
  MemoryToolEventSink,
  type EvidencePrimaryDecision,
  type InvestigationSubmissionValidator,
  type InvestigatorEvidenceSubmissionSink,
  type InvestigatorEvidenceSubmissionValidator,
  type ToolEventSink,
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
import { CanonicalEvidenceContract } from "./canonical-evidence-contract.js";
import {
  buildEvidenceRolePrompt,
  buildEvidenceFinalizePrompt,
  buildEvidenceRepairPrompt,
} from "./evidence-role-prompt.js";
import { evaluateEvidenceProvenance } from "./evidence-provenance.js";
import {
  EvidenceSubmissionPhaseTracker,
  SUBMIT_EVIDENCE_MAX_ATTEMPTS,
  EVIDENCE_SCHEMA_REPAIR_MAX_ATTEMPTS,
} from "./evidence-submission-phase-tracker.js";
import { EvidenceRepairGateway } from "./evidence-repair-gateway.js";
import type {
  EvidenceRepairReport,
  EvidenceToolCallSummary,
  InvestigatorEvidenceRequest,
  InvestigatorEvidenceResult,
} from "./evidence-types.js";
import { InvestigatorEvidenceRuntimeError } from "./evidence-types.js";

type EvidencePromptOptionsBase = {
  regionCode: string;
  agentSessionId: string;
  primary1: EvidencePrimaryDecision;
  primary2: EvidencePrimaryDecision;
  institutionId: string;
};

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
  /** STEP 19.3：可选持久化 ToolEvent sink（Agent provenance 落库；gate 仍用内存 sink）。 */
  persistentEventSink?: ToolEventSink;
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
 *
 * STEP 20.1 闭环：
 * - 单次完整 evidence prompt（EVIDENCE_GATHERING）
 * - 若未提交 → 一次短 Finalize steering（FINALIZING）
 * - 若仍有 Schema 失败 → 至多 2 次 Repair steering（EVIDENCE_SUBMISSION_REPAIR），
 *   每次携带结构化 allowed_values 反馈；Repair 阶段拒绝研究工具
 * - Repeated Error Circuit Breaker：连续相同 fingerprint → fail fast
 * - 总 submit_investigator_evidence attempts <= 3；仍失败 → REPAIR_EXHAUSTED
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
    const effectiveSink = this.deps.persistentEventSink
      ? composeToolEventSinks(eventSink, this.deps.persistentEventSink)
      : eventSink;
    const gateway = new EvidenceRepairGateway(registry, effectiveSink);

    // STEP 20.1：Canonical Evidence Contract（Prompt 枚举投影的 SSoT）。
    let contract: CanonicalEvidenceContract | undefined;
    try {
      contract = await loadCanonicalEvidenceContract(identity);
    } catch {
      // contract 加载失败不阻断运行：validator 仍会兜底拒绝非法枚举，
      // 只是 Prompt 没有枚举投影（fail-closed 的缺口由 validator 覆盖）。
    }

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

    const promptOptions: EvidencePromptOptionsBase = {
      regionCode: packet.regionCode ?? "",
      agentSessionId,
      primary1: primaryDecisions.primary1,
      primary2: primaryDecisions.primary2,
      institutionId: packet.institutionId,
    };
    // exactOptionalPropertyTypes：contract 存在才作为属性传入。
    if (contract) {
      (promptOptions as { contract?: CanonicalEvidenceContract }).contract = contract;
    }

    // ---- STEP 20.1：阶段化提交闭环 ----
    const phase = new EvidenceSubmissionPhaseTracker(eventSink, identity);

    const promptText = buildEvidenceRolePrompt(packet, promptOptions);
    await this.prompt(session, promptText);

    if (!(await sink.isFrozen())) {
      // Finalize steering：一次短提示要求提交。
      const finalizeText = buildEvidenceFinalizePrompt(packet, promptOptions);
      await this.prompt(session, finalizeText);
    }

    // Repair 循环：观测 submit 失败并施加预算 / 熔断。
    if (!(await sink.isFrozen())) {
      const outcome = await this.runRepairLoop(session, gateway, phase, agentSessionId);
      if (outcome !== "FROZEN") {
        const toolCalls = summarizeEvidenceToolCalls(eventSink, false);
        const failureCode =
          outcome === "BREAKER"
            ? "EVIDENCE_REPEATED_SCHEMA_ERROR"
            : outcome === "EXHAUSTED"
              ? "EVIDENCE_SCHEMA_REPAIR_EXHAUSTED"
              : outcome === "TOOL_NOT_CALLED"
                ? "EVIDENCE_TOOL_NOT_CALLED"
                : "EVIDENCE_NOT_SUBMITTED";
        return this.fail(request.packetId, failureCode, agentSessionId, toolCalls, phase.report());
      }
    }

    const frozen = await sink.isFrozen();
    const toolCalls = summarizeEvidenceToolCalls(eventSink, frozen);
    if (!frozen) {
      return this.fail(
        request.packetId,
        "EVIDENCE_NOT_SUBMITTED",
        agentSessionId,
        toolCalls,
        phase.report(),
      );
    }

    const submission = await sink.getSubmission();
    if (!submission) {
      return this.fail(
        request.packetId,
        "EVIDENCE_NOT_SUBMITTED",
        agentSessionId,
        toolCalls,
        phase.report(),
      );
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
        phase.report(),
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
      repair: phase.report(),
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

  private async prompt(
    session: { prompt: (text: string) => Promise<void> },
    text: string,
  ): Promise<void> {
    if (this.deps.abortSignal) {
      const onAbort = () => {
        void (session as { abort?: () => void }).abort?.();
      };
      this.deps.abortSignal.addEventListener("abort", onAbort, { once: true });
      try {
        await session.prompt(text);
      } catch (error) {
        if (!this.deps.abortSignal.aborted) throw error;
      } finally {
        this.deps.abortSignal.removeEventListener("abort", onAbort);
      }
    } else {
      await session.prompt(text);
    }
  }

  /**
   * STEP 20.1 — Evidence Repair Loop。
   *
   * 观测 submit_investigator_evidence 的 schema 失败；若 Agent 未在单次 prompt
   * 内自修复，至多进行 EVIDENCE_SCHEMA_REPAIR_MAX_ATTEMPTS 次 Repair steering
   * （携带结构化 allowed_values）。连续相同 fingerprint → breaker。总 attempts
   * 超过 SUBMIT_EVIDENCE_MAX_ATTEMPTS → exhausted。
   */
  private async runRepairLoop(
    session: { prompt: (text: string) => Promise<void> },
    gateway: EvidenceRepairGateway,
    phase: EvidenceSubmissionPhaseTracker,
    agentSessionId: string,
  ): Promise<"FROZEN" | "BREAKER" | "EXHAUSTED" | "TOOL_NOT_CALLED" | "NOT_SUBMITTED"> {
    const sink = this.deps.sink ?? new InMemoryInvestigatorEvidenceSubmissionSink();
    let repairCount = 0;
    let lastFingerprint: string | undefined;

    for (let attempt = 0; attempt < SUBMIT_EVIDENCE_MAX_ATTEMPTS; attempt += 1) {
      const current = phase.schemaFailures();
      if (current.length === 0) {
        // 无 schema 失败但未提交：Agent 从未调用 submit（或已修好但未提交）。
        return (await sink.isFrozen()) ? "FROZEN" : "NOT_SUBMITTED";
      }

      // Repeated Error Circuit Breaker：连续相同 fingerprint → STOP。
      const fingerprint = phase.fingerprint();
      if (fingerprint !== undefined && fingerprint === lastFingerprint) {
        phase.markBreakerTriggered();
        return "BREAKER";
      }
      lastFingerprint = fingerprint;

      if (repairCount >= EVIDENCE_SCHEMA_REPAIR_MAX_ATTEMPTS) {
        return "EXHAUSTED";
      }

      // 进入 Repair Mode：拒绝研究工具。
      gateway.setRepairMode(true);
      const repairText = buildEvidenceRepairPrompt(current, agentSessionId);
      await this.prompt(session, repairText);
      repairCount += 1;

      if (await sink.isFrozen()) return "FROZEN";
    }

    return (await sink.isFrozen()) ? "FROZEN" : "EXHAUSTED";
  }

  private fail(
    packetId: string,
    failureCode:
      | "EVIDENCE_NOT_SUBMITTED"
      | "POSITION_CANDIDATE_OBSERVATION_REQUIRED"
      | "EVIDENCE_SCHEMA_REPAIR_EXHAUSTED"
      | "EVIDENCE_REPEATED_SCHEMA_ERROR"
      | "EVIDENCE_TOOL_NOT_CALLED",
    agentSessionId: string,
    toolCalls: EvidenceToolCallSummary[],
    repair?: EvidenceRepairReport,
  ): InvestigatorEvidenceResult {
    // A failed packet is retained (FAILED + failureCode) for a later
    // Recovery/Retry phase; it is never deleted.
    const packet = this.deps.packetStore.updateState(packetId, "FAILED", { failureCode });
    return {
      status: "FAILED",
      packetId,
      packet,
      failureCode,
      agentSessionId,
      toolCalls,
      ...(repair ? { repair } : {}),
    };
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

/** STEP 20.1：从 Skill 加载 Canonical Evidence Contract（url-candidate-pool
 *  + target-claim schema）。 */
async function loadCanonicalEvidenceContract(
  identity: SkillIdentity,
): Promise<CanonicalEvidenceContract> {
  const { SkillSchemaRegistry } = await import("../skill/skill-schema-registry.js");
  const path = await import("node:path");
  const registry = await SkillSchemaRegistry.load(path.join(identity.path, "schemas"));
  const findSchema = (title: string, suffix: string) => {
    const byTitle = registry.get(title);
    if (byTitle) return byTitle;
    const byPath = registry
      .list()
      .map((name) => registry.get(name))
      .find((schema) => schema?.filePath.endsWith(suffix));
    if (!byPath) {
      throw new InvestigatorEvidenceRuntimeError(`Schema not found: ${title}`);
    }
    return byPath;
  };
  const pool = findSchema("URL Candidate Pool Row", "url-candidate-pool.schema.json");
  const claim = findSchema("Target-level Evidence Claim", "target-claim.schema.json");
  return new CanonicalEvidenceContract(pool, claim);
}
