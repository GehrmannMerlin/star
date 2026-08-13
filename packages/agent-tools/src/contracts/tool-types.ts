import type { AgentRole } from "@stellaris/contracts";
import type { Static, TSchema } from "@sinclair/typebox";
import type { ToolFailure } from "./tool-failure-codes.js";

export type ToolInvocationContext = {
  taskRunId: string;
  agentSessionId: string;
  agentRole: AgentRole;
  packetId?: string;
  targetRegionCode?: string;
  signal: AbortSignal;
};

export type AgentToolDefinition<
  TInputSchema extends TSchema = TSchema,
  TOutput = unknown,
> = {
  name: string;
  description: string;
  inputSchema: TInputSchema;
  execute(context: ToolInvocationContext, input: Static<TInputSchema>): Promise<TOutput>;
};

type ToolResultBase = {
  callId: string;
  toolName: string;
  startedAt: string;
  finishedAt: string;
};

export type ToolSuccessResult<TOutput> = ToolResultBase & {
  status: "SUCCESS";
  data: TOutput;
};

export type ToolFailedResult = ToolResultBase & {
  status: "FAILED";
  failure: ToolFailure;
};

export type ToolCancelledResult = ToolResultBase & {
  status: "CANCELLED";
  failure: ToolFailure;
};

export type ToolResult<TOutput = unknown> =
  | ToolSuccessResult<TOutput>
  | ToolFailedResult
  | ToolCancelledResult;

export type ToolStatus = ToolResult["status"];
