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

/**
 * STEP 19.4 — 结构化 Validation Repair。
 *
 * 单个字段的 schema validation 失败详情。从 Ajv 结构化 error（instancePath /
 * schemaPath / keyword / params）解析，绝不正则拆字符串。
 */
export type ValidationIssue = {
  /** 稳定错误码：SUBMISSION_SCHEMA_VALIDATION_FAILED。 */
  errorCode: "SUBMISSION_SCHEMA_VALIDATION_FAILED";
  /** 字段 JSON Pointer（相对 artifact 根，如 /person_status 或 /0/person_status）。 */
  fieldPath: string;
  /** 收到（非法）的值原样。 */
  receivedValue: unknown;
  /** Ajv keyword，如 enum / required / type。 */
  validationKeyword: string;
  /** enum 时从 Canonical Contract 读取的 allowed values；非 enum 时 []。 */
  allowedValues: readonly string[];
  /** 给 Agent 的修复指令（中文，简短）。 */
  repairInstruction: string;
};

/** 结构化 validation 结果（向后兼容 SubmissionValidation）。 */
export type StructuredSubmissionValidation = SubmissionValidation & {
  details?: ValidationIssue[];
};

/**
 * 把结构化 issues 格式化为给 Agent 的单条可读消息。
 * 只含失败字段 / 收到值 / allowed values / 修复指令；不 dump 整个 payload。
 */
export function formatValidationRepairMessage(issues: ValidationIssue[]): string {
  if (issues.length === 0) {
    return "submit_investigation failed Skill schema validation";
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
  return `submit_investigation failed Skill schema validation；${parts.join("。")}`;
}
