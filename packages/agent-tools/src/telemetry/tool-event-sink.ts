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

/**
 * 组合多个 sink：同一 ToolEvent 按序派发给每个 sink（STEP 19.3）。
 *
 * 真实 workflow 需要同时写入两类 sink：
 * - MemoryToolEventSink：阶段 gate / 总结（starts/successes 数组）；
 * - PostgresToolEventJournal：Agent provenance 持久化（tool_event 表）。
 */
export function composeToolEventSinks(...sinks: ToolEventSink[]): ToolEventSink {
  const forward = async <E>(emit: (sink: ToolEventSink, e: E) => void | Promise<void>, event: E): Promise<void> => {
    for (const sink of sinks) {
      await emit(sink, event);
    }
  };
  return {
    onStart: (e) => forward((s, ev) => s.onStart(ev), e),
    onSuccess: (e) => forward((s, ev) => s.onSuccess(ev), e),
    onFailure: (e) => forward((s, ev) => s.onFailure(ev), e),
    onCancelled: (e) => forward((s, ev) => s.onCancelled(ev), e),
  };
}
