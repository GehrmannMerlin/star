export const AGENT_ROLES = ["INVENTORY", "INVESTIGATOR", "RECOVERY", "REVIEWER"] as const;

export type AgentRole = (typeof AGENT_ROLES)[number];

export function isAgentRole(value: unknown): value is AgentRole {
  return typeof value === "string" && (AGENT_ROLES as readonly string[]).includes(value);
}

/**
 * A resolved server-side model configuration.
 *
 * Vendor-neutral on purpose: no provider is hardcoded here. Users must never
 * configure `provider`, `model`, `apiKey`, or `thinkingLevel` — those are
 * server-side infrastructure decisions (see AGENTS.md).
 */
export type ModelConfig = {
  provider: string;
  model: string;
};
