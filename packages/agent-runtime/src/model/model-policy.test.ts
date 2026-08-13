import { describe, it, expect } from "vitest";
import { CreateTaskRequest } from "@stellaris/contracts";
import { AGENT_ROLES, isAgentRole } from "./model-types.js";
import { MODEL_NOT_CONFIGURED, ModelPolicy } from "./model-policy.js";

describe("ModelPolicy", () => {
  it("defines exactly the four valid agent roles", () => {
    expect([...AGENT_ROLES]).toEqual(["INVENTORY", "INVESTIGATOR", "RECOVERY", "REVIEWER"]);
    for (const role of AGENT_ROLES) {
      expect(isAgentRole(role)).toBe(true);
    }
    expect(isAgentRole("CEO")).toBe(false);
    expect(isAgentRole(undefined)).toBe(false);
  });

  it("fails closed with MODEL_NOT_CONFIGURED when no model is configured", () => {
    const policy = new ModelPolicy();
    const result = policy.resolve("INVESTIGATOR");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe(MODEL_NOT_CONFIGURED);
      expect(result.role).toBe("INVESTIGATOR");
    }
  });

  it("resolves a configured model without hardcoding any provider", () => {
    const policy = new ModelPolicy(() => ({ provider: "acme", model: "acme-lite" }));
    const result = policy.resolve("REVIEWER");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.provider).toBe("acme");
      expect(result.model).toBe("acme-lite");
    }
  });

  it("keeps model/provider/apiKey/thinkingLevel out of the user task contract", () => {
    const keys = Object.keys(CreateTaskRequest.properties);
    for (const forbidden of ["model", "provider", "apiKey", "thinkingLevel"]) {
      expect(keys).not.toContain(forbidden);
    }
  });
});
