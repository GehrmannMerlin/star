import type { ReviewerSubmissionPayload, UrlCandidatePoolRow } from "@stellaris/agent-tools";
import type { ReviewDecisionSubmissionRow } from "@stellaris/db";
import type { ReviewDecisionSubmissionRepositoryPort } from "./postgres-review-decision-sink.js";

/** 一次持久化 Review 决策（append-only 历史中的一行）。 */
export type ReviewDecisionHistoryRow = {
  reviewRound: number;
  /** Thin 传输载荷（review_result / selected_candidate_id 等）。 */
  payload: ReviewerSubmissionPayload;
  payloadHash: string;
  /** APPROVED | REWORK_REQUIRED | REJECTED（确定性摘要）。 */
  roundOutcome: string;
  frozenAt: string;
  /** 来源 Review 的持久化行 id（review_decision_submission.id）。 */
  sourceReviewId: string;
};

/** 从 latest frozen APPROVED Review 推导出的当前岗位终选（无第二套 SSoT）。 */
export type FinalPositionDecision = {
  targetId: string;
  selectedCandidateId: string;
  finalUrl: string | null;
};

/** 一次持久化 Review 决策行 → 历史行（跨层类型适配）。 */
function toHistoryRow(row: ReviewDecisionSubmissionRow): ReviewDecisionHistoryRow {
  return {
    reviewRound: row.review_round,
    payload: row.payload as ReviewerSubmissionPayload,
    payloadHash: row.payload_hash,
    roundOutcome: row.round_outcome,
    frozenAt: row.frozen_at,
    sourceReviewId: row.id,
  };
}

/**
 * PostgreSQL Review Decision Reader（STEP 14 重水合数据源之一）。
 *
 * 只读：listByPacket（append-only 历史，round 升序）与 latestByPacket（最高 round）。
 * Final Current Position Decision 从 latest frozen APPROVED Review 的 payload +
 * 当前 Composite Candidate View 推导；不创建 final_position_decision SSoT。
 */
export class PostgresReviewDecisionReader {
  constructor(private readonly repo: ReviewDecisionSubmissionRepositoryPort) {}

  async listByPacket(packetId: string): Promise<ReviewDecisionHistoryRow[]> {
    const rows = await this.repo.listByPacket(packetId);
    return rows.map(toHistoryRow);
  }

  async latestByPacket(packetId: string): Promise<ReviewDecisionHistoryRow | null> {
    const row = await this.repo.latestByPacket(packetId);
    return row ? toHistoryRow(row) : null;
  }
}

/**
 * 从一份 Review payload + 候选池推导每个 APPROVED target 的终选
 * （selected_candidate_id → finalUrl）。机械推导：不重新 rank、不重判语义。
 */
export function finalPositionDecisionsFromReview(
  payload: ReviewerSubmissionPayload,
  pool: UrlCandidatePoolRow[],
): FinalPositionDecision[] {
  const byId = new Map<string, UrlCandidatePoolRow>();
  for (const candidate of pool) {
    if (typeof candidate.candidate_id === "string" && candidate.candidate_id.length > 0) {
      byId.set(candidate.candidate_id, candidate);
    }
  }
  const decisions: FinalPositionDecision[] = [];
  for (const review of payload.reviews) {
    if (review.review_result !== "APPROVED" || review.selected_candidate_id === null) continue;
    const candidate = byId.get(review.selected_candidate_id);
    decisions.push({
      targetId: review.target_id,
      selectedCandidateId: review.selected_candidate_id,
      finalUrl:
        candidate && typeof candidate.url === "string" ? candidate.url : null,
    });
  }
  return decisions;
}
