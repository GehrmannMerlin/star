import type { SubmissionValidation } from "../inventory/inventory-submission.js";

/**
 * Provider-neutral investigation submission contracts.
 *
 * `leadership` and `selectedOfficials` are canonical Skill artifacts
 * (leadership-structure.schema.json / person-decision.schema.json) carried in
 * a light runtime envelope. The envelope is transport only — it does not
 * duplicate Skill fields. Canonical validation happens server-side against the
 * pinned Skill schemas (SkillSchemaRegistry).
 */

export type LeadershipStructureArtifact = Record<string, unknown>;
export type PersonDecisionArtifact = Record<string, unknown>;

export type InvestigationSubmissionPayload = {
  leadership: LeadershipStructureArtifact;
  /** Exactly two Person Decision artifacts: PRIMARY_1 and PRIMARY_2. */
  selectedOfficials: PersonDecisionArtifact[];
};

export interface InvestigationSubmissionValidator {
  validate(payload: InvestigationSubmissionPayload): SubmissionValidation;
}

export type InvestigationSubmitResult =
  | { status: "ACCEPTED"; payloadHash: string }
  | { status: "ALREADY_SUBMITTED"; payloadHash: string };

export interface InvestigationSubmissionSink {
  submit(payload: InvestigationSubmissionPayload): Promise<InvestigationSubmitResult>;
  getSubmission(): Promise<InvestigationSubmissionPayload | null>;
  isFrozen(): Promise<boolean>;
}

export type SubmitInvestigationSuccess = {
  status: "ACCEPTED";
  frozen: true;
  leadershipValidated: true;
  selectedOfficialsValidated: true;
  primary1: string | null;
  primary2: string | null;
  primaryPeopleDistinct: boolean;
  payloadHash: string;
};
