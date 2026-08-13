import type { AgentToolDefinition } from "../contracts/tool-types.js";
import { createSearchWebTool } from "../tools/search/search-web.js";
import { getRegionContextTool } from "../tools/region/get-region-context.js";
import { ToolRegistry } from "./tool-registry.js";

export type CreateAgentToolRegistryOptions = {
  /** Override the search_web tool (e.g. a stubbed provider in tests). */
  searchWebTool?: AgentToolDefinition;
};

export function createAgentToolRegistry(
  options: CreateAgentToolRegistryOptions = {},
): ToolRegistry {
  const searchWeb = options.searchWebTool ?? createSearchWebTool();
  return new ToolRegistry([getRegionContextTool, searchWeb]);
}
