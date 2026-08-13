import { describe, expect, it } from "vitest";
import { ToolGateway } from "../../gateway/tool-gateway.js";
import { MemoryToolEventSink } from "../../telemetry/tool-event-sink.js";
import { createAgentToolRegistry } from "../../registry/default-tool-registry.js";
import { getRegionContextTool } from "./get-region-context.js";

const invocationContext = {
  taskRunId: "task-region",
  agentSessionId: "session-region",
  agentRole: "INVENTORY" as const,
  signal: new AbortController().signal,
};

describe("get_region_context", () => {
  it("looks up a province from the existing region tree", async () => {
    await expect(getRegionContextTool.execute(invocationContext, { regionCode: "340000" }))
      .resolves.toEqual({
        regionCode: "340000",
        name: "安徽省",
        level: "province",
        parent: null,
        ancestors: [],
      });
  });

  it("looks up a prefecture and its province parent", async () => {
    const result = await getRegionContextTool.execute(invocationContext, { regionCode: "340100" });
    expect(result).toMatchObject({
      regionCode: "340100",
      name: "合肥市",
      level: "city",
      parent: { code: "340000", name: "安徽省", level: "province" },
      ancestors: [{ code: "340000", name: "安徽省", level: "province" }],
    });
  });

  it("looks up a county with ordered province and prefecture ancestors", async () => {
    const result = await getRegionContextTool.execute(invocationContext, { regionCode: "340102" });
    expect(result).toMatchObject({
      regionCode: "340102",
      name: "瑶海区",
      level: "county",
      parent: { code: "340100", name: "合肥市", level: "city" },
    });
    expect(result.ancestors.map((item) => item.code)).toEqual(["340000", "340100"]);
  });

  it("returns REGION_NOT_FOUND through the Gateway for an unknown code", async () => {
    const sink = new MemoryToolEventSink();
    const gateway = new ToolGateway(createAgentToolRegistry(), sink);
    const result = await gateway.execute("get_region_context", { regionCode: "999999" }, invocationContext);
    expect(result.status).toBe("FAILED");
    if (result.status !== "SUCCESS") expect(result.failure.code).toBe("REGION_NOT_FOUND");
    expect(sink.starts).toHaveLength(1);
    expect(sink.failures).toHaveLength(1);
  });

  it("rejects malformed region codes before executing the tool", async () => {
    const sink = new MemoryToolEventSink();
    const gateway = new ToolGateway(createAgentToolRegistry(), sink);
    const result = await gateway.execute("get_region_context", { regionCode: "34" }, invocationContext);
    expect(result.status).toBe("FAILED");
    if (result.status !== "SUCCESS") expect(result.failure.code).toBe("INVALID_INPUT");
    expect(sink.failures).toHaveLength(1);
  });
});
