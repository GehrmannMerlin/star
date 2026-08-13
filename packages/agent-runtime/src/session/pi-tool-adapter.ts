import type { ToolDefinition } from "@earendil-works/pi-coding-agent";
import {
  ToolGateway,
  createAgentToolRegistry,
  type ToolInvocationContext,
  type ToolRegistry,
} from "@stellaris/agent-tools";

export type ToolInvocationContextFactory = (signal: AbortSignal) => ToolInvocationContext;

export function createPiCustomTools(
  registry: ToolRegistry,
  gateway: ToolGateway,
  createContext: ToolInvocationContextFactory,
): ToolDefinition[] {
  return registry.list().map((tool) => ({
    name: tool.name,
    label: tool.name,
    description: tool.description,
    parameters: tool.inputSchema as ToolDefinition["parameters"],
    async execute(_toolCallId, params, signal) {
      const invocationSignal = signal ?? new AbortController().signal;
      const result = await gateway.execute(tool.name, params, createContext(invocationSignal));
      return {
        content: [{ type: "text", text: JSON.stringify(result) }],
        details: result,
      };
    },
  }));
}

export function resolveProductionCustomTools(
  createContext: ToolInvocationContextFactory,
): ToolDefinition[] {
  const registry = createAgentToolRegistry();
  return createPiCustomTools(registry, new ToolGateway(registry), createContext);
}
