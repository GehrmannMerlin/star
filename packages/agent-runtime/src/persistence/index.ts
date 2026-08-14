import { createDb } from "@stellaris/db";
import {
  InvestigatorEvidenceSubmissionRepository,
  ToolEventRepository,
} from "@stellaris/db";
import { PostgresToolEventJournal } from "./postgres-tool-event-journal.js";
import {
  PostgresInvestigatorEvidenceSubmissionSink,
  type PostgresEvidenceSinkIdentity,
} from "./postgres-investigator-evidence-sink.js";

export * from "./tool-event-projection.js";
export * from "./postgres-tool-event-journal.js";
export * from "./postgres-investigator-evidence-sink.js";
export * from "./persistence-smoke.js";

/**
 * 最小持久化工厂（STEP 11）。
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
