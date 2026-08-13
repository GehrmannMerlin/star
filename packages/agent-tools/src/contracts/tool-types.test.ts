import { describe, expect, it } from "vitest";
import { AGENT_ROLES } from "@stellaris/contracts";
import { ToolFailureCode } from "./tool-failure-codes.js";
import type { ToolResult } from "./tool-types.js";
import { MemoryToolEventSink } from "../telemetry/tool-event-sink.js";

describe("generic tool contracts", () => {
  it("exposes shared roles and the stable failure taxonomy", () => {
    expect(AGENT_ROLES).toEqual(["INVENTORY", "INVESTIGATOR", "RECOVERY", "REVIEWER"]);
    expect(ToolFailureCode).toMatchObject({
      INVALID_INPUT: "INVALID_INPUT",
      UNKNOWN_TOOL: "UNKNOWN_TOOL",
      ABORTED: "ABORTED",
      TIMEOUT: "TIMEOUT",
      INTERNAL_ERROR: "INTERNAL_ERROR",
      DNS_ERROR: "DNS_ERROR",
      TLS_ERROR: "TLS_ERROR",
      HTTP_403: "HTTP_403",
      HTTP_412: "HTTP_412",
      WAF_BLOCKED: "WAF_BLOCKED",
      ACCESS_DENIED: "ACCESS_DENIED",
      STATIC_CONTENT_EMPTY: "STATIC_CONTENT_EMPTY",
      DYNAMIC_RENDER_REQUIRED: "DYNAMIC_RENDER_REQUIRED",
      REGION_NOT_FOUND: "REGION_NOT_FOUND",
    });
  });

  it("provides a typed result envelope and in-memory event sink", async () => {
    const result: ToolResult<{ ok: boolean }> = {
      callId: "call-1",
      toolName: "test",
      status: "SUCCESS",
      data: { ok: true },
      startedAt: "2026-08-13T00:00:00.000Z",
      finishedAt: "2026-08-13T00:00:01.000Z",
    };
    expect(result.data?.ok).toBe(true);

    const sink = new MemoryToolEventSink();
    await sink.onStart({
      callId: result.callId,
      toolName: result.toolName,
      context: {
        taskRunId: "task",
        agentSessionId: "session",
        agentRole: "INVENTORY",
        signal: new AbortController().signal,
      },
      startedAt: result.startedAt,
    });
    expect(sink.starts).toHaveLength(1);
  });
});
