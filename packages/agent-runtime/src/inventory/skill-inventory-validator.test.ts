import { describe, expect, it } from "vitest";
import type { InstitutionInventoryRecord } from "@stellaris/agent-tools";
import { createRuntimeConfig } from "../config/runtime-config.js";
import { OFFICIAL_BIOGRAPHY_SKILL_NAME, SkillRuntime } from "../skill/skill-runtime.js";
import { createSkillInventoryValidator } from "./skill-inventory-validator.js";

describe("createSkillInventoryValidator", () => {
  it("validates against the pinned official-biography-evidence inventory schema", async () => {
    const config = createRuntimeConfig();
    const runtime = new SkillRuntime(config);
    await runtime.reload();
    const identity = await runtime.resolveSkill(OFFICIAL_BIOGRAPHY_SKILL_NAME);
    expect(identity.version).toBe("3.1.0");
    const validator = await createSkillInventoryValidator(identity);

    const valid = validator.validate({
      inventory: [
        {
          institution_id: "sh-people-gov",
          standard_name: "上海市人民政府",
          administrative_level: "PROVINCIAL",
          decision: "INCLUDE",
          source_url: "https://www.sh.gov.cn/",
        },
      ],
    });
    expect(valid.valid).toBe(true);

    const invalid = validator.validate({
      inventory: [
        {
          institution_id: "bad",
          standard_name: "错误机构",
          administrative_level: "GALAXY",
          decision: "MAYBE",
        } as unknown as InstitutionInventoryRecord,
      ],
    });
    expect(invalid.valid).toBe(false);
    if (!invalid.valid) expect(invalid.errors.length).toBeGreaterThan(0);
  });
});
