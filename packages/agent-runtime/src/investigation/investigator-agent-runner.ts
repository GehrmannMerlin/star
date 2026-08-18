import { createHash } from "node:crypto";
import { createAgentSession } from "@earendil-works/pi-coding-agent";
import {
  composeToolEventSinks,
  createAgentToolRegistry,
  createSubmitInvestigationTool,
  MemoryToolEventSink,
  ToolGateway,
  type InvestigationSubmissionSink,
  type InvestigationSubmissionValidator,
  type ToolEventSink,
} from "@stellaris/agent-tools";
import { ModelPolicy } from "../model/model-policy.js";
import { PiModelResolver } from "../model/pi-model-resolver.js";
import { AgentSessionFactory } from "../session/session-factory.js";
import { OFFICIAL_BIOGRAPHY_SKILL_NAME, SkillRuntime } from "../skill/skill-runtime.js";
import type { SkillIdentity } from "../skill/skill-identity.js";
import type { InMemoryInstitutionWorkPacketStore } from "../work-packet/institution-work-packet.js";
import { InMemoryInvestigationSubmissionSink } from "./investigation-submission-sink.js";
import { createSkillInvestigationValidator } from "./skill-investigation-validator.js";
import { buildInvestigationRolePrompt } from "./investigation-role-prompt.js";
import type {
  InvestigationAgentRequest,
  InvestigationAgentResult,
  InvestigationObservationGate,
  InvestigationToolCallSummary,
} from "./investigation-types.js";
import { InvestigationRuntimeError } from "./investigation-types.js";

const INVESTIGATION_TOOL_NAMES = [
  "get_region_context",
  "search_web",
  "fetch_page",
  "render_page",
  "inspect_page",
  "submit_investigation",
];

export type InvestigatorAgentRunnerDeps = {
  skillRuntime: SkillRuntime;
  packetStore: InMemoryInstitutionWorkPacketStore;
  /** Provider-neutral model wiring. Defaults are server-configured. */
  modelPolicy?: ModelPolicy;
  modelResolver?: PiModelResolver;
  /** Override for tests: intercept the options passed to Pi. */
  createSession?: typeof createAgentSession;
  /** Override for tests: pre-built sink (in-memory default). */
  sink?: InvestigationSubmissionSink;
  /** Override for tests: pre-built validator (Skill-schema default). */
  validator?: InvestigationSubmissionValidator;
  /** Override for tests/observability: tool event sink (in-memory default). */
  eventSink?: MemoryToolEventSink;
  /** STEP 19.3：可选持久化 ToolEvent sink（Agent provenance 落库；gate 仍用内存 sink）。 */
  persistentEventSink?: ToolEventSink;
  /** Dev-smoke-only budget: abort the Pi session on this signal. NEVER part of the business request. */
  abortSignal?: AbortSignal;
};

/**
 * Runs one Investigator Agent pass for exactly one Institution Work Packet.
 *
 * The runner owns the wiring: SkillSchemaRegistry validator + in-memory sink ->
 * investigation registry (base tools + submit_investigation) -> ToolGateway ->
 * AgentSessionFactory (INVESTIGATOR role) -> Pi session.prompt -> Observation
 * Gate + freeze check. The packet starts PENDING and may end READY_FOR_REVIEW
 * (Investigator phase done) or FAILED (no submit / observation gate). No
 * provider, no API key, no model id, no PRIMARY rule is hardcoded here.
 */
export class InvestigatorAgentRunner {
  constructor(private readonly deps: InvestigatorAgentRunnerDeps) {}

