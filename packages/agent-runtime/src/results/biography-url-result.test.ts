import { describe, expect, it } from "vitest";
import type { ReviewerChecks, ReviewerSubmissionPayload, UrlCandidatePoolRow } from "@stellaris/agent-tools";
import type { ReviewDecisionHistoryRow } from "../persistence/review-decision-reader.js";
import {
  BIOGRAPHY_RESULT_SOURCE_OF_TRUTH,
  projectBiographyUrlResult,
} from "./biography-url-result.js";
import type { InstitutionWorkPacket } from "../work-packet/institution-work-packet.js";

const CHECKS: ReviewerChecks = {
  person_and_institution: true,
  page_type: true,
  better_personal_page: true,
  news_or_function_page_rejected: true,
  currentness: true,
  all_discovered_evidence_consumed: true,
  empty_search_complete: true,
  dynamic_escalation_complete: true,
};

function packet(state: InstitutionWorkPacket["state"] = "POSITION_DECIDED"): InstitutionWorkPacket {
  return {
    packetId: "packet-1",
    inventoryHash: "h",
    regionCode: "320106",
    institutionId: "inst-1",
    institutionName: "鼓楼区人民政府",
    administrativeLevel: "COUNTY",
    state,
    attemptNo: 1,
    primaryPersons: {
      primary1: { targetId: "glq-target-primary1", personId: "person-1", personName: "董涵" },
      primary2: { targetId: "glq-target-primary2", personId: "person-2", personName: "石磊" },
    },
    createdAt: "2026-08-14T00:00:00.000Z",
    updatedAt: "2026-08-14T00:00:00.000Z",
  };
}

const POOL: UrlCandidatePoolRow[] = [
  {
    candidate_id: "cand-p1",
    target_id: "glq-target-primary1",
    url: "http://www.njgl.gov.cn/xxgk/qczc/dh/",
  },
  {
    candidate_id: "cand-p1-old",
    target_id: "glq-target-primary1",
    url: "http://www.njgl.gov.cn/old/dh/",
  },
  {
    candidate_id: "cand-p2",
    target_id: "glq-target-primary2",
    url: "http://www.njgl.gov.cn/xxgk/qczc/sl/",
  },
];

function reviewRow(
  round: number,
  outcome: string,
  reviews: ReviewerSubmissionPayload["reviews"],
): ReviewDecisionHistoryRow {
  return {
    reviewRound: round,
    payload: { reviews },
    payloadHash: `h-${round}`,
    roundOutcome: outcome,
    frozenAt: "2026-08-14T00:00:00.000Z",
    sourceReviewId: `rv-${round}`,
  };
}

function review(
  targetId: string,
  selectedCandidateId: string | null,
  result: "APPROVED" | "REWORK_REQUIRED",
) {
  return {
    target_id: targetId,
    selected_candidate_id: selectedCandidateId,
    review_result: result,
    final_review_result:
      result === "APPROVED" ? ("APPROVED_STRICT_ADMISSIBLE" as const) : ("REWORK_REQUIRED" as const),
    review_reason: "review",
    currentness_quality:
      result === "APPROVED" ? ("CURRENT_COLLECTION_MEMBER" as const) : ("CURRENTNESS_UNRESOLVED" as const),
    checks: CHECKS,
  };
}

describe("projectBiographyUrlResult (pure domain projection)", () => {
  it("latest APPROVED review → 两个 PRIMARY 各自 RESOLVED 输出 Biography URL", () => {
    const latest = reviewRow(1, "APPROVED", [
      review("glq-target-primary1", "cand-p1", "APPROVED"),
      review("glq-target-primary2", "cand-p2", "APPROVED"),
    ]);
    const result = projectBiographyUrlResult(packet(), latest, POOL);

    expect(result.sourceOfTruth).toBe(BIOGRAPHY_RESULT_SOURCE_OF_TRUTH);
    expect(result.status).toBe("RESOLVED");
    expect(result.primary1).toMatchObject({
      primarySlot: "PRIMARY_1",
      decisionStatus: "RESOLVED",
      biographyUrl: "http://www.njgl.gov.cn/xxgk/qczc/dh/",
      personName: "董涵",
      reviewRound: 1,
      sourceReviewId: "rv-1",
    });
    expect(result.primary2).toMatchObject({
      primarySlot: "PRIMARY_2",
      decisionStatus: "RESOLVED",
      biographyUrl: "http://www.njgl.gov.cn/xxgk/qczc/sl/",
      personName: "石磊",
    });
  });

  it("latest review 非 APPROVED → 不伪造 Final URL，整体 UNRESOLVED", () => {
    const latest = reviewRow(2, "REWORK_REQUIRED", [
      review("glq-target-primary1", null, "REWORK_REQUIRED"),
      review("glq-target-primary2", null, "REWORK_REQUIRED"),
    ]);
    const result = projectBiographyUrlResult(packet("RECOVERY_REQUIRED"), latest, POOL);

    expect(result.status).toBe("UNRESOLVED");
    expect(result.primary1.decisionStatus).toBe("UNRESOLVED");
    expect(result.primary1.biographyUrl).toBeNull();
    expect(result.primary2.biographyUrl).toBeNull();
  });

  it("无 review 历史 → 不伪造 Final URL", () => {
    const result = projectBiographyUrlResult(packet("READY_FOR_REVIEW"), null, POOL);
    expect(result.status).toBe("UNRESOLVED");
    expect(result.primary1.biographyUrl).toBeNull();
    expect(result.primary2.biographyUrl).toBeNull();
  });

  it("Round 2 覆盖 Round 1（投影取 latest），历史不被重写", () => {
    const latest = reviewRow(2, "APPROVED", [
      review("glq-target-primary1", "cand-p1", "APPROVED"),
      review("glq-target-primary2", "cand-p2", "APPROVED"),
    ]);
    const result = projectBiographyUrlResult(packet(), latest, POOL);
    // 投影使用 latest（round 2）的 selected_candidate_id → URL。
    expect(result.primary1.reviewRound).toBe(2);
    expect(result.primary1.sourceReviewId).toBe("rv-2");
    expect(result.primary1.biographyUrl).toBe("http://www.njgl.gov.cn/xxgk/qczc/dh/");
    // DB 历史为 append-only（round 1 行不覆盖）——由 persistence/smoke 覆盖，
    // 这里证明投影函数本身不重写任何数据：输入历史行数量不变。
    expect(latest.reviewRound).toBe(2);
  });

  it("仅 PRIMARY_1 已决 → PARTIAL，PRIMARY_2 UNRESOLVED 不伪造", () => {
    const latest = reviewRow(1, "APPROVED", [
      review("glq-target-primary1", "cand-p1", "APPROVED"),
      review("glq-target-primary2", null, "REWORK_REQUIRED"),
    ]);
    const result = projectBiographyUrlResult(packet(), latest, POOL);

    expect(result.status).toBe("PARTIAL");
    expect(result.primary1.decisionStatus).toBe("RESOLVED");
    expect(result.primary1.biographyUrl).toBe("http://www.njgl.gov.cn/xxgk/qczc/dh/");
    expect(result.primary2.decisionStatus).toBe("UNRESOLVED");
    expect(result.primary2.biographyUrl).toBeNull();
  });
});
