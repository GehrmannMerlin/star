import {
  MemoryToolEventSink,
  type InvestigationSubmissionPayload,
  type InvestigatorEvidenceSubmissionSink,
  type RecoverySubmissionSink,
  type ReviewerDecisionSink,
} from "@stellaris/agent-tools";
import { InvestigatorEvidenceRunner } from "../evidence/investigator-evidence-runner.js";
import type { InvestigatorEvidenceResult } from "../evidence/evidence-types.js";
import { InvestigatorAgentRunner } from "../investigation/investigator-agent-runner.js";
import type { InvestigationAgentResult } from "../investigation/investigation-types.js";
import { ModelPolicy } from "../model/model-policy.js";
import { PiModelResolver } from "../model/pi-model-resolver.js";
import { CompositeCandidateViewRehydrator } from "../persistence/composite-candidate-rehydration.js";
import type { EvidenceReaderPort } from "../persistence/evidence-reader.js";
import type { PostgresEvidenceSinkIdentity } from "../persistence/postgres-investigator-evidence-sink.js";
import type {
  PostgresRecoverySinkIdentity,
  RecoverySubmissionRepositoryPort,
} from "../persistence/postgres-recovery-submission-sink.js";
import type {
  PostgresReviewSinkIdentity,
  ReviewDecisionSubmissionRepositoryPort,
} from "../persistence/postgres-review-decision-sink.js";
import { RecoveryRereviewCoordinator } from "../persistence/recovery-rereview-coordinator.js";
import { RecoveryAgentRunner } from "../recovery/recovery-agent-runner.js";
import type { RecoveryFrozenInput, RecoveryResult } from "../recovery/recovery-types.js";
import type {
  BiographyUrlResult,
  ReviewDecisionReaderPort,
} from "../results/biography-url-result.js";
import { BiographyUrlResultReader } from "../results/biography-url-result.js";
import { ReviewerAgentRunner } from "../reviewer/reviewer-agent-runner.js";
import type { ReviewerFrozenInput, ReviewerResult } from "../reviewer/reviewer-types.js";
import { extractReviewerPrimaryDecisions } from "../reviewer/reviewer-types.js";
import { SkillRuntime } from "../skill/skill-runtime.js";
import {
  InMemoryInstitutionWorkPacketStore,
  type InstitutionWorkPacket,
  type InstitutionWorkPacketState,
  type InstitutionWorkPacketStorePort,
  type PacketStateMeta,
  type PrimaryPersons,
} from "../work-packet/institution-work-packet.js";

/**
 * Region Batch Biography URL Orchestration — per-packet Workflow Executor（STEP 16）。
 *
 * 这是 MultiInstitutionBiographyCoordinator 缺失的「真实 per-packet Agent Workflow
 * Executor」层。对单个 InstitutionWorkPacket，机械编排已有阶段 Runner：
 *
 *   InvestigatorAgentRunner
 *   → InvestigatorEvidenceRunner
 *   → ReviewerAgentRunner（Round-1）
 *   → 若 REWORK_REQUIRED: RecoveryAgentRunner → RecoveryRereviewCoordinator（Round-2）
 *   → BiographyUrlResultReader（LATEST_FROZEN_APPROVED_REVIEW 唯一 SSoT）
 *
 * 严格边界：
 * - 本 Runner **不做任何业务语义决策**：不 search / fetch / inspect / 选人 / 选 PRIMARY /
 *   选 URL / Ranking / Review / Recovery 判定——全部由 Pi + Skill + 已有阶段 Runner 负责；
 * - 不复制任何已有 Agent / Runner；每 Packet 独立 Pi Session / 独立 InMemory store /
 *   独立 eventSink，两 Packet 不共享 Agent Conversation / SubmissionSink / ToolEvent 状态；
 * - Postgres 持久化 identity 按 packetId / reviewRound / recoveryRound 隔离；
 * - 无最终 URL 时 UNRESOLVED，绝不伪造 URL；
 * - 无地区-specific code、无 Multi Evidence、无任前公示等业务。
 */

