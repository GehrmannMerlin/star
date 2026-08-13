import type { ModelConfig } from "./model-types.js";

/**
 * Server-side model configuration source.
 *
 * In this foundation phase no provider or model has been selected, so this
 * always resolves to `undefined`, which makes ModelPolicy fail closed with
 * MODEL_NOT_CONFIGURED. LLM provider selection is intentionally deferred
 * (see the Phase 2A plan).
 */
export function resolveModelConfig(): ModelConfig | undefined {
  return undefined;
}
