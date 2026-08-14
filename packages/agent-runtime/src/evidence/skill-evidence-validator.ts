import path from "node:path";
import { Ajv2020 } from "ajv/dist/2020.js";
import type {
  InvestigatorEvidenceSubmissionPayload,
  InvestigatorEvidenceSubmissionValidator,
  SubmissionValidation,
} from "@stellaris/agent-tools";
import type { SkillIdentity } from "../skill/skill-identity.js";
import { SkillSchemaRegistry, type RegisteredSchema } from "../skill/skill-schema-registry.js";
import { InvestigatorEvidenceRuntimeError } from "./evidence-types.js";

export const URL_CANDIDATE_POOL_SCHEMA_TITLE = "URL Candidate Pool Row";
export const TARGET_CLAIM_SCHEMA_TITLE = "Target-level Evidence Claim";

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

/** Build an InvestigatorEvidenceSubmissionValidator over the pinned Skill's
 *  canonical url-candidate-pool and target-claim schemas. Candidate status and
 *  source/page classification are NOT judged here — only schema shape. */
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
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  const validatePool = ajv.compile(poolSchema.schema as never);
  const validateClaim = ajv.compile(claimSchema.schema as never);

  return {
    validate(payload: InvestigatorEvidenceSubmissionPayload): SubmissionValidation {
      const errors: string[] = [];
      payload.candidates.forEach((candidate, index) => {
        if (!validatePool(candidate)) {
          const detail = (validatePool.errors ?? [])
            .map((error) => `${error.instancePath || "#"} ${error.message ?? ""}`.trim())
            .join("; ");
          errors.push(`candidates[${index}]: ${detail}`);
        }
      });
      (payload.claims ?? []).forEach((claim, index) => {
        if (!validateClaim(claim)) {
          const detail = (validateClaim.errors ?? [])
            .map((error) => `${error.instancePath || "#"} ${error.message ?? ""}`.trim())
            .join("; ");
          errors.push(`claims[${index}]: ${detail}`);
        }
      });
      return errors.length > 0 ? { valid: false, errors } : { valid: true };
    },
  };
}
