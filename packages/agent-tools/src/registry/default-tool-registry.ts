import type { AgentToolDefinition } from "../contracts/tool-types.js";
import { createFetchPageTool } from "../tools/fetch/fetch-page.js";
import { createSearchWebTool } from "../tools/search/search-web.js";
import { getRegionContextTool } from "../tools/region/get-region-context.js";
import { ToolRegistry } from "./tool-registry.js";

export type CreateAgentToolRegistryOptions = {
  /** Override the search_web tool (e.g. a stubbed provider in tests). */
  searchWebTool?: AgentToolDefinition;
  /** Override the fetch_page tool (e.g. a stubbed fetcher in tests). */
  fetchPageTool?: AgentToolDefinition;
};

export function createAgentToolRegistry(
  options: CreateAgentToolRegistryOptions = {},
): ToolRegistry {
  const searchWeb = options.searchWebTool ?? createSearchWebTool();
  const fetchPage = options.fetchPageTool ?? createFetchPageTool();
  return new ToolRegistry([getRegionContextTool, searchWeb, fetchPage]);
}
