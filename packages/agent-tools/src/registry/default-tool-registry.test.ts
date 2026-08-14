import { Type } from "@sinclair/typebox";
import { describe, expect, it } from "vitest";
import { createAgentToolRegistry } from "./default-tool-registry.js";

describe("createAgentToolRegistry", () => {
  it("registers all five generic tools and no default coding tools", () => {
    const registry = createAgentToolRegistry();
    const names = registry.list().map((tool) => tool.name);
    expect(names).toEqual([
      "fetch_page",
      "get_region_context",
      "inspect_page",
      "render_page",
      "search_web",
    ]);
    for (const forbidden of ["read", "bash", "edit", "write"]) {
      expect(registry.has(forbidden)).toBe(false);
    }
  });

  it("adds submit_inventory only when provided (6 tools, no coding tools)", () => {
    const registry = createAgentToolRegistry({
      submitInventoryTool: {
        name: "submit_inventory",
        description: "stub",
        inputSchema: Type.Object({}, { additionalProperties: false }),
        async execute() {
          return { status: "ACCEPTED", frozen: true, itemCount: 0, payloadHash: "h" };
        },
      },
    });
    const names = registry.list().map((tool) => tool.name);
    expect(names).toEqual([
      "fetch_page",
      "get_region_context",
      "inspect_page",
      "render_page",
      "search_web",
      "submit_inventory",
    ]);
    for (const forbidden of ["read", "bash", "edit", "write"]) {
      expect(registry.has(forbidden)).toBe(false);
    }
  });
});
