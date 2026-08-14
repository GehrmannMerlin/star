import { createDb } from "@stellaris/db";
import {
  InvestigatorEvidenceSubmissionRepository,
  RecoverySubmissionRepository,
  ReviewDecisionSubmissionRepository,
  ToolEventRepository,
} from "@stellaris/db";
import { PostgresToolEventJournal } from "./postgres-tool-event-journal.js";
import {
  PostgresInvestigatorEvidenceSubmissionSink,
  type PostgresEvidenceSinkIdentity,
} from "./postgres-investigator-evidence-sink.js";
import {
  PostgresReviewDecisionSink,
  type PostgresReviewSinkIdentity,
} from "./postgres-review-decision-sink.js";
import {
  PostgresRecoverySubmissionSink,
  type PostgresRecoverySinkIdentity,
} from "./postgres-recovery-submission-sink.js";
import { PostgresReviewDecisionReader } from "./review-decision-reader.js";
import { PostgresRecoveryReader } from "./recovery-reader.js";
import { PostgresEvidenceReader } from "./evidence-reader.js";
import { CompositeCandidateViewRehydrator } from "./composite-candidate-rehydration.js";
import { RecoveryRereviewCoordinator } from "./recovery-rereview-coordinator.js";

export * from "./tool-event-projection.js";
export * from "./postgres-tool-event-journal.js";
export * from "./postgres-investigator-evidence-sink.js";
export * from "./postgres-review-decision-sink.js";
export * from "./postgres-recovery-submission-sink.js";
export * from "./review-decision-reader.js";
export * from "./recovery-reader.js";
export * from "./evidence-reader.js";
export * from "./composite-candidate-rehydration.js";
export * from "./recovery-rereview-coordinator.js";
export * from "./persistence-smoke.js";

/**
 * 最小持久化工厂（STEP 11 / STEP 14）。
 *
 * 只在需要 durable 注入时使用；Memory 实现仍是 unit test / 快速 smoke 的默认。
 * 不建立 AgentPersistencePlatform / 容器式 DI。
 */
export function createPostgresToolEventJournal(
  db: ReturnType<typeof createDb>,
): PostgresToolEventJournal {
  return new PostgresToolEventJournal(new ToolEventRepository(db));
}

export function createPostgresEvidenceSink(
  db: ReturnType<typeof createDb>,
  identity: PostgresEvidenceSinkIdentity,
): PostgresInvestigatorEvidenceSubmissionSink {
  return new PostgresInvestigatorEvidenceSubmissionSink(
    new InvestigatorEvidenceSubmissionRepository(db),
    identity,
  );
}

/** STEP 14：Round-annotated Review Decision sink。 */
export function createPostgresReviewDecisionSink(
  db: ReturnType<typeof createDb>,
  identity: PostgresReviewSinkIdentity,
): PostgresReviewDecisionSink {
  return new PostgresReviewDecisionSink(new ReviewDecisionSubmissionRepository(db), identity);
}

/** STEP 14：Round-annotated Recovery Submission sink。 */
export function createPostgresRecoverySubmissionSink(
  db: ReturnType<typeof createDb>,
  identity: PostgresRecoverySinkIdentity,
): PostgresRecoverySubmissionSink {
  return new PostgresRecoverySubmissionSink(new RecoverySubmissionRepository(db), identity);
}

/** STEP 14：三路持久化读取器 + Composite 重水合（全部为 new 实例）。 */
export function createRehydrationReaders(db: ReturnType<typeof createDb>): {
  evidenceReader: PostgresEvidenceReader;
  recoveryReader: PostgresRecoveryReader;
  reviewReader: PostgresReviewDecisionReader;
  rehydrator: CompositeCandidateViewRehydrator;
} {
  const evidenceReader = new PostgresEvidenceReader(new InvestigatorEvidenceSubmissionRepository(db));
  const recoveryReader = new PostgresRecoveryReader(new RecoverySubmissionRepository(db));
  const reviewReader = new PostgresReviewDecisionReader(new ReviewDecisionSubmissionRepository(db));
  const rehydrator = new CompositeCandidateViewRehydrator({
    evidenceReader,
    recoveryRepo: new RecoverySubmissionRepository(db),
    reviewRepo: new ReviewDecisionSubmissionRepository(db),
  });
  return { evidenceReader, recoveryReader, reviewReader, rehydrator };
}

export { RecoveryRereviewCoordinator };
