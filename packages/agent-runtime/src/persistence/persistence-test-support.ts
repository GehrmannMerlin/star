/**
 * 持久化测试支撑：内存版 ToolEventRepository / InvestigatorEvidenceSubmissionRepository
 * / ReviewDecisionSubmissionRepository / RecoverySubmissionRepository。
 *
 * 用于在无容器环境下验证 journal/sink 的投影、冻结、重复拒绝与重读接线逻辑。
 * 通过 JSON.parse(JSON.stringify(...)) 模拟 pg 的 jsonb 序列化往返。
 */

import type {
  InvestigatorEvidenceSubmissionRow,
  RecoverySubmissionRow,
  ReviewDecisionSubmissionRow,
  ToolEventRow,
} from "@stellaris/db";
import type {
  EvidenceSubmissionInsertRow,
  InvestigatorEvidenceSubmissionRepositoryPort,
} from "./postgres-investigator-evidence-sink.js";
import type { ToolEventRepositoryPort, ToolEventInsertRow } from "./postgres-tool-event-journal.js";
import type { ReviewDecisionSubmissionRepositoryPort } from "./postgres-review-decision-sink.js";
import type { RecoverySubmissionRepositoryPort } from "./postgres-recovery-submission-sink.js";

/** 内存 ToolEvent 仓储，模拟 pg jsonb 往返与 seq 自增。 */
export class FakeToolEventRepo implements ToolEventRepositoryPort {
  rows: ToolEventRow[] = [];
  private seq = 0;

  async insertEvent(row: ToolEventInsertRow): Promise<ToolEventRow> {
    this.seq += 1;
    const jsonb = (v: unknown): unknown => (v == null ? null : JSON.parse(JSON.stringify(v)));
    const stored: ToolEventRow = {
      id: `id-${this.seq}`,
      seq: this.seq,
      created_at: new Date().toISOString(),
      call_id: row.call_id,
      tool_name: row.tool_name,
      status: row.status,
      agent_session_id: row.agent_session_id,
      packet_id: row.packet_id,
      agent_role: row.agent_role,
      task_run_id: row.task_run_id,
      started_at: row.started_at,
      finished_at: row.finished_at,
      failure_code: row.failure_code,
      failure_message: row.failure_message,
      failure_retryable: row.failure_retryable,
      url_metadata: jsonb(row.url_metadata),
      search_metadata: jsonb(row.search_metadata),
      submission_metadata: jsonb(row.submission_metadata),
    };
    this.rows.push(stored);
    return stored;
  }

  async listSuccessEvents(opts: { agentSessionId?: string } = {}): Promise<ToolEventRow[]> {
    return this.rows.filter(
      (row) =>
        row.status === "SUCCESS" &&
        (opts.agentSessionId === undefined || row.agent_session_id === opts.agentSessionId),
    );
  }

  async listEvents(opts: { agentSessionId?: string; packetId?: string } = {}): Promise<ToolEventRow[]> {
    return this.rows.filter(
      (row) =>
        (opts.agentSessionId === undefined || row.agent_session_id === opts.agentSessionId) &&
        (opts.packetId === undefined || row.packet_id === opts.packetId),
    );
  }
}

/** 内存 Evidence 仓储，模拟唯一约束（packet_id）与并发竞争。 */
export class FakeEvidenceRepo implements InvestigatorEvidenceSubmissionRepositoryPort {
  rows: InvestigatorEvidenceSubmissionRow[] = [];
  /** 竞态模式：预检首次命中返回 null，INSERT 抛唯一冲突。 */
  raceMode = false;
  private precheckCalls = 0;

  async insertSubmission(row: EvidenceSubmissionInsertRow): Promise<InvestigatorEvidenceSubmissionRow> {
    if (this.rows.some((r) => r.packet_id === row.packet_id)) {
      const error = new Error(
        'duplicate key value violates unique constraint "investigator_evidence_submission_packet_unique"',
      ) as Error & { code: string };
      error.code = "23505";
      throw error;
    }
    const stored: InvestigatorEvidenceSubmissionRow = {
      id: `ev-${this.rows.length + 1}`,
      created_at: new Date().toISOString(),
      packet_id: row.packet_id,
      agent_session_id: row.agent_session_id,
      agent_role: row.agent_role,
      skill_name: row.skill_name,
      skill_version: row.skill_version,
      canonical_schema: row.canonical_schema,
      payload: JSON.parse(JSON.stringify(row.payload)),
      payload_hash: row.payload_hash,
      frozen_at: row.frozen_at,
    };
    this.rows.push(stored);
    return stored;
  }

  async getSubmissionByPacketId(packetId: string): Promise<InvestigatorEvidenceSubmissionRow | null> {
    if (this.raceMode) {
      this.precheckCalls += 1;
      if (this.precheckCalls === 1) return null;
    }
    return this.rows.find((r) => r.packet_id === packetId) ?? null;
  }

