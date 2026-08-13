import { describe, expect, it } from "vitest";
import { MODEL_NOT_FOUND, PiModelResolver } from "./pi-model-resolver.js";

describe("PiModelResolver", () => {
  it("resolves a model that exists in the Pi registry", async () => {
    const resolver = await PiModelResolver.create();
    const result = resolver.resolveConfiguredModel("deepseek", "deepseek-v4-pro");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.model.provider).toBe("deepseek");
      expect(result.model.id).toBe("deepseek-v4-pro");
      expect(result.runtime).toBeDefined();
    }
  });

  it("fails closed with MODEL_NOT_FOUND for an unknown model id", async () => {
    const resolver = await PiModelResolver.create();
    const result = resolver.resolveConfiguredModel("deepseek", "no-such-model");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe(MODEL_NOT_FOUND);
      expect(result.provider).toBe("deepseek");
    }
  });

  it("fails closed with MODEL_NOT_FOUND for an unknown provider", async () => {
    const resolver = await PiModelResolver.create();
    const result = resolver.resolveConfiguredModel("no-such-provider", "deepseek-v4-pro");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe(MODEL_NOT_FOUND);
    }
  });
});
