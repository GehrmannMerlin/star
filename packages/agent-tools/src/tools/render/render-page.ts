import { Type, type Static } from "@sinclair/typebox";
import { ToolFailureCode, ToolFailureError } from "../../contracts/tool-failure-codes.js";
import type { AgentToolDefinition } from "../../contracts/tool-types.js";
import { CrawlerBrowserAdapter } from "./crawler-browser-adapter.js";
import type { PageRenderResponse, PageRenderer } from "./page-renderer.js";

export const RenderPageInput = Type.Object(
  { url: Type.String({ minLength: 1 }) },
  { additionalProperties: false },
);

export type RenderPageInput = Static<typeof RenderPageInput>;

export type RenderPageToolDeps = {
  renderer: PageRenderer;
};

/**
 * Generic browser render tool.
 *
 * Pi knows only `render_page`; the concrete browser stack is wired server-side.
 * The existing crawler BrowserPool and its egress guard are the underlying
 * execution layer. Rendered DOM is raw content for a later inspection step,
 * not Evidence.
 */
export function createRenderPageTool(
  deps?: Partial<RenderPageToolDeps>,
): AgentToolDefinition<typeof RenderPageInput, PageRenderResponse> {
  const renderer = deps?.renderer ?? new CrawlerBrowserAdapter();
  return {
    name: "render_page",
    description:
      "Render a public HTTP or HTTPS page in a headless browser and return the rendered HTML for further inspection.",
    inputSchema: RenderPageInput,
    async execute(context, input) {
      const url = input.url.trim();
      if (url.length === 0) {
        throw new ToolFailureError({
          code: ToolFailureCode.INVALID_INPUT,
          message: "render_page url must be a non-empty string",
          retryable: false,
        });
      }
      return renderer.renderPage({ url, signal: context.signal });
    },
  };
}
