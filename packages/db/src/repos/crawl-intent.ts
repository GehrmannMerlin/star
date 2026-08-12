import type { Kysely } from "kysely";
import type { Database } from "../schema.js";
import type { CrawlIntentRow } from "../types.js";
import type { FrontierPriority } from "@stellaris/contracts";

/**
 * crawl_intent 仓储（规格 §16.2 抓取层）。
 * 同一任务同一规范化 URL 同一抓取用途只入队一次（幂等键组成部分，规格 §18.3）。
 */
export class CrawlIntentRepository {
  constructor(private readonly db: Kysely<Database>) {}

  /** 幂等创建抓取意图；已存在则返回既有行。 */
  async createIfAbsent(input: {
    taskRunId: string;
    institutionSnapshotId: string | null;
    originalUrl: string;
    canonicalKey: string;
    priority: FrontierPriority;
    phase: string;
    purpose: string;
  }): Promise<CrawlIntentRow> {
    const inserted = await this.db
      .insertInto("crawl_intent")
      .values({
        task_run_id: input.taskRunId,
        institution_snapshot_id: input.institutionSnapshotId,
        original_url: input.originalUrl,
        canonical_key: input.canonicalKey,
        priority: input.priority,
        phase: input.phase,
        purpose: input.purpose,
      })
      .onConflict((oc) =>
        oc.columns(["task_run_id", "canonical_key", "purpose"]).doNothing(),
      )
      .returningAll()
      .executeTakeFirst();

    if (inserted) {
      return inserted;
    }
    const existing = await this.db
      .selectFrom("crawl_intent")
      .selectAll()
      .where("task_run_id", "=", input.taskRunId)
      .where("canonical_key", "=", input.canonicalKey)
      .where("purpose", "=", input.purpose)
      .executeTakeFirstOrThrow();
    return existing;
  }

  /** 按任务列出全部抓取意图。 */
  async listByTask(taskRunId: string): Promise<CrawlIntentRow[]> {
    return this.db
      .selectFrom("crawl_intent")
      .selectAll()
      .where("task_run_id", "=", taskRunId)
      .orderBy("priority")
      .execute();
  }
}
