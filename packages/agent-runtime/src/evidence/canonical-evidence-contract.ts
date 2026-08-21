import type { RegisteredSchema } from "../skill/skill-schema-registry.js";

/**
 * Canonical Evidence Contract（STEP 20.1）
 *
 * 单一真相源：official-biography-evidence Skill 的 canonical JSON Schema。
 * 本层只读解析 url-candidate-pool schema，把枚举字段投影为 Prompt /
 * Validator 共用的 Evidence Contract。
 *
 * 绝不：定义第二份 enum 副本 / 做业务判断 / 修改 Skill schema / 解释字段含义。
 */

export const EVIDENCE_ENUM_FIELDS = [
  "source_domain_class",
  "page_shape_class",
  "candidate_status",
] as const;

export type EvidenceEnumField = {
  field: string;
  allowedValues: readonly string[];
  required: boolean;
};

export type CanonicalEvidenceContractSnapshot = {
  schemaTitle: string | undefined;
  enumFields: readonly EvidenceEnumField[];
};

function readEnumAt(schema: Record<string, unknown>, field: string): readonly string[] {
  const props = schema.properties;
  if (typeof props !== "object" || props === null) return [];
  const node = (props as Record<string, unknown>)[field];
  if (typeof node !== "object" || node === null) return [];
  const candidate = node as Record<string, unknown>;
  if (Array.isArray(candidate.enum)) {
    return candidate.enum.filter((v): v is string => typeof v === "string");
  }
  return [];
}

function isRequired(schema: Record<string, unknown>, field: string): boolean {
  const required = schema.required;
  return Array.isArray(required) && required.includes(field);
}

/** 只读 Canonical Evidence Contract（url-candidate-pool 枚举投影）。 */
export class CanonicalEvidenceContract {
  private readonly pool: Record<string, unknown>;

  constructor(
    private readonly poolSchema: RegisteredSchema,
    _claimSchema: RegisteredSchema,
  ) {
    this.pool = (poolSchema.schema as Record<string, unknown>) ?? {};
    void _claimSchema;
  }

  enumFields(): EvidenceEnumField[] {
    return EVIDENCE_ENUM_FIELDS.map((field) => ({
      field,
      allowedValues: readEnumAt(this.pool, field),
      required: isRequired(this.pool, field),
    }));
  }

  fieldAllowedValues(field: string): readonly string[] {
    const found = this.enumFields().find((entry) => entry.field === field);
    if (!found) return [];
    return found.allowedValues;
  }

  snapshot(): CanonicalEvidenceContractSnapshot {
    return {
      schemaTitle: this.poolSchema.title,
      enumFields: this.enumFields(),
    };
  }
}
