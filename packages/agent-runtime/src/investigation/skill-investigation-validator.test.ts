import { describe, expect, it } from "vitest";
import type { InvestigationSubmissionPayload } from "@stellaris/agent-tools";
import { createRuntimeConfig } from "../config/runtime-config.js";
import { OFFICIAL_BIOGRAPHY_SKILL_NAME, SkillRuntime } from "../skill/skill-runtime.js";
import { createSkillInvestigationValidator } from "./skill-investigation-validator.js";

const LEADERSHIP = {
  structure_id: "ldr-1",
  institution_id: "inst-1",
  all_visible_leaders: [{ person_name: "张三", visible_roles: ["区委书记"] }],
  official_order: ["张三"],
  party_head: "张三",
  administrative_head: null,
  party_deputy_secretaries: [],
  executive_deputies: [],
  other_deputies: [],
  vacancy_information: [],
  supporting_evidence_ids: ["evt-1"],
  structure_complete: true,
  investigator_agent_id: "agent-1",
  investigator_context_id: "ctx-1",
  decided_at: "2026-08-14T00:00:00.000Z",
};

const PERSON_DECISION_1 = {
  person_decision_id: "pd-1",
  person_id: "person-zhang",
  target_id: "t-1",
  institution_id: "inst-1",
  primary_slot: "PRIMARY_1",
  leadership_structure_id: "ldr-1",
  person_status: "PERSON_CONFIRMED",
  person_name: "张三",
  role_canonical: "区委书记",
  selection_basis: "official order head",
  rank_information: null,
  responsibility_description: null,
  currentness_quality: "CURRENT_COLLECTION_MEMBER",
  supporting_evidence_ids: ["evt-1"],
  investigator_agent_id: "agent-1",
  investigator_context_id: "ctx-1",
  decided_at: "2026-08-14T00:00:01.000Z",
};

const PERSON_DECISION_2 = {
  ...PERSON_DECISION_1,
  person_decision_id: "pd-2",
  person_id: "person-li",
  primary_slot: "PRIMARY_2",
  person_name: "李四",
  role_canonical: "区长",
};

describe("createSkillInvestigationValidator", () => {
  it("validates a complete submission against the pinned official-biography-evidence schemas", async () => {
    const config = createRuntimeConfig();
    const runtime = new SkillRuntime(config);
    await runtime.reload();
    const identity = await runtime.resolveSkill(OFFICIAL_BIOGRAPHY_SKILL_NAME);
    expect(identity.version).toBe("3.1.0");
    const validator = await createSkillInvestigationValidator(identity);

    const valid: InvestigationSubmissionPayload = {
      leadership: LEADERSHIP,
      selectedOfficials: [PERSON_DECISION_1, PERSON_DECISION_2],
    };
    expect(validator.validate(valid).valid).toBe(true);

    const incompleteLeadership = validator.validate({
      leadership: { ...LEADERSHIP, structure_complete: false },
      selectedOfficials: [PERSON_DECISION_1, PERSON_DECISION_2],
    });
    expect(incompleteLeadership.valid).toBe(false);

    const badSlot = validator.validate({
      leadership: LEADERSHIP,
      selectedOfficials: [PERSON_DECISION_1, { ...PERSON_DECISION_2, primary_slot: "PRIMARY_3" }],
    });
    expect(badSlot.valid).toBe(false);
    if (!badSlot.valid) expect(badSlot.errors.length).toBeGreaterThan(0);
  });
});
