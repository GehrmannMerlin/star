import { Type, type Static } from "@sinclair/typebox";
import { ToolFailureCode, ToolFailureError } from "../../contracts/tool-failure-codes.js";
import type { AgentToolDefinition } from "../../contracts/tool-types.js";
import type { EvidencePrimaryDecision } from "../evidence/investigator-evidence-submission.js";
import type {
  ReviewerDecisionSink,
  ReviewerSubmissionPayload,
} from "./review-decision-submission.js";

const checksSchema = Type.Object(
  {
    person_and_institution: Type.Boolean(),
    page_type: Type.Boolean(),
    better_personal_page: Type.Boolean(),
    news_or_function_page_rejected: Type.Boolean(),
    currentness: Type.Boolean(),
    all_discovered_evidence_consumed: Type.Boolean(),
    empty_search_complete: Type.Boolean(),
    dynamic_escalation_complete: Type.Boolean(),
  },
  { additionalProperties: false },
);

const reviewSchema = Type.Object(
  {
    target_id: Type.String({ minLength: 1 }),
    selected_candidate_id: Type.Union([Type.String({ minLength: 1 }), Type.Null()]),
    review_result: Type.Union([
      Type.Literal("APPROVED"),
      Type.Literal("REJECTED"),
      Type.Literal("REWORK_REQUIRED"),
    ]),
    final_review_result: Type.Union([
      Type.Literal("APPROVED_STRICT_ADMISSIBLE"),
      Type.Literal("APPROVED_EMPTY_AFTER_EXHAUSTION"),
      Type.Literal("REJECTED_INVALID_URL"),
      Type.Literal("REWORK_REQUIRED"),
    ]),
    review_reason: Type.String({ minLength: 1 }),
    currentness_quality: Type.Union([
      Type.Literal("CURRENT_COLLECTION_MEMBER"),
      Type.Literal("DETAIL_LINKED_FROM_CURRENT_COLLECTION"),
      Type.Literal("RECENT_CURRENT_OFFICIAL_EVIDENCE"),
      Type.Literal("DETAIL_NOT_IN_CURRENT_COLLECTION"),
      Type.Literal("DETAIL_COLLECTION_CONFLICT"),
      Type.Literal("CURRENTNESS_UNRESOLVED"),
    ]),
    checks: checksSchema,
    observed_source_domain_class: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    observed_page_shape: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    final_page_type: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    recovery_trigger_codes: Type.Optional(Type.Array(Type.String())),
  },
  { additionalProperties: false },
);

export const SubmitReviewDecisionInput = Type.Object(
  { reviews: Type.Array(reviewSchema, { minItems: 1 }) },
  { additionalProperties: false },
);

export type SubmitReviewDecisionInput = Static<typeof SubmitReviewDecisionInput>;

export type SubmitReviewDecisionSuccess = {
  status: "ACCEPTED";
  frozen: true;
  reviewCount: number;
  approvedCount: number;
  reworkCount: number;
  payloadHash: string;
};

export type SubmitReviewDecisionToolDeps = {
  sink: ReviewerDecisionSink;
  /** Frozen PRIMARY person decisions (deterministic target join). */
  primaryDecisions: EvidencePrimaryDecision[];
  /** Frozen Position URL Candidate Pool rows (url-candidate-pool.schema.json). */
  candidatePool: Record<string, unknown>[];
};

const APPROVED_FINAL_RESULTS = new Set([
  "APPROVED_STRICT_ADMISSIBLE",
  "APPROVED_EMPTY_AFTER_EXHAUSTION",
]);

/**
 * Reviewer output boundary tool.
 *
 * The Reviewer knows only `submit_review_decision`. The tool enforces the
 * deterministic runtime gates — PRIMARY join, candidate membership, outcome
 * consistency, freeze — but performs NO semantic ranking and NO source/page
 * re-classification. Judgment is Pi + Skill; TypeScript validates, joins,
 * gates and freezes only. The canonical Independent Review Record is built and
 * validated by the runner against review-record.schema.json.
 */
