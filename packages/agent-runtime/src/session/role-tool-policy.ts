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

/** Base tools shared by the other agent roles. */
export const BASE_AGENT_TOOLS = [
  "fetch_page",
  "get_region_context",
  "inspect_page",
  "render_page",
  "search_web",
] as const;

/** Tools the Investigator Agent may call (submit_investigation is the output
 *  boundary). submit_inventory stays Inventory-only. */
export const INVESTIGATOR_ROLE_TOOLS = [
  ...BASE_AGENT_TOOLS,
  "submit_investigation",
] as const;

/** Tools the Investigator Agent may call during the Position Evidence phase
 *  (submit_investigator_evidence is the output boundary). Same INVESTIGATOR
 *  role; submit_investigation is intentionally not granted. */
export const INVESTIGATOR_EVIDENCE_ROLE_TOOLS = [
  ...BASE_AGENT_TOOLS,
  "submit_investigator_evidence",
] as const;

/** Tools the Reviewer Agent may call (submit_review_decision is the only
 *  output boundary). No submit_inventory / submit_investigation /
 *  submit_investigator_evidence; no coding tools. */
export const REVIEWER_ROLE_TOOLS = [
  ...BASE_AGENT_TOOLS,
  "submit_review_decision",
] as const;

/** Tools the Recovery Agent may call (submit_recovery_evidence is the only
 *  output boundary). No submit_inventory / submit_investigation /
 *  submit_investigator_evidence / submit_review_decision; no coding tools. */
export const RECOVERY_ROLE_TOOLS = [
  ...BASE_AGENT_TOOLS,
  "submit_recovery_evidence",
] as const;

export type RoleToolPolicy = Record<AgentRole, readonly string[]>;

export const ROLE_TOOL_POLICY: RoleToolPolicy = {
  INVENTORY: INVENTORY_ROLE_TOOLS,
  INVESTIGATOR: INVESTIGATOR_ROLE_TOOLS,
  RECOVERY: RECOVERY_ROLE_TOOLS,
  REVIEWER: REVIEWER_ROLE_TOOLS,
};

/** Allowed tool names for a role (the Pi session allowlist source). */
export function roleToolsFor(role: AgentRole): readonly string[] {
  return ROLE_TOOL_POLICY[role];
}
