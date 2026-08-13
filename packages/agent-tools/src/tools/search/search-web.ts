import { Type, type Static } from "@sinclair/typebox";
import { ToolFailureCode, ToolFailureError } from "../../contracts/tool-failure-codes.js";
import type { AgentToolDefinition } from "../../contracts/tool-types.js";
import {
  SEARCH_FRESHNESS_VALUES,
  type SearchRequest,
  type SearchResult,
} from "../../search/search-provider.js";
import type { SearchProviderRegistry } from "../../search/search-provider-registry.js";
import { createSearchProviderRegistryFromEnv } from "../../search/search-provider-runtime.js";
import { resolveSearchRuntimeConfig } from "../../search/search-runtime-config.js";

export const SEARCH_WEB_DEFAULT_LIMIT = 8;
export const SEARCH_WEB_MAX_LIMIT = 20;

export const SearchWebInput = Type.Object(
  {
    query: Type.String({ minLength: 1 }),
    limit: Type.Optional(Type.Integer({ minimum: 1, maximum: SEARCH_WEB_MAX_LIMIT })),
    freshness: Type.Optional(
      Type.Union([...SEARCH_FRESHNESS_VALUES].map((value) => Type.Literal(value))),
    ),
  },
  { additionalProperties: false },
);

export type SearchWebInput = Static<typeof SearchWebInput>;

export type SearchWebOutput = {
  provider: string;
  results: SearchResult[];
};

export type SearchWebToolDeps = {
  registry: SearchProviderRegistry;
  /** Resolve the server-configured provider name; undefined when unset. */
  resolveProviderName: () => string | undefined;
};

/**
 * Generic web search tool.
 *
 * Pi knows only `search_web`; the concrete provider is chosen server-side from
 * the runtime environment (WEB_SEARCH_PROVIDER). Search results are navigation
 * candidates, not formal Evidence.
 */
export function createSearchWebTool(
  deps?: Partial<SearchWebToolDeps>,
): AgentToolDefinition<typeof SearchWebInput, SearchWebOutput> {
  const registry = deps?.registry ?? createSearchProviderRegistryFromEnv();
  const resolveProviderName =
    deps?.resolveProviderName ?? (() => resolveSearchRuntimeConfig()?.provider);

  return {
    name: "search_web",
    description:
      "Search the public web for candidate pages and return normalized search results.",
    inputSchema: SearchWebInput,
    async execute(context, input) {
      const query = input.query.trim();
      if (query.length === 0) {
        throw new ToolFailureError({
          code: ToolFailureCode.INVALID_INPUT,
          message: "search_web query must be a non-empty string",
          retryable: false,
        });
      }

      const providerName = resolveProviderName();
      if (!providerName) {
        throw new ToolFailureError({
          code: ToolFailureCode.SEARCH_PROVIDER_NOT_CONFIGURED,
          message: "No search provider is configured (WEB_SEARCH_PROVIDER)",
          retryable: false,
        });
      }

      const provider = registry.get(providerName);
      if (!provider) {
        throw new ToolFailureError({
          code: ToolFailureCode.SEARCH_PROVIDER_NOT_FOUND,
          message: `Search provider not found: ${providerName}`,
          retryable: false,
        });
      }
      if (!provider.isConfigured) {
        throw new ToolFailureError({
          code: ToolFailureCode.SEARCH_PROVIDER_NOT_CONFIGURED,
          message: `Search provider is not configured: ${providerName}`,
          retryable: false,
        });
      }

      const request: SearchRequest = {
        query,
        limit: input.limit ?? SEARCH_WEB_DEFAULT_LIMIT,
      };
      if (input.freshness) request.freshness = input.freshness;
      const results = await provider.search(request, context.signal);
      return { provider: providerName, results };
    },
  };
}
