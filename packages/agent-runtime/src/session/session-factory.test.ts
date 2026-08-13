import { describe, it, expect } from "vitest";
import { ModelPolicy } from "../model/model-policy.js";
import { AgentSessionFactory } from "./session-factory.js";
import { PI_DEFAULT_CODING_TOOLS, PRODUCTION_TOOL_POLICY, resolveProductionTools } from "./tool-policy.js";

describe("AgentSessionFactory", () => {
  it("fails closed with MODEL_NOT_CONFIGURED when no model is configured", async () => {
    const factory = new AgentSessionFactory(new ModelPolicy());
    const result = await factory.createAgentSession("INVENTORY");
    expect(result.status).toBe("NOT_CONFIGURED");
    if (result.status === "NOT_CONFIGURED") {
      expect(result.reason).toBe("MODEL_NOT_CONFIGURED");
    }
  });

  it("returns READY once a model is configured (deferred boundary)", async () => {
    const factory = new AgentSessionFactory(
      new ModelPolicy(() => ({ provider: "acme", model: "acme-lite" })),
    );
    const result = await factory.createAgentSession("REVIEWER");
    expect(result.status).toBe("READY");
  });

  it("locks production default coding tools to empty", () => {
    expect(PRODUCTION_TOOL_POLICY.defaultCodingToolsEnabled).toBe(false);
    expect(resolveProductionTools()).toEqual([]);
    expect([...PI_DEFAULT_CODING_TOOLS]).toEqual(["read", "bash", "edit", "write"]);
  });
});
