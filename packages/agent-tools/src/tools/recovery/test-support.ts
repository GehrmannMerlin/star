import type {
  RecoverySubmissionPayload,
  RecoverySubmissionSink,
  RecoverySubmitResult,
} from './recovery-submission.js';

/** Test-only in-memory recovery submission freeze boundary. */
export class InMemoryRecoverySink implements RecoverySubmissionSink {
  private submission: RecoverySubmissionPayload | null = null;

  async submit(payload: RecoverySubmissionPayload): Promise<RecoverySubmitResult> {
    if (this.submission) {
      return { status: 'ALREADY_SUBMITTED', payloadHash: 'already' };
    }
    this.submission = payload;
    return { status: 'ACCEPTED', payloadHash: 'hash-1' };
  }

  async getSubmission(): Promise<RecoverySubmissionPayload | null> {
    return this.submission;
  }

  async isFrozen(): Promise<boolean> {
    return this.submission !== null;
  }
}