export type WorkflowStageOutcome = {
  status: string;
  agentSessionId?: string;
  model?: { provider: string; model: string };
  toolCalls: Record<string, { called: boolean; succeeded: boolean }>;
  bochaCalled: boolean;
};

export type InstitutionBiographyWorkflowResult = {
  packetId: string;
  institutionId: string;
  institutionName: string;
  /** RESOLVED | PARTIAL | UNRESOLVED | FAILED（最终 URL 投影状态）。 */
  status: "RESOLVED" | "PARTIAL" | "UNRESOLVED" | "FAILED";
  packetState: InstitutionWorkPacketState;
  stages: {
    investigation: WorkflowStageOutcome;
    evidence: WorkflowStageOutcome;
    review: WorkflowStageOutcome & { reviewRound: number };
    recovery?: WorkflowStageOutcome & { recoveryRound: number };
    rereview?: WorkflowStageOutcome & { reviewRound: number };
  };
  /** 来自 BiographyUrlResultReader 的确定性投影；读取无需 Agent / LLM。 */
  biographyResult: BiographyUrlResult | null;
  failure?: { stage: string; code?: string; message?: string };
  durationMs: number;
};

/**
 * 每 Packet 的阶段 Runner 契约。默认真实（包装 4 个既有 Runner）；测试注入 Fake，
 * 只验证编排状态机 / 状态推进 / 结果聚合，不启动真实 Pi Session。
 */
export type WorkflowStageRunners = {
  runInvestigator(input: {
    packetId: string;
    store: InMemoryInstitutionWorkPacketStore;
    eventSink: MemoryToolEventSink;
  }): Promise<InvestigationAgentResult>;
  runEvidence(input: {
    packetId: string;
    store: InMemoryInstitutionWorkPacketStore;
    eventSink: MemoryToolEventSink;
    frozenInput: InvestigationSubmissionPayload;
    sink: InvestigatorEvidenceSubmissionSink;
  }): Promise<InvestigatorEvidenceResult>;
  runReviewer(input: {
    packetId: string;
    store: InMemoryInstitutionWorkPacketStore;
    eventSink: MemoryToolEventSink;
    frozenInput: ReviewerFrozenInput;
    sink: ReviewerDecisionSink;
  }): Promise<ReviewerResult>;
  runRecovery(input: {
    packetId: string;
    store: InMemoryInstitutionWorkPacketStore;
    eventSink: MemoryToolEventSink;
    frozenInput: RecoveryFrozenInput;
    sink: RecoverySubmissionSink;
  }): Promise<RecoveryResult>;
};

export type InstitutionBiographyWorkflowPersistence = {
  /** Postgres（真实 batch）或 FakeRepo-backed（测试）异步 packet store。 */
  packetStore: InstitutionWorkPacketStorePort;
  createEvidenceSink: (identity: PostgresEvidenceSinkIdentity) => InvestigatorEvidenceSubmissionSink;
  createReviewSink: (identity: PostgresReviewSinkIdentity) => ReviewerDecisionSink;
  createRecoverySink: (identity: PostgresRecoverySinkIdentity) => RecoverySubmissionSink;
  evidenceReader: EvidenceReaderPort;
  reviewReader: ReviewDecisionReaderPort;
  /** 供 CompositeCandidateViewRehydrator 使用（持久化 Review 历史读取）。 */
  reviewRepo: ReviewDecisionSubmissionRepositoryPort;
  /** 供 CompositeCandidateViewRehydrator 使用（持久化 Recovery Supplement 读取）。 */
  recoveryRepo: RecoverySubmissionRepositoryPort;
};

export type InstitutionBiographyWorkflowRunnerDeps = {
  skillRuntime: SkillRuntime;
  /** Provider-neutral model wiring；缺省 = 服务器配置。 */
  modelPolicy?: ModelPolicy;
  modelResolver?: PiModelResolver;
  /** Dev-smoke-only budget；业务 Request 永不携带。 */
  abortSignal?: AbortSignal;
  /** 已解析的 official-biography-evidence identity（sink 标注用）。 */
  skill: { name: string; version: string };
  persistence: InstitutionBiographyWorkflowPersistence;
  /** 测试 seam：覆盖默认真实阶段 Runner。 */
  stages?: WorkflowStageRunners;
};

