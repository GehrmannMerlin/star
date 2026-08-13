/**
 * Production tool policy for Pi Agent sessions.
 *
 * Pi ships default coding tools (read, bash, edit, write). Those MUST NOT
 * enter a production Agent session. Allowlisted custom Agent tools are
 * assembled separately by the Pi adapter.
 */
export const PI_DEFAULT_CODING_TOOLS = ["read", "bash", "edit", "write"] as const;

export type ProductionToolPolicy = {
  /** Default Pi coding tools are disabled for production sessions. */
  defaultCodingToolsEnabled: false;
  /** Pi's built-in production tool allowlist remains empty. */
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
