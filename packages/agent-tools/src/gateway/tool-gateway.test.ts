import { describe, expect, it } from "vitest";
import { Type } from "@sinclair/typebox";
import type { ToolInvocationContext } from "../contracts/tool-types.js";
import { ToolGateway } from "./tool-gateway.js";
import { ToolRegistry } from "../registry/tool-registry.js";
import { MemoryToolEventSink } from "../telemetry/tool-event-sink.js";

const context = (signal = new AbortController().signal): ToolInvocationContext => ({
  taskRunId: "task-1",
  agentSessionId: "session-1",
  agentRole: "INVESTIGATOR",
  signal,
});

function createGateway() {
  let executions = 0;
  let markAbortToolStarted: (() => void) | undefined;
  const abortToolStarted = new Promise<void>((resolve) => {
    markAbortToolStarted = resolve;
  });
  const registry = new ToolRegistry([
    {
      name: "echo",
      description: "Echo a value",
      inputSchema: Type.Object({ value: Type.String() }, { additionalProperties: false }),
      async execute(_ctx, input) {
        executions += 1;
        return input;
      },
    },
    {
      name: "throws",
      description: "Throw an unexpected error",
      inputSchema: Type.Object({}, { additionalProperties: false }),
      async execute() {
        throw new Error("boom");
      },
    },
    {
      name: "abort-during-execution",
      description: "Abort while executing",
      inputSchema: Type.Object({}, { additionalProperties: false }),
      async execute(ctx) {
        markAbortToolStarted?.();
        await new Promise<void>((resolve) => {
          ctx.signal.addEventListener("abort", () => resolve(), { once: true });
        });
        ctx.signal.throwIfAborted();
      },
    },
  ]);
  const sink = new MemoryToolEventSink();
  return {
    gateway: new ToolGateway(registry, sink),
    sink,
    executions: () => executions,
    abortToolStarted,
  };
}

describe("ToolGateway", () => {
  it("returns SUCCESS and emits exactly one start and success", async () => {
    const { gateway, sink } = createGateway();
    const result = await gateway.execute("echo", { value: "ok" }, context());
    expect(result).toMatchObject({ toolName: "echo", status: "SUCCESS", data: { value: "ok" } });
    expect(result.callId).toEqual(expect.any(String));
    expect(sink.starts).toHaveLength(1);
    expect(sink.successes).toHaveLength(1);
    expect(sink.failures).toHaveLength(0);
    expect(sink.cancellations).toHaveLength(0);
  });

  it("rejects invalid input without executing and emits failure", async () => {
    const { gateway, sink, executions } = createGateway();
    const result = await gateway.execute("echo", { value: 3 }, context());
    expect(result.status).toBe("FAILED");
    if (result.status !== "SUCCESS") expect(result.failure.code).toBe("INVALID_INPUT");
    expect(executions()).toBe(0);
    expect(sink.starts).toHaveLength(1);
    expect(sink.failures).toHaveLength(1);
  });

  it("returns UNKNOWN_TOOL with complete provenance", async () => {
    const { gateway, sink } = createGateway();
    const result = await gateway.execute("missing", {}, context());
    expect(result.status).toBe("FAILED");
    if (result.status !== "SUCCESS") expect(result.failure.code).toBe("UNKNOWN_TOOL");
    expect(sink.starts).toHaveLength(1);
    expect(sink.failures).toHaveLength(1);
  });

  it("prevents execution when already aborted and emits cancellation", async () => {
    const { gateway, sink, executions } = createGateway();
    const controller = new AbortController();
    controller.abort();
    const result = await gateway.execute("echo", { value: "x" }, context(controller.signal));
    expect(result.status).toBe("CANCELLED");
    if (result.status !== "SUCCESS") expect(result.failure.code).toBe("ABORTED");
    expect(executions()).toBe(0);
    expect(sink.starts).toHaveLength(1);
    expect(sink.cancellations).toHaveLength(1);
  });

  it("normalizes unexpected exceptions to INTERNAL_ERROR", async () => {
    const { gateway, sink } = createGateway();
    const result = await gateway.execute("throws", {}, context());
    expect(result.status).toBe("FAILED");
    if (result.status !== "SUCCESS") expect(result.failure.code).toBe("INTERNAL_ERROR");
    expect(sink.starts).toHaveLength(1);
    expect(sink.failures).toHaveLength(1);
  });

  it("normalizes an in-flight abort to CANCELLED and emits cancellation", async () => {
    const { gateway, sink, abortToolStarted } = createGateway();
    const controller = new AbortController();
    const pending = gateway.execute("abort-during-execution", {}, context(controller.signal));
    await abortToolStarted;
    controller.abort();
    const result = await pending;
    expect(result.status).toBe("CANCELLED");
    if (result.status !== "SUCCESS") expect(result.failure.code).toBe("ABORTED");
    expect(sink.starts).toHaveLength(1);
    expect(sink.cancellations).toHaveLength(1);
    expect(sink.failures).toHaveLength(0);
  });
});
