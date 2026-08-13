import type {
  ToolCancelledResult,
  ToolFailedResult,
  ToolInvocationContext,
  ToolSuccessResult,
} from "../contracts/tool-types.js";

export type ToolStartEvent = {
  callId: string;
  toolName: string;
  context: ToolInvocationContext;
  startedAt: string;
};

type EventHandler<T> = (event: T) => void | Promise<void>;

export interface ToolEventSink {
  onStart: EventHandler<ToolStartEvent>;
  onSuccess: EventHandler<ToolSuccessResult<unknown>>;
  onFailure: EventHandler<ToolFailedResult>;
  onCancelled: EventHandler<ToolCancelledResult>;
}

export class NoopToolEventSink implements ToolEventSink {
  onStart(): void {}
  onSuccess(): void {}
  onFailure(): void {}
  onCancelled(): void {}
}

export class MemoryToolEventSink implements ToolEventSink {
  readonly starts: ToolStartEvent[] = [];
  readonly successes: ToolSuccessResult<unknown>[] = [];
  readonly failures: ToolFailedResult[] = [];
  readonly cancellations: ToolCancelledResult[] = [];

  onStart(event: ToolStartEvent): void {
    this.starts.push(event);
  }

  onSuccess(event: ToolSuccessResult<unknown>): void {
    this.successes.push(event);
  }

  onFailure(event: ToolFailedResult): void {
    this.failures.push(event);
  }

  onCancelled(event: ToolCancelledResult): void {
    this.cancellations.push(event);
  }
}
