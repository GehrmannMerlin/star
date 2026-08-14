import { describe, expect, it } from "vitest";
import { ROLE_TOOL_POLICY, roleToolsFor, RECOVERY_ROLE_TOOLS } from "../session/role-tool-policy.js";

describe("Recovery role tool policy", () => {
  it("grants exactly the base tools plus submit_recovery_evidence", () => {
    expect([...RECOVERY_ROLE_TOOLS].sort()).toEqual(
      [
        "fetch_page",
        "get_region_context",
        "inspect_page",
        "render_page",
        "search_web",
        "submit_recovery_evidence",
      ].sort(),
    );
  });

  it("maps the RECOVERY role to the recovery tool set", () => {
    expect(ROLE_TOOL_POLICY.RECOVERY).toEqual(RECOVERY_ROLE_TOOLS);
    expect(roleToolsFor("RECOVERY")).toEqual(RECOVERY_ROLE_TOOLS);
  });

  it("never grants other output-boundary submit tools or coding tools", () => {
    const tools = new Set<string>(RECOVERY_ROLE_TOOLS);
    expect(tools.has("submit_inventory")).toBe(false);
    expect(tools.has("submit_investigation")).toBe(false);
    expect(tools.has("submit_investigator_evidence")).toBe(false);
    expect(tools.has("submit_review_decision")).toBe(false);
    expect(tools.has("read")).toBe(false);
    expect(tools.has("bash")).toBe(false);
    expect(tools.has("edit")).toBe(false);
    expect(tools.has("write")).toBe(false);
  });
});
