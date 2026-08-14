import type { UrlCandidatePoolRow } from "@stellaris/agent-tools";
import { composeCandidateView } from "../recovery/recovery-attestation.js";
import type { EvidenceReaderPort } from "./evidence-reader.js";
import type { RecoverySubmissionRepositoryPort } from "./postgres-recovery-submission-sink.js";
import type { ReviewDecisionSubmissionRepositoryPort } from "./postgres-review-decision-sink.js";
import { PostgresReviewDecisionReader, type ReviewDecisionHistoryRow } from "./review-decision-reader.js";

/** Composite Candidate View 重水合输入（STEP 14 C）。 */
export type CompositeRehydrationInput = {
  /** Original Candidate Pool（永不修改）。 */
  originalCandidatePool: UrlCandidatePoolRow[];
  /** Persisted Recovery Supplement 的 NEW 候选（永不修改）。 */
  recoverySupplement: UrlCandidatePoolRow[];
  /** 机械 append + 身份去重后的 Composite Candidate View（无排序/打分/终选）。 */
  compositeCandidateView: UrlCandidatePoolRow[];
  /** 完整 Review 历史（append-only）。 */
  reviewHistory: ReviewDecisionHistoryRow[];
};

/** 重水合依赖：new Evidence Reader + new Recovery Reader + new Review Reader。 */
export type CompositeRehydrationDeps = {
  evidenceReader: EvidenceReaderPort;
  recoveryRepo: RecoverySubmissionRepositoryPort;
  reviewRepo: ReviewDecisionSubmissionRepositoryPort;
};

/**
 * Composite Candidate View 重水合（STEP 14 C）。
 *
 * 从三个独立持久化读取器重新实例化后组装：
 * Original Candidate Pool（Evidence）+ Persisted Recovery Supplement（Recovery）
 * → Composite Candidate View。机械 append/dedupe（复用 composeCandidateView），
 * 不做 ranking、不做 scoring、不做 Final URL selection。Original 与 Supplement
 * 各自保持原样。
 */
export class CompositeCandidateViewRehydrator {
  private readonly reviewReader: PostgresReviewDecisionReader;

  constructor(private readonly deps: CompositeRehydrationDeps) {
    this.reviewReader = new PostgresReviewDecisionReader(deps.reviewRepo);
  }

  async rehydrate(packetId: string): Promise<CompositeRehydrationInput> {
    const originalCandidatePool = await this.deps.evidenceReader.readOriginalCandidatePool(
      packetId,
    );
    const recoverySupplement = await this.recoverySupplementCandidates(packetId);
    const compositeCandidateView = composeCandidateView(originalCandidatePool, recoverySupplement);
    const reviewHistory = await this.reviewReader.listByPacket(packetId);
    return {
      originalCandidatePool,
      recoverySupplement,
      compositeCandidateView,
      reviewHistory,
    };
  }

  private async recoverySupplementCandidates(packetId: string): Promise<UrlCandidatePoolRow[]> {
    const latest = await this.deps.recoveryRepo.latestByPacket(packetId);
    if (!latest) return [];
    const payload = (latest.payload ?? {}) as { candidates?: unknown };
    if (!Array.isArray(payload.candidates)) return [];
    return payload.candidates as UrlCandidatePoolRow[];
  }
}
