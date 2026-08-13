import type { AgentRole } from "../model/model-types.js";
import { ModelPolicy, MODEL_NOT_CONFIGURED } from "../model/model-policy.js";
import type { AgentSessionFactoryResult } from "./session-types.js";

/**
 * Boundary for creating production Agent sessions.
 *
 * No model is selected in this foundation phase, so the factory fails closed
 * with MODEL_NOT_CONFIGURED. It never constructs a real Pi AgentSession, never
 * calls `session.prompt()`, and never creates LLM API requests.
 */
export class AgentSessionFactory {
  constructor(private readonly modelPolicy: ModelPolicy) {}

  async createAgentSession(role: AgentRole): Promise<AgentSessionFactoryResult> {
    const resolved = this.modelPolicy.resolve(role);
    if (!resolved.ok) {
      return { status: "NOT_CONFIGURED", role, reason: MODEL_NOT_CONFIGURED };
    }
    // Deferred to Step 2B: create a Pi AgentSession with the resolved model
    // and `tools: resolveProductionTools()` (see tool-policy.ts).
    return { status: "READY", role };
  }
}
