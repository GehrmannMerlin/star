import type { SubmissionValidation } from "../inventory/inventory-submission.js";

/**
 * Provider-neutral Investigator Evidence submission contracts.
 *
 * `candidates` and `claims` are canonical Skill artifacts
 * (url-candidate-pool.schema.json / target-claim.schema.json) carried in a
 * light runtime envelope. The envelope is transport only — it does not
 * duplicate Skill fields. Canonical validation happens server-side against the
 * pinned Skill schemas (SkillSchemaRegistry).
 */

export type UrlCandidatePoolRow = Record<string, unknown>;
export type TargetClaimRow = Record<string, unknown>;

export type InvestigatorEvidenceSubmissionPayload = {
  /** URL Candidate Pool rows (url-candidate-pool.schema.json), PRIMARY_1+PRIMARY_2 targets. */
  candidates: UrlCandidatePoolRow[];
  /** Optional target-level evidence claims (target-claim.schema.json). */
  claims?: TargetClaimRow[];
};

export interface InvestigatorEvidenceSubmissionValidator {
  validate(payload: InvestigatorEvidenceSubmissionPayload): SubmissionValidation;
}

export type InvestigatorEvidenceSubmitResult =
  | { status: "ACCEPTED"; payloadHash: string }
  | { status: "ALREADY_SUBMITTED"; payloadHash: string };

export interface InvestigatorEvidenceSubmissionSink {
  submit(
    payload: InvestigatorEvidenceSubmissionPayload,
  ): Promise<InvestigatorEvidenceSubmitResult>;
  getSubmission(): Promise<InvestigatorEvidenceSubmissionPayload | null>;
  isFrozen(): Promise<boolean>;
}

export type SubmitInvestigatorEvidenceSuccess = {
  status: "ACCEPTED";
  frozen: true;
  candidatesValidated: true;
  claimsValidated: boolean;
  candidateCount: number;
  primary1TargetId: string | null;
  primary2TargetId: string | null;
  primary1CandidateCount: number;
  primary2CandidateCount: number;
  payloadHash: string;
};

/** Frozen PRIMARY join input, derived by the Evidence runner from the frozen
 *  person-decisions (never re-derived by the Agent or the tool). */
export type EvidencePrimaryDecision = {
  targetId: string;
  personId: string | null;
  personName: string | null;
  primarySlot: "PRIMARY_1" | "PRIMARY_2";
};

/**
 * Canonical URL normalization for the provenance join (requestedUrl / finalUrl
 * aware). Deliberately NOT a URL identity engine: lowercases scheme+host, drops
 * default ports, drops the fragment, and strips a trailing slash.
 */
export function normalizeUrlForJoin(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    if (parsed.port === "80" || parsed.port === "443") parsed.port = "";
    parsed.protocol = parsed.protocol.toLowerCase();
    parsed.hostname = parsed.hostname.toLowerCase();
    let pathname = parsed.pathname;
    while (pathname.length > 1 && pathname.endsWith("/")) pathname = pathname.slice(0, -1);
    parsed.pathname = pathname;
    return parsed.toString();
  } catch {
    return url.trim();
  }
}
