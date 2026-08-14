import path from "node:path";
import { Ajv2020 } from "ajv/dist/2020.js";
import type {
  InventorySubmissionPayload,
  InventorySubmissionValidator,
  SubmissionValidation,
} from "@stellaris/agent-tools";
import type { SkillIdentity } from "../skill/skill-identity.js";
import { SkillSchemaRegistry, type RegisteredSchema } from "../skill/skill-schema-registry.js";
import { InventoryRuntimeError } from "./inventory-types.js";

export const INSTITUTION_INVENTORY_SCHEMA_TITLE = "Frozen Institution Inventory Record";

export function findInstitutionInventorySchema(
  registry: SkillSchemaRegistry,
): RegisteredSchema {
  const byTitle = registry.get(INSTITUTION_INVENTORY_SCHEMA_TITLE);
  if (byTitle) return byTitle;
  const byPath = registry
    .list()
    .map((name) => registry.get(name))
    .find((schema) => schema?.filePath.endsWith("institution-inventory.schema.json"));
  if (!byPath) {
    throw new InventoryRuntimeError(
      "Institution inventory schema not found in SkillSchemaRegistry",
    );
  }
  return byPath;
}

/** Build an InventorySubmissionValidator over the pinned Skill's canonical
 *  institution-inventory schema (loaded through the existing registry). */
export async function createSkillInventoryValidator(
  identity: SkillIdentity,
): Promise<InventorySubmissionValidator> {
  const registry = await SkillSchemaRegistry.load(path.join(identity.path, "schemas"));
  const schema = findInstitutionInventorySchema(registry);
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  // The schema is trusted JSON from the pinned Skill registry.
  const validateRecord = ajv.compile(schema.schema as never);
  return {
    validate(payload: InventorySubmissionPayload): SubmissionValidation {
      const errors: string[] = [];
      payload.inventory.forEach((record, index) => {
        const ok = validateRecord(record);
        if (!ok) {
          const detail = (validateRecord.errors ?? [])
            .map((error) => `${error.instancePath || "#"} ${error.message ?? ""}`.trim())
            .join("; ");
          errors.push(`inventory[${index}]: ${detail}`);
        }
      });
      return errors.length > 0 ? { valid: false, errors } : { valid: true };
    },
  };
}
