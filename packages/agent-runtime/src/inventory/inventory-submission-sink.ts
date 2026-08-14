import { createHash } from "node:crypto";
import type {
  InventorySubmissionPayload,
  InventorySubmissionSink,
  InventorySubmitResult,
} from "@stellaris/agent-tools";

/** Runtime freeze boundary (NOT persistence): exactly one accepted submission. */
export class InMemoryInventorySubmissionSink implements InventorySubmissionSink {
  private submission: InventorySubmissionPayload | null = null;
  private payloadHash = "";

  async submit(payload: InventorySubmissionPayload): Promise<InventorySubmitResult> {
    if (this.submission) {
      return { status: "ALREADY_SUBMITTED", payloadHash: this.payloadHash };
    }
    this.submission = payload;
    this.payloadHash = createHash("sha256").update(JSON.stringify(payload)).digest("hex");
    return { status: "ACCEPTED", payloadHash: this.payloadHash };
  }

  async getSubmission(): Promise<InventorySubmissionPayload | null> {
    return this.submission;
  }

  async isFrozen(): Promise<boolean> {
    return this.submission !== null;
  }
}
