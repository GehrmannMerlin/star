import type { ReviewerDecisionSink } from "@stellaris/agent-tools";
import type { AgentRole } from "@stellaris/contracts";
import type { ReviewerResult } from "../reviewer/reviewer-types.js";
import type { ReviewerFrozenInput } from "../reviewer/reviewer-types.js";
import type {
  CompositeCandidateViewRehydrator,
  CompositeRehydrationInput,
} from "./composite-candidate-rehydration.js";
import type { PostgresReviewSinkIdentity } from "./postgres-review-decision-sink.js";

/** Round-2 Reviewer 运行契约（注入 ReviewerAgentRunner，允许测试打桩）。 */
export type RoundTwoReviewerRun = (input: {
  packetId: string;
  frozenInput: ReviewerFrozenInput;
  sink: ReviewerDecisionSink;
}) => Promise<ReviewerResult>;

/** Round-2 Review sink 工厂（默认构造 PostgresReviewDecisionSink, reviewRound=2）。 */
export type RoundTwoSinkFactory = (
  identity: PostgresReviewSinkIdentity,
) => ReviewerDecisionSink;

/** Recovery/Re-Review 编排依赖。 */
export type RecoveryRereviewCoordinatorDeps = {
  rehydrator: CompositeCandidateViewRehydrator;
  /** 持久化的 frozen Leadership artifact。 */
  frozenLeadership: Record<string, unknown>;
  /** 持久化的 frozen PRIMARY person decisions。 */
  frozenSelectedOfficials: Array<Record<string, unknown>>;
  /** Round-2 Review sink 工厂（默认 reviewRound=2）。 */
  createRoundTwoSink?: RoundTwoSinkFactory;
  /** Round-2 Reviewer 运行器（默认抛出未注入错误；smoke/入口接线 ReviewerAgentRunner）。 */
  runReviewer: RoundTwoReviewerRun;
};

export type RecoveryRereviewCoordinatorResult = {
  rehydration: CompositeRehydrationInput;
  reviewerResult: ReviewerResult;
};

/**
 * Recovery/Re-Review 编排（STEP 14 D）。
 *
 * 流程：重水合 Composite Candidate View → 以 Composite 作为当前 Reviewer 的
 * Frozen Candidate View → 复用 ReviewerAgentRunner 运行 Fresh Round-2 Review
 * （独立 session、独立 search、选中候选自行 reopen/inspect、submit_review_decision、
 * persist Round-2 Review）。Round-2 若再次 REWORK_REQUIRED → packet RECOVERY_REQUIRED
 * 并停止（不自动启动 Recovery Round 2）。本编排不持有 packet store —— packet 状态机
 * 仍由注入的 ReviewerAgentRunner 推进。
 */
export class RecoveryRereviewCoordinator {
  constructor(private readonly deps: RecoveryRereviewCoordinatorDeps) {}

  async run(
    packetId: string,
    identityBase: { agentRole: AgentRole; skill: { name: string; version: string } },
  ): Promise<RecoveryRereviewCoordinatorResult> {
    const rehydration = await this.deps.rehydrator.rehydrate(packetId);
    const createRoundTwoSink = this.deps.createRoundTwoSink ?? defaultRoundTwoSink;
    const sink = createRoundTwoSink({
      packetId,
      reviewRound: 2,
      agentRole: identityBase.agentRole,
      skill: identityBase.skill,
    });
    const reviewerResult = await this.deps.runReviewer({
      packetId,
      frozenInput: {
        leadership: this.deps.frozenLeadership,
        selectedOfficials: this.deps.frozenSelectedOfficials,
        candidatePool: rehydration.compositeCandidateView,
      },
      sink,
    });
    return { rehydration, reviewerResult };
  }
}

/**
 * 默认 Round-2 sink 工厂。延迟 import 以避免在仅做单元测试时触发 Postgres
 * 连接依赖；正式入口（smoke）显式传入同一工厂。
 */
function defaultRoundTwoSink(identity: PostgresReviewSinkIdentity): ReviewerDecisionSink {
  // eslint-disable-next-line @typescript-eslint/consistent-type-imports
  void identity;
  throw new Error(
    "RecoveryRereviewCoordinator: createRoundTwoSink not injected — wire PostgresReviewDecisionSink(reviewRound=2) in the smoke/entrypoint",
  );
}
