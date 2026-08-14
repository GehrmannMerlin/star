import { describe, expect, it } from "vitest";
import { reviewerSmokePassed, parseReviewerSmokeArgs } from "./reviewer-smoke.js";

describe("reviewer smoke", () => {
  it("parses --region-code / --institution / --budget-ms / --fixture", () => {
    const args = parseReviewerSmokeArgs([
      "--region-code",
      "320106",
      "--institution",
      "鼓楼区人民政府",
      "--budget-ms",
      "540000",
      "--fixture",
      "/tmp/reviewer-input.json",
    ]);
    expect(args.regionCode).toBe("320106");
    expect(args.institution).toBe("鼓楼区人民政府");
    expect(args.budgetMs).toBe(540000);
    expect(args.fixture).toBe("/tmp/reviewer-input.json");
  });

  it("returns a passing gate only when every reviewer smoke requirement is met", () => {
    const base: Record<string, unknown> = {
      reviewer_session_created: true,
      fresh_session: true,
      investigator_session_reused: false,
      evidence_session_reused: false,
      skill_loaded: true,
      role: "REVIEWER",
      search_web_called: true,
      bocha_called: true,
      fetch_page_called: true,
      inspect_page_called: true,
      submit_review_decision_called: true,
      primary_1_outcome: "APPROVED",
      primary_2_outcome: "APPROVED",
      primary_1_candidate_in_pool: true,
      primary_2_candidate_in_pool: true,
      primary_1_reopened: true,
      primary_1_inspected: true,
      primary_2_reopened: true,
      primary_2_inspected: true,
      observation_gate: "PASS",
      decision_frozen: true,
      packet_final_state: "POSITION_DECIDED",
      agent_completed: true,
    };
    expect(reviewerSmokePassed(base)).toBe(true);
    expect(reviewerSmokePassed({ ...base, search_web_called: false })).toBe(false);
    expect(reviewerSmokePassed({ ...base, inspect_page_called: false })).toBe(false);
    expect(reviewerSmokePassed({ ...base, submit_review_decision_called: false })).toBe(false);
    expect(reviewerSmokePassed({ ...base, primary_2_outcome: "REWORK_REQUIRED" })).toBe(false);
    expect(reviewerSmokePassed({ ...base, primary_1_reopened: false })).toBe(false);
    expect(reviewerSmokePassed({ ...base, observation_gate: "FAIL" })).toBe(false);
    expect(reviewerSmokePassed({ ...base, packet_final_state: "RECOVERY_REQUIRED" })).toBe(false);
  });
});