  async run(request: InvestigationAgentRequest): Promise<InvestigationAgentResult> {
    const packet = this.deps.packetStore.get(request.packetId);
    if (!packet) return { status: "PACKET_NOT_FOUND", packetId: request.packetId };
    if (packet.state !== "PENDING") {
      return { status: "PACKET_ALREADY_STARTED", packetId: request.packetId };
    }

    await this.deps.skillRuntime.reload();
    let identity: SkillIdentity;
    try {
      identity = await this.deps.skillRuntime.resolveSkill(OFFICIAL_BIOGRAPHY_SKILL_NAME);
    } catch (error) {
      throw new InvestigationRuntimeError(
        `Investigator skill unavailable: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    const validator = this.deps.validator ?? (await createSkillInvestigationValidator(identity));
    const sink = this.deps.sink ?? new InMemoryInvestigationSubmissionSink();
    const eventSink = this.deps.eventSink ?? new MemoryToolEventSink();
    const registry = createAgentToolRegistry({
      submitInvestigationTool: createSubmitInvestigationTool({ validator, sink }),
    });
    const gateway = new ToolGateway(
      registry,
      this.deps.persistentEventSink ? composeToolEventSinks(eventSink, this.deps.persistentEventSink) : eventSink,
    );

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
    const created = await factory.createAgentSession("INVESTIGATOR", {
      taskRunId: `investigate-${request.packetId}-${Date.now()}`,
    });
    if (created.status !== "READY") {
      return { status: "MODEL_NOT_CONFIGURED" };
    }
    const { session, agentSessionId } = created;

    // Claim the packet only after the session is ready. A non-PENDING packet
    // never reaches this point, so two Investigator sessions on one packet are
    // impossible (fail closed on duplicate start).
    this.deps.packetStore.updateState(request.packetId, "INVESTIGATING", {
      investigatorSessionId: agentSessionId,
    });

    const promptText = buildInvestigationRolePrompt(packet, {
      regionCode: packet.regionCode ?? "",
      agentSessionId,
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
    const toolCalls = summarizeToolCalls(eventSink, frozen);
    if (!frozen) {
      return this.fail(request.packetId, "INVESTIGATION_NOT_SUBMITTED", agentSessionId, toolCalls);
    }

    // Runtime Observation Gate: search snippets alone never count. The packet
    // may reach READY_FOR_REVIEW only with real fetch/render + inspect success.
    const observationGate = evaluateObservationGate(eventSink);
    if (!observationGate.passed) {
      return this.fail(
        request.packetId,
        "INVESTIGATION_OBSERVATION_REQUIRED",
        agentSessionId,
        toolCalls,
      );
    }

    const submission = await sink.getSubmission();
    if (!submission) {
      return this.fail(request.packetId, "INVESTIGATION_NOT_SUBMITTED", agentSessionId, toolCalls);
    }

    // Investigator phase done: Evidence (position URL candidates) still follows,
    // so READY_FOR_REVIEW is only reached after the Evidence phase.
    const completedPacket = this.deps.packetStore.updateState(request.packetId, "EVIDENCE_PENDING");
    return {
      status: "COMPLETED",
      packetId: request.packetId,
      packet: completedPacket,
      leadership: submission.leadership,
      selectedOfficials: submission.selectedOfficials,
      frozen: true,
      agentSessionId,
      skill: { name: identity.name, version: identity.version },
      model: { provider: resolved.provider, model: resolved.model },
      toolCalls,
      observationGate,
      receipt: {
        frozen: true,
        leadershipValidated: true,
        selectedOfficialsValidated: true,
        primary1: primaryName(submission.selectedOfficials, "PRIMARY_1"),
        primary2: primaryName(submission.selectedOfficials, "PRIMARY_2"),
        primaryPeopleDistinct: true,
        payloadHash: createHash("sha256").update(JSON.stringify(submission)).digest("hex"),
      },
    };
  }

  private fail(
    packetId: string,
    failureCode: "INVESTIGATION_NOT_SUBMITTED" | "INVESTIGATION_OBSERVATION_REQUIRED",
    agentSessionId: string,
    toolCalls: InvestigationToolCallSummary[],
  ): InvestigationAgentResult {
    // A failed packet is retained (FAILED + failureCode) for a later
    // Recovery/Retry phase; it is never deleted.
    const packet = this.deps.packetStore.updateState(packetId, "FAILED", { failureCode });
    return { status: "FAILED", packetId, packet, failureCode, agentSessionId, toolCalls };
  }
}

function summarizeToolCalls(
  eventSink: MemoryToolEventSink,
  investigationFrozen: boolean,
): InvestigationToolCallSummary[] {
  return INVESTIGATION_TOOL_NAMES.map((toolName) => {
    // The sink is only reachable through the submit_investigation tool, so a
    // frozen submission implies the tool was called and succeeded (true for
    // the real Pi flow, and when a test populates the sink directly).
    if (toolName === "submit_investigation" && investigationFrozen) {
      return { toolName, called: true, succeeded: true };
    }
    return {
      toolName,
      called: eventSink.starts.some((event) => event.toolName === toolName),
      succeeded: eventSink.successes.some((event) => event.toolName === toolName),
    };
  });
}

function evaluateObservationGate(eventSink: MemoryToolEventSink): InvestigationObservationGate {
  const fetchOrRenderSucceeded = eventSink.successes.some(
    (event) => event.toolName === "fetch_page" || event.toolName === "render_page",
  );
  const inspectSucceeded = eventSink.successes.some((event) => event.toolName === "inspect_page");
  return {
    fetchOrRenderSucceeded,
    inspectSucceeded,
    passed: fetchOrRenderSucceeded && inspectSucceeded,
  };
}

function primaryName(
  officials: Array<Record<string, unknown>>,
  slot: string,
): string | null {
  const found = officials.find((record) => record.primary_slot === slot);
  return found && typeof found.person_name === "string" ? found.person_name : null;
}
