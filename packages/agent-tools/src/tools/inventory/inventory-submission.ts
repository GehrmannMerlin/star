/** Provider-neutral inventory submission contracts.
 *  The record shape mirrors the canonical Skill schema
 *  (schemas/institution-inventory.schema.json, title "Frozen Institution
 *  Inventory Record"). Only structural validation happens in TypeScript —
 *  INCLUDE/EXCLUDE semantics stay in Skill -> Pi. */

export const ADMINISTRATIVE_LEVELS = ["PROVINCIAL", "PREFECTURE", "COUNTY"] as const;
export type AdministrativeLevel = (typeof ADMINISTRATIVE_LEVELS)[number];

export const INSTITUTION_DECISIONS = [
  "INCLUDE",
  "EXCLUDE_OUT_OF_SCOPE",
  "EXCLUDE_INTERNAL_DEPARTMENT",
  "EXCLUDE_SUBORDINATE_UNIT",
  "EXCLUDE_NON_INSTITUTION",
  "DUPLICATE_ENTRY",
  "MERGE_ALIAS",
] as const;
export type InstitutionDecision = (typeof INSTITUTION_DECISIONS)[number];

export type InstitutionInventoryRecord = {
  institution_id: string;
  standard_name: string;
  administrative_level: AdministrativeLevel;
  core_institution_type?: string;
  decision: InstitutionDecision;
  source_url?: string;
  lineage?: string[];
  /** The canonical Skill schema allows additional properties. */
  [key: string]: unknown;
};

export type InventorySubmissionPayload = {
  inventory: InstitutionInventoryRecord[];
};

export type SubmissionValidation =
  | { valid: true }
  | { valid: false; errors: string[] };

export interface InventorySubmissionValidator {
  validate(payload: InventorySubmissionPayload): SubmissionValidation;
}

export type InventorySubmitResult =
  | { status: "ACCEPTED"; payloadHash: string }
  | { status: "ALREADY_SUBMITTED"; payloadHash: string };

export interface InventorySubmissionSink {
  submit(payload: InventorySubmissionPayload): Promise<InventorySubmitResult>;
  getSubmission(): Promise<InventorySubmissionPayload | null>;
  isFrozen(): Promise<boolean>;
}

export type SubmitInventorySuccess = {
  status: "ACCEPTED";
  frozen: true;
  itemCount: number;
  payloadHash: string;
};
