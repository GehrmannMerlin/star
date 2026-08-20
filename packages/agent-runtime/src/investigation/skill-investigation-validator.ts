import path from "node:path";
import { Ajv2020, type ErrorObject } from "ajv/dist/2020.js";
import type {
  InvestigationSubmissionPayload,
  InvestigationSubmissionValidator,
  StructuredSubmissionValidation,
  ValidationIssue,
} from "@stellaris/agent-tools";
import type { SkillIdentity } from "../skill/skill-identity.js";
import { SkillSchemaRegistry, type RegisteredSchema } from "../skill/skill-schema-registry.js";
import { CanonicalSubmissionContract } from "./canonical-submission-contract.js";
import { InvestigationRuntimeError } from "./investigation-types.js";

export const LEADERSHIP_STRUCTURE_SCHEMA_TITLE = "Leadership Structure";
export const PERSON_DECISION_SCHEMA_TITLE = "Person Decision";

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
    throw new InvestigationRuntimeError(
      `Schema not found in SkillSchemaRegistry: ${title}`,
    );
  }
  return byPath;
}

/**
 * 从 Ajv 结构化 error 读取失败字段处的 received value。
 * 只读取该字段，绝不 dump 整个 payload。
 *
 * instancePath 形如 /person_status 或 /0/person_status（selectedOfficials 下标
 * 前缀）。当传入 artifact 是单条 person-decision 记录时，跳过首段数字下标。
 */
function readReceivedValue(
  artifact: Record<string, unknown>,
  instancePath: string,
): unknown {
  const segments = instancePath.split("/").filter((seg) => seg.length > 0);
  // 跳过数组下标前缀（/0/person_status → person_status）。
  const first = segments[0];
  const keys =
    first !== undefined && /^\d+$/.test(first) ? segments.slice(1) : segments;
  let node: unknown = artifact;
  for (const segment of keys) {
    if (typeof node !== "object" || node === null) return undefined;
    const key = segment.replace(/~1/g, "/").replace(/~0/g, "~");
    node = (node as Record<string, unknown>)[key];
  }
  return node;
}

/** 判断 Ajv error 是否 enum 失败，并取 allowed values。 */
function allowedValuesForError(
  error: ErrorObject,
  contract: CanonicalSubmissionContract,
): readonly string[] {
  if (error.keyword !== "enum") return [];
  const params = error.params as { allowedValues?: unknown };
  if (Array.isArray(params.allowedValues)) {
    return params.allowedValues.filter((v): v is string => typeof v === "string");
  }
  // 回退：从 Canonical Contract 投影（与 schema 同源，仍是唯一真相源）。
  // instancePath 可能带 selectedOfficials 下标前缀（/0/person_status）。
  const fieldPath = error.instancePath.replace(/^\/\d+/, "");
  if (fieldPath === "/person_status" || fieldPath === "/currentness_quality") {
    return fieldPath === "/person_status"
      ? contract.personStatusAllowedValues()
      : contract.currentnessQualityAllowedValues();
  }
  return [];
}

/**
 * 把 Ajv 结构化 errors 解析为 ValidationIssue 列表。
 * 通用处理：enum / required / type 等 keyword 都能产生结构化 issue；
 * 不为特定业务字段写 if（enum 分支自动带 allowed_values）。
 */
function toValidationIssues(
  errors: ErrorObject[],
  artifact: Record<string, unknown>,
  contract: CanonicalSubmissionContract,
): ValidationIssue[] {
  return errors.map((error) => {
    const fieldPath = error.instancePath || "#";
    const receivedValue = readReceivedValue(artifact, fieldPath);
    const allowedValues = allowedValuesForError(error, contract);
    const isEnum = error.keyword === "enum";
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

/**
 * Build an InvestigationSubmissionValidator over the pinned Skill's canonical
 * leadership-structure and person-decision schemas (loaded through the
 * existing registry). PRIMARY ranking is not judged here.
 *
 * validate() 返回结构化 ValidationIssue（details），供 Tool / Runner 生成
 * 精确 repair 反馈；errors 字符串保持向后兼容。
 */
export async function createSkillInvestigationValidator(
  identity: SkillIdentity,
): Promise<InvestigationSubmissionValidator> {
  const registry = await SkillSchemaRegistry.load(path.join(identity.path, "schemas"));
  const leadershipSchema = findSchema(
    registry,
    LEADERSHIP_STRUCTURE_SCHEMA_TITLE,
    "leadership-structure.schema.json",
  );
  const personDecisionSchema = findSchema(
    registry,
    PERSON_DECISION_SCHEMA_TITLE,
    "person-decision.schema.json",
  );
  const contract = new CanonicalSubmissionContract(personDecisionSchema, leadershipSchema);
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  const validateLeadership = ajv.compile(leadershipSchema.schema as never);
  const validatePersonDecision = ajv.compile(personDecisionSchema.schema as never);

  return {
    validate(payload: InvestigationSubmissionPayload): StructuredSubmissionValidation {
      const errors: string[] = [];
      const details: ValidationIssue[] = [];
      if (!validateLeadership(payload.leadership)) {
        const ajvErrors = (validateLeadership.errors ?? []) as ErrorObject[];
        const detail = ajvErrors
          .map((error) => `${error.instancePath || "#"} ${error.message ?? ""}`.trim())
          .join("; ");
        errors.push(`leadership: ${detail}`);
        details.push(...toValidationIssues(ajvErrors, payload.leadership, contract));
      }
      payload.selectedOfficials.forEach((record, index) => {
        if (!validatePersonDecision(record)) {
          const ajvErrors = (validatePersonDecision.errors ?? []) as ErrorObject[];
          const detail = ajvErrors
            .map((error) => `${error.instancePath || "#"} ${error.message ?? ""}`.trim())
            .join("; ");
          errors.push(`selectedOfficials[${index}]: ${detail}`);
          // 相对 payload 根的 fieldPath：给 Agent 的路径要能定位到人。
          const prefixed = ajvErrors.map((error) => ({
            ...error,
            instancePath: `/${index}${error.instancePath}`,
          }));
          details.push(...toValidationIssues(prefixed, record, contract));
        }
      });
      return errors.length > 0 ? { valid: false, errors, details } : { valid: true };
    },
  };
}
