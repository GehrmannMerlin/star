import { describe, expect, it } from "vitest";
import type { ReviewerSubmissionPayload, UrlCandidatePoolRow } from "@stellaris/agent-tools";
import {
  FakeReviewDecisionRepo,
} from "./persistence-test-support.js";
import {
  PostgresReviewDecisionSink,
  reviewRoundOutcome,
  type PostgresReviewSinkIdentity,
} from "./postgres-review-decision-sink.js";
import {
  finalPositionDecisionsFromReview,
  PostgresReviewDecisionReader,
} from "./review-decision-reader.js";

const CHECKS = {
  person_and_institution: true,
  page_type: true,
  better_personal_page: true,
  news_or_function_page_rejected: true,
  currentness: true,
  all_discovered_evidence_consumed: true,
  empty_search_complete: true,
  dynamic_escalation_complete: true,
};

const PACKET = "packet-rereview-1";
const IDENTITY: PostgresReviewSinkIdentity = {
  packetId: PACKET,
  reviewRound: 1,
  agentRole: "REVIEWER",
  skill: { name: "official-biography-evidence", version: "3.1.0" },
};

function approvedPayload(): ReviewerSubmissionPayload {
  return {
    reviews: [
      {
        target_id: "glq-target-primary1",
        selected_candidate_id: "cand-p1",
        review_result: "APPROVED",
        final_review_result: "APPROVED_STRICT_ADMISSIBLE",
        review_reason: "verified official page",
        currentness_quality: "CURRENT_COLLECTION_MEMBER",
        checks: CHECKS,
      },
      {
        target_id: "glq-target-primary2",
        selected_candidate_id: "cand-p2",
        review_result: "APPROVED",
        final_review_result: "APPROVED_STRICT_ADMISSIBLE",
        review_reason: "verified official page",
        currentness_quality: "CURRENT_COLLECTION_MEMBER",
        checks: CHECKS,
      },
    ],
  };
}

function reworkPayload(): ReviewerSubmissionPayload {
  return {
    reviews: [
      {
        target_id: "glq-target-primary1",
        selected_candidate_id: "cand-p1",
        review_result: "APPROVED",
        final_review_result: "APPROVED_STRICT_ADMISSIBLE",
        review_reason: "verified official page",
        currentness_quality: "CURRENT_COLLECTION_MEMBER",
        checks: CHECKS,
      },
      {
        target_id: "glq-target-primary2",
        selected_candidate_id: null,
        review_result: "REWORK_REQUIRED",
        final_review_result: "REWORK_REQUIRED",
        review_reason: "frozen pool insufficient for PRIMARY_2",
        currentness_quality: "CURRENTNESS_UNRESOLVED",
        checks: CHECKS,
      },
    ],
  };
}

function candidate(id: string, targetId: string, url: string): UrlCandidatePoolRow {
  return {
    candidate_id: id,
    target_id: targetId,
    evidence_id: "evt-1",
    url,
    source_domain_class: "OFFICIAL_GOV_DOMAIN",
    page_shape_class: "OFFICIAL_CURRENT_LEADER_DETAIL",
    supports_person: true,
    supports_institution: true,
    supports_role: true,
    supports_currentness: true,
    candidate_status: "ACCEPTED_AS_FINAL",
    accept_or_reject_reason: "official leader profile",
    superseded_by_candidate_id: null,
  };
}

