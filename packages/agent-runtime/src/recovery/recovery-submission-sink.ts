import { createHash } from "node:crypto";
import type {
  RecoverySubmissionPayload,
  RecoverySubmissionSink,
  RecoverySubmitResult,
} from "@stellaris/agent-tools";

/**
 * In-memory Recovery Supplement freeze boundary (STEP 13).
 *
 * Runtime freeze boundary (NOT persistence — persistent recovery submission is
 * Deferred). Exactly one accepted submission per packet; the second submit
 * returns ALREADY_SUBMITTED (the tool maps it to RECOVERY_ALREADY_SUBMITTED).
 */
export class InMemoryRecoverySubmissionSink implements RecoverySubmissionSink {
  private submission: RecoverySubmissionPayload | null = null;
  private payloadHash = "";

  async submit(payload: RecoverySubmissionPayload): Promise<RecoverySubmitResult> {
    if (this.submission) {
      return { status: "ALREADY_SUBMITTED", payloadHash: this.payloadHash };
    }
    this.submission = payload;
    this.payloadHash = createHash("sha256").update(JSON.stringify(payload)).digest("hex");
    return { status: "ACCEPTED", payloadHash: this.payloadHash };
  }

  async getSubmission(): Promise<RecoverySubmissionPayload | null> {
    return this.submission;
  }

  async isFrozen(): Promise<boolean> {
    return this.submission !== null;
  }
}
