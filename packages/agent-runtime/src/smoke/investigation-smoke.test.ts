import { describe, expect, it } from "vitest";
import {
  investigationSmokePassed,
  parseInvestigationSmokeArgs,
} from "./investigation-smoke.js";

describe("investigation smoke", () => {
  it("parses --region-code / --institution / --budget-ms", () => {
    const args = parseInvestigationSmokeArgs([
      "--region-code",
      "320106",
      "--institution",
      "鼓楼区人民政府",
      "--budget-ms",
      "420000",
    ]);
    expect(args.regionCode).toBe("320106");
    expect(args.institution).toBe("鼓楼区人民政府");
    expect(args.budgetMs).toBe(420000);
  });

  it("returns a passing gate only when every smoke requirement is met", () => {
    const base: Record<string, unknown> = {
      packet_created: true,
      packet_initial_state: "PENDING",
      investigator_session_created: true,
      skill_loaded: true,
      role: "INVESTIGATOR",
      get_region_context_called: true,
      search_web_called: true,
      bocha_called: true,
      fetch_page_called: true,
      inspect_page_called: true,
      submit_investigation_called: true,
      leadership_schema_valid: true,
      selected_officials_schema_valid: true,
      primary_1_present: true,
      primary_2_present: true,
      primary_people_distinct: true,
      submission_frozen: true,
      packet_final_state: "EVIDENCE_PENDING",
      agent_completed: true,
    };
    expect(investigationSmokePassed(base)).toBe(true);
    expect(investigationSmokePassed({ ...base, bocha_called: false })).toBe(false);
    expect(investigationSmokePassed({ ...base, inspect_page_called: false })).toBe(false);
    expect(investigationSmokePassed({ ...base, submit_investigation_called: false })).toBe(false);
    expect(investigationSmokePassed({ ...base, primary_people_distinct: false })).toBe(false);
    expect(investigationSmokePassed({ ...base, packet_final_state: "FAILED" })).toBe(false);
  });
});
