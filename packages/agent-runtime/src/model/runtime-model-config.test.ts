import { describe, expect, it } from "vitest";
import { resolveRuntimeModelConfig } from "./runtime-model-config.js";

describe("RuntimeModelConfig", () => {
  it("parses AGENT_MODEL_PROVIDER and AGENT_MODEL_ID from the environment", () => {
    const config = resolveRuntimeModelConfig({
      AGENT_MODEL_PROVIDER: "deepseek",
      AGENT_MODEL_ID: "deepseek-v4-pro",
    });
    expect(config).toEqual({ provider: "deepseek", model: "deepseek-v4-pro" });
  });

  it("fails closed when the provider is missing", () => {
    expect(resolveRuntimeModelConfig({ AGENT_MODEL_ID: "deepseek-v4-pro" })).toBeUndefined();
    expect(resolveRuntimeModelConfig({})).toBeUndefined();
  });

  it("fails closed when the model id is missing", () => {
    expect(resolveRuntimeModelConfig({ AGENT_MODEL_PROVIDER: "deepseek" })).toBeUndefined();
  });

  it("is provider-neutral and never hardcodes deepseek", () => {
    const deepseek = resolveRuntimeModelConfig({
      AGENT_MODEL_PROVIDER: "deepseek",
      AGENT_MODEL_ID: "deepseek-v4-pro",
    });
    const other = resolveRuntimeModelConfig({
      AGENT_MODEL_PROVIDER: "some-other-provider",
      AGENT_MODEL_ID: "other-model",
    });
    expect(deepseek?.provider).toBe("deepseek");
    expect(other?.provider).toBe("some-other-provider");
    expect(other?.model).toBe("other-model");
  });
});