  async isFrozen(packetId: string): Promise<boolean> {
    return this.rows.some((r) => r.packet_id === packetId);
  }
}

/** 内存 Review Decision 仓储，模拟唯一约束 (packet_id, review_round) 与并发竞争。 */
export class FakeReviewDecisionRepo implements ReviewDecisionSubmissionRepositoryPort {
  rows: ReviewDecisionSubmissionRow[] = [];
  raceMode = false;
  private precheckCalls = 0;

  async insertSubmission(
    row: ReviewDecisionSubmissionRow,
  ): Promise<ReviewDecisionSubmissionRow> {
    if (
      this.rows.some(
        (r) => r.packet_id === row.packet_id && r.review_round === row.review_round,
      )
    ) {
      const error = new Error(
        'duplicate key value violates unique constraint "review_decision_submission_round_unique"',
      ) as Error & { code: string };
      error.code = "23505";
      throw error;
    }
    const stored: ReviewDecisionSubmissionRow = {
      ...JSON.parse(JSON.stringify(row)),
      id: `rv-${this.rows.length + 1}`,
      created_at: new Date().toISOString(),
      payload: JSON.parse(JSON.stringify(row.payload)),
    };
    this.rows.push(stored);
    return stored;
  }

  async getByPacketAndRound(
    packetId: string,
    reviewRound: number,
  ): Promise<ReviewDecisionSubmissionRow | null> {
    if (this.raceMode) {
      this.precheckCalls += 1;
      if (this.precheckCalls === 1) return null;
    }
    return (
      this.rows.find(
        (r) => r.packet_id === packetId && r.review_round === reviewRound,
      ) ?? null
    );
  }

  async listByPacket(packetId: string): Promise<ReviewDecisionSubmissionRow[]> {
    return this.rows
      .filter((r) => r.packet_id === packetId)
      .sort((a, b) => a.review_round - b.review_round);
  }

  async latestByPacket(packetId: string): Promise<ReviewDecisionSubmissionRow | null> {
    const matches = this.rows
      .filter((r) => r.packet_id === packetId)
      .sort((a, b) => b.review_round - a.review_round);
    return matches[0] ?? null;
  }
}

/** 内存 Recovery Submission 仓储，模拟唯一约束 (packet_id, recovery_round) 与并发竞争。 */
export class FakeRecoveryRepo implements RecoverySubmissionRepositoryPort {
  rows: RecoverySubmissionRow[] = [];
  raceMode = false;
  private precheckCalls = 0;

  async insertSubmission(row: RecoverySubmissionRow): Promise<RecoverySubmissionRow> {
    if (
      this.rows.some(
        (r) => r.packet_id === row.packet_id && r.recovery_round === row.recovery_round,
      )
    ) {
      const error = new Error(
        'duplicate key value violates unique constraint "recovery_submission_round_unique"',
      ) as Error & { code: string };
      error.code = "23505";
      throw error;
    }
    const stored: RecoverySubmissionRow = {
      ...JSON.parse(JSON.stringify(row)),
      id: `rc-${this.rows.length + 1}`,
      created_at: new Date().toISOString(),
      payload: JSON.parse(JSON.stringify(row.payload)),
    };
    this.rows.push(stored);
    return stored;
  }

  async getByPacketAndRound(
    packetId: string,
    recoveryRound: number,
  ): Promise<RecoverySubmissionRow | null> {
    if (this.raceMode) {
      this.precheckCalls += 1;
      if (this.precheckCalls === 1) return null;
    }
    return (
      this.rows.find(
        (r) => r.packet_id === packetId && r.recovery_round === recoveryRound,
      ) ?? null
    );
  }

  async listByPacket(packetId: string): Promise<RecoverySubmissionRow[]> {
    return this.rows
      .filter((r) => r.packet_id === packetId)
      .sort((a, b) => a.recovery_round - b.recovery_round);
  }

  async latestByPacket(packetId: string): Promise<RecoverySubmissionRow | null> {
    const matches = this.rows
      .filter((r) => r.packet_id === packetId)
      .sort((a, b) => b.recovery_round - a.recovery_round);
    return matches[0] ?? null;
  }
}

/** 符合 url-candidate-pool.schema.json 的候选行。 */
export function candidateRow(targetId: string, url: string): Record<string, unknown> {
  return {
    candidate_id: `cand-${targetId}`,
    target_id: targetId,
    evidence_id: `evt-${targetId}-1`,
    url,
    source_domain_class: "OFFICIAL_GOV_DOMAIN",
    page_shape_class: "OFFICIAL_PERSON_PROFILE",
    supports_person: true,
    supports_institution: true,
    supports_role: true,
    supports_currentness: true,
    candidate_status: "ACCEPTED_AS_FINAL",
    accept_or_reject_reason: "official person profile",
    superseded_by_candidate_id: null,
  };
}
