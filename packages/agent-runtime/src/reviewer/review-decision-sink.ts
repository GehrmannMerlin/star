import { createHash } from "node:crypto";
import type {
  ReviewerDecisionSink,
  ReviewerDecisionSubmitResult,
  ReviewerSubmissionPayload,
} from "@stellaris/agent-tools";

/**
 * In-memory Reviewer Decision freeze boundary (STEP 12).
 *
 * Runtime freeze boundary (NOT persistence — Final Decision persistence is
 * Deferred). Exactly one accepted submission per packet; the second submit
 * returns ALREADY_SUBMITTED (the tool maps it to REVIEW_DECISION_ALREADY_SUBMITTED).
 */
export class InMemoryReviewDecisionSink implements ReviewerDecisionSink {
  private submission: ReviewerSubmissionPayload | null = null;
  private payloadHash = "";

  async submit(payload: ReviewerSubmissionPayload): Promise<ReviewerDecisionSubmitResult> {
    if (this.submission) {
      return { status: "ALREADY_SUBMITTED", payloadHash: this.payloadHash };
    }
    this.submission = payload;
    this.payloadHash = createHash("sha256").update(JSON.stringify(payload)).digest("hex");
    return { status: "ACCEPTED", payloadHash: this.payloadHash };
  }

  async getSubmission(): Promise<ReviewerSubmissionPayload | null> {
    return this.submission;
  }

  async isFrozen(): Promise<boolean> {
    return this.submission !== null;
  }
}
