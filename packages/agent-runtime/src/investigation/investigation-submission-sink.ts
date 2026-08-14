import { createHash } from "node:crypto";
import type {
  InvestigationSubmissionPayload,
  InvestigationSubmissionSink,
  InvestigationSubmitResult,
} from "@stellaris/agent-tools";

/** Runtime freeze boundary (NOT persistence): exactly one accepted submission. */
export class InMemoryInvestigationSubmissionSink implements InvestigationSubmissionSink {
  private submission: InvestigationSubmissionPayload | null = null;
  private payloadHash = "";

  async submit(payload: InvestigationSubmissionPayload): Promise<InvestigationSubmitResult> {
    if (this.submission) {
      return { status: "ALREADY_SUBMITTED", payloadHash: this.payloadHash };
    }
    this.submission = payload;
    this.payloadHash = createHash("sha256").update(JSON.stringify(payload)).digest("hex");
    return { status: "ACCEPTED", payloadHash: this.payloadHash };
  }

  async getSubmission(): Promise<InvestigationSubmissionPayload | null> {
    return this.submission;
  }

  async isFrozen(): Promise<boolean> {
    return this.submission !== null;
  }
}
