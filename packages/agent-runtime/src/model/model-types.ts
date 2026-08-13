import type { AgentRole } from "@stellaris/contracts";
import type { RuntimeModelConfig } from "./runtime-model-config.js";

export { AGENT_ROLES, isAgentRole, type AgentRole } from "@stellaris/contracts";

/**
 * A resolved server-side model configuration.
 *
 * Vendor-neutral on purpose: no provider is hardcoded here. Users must never
 * configure `provider`, `model`, `apiKey`, or `thinkingLevel` — those are
 * server-side infrastructure decisions (see AGENTS.md).
 */
export type ModelConfig = RuntimeModelConfig;
