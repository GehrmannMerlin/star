import { resolveRuntimeModelConfig, type RuntimeModelEnv } from "./runtime-model-config.js";
import type { ModelConfig } from "./model-types.js";

/**
 * Server-side model configuration source.
 *
 * Reads the provider and model id from the server runtime environment
 * (AGENT_MODEL_PROVIDER / AGENT_MODEL_ID). When either is missing this returns
 * undefined and ModelPolicy fails closed with MODEL_NOT_CONFIGURED. Provider-
 * neutral: no provider name is hardcoded here.
 */
export function resolveModelConfig(env?: RuntimeModelEnv): ModelConfig | undefined {
  return resolveRuntimeModelConfig(env);
}
