import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { SkillIdentity } from "../skill/skill-identity.js";
import { createSkillEvidenceValidator } from "./skill-evidence-validator.js";
import { CanonicalEvidenceContract } from "./canonical-evidence-contract.js";

// The test lives at packages/agent-runtime/src/evidence/; the repo root is 4
// levels up. Resolve the pinned Skill's real schemas so the validator runs
// against the canonical url-candidate-pool / target-claim JSON schemas.
const SKILL_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../../third-party/china-official-url-evidence-suite/skills/official-biography-evidence",
);

const identity: SkillIdentity = {
  name: "official-biography-evidence",
  id: "official-biography-evidence",
  version: "3.1.0",
  path: SKILL_DIR,
  skmdPath: path.join(SKILL_DIR, "SKILL.md"),
  yamlPath: path.join(SKILL_DIR, "skill.yaml"),
};

const VALID_CANDIDATE = {
  candidate_id: "cand-1",
  target_id: "glq-target-primary1",
  evidence_id: "evt-1",
  url: "https://www.njgl.gov.cn/zfxxgk/ldzc/1.html",
  source_domain_class: "OFFICIAL_GOV_DOMAIN",
  page_shape_class: "OFFICIAL_PERSON_PROFILE",
  supports_person: true,
  supports_institution: true,
  supports_role: true,
  supports_currentness: true,
  candidate_status: "ACCEPTED_AS_FINAL",
  accept_or_reject_reason: "official person profile for the frozen PRIMARY",
  superseded_by_candidate_id: null,
};

const VALID_CLAIM = {
  claim_id: "claim-1",
  evidence_id: "evt-1",
  person_id: "person-wang",
  institution_id: "glq-people-gov",
  target_id: "glq-target-primary1",
  role_supported: true,
  currentness_supported: true,
};

describe("createSkillEvidenceValidator", () => {
  it("accepts a canonical url-candidate-pool + target-claim payload", async () => {
    const validator = await createSkillEvidenceValidator(identity);
    const result = validator.validate({
      candidates: [VALID_CANDIDATE],
      claims: [VALID_CLAIM],
    });
    expect(result.valid).toBe(true);
  });

  it("rejects a malformed candidate row with structured errors", async () => {
    const validator = await createSkillEvidenceValidator(identity);
    const result = validator.validate({ candidates: [{ candidate_id: "x" }] });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]?.startsWith("candidates[0]")).toBe(true);
    }
  });

  it("rejects a candidate with an unknown candidate_status enum value", async () => {
    const validator = await createSkillEvidenceValidator(identity);
    const bad = { ...VALID_CANDIDATE, candidate_status: "DEFINITELY_ACCEPTED" };
    const result = validator.validate({ candidates: [bad] });
    expect(result.valid).toBe(false);
  });
});

describe("CanonicalEvidenceContract", () => {
  it("projects source_domain_class / page_shape_class / candidate_status enums from the canonical schemas", async () => {
    const { SkillSchemaRegistry } = await import("../skill/skill-schema-registry.js");
    const registry = await SkillSchemaRegistry.load(path.join(SKILL_DIR, "schemas"));
    const poolSchema =
      registry.get("URL Candidate Pool Row") ??
      registry
        .list()
        .map((n) => registry.get(n))
        .find((s) => s?.filePath.endsWith("url-candidate-pool.schema.json"));
    const claimSchema =
      registry.get("Target-level Evidence Claim") ??
      registry
        .list()
        .map((n) => registry.get(n))
        .find((s) => s?.filePath.endsWith("target-claim.schema.json"));
    if (!poolSchema || !claimSchema) throw new Error("schemas not found");
    const contract = new CanonicalEvidenceContract(poolSchema, claimSchema);
    const enums = contract.enumFields();
    expect(enums.map((e) => e.field)).toEqual(
      expect.arrayContaining(["source_domain_class", "page_shape_class", "candidate_status"]),
    );
    expect(contract.fieldAllowedValues("source_domain_class")).toContain("OFFICIAL_GOV_DOMAIN");
    expect(contract.fieldAllowedValues("page_shape_class")).toContain("OFFICIAL_PERSON_PROFILE");
    expect(contract.fieldAllowedValues("candidate_status")).toContain("ACCEPTED_AS_FINAL");
  });
});

describe("createSkillEvidenceValidator structured details", () => {
  it("returns structured details with allowedValues for enum violations", async () => {
    const validator = await createSkillEvidenceValidator(identity);
    const bad = { ...VALID_CANDIDATE, candidate_status: "DEFINITELY_ACCEPTED" };
    const result = validator.validate({ candidates: [bad] });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      const details = (result as { details?: unknown[] }).details ?? [];
      expect(details.length).toBeGreaterThan(0);
      const enumDetail = details.find((d) =>
        (d as { fieldPath?: string }).fieldPath?.includes("candidate_status"),
      );
      expect(enumDetail).toBeDefined();
      expect((enumDetail as { allowedValues?: readonly string[] }).allowedValues).toContain(
        "ACCEPTED_AS_FINAL",
      );
    }
  });
});

