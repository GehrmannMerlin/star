import path from "node:path";
import { Ajv2020 } from "ajv/dist/2020.js";
import type { SubmissionValidation } from "@stellaris/agent-tools";
import type { SkillIdentity } from "../skill/skill-identity.js";
import { SkillSchemaRegistry } from "../skill/skill-schema-registry.js";
import { ReviewerRuntimeError } from "./reviewer-types.js";

export const REVIEW_RECORD_SCHEMA_TITLE = "Independent Review Record";
export const REVIEW_RECORD_SCHEMA_SUFFIX = "review-record.schema.json";

/**
 * Build a ReviewerSubmissionValidator over the pinned Skill's canonical
 * Independent Review Record schema (review-record.schema.json). The runtime
 * constructs the full canonical record with real session attestation, then
 * validates it here — self-attested reviews and unmatched tool-call IDs are
 * rejected by the schema shape.
 */
export async function createSkillReviewValidator(
  identity: SkillIdentity,
): Promise<{ validate(records: unknown[]): SubmissionValidation }> {
  const registry = await SkillSchemaRegistry.load(path.join(identity.path, "schemas"));
  const byTitle = registry.get(REVIEW_RECORD_SCHEMA_TITLE);
  const schema = byTitle
    ? byTitle
    : registry
        .list()
        .map((name) => registry.get(name))
        .find((s) => s?.filePath.endsWith(REVIEW_RECORD_SCHEMA_SUFFIX));
  if (!schema) {
    throw new ReviewerRuntimeError(
      `Schema not found in SkillSchemaRegistry: ${REVIEW_RECORD_SCHEMA_TITLE}`,
    );
  }
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  const validateRecord = ajv.compile(schema.schema as never);

  return {
    validate(records: unknown[]): SubmissionValidation {
      const errors: string[] = [];
      records.forEach((record, index) => {
        if (!validateRecord(record)) {
          const detail = (validateRecord.errors ?? [])
            .map((error) => `${error.instancePath || "#"} ${error.message ?? ""}`.trim())
            .join("; ");
          errors.push(`review[${index}]: ${detail}`);
        }
      });
      return errors.length > 0 ? { valid: false, errors } : { valid: true };
    },
  };
}
