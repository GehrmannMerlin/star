/**
 * Production tool policy for Pi Agent sessions.
 *
 * Pi ships default coding tools (read, bash, edit, write). Those MUST NOT
 * enter a production Agent session. Custom Agent tools arrive in a later
 * phase, so the production allowlist is empty for now.
 */
export const PI_DEFAULT_CODING_TOOLS = ["read", "bash", "edit", "write"] as const;

export type ProductionToolPolicy = {
  /** Default Pi coding tools are disabled for production sessions. */
  defaultCodingToolsEnabled: false;
  /** Explicit production tool allowlist (empty until custom tools land). */
  tools: readonly string[];
};

export const PRODUCTION_TOOL_POLICY: ProductionToolPolicy = {
  defaultCodingToolsEnabled: false,
  tools: [],
};

/** The explicit tool allowlist a production Agent session must use. */
export function resolveProductionTools(): string[] {
  return [...PRODUCTION_TOOL_POLICY.tools];
}
