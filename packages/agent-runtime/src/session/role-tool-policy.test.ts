import { describe, expect, it } from "vitest";
import { PI_DEFAULT_CODING_TOOLS } from "./tool-policy.js";
import { roleToolsFor } from "./role-tool-policy.js";

describe("role tool policy", () => {
  it("grants the Inventory role exactly the six business tools and no coding tools", () => {
    const inventoryTools = roleToolsFor("INVENTORY");
    expect([...inventoryTools]).toEqual([
      "fetch_page",
      "get_region_context",
      "inspect_page",
      "render_page",
      "search_web",
      "submit_inventory",
    ]);
    for (const forbidden of PI_DEFAULT_CODING_TOOLS) {
      expect(inventoryTools).not.toContain(forbidden);
    }
    // submit_inventory is Inventory-only.
    expect(roleToolsFor("INVESTIGATOR")).not.toContain("submit_inventory");
  });
});
