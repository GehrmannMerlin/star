import { describe, expect, it } from "vitest";
import { parseRecoverySmokeArgs, recoverySmokePassed } from "./recovery-smoke.js";

describe("recovery smoke", () => {
  it("parses --region-code / --institution / --budget-ms / --fixture", () => {
    const args = parseRecoverySmokeArgs([
      "--region-code",
      "320106",
      "--institution",
      "鼓楼区人民政府",
      "--budget-ms",
      "360000",
      "--fixture",
      "/tmp/recovery-input.json",
    ]);
    expect(args.regionCode).toBe("320106");
    expect(args.institution).toBe("鼓楼区人民政府");
    expect(args.budgetMs).toBe(360000);
    expect(args.fixture).toBe("/tmp/recovery-input.json");
  });

  it("returns a passing gate only when every recovery smoke requirement is met", () => {
    const base: Record<string, unknown> = {
      packet_initial_state: "RECOVERY_REQUIRED",
      recovery_session_created: true,
      fresh_session: true,
      reviewer_session_reused: false,
      investigator_session_reused: false,
      skill_loaded: true,
      role: "RECOVERY",
      search_web_called: true,
      bocha_called: true,
      fetch_page_called: true,
      inspect_page_called: true,
      submit_recovery_evidence_called: true,
      recovery_candidate_count: 1,
      new_candidate_not_in_original_pool: true,
      all_new_candidates_opened: true,
      all_new_candidates_inspected: true,
      candidate_primary_join: "PASS",
      recovery_submission_frozen: true,
      original_candidate_pool_modified: false,
      composite_candidate_view_created: true,
      packet_final_state: "READY_FOR_REVIEW",
      agent_completed: true,
    };
    expect(recoverySmokePassed(base)).toBe(true);
    expect(recoverySmokePassed({ ...base, search_web_called: false })).toBe(false);
    expect(recoverySmokePassed({ ...base, bocha_called: false })).toBe(false);
    expect(recoverySmokePassed({ ...base, inspect_page_called: false })).toBe(false);
    expect(recoverySmokePassed({ ...base, submit_recovery_evidence_called: false })).toBe(false);
    expect(recoverySmokePassed({ ...base, recovery_candidate_count: 0 })).toBe(false);
    expect(recoverySmokePassed({ ...base, new_candidate_not_in_original_pool: false })).toBe(false);
    expect(recoverySmokePassed({ ...base, all_new_candidates_opened: false })).toBe(false);
    expect(recoverySmokePassed({ ...base, packet_final_state: "FAILED" })).toBe(false);
  });
});
