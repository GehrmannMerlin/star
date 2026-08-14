import { describe, it, expect } from "vitest";
import { TABLE_NAMES } from "./schema.js";

describe("db schema baseline", () => {
  it("30 张表清单齐全", () => {
    expect(TABLE_NAMES).toHaveLength(30);
    expect(TABLE_NAMES).toContain("task_run");
    expect(TABLE_NAMES).toContain("result_row");
    expect(TABLE_NAMES).toContain("tool_event");
    expect(TABLE_NAMES).toContain("investigator_evidence_submission");
    expect(TABLE_NAMES).toContain("review_decision_submission");
    expect(TABLE_NAMES).toContain("recovery_submission");
    expect(TABLE_NAMES).toContain("institution_work_packet");
  });
});
