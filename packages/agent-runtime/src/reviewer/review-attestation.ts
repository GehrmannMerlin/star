import { randomUUID } from "node:crypto";
import {
  normalizeUrlForJoin,
  type MemoryToolEventSink,
  type ReviewerReviewResult,
  type ReviewerSubmissionPayload,
  type ToolSuccessResult,
  type UrlCandidatePoolRow,
} from "@stellaris/agent-tools";

/**
 * Reviewer session attestation (STEP 12).
 *
 * The Reviewer Agent submits a thin envelope; the runtime constructs the full
 * canonical Independent Review Record (review-record.schema.json) by attaching
 * REAL session evidence — session id, agent/context UUIDs, actual tool-call
 * IDs matched to the approved candidate URL, and observed page fields from the
 * reviewer's own inspect output. This prevents self-attested approvals: the
 * Skill requires runtime-matched call IDs.
 */

export type ReviewAttestationContext = {
  reviewerSessionId: string;
  reviewerAgentUuid: string;
  reviewerAgentId: string;
  reviewerContextId: string;
  investigatorAgentId: string;
  investigatorContextId: string;
  eventSink: MemoryToolEventSink;
  candidatePool: UrlCandidatePoolRow[];
};

export type AttestedReview = {
  /** Full canonical Independent Review Record (validated against the Skill schema). */
  record: Record<string, unknown>;
  targetId: string;
  selectedCandidateId: string | null;
  finalUrl: string | null;
  reviewResult: ReviewerReviewResult;
};

export function poolById(pool: UrlCandidatePoolRow[]): Map<string, UrlCandidatePoolRow> {
  const map = new Map<string, UrlCandidatePoolRow>();
  for (const candidate of pool) {
    if (typeof candidate.candidate_id === "string" && candidate.candidate_id.length > 0) {
      map.set(candidate.candidate_id, candidate);
    }
  }
  return map;
}

function matchesUrl(data: unknown, normUrl: string): boolean {
  const record = (data ?? {}) as Record<string, unknown> | undefined;
  for (const key of ["requestedUrl", "finalUrl", "url"] as const) {
    const value = record?.[key];
    if (typeof value === "string" && value.length > 0 && normalizeUrlForJoin(value) === normUrl) {
      return true;
    }
  }
  return false;
}

function shapeSignals(data: Record<string, unknown> | undefined): Record<string, boolean> {
  const signals: Record<string, boolean> = {};
  if (typeof data?.title === "string" && data.title.length > 0) signals.has_title = true;
  if (Array.isArray(data?.leadershipMembers) && data.leadershipMembers.length > 0) {
    signals.has_members = true;
  }
  if (Array.isArray(data?.links) && data.links.length > 0) signals.has_links = true;
  return signals;
}

