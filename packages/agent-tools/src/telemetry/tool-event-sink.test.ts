import { describe, expect, it } from "vitest";
import {
  composeToolEventSinks,
  MemoryToolEventSink,
} from "./tool-event-sink.js";
import {
  type ToolCancelledResult,
  type ToolFailedResult,
  type ToolInvocationContext,
  type ToolSuccessResult,
} from "../contracts/tool-types.js";
import { ToolFailureCode } from "../contracts/tool-failure-codes.js";

const ctx = {
  taskRunId: "t-1",
  agentSessionId: "s-1",
  agentRole: "INVESTIGATOR",
  signal: new AbortController().signal,
} satisfies ToolInvocationContext;

function startEvent(toolName: string) {
  return { callId: `call-${toolName}`, toolName, context: ctx, startedAt: new Date().toISOString() };
}

function successEvent(toolName: string): ToolSuccessResult<unknown> {
  const now = new Date().toISOString();
  return { callId: `call-${toolName}`, toolName, status: "SUCCESS", data: {}, startedAt: now, finishedAt: now };
}

function failureEvent(toolName: string): ToolFailedResult {
  const now = new Date().toISOString();
  return {
    callId: `call-${toolName}`,
    toolName,
    status: "FAILED",
    failure: { code: ToolFailureCode.SEARCH_REQUEST_FAILED, message: "boom", retryable: false },
    startedAt: now,
    finishedAt: now,
  };
}

function cancelledEvent(toolName: string): ToolCancelledResult {
  const now = new Date().toISOString();
  return {
    callId: `call-${toolName}`,
    toolName,
    status: "CANCELLED",
    failure: { code: ToolFailureCode.ABORTED, message: "aborted", retryable: false },
    startedAt: now,
    finishedAt: now,
  };
}

describe("composeToolEventSinks（STEP 19.3 组合 sink）", () => {
  it("同一事件按序派发给所有 sink", async () => {
    const gate = new MemoryToolEventSink();
    const persistent = new MemoryToolEventSink();
    const composed = composeToolEventSinks(gate, persistent);

    await composed.onStart(startEvent("search_web"));
    await composed.onSuccess(successEvent("search_web"));
    await composed.onFailure(failureEvent("fetch_page"));
    await composed.onCancelled(cancelledEvent("render_page"));

    expect(gate.starts).toHaveLength(1);
    expect(persistent.starts).toHaveLength(1);
    expect(gate.successes[0]?.toolName).toBe("search_web");
    expect(persistent.successes[0]?.toolName).toBe("search_web");
    expect(gate.failures[0]?.toolName).toBe("fetch_page");
    expect(persistent.failures[0]?.toolName).toBe("fetch_page");
    expect(gate.cancellations[0]?.toolName).toBe("render_page");
    expect(persistent.cancellations[0]?.toolName).toBe("render_page");
  });

  it("顺序派发：gate 先于 persistent（持久化异常不阻断 gate）", async () => {
    const gate = new MemoryToolEventSink();
    const throwing = {
      onStart: async () => {
        throw new Error("db down");
      },
      onSuccess: async () => {
        throw new Error("db down");
      },
      onFailure: async () => {
        throw new Error("db down");
      },
      onCancelled: async () => {
        throw new Error("db down");
      },
    };
    const composed = composeToolEventSinks(gate, throwing);
    await expect(composed.onStart(startEvent("search_web"))).rejects.toThrow("db down");
    // gate 已写入（派发顺序），异常由调用方（ToolGateway）捕获。
    expect(gate.starts).toHaveLength(1);
  });
});
