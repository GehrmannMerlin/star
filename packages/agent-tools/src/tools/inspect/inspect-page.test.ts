import { describe, expect, it } from "vitest";
import type { ToolInvocationContext } from "../../contracts/tool-types.js";
import { ToolGateway } from "../../gateway/tool-gateway.js";
import { ToolRegistry } from "../../registry/tool-registry.js";
import { MemoryToolEventSink } from "../../telemetry/tool-event-sink.js";
import type { PageInspectionResult, PageInspector } from "./page-inspection.js";
import { createInspectPageTool } from "./inspect-page.js";

const context = (signal = new AbortController().signal): ToolInvocationContext => ({
  taskRunId: "task-1",
  agentSessionId: "session-1",
  agentRole: "INVESTIGATOR",
  signal,
});

function stubResult(): PageInspectionResult {
  return {
    url: "https://example.com/",
    documentHash: "abc",
    title: "Example",
    textPreview: "hello",
    textLength: 5,
    textTruncated: false,
    links: [{ text: "Home", url: "https://example.com/" }],
    linkCount: 1,
    linksTruncated: false,
    leadershipMembers: [],
    pageDate: null,
    headings: null,
    breadcrumb: null,
    tables: null,
  };
}

describe("inspect_page tool", () => {
  it("delegates to the injected inspector with url and content", async () => {
    let received: { url: string; content: string } | undefined;
    const inspector: PageInspector = {
      async inspectPage(request) {
        received = { url: request.url, content: request.content };
        return stubResult();
      },
    };
    const tool = createInspectPageTool({ inspector });
    const result = await tool.execute(context(), {
      url: "https://example.com/",
      content: "<p>hi</p>",
    });
    expect(received).toEqual({ url: "https://example.com/", content: "<p>hi</p>" });
    expect(result.title).toBe("Example");
  });

  it("rejects whitespace-only content with INVALID_INPUT", async () => {
    const tool = createInspectPageTool();
    await expect(
      tool.execute(context(), { url: "https://example.com/", content: " \n " }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });

  it("succeeds through ToolGateway with the real adapter", async () => {
    const gateway = new ToolGateway(
      new ToolRegistry([createInspectPageTool()]),
      new MemoryToolEventSink(),
    );
    const result = await gateway.execute(
      "inspect_page",
      { url: "https://example.com/", content: "<title>Hi</title><a href='/x'>x</a>" },
      context(),
    );
    expect(result.status).toBe("SUCCESS");
    if (result.status === "SUCCESS") expect((result.data as PageInspectionResult).title).toBe("Hi");
  });
});
