import type { AgentSession, SessionManager } from "@earendil-works/pi-coding-agent";
import type { AgentRole } from "../model/model-types.js";
import { MODEL_NOT_FOUND } from "../model/pi-model-resolver.js";

export { MODEL_NOT_FOUND };

/**
 * Result of AgentSessionFactory.createAgentSession.
 *
 * READY carries the live Pi AgentSession plus the in-memory session manager so
 * the caller can prompt the agent and observe tool calls. Model failures fail
 * closed (NOT_CONFIGURED / MODEL_NOT_FOUND); the factory never falls back to a
 * different provider or model.
 */
export type AgentSessionFactoryResult =
  | { status: "NOT_CONFIGURED"; role: AgentRole; reason: "MODEL_NOT_CONFIGURED" }
  | {
      status: "MODEL_NOT_FOUND";
      role: AgentRole;
      reason: "MODEL_NOT_FOUND";
      provider: string;
      model: string;
    }
  | {
      status: "READY";
      role: AgentRole;
      session: AgentSession;
      agentSessionId: string;
      sessionManager: SessionManager;
    };