/** 极薄的 per-packet orchestration contract（STEP 16 目标接口）。 */
export interface InstitutionBiographyWorkflowPort {
  run(packet: InstitutionWorkPacket): Promise<InstitutionBiographyWorkflowResult>;
}

export function skippedStageOutcome(): WorkflowStageOutcome {
  return { status: "SKIPPED", toolCalls: {}, bochaCalled: false };
}

function summarizeToolCalls(
  eventSink: MemoryToolEventSink,
): Record<string, { called: boolean; succeeded: boolean }> {
  const names = new Set<string>();
  for (const event of eventSink.starts) names.add(event.toolName);
  for (const event of eventSink.successes) names.add(event.toolName);
  const summary: Record<string, { called: boolean; succeeded: boolean }> = {};
  for (const name of names) {
    summary[name] = {
      called: eventSink.starts.some((event) => event.toolName === name),
      succeeded: eventSink.successes.some((event) => event.toolName === name),
    };
  }
  return summary;
}

function bochaCalled(eventSink: MemoryToolEventSink): boolean {
  return eventSink.successes.some(
    (event) =>
      event.toolName === "search_web" &&
      (event.data as { provider?: string } | undefined)?.provider === "bocha",
  );
}

function stageAgentSessionId(result: { status: string; agentSessionId?: string }): string | undefined {
  if (result.status === "COMPLETED" || result.status === "FAILED" || result.status === "RECOVERY_REQUIRED") {
    return result.agentSessionId;
  }
  return undefined;
}

function stageAgentModel(result: { status: string; model?: unknown }): {
  provider: string;
  model: string;
} | undefined {
  if (result.status !== "COMPLETED" && result.status !== "RECOVERY_REQUIRED") return undefined;
  const model = result.model;
  if (!model || typeof model !== "object") return undefined;
  const entry = model as { provider?: unknown; model?: unknown };
  if (typeof entry.provider !== "string" || typeof entry.model !== "string") return undefined;
  return { provider: entry.provider, model: entry.model };
}

function statusDetail(result: { status: string; reason?: string; failureDetail?: string }): string {
  if (result.reason) return result.reason;
  if (result.failureDetail) return result.failureDetail;
  return result.status;
}

/** 从 frozen person decisions 提取两个 PRIMARY 人员身份（无则返回 null，不伪造）。 */
function toPrimaryPersons(
  selectedOfficials: Array<Record<string, unknown>>,
): PrimaryPersons | null {
  const pair = extractReviewerPrimaryDecisions(selectedOfficials);
  if (!pair) return null;
  return {
    primary1: {
      targetId: pair.primary1.targetId,
      personId: pair.primary1.personId,
      personName: pair.primary1.personName,
    },
    primary2: {
      targetId: pair.primary2.targetId,
      personId: pair.primary2.personId,
      personName: pair.primary2.personName,
    },
  };
}

/** 最小 secret 脱敏（与其它 smoke 一致；失败 message 不允许携带凭据）。 */
function redactSecrets(text: string): string {
  return text
    .replace(/authorization\s*:\s*[^\r\n]+/gi, "authorization: ***")
    .replace(/\bsk-[A-Za-z0-9_-]{8,}\b/g, "sk-***");
}

