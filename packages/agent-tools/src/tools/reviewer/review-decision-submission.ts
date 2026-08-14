import type { SubmissionValidation } from "../inventory/inventory-submission.js";

/**
 * Provider-neutral Reviewer Decision contracts (STEP 12).
 *
 * The Reviewer produces one independent review per frozen PRIMARY target. The
 * runtime envelope is thin transport: it carries the canonical outcome enums,
 * review reason, currentness, checks, and a runtime `selected_candidate_id`
 * pointer into the frozen candidate pool. It deliberately does NOT duplicate
 * the Skill domain — the full canonical Independent Review Record
 * (review-record.schema.json, "Independent Review Record") is constructed by
 * the runtime with real session attestation (session id, agent/context UUIDs,
 * real tool-call IDs, observed page fields) and validated against the pinned
 * Skill schema through SkillSchemaRegistry.
 */

export const REVIEWER_REVIEW_RESULTS = ["APPROVED", "REJECTED", "REWORK_REQUIRED"] as const;
export type ReviewerReviewResult = (typeof REVIEWER_REVIEW_RESULTS)[number];

export const REVIEWER_FINAL_REVIEW_RESULTS = [
  "APPROVED_STRICT_ADMISSIBLE",
  "APPROVED_EMPTY_AFTER_EXHAUSTION",
  "REJECTED_INVALID_URL",
  "REWORK_REQUIRED",
] as const;
export type ReviewerFinalReviewResult = (typeof REVIEWER_FINAL_REVIEW_RESULTS)[number];

export const REVIEWER_CURRENTNESS_QUALITIES = [
  "CURRENT_COLLECTION_MEMBER",
  "DETAIL_LINKED_FROM_CURRENT_COLLECTION",
  "RECENT_CURRENT_OFFICIAL_EVIDENCE",
  "DETAIL_NOT_IN_CURRENT_COLLECTION",
  "DETAIL_COLLECTION_CONFLICT",
  "CURRENTNESS_UNRESOLVED",
] as const;
export type ReviewerCurrentnessQuality = (typeof REVIEWER_CURRENTNESS_QUALITIES)[number];

/** Canonical review-record `checks` block (8 booleans, verbatim from the Skill). */
export type ReviewerChecks = {
  person_and_institution: boolean;
  page_type: boolean;
  better_personal_page: boolean;
  news_or_function_page_rejected: boolean;
  currentness: boolean;
  all_discovered_evidence_consumed: boolean;
  empty_search_complete: boolean;
  dynamic_escalation_complete: boolean;
};

/**
 * One per-target review as submitted by the Reviewer Agent.
 * `selected_candidate_id` is a runtime pointer into the frozen candidate pool:
 * non-null only when approving a pool candidate as the Final Position URL.
 */
export type ReviewerTargetReviewInput = {
  target_id: string;
  selected_candidate_id: string | null;
  review_result: ReviewerReviewResult;
  final_review_result: ReviewerFinalReviewResult;
  review_reason: string;
  currentness_quality: ReviewerCurrentnessQuality;
  checks: ReviewerChecks;
  observed_source_domain_class?: string | null;
  observed_page_shape?: string | null;
  final_page_type?: string | null;
  recovery_trigger_codes?: string[];
};

/** Thin runtime transport envelope (one review per frozen PRIMARY target). */
export type ReviewerSubmissionPayload = {
  reviews: ReviewerTargetReviewInput[];
};

export type ReviewerDecisionSubmitResult =
  | { status: "ACCEPTED"; payloadHash: string }
  | { status: "ALREADY_SUBMITTED"; payloadHash: string };

/** Freeze boundary: exactly one accepted submission per packet. */
export interface ReviewerDecisionSink {
  submit(payload: ReviewerSubmissionPayload): Promise<ReviewerDecisionSubmitResult>;
  getSubmission(): Promise<ReviewerSubmissionPayload | null>;
  isFrozen(): Promise<boolean>;
}

/** Validates the runtime-attested canonical review records (review-record.schema.json). */
export interface ReviewerSubmissionValidator {
  validate(records: unknown[]): SubmissionValidation;
}
