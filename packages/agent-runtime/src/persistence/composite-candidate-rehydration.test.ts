import { describe, expect, it } from "vitest";
import type { ReviewerSubmissionPayload } from "@stellaris/agent-tools";
import { CompositeCandidateViewRehydrator } from "./composite-candidate-rehydration.js";
import { PostgresEvidenceReader } from "./evidence-reader.js";
import { PostgresReviewDecisionReader } from "./review-decision-reader.js";
import { PostgresReviewDecisionSink } from "./postgres-review-decision-sink.js";
import { PostgresRecoverySubmissionSink } from "./postgres-recovery-submission-sink.js";
import {
  FakeEvidenceRepo,
  FakeRecoveryRepo,
  FakeReviewDecisionRepo,
} from "./persistence-test-support.js";

const PACKET = "packet-rereview-1";

const ORIGINAL = [
  {
    candidate_id: "cand-p1-dh",
    target_id: "glq-target-primary1",
    evidence_id: "evt-1",
    url: "http://www.njgl.gov.cn/xxgk/qczc/dh/",
    source_domain_class: "OFFICIAL_GOV_DOMAIN",
    page_shape_class: "OFFICIAL_CURRENT_LEADER_DETAIL",
    supports_person: true,
    supports_institution: true,
    supports_role: true,
    supports_currentness: true,
    candidate_status: "ACCEPTED_AS_FINAL",
    accept_or_reject_reason: "official leader profile",
    superseded_by_candidate_id: null,
  },
];

const RECOVERY = [
  {
    candidate_id: "cand-p2-recovery",
    target_id: "glq-target-primary2",
    evidence_id: "evt-recovery-1",
    url: "http://www.njgl.gov.cn/xxgk/qczc/sl/",
    source_domain_class: "OFFICIAL_GOV_DOMAIN",
    page_shape_class: "OFFICIAL_CURRENT_LEADER_DETAIL",
    supports_person: true,
    supports_institution: true,
    supports_role: true,
    supports_currentness: true,
    candidate_status: "ACCEPTED_AS_FINAL",
    accept_or_reject_reason: "recovered official leader profile",
    superseded_by_candidate_id: null,
  },
];

function reviewPayload(approved: boolean): ReviewerSubmissionPayload {
  const checks = {
    person_and_institution: true,
    page_type: true,
    better_personal_page: true,
    news_or_function_page_rejected: true,
    currentness: true,
    all_discovered_evidence_consumed: true,
    empty_search_complete: true,
    dynamic_escalation_complete: true,
  };
  const primary2: ReviewerSubmissionPayload["reviews"][number] = {
    target_id: "glq-target-primary2",
    selected_candidate_id: approved ? "cand-p2-recovery" : null,
    review_result: approved ? "APPROVED" : "REWORK_REQUIRED",
    final_review_result: approved ? "APPROVED_STRICT_ADMISSIBLE" : "REWORK_REQUIRED",
    review_reason: approved ? "verified" : "rework",
    currentness_quality: approved ? "CURRENT_COLLECTION_MEMBER" : "CURRENTNESS_UNRESOLVED",
    checks,
  };
  return {
    reviews: [
      {
        target_id: "glq-target-primary1",
        selected_candidate_id: "cand-p1-dh",
        review_result: "APPROVED",
        final_review_result: "APPROVED_STRICT_ADMISSIBLE",
        review_reason: "verified",
        currentness_quality: "CURRENT_COLLECTION_MEMBER",
        checks,
      },
      primary2,
    ],
  };
}

async function seed({
  evidenceRepo,
  recoveryRepo,
  reviewRepo,
}: {
  evidenceRepo: FakeEvidenceRepo;
  recoveryRepo: FakeRecoveryRepo;
  reviewRepo: FakeReviewDecisionRepo;
}): Promise<void> {
  await new PostgresReviewDecisionSink(reviewRepo, {
    packetId: PACKET,
    reviewRound: 1,
    agentRole: "REVIEWER",
    skill: { name: "official-biography-evidence", version: "3.1.0" },
  }).submit(reviewPayload(false));
  await new PostgresRecoverySubmissionSink(recoveryRepo, {
    packetId: PACKET,
    recoveryRound: 1,
    agentRole: "RECOVERY",
    skill: { name: "official-biography-evidence", version: "3.1.0" },
  }).submit({
    candidates: RECOVERY,
    supplements: [
      {
        target_id: "glq-target-primary2",
        outcome: "RECOVERED_QUALIFIED_URL",
        candidate_id: "cand-p2-recovery",
        failure_codes: [],
        leader_section_checked: true,
        personal_entry_checked: true,
        currentness_conflict_resolved: true,
        remaining_empty_reason: null,
      },
    ],
  });
}

