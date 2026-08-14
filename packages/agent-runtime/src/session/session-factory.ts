import {
  createAgentSession,
  SessionManager,
  type CreateAgentSessionOptions,
  type ResourceLoader,
} from "@earendil-works/pi-coding-agent";
import {
  createAgentToolRegistry,
  MemoryToolEventSink,
  ToolGateway,
  type ToolEventSink,
  type ToolRegistry,
} from "@stellaris/agent-tools";
import type { AgentRole } from "../model/model-types.js";
import { MODEL_NOT_CONFIGURED, ModelPolicy } from "../model/model-policy.js";
import { MODEL_NOT_FOUND, PiModelResolver } from "../model/pi-model-resolver.js";
import { createPiCustomTools, type ToolInvocationContextFactory } from "./pi-tool-adapter.js";
import { roleToolsFor } from "./role-tool-policy.js";
import type { AgentSessionFactoryResult } from "./session-types.js";

/** Identity of the run that owns the session (used in tool invocation context). */
export type AgentRunRef = { taskRunId: string };

export type AgentSessionFactoryDeps = {
  modelPolicy: ModelPolicy;
  modelResolver: PiModelResolver;
  resourceLoader: ResourceLoader;
  /** ToolGateway to route custom tool calls through (defaults to a fresh one). */
  gateway?: ToolGateway;
  /** Tool event sink wired to the gateway (defaults to in-memory). */
  eventSink?: ToolEventSink;
  /** Custom tool registry (defaults to the full agent tool registry). */
  registry?: ToolRegistry;
  /** Override for tests: intercept the options passed to Pi. */
  createSession?: typeof createAgentSession;
};

/**
 * Boundary for creating production Pi Agent sessions.
 *
 * Wiring: ModelPolicy resolves the server-configured model, PiModelResolver
 * turns it into a Pi Model, and the session is built with:
 *   - tools: <role tool allowlist> (default Pi coding tools stay disabled)
 *   - customTools                    (only ToolGateway-backed custom tools)
 *   - resourceLoader                 (so the Skill is loaded through Pi's loader)
 *   - in-memory session manager      (no persistence this phase)
 */
export class AgentSessionFactory {
  private readonly registry: ToolRegistry;
  private readonly eventSink: ToolEventSink;
  private readonly gateway: ToolGateway;

  constructor(private readonly deps: AgentSessionFactoryDeps) {
    this.registry = deps.registry ?? createAgentToolRegistry();
    this.eventSink = deps.eventSink ?? new MemoryToolEventSink();
    this.gateway = deps.gateway ?? new ToolGateway(this.registry, this.eventSink);
  }

  async createAgentSession(
    role: AgentRole,
    run: AgentRunRef = { taskRunId: "manual" },
  ): Promise<AgentSessionFactoryResult> {
    const resolved = this.deps.modelPolicy.resolve(role);
    if (!resolved.ok) {
      return { status: "NOT_CONFIGURED", role, reason: MODEL_NOT_CONFIGURED };
    }

    const model = this.deps.modelResolver.resolveConfiguredModel(resolved.provider, resolved.model);
    if (!model.ok) {
      return {
        status: "MODEL_NOT_FOUND",
        role,
        reason: MODEL_NOT_FOUND,
        provider: model.provider,
        model: model.modelId,
      };
    }

    let agentSessionId = "";
    const createContext: ToolInvocationContextFactory = (signal) => ({
      taskRunId: run.taskRunId,
      agentSessionId,
      agentRole: role,
      signal,
    });
    const customTools = createPiCustomTools(this.registry, this.gateway, createContext);

    // Pi only activates a tool when its name appears in the `tools` allowlist
    // (probed: `tools: []` disables even custom tools). The allowlist is the
    // role tool policy intersected with the registry, so the default coding
    // tools (read/bash/edit/write) stay disabled and each role only sees its
    // own tools. Gate: default coding tools = 0, role tools present.
    const allowedToolNames = roleToolsFor(role).filter((name) => this.registry.has(name));

    const sessionManager = SessionManager.inMemory();
    const createSession = this.deps.createSession ?? createAgentSession;
    const options: CreateAgentSessionOptions = {
      model: model.model,
      modelRuntime: model.runtime,
      resourceLoader: this.deps.resourceLoader,
      sessionManager,
      tools: allowedToolNames,
      customTools,
    };
    const { session } = await createSession(options);
    agentSessionId = session.sessionManager.getSessionId();

    return { status: "READY", role, session, agentSessionId, sessionManager };
  }
}
