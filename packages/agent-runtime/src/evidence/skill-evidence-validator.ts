import path from "node:path";
import { Ajv2020 } from "ajv/dist/2020.js";
import type {
  InvestigatorEvidenceSubmissionPayload,
  InvestigatorEvidenceSubmissionValidator,
  StructuredEvidenceSubmissionValidation,
  SubmissionValidation,
  ValidationIssue,
} from "@stellaris/agent-tools";
import type { SkillIdentity } from "../skill/skill-identity.js";
import { SkillSchemaRegistry, type RegisteredSchema } from "../skill/skill-schema-registry.js";
import { InvestigatorEvidenceRuntimeError } from "./evidence-types.js";
import { CanonicalEvidenceContract } from "./canonical-evidence-contract.js";

export const URL_CANDIDATE_POOL_SCHEMA_TITLE = "URL Candidate Pool Row";
export const TARGET_CLAIM_SCHEMA_TITLE = "Target-level Evidence Claim";

const SUBMISSION_SCHEMA_VALIDATION_FAILED = "SUBMISSION_SCHEMA_VALIDATION_FAILED" as const;

function findSchema(
  registry: SkillSchemaRegistry,
  title: string,
  filenameSuffix: string,
): RegisteredSchema {
  const byTitle = registry.get(title);
  if (byTitle) return byTitle;
  const byPath = registry
    .list()
    .map((name) => registry.get(name))
    .find((schema) => schema?.filePath.endsWith(filenameSuffix));
  if (!byPath) {
    throw new InvestigatorEvidenceRuntimeError(`Schema not found in SkillSchemaRegistry: ${title}`);
  }
  return byPath;
}

/** 从 Ajv error 读收到值（不 dump 整个 payload）。 */
function readReceivedValue(
  row: Record<string, unknown>,
  instancePath: string,
): unknown {
  const segments = instancePath.split("/").filter((seg) => seg.length > 0);
  const first = segments[0];
  const keys = first !== undefined && /^\d+$/.test(first) ? segments.slice(1) : segments;
  let node: unknown = row;
  for (const segment of keys) {
    if (typeof node !== "object" || node === null) return undefined;
    const key = segment.replace(/~1/g, "/").replace(/~0/g, "~");
    node = (node as Record<string, unknown>)[key];
  }
  return node;
}

/** 把 Ajv 结构化 errors 解析为 ValidationIssue 列表（enum 分支自动带 allowedValues）。 */
function toIssues(
  errors: ErrorObjectLike[],
  row: Record<string, unknown>,
  contract: CanonicalEvidenceContract,
): ValidationIssue[] {
  return errors.map((error) => {
    const fieldPath = error.instancePath || "#";
    const receivedValue = readReceivedValue(row, fieldPath);
    const field = fieldPath.split("/").filter(Boolean).pop() ?? "";
    const allowedValues =
      error.keyword === "enum" ? contract.fieldAllowedValues(field) : [];
    const repairInstruction =
      allowedValues.length > 0
        ? "仅修正该字段为允许值之一。不要重新搜索。不要修改已验证证据。不要创建新的枚举值。"
        : "仅修正该字段以满足 schema 要求。不要重新搜索。不要修改已验证证据。";
    return {
      errorCode: SUBMISSION_SCHEMA_VALIDATION_FAILED,
      fieldPath,
      receivedValue,
      validationKeyword: error.keyword,
      allowedValues,
      repairInstruction,
    };
  });
}

/** 最小 ErrorObject 形状（避免把 ajv 类型漏进公共接口）。 */
type ErrorObjectLike = {
  instancePath?: string;
  keyword: string;
  message?: string;
};

/**
 * Build an InvestigatorEvidenceSubmissionValidator over the pinned Skill's
 * canonical url-candidate-pool and target-claim schemas. Candidate status and
 * source/page classification are NOT judged here — only schema shape.
 *
 * STEP 20.1：validate() 返回结构化 details（ValidationIssue[]），供 Tool /
 * Runner 生成精确 repair 反馈；errors 字符串保持向后兼容。
 */
export async function createSkillEvidenceValidator(
  identity: SkillIdentity,
): Promise<InvestigatorEvidenceSubmissionValidator> {
  const registry = await SkillSchemaRegistry.load(path.join(identity.path, "schemas"));
  const poolSchema = findSchema(
    registry,
    URL_CANDIDATE_POOL_SCHEMA_TITLE,
    "url-candidate-pool.schema.json",
  );
  const claimSchema = findSchema(
    registry,
    TARGET_CLAIM_SCHEMA_TITLE,
    "target-claim.schema.json",
  );
  const contract = new CanonicalEvidenceContract(poolSchema, claimSchema);
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  const validatePool = ajv.compile(poolSchema.schema as never);
  const validateClaim = ajv.compile(claimSchema.schema as never);

  return {
    validate(payload: InvestigatorEvidenceSubmissionPayload): StructuredEvidenceSubmissionValidation {
      const errors: string[] = [];
      const details: ValidationIssue[] = [];
      payload.candidates.forEach((candidate, index) => {
        if (!validatePool(candidate)) {
          const ajvErrors = (validatePool.errors ?? []) as ErrorObjectLike[];
          const detail = ajvErrors
            .map((error) => `${error.instancePath || "#"} ${error.message ?? ""}`.trim())
            .join("; ");
          errors.push(`candidates[${index}]: ${detail}`);
          const prefixed = ajvErrors.map((error) => ({
            ...error,
            instancePath: `/${index}${error.instancePath}`,
          }));
          details.push(...toIssues(prefixed, candidate, contract));
        }
      });
      (payload.claims ?? []).forEach((claim, index) => {
        if (!validateClaim(claim)) {
          const ajvErrors = (validateClaim.errors ?? []) as ErrorObjectLike[];
          const detail = ajvErrors
            .map((error) => `${error.instancePath || "#"} ${error.message ?? ""}`.trim())
            .join("; ");
          errors.push(`claims[${index}]: ${detail}`);
          const prefixed = ajvErrors.map((error) => ({
            ...error,
            instancePath: `/${index}${error.instancePath}`,
          }));
          details.push(...toIssues(prefixed, claim, contract));
        }
      });
      const validation: SubmissionValidation =
        errors.length > 0 ? { valid: false, errors } : { valid: true };
      return details.length > 0
        ? { ...validation, details }
        : validation;
    },
  };
}