describe("CompositeCandidateViewRehydrator (STEP 14 C)", () => {
  it("rehydrates a composite view from new Evidence/Recovery/Review readers without mutating the original pool", async () => {
    const evidenceRepo = new FakeEvidenceRepo();
    await evidenceRepo.insertSubmission({
      packet_id: PACKET,
      agent_session_id: "evidence-session-1",
      agent_role: "INVESTIGATOR",
      skill_name: "official-biography-evidence",
      skill_version: "3.1.0",
      canonical_schema: "url-candidate-pool.schema.json",
      payload: { candidates: ORIGINAL },
      payload_hash: "ev-hash",
      frozen_at: "2026-08-14T00:00:00.000Z",
    });
    const recoveryRepo = new FakeRecoveryRepo();
    const reviewRepo = new FakeReviewDecisionRepo();
    await seed({ evidenceRepo, recoveryRepo, reviewRepo });

    // new 实例（重水合）：PostgresEvidenceReader 持有独立的 evidence 读取；读者各自新构造。
    const rehydrator = new CompositeCandidateViewRehydrator({
      evidenceReader: new PostgresEvidenceReader(evidenceRepo),
      recoveryRepo,
      reviewRepo,
    });
    const result = await rehydrator.rehydrate(PACKET);

    expect(result.originalCandidatePool).toHaveLength(1);
    expect(result.originalCandidatePool[0]?.candidate_id).toBe("cand-p1-dh");
    expect(result.recoverySupplement).toHaveLength(1);
    expect(result.compositeCandidateView.map((c) => c.candidate_id)).toEqual([
      "cand-p1-dh",
      "cand-p2-recovery",
    ]);
    expect(result.reviewHistory).toHaveLength(1);
    expect(result.reviewHistory[0]?.roundOutcome).toBe("REWORK_REQUIRED");
  });

  it("dedupes composite by normalized URL and keeps original unchanged", async () => {
    const evidenceRepo = new FakeEvidenceRepo();
    await evidenceRepo.insertSubmission({
      packet_id: PACKET,
      agent_session_id: "evidence-session-1",
      agent_role: "INVESTIGATOR",
      skill_name: "official-biography-evidence",
      skill_version: "3.1.0",
      canonical_schema: "url-candidate-pool.schema.json",
      payload: { candidates: ORIGINAL },
      payload_hash: "ev-hash",
      frozen_at: "2026-08-14T00:00:00.000Z",
    });
    const recoveryRepo = new FakeRecoveryRepo();
    const reviewRepo = new FakeReviewDecisionRepo();
    // Supplement repeats the SAME URL as the original (must be deduped out of composite).
    await new PostgresRecoverySubmissionSink(recoveryRepo, {
      packetId: PACKET,
      recoveryRound: 1,
      agentRole: "RECOVERY",
      skill: { name: "official-biography-evidence", version: "3.1.0" },
    }).submit({
      candidates: [
        {
          ...ORIGINAL[0]!,
          candidate_id: "cand-p1-dh-dupe",
          accept_or_reject_reason: "duplicate url variant",
        },
      ],
      supplements: [],
    });

    const rehydrator = new CompositeCandidateViewRehydrator({
      evidenceReader: new PostgresEvidenceReader(evidenceRepo),
      recoveryRepo,
      reviewRepo,
    });
    const result = await rehydrator.rehydrate(PACKET);
    expect(result.compositeCandidateView).toHaveLength(1);
    expect(result.compositeCandidateView[0]?.candidate_id).toBe("cand-p1-dh");
    // Original 永不修改。
    expect(evidenceRepo.rows[0]?.payload).toMatchObject({ candidates: ORIGINAL });
    // 只读 reader 存在（可被 smoke 用于历史断言）。
    const reviewReader = new PostgresReviewDecisionReader(reviewRepo);
    expect(await reviewReader.latestByPacket(PACKET)).toBeNull();
  });
});
