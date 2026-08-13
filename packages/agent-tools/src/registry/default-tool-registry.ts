import { getRegionContextTool } from "../tools/region/get-region-context.js";
import { ToolRegistry } from "./tool-registry.js";

export function createAgentToolRegistry(): ToolRegistry {
  return new ToolRegistry([getRegionContextTool]);
}
