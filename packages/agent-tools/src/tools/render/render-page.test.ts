import { describe, expect, it } from "vitest";
import { ToolFailureCode } from "../../contracts/tool-failure-codes.js";
import { createRenderPageTool } from "./render-page.js";
import type { PageRenderer } from "./page-renderer.js";

const invocationContext = {
  taskRunId: "task-render",
  agentSessionId: "session-render",
  agentRole: "INVESTIGATOR" as const,
  signal: new AbortController().signal,
};

describe("render_page", () => {
  it("calls the configured renderer with the url and the invocation signal", async () => {
    const renderer: PageRenderer = {
      async renderPage(request) {
        expect(request.url).toBe("https://www.gov.cn/");
        expect(request.signal).toBe(invocationContext.signal);
        return {
          requestedUrl: request.url,
          finalUrl: request.url,
          statusCode: 200,
          contentType: "text/html; charset=utf-8",
          content: "<html/>",
          bytes: 8,
          truncated: false,
          title: "中国政府网",
        };
      },
    };
    const tool = createRenderPageTool({ renderer });
    const output = await tool.execute(invocationContext, { url: "  https://www.gov.cn/  " });
    expect(output).toMatchObject({ statusCode: 200, truncated: false, title: "中国政府网" });
  });

  it("rejects a blank url with INVALID_INPUT before calling the renderer", async () => {
    const renderer: PageRenderer = {
      async renderPage() {
        throw new Error("renderer must not run for a blank url");
      },
    };
    const tool = createRenderPageTool({ renderer });
    await expect(tool.execute(invocationContext, { url: "   " })).rejects.toMatchObject({
      code: ToolFailureCode.INVALID_INPUT,
    });
  });
});