/** 默认真实阶段 Runner：包装 4 个既有 Runner，每 Packet 每次调用各建新实例（session 隔离）。 */
async function buildRealStageRunners(
  deps: InstitutionBiographyWorkflowRunnerDeps,
): Promise<WorkflowStageRunners> {
  const modelPolicy = deps.modelPolicy ?? new ModelPolicy();
  const modelResolver = deps.modelResolver ?? (await PiModelResolver.create());
  const abortSignal = deps.abortSignal;

  return {
    runInvestigator: async ({ packetId, store, eventSink }) => {
      const runner = new InvestigatorAgentRunner({
        skillRuntime: deps.skillRuntime,
        packetStore: store,
        modelPolicy,
        modelResolver,
        eventSink,
        ...(abortSignal ? { abortSignal } : {}),
      });
      return runner.run({ packetId });
    },
    runEvidence: async ({ packetId, store, eventSink, frozenInput, sink }) => {
      const runner = new InvestigatorEvidenceRunner({
        skillRuntime: deps.skillRuntime,
        packetStore: store,
        modelPolicy,
        modelResolver,
        eventSink,
        sink,
        ...(abortSignal ? { abortSignal } : {}),
      });
      return runner.run({ packetId, frozenInput });
    },
    runReviewer: async ({ packetId, store, eventSink, frozenInput, sink }) => {
      const runner = new ReviewerAgentRunner({
        skillRuntime: deps.skillRuntime,
        packetStore: store,
        modelPolicy,
        modelResolver,
        eventSink,
        sink,
        ...(abortSignal ? { abortSignal } : {}),
      });
      return runner.run({ packetId, frozenInput });
    },
    runRecovery: async ({ packetId, store, eventSink, frozenInput, sink }) => {
      const runner = new RecoveryAgentRunner({
        skillRuntime: deps.skillRuntime,
        packetStore: store,
        modelPolicy,
        modelResolver,
        eventSink,
        sink,
        ...(abortSignal ? { abortSignal } : {}),
      });
      return runner.run({ packetId, frozenInput });
    },
  };
}

/**
 * 真实 per-packet Agent Workflow Executor。
 *
 * 只按结构化 outcome 决定下一阶段；不做业务判断。每 Packet 独立 InMemory store（seed）/
 * 独立 eventSink / 独立 Pi Session；阶段结果机械 mirror 到 Postgres packet store。
 */
export class InstitutionBiographyWorkflowRunner implements InstitutionBiographyWorkflowPort {
  private readonly persistence: InstitutionBiographyWorkflowPersistence;
  private readonly rehydrator: CompositeCandidateViewRehydrator;
  private readonly resultReader: BiographyUrlResultReader;

  constructor(private readonly deps: InstitutionBiographyWorkflowRunnerDeps) {
    this.persistence = deps.persistence;
    this.rehydrator = new CompositeCandidateViewRehydrator({
      evidenceReader: deps.persistence.evidenceReader,
      recoveryRepo: deps.persistence.recoveryRepo,
      reviewRepo: deps.persistence.reviewRepo,
    });
    this.resultReader = new BiographyUrlResultReader({
      packetStore: deps.persistence.packetStore,
      reviewReader: deps.persistence.reviewReader,
      loadCandidatePool: async (packetId) =>
        (await this.rehydrator.rehydrate(packetId)).compositeCandidateView,
    });
  }

