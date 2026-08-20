import type { RegisteredSchema } from "../skill/skill-schema-registry.js";

/**
 * Canonical Submission Contract（STEP 19.4）
 *
 * 单一真相源：official-biography-evidence Skill 的 canonical JSON Schema。
 * 本层只读解析 person-decision / leadership-structure schema，把枚举字段、
 * required 字段投影为 Submission Contract 供 Prompt / Validator 使用。
 *
 * 绝不：
 * - 不定义第二份 enum 副本（不 hardcode 枚举值）
 * - 不做业务判断 / 语义归一化
 * - 不修改 Skill schema
 * - 不解释字段含义（含义由 Skill 语义承担）
 */

export const PERSON_STATUS_ENUM_FIELD = "person_status" as const;
export const CURRENTNESS_QUALITY_ENUM_FIELD = "currentness_quality" as const;

export type CanonicalEnumField = {
  /** JSON Pointer 到字段（例如 /properties/person_status）。 */
  pointer: string;
  /** 字段名。 */
  field: string;
  /** schema 中声明的 allowed enum values（原样，不翻译不缩写）。 */
  allowedValues: readonly string[];
  /** 该字段在 root 对象中是否 required。 */
  required: boolean;
  /** 是否可空（type 含 null）。 */
  nullable: boolean;
};

export type CanonicalSubmissionContractSnapshot = {
  schemaName: string;
  schemaTitle: string | undefined;
  schemaPath: string;
  enumFields: readonly CanonicalEnumField[];
  requiredFields: readonly string[];
};

/** 从 canonical schema 中按 JSON Pointer 路径读取 enum 定义。 */
function readEnumAt(
  schema: Record<string, unknown>,
  pointerParts: string[],
): string[] | undefined {
  let node: unknown = schema;
  for (const part of pointerParts) {
    if (part === "#" || part === "") continue;
    if (typeof node !== "object" || node === null) return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  if (typeof node !== "object" || node === null) return undefined;
  const candidate = node as Record<string, unknown>;
  if (Array.isArray(candidate.enum)) {
    return candidate.enum.filter((v): v is string => typeof v === "string");
  }
  return undefined;
}

function readTypeAt(schema: Record<string, unknown>, pointerParts: string[]): unknown {
  let node: unknown = schema;
  for (const part of pointerParts) {
    if (part === "#" || part === "") continue;
    if (typeof node !== "object" || node === null) return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  if (typeof node !== "object" || node === null) return undefined;
  return (node as Record<string, unknown>).type;
}

/**
 * 只读 Canonical Submission Contract。
 *
 * 构造时传入 person-decision / leadership-structure 的 RegisteredSchema；
 * 通过 accessor 暴露枚举字段。解析失败时抛错（fail closed：契约必须可用，
 * 不可用则不让 Agent 以残缺契约提交）。
 */
export class CanonicalSubmissionContract {
  private readonly personDecision: Record<string, unknown>;

  constructor(
    private readonly personDecisionSchema: RegisteredSchema,
    leadershipStructureSchema: RegisteredSchema,
  ) {
    this.personDecision =
      (personDecisionSchema.schema as Record<string, unknown>) ?? {};
    // leadershipStructure 用于整体身份描述（本阶段仅记录引用，字段投影
    // 只针对 person-decision 的枚举字段）。
    void leadershipStructureSchema;
  }

  /** 从 root schema 的 properties 下读取字段节点。 */
  private property(field: string): Record<string, unknown> | undefined {
    const props = this.personDecision.properties;
    if (typeof props !== "object" || props === null) return undefined;
    const node = (props as Record<string, unknown>)[field];
    return typeof node === "object" && node !== null
      ? (node as Record<string, unknown>)
      : undefined;
  }

  private isRequired(field: string): boolean {
    const required = this.personDecision.required;
    return Array.isArray(required) && required.includes(field);
  }

  private enumField(field: string): CanonicalEnumField | undefined {
    const node = this.property(field);
    if (!node || !Array.isArray(node.enum)) return undefined;
    const allowedValues = node.enum.filter((v): v is string => typeof v === "string");
    const type = node.type;
    const nullable = Array.isArray(type) && type.includes("null");
    return {
      pointer: `/properties/${field}`,
      field,
      allowedValues,
      required: this.isRequired(field),
      nullable,
    };
  }

  /** person_status 的 canonical allowed values（Schema SSoT，无副本）。 */
  personStatusAllowedValues(): readonly string[] {
    const field = this.enumField(PERSON_STATUS_ENUM_FIELD);
    if (!field) {
      throw new Error(
        `CanonicalSubmissionContract: ${PERSON_STATUS_ENUM_FIELD} enum missing from person-decision schema`,
      );
    }
    return field.allowedValues;
  }

  /** currentness_quality 的 canonical allowed values。 */
  currentnessQualityAllowedValues(): readonly string[] {
    const field = this.enumField(CURRENTNESS_QUALITY_ENUM_FIELD);
    if (!field) {
      throw new Error(
        `CanonicalSubmissionContract: ${CURRENTNESS_QUALITY_ENUM_FIELD} enum missing from person-decision schema`,
      );
    }
    return field.allowedValues;
  }

  /** 全部枚举字段（供通用投影 / 测试）。 */
  enumFields(): CanonicalEnumField[] {
    const fields = [
      this.enumField(PERSON_STATUS_ENUM_FIELD),
      this.enumField(CURRENTNESS_QUALITY_ENUM_FIELD),
    ].filter((f): f is CanonicalEnumField => f !== undefined);
    return fields;
  }

  /** required 字段（person-decision root）。 */
  requiredFields(): readonly string[] {
    const required = this.personDecision.required;
    return Array.isArray(required)
      ? required.filter((r): r is string => typeof r === "string")
      : [];
  }

  /** 契约快照（身份 + 枚举 + required，供调试/报告）。 */
  snapshot(): CanonicalSubmissionContractSnapshot {
    return {
      schemaName: this.personDecisionSchema.name,
      schemaTitle: this.personDecisionSchema.title,
      schemaPath: this.personDecisionSchema.filePath,
      enumFields: this.enumFields(),
      requiredFields: this.requiredFields(),
    };
  }
}
