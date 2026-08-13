import type { AgentRole } from "../model/model-types.js";

/**
 * Result of AgentSessionFactory.createAgentSession.
 *
 * In this foundation phase no model is selected, so the factory always fails
 * closed with NOT_CONFIGURED. The READY branch is deferred to Step 2B, when a
 * server-side model is selected and a real Pi AgentSession can be created
 * with `tools: resolveProductionTools()`.
 */
export type AgentSessionFactoryResult =
  | { status: "NOT_CONFIGURED"; role: AgentRole; reason: "MODEL_NOT_CONFIGURED" }
  | { status: "READY"; role: AgentRole };
