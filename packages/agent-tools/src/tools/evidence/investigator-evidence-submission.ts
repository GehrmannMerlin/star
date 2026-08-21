import type { SubmissionValidation } from "../inventory/inventory-submission.js";
import type { ValidationIssue } from "../investigation/investigation-submission.js";

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

/**
 * STEP 20.1 — 结构化 Evidence Validation。
 *
 * 与 submit_investigation（STEP 19.4）一致：validator 返回结构化 details
 * （ValidationIssue[]），tool / runner 据此生成精确 repair 反馈。
 * 向后兼容 SubmissionValidation。
 */
export type StructuredEvidenceSubmissionValidation = SubmissionValidation & {
  details?: ValidationIssue[];
};

/** 把结构化 issues 格式化为给 Agent 的单条可读消息。 */
export function formatEvidenceValidationRepairMessage(
  issues: ValidationIssue[],
  toolName = "submit_investigator_evidence",
): string {
  if (issues.length === 0) {
    return `${toolName} failed Skill schema validation`;
  }
  const parts = issues.map((issue, index) => {
    const allowed =
      issue.allowedValues.length > 0 ? issue.allowedValues.join(" / ") : "(无枚举约束)";
    return [
      `[${index + 1}] 字段：${issue.fieldPath}`,
      `收到值：${JSON.stringify(issue.receivedValue)}`,
      `允许值：${allowed}`,
      `修复指令：${issue.repairInstruction}`,
    ].join("；");
  });
  return `${toolName} failed Skill schema validation；${parts.join("。")}`;
}