/** Build the runtime-attested canonical review records for the frozen submission. */
export function attestReviewRecords(
  submission: ReviewerSubmissionPayload,
  ctx: ReviewAttestationContext,
): AttestedReview[] {
  const byId = poolById(ctx.candidatePool);
  const successes = ctx.eventSink.successes;
  const startedCallIds = ctx.eventSink.starts.map((event) => event.callId);
  const searchEventIds = successes
    .filter((event) => event.toolName === "search_web")
    .map((event) => event.callId);
  const reviewedAt = new Date().toISOString();

  return submission.reviews.map((review) => {
    const candidate =
      review.selected_candidate_id !== null ? byId.get(review.selected_candidate_id) : undefined;
    const url = candidate && typeof candidate.url === "string" ? candidate.url : null;
    const normUrl = url ? normalizeUrlForJoin(url) : "";

    const reopenEvent = url
      ? successes.find(
          (event) =>
            (event.toolName === "fetch_page" || event.toolName === "render_page") &&
            matchesUrl(event.data, normUrl),
        )
      : undefined;
    const openEvent = url
      ? successes.find(
          (event) => event.toolName === "inspect_page" && matchesUrl(event.data, normUrl),
        )
      : undefined;
    const inspectData = openEvent?.data as Record<string, unknown> | undefined;

    const record: Record<string, unknown> = {
      review_id: randomUUID(),
      assignment_id: randomUUID(),
      target_id: review.target_id,
      investigator_agent_id: ctx.investigatorAgentId,
      investigator_context_id: ctx.investigatorContextId,
      recovery_agent_id: null,
      recovery_context_id: null,
      reviewer_real_session_id: ctx.reviewerSessionId,
      reviewer_agent_uuid: ctx.reviewerAgentUuid,
      reviewer_agent_id: ctx.reviewerAgentId,
      reviewer_context_id: ctx.reviewerContextId,
      review_tool_call_ids: startedCallIds.length > 0 ? startedCallIds : [reopenEvent?.callId ?? "none"],
      review_open_event_id: openEvent?.callId ?? null,
      review_search_event_ids: searchEventIds,
      reopen_event_id: reopenEvent?.callId ?? null,
      research_event_id: null,
      observed_page_title: typeof inspectData?.title === "string" ? inspectData.title : null,
      observed_breadcrumb:
        Array.isArray(inspectData?.breadcrumb) && inspectData.breadcrumb.length > 0
          ? inspectData.breadcrumb.join(" / ")
          : null,
      observed_domain_owner: null,
      observed_page_shape: review.observed_page_shape ?? null,
      observed_source_domain_class: review.observed_source_domain_class ?? null,
      observed_page_shape_signals: shapeSignals(inspectData),
      final_page_type: review.final_page_type ?? null,
      currentness_quality: review.currentness_quality,
      checks: review.checks,
      review_result: review.review_result,
      final_review_result: review.final_review_result,
      review_reason: review.review_reason,
      reviewed_at: reviewedAt,
    };

    return {
      record,
      targetId: review.target_id,
      selectedCandidateId: review.selected_candidate_id,
      finalUrl: url,
      reviewResult: review.review_result,
    };
  });
}

export type ReviewerObservationRow = {
  targetId: string;
  url: string;
  reopened: boolean;
  inspected: boolean;
};

export type ReviewerObservationResult = {
  rows: ReviewerObservationRow[];
  searchSucceeded: boolean;
  passed: boolean;
};

/**
 * Reviewer observation gate: every APPROVED candidate must be really reopened
 * (fetch_page/render_page SUCCESS) and really inspected (inspect_page SUCCESS)
 * in the Reviewer session. Search results never count. REWORK/REJECTED reviews
 * are skipped (no final URL claimed).
 */
export function evaluateReviewerObservation(
  successes: readonly ToolSuccessResult<unknown>[],
  submission: ReviewerSubmissionPayload,
  byId: Map<string, UrlCandidatePoolRow>,
): ReviewerObservationResult {
  const searchSucceeded = successes.some((event) => event.toolName === "search_web");
  const rows: ReviewerObservationRow[] = [];
  let passed = true;
  for (const review of submission.reviews) {
    if (review.review_result !== "APPROVED" || review.selected_candidate_id === null) continue;
    const candidate = byId.get(review.selected_candidate_id);
    const url = candidate && typeof candidate.url === "string" ? candidate.url : "";
    const norm = url.length > 0 ? normalizeUrlForJoin(url) : "";
    const reopened =
      norm.length > 0 &&
      successes.some(
        (event) =>
          (event.toolName === "fetch_page" || event.toolName === "render_page") &&
          matchesUrl(event.data, norm),
      );
    const inspected =
      norm.length > 0 &&
      successes.some(
        (event) => event.toolName === "inspect_page" && matchesUrl(event.data, norm),
      );
    if (!reopened || !inspected) passed = false;
    rows.push({ targetId: review.target_id, url, reopened, inspected });
  }
  return { rows, searchSucceeded, passed };
}
