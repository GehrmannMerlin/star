import type { AgentRole } from "@stellaris/contracts";

/** Tools the Inventory Agent may call (submit_inventory is the output boundary).
 *  Alphabetical, matching ToolRegistry.list() ordering. */
export const INVENTORY_ROLE_TOOLS = [
  "fetch_page",
  "get_region_context",
  "inspect_page",
  "render_page",
  "search_web",
  "submit_inventory",
] as const;

/** Base tools shared by the other agent roles (future roles get their own policy). */
export const BASE_AGENT_TOOLS = [
  "fetch_page",
  "get_region_context",
  "inspect_page",
  "render_page",
  "search_web",
] as const;

export type RoleToolPolicy = Record<AgentRole, readonly string[]>;

export const ROLE_TOOL_POLICY: RoleToolPolicy = {
  INVENTORY: INVENTORY_ROLE_TOOLS,
  INVESTIGATOR: BASE_AGENT_TOOLS,
  RECOVERY: BASE_AGENT_TOOLS,
  REVIEWER: BASE_AGENT_TOOLS,
};

/** Allowed tool names for a role (the Pi session allowlist source). */
export function roleToolsFor(role: AgentRole): readonly string[] {
  return ROLE_TOOL_POLICY[role];
}
