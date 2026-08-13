import type { AgentRole, ModelConfig } from "./model-types.js";
import { resolveModelConfig } from "./model-config.js";

export const MODEL_NOT_CONFIGURED = "MODEL_NOT_CONFIGURED" as const;

export type ModelPolicyResult =
  | { ok: true; role: AgentRole; provider: string; model: string }
  | { ok: false; role: AgentRole; reason: typeof MODEL_NOT_CONFIGURED };

export type ModelConfigResolver = () => ModelConfig | undefined;

/**
 * Vendor-neutral, fail-closed model policy.
 *
 * The production backend owns model selection entirely server-side. When no
 * model is configured, `resolve` returns MODEL_NOT_CONFIGURED instead of
 * auto-selecting any provider.
 */
export class ModelPolicy {
  constructor(private readonly resolver: ModelConfigResolver = resolveModelConfig) {}

  resolve(role: AgentRole): ModelPolicyResult {
    const config = this.resolver();
    if (!config) {
      return { ok: false, role, reason: MODEL_NOT_CONFIGURED };
    }
    return { ok: true, role, provider: config.provider, model: config.model };
  }
}
