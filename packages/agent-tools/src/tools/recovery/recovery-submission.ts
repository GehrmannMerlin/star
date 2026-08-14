import type { SubmissionValidation } from '../inventory/inventory-submission.js';
import type { UrlCandidatePoolRow } from '../evidence/investigator-evidence-submission.js';

/**
 * Provider-neutral Recovery submission contracts (STEP 13).
 *
 * The Recovery Agent supplements the frozen Position URL Candidate Pool for the
 * reviewer-identified gap. `candidates` are canonical url-candidate-pool rows
 * (the Recovery Supplement); `supplements` are thin per-target envelopes. The
 * full canonical Recovery Record (recovery-record.schema.json, "Recovery
 * Record") is constructed by the runtime with real session attestation
 * (session id, agent/context UUIDs, real tool-call IDs) and validated against
 * the pinned Skill schema through SkillSchemaRegistry.
 */

export const RECOVERY_OUTCOMES = [
  'RECOVERED_QUALIFIED_URL',
  'NO_QUALIFIED_URL_AFTER_COMPLETE_SEARCH',
  'PERSON_OR_ROLE_NEEDS_RECHECK',
] as const;
export type RecoveryOutcome = (typeof RECOVERY_OUTCOMES)[number];

/** Canonical recovery-record `access_attempt_sequence` enum (verbatim from the Skill). */
export const RECOVERY_ACCESS_ATTEMPTS = [
  'STANDARD_OPEN',
  'BROWSER_RENDER',
  'JS_WAIT',
  'SITE_NAVIGATION',
  'OFFICIAL_DOMAIN_EXACT_SEARCH',
  'PERSON_TITLE_SEARCH',
  'ALTERNATE_OFFICIAL_VERSION',
  'SUPERIOR_OFFICIAL_CURRENT_LEADER',
] as const;
export type RecoveryAccessAttempt = (typeof RECOVERY_ACCESS_ATTEMPTS)[number];

/** Thin per-target Recovery supplement envelope (runtime attests the canonical record). */
export type RecoveryTargetSupplementInput = {
  /** Frozen PRIMARY target the Reviewer flagged (REWORK_REQUIRED). */
  target_id: string;
  outcome: RecoveryOutcome;
  /** Pointer into `candidates`; required when outcome = RECOVERED_QUALIFIED_URL. */
  candidate_id: string | null;
  /** Recovery failure codes observed this session. */
  failure_codes: string[];
  /** Skill requirement: the official leader section was really checked this session. */
  leader_section_checked: boolean;
  /** Skill requirement: the personal entry was really checked this session. */
  personal_entry_checked: boolean;
  currentness_conflict_resolved: boolean;
  /** Specific Chinese reason when no qualified URL was recovered (else null). */
  remaining_empty_reason: string | null;
};

/** Thin runtime transport envelope: NEW candidates + per-target supplements. */
export type RecoverySubmissionPayload = {
  /** NEW Position URL Candidate Pool rows (url-candidate-pool.schema.json) — the Recovery Supplement. */
  candidates: UrlCandidatePoolRow[];
  /** Per-target Recovery supplement envelopes. */
  supplements: RecoveryTargetSupplementInput[];
};

export type RecoverySubmitResult =
  | { status: 'ACCEPTED'; payloadHash: string }
  | { status: 'ALREADY_SUBMITTED'; payloadHash: string };

/** Freeze boundary: exactly one accepted submission per packet. */
export interface RecoverySubmissionSink {
  submit(payload: RecoverySubmissionPayload): Promise<RecoverySubmitResult>;
  getSubmission(): Promise<RecoverySubmissionPayload | null>;
  isFrozen(): Promise<boolean>;
}

/** Validates the runtime-attested canonical Recovery Records (recovery-record.schema.json). */
export interface RecoverySubmissionValidator {
  validate(records: unknown[]): SubmissionValidation;
}

export type RecoverySubmitSuccess = {
  status: 'ACCEPTED';
  frozen: true;
  candidateCount: number;
  supplementCount: number;
  recoveredCount: number;
  payloadHash: string;
};
