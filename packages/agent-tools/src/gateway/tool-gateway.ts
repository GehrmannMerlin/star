import { randomUUID } from "node:crypto";
import { Value } from "@sinclair/typebox/value";
import {
  ToolFailureCode,
  ToolFailureError,
  type ToolFailure,
} from "../contracts/tool-failure-codes.js";
import type {
  ToolCancelledResult,
  ToolFailedResult,
  ToolInvocationContext,
  ToolResult,
  ToolSuccessResult,
} from "../contracts/tool-types.js";
import type { ToolRegistry } from "../registry/tool-registry.js";
import {
  NoopToolEventSink,
  type ToolEventSink,
  type ToolStartEvent,
} from "../telemetry/tool-event-sink.js";

export class ToolGateway {
  constructor(
    private readonly registry: ToolRegistry,
    private readonly eventSink: ToolEventSink = new NoopToolEventSink(),
  ) {}

  async execute(
    toolName: string,
    input: unknown,
    context: ToolInvocationContext,
  ): Promise<ToolResult> {
    const callId = randomUUID();
    const startedAt = new Date().toISOString();
    const start: ToolStartEvent = { callId, toolName, context, startedAt };
    await this.eventSink.onStart(start);

    const finishFailure = async (
      failure: ToolFailure,
      status: "FAILED" | "CANCELLED" = "FAILED",
    ): Promise<ToolFailedResult | ToolCancelledResult> => {
      const finishedAt = new Date().toISOString();
      if (status === "CANCELLED") {
        const result: ToolCancelledResult = {
          callId, toolName, status, failure, startedAt, finishedAt,
        };
        await this.eventSink.onCancelled(result);
        return result;
      }
      const result: ToolFailedResult = {
        callId, toolName, status, failure, startedAt, finishedAt,
      };
      await this.eventSink.onFailure(result);
      return result;
    };

    if (context.signal.aborted) {
      return finishFailure(
        { code: ToolFailureCode.ABORTED, message: "Tool invocation aborted", retryable: false },
        "CANCELLED",
      );
    }

    const tool = this.registry.get(toolName);
    if (!tool) {
      return finishFailure({
        code: ToolFailureCode.UNKNOWN_TOOL,
        message: `Unknown tool: ${toolName}`,
        retryable: false,
      });
    }

    if (!Value.Check(tool.inputSchema, input)) {
      return finishFailure({
        code: ToolFailureCode.INVALID_INPUT,
        message: `Invalid input for tool: ${toolName}`,
        retryable: false,
      });
    }

    try {
      const data = await tool.execute(context, input);
      const result = {
        callId,
        toolName,
        status: "SUCCESS",
        data,
        startedAt,
        finishedAt: new Date().toISOString(),
      } satisfies ToolSuccessResult<unknown>;
      await this.eventSink.onSuccess(result);
      return result;
    } catch (error) {
      if (context.signal.aborted) {
        return finishFailure(
          { code: ToolFailureCode.ABORTED, message: "Tool invocation aborted", retryable: false },
          "CANCELLED",
        );
      }
      if (error instanceof ToolFailureError) {
        const status = error.code === ToolFailureCode.ABORTED ? "CANCELLED" as const : "FAILED" as const;
        return finishFailure(error.toFailure(), status);
      }
      return finishFailure({
        code: ToolFailureCode.INTERNAL_ERROR,
        message: "Internal tool execution error",
        retryable: false,
      });
    }
  }
}