export function createSubmitReviewDecisionTool(
  deps: SubmitReviewDecisionToolDeps,
): AgentToolDefinition<typeof SubmitReviewDecisionInput, SubmitReviewDecisionSuccess> {
  return {
    name: "submit_review_decision",
    description:
      "Submit the independent Review Decision for the frozen PRIMARY_1/PRIMARY_2 of the current institution. One review per PRIMARY target is required. The approved Final Position URL candidate must belong to the frozen candidate pool; approve only what you really reopened and inspected in this session. If the frozen pool is insufficient, use REWORK_REQUIRED and leave selected_candidate_id null — never fabricate or select a URL outside the pool. Exactly one submission is accepted per packet.",
    inputSchema: SubmitReviewDecisionInput,
    async execute(_context, input) {
      const primary1 = deps.primaryDecisions.find((d) => d.primarySlot === "PRIMARY_1");
      const primary2 = deps.primaryDecisions.find((d) => d.primarySlot === "PRIMARY_2");
      if (!primary1 || !primary2) {
        throw new ToolFailureError({
          code: ToolFailureCode.INVALID_INPUT,
          message: "submit_review_decision requires both frozen PRIMARY decisions",
          retryable: false,
        });
      }

      const frozenTargetIds = new Set(deps.primaryDecisions.map((d) => d.targetId));
      const requiredTargetIds = [primary1.targetId, primary2.targetId];

      // PRIMARY join gate: every review must target a frozen PRIMARY; no third person.
      for (const review of input.reviews) {
        if (!frozenTargetIds.has(review.target_id)) {
          throw new ToolFailureError({
            code: ToolFailureCode.REVIEW_UNKNOWN_PRIMARY_TARGET,
            message: `review target_id ${review.target_id} is not a frozen PRIMARY`,
            retryable: false,
          });
        }
      }
      // Coverage: PRIMARY_1 and PRIMARY_2 each reviewed exactly once.
      const covered = new Map<string, number>();
      for (const review of input.reviews) {
        covered.set(review.target_id, (covered.get(review.target_id) ?? 0) + 1);
      }
      for (const targetId of requiredTargetIds) {
        if (covered.get(targetId) !== 1) {
          throw new ToolFailureError({
            code: ToolFailureCode.REVIEW_TARGET_COVERAGE_REQUIRED,
            message: `each frozen PRIMARY target must be reviewed exactly once (missing/extra: ${targetId})`,
            retryable: false,
          });
        }
      }

      // Candidate membership + outcome consistency gates.
      const poolCandidateIds = new Set(
        deps.candidatePool
          .map((candidate) => (typeof candidate.candidate_id === "string" ? candidate.candidate_id : ""))
          .filter((id) => id.length > 0),
      );
      for (const review of input.reviews) {
        if (review.selected_candidate_id !== null && !poolCandidateIds.has(review.selected_candidate_id)) {
          throw new ToolFailureError({
            code: ToolFailureCode.REVIEW_CANDIDATE_NOT_IN_POOL,
            message: `selected_candidate_id ${review.selected_candidate_id} is not a member of the frozen candidate pool`,
            retryable: false,
          });
        }
        const approved = review.review_result === "APPROVED";
        if (approved) {
          const admissible =
            review.final_review_result !== undefined &&
            APPROVED_FINAL_RESULTS.has(review.final_review_result);
          if (!admissible || review.selected_candidate_id === null) {
            throw new ToolFailureError({
              code: ToolFailureCode.REVIEW_OUTCOME_INCONSISTENT,
              message: `APPROVED review for ${review.target_id} must select a pool candidate with an APPROVED_* final_review_result`,
              retryable: false,
            });
          }
        } else if (review.selected_candidate_id !== null) {
          throw new ToolFailureError({
            code: ToolFailureCode.REVIEW_OUTCOME_INCONSISTENT,
            message: `non-APPROVED review for ${review.target_id} must not select a final candidate`,
            retryable: false,
          });
        }
      }

      const payload: ReviewerSubmissionPayload = { reviews: input.reviews as ReviewerSubmissionPayload["reviews"] };
      const result = await deps.sink.submit(payload);
      if (result.status === "ALREADY_SUBMITTED") {
        throw new ToolFailureError({
          code: ToolFailureCode.REVIEW_DECISION_ALREADY_SUBMITTED,
          message: "Review decision already submitted and frozen for this packet",
          retryable: false,
        });
      }

      const approvedCount = input.reviews.filter((review) => review.review_result === "APPROVED").length;
      const reworkCount = input.reviews.filter(
        (review) => review.review_result !== "APPROVED",
      ).length;
      return {
        status: "ACCEPTED",
        frozen: true,
        reviewCount: input.reviews.length,
        approvedCount,
        reworkCount,
        payloadHash: result.payloadHash,
      };
    },
  };
}
