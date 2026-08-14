import type { Insertable, Kysely } from "kysely";
import type { Database } from "../schema.js";
import type { ToolEventRow } from "../types.js";

/**
 * tool_event 仓储（STEP 11 Agent 持久层）。
 *
 * 只负责 append / 有序读取，不含任何 Agent 业务逻辑。
 * jsonb 投影元数据遵循项目既有约定：写入时 JSON.stringify，读取时由 pg 自动解析为对象。
 */
export class ToolEventRepository {
  constructor(private readonly db: Kysely<Database>) {}

  /** 追加一条 Tool Event（STARTED 或终态）。 */
  async insertEvent(row: Insertable<Database["tool_event"]>): Promise<ToolEventRow> {
    return this.db
      .insertInto("tool_event")
      .values({
        ...row,
        url_metadata:
          row.url_metadata === null || row.url_metadata === undefined
            ? null
            : JSON.stringify(row.url_metadata),
        search_metadata:
          row.search_metadata === null || row.search_metadata === undefined
            ? null
            : JSON.stringify(row.search_metadata),
        submission_metadata:
          row.submission_metadata === null || row.submission_metadata === undefined
            ? null
            : JSON.stringify(row.submission_metadata),
      })
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  /** SUCCESS 事件，按 seq 确定顺序返回（Provenance 重新水合入口）。 */
  async listSuccessEvents(opts: { agentSessionId?: string } = {}): Promise<ToolEventRow[]> {
    let query = this.db.selectFrom("tool_event").selectAll().where("status", "=", "SUCCESS");
    if (opts.agentSessionId) {
      query = query.where("agent_session_id", "=", opts.agentSessionId);
    }
    return query.orderBy("seq", "asc").execute();
  }

  /** 全部事件（审计用），按 seq 确定顺序返回。 */
  async listEvents(opts: { agentSessionId?: string; packetId?: string } = {}): Promise<ToolEventRow[]> {
    let query = this.db.selectFrom("tool_event").selectAll();
    if (opts.agentSessionId) {
      query = query.where("agent_session_id", "=", opts.agentSessionId);
    }
    if (opts.packetId) {
      query = query.where("packet_id", "=", opts.packetId);
    }
    return query.orderBy("seq", "asc").execute();
  }
}
