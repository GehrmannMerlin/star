import { describe, expect, it } from "vitest";
import { ToolFailureCode } from "../../contracts/tool-failure-codes.js";
import { createFetchPageTool } from "./fetch-page.js";
import type { PageFetcher } from "./page-fetcher.js";

const invocationContext = {
  taskRunId: "task-fetch",
  agentSessionId: "session-fetch",
  agentRole: "INVESTIGATOR" as const,
  signal: new AbortController().signal,
};

describe("fetch_page", () => {
  it("calls the configured fetcher with the url and the invocation signal", async () => {
    const fetcher: PageFetcher = {
      async fetchPage(request) {
        expect(request.url).toBe("https://www.ah.gov.cn/");
        expect(request.signal).toBe(invocationContext.signal);
        return {
          requestedUrl: request.url,
          finalUrl: request.url,
          statusCode: 200,
          contentType: "text/html",
          content: "<html/>",
          bytes: 8,
        };
      },
    };
    const tool = createFetchPageTool({ fetcher });
    const output = await tool.execute(invocationContext, { url: "  https://www.ah.gov.cn/  " });
    expect(output).toMatchObject({ statusCode: 200, finalUrl: "https://www.ah.gov.cn/" });
  });

  it("rejects a blank url with INVALID_INPUT before calling the fetcher", async () => {
    const fetcher: PageFetcher = {
      async fetchPage() {
        throw new Error("fetcher must not run for a blank url");
      },
    };
    const tool = createFetchPageTool({ fetcher });
    await expect(tool.execute(invocationContext, { url: "   " })).rejects.toMatchObject({
      code: ToolFailureCode.INVALID_INPUT,
    });
  });
});