  async run(packet: InstitutionWorkPacket): Promise<InstitutionBiographyWorkflowResult> {
    const startedAt = Date.now();
    // 取消：Task-level signal 在阶段边界协作中止；正在进行的 Pi session 由 stage runner 的 session.abort() 中止。
    const signal = this.deps.abortSignal;
    const checkAbort = (): void => signal?.throwIfAborted();
    const store = new InMemoryInstitutionWorkPacketStore();
    store.seed(packet);
    const stages = this.deps.stages ?? (await buildRealStageRunners(this.deps));
    const stagesRecord: InstitutionBiographyWorkflowResult["stages"] = {
      investigation: skippedStageOutcome(),
      evidence: skippedStageOutcome(),
      review: { ...skippedStageOutcome(), reviewRound: 1 },
    };

    const fail = (
      failure: NonNullable<InstitutionBiographyWorkflowResult["failure"]>,
    ): InstitutionBiographyWorkflowResult =>
      this.buildResult(packet, "FAILED", packet.state, stagesRecord, null, failure, startedAt);

    try {
      // ── Investigator ──
      checkAbort();
      const investigationEventSink = new MemoryToolEventSink();
      const investigation = await stages.runInvestigator({
        packetId: packet.packetId,
        store,
        eventSink: investigationEventSink,
      });
      const investigationSessionId = stageAgentSessionId(investigation);
      const investigationModel = stageAgentModel(investigation);
      stagesRecord.investigation = {
        status: investigation.status,
        ...(investigationSessionId !== undefined
          ? { agentSessionId: investigationSessionId }
          : {}),
        ...(investigationModel !== undefined ? { model: investigationModel } : {}),
        toolCalls: summarizeToolCalls(investigationEventSink),
        bochaCalled: bochaCalled(investigationEventSink),
      };
      if (investigation.status !== "COMPLETED") {
        if (investigation.status === "FAILED") {
          await this.mirror(packet.packetId, [
            ["INVESTIGATING", { investigatorSessionId: investigation.agentSessionId }],
            ["FAILED", { failureCode: investigation.failureCode }],
          ]);
          return fail({
            stage: "investigation",
            code: investigation.failureCode,
            message: `investigation ${investigation.failureCode}`,
          });
        }
        return fail({
          stage: "investigation",
          code: investigation.status,
          message: statusDetail(investigation),
        });
      }
      const leadership = investigation.leadership;
      const selectedOfficials = investigation.selectedOfficials;
      await this.mirror(packet.packetId, [
        ["INVESTIGATING", { investigatorSessionId: investigation.agentSessionId }],
        ["EVIDENCE_PENDING"],
      ]);
      const primaryPersons = toPrimaryPersons(selectedOfficials);
      if (primaryPersons) {
        await this.persistence.packetStore.setPrimaryPersons(packet.packetId, primaryPersons);
        store.setPrimaryPersons(packet.packetId, primaryPersons);
      }

      // ── Evidence ──
      checkAbort();
      const evidenceEventSink = new MemoryToolEventSink();
      const evidence = await stages.runEvidence({
        packetId: packet.packetId,
        store,
        eventSink: evidenceEventSink,
        frozenInput: { leadership, selectedOfficials },
        sink: this.persistence.createEvidenceSink({
          packetId: packet.packetId,
          agentSessionId: `evidence-${packet.packetId}`,
          agentRole: "INVESTIGATOR",
          skill: this.deps.skill,
        }),
      });
      const evidenceSessionId = stageAgentSessionId(evidence);
      const evidenceModel = stageAgentModel(evidence);
      stagesRecord.evidence = {
        status: evidence.status,
        ...(evidenceSessionId !== undefined ? { agentSessionId: evidenceSessionId } : {}),
        ...(evidenceModel !== undefined ? { model: evidenceModel } : {}),
        toolCalls: summarizeToolCalls(evidenceEventSink),
        bochaCalled: bochaCalled(evidenceEventSink),
      };
      if (evidence.status !== "COMPLETED") {
        if (evidence.status === "FAILED") {
          await this.mirror(packet.packetId, [
            ["EVIDENCE_GATHERING", { investigatorSessionId: evidence.agentSessionId }],
            ["FAILED", { failureCode: evidence.failureCode }],
          ]);
          return fail({
            stage: "evidence",
            code: evidence.failureCode,
            message: `evidence ${evidence.failureCode}`,
          });
        }
        return fail({ stage: "evidence", code: evidence.status, message: statusDetail(evidence) });
      }
      const candidatePool = evidence.candidates;
      await this.mirror(packet.packetId, [
        ["EVIDENCE_GATHERING", { investigatorSessionId: evidence.agentSessionId }],
        ["READY_FOR_REVIEW"],
      ]);

      // ── Reviewer Round-1 ──
      checkAbort();
      const reviewEventSink = new MemoryToolEventSink();
      const reviewer = await stages.runReviewer({
        packetId: packet.packetId,
        store,
        eventSink: reviewEventSink,
        frozenInput: { leadership, selectedOfficials, candidatePool },
        sink: this.persistence.createReviewSink({
          packetId: packet.packetId,
          reviewRound: 1,
          agentRole: "REVIEWER",
          skill: this.deps.skill,
        }),
      });
      const reviewSessionId = stageAgentSessionId(reviewer);
      const reviewModel = stageAgentModel(reviewer);
      stagesRecord.review = {
        status: reviewer.status,
        ...(reviewSessionId !== undefined ? { agentSessionId: reviewSessionId } : {}),
        ...(reviewModel !== undefined ? { model: reviewModel } : {}),
        toolCalls: summarizeToolCalls(reviewEventSink),
        bochaCalled: bochaCalled(reviewEventSink),
        reviewRound: 1,
      };
      if (reviewer.status === "FAILED") {
        await this.mirror(packet.packetId, [
          ["REVIEWING", { investigatorSessionId: reviewer.agentSessionId }],
          ["FAILED", { failureCode: reviewer.failureCode }],
        ]);
        return fail({
          stage: "review",
          code: reviewer.failureCode,
          message: `review ${reviewer.failureCode}`,
        });
      }
      if (reviewer.status === "COMPLETED") {
        await this.mirror(packet.packetId, [
          ["REVIEWING", { investigatorSessionId: reviewer.agentSessionId }],
          ["POSITION_DECIDED"],
        ]);
        return this.finish(packet, stagesRecord, startedAt);
      }
      if (reviewer.status !== "RECOVERY_REQUIRED") {
        return fail({ stage: "review", code: reviewer.status, message: statusDetail(reviewer) });
      }
      await this.mirror(packet.packetId, [
        ["REVIEWING", { investigatorSessionId: reviewer.agentSessionId }],
        ["RECOVERY_REQUIRED"],
      ]);

      // ── Recovery ──
      checkAbort();
      const recoveryEventSink = new MemoryToolEventSink();
      const recovery = await stages.runRecovery({
        packetId: packet.packetId,
        store,
        eventSink: recoveryEventSink,
        frozenInput: { leadership, selectedOfficials, candidatePool, reviewRecords: reviewer.reviews },
        sink: this.persistence.createRecoverySink({
          packetId: packet.packetId,
          recoveryRound: 1,
          agentRole: "RECOVERY",
          skill: this.deps.skill,
        }),
      });
      const recoverySessionId = stageAgentSessionId(recovery);
      const recoveryModel = stageAgentModel(recovery);
      stagesRecord.recovery = {
        status: recovery.status,
        ...(recoverySessionId !== undefined ? { agentSessionId: recoverySessionId } : {}),
        ...(recoveryModel !== undefined ? { model: recoveryModel } : {}),
        toolCalls: summarizeToolCalls(recoveryEventSink),
        bochaCalled: bochaCalled(recoveryEventSink),
        recoveryRound: 1,
      };
      if (recovery.status !== "COMPLETED") {
        if (recovery.status === "FAILED") {
          await this.mirror(packet.packetId, [
            ["RECOVERING", { investigatorSessionId: recovery.agentSessionId }],
            ["FAILED", { failureCode: recovery.failureCode }],
          ]);
          return fail({
            stage: "recovery",
            code: recovery.failureCode,
            message: `recovery ${recovery.failureCode}`,
          });
        }
        return fail({ stage: "recovery", code: recovery.status, message: statusDetail(recovery) });
      }
      await this.mirror(packet.packetId, [
        ["RECOVERING", { investigatorSessionId: recovery.agentSessionId }],
        ["READY_FOR_REVIEW"],
      ]);

      // ── Re-review Round-2（复用 RecoveryRereviewCoordinator；不重写 review/recovery 循环）──
      checkAbort();
      const rereviewEventSink = new MemoryToolEventSink();
      const coordinator = new RecoveryRereviewCoordinator({
        rehydrator: this.rehydrator,
        frozenLeadership: leadership,
        frozenSelectedOfficials: selectedOfficials,
        createRoundTwoSink: (identity) => this.persistence.createReviewSink(identity),
        runReviewer: async ({ packetId, frozenInput, sink }) =>
          stages.runReviewer({ packetId, store, eventSink: rereviewEventSink, frozenInput, sink }),
      });
      const { reviewerResult } = await coordinator.run(packet.packetId, {
        agentRole: "REVIEWER",
        skill: this.deps.skill,
      });
      const rereviewSessionId = stageAgentSessionId(reviewerResult);
      const rereviewModel = stageAgentModel(reviewerResult);
      stagesRecord.rereview = {
        status: reviewerResult.status,
        ...(rereviewSessionId !== undefined ? { agentSessionId: rereviewSessionId } : {}),
        ...(rereviewModel !== undefined ? { model: rereviewModel } : {}),
        toolCalls: summarizeToolCalls(rereviewEventSink),
        bochaCalled: bochaCalled(rereviewEventSink),
        reviewRound: 2,
      };
      if (reviewerResult.status === "FAILED") {
        await this.mirror(packet.packetId, [
          ["REVIEWING", { investigatorSessionId: reviewerResult.agentSessionId }],
          ["FAILED", { failureCode: reviewerResult.failureCode }],
        ]);
        return fail({
          stage: "rereview",
          code: reviewerResult.failureCode,
          message: `rereview ${reviewerResult.failureCode}`,
        });
      }
      if (reviewerResult.status === "COMPLETED" || reviewerResult.status === "RECOVERY_REQUIRED") {
        // COMPLETED → POSITION_DECIDED；RECOVERY_REQUIRED → 停止（不无限 Recovery Loop）。
        const finalState =
          reviewerResult.status === "COMPLETED" ? "POSITION_DECIDED" : "RECOVERY_REQUIRED";
        await this.mirror(packet.packetId, [
          ["REVIEWING", { investigatorSessionId: reviewerResult.agentSessionId }],
          [finalState],
        ]);
        return this.finish(packet, stagesRecord, startedAt);
      }
      return fail({
        stage: "rereview",
        code: reviewerResult.status,
        message: statusDetail(reviewerResult),
      });
    } catch (error) {
      // 取消：control-flow cancellation 向上传播（不作为 workflow FAILED 吞掉）。
      if (signal?.aborted) throw error;
      return fail({
        stage: "workflow",
        message: redactSecrets(error instanceof Error ? error.message : String(error)),
      });
    }
  }

