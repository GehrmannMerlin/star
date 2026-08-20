import { createHash } from "node:crypto";
import { createAgentSession } from "@earendil-works/pi-coding-agent";
import {
  composeToolEventSinks,
  createAgentToolRegistry,
  createSubmitInvestigationTool,
  MemoryToolEventSink,
  ToolFailureCode,
  ToolGateway,
  type InvestigationSubmissionSink,
  type InvestigationSubmissionValidator,
  type ToolEventSink,
  type ToolFailure,
  type ToolInvocationContext,
  type ToolRegistry,
  type ToolResult,
  type ValidationIssue,
} from "@stellaris/agent-tools";
import { ModelPolicy } from "../model/model-policy.js";
import { PiModelResolver } from "../model/pi-model-resolver.js";
import { AgentSessionFactory } from "../session/session-factory.js";
import { OFFICIAL_BIOGRAPHY_SKILL_NAME, SkillRuntime } from "../skill/skill-runtime.js";
import type { SkillIdentity } from "../skill/skill-identity.js";
import type { InMemoryInstitutionWorkPacketStore } from "../work-packet/institution-work-packet.js";
import { InMemoryInvestigationSubmissionSink } from "./investigation-submission-sink.js";
import { createSkillInvestigationValidator } from "./skill-investigation-validator.js";
import {
  buildInvestigationRolePrompt,
  buildInvestigationFinalizePrompt,
  buildInvestigationRepairPrompt,
} from "./investigation-role-prompt.js";
import { CanonicalSubmissionContract } from "./canonical-submission-contract.js";
import type {
  InvestigationAgentRequest,
  InvestigationAgentResult,
  InvestigationObservationGate,
  InvestigationRepairReport,
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
] as const;

/** STEP 19.4 硬约束：总提交次数 / 修复次数上限（不可通过配置扩大）。 */
export const SUBMIT_INVESTIGATION_MAX_ATTEMPTS = 3;
export const SCHEMA_REPAIR_MAX_ATTEMPTS = 2;

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
 * STEP 19.4 — Submission Repair Mode Tool Policy。
 *
 * 包装底层 ToolGateway：当 Investigator 进入 Submission Repair 阶段后，
 * 研究工具（search_web / fetch_page / render_page / inspect_page /
 * get_region_context）被拒绝并返回 RESEARCH_TOOL_NOT_ALLOWED_DURING_SUBMISSION_REPAIR；
 * submit_investigation 始终放行。
 */
export class SubmissionRepairGateway extends ToolGateway {
  private repairMode = false;
  private readonly repairEventSink: ToolEventSink;

  constructor(registry: ToolRegistry, eventSink: ToolEventSink) {
    super(registry, eventSink);
    this.repairEventSink = eventSink;
  }

  setRepairMode(on: boolean): void {
    this.repairMode = on;
  }

  isRepairMode(): boolean {
    return this.repairMode;
  }

  override async execute(
    toolName: string,
    input: unknown,
    context: ToolInvocationContext,
  ): Promise<ToolResult> {
    if (this.repairMode && toolName !== "submit_investigation") {
      const startedAt = new Date().toISOString();
      const callId = `repair-blocked-${Date.now()}-${context.agentSessionId}`;
      const failure: ToolFailure = {
        code: ToolFailureCode.RESEARCH_TOOL_NOT_ALLOWED_DURING_SUBMISSION_REPAIR,
        message:
          "调查已进入提交修复阶段：禁止调用 search_web / fetch_page / render_page / inspect_page / get_region_context。请直接调用 submit_investigation 提交（修正）结构化结果。",
        retryable: false,
      };
      await this.repairEventSink.onStart({ callId, toolName, context, startedAt });
      await this.repairEventSink.onFailure({
        callId,
        toolName,
        status: "FAILED",
        failure,
        startedAt,
        finishedAt: new Date().toISOString(),
      });
      return {
        callId,
        toolName,
        status: "FAILED",
        failure,
        startedAt,
        finishedAt: new Date().toISOString(),
      };
    }
    return super.execute(toolName, input, context);
  }
}

/** STEP 19.4 修复指标（Completion Gate 观测）。 */
// InvestigationRepairReport 定义在 investigation-types.ts（index.ts 已导出该模块）。

