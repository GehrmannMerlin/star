import { describe, expect, it } from "vitest";
import type { EvidencePrimaryDecision, UrlCandidatePoolRow } from "@stellaris/agent-tools";
import { ToolFailureCode, createSubmitReviewDecisionTool } from "@stellaris/agent-tools";
import { InMemoryReviewDecisionSink } from "./review-decision-sink.js";

const URL_A = "http://www.njgl.gov.cn/xxgk/qczc/dh/";
const URL_B = "http://www.njgl.gov.cn/xxgk/qczc/sl/";

const PRIMARY_1: EvidencePrimaryDecision = {
  targetId: "glq-target-primary1",
  personId: "person-dong-han",
  personName: "董涵",
  primarySlot: "PRIMARY_1",
};
const PRIMARY_2: EvidencePrimaryDecision = {
  targetId: "glq-target-primary2",
  personId: "person-shi-lei",
  personName: "石磊",
  primarySlot: "PRIMARY_2",
};

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

const CANDIDATES = [
  candidate("cand-p1", "glq-target-primary1", URL_A),
  candidate("cand-p2", "glq-target-primary2", URL_B),
];

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

function approvedReview(targetId: string, candidateId: string) {
  return {
    target_id: targetId,
    selected_candidate_id: candidateId,
    review_result: "APPROVED" as const,
    final_review_result: "APPROVED_STRICT_ADMISSIBLE" as const,
    review_reason: "official district government leader profile page verified",
    currentness_quality: "CURRENT_COLLECTION_MEMBER" as const,
    checks: CHECKS,
  };
}

function toolDeps(sink: InMemoryReviewDecisionSink) {
  return createSubmitReviewDecisionTool({
    sink,
    primaryDecisions: [PRIMARY_1, PRIMARY_2],
    candidatePool: CANDIDATES,
  });
}

async function execute(tool: ReturnType<typeof toolDeps>, input: unknown) {
  return tool.execute(
    {
      taskRunId: "task-1",
      agentSessionId: "session-1",
      agentRole: "REVIEWER",
      packetId: "packet-1",
      signal: new AbortController().signal,
    },
    input as never,
  );
}

function expectToolFailure(error: unknown): { code: string } {
  const failure = (error as { code?: string }) ?? {};
  expect(typeof error).toBe("object");
  return failure as { code: string };
}

describe("InMemoryReviewDecisionSink", () => {
  it("accepts once and freezes; second submit is ALREADY_SUBMITTED", async () => {
    const sink = new InMemoryReviewDecisionSink();
    const payload = { reviews: [approvedReview("glq-target-primary1", "cand-p1")] };
    const first = await sink.submit(payload);
    expect(first.status).toBe("ACCEPTED");
    expect(await sink.isFrozen()).toBe(true);
    expect(await sink.getSubmission()).toEqual(payload);

    const second = await sink.submit(payload);
    expect(second.status).toBe("ALREADY_SUBMITTED");
  });
});

describe("submit_review_decision deterministic gates", () => {
  it("accepts a valid two-PRIMARY approved decision", async () => {
    const sink = new InMemoryReviewDecisionSink();
    const result = await execute(toolDeps(sink), {
      reviews: [approvedReview("glq-target-primary1", "cand-p1"), approvedReview("glq-target-primary2", "cand-p2")],
    });
    expect(result).toMatchObject({ status: "ACCEPTED", frozen: true, approvedCount: 2, reworkCount: 0 });
  });

  it("rejects a duplicate submission", async () => {
    const sink = new InMemoryReviewDecisionSink();
    const tool = toolDeps(sink);
    await execute(tool, {
      reviews: [approvedReview("glq-target-primary1", "cand-p1"), approvedReview("glq-target-primary2", "cand-p2")],
    });
    try {
      await execute(tool, {
        reviews: [approvedReview("glq-target-primary1", "cand-p1"), approvedReview("glq-target-primary2", "cand-p2")],
      });
      expect.unreachable("duplicate should throw");
    } catch (error) {
      expect(expectToolFailure(error).code).toBe(ToolFailureCode.REVIEW_DECISION_ALREADY_SUBMITTED);
    }
  });

  it("rejects an unknown candidate ref (not in the frozen pool)", async () => {
    const sink = new InMemoryReviewDecisionSink();
    try {
      await execute(toolDeps(sink), {
        reviews: [
          { ...approvedReview("glq-target-primary1", "not-in-pool"), final_review_result: "APPROVED_STRICT_ADMISSIBLE" },
          approvedReview("glq-target-primary2", "cand-p2"),
        ],
      });
      expect.unreachable("unknown candidate should throw");
    } catch (error) {
      expect(expectToolFailure(error).code).toBe(ToolFailureCode.REVIEW_CANDIDATE_NOT_IN_POOL);
    }
  });

  it("rejects a decision targeting an unknown third person (PRIMARY join)", async () => {
    const sink = new InMemoryReviewDecisionSink();
    try {
      await execute(toolDeps(sink), {
        reviews: [
          { ...approvedReview("glq-target-primary1", "cand-p1"), target_id: "unknown-third-person" },
          approvedReview("glq-target-primary2", "cand-p2"),
        ],
      });
      expect.unreachable("unknown target should throw");
    } catch (error) {
      expect(expectToolFailure(error).code).toBe(ToolFailureCode.REVIEW_UNKNOWN_PRIMARY_TARGET);
    }
  });

  it("rejects missing PRIMARY coverage", async () => {
    const sink = new InMemoryReviewDecisionSink();
    try {
      await execute(toolDeps(sink), {
        reviews: [approvedReview("glq-target-primary1", "cand-p1")],
      });
      expect.unreachable("missing coverage should throw");
    } catch (error) {
      expect(expectToolFailure(error).code).toBe(ToolFailureCode.REVIEW_TARGET_COVERAGE_REQUIRED);
    }
  });

  it("rejects an APPROVED review with a null candidate (outcome inconsistent)", async () => {
    const sink = new InMemoryReviewDecisionSink();
    try {
      await execute(toolDeps(sink), {
        reviews: [
          { ...approvedReview("glq-target-primary1", "cand-p1"), selected_candidate_id: null },
          approvedReview("glq-target-primary2", "cand-p2"),
        ],
      });
      expect.unreachable("inconsistent outcome should throw");
    } catch (error) {
      expect(expectToolFailure(error).code).toBe(ToolFailureCode.REVIEW_OUTCOME_INCONSISTENT);
    }
  });

  it("accepts a REWORK_REQUIRED review with a null candidate", async () => {
    const sink = new InMemoryReviewDecisionSink();
    const result = await execute(toolDeps(sink), {
      reviews: [
        approvedReview("glq-target-primary1", "cand-p1"),
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
    });
    expect(result).toMatchObject({ status: "ACCEPTED", approvedCount: 1, reworkCount: 1 });
  });
});
