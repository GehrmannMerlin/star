import { Type, type Static } from "@sinclair/typebox";
import { ToolFailureCode, ToolFailureError } from "../../contracts/tool-failure-codes.js";
import type { AgentToolDefinition } from "../../contracts/tool-types.js";
import { CrawlerPageInspectionAdapter } from "./crawler-page-inspection-adapter.js";
import type { PageInspectionResult, PageInspector } from "./page-inspection.js";

export const InspectPageInput = Type.Object(
  {
    url: Type.String({ minLength: 1 }),
    content: Type.String({ minLength: 1 }),
  },
  { additionalProperties: false },
);

export type InspectPageInput = Static<typeof InspectPageInput>;

export type InspectPageToolDeps = {
  inspector: PageInspector;
};

/**
 * Generic page inspection tool.
 *
 * Pi knows only `inspect_page`; it receives HTML already obtained by fetch_page /
 * render_page and never connects itself. The crawler extractPageFacts is the
 * underlying deterministic parser. Output is observation-level only.
 */
export function createInspectPageTool(
  deps?: Partial<InspectPageToolDeps>,
): AgentToolDefinition<typeof InspectPageInput, PageInspectionResult> {
  const inspector = deps?.inspector ?? new CrawlerPageInspectionAdapter();
  return {
    name: "inspect_page",
    description:
      "Parse already-obtained HTML content into deterministic page observations (title, links, person-like members, date). No network access — pass the content returned by fetch_page or render_page.",
    inputSchema: InspectPageInput,
    async execute(context, input) {
      const url = input.url.trim();
      if (url.length === 0) {
        throw new ToolFailureError({
          code: ToolFailureCode.INVALID_INPUT,
          message: "inspect_page url must be a non-empty string",
          retryable: false,
        });
      }
      if (input.content.trim().length === 0) {
        throw new ToolFailureError({
          code: ToolFailureCode.INVALID_INPUT,
          message: "inspect_page content must be non-empty HTML",
          retryable: false,
        });
      }
      return inspector.inspectPage({ url, content: input.content, signal: context.signal });
    },
  };
}
