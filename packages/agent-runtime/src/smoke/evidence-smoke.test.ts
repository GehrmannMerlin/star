import { describe, expect, it } from "vitest";
import { evidenceSmokePassed, parseEvidenceSmokeArgs } from "./evidence-smoke.js";

describe("evidence smoke", () => {
  it("parses --region-code / --institution / --budget-ms / --fixture", () => {
    const args = parseEvidenceSmokeArgs([
      "--region-code",
      "320106",
      "--institution",
      "鼓楼区人民政府",
      "--budget-ms",
      "720000",
      "--fixture",
      "/tmp/step9.json",
    ]);
    expect(args.regionCode).toBe("320106");
    expect(args.institution).toBe("鼓楼区人民政府");
    expect(args.budgetMs).toBe(720000);
    expect(args.fixture).toBe("/tmp/step9.json");
  });

  it("returns a passing gate only when every smoke requirement is met", () => {
    const base: Record<string, unknown> = {
      evidence_session_created: true,
      step9_conversation_reused: false,
      skill_loaded: true,
      role: "INVESTIGATOR",
      search_web_called: true,
      bocha_called: true,
      fetch_page_called: true,
      inspect_page_called: true,
      submit_investigator_evidence_called: true,
      candidates_schema_valid: true,
      primary_1_candidate_count: 1,
      primary_2_candidate_count: 1,
      all_candidates_opened: true,
      all_candidates_inspected: true,
      candidate_provenance_gate: "PASS",
      submission_frozen: true,
      packet_final_state: "READY_FOR_REVIEW",
      agent_completed: true,
    };
    expect(evidenceSmokePassed(base)).toBe(true);
    expect(evidenceSmokePassed({ ...base, bocha_called: false })).toBe(false);
    expect(evidenceSmokePassed({ ...base, inspect_page_called: false })).toBe(false);
    expect(evidenceSmokePassed({ ...base, submit_investigator_evidence_called: false })).toBe(false);
    expect(evidenceSmokePassed({ ...base, primary_1_candidate_count: 0 })).toBe(false);
    expect(evidenceSmokePassed({ ...base, all_candidates_opened: false })).toBe(false);
    expect(evidenceSmokePassed({ ...base, candidate_provenance_gate: "FAIL" })).toBe(false);
    expect(evidenceSmokePassed({ ...base, packet_final_state: "FAILED" })).toBe(false);
  });
});
