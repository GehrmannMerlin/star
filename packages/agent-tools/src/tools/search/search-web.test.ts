import { describe, expect, it } from "vitest";
import { ToolFailureCode } from "../../contracts/tool-failure-codes.js";
import { ToolGateway } from "../../gateway/tool-gateway.js";
import { MemoryToolEventSink } from "../../telemetry/tool-event-sink.js";
import { createAgentToolRegistry } from "../../registry/default-tool-registry.js";
import type { SearchProvider, SearchRequest } from "../../search/search-provider.js";
import { SearchProviderRegistry } from "../../search/search-provider-registry.js";
import { createSearchWebTool, SEARCH_WEB_DEFAULT_LIMIT } from "./search-web.js";

const invocationContext = {
  taskRunId: "task-search",
  agentSessionId: "session-search",
  agentRole: "INVESTIGATOR" as const,
  signal: new AbortController().signal,
};

type StubCall = { query: string; limit: number; freshness: string | undefined };

function stubProvider(name = "stub"): SearchProvider & { calls: StubCall[] } {
  const calls: StubCall[] = [];
  const provider: SearchProvider = {
    name,
    isConfigured: true,
    async search(request: SearchRequest) {
      calls.push({ query: request.query, limit: request.limit ?? 0, freshness: request.freshness });
      return [
        {
          title: "Stub Result",
          url: `https://${name}.example/`,
          snippet: "stub",
          domain: `${name}.example`,
          rank: 1,
        },
      ];
    },
  };
  return Object.assign(provider, { calls });
}

function registryWith(provider: SearchProvider): SearchProviderRegistry {
  const registry = new SearchProviderRegistry();
  registry.register(provider);
  return registry;
}

describe("search_web", () => {
  it("rejects a blank query with INVALID_INPUT before calling the provider", async () => {
    const provider = stubProvider();
    const tool = createSearchWebTool({
      registry: registryWith(provider),
      resolveProviderName: () => "stub",
    });
    await expect(tool.execute(invocationContext, { query: "   " })).rejects.toMatchObject({
      code: ToolFailureCode.INVALID_INPUT,
    });
    expect(provider.calls).toHaveLength(0);
  });

  it("calls the configured provider with the default limit and returns results", async () => {
    const provider = stubProvider();
    const tool = createSearchWebTool({
      registry: registryWith(provider),
      resolveProviderName: () => "stub",
    });
    const output = await tool.execute(invocationContext, { query: "安徽省人民政府" });
    expect(provider.calls).toHaveLength(1);
    expect(provider.calls[0]).toMatchObject({
      query: "安徽省人民政府",
      limit: SEARCH_WEB_DEFAULT_LIMIT,
    });
    expect(output).toMatchObject({
      provider: "stub",
      results: [expect.objectContaining({ title: "Stub Result" })],
    });
  });

  it("returns SUCCESS through the ToolGateway with provenance", async () => {
    const provider = stubProvider();
    const sink = new MemoryToolEventSink();
    const gateway = new ToolGateway(
      createAgentToolRegistry({
        searchWebTool: createSearchWebTool({
          registry: registryWith(provider),
          resolveProviderName: () => "stub",
        }),
      }),
      sink,
    );
    const result = await gateway.execute("search_web", { query: "安徽省人民政府" }, invocationContext);
    expect(result.status).toBe("SUCCESS");
    if (result.status === "SUCCESS") {
      expect(result.data).toMatchObject({ provider: "stub" });
    }
    expect(sink.starts).toHaveLength(1);
    expect(sink.successes).toHaveLength(1);
    expect(sink.failures).toHaveLength(0);
  });

  it("fails closed with SEARCH_PROVIDER_NOT_CONFIGURED when no provider is configured", async () => {
    const tool = createSearchWebTool({
      registry: registryWith(stubProvider("known")),
      resolveProviderName: () => undefined,
    });
    await expect(tool.execute(invocationContext, { query: "x" })).rejects.toMatchObject({
      code: ToolFailureCode.SEARCH_PROVIDER_NOT_CONFIGURED,
    });
  });

  it("fails closed with SEARCH_PROVIDER_NOT_FOUND for an unknown provider", async () => {
    const tool = createSearchWebTool({
      registry: registryWith(stubProvider("known")),
      resolveProviderName: () => "missing",
    });
    await expect(tool.execute(invocationContext, { query: "x" })).rejects.toMatchObject({
      code: ToolFailureCode.SEARCH_PROVIDER_NOT_FOUND,
    });
  });

  it("fails closed with SEARCH_PROVIDER_NOT_CONFIGURED when the provider lacks a credential", async () => {
    const unconfigured: SearchProvider = {
      name: "unconfigured",
      isConfigured: false,
      async search() {
        return [];
      },
    };
    const tool = createSearchWebTool({
      registry: registryWith(unconfigured),
      resolveProviderName: () => "unconfigured",
    });
    await expect(tool.execute(invocationContext, { query: "x" })).rejects.toMatchObject({
      code: ToolFailureCode.SEARCH_PROVIDER_NOT_CONFIGURED,
    });
  });
});
