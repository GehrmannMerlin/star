import type { RecoverySubmissionPayload, UrlCandidatePoolRow } from "@stellaris/agent-tools";
import type { RecoverySubmissionRow } from "@stellaris/db";
import type { RecoverySubmissionRepositoryPort } from "./postgres-recovery-submission-sink.js";

/** 一次持久化 Recovery Supplement（append-only 历史中的一行）。 */
export type RecoverySubmissionHistoryRow = {
  recoveryRound: number;
  /** Thin 传输载荷（candidates + supplements）。 */
  payload: RecoverySubmissionPayload;
  payloadHash: string;
  /** RECOVERED | NO_QUALIFIED_URL | NEEDS_RECHECK（确定性摘要）。 */
  roundOutcome: string;
  frozenAt: string;
};

function toHistoryRow(row: RecoverySubmissionRow): RecoverySubmissionHistoryRow {
  return {
    recoveryRound: row.recovery_round,
    payload: row.payload as RecoverySubmissionPayload,
    payloadHash: row.payload_hash,
    roundOutcome: row.round_outcome,
    frozenAt: row.frozen_at,
  };
}

/**
 * PostgreSQL Recovery Reader（STEP 14 重水合数据源之一）。
 *
 * 只读：listByPacket / latestByPacket / latestSupplementCandidates。原始
 * Investigator Evidence 永不由此类写入或修改。
 */
export class PostgresRecoveryReader {
  constructor(private readonly repo: RecoverySubmissionRepositoryPort) {}

  async listByPacket(packetId: string): Promise<RecoverySubmissionHistoryRow[]> {
    const rows = await this.repo.listByPacket(packetId);
    return rows.map(toHistoryRow);
  }

  async latestByPacket(packetId: string): Promise<RecoverySubmissionHistoryRow | null> {
    const row = await this.repo.latestByPacket(packetId);
    return row ? toHistoryRow(row) : null;
  }

  /** 最近一次 Recovery Supplement 携带的 NEW 候选（重水合 Composite View 的补充分支）。 */
  async latestSupplementCandidates(packetId: string): Promise<UrlCandidatePoolRow[]> {
    const latest = await this.latestByPacket(packetId);
    if (!latest) return [];
    return latest.payload.candidates;
  }
}
