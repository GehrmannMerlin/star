import { createHash } from "node:crypto";
import type {
  InvestigatorEvidenceSubmissionPayload,
  InvestigatorEvidenceSubmissionSink,
  InvestigatorEvidenceSubmitResult,
} from "@stellaris/agent-tools";

/** Runtime freeze boundary (NOT persistence): exactly one accepted submission. */
export class InMemoryInvestigatorEvidenceSubmissionSink
  implements InvestigatorEvidenceSubmissionSink
{
  private submission: InvestigatorEvidenceSubmissionPayload | null = null;
  private payloadHash = "";

  async submit(
    payload: InvestigatorEvidenceSubmissionPayload,
  ): Promise<InvestigatorEvidenceSubmitResult> {
    if (this.submission) {
      return { status: "ALREADY_SUBMITTED", payloadHash: this.payloadHash };
    }
    this.submission = payload;
    this.payloadHash = createHash("sha256").update(JSON.stringify(payload)).digest("hex");
    return { status: "ACCEPTED", payloadHash: this.payloadHash };
  }

  async getSubmission(): Promise<InvestigatorEvidenceSubmissionPayload | null> {
    return this.submission;
  }

  async isFrozen(): Promise<boolean> {
    return this.submission !== null;
  }
}
