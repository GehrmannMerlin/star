import { describe, expect, it } from "vitest";
import {
  MemoryToolEventSink,
  ToolGateway,
  createAgentToolRegistry,
} from "@stellaris/agent-tools";
import {
  createPiCustomTools,
  resolveProductionCustomTools,
} from "./pi-tool-adapter.js";
import { resolveProductionTools } from "./tool-policy.js";

const context = (signal = new AbortController().signal) => ({
  taskRunId: "task-pi",
  agentSessionId: "session-pi",
  agentRole: "INVESTIGATOR" as const,
  signal,
});

describe("Pi custom tool adapter", () => {
  it("preserves name and schema and forwards execution through ToolGateway", async () => {
    const registry = createAgentToolRegistry();
    const sink = new MemoryToolEventSink();
    const gateway = new ToolGateway(registry, sink);
    const [tool] = createPiCustomTools(registry, gateway, context);
    expect(tool?.name).toBe("get_region_context");
    expect(tool?.parameters).toMatchObject({
      type: "object",
      properties: { regionCode: { type: "string" } },
    });
    expect(tool?.parameters).toBe(registry.getOrThrow("get_region_context").inputSchema);

    const result = await tool?.execute(
      "pi-call",
      { regionCode: "340000" },
      new AbortController().signal,
      undefined,
      {} as never,
    );
    expect(result?.content[0]).toMatchObject({ type: "text" });
    expect(JSON.parse(result?.content[0]?.type === "text" ? result.content[0].text : "{}"))
      .toMatchObject({ status: "SUCCESS", data: { regionCode: "340000" } });
    expect(sink.starts).toHaveLength(1);
    expect(sink.successes).toHaveLength(1);
  });

  it("keeps coding tools empty and assembles only allowlisted custom tools", () => {
    expect(resolveProductionTools()).toEqual([]);
    const customTools = resolveProductionCustomTools(context);
    expect(customTools.map((tool) => tool.name)).toEqual(["get_region_context"]);
    for (const forbidden of ["read", "bash", "edit", "write"]) {
      expect(customTools.some((tool) => tool.name === forbidden)).toBe(false);
    }
  });
});
