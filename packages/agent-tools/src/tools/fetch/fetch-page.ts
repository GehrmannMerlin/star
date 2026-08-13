import { Type, type Static } from "@sinclair/typebox";
import { ToolFailureCode, ToolFailureError } from "../../contracts/tool-failure-codes.js";
import type { AgentToolDefinition } from "../../contracts/tool-types.js";
import { CrawlerHttpAdapter } from "./crawler-http-adapter.js";
import type { PageFetchResponse, PageFetcher } from "./page-fetcher.js";

export const FetchPageInput = Type.Object(
  { url: Type.String({ minLength: 1 }) },
  { additionalProperties: false },
);

export type FetchPageInput = Static<typeof FetchPageInput>;

export type FetchPageToolDeps = {
  fetcher: PageFetcher;
};

/**
 * Generic page fetch tool.
 *
 * Pi knows only `fetch_page`; the concrete fetcher is wired server-side. The
 * crawler HTTP stack and its SSRF guard are the underlying execution layer.
 * The returned page is raw content for a later inspection step, not Evidence.
 */
export function createFetchPageTool(
  deps?: Partial<FetchPageToolDeps>,
): AgentToolDefinition<typeof FetchPageInput, PageFetchResponse> {
  const fetcher = deps?.fetcher ?? new CrawlerHttpAdapter();
  return {
    name: "fetch_page",
    description:
      "Fetch a public HTTP or HTTPS page and return the normalized response for further inspection.",
    inputSchema: FetchPageInput,
    async execute(context, input) {
      const url = input.url.trim();
      if (url.length === 0) {
        throw new ToolFailureError({
          code: ToolFailureCode.INVALID_INPUT,
          message: "fetch_page url must be a non-empty string",
          retryable: false,
        });
      }
      return fetcher.fetchPage({ url, signal: context.signal });
    },
  };
}
