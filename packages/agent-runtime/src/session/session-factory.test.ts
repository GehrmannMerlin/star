import { describe, it, expect } from "vitest";
import type { CreateAgentSessionOptions, ResourceLoader } from "@earendil-works/pi-coding-agent";
import { createAgentToolRegistry, ToolGateway } from "@stellaris/agent-tools";
import { MODEL_NOT_CONFIGURED, ModelPolicy } from "../model/model-policy.js";
import { PiModelResolver } from "../model/pi-model-resolver.js";
import { AgentSessionFactory } from "./session-factory.js";
import { PI_DEFAULT_CODING_TOOLS, PRODUCTION_TOOL_POLICY, resolveProductionTools } from "./tool-policy.js";

/** Minimal ResourceLoader: never invoked when createSession is stubbed. */
const stubLoader = {
  reload: async () => {},
  getSkills: () => ({ skills: [], diagnostics: [] }),
  getExtensions: () => ({ extensions: [] }),
  getPrompts: () => ({ prompts: [], diagnostics: [] }),
  getThemes: () => ({ themes: [], diagnostics: [] }),
  getAgentsFiles: () => ({ agentsFiles: [] }),
  getSystemPrompt: () => undefined,
  getSystemPromptSource: () => undefined,
  getAppendSystemPrompt: () => [],
  getAppendSystemPromptSources: () => [],
  extendResources: () => {},
} as unknown as ResourceLoader;

const fakeSession = {
  sessionManager: { getSessionId: () => "session-test" },
};

describe("AgentSessionFactory", () => {
  it("fails closed with MODEL_NOT_CONFIGURED when no model is configured", async () => {
    const factory = new AgentSessionFactory({
      modelPolicy: new ModelPolicy(),
      modelResolver: await PiModelResolver.create(),
      resourceLoader: stubLoader,
      gateway: new ToolGateway(createAgentToolRegistry()),
    });
    const result = await factory.createAgentSession("INVENTORY");
    expect(result.status).toBe("NOT_CONFIGURED");
    if (result.status === "NOT_CONFIGURED") {
      expect(result.reason).toBe(MODEL_NOT_CONFIGURED);
    }
  });

  it("fails closed with MODEL_NOT_FOUND when the configured model is unknown", async () => {
    const factory = new AgentSessionFactory({
      modelPolicy: new ModelPolicy(() => ({ provider: "deepseek", model: "does-not-exist" })),
      modelResolver: await PiModelResolver.create(),
      resourceLoader: stubLoader,
      gateway: new ToolGateway(createAgentToolRegistry()),
    });
    const result = await factory.createAgentSession("REVIEWER");
    expect(result.status).toBe("MODEL_NOT_FOUND");
    if (result.status === "MODEL_NOT_FOUND") {
      expect(result.provider).toBe("deepseek");
      expect(result.model).toBe("does-not-exist");
    }
  });

  it("creates a session with only custom tools and no default coding tools", async () => {
    let captured: CreateAgentSessionOptions | undefined;
    const factory = new AgentSessionFactory({
      modelPolicy: new ModelPolicy(() => ({ provider: "deepseek", model: "deepseek-v4-pro" })),
      modelResolver: await PiModelResolver.create(),
      resourceLoader: stubLoader,
      gateway: new ToolGateway(createAgentToolRegistry()),
      createSession: async (options) => {
        captured = options;
        return { session: fakeSession as never, extensionsResult: {} as never };
      },
    });

    const result = await factory.createAgentSession("INVESTIGATOR");
    expect(result.status).toBe("READY");
    if (result.status !== "READY") return;

    // No default coding tools in the allowlist; only the custom tools.
    expect(captured?.tools).toEqual(["fetch_page", "get_region_context", "search_web"]);
    for (const forbidden of PI_DEFAULT_CODING_TOOLS) {
      expect(captured?.tools).not.toContain(forbidden);
    }
    const customNames = (captured?.customTools ?? []).map((tool) => tool.name);
    expect(customNames).toEqual(["fetch_page", "get_region_context", "search_web"]);

    // The resolved Pi model and the Skill Runtime loader are handed through.
    expect(captured?.model).toBeDefined();
    expect(captured?.resourceLoader).toBe(stubLoader);
    expect(captured?.sessionManager).toBeDefined();
  });

  it("locks production default coding tools to empty", () => {
    expect(PRODUCTION_TOOL_POLICY.defaultCodingToolsEnabled).toBe(false);
    expect(resolveProductionTools()).toEqual([]);
    expect([...PI_DEFAULT_CODING_TOOLS]).toEqual(["read", "bash", "edit", "write"]);
  });
});
