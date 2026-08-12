import type { Kysely } from "kysely";
import type { Database } from "../schema.js";
import type { FetchAttemptRow } from "../types.js";
import type { FetchMode } from "@stellaris/contracts";

/**
 * fetch_attempt 仓储（规格 §16.2 抓取层）。
 * 每次真实网络访问（Collector/重试/Recovery/Reviewer）都是独立抓取事件。
 */
export class FetchAttemptRepository {
  constructor(private readonly db: Kysely<Database>) {}

  /** 记录一次抓取事件。 */
  async create(input: {
    taskRunId: string;
    crawlIntentId: string | null;
    fetchMode: FetchMode;
    url: string;
    canonicalKey: string;
    httpStatus: number | null;
    status: "SUCCESS" | "REDIRECTED" | "ERROR" | "TIMEOUT" | "BLOCKED";
    resolvedIp: string | null;
    durationMs: number;
    redirectedUrl: string | null;
    documentSnapshotId: string | null;
    errorMessage: string | null;
  }): Promise<FetchAttemptRow> {
    return this.db
      .insertInto("fetch_attempt")
      .values({
        task_run_id: input.taskRunId,
        crawl_intent_id: input.crawlIntentId,
        fetch_mode: input.fetchMode,
        url: input.url,
        canonical_key: input.canonicalKey,
        http_status: input.httpStatus,
        status: input.status,
        retries: 0,
        resolved_ip: input.resolvedIp,
        duration_ms: input.durationMs,
        redirected_url: input.redirectedUrl,
        document_snapshot_id: input.documentSnapshotId,
        error_message: input.errorMessage,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  /** 按任务列出全部抓取事件。 */
  async listByTask(taskRunId: string): Promise<FetchAttemptRow[]> {
    return this.db
      .selectFrom("fetch_attempt")
      .selectAll()
      .where("task_run_id", "=", taskRunId)
      .orderBy("created_at")
      .execute();
  }
}
