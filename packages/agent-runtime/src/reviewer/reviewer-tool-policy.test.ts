import { describe, expect, it } from "vitest";
import {
  REVIEWER_ROLE_TOOLS,
  ROLE_TOOL_POLICY,
  roleToolsFor,
} from "../session/role-tool-policy.js";

describe("REVIEWER role tool policy", () => {
  it("grants exactly the reviewer tool set", () => {
    expect(REVIEWER_ROLE_TOOLS).toEqual([
      "fetch_page",
      "get_region_context",
      "inspect_page",
      "render_page",
      "search_web",
      "submit_review_decision",
    ]);
  });

  it("has the reviewer allowlist and never other submit boundaries or coding tools", () => {
    const allowed = new Set(roleToolsFor("REVIEWER"));
    for (const tool of [
      "get_region_context",
      "search_web",
      "fetch_page",
      "render_page",
      "inspect_page",
      "submit_review_decision",
    ]) {
      expect(allowed.has(tool)).toBe(true);
    }
    for (const tool of [
      "submit_inventory",
      "submit_investigation",
      "submit_investigator_evidence",
      "read",
      "bash",
      "edit",
      "write",
    ]) {
      expect(allowed.has(tool)).toBe(false);
    }
  });

  it("registers REVIEWER in the role policy without mutating other roles", () => {
    expect(ROLE_TOOL_POLICY.REVIEWER).toContain("submit_review_decision");
    expect(ROLE_TOOL_POLICY.INVENTORY).not.toContain("submit_review_decision");
    expect(ROLE_TOOL_POLICY.INVESTIGATOR).not.toContain("submit_review_decision");
  });
});