  /** 机械推进 Postgres packet 状态链（每步都是合法 ALLOWED_TRANSITIONS）。 */
  private async mirror(
    packetId: string,
    steps: Array<[InstitutionWorkPacketState, PacketStateMeta?]>,
  ): Promise<void> {
    for (const [to, meta] of steps) {
      await this.persistence.packetStore.updateState(packetId, to, meta);
    }
  }

  /** 收尾：从 Latest Frozen APPROVED Review 纯确定性投影最终 Result（无需 LLM）。 */
  private async finish(
    packet: InstitutionWorkPacket,
    stagesRecord: InstitutionBiographyWorkflowResult["stages"],
    startedAt: number,
  ): Promise<InstitutionBiographyWorkflowResult> {
    const biography = await this.resultReader.read(packet.packetId);
    const packetState =
      (await this.persistence.packetStore.get(packet.packetId))?.state ?? packet.state;
    return this.buildResult(
      packet,
      biography?.status ?? "UNRESOLVED",
      packetState,
      stagesRecord,
      biography,
      undefined,
      startedAt,
    );
  }

  private buildResult(
    packet: InstitutionWorkPacket,
    status: InstitutionBiographyWorkflowResult["status"],
    packetState: InstitutionWorkPacketState,
    stages: InstitutionBiographyWorkflowResult["stages"],
    biographyResult: BiographyUrlResult | null,
    failure: InstitutionBiographyWorkflowResult["failure"] | undefined,
    startedAt: number,
  ): InstitutionBiographyWorkflowResult {
    return {
      packetId: packet.packetId,
      institutionId: packet.institutionId,
      institutionName: packet.institutionName,
      status,
      packetState,
      stages,
      biographyResult,
      ...(failure ? { failure } : {}),
      durationMs: Date.now() - startedAt,
    };
  }
}
