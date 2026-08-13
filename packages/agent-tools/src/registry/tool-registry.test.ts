import { describe, expect, it } from "vitest";
import { Type } from "@sinclair/typebox";
import type { AgentToolDefinition } from "../contracts/tool-types.js";
import { ToolRegistry } from "./tool-registry.js";

const tool = (name: string): AgentToolDefinition<typeof schema, { ok: boolean }> => ({
  name,
  description: name,
  inputSchema: schema,
  async execute(_context, input) {
    return input;
  },
});
const schema = Type.Object({ ok: Type.Boolean() });

describe("ToolRegistry", () => {
  it("registers and gets a unique tool", () => {
    const registry = new ToolRegistry();
    registry.register(tool("alpha"));
    expect(registry.has("alpha")).toBe(true);
    expect(registry.get("alpha")?.name).toBe("alpha");
  });

  it("fails closed instead of overwriting a duplicate name", () => {
    const registry = new ToolRegistry();
    registry.register(tool("same"));
    expect(() => registry.register(tool("same"))).toThrowError(
      expect.objectContaining({ code: "DUPLICATE_TOOL" }),
    );
  });

  it("throws canonical UNKNOWN_TOOL for an unknown required lookup", () => {
    expect(() => new ToolRegistry().getOrThrow("missing")).toThrowError(
      expect.objectContaining({ code: "UNKNOWN_TOOL" }),
    );
  });

  it("lists tools deterministically by stable name", () => {
    const registry = new ToolRegistry([tool("zeta"), tool("alpha")]);
    expect(registry.list().map((item) => item.name)).toEqual(["alpha", "zeta"]);
  });
});
