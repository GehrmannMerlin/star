import { describe, expect, it } from "vitest";
import {
  parseRecoveryRereviewSmokeArgs,
  recoveryRereviewSmokePassed,
} from "./recovery-rereview-smoke.js";

describe("recovery re-review smoke", () => {
  it("parses --region-code / --institution / --budget-ms / --fixture", () => {
    const args = parseRecoveryRereviewSmokeArgs([
      "--region-code",
      "320106",
      "--institution",
      "鼓楼区人民政府",
      "--budget-ms",
      "360000",
      "--fixture",
      "/tmp/rereview-input.json",
    ]);
    expect(args.regionCode).toBe("320106");
    expect(args.institution).toBe("鼓楼区人民政府");
    expect(args.budgetMs).toBe(360000);
    expect(args.fixture).toBe("/tmp/rereview-input.json");
  });

  it("returns a passing gate only when every STEP 14 completion criterion is met", () => {
    const base: Record<string, unknown> = {
      migration: "PASS",
      evidence_persisted: true,
      round1_review_persisted: true,
      recovery_round1_persisted: true,
      repositories_recreated: true,
      original_evidence_reloaded: true,
      recovery_supplement_reloaded: true,
      composite_rehydrated: true,
      original_pool_unchanged: true,
      round2_reviewer_fresh_session: true,
      search_web_called: true,
      bocha_called: true,
      fetch_or_render_called: true,
      inspect_page_called: true,
      submit_review_decision_called: true,
      round2_review_persisted: true,
      review_history_count: 2,
      latest_review_round: 2,
      latest_review_outcome: "APPROVED",
      final_position_decision_source: "LATEST_FROZEN_APPROVED_REVIEW",
      packet_final_state: "POSITION_DECIDED",
      agent_completed: true,
    };
    expect(recoveryRereviewSmokePassed(base)).toBe(true);
    expect(recoveryRereviewSmokePassed({ ...base, review_history_count: 1 })).toBe(false);
    expect(recoveryRereviewSmokePassed({ ...base, latest_review_round: 1 })).toBe(false);
    expect(recoveryRereviewSmokePassed({ ...base, latest_review_outcome: "REWORK_REQUIRED" })).toBe(false);
    expect(
      recoveryRereviewSmokePassed({ ...base, final_position_decision_source: undefined }),
    ).toBe(false);
    expect(recoveryRereviewSmokePassed({ ...base, packet_final_state: "RECOVERY_REQUIRED" })).toBe(false);
    expect(recoveryRereviewSmokePassed({ ...base, round2_review_persisted: false })).toBe(false);
    expect(recoveryRereviewSmokePassed({ ...base, search_web_called: false })).toBe(false);
    expect(recoveryRereviewSmokePassed({ ...base, bocha_called: false })).toBe(false);
  });
});
