import { describe, expect, it } from "vitest";
import {
  MemoryToolEventSink,
  normalizeUrlForJoin,
  type ReviewerSubmissionPayload,
  type UrlCandidatePoolRow,
} from "@stellaris/agent-tools";
import {
  attestReviewRecords,
  evaluateReviewerObservation,
  poolById,
  type ReviewAttestationContext,
} from "./review-attestation.js";

const URL_A = "http://www.njgl.gov.cn/xxgk/qczc/dh/";
const URL_B = "http://www.njgl.gov.cn/xxgk/qczc/sl/";

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

const CANDIDATES = [candidate("cand-p1", "glq-target-primary1", URL_A), candidate("cand-p2", "glq-target-primary2", URL_B)];

function approvedSubmission(): ReviewerSubmissionPayload {
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

function context(eventSink: MemoryToolEventSink): ReviewAttestationContext {
  return {
    reviewerSessionId: "session-reviewer-1",
    reviewerAgentUuid: "8c8f6e0e-9a1f-4b3e-8c2d-1a2b3c4d5e6f",
    reviewerAgentId: "9d9f7f1f-0b2g-4c4f-9d3e-2b3c4d5e6f70",
    reviewerContextId: "aeae8f2f-1c3h-4d5f-ae4f-3c4d5e6f7081",
    investigatorAgentId: "step9-fixture-agent",
    investigatorContextId: "step9-fixture-context",
    eventSink,
    candidatePool: CANDIDATES,
  };
}

function now(ms = 0): string {
  return new Date(Date.parse("2026-08-14T00:00:00.000Z") + ms).toISOString();
}

async function pushOpenAndInspect(eventSink: MemoryToolEventSink, url: string, call: string): Promise<void> {
  const t = now(call === "open" ? 100 : 200);
  await eventSink.onStart({ callId: `call-${call}-${url}`, toolName: "fetch_page", context: { taskRunId: "t", agentSessionId: "session-reviewer-1", agentRole: "REVIEWER", packetId: "p", signal: new AbortController().signal }, startedAt: t });
  await eventSink.onSuccess({
    callId: `call-${call}-${url}`,
    toolName: "fetch_page",
    status: "SUCCESS",
    data: { requestedUrl: url, finalUrl: url, statusCode: 200 },
    startedAt: t,
    finishedAt: now(150),
  });
  await eventSink.onStart({ callId: `call-inspect-${url}`, toolName: "inspect_page", context: { taskRunId: "t", agentSessionId: "session-reviewer-1", agentRole: "REVIEWER", packetId: "p", signal: new AbortController().signal }, startedAt: now(200) });
  await eventSink.onSuccess({
    callId: `call-inspect-${url}`,
    toolName: "inspect_page",
    status: "SUCCESS",
    data: { url, title: "区长 董涵", leadershipMembers: [{ name: "董涵", roles: ["区长"], sortOrder: 0, href: null }] },
    startedAt: now(200),
    finishedAt: now(250),
  });
}

describe("review attestation", () => {
  it("builds canonical records with real session attestation and event IDs", async () => {
    const eventSink = new MemoryToolEventSink();
    await pushOpenAndInspect(eventSink, URL_A, "open");
    await pushOpenAndInspect(eventSink, URL_B, "open");
    await eventSink.onStart({ callId: "call-search", toolName: "search_web", context: { taskRunId: "t", agentSessionId: "session-reviewer-1", agentRole: "REVIEWER", packetId: "p", signal: new AbortController().signal }, startedAt: now(300) });
    await eventSink.onSuccess({ callId: "call-search", toolName: "search_web", status: "SUCCESS", data: { provider: "bocha", results: [] }, startedAt: now(300), finishedAt: now(350) });

    const attested = attestReviewRecords(approvedSubmission(), context(eventSink));
    expect(attested).toHaveLength(2);
    for (const review of attested) {
      expect(review.record.reviewer_real_session_id).toBe("session-reviewer-1");
      expect(review.record.investigator_agent_id).toBe("step9-fixture-agent");
      expect(review.record.review_search_event_ids).toEqual(["call-search"]);
      expect(review.record.reopen_event_id).toMatch(/^call-open-/);
      expect(review.record.review_open_event_id).toMatch(/^call-inspect-/);
      expect(review.record.observed_page_shape_signals).toMatchObject({ has_title: true, has_members: true });
      expect(review.record.review_result).toBe("APPROVED");
      expect(review.record.final_review_result).toBe("APPROVED_STRICT_ADMISSIBLE");
    }
    const primary1 = attested.find((r) => r.targetId === "glq-target-primary1");
    expect(primary1?.finalUrl).toBe(URL_A);
    expect(primary1?.selectedCandidateId).toBe("cand-p1");
  });

  it("leaves review_search_event_ids empty when the reviewer never searched", async () => {
    const eventSink = new MemoryToolEventSink();
    await pushOpenAndInspect(eventSink, URL_A, "open");
    await pushOpenAndInspect(eventSink, URL_B, "open");
    const attested = attestReviewRecords(approvedSubmission(), context(eventSink));
    expect(attested[0]?.record.review_search_event_ids).toEqual([]);
  });
});

describe("reviewer observation gate", () => {
  it("rejects an approved candidate that was never inspected by the reviewer", async () => {
    const eventSink = new MemoryToolEventSink();
    // fetch/render only for A, nothing for B
    await eventSink.onSuccess({
      callId: "call-fetch-a",
      toolName: "fetch_page",
      status: "SUCCESS",
      data: { requestedUrl: URL_A, finalUrl: URL_A, statusCode: 200 },
      startedAt: now(),
      finishedAt: now(),
    });
    const result = evaluateReviewerObservation(eventSink.successes, approvedSubmission(), poolById(CANDIDATES));
    expect(result.passed).toBe(false);
    expect(result.rows[0]?.reopened).toBe(true);
    expect(result.rows[0]?.inspected).toBe(false);
  });

  it("accepts when every approved candidate is reopened AND inspected by the reviewer", async () => {
    const eventSink = new MemoryToolEventSink();
    await pushOpenAndInspect(eventSink, URL_A, "open");
    await pushOpenAndInspect(eventSink, URL_B, "open");
    const result = evaluateReviewerObservation(eventSink.successes, approvedSubmission(), poolById(CANDIDATES));
    expect(result.passed).toBe(true);
    expect(result.rows.every((row) => row.reopened && row.inspected)).toBe(true);
  });

  it("reports searchSucceeded only when a search_web event really succeeded", async () => {
    const eventSink = new MemoryToolEventSink();
    await pushOpenAndInspect(eventSink, URL_A, "open");
    await pushOpenAndInspect(eventSink, URL_B, "open");
    const noSearch = evaluateReviewerObservation(eventSink.successes, approvedSubmission(), poolById(CANDIDATES));
    expect(noSearch.searchSucceeded).toBe(false);

    await eventSink.onSuccess({
      callId: "call-search",
      toolName: "search_web",
      status: "SUCCESS",
      data: { provider: "bocha", results: [] },
      startedAt: now(),
      finishedAt: now(),
    });
    const withSearch = evaluateReviewerObservation(eventSink.successes, approvedSubmission(), poolById(CANDIDATES));
    expect(withSearch.searchSucceeded).toBe(true);
  });

  it("normalizes URL variants (trailing slash / case / default port) when matching reviewer events", () => {
    expect(normalizeUrlForJoin("https://www.njgl.gov.cn/xxgk/qczc/dh/")).toBe(
      "https://www.njgl.gov.cn/xxgk/qczc/dh",
    );
    expect(normalizeUrlForJoin("HTTP://WWW.NJGL.GOV.CN:80/xxgk/qczc/dh/")).toBe(
      "http://www.njgl.gov.cn/xxgk/qczc/dh",
    );
  });
});