/**
 * Runs one Investigator Agent pass for exactly one Institution Work Packet.
 *
 * STEP 19.4 闭环：
 * - 单次完整调查 prompt（INVESTIGATING）
 * - 若未提交 → 一次短 Finalize steering（FINALIZING）
 * - 若仍有 Schema 失败 → 至多 2 次 Repair steering（SUBMISSION_REPAIR），
 *   每次携带结构化 allowed_values 反馈；Repair 阶段拒绝研究工具
 * - Repeated Error Circuit Breaker：连续相同 fingerprint → fail fast
 * - 总 submit_investigation attempts <= 3；仍失败 → REPAIR_EXHAUSTED
 *
 * The packet starts PENDING and may end READY_FOR_REVIEW (Investigator phase
 * done) or FAILED. No provider, no API key, no model id, no PRIMARY rule is
 * hardcoded here.
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
    const effectiveSink = this.deps.persistentEventSink
      ? composeToolEventSinks(eventSink, this.deps.persistentEventSink)
      : eventSink;
    const gateway = new SubmissionRepairGateway(registry, effectiveSink);

    // STEP 19.4：Canonical Submission Contract（Prompt 枚举投影的 SSoT）。
    let contract: CanonicalSubmissionContract | undefined;
    try {
      contract = await loadCanonicalSubmissionContract(identity);
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
    const created = await factory.createAgentSession("INVESTIGATOR", {
      taskRunId: `investigate-${request.packetId}-${Date.now()}`,
    });
    if (created.status !== "READY") {
      return { status: "MODEL_NOT_CONFIGURED" };
    }
    const { session, agentSessionId } = created;

    this.deps.packetStore.updateState(request.packetId, "INVESTIGATING", {
      investigatorSessionId: agentSessionId,
    });

    // ---- STEP 19.4：阶段化提交闭环 ----
    const phase = new SubmissionPhaseTracker(eventSink, identity);

    // Phase 1: INVESTIGATING — 完整调查。
    const promptText = buildInvestigationRolePrompt(packet, {
      regionCode: packet.regionCode ?? "",
      agentSessionId,
      contract,
    });
    await this.prompt(session, promptText);

    let repair = phase.report();
    if (!(await sink.isFrozen())) {
      // Phase 2: FINALIZING — 一次短 steering。
      const finalizeText = buildInvestigationFinalizePrompt(packet, {
        regionCode: packet.regionCode ?? "",
        agentSessionId,
        contract,
      });
      await this.prompt(session, finalizeText);
    }

    // Repair 循环：观测 submit 失败并施加预算 / 熔断。
    if (!(await sink.isFrozen())) {
      const outcome = await this.runRepairLoop(session, gateway, phase, agentSessionId);
      if (outcome !== "FROZEN") {
        const toolCalls = summarizeToolCalls(eventSink, false);
        const failureCode =
          outcome === "BREAKER"
            ? "INVESTIGATION_REPEATED_SCHEMA_ERROR"
            : outcome === "EXHAUSTED"
              ? "INVESTIGATION_SCHEMA_REPAIR_EXHAUSTED"
              : outcome === "TOOL_NOT_CALLED"
                ? "INVESTIGATION_TOOL_NOT_CALLED"
                : "INVESTIGATION_NOT_SUBMITTED";
        return this.fail(request.packetId, failureCode, agentSessionId, toolCalls, phase.report());
      }
    }

    const frozen = await sink.isFrozen();
    const toolCalls = summarizeToolCalls(eventSink, frozen);
    if (!frozen) {
      return this.fail(
        request.packetId,
        "INVESTIGATION_NOT_SUBMITTED",
        agentSessionId,
        toolCalls,
        phase.report(),
      );
    }

    // Runtime Observation Gate: search snippets alone never count.
    const observationGate = evaluateObservationGate(eventSink);
    if (!observationGate.passed) {
      return this.fail(
        request.packetId,
        "INVESTIGATION_OBSERVATION_REQUIRED",
        agentSessionId,
        toolCalls,
        phase.report(),
      );
    }

    const submission = await sink.getSubmission();
    if (!submission) {
      return this.fail(
        request.packetId,
        "INVESTIGATION_NOT_SUBMITTED",
        agentSessionId,
        toolCalls,
        phase.report(),
      );
    }

    repair = phase.report();
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
      repair,
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
   * STEP 19.4 — Repair Loop。
   *
   * 观测 submit_investigation 的 schema 失败；若 Agent 未在单次 prompt 内
   * 自修复，至多进行 SCHEMA_REPAIR_MAX_ATTEMPTS 次 Repair steering（携带
   * 结构化 allowed_values）。连续相同 fingerprint → breaker。总 attempts
   * 超过 SUBMIT_INVESTIGATION_MAX_ATTEMPTS → exhausted。
   */
  private async runRepairLoop(
    session: { prompt: (text: string) => Promise<void> },
    gateway: SubmissionRepairGateway,
    phase: SubmissionPhaseTracker,
    agentSessionId: string,
  ): Promise<"FROZEN" | "BREAKER" | "EXHAUSTED" | "TOOL_NOT_CALLED" | "NOT_SUBMITTED"> {
    const sink = this.deps.sink ?? new InMemoryInvestigationSubmissionSink();
    let repairCount = 0;
    let lastFingerprint: string | undefined;

    for (let attempt = 0; attempt < SUBMIT_INVESTIGATION_MAX_ATTEMPTS; attempt += 1) {
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

      if (repairCount >= SCHEMA_REPAIR_MAX_ATTEMPTS) {
        return "EXHAUSTED";
      }

      // 进入 Repair Mode：拒绝研究工具。
      gateway.setRepairMode(true);
      const repairText = buildInvestigationRepairPrompt(current, agentSessionId);
      await this.prompt(session, repairText);
      repairCount += 1;

      if (await sink.isFrozen()) return "FROZEN";
    }

    return (await sink.isFrozen()) ? "FROZEN" : "EXHAUSTED";
  }

  private fail(
    packetId: string,
    failureCode:
      | "INVESTIGATION_NOT_SUBMITTED"
      | "INVESTIGATION_OBSERVATION_REQUIRED"
      | "INVESTIGATION_SCHEMA_REPAIR_EXHAUSTED"
      | "INVESTIGATION_REPEATED_SCHEMA_ERROR"
      | "INVESTIGATION_TOOL_NOT_CALLED",
    agentSessionId: string,
    toolCalls: InvestigationToolCallSummary[],
    repair?: InvestigationRepairReport,
  ): InvestigationAgentResult {
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

/**
 * 观测 submit_investigation 的 schema 失败并生成 repair 反馈。
 *
 * 数据来源：ToolEventSink 的 failure 事件（ToolGateway 记录 ToolFailedResult，
 * 其 failure.details 携带结构化 ValidationIssue[]，由 validator 解析生成，
 * 零正则）。fingerprint = hash(tool + instancePath + keyword + received +
 * schema identity)，用于连续相同错误熔断。
 */
export class SubmissionPhaseTracker {
  private breakerTriggered = false;

  constructor(
    private readonly eventSink: MemoryToolEventSink,
    private readonly identity: SkillIdentity,
  ) {}

  /** 从 eventSink 提取 submit_investigation 的 schema 失败 issue（结构化）。 */
  schemaFailures(): ValidationIssue[] {
    const failures = this.eventSink.failures.filter(
      (event) =>
        event.toolName === "submit_investigation" &&
        (event.failure.code === ToolFailureCode.INVESTIGATION_SCHEMA_VALIDATION_FAILED ||
          event.failure.code === ToolFailureCode.SCHEMA_VALIDATION_FAILED),
    );
    const issues: ValidationIssue[] = [];
    for (const failure of failures) {
      if (Array.isArray(failure.failure.details)) {
        issues.push(...(failure.failure.details as ValidationIssue[]));
      }
    }
    return issues;
  }

  /** 最近一次 schema 失败的 fingerprint（用于熔断判断）。 */
  fingerprint(): string | undefined {
    const issues = this.schemaFailures();
    const last = issues[issues.length - 1];
    if (!last) return undefined;
    return this.makeFingerprint(last);
  }

  private makeFingerprint(issue: ValidationIssue): string {
    const base = JSON.stringify({
      tool: "submit_investigation",
      instancePath: issue.fieldPath,
      keyword: issue.validationKeyword,
      receivedValue: issue.receivedValue,
      schema: this.identity.name,
    });
    return createHash("sha256").update(base).digest("hex").slice(0, 16);
  }

  markBreakerTriggered(): void {
    this.breakerTriggered = true;
  }

  /** 修复指标（Completion Gate 观测）。 */
  report(): InvestigationRepairReport {
    const issues = this.schemaFailures();
    const submitStarts = this.eventSink.starts.filter(
      (event) => event.toolName === "submit_investigation",
    ).length;
    const researchCallsAfterFirstFailure = this.countResearchCallsAfterFirstSubmitFailure();
    return {
      submitAttempts: submitStarts,
      schemaValidationFailures: issues.length,
      repairAttempts: Math.min(issues.length, SCHEMA_REPAIR_MAX_ATTEMPTS),
      repeatedErrorBreakerTriggered: this.breakerTriggered,
      researchToolCallsAfterFirstSubmitFailure: researchCallsAfterFirstFailure,
    };
  }

  private countResearchCallsAfterFirstSubmitFailure(): number {
    const submitFailures = this.eventSink.failures.filter(
      (event) => event.toolName === "submit_investigation",
    );
    if (submitFailures.length === 0) return 0;
    const firstFailure = submitFailures[0];
    if (!firstFailure) return 0;
    const firstFailureStart = firstFailure.startedAt;
    return this.eventSink.starts.filter(
      (event) =>
        event.toolName !== "submit_investigation" &&
        event.startedAt > firstFailureStart,
    ).length;
  }
}

function summarizeToolCalls(
  eventSink: MemoryToolEventSink,
  investigationFrozen: boolean,
): InvestigationToolCallSummary[] {
  return INVESTIGATION_TOOL_NAMES.map((toolName) => {
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

/** STEP 19.4：从 Skill 加载 Canonical Submission Contract（person-decision
 *  + leadership-structure schema）。 */
async function loadCanonicalSubmissionContract(
  identity: SkillIdentity,
): Promise<CanonicalSubmissionContract> {
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
      throw new InvestigationRuntimeError(`Schema not found: ${title}`);
    }
    return byPath;
  };
  const leadership = findSchema("Leadership Structure", "leadership-structure.schema.json");
  const personDecision = findSchema("Person Decision", "person-decision.schema.json");
  return new CanonicalSubmissionContract(personDecision, leadership);
}
