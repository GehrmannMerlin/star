import type {
  ToolCancelledResult,
  ToolEventReader,
  ToolEventSink,
  ToolFailedResult,
  ToolFailure,
  ToolInvocationContext,
  ToolStartEvent,
  ToolSuccessResult,
} from "@stellaris/agent-tools";
import type { ToolEventRow, ToolEventTable } from "@stellaris/db";
import {
  projectToolEventData,
  toolEventDataFromProjection,
  type ToolEventProjection,
  type ToolEventSearchMetadata,
  type ToolEventSubmissionMetadata,
  type ToolEventUrlMetadata,
} from "./tool-event-projection.js";

type TerminalStatus = "SUCCESS" | "FAILED" | "CANCELLED";

const EMPTY_PROJECTION: ToolEventProjection = { url: null, search: null, submission: null };

/** 插入行类型（Generated 列由 DB 生成）。 */
export type ToolEventInsertRow = Omit<ToolEventTable, "id" | "created_at" | "seq">;

/**
 * Journal 依赖的最小仓储形状（可注入：内存 fake 或 Postgres 实现均可）。
 * Postgres 类（@stellaris/db ToolEventRepository）结构上兼容本接口。
 */
export interface ToolEventRepositoryPort {
  insertEvent(row: ToolEventInsertRow): Promise<ToolEventRow>;
  listSuccessEvents(opts?: { agentSessionId?: string }): Promise<ToolEventRow[]>;
  listEvents(opts?: { agentSessionId?: string; packetId?: string }): Promise<ToolEventRow[]>;
}

/**
 * PostgreSQL Tool Event Journal（STEP 11 持久化基础）。
 *
 * 同时实现写侧 ToolEventSink（与 ToolGateway 对接）和读侧 ToolEventReader。
 * 所有事件先经数据最小化投影再落库；进程/实例重启后可通过 listSuccesses()
 * 重新读取，供 Candidate Provenance Gate 消费。
 *
 * 注意：终态事件（ToolSuccessResult 等）本身不带 ToolInvocationContext，因此
 * journal 在 onStart 时按 callId 暂存 context，用于把终态事件关联到会话身份。
 * 该 map 是实例级内存缓存；持久化行本身是完整、可恢复的。
 */
export class PostgresToolEventJournal implements ToolEventSink, ToolEventReader {
  private readonly contextsByCallId = new Map<string, ToolInvocationContext>();

  constructor(private readonly repo: ToolEventRepositoryPort) {}

  async onStart(event: ToolStartEvent): Promise<void> {
    this.contextsByCallId.set(event.callId, event.context);
    await this.repo.insertEvent({
      call_id: event.callId,
      tool_name: event.toolName,
      status: "STARTED",
      agent_session_id: event.context.agentSessionId,
      packet_id: event.context.packetId ?? null,
      agent_role: event.context.agentRole,
      task_run_id: event.context.taskRunId,
      started_at: event.startedAt,
      finished_at: null,
      failure_code: null,
      failure_message: null,
      failure_retryable: null,
      url_metadata: null,
      search_metadata: null,
      submission_metadata: null,
    });
  }

  async onSuccess(event: ToolSuccessResult<unknown>): Promise<void> {
    const projection = projectToolEventData(event.toolName, event.data);
    await this.insertTerminal(event.callId, event.toolName, "SUCCESS", projection, {
      startedAt: event.startedAt,
      finishedAt: event.finishedAt,
    });
  }

  async onFailure(event: ToolFailedResult): Promise<void> {
    // 失败结果不携带工具 data（无内容可投影）。
    await this.insertTerminal(event.callId, event.toolName, "FAILED", EMPTY_PROJECTION, {
      startedAt: event.startedAt,
      finishedAt: event.finishedAt,
      failure: event.failure,
    });
  }

  async onCancelled(event: ToolCancelledResult): Promise<void> {
    await this.insertTerminal(event.callId, event.toolName, "CANCELLED", EMPTY_PROJECTION, {
      startedAt: event.startedAt,
      finishedAt: event.finishedAt,
      failure: event.failure,
    });
  }

  /** 读取持久化的 SUCCESS 事件（确定性顺序），重构为门控可消费的 ToolSuccessResult。 */
  async listSuccesses(): Promise<ToolSuccessResult<unknown>[]> {
    const rows = await this.repo.listSuccessEvents();
    return rows.map((row) => this.toSuccessResult(row));
  }

  private async insertTerminal(
    callId: string,
    toolName: string,
    status: TerminalStatus,
    projection: ToolEventProjection,
    meta: { startedAt: string; finishedAt: string; failure?: ToolFailure },
  ): Promise<void> {
    const context = this.contextsByCallId.get(callId);
    await this.repo.insertEvent({
      call_id: callId,
      tool_name: toolName,
      status,
      agent_session_id: context?.agentSessionId ?? "",
      packet_id: context?.packetId ?? null,
      agent_role: context?.agentRole ?? "",
      task_run_id: context?.taskRunId ?? "",
      started_at: meta.startedAt,
      finished_at: meta.finishedAt,
      failure_code: meta.failure?.code ?? null,
      failure_message: meta.failure?.message ?? null,
      failure_retryable: meta.failure?.retryable ?? null,
      url_metadata: projection.url,
      search_metadata: projection.search,
      submission_metadata: projection.submission,
    });
  }

  private toSuccessResult(row: ToolEventRow): ToolSuccessResult<unknown> {
    const projection: ToolEventProjection = {
      url: row.url_metadata as ToolEventUrlMetadata | null,
      search: row.search_metadata as ToolEventSearchMetadata | null,
      submission: row.submission_metadata as ToolEventSubmissionMetadata | null,
    };
    return {
      callId: row.call_id,
      toolName: row.tool_name,
      status: "SUCCESS",
      data: toolEventDataFromProjection(projection),
      startedAt: row.started_at,
      finishedAt: row.finished_at ?? row.started_at,
    };
  }
}
