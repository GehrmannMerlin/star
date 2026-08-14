import { describe, expect, it } from "vitest";
import type { ReviewerChecks, ReviewerSubmissionPayload, UrlCandidatePoolRow } from "@stellaris/agent-tools";
import { FakePacketRepo, FakeReviewDecisionRepo } from "../persistence/persistence-test-support.js";
import { PostgresInstitutionWorkPacketStore } from "../work-packet/institution-work-packet.js";
import { PostgresReviewDecisionReader } from "../persistence/review-decision-reader.js";
import { PostgresReviewDecisionSink } from "../persistence/postgres-review-decision-sink.js";
import { BiographyUrlResultReader } from "./biography-url-result.js";

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

const POOL: UrlCandidatePoolRow[] = [
  { candidate_id: "cand-p1", target_id: "glq-target-primary1", url: "http://www.njgl.gov.cn/xxgk/qczc/dh/" },
  { candidate_id: "cand-p2", target_id: "glq-target-primary2", url: "http://www.njgl.gov.cn/xxgk/qczc/sl/" },
];

function approvedPayload(): ReviewerSubmissionPayload {
  return {
    reviews: [
      {
        target_id: "glq-target-primary1",
        selected_candidate_id: "cand-p1",
        review_result: "APPROVED",
        final_review_result: "APPROVED_STRICT_ADMISSIBLE",
        review_reason: "verified",
        currentness_quality: "CURRENT_COLLECTION_MEMBER",
        checks: CHECKS,
      },
      {
        target_id: "glq-target-primary2",
        selected_candidate_id: "cand-p2",
        review_result: "APPROVED",
        final_review_result: "APPROVED_STRICT_ADMISSIBLE",
        review_reason: "verified",
        currentness_quality: "CURRENT_COLLECTION_MEMBER",
        checks: CHECKS,
      },
    ],
  };
}

describe("BiographyUrlResult rehydrate", () => {
  it("new Packet Store + new Review Reader → 重新生成相同 Biography Result", async () => {
    const packetRepo = new FakePacketRepo();
    const reviewRepo = new FakeReviewDecisionRepo();

    // 第一次实例：持久化 packet + 冻结 APPROVED review。
    const store = new PostgresInstitutionWorkPacketStore(packetRepo);
    const packet = (await store.createFromFrozenInventory(
      {
        inventory: [
          {
            institution_id: "glq-people-gov",
            standard_name: "鼓楼区人民政府",
            administrative_level: "COUNTY",
            core_institution_type: "GOVERNMENT",
            decision: "INCLUDE",
          },
        ],
      },
      { regionCode: "320106" },
    ))[0]!;
    await store.updateState(packet.packetId, "INVESTIGATING", {
      investigatorSessionId: "sess-1",
    });
    await store.updateState(packet.packetId, "EVIDENCE_PENDING");
    await store.updateState(packet.packetId, "EVIDENCE_GATHERING");
    await store.updateState(packet.packetId, "READY_FOR_REVIEW");
    await store.updateState(packet.packetId, "REVIEWING", {
      investigatorSessionId: "sess-r1",
    });
    await store.updateState(packet.packetId, "POSITION_DECIDED");
    await store.setPrimaryPersons(packet.packetId, {
      primary1: { targetId: "glq-target-primary1", personId: "person-1", personName: "董涵" },
      primary2: { targetId: "glq-target-primary2", personId: "person-2", personName: "石磊" },
    });

    const sink = new PostgresReviewDecisionSink(reviewRepo, {
      packetId: packet.packetId,
      reviewRound: 1,
      agentRole: "REVIEWER",
      skill: { name: "official-biography-evidence", version: "3.1.0" },
    });
    const submitted = await sink.submit(approvedPayload());
    expect(submitted.status).toBe("ACCEPTED");

    const loadPool = async (): Promise<UrlCandidatePoolRow[]> => POOL;

    // reader1：初始实例。
    const reader1 = new BiographyUrlResultReader({
      packetStore: store,
      reviewReader: new PostgresReviewDecisionReader(reviewRepo),
      loadCandidatePool: loadPool,
    });
    const result1 = await reader1.read(packet.packetId);

    // reader2：全新实例（new Packet Store + new Review Reader），同一持久化数据。
    const reader2 = new BiographyUrlResultReader({
      packetStore: new PostgresInstitutionWorkPacketStore(packetRepo),
      reviewReader: new PostgresReviewDecisionReader(reviewRepo),
      loadCandidatePool: loadPool,
    });
    const result2 = await reader2.read(packet.packetId);

    expect(result2).toEqual(result1);
    expect(result2?.status).toBe("RESOLVED");
    expect(result2?.primary1.biographyUrl).toBe("http://www.njgl.gov.cn/xxgk/qczc/dh/");
    expect(result2?.primary2.biographyUrl).toBe("http://www.njgl.gov.cn/xxgk/qczc/sl/");
    expect(result2?.sourceOfTruth).toBe("LATEST_FROZEN_APPROVED_REVIEW");
    expect(result1).not.toBeNull();
  });
});