describe("PostgresReviewDecisionSink (STEP 14)", () => {
  it("accepts a round-1 review and persists an APPROVED round outcome", async () => {
    const repo = new FakeReviewDecisionRepo();
    const sink = new PostgresReviewDecisionSink(repo, IDENTITY);
    const result = await sink.submit(approvedPayload());
    expect(result.status).toBe("ACCEPTED");
    expect(repo.rows).toHaveLength(1);
    expect(repo.rows[0]?.round_outcome).toBe("APPROVED");
    expect(await sink.isFrozen()).toBe(true);
    const submission = await sink.getSubmission();
    expect(submission?.reviews).toHaveLength(2);
  });

  it("rejects a duplicate submit for the same packet + same round", async () => {
    const repo = new FakeReviewDecisionRepo();
    const sink = new PostgresReviewDecisionSink(repo, IDENTITY);
    await sink.submit(approvedPayload());
    const duplicate = await sink.submit(approvedPayload());
    expect(duplicate.status).toBe("ALREADY_SUBMITTED");
    expect(repo.rows).toHaveLength(1);
  });

  it("handles a concurrent race (pre-check miss then 23505) as ALREADY_SUBMITTED", async () => {
    const repo = new FakeReviewDecisionRepo();
    repo.raceMode = true;
    const sink = new PostgresReviewDecisionSink(repo, IDENTITY);
    await sink.submit(approvedPayload());
    const raced = await sink.submit(approvedPayload());
    expect(raced.status).toBe("ALREADY_SUBMITTED");
    expect(repo.rows).toHaveLength(1);
  });

  it("keeps round 1 immutable when round 2 is appended (append-only history)", async () => {
    const repo = new FakeReviewDecisionRepo();
    const round1 = new PostgresReviewDecisionSink(repo, { ...IDENTITY, reviewRound: 1 });
    const round2 = new PostgresReviewDecisionSink(repo, { ...IDENTITY, reviewRound: 2 });
    await round1.submit(reworkPayload());
    const round2Result = await round2.submit(approvedPayload());
    expect(round2Result.status).toBe("ACCEPTED");
    expect(repo.rows).toHaveLength(2);
    // Round 1 不可被 Round 2 覆盖：round-1 行 payload 保持不变。
    const reloadedRound1 = new PostgresReviewDecisionSink(repo, { ...IDENTITY, reviewRound: 1 });
    const round1Submission = await reloadedRound1.getSubmission();
    expect(round1Submission?.reviews[1]?.review_result).toBe("REWORK_REQUIRED");
  });

  it("derives round outcomes deterministically", () => {
    expect(reviewRoundOutcome(approvedPayload())).toBe("APPROVED");
    expect(reviewRoundOutcome(reworkPayload())).toBe("REWORK_REQUIRED");
    expect(
      reviewRoundOutcome({
        reviews: [
          {
            ...reworkPayload().reviews[0]!,
            review_result: "REJECTED",
            final_review_result: "REJECTED_INVALID_URL",
            selected_candidate_id: null,
          },
        ],
      }),
    ).toBe("REJECTED");
  });
});

describe("PostgresReviewDecisionReader (STEP 14)", () => {
  it("lists the full append-only history ordered by round and reads the latest", async () => {
    const repo = new FakeReviewDecisionRepo();
    await new PostgresReviewDecisionSink(repo, { ...IDENTITY, reviewRound: 1 }).submit(
      reworkPayload(),
    );
    await new PostgresReviewDecisionSink(repo, { ...IDENTITY, reviewRound: 2 }).submit(
      approvedPayload(),
    );
    const reader = new PostgresReviewDecisionReader(repo);
    const history = await reader.listByPacket(PACKET);
    expect(history).toHaveLength(2);
    expect(history.map((row) => row.reviewRound)).toEqual([1, 2]);
    expect(history.map((row) => row.roundOutcome)).toEqual(["REWORK_REQUIRED", "APPROVED"]);
    const latest = await reader.latestByPacket(PACKET);
    expect(latest?.reviewRound).toBe(2);
    expect(latest?.roundOutcome).toBe("APPROVED");
  });

  it("derives the final current position decision from the latest frozen APPROVED review", () => {
    const pool = [
      candidate("cand-p1", "glq-target-primary1", "http://www.njgl.gov.cn/xxgk/qczc/dh/"),
      candidate("cand-p2", "glq-target-primary2", "http://www.njgl.gov.cn/xxgk/qczc/sl/"),
    ];
    const decisions = finalPositionDecisionsFromReview(approvedPayload(), pool);
    expect(decisions).toHaveLength(2);
    expect(decisions[0]).toMatchObject({
      targetId: "glq-target-primary1",
      selectedCandidateId: "cand-p1",
      finalUrl: "http://www.njgl.gov.cn/xxgk/qczc/dh/",
    });
    // REWORK payload 不产生终选（无 APPROVED）。
    expect(finalPositionDecisionsFromReview(reworkPayload(), pool)).toHaveLength(1);
  });
});
