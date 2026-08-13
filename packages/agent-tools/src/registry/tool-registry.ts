import type { AgentToolDefinition } from "../contracts/tool-types.js";
import type { ToolFailureCode } from "../contracts/tool-failure-codes.js";

export type ToolRegistryErrorCode = ToolFailureCode | "DUPLICATE_TOOL";

export class ToolRegistryError extends Error {
  constructor(
    readonly code: ToolRegistryErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ToolRegistryError";
  }
}

export class ToolRegistry {
  private readonly tools = new Map<string, AgentToolDefinition>();

  constructor(tools: readonly AgentToolDefinition[] = []) {
    for (const tool of tools) {
      this.register(tool);
    }
  }

  register(tool: AgentToolDefinition): void {
    if (this.tools.has(tool.name)) {
      throw new ToolRegistryError("DUPLICATE_TOOL", `Duplicate tool name: ${tool.name}`);
    }
    this.tools.set(tool.name, tool);
  }

  get(name: string): AgentToolDefinition | undefined {
    return this.tools.get(name);
  }

  getOrThrow(name: string): AgentToolDefinition {
    const tool = this.get(name);
    if (!tool) {
      throw new ToolRegistryError("UNKNOWN_TOOL", `Unknown tool: ${name}`);
    }
    return tool;
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }

  list(): AgentToolDefinition[] {
    return [...this.tools.values()].sort((left, right) => left.name.localeCompare(right.name));
  }
}
