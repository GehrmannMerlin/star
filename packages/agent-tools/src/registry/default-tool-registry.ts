import type { AgentToolDefinition } from "../contracts/tool-types.js";
import { createFetchPageTool } from "../tools/fetch/fetch-page.js";
import { createInspectPageTool } from "../tools/inspect/inspect-page.js";
import { createRenderPageTool } from "../tools/render/render-page.js";
import { createSearchWebTool } from "../tools/search/search-web.js";
import { getRegionContextTool } from "../tools/region/get-region-context.js";
import { ToolRegistry } from "./tool-registry.js";

export type CreateAgentToolRegistryOptions = {
  /** Override the search_web tool (e.g. a stubbed provider in tests). */
  searchWebTool?: AgentToolDefinition;
  /** Override the fetch_page tool (e.g. a stubbed fetcher in tests). */
  fetchPageTool?: AgentToolDefinition;
  /** Override the render_page tool (e.g. a stubbed renderer in tests). */
  renderPageTool?: AgentToolDefinition;
  /** Override the inspect_page tool (e.g. a stubbed inspector in tests). */
  inspectPageTool?: AgentToolDefinition;
  /** Adds the submit_inventory tool (Inventory Agent only; wired by the runner). */
  submitInventoryTool?: AgentToolDefinition;
  /** Adds the submit_investigation tool (Investigator Agent only; wired by the runner). */
  submitInvestigationTool?: AgentToolDefinition;
  /** Adds the submit_investigator_evidence tool (Investigator Evidence phase; wired by the runner). */
  submitInvestigatorEvidenceTool?: AgentToolDefinition;
  /** Adds the submit_review_decision tool (Reviewer Agent only; wired by the runner). */
  submitReviewDecisionTool?: AgentToolDefinition;
};

export function createAgentToolRegistry(
  options: CreateAgentToolRegistryOptions = {},
): ToolRegistry {
  const searchWeb = options.searchWebTool ?? createSearchWebTool();
  const fetchPage = options.fetchPageTool ?? createFetchPageTool();
  const renderPage = options.renderPageTool ?? createRenderPageTool();
  const inspectPage = options.inspectPageTool ?? createInspectPageTool();
  const tools: AgentToolDefinition[] = [
    getRegionContextTool,
    searchWeb,
    fetchPage,
    renderPage,
    inspectPage,
  ];
  if (options.submitInventoryTool) {
    tools.push(options.submitInventoryTool);
  }
  if (options.submitInvestigationTool) {
    tools.push(options.submitInvestigationTool);
  }
  if (options.submitInvestigatorEvidenceTool) {
    tools.push(options.submitInvestigatorEvidenceTool);
  }
  if (options.submitReviewDecisionTool) {
    tools.push(options.submitReviewDecisionTool);
  }
  return new ToolRegistry(tools);
}
