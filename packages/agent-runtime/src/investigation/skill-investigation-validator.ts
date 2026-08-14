import path from "node:path";
import { Ajv2020 } from "ajv/dist/2020.js";
import type {
  InvestigationSubmissionPayload,
  InvestigationSubmissionValidator,
  SubmissionValidation,
} from "@stellaris/agent-tools";
import type { SkillIdentity } from "../skill/skill-identity.js";
import { SkillSchemaRegistry, type RegisteredSchema } from "../skill/skill-schema-registry.js";
import { InvestigationRuntimeError } from "./investigation-types.js";

export const LEADERSHIP_STRUCTURE_SCHEMA_TITLE = "Leadership Structure";
export const PERSON_DECISION_SCHEMA_TITLE = "Person Decision";

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

/** Build an InvestigationSubmissionValidator over the pinned Skill's canonical
 *  leadership-structure and person-decision schemas (loaded through the
 *  existing registry). PRIMARY ranking is not judged here. */
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
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  const validateLeadership = ajv.compile(leadershipSchema.schema as never);
  const validatePersonDecision = ajv.compile(personDecisionSchema.schema as never);

  return {
    validate(payload: InvestigationSubmissionPayload): SubmissionValidation {
      const errors: string[] = [];
      if (!validateLeadership(payload.leadership)) {
        const detail = (validateLeadership.errors ?? [])
          .map((error) => `${error.instancePath || "#"} ${error.message ?? ""}`.trim())
          .join("; ");
        errors.push(`leadership: ${detail}`);
      }
      payload.selectedOfficials.forEach((record, index) => {
        if (!validatePersonDecision(record)) {
          const detail = (validatePersonDecision.errors ?? [])
            .map((error) => `${error.instancePath || "#"} ${error.message ?? ""}`.trim())
            .join("; ");
          errors.push(`selectedOfficials[${index}]: ${detail}`);
        }
      });
      return errors.length > 0 ? { valid: false, errors } : { valid: true };
    },
  };
}
