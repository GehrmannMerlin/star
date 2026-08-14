import path from "node:path";
import { Ajv2020 } from "ajv/dist/2020.js";
import type { SubmissionValidation } from "@stellaris/agent-tools";
import type { SkillIdentity } from "../skill/skill-identity.js";
import { SkillSchemaRegistry } from "../skill/skill-schema-registry.js";
import { RecoveryRunnerRuntimeError } from "./recovery-types.js";

export const RECOVERY_RECORD_SCHEMA_TITLE = "Recovery Record";
export const RECOVERY_RECORD_SCHEMA_SUFFIX = "recovery-record.schema.json";

/**
 * Build a RecoverySubmissionValidator over the pinned Skill's canonical
 * Recovery Record schema (recovery-record.schema.json). The runtime constructs
 * the full canonical record with real session attestation, then validates it
 * here — self-attested recovery and unmatched tool-call IDs are rejected by the
 * schema shape.
 */
export async function createSkillRecoveryValidator(
  identity: SkillIdentity,
): Promise<{ validate(records: unknown[]): SubmissionValidation }> {
  const registry = await SkillSchemaRegistry.load(path.join(identity.path, "schemas"));
  const byTitle = registry.get(RECOVERY_RECORD_SCHEMA_TITLE);
  const schema = byTitle
    ? byTitle
    : registry
        .list()
        .map((name) => registry.get(name))
        .find((s) => s?.filePath.endsWith(RECOVERY_RECORD_SCHEMA_SUFFIX));
  if (!schema) {
    throw new RecoveryRunnerRuntimeError(
      `Schema not found in SkillSchemaRegistry: ${RECOVERY_RECORD_SCHEMA_TITLE}`,
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
          errors.push(`recovery-record[${index}]: ${detail}`);
        }
      });
      return errors.length > 0 ? { valid: false, errors } : { valid: true };
    },
  };
}
