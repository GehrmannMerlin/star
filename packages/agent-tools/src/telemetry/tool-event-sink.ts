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

/**
 * Tool Event 读取侧抽象（STEP 11 持久化基础）。
 *
 * 写侧仍由 ToolEventSink 承担（ToolGateway 保持不变）。读取侧提供进程重启后
 * 重新读取成功事件的确定性视图，供 Candidate Provenance Gate 等消费。
 * MemoryToolEventSink 与 Postgres journal 均实现该接口。
 */
export interface ToolEventReader {
  /** SUCCESS 事件，按确定（追加）顺序返回。 */
  listSuccesses(): Promise<ToolSuccessResult<unknown>[]>;
}

export class NoopToolEventSink implements ToolEventSink {
  onStart(): void {}
  onSuccess(): void {}
  onFailure(): void {}
  onCancelled(): void {}
}

export class MemoryToolEventSink implements ToolEventSink, ToolEventReader {
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

  async listSuccesses(): Promise<ToolSuccessResult<unknown>[]> {
    return this.successes;
  }
}
