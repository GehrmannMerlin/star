import type { Kysely } from "kysely";
import type { Database } from "../schema.js";
import type { ReviewJobRow, ReviewDecisionRow } from "../types.js";
import type { ReviewDecision, Slot } from "@stellaris/contracts";

/**
 * review 仓储（规格 §16.4 控制层）。
 * Reviewer 使用独立请求唯一键（规格 §15.2），不得复用 Collector 键（唯一约束强制）。
 */
export class ReviewRepository {
  constructor(private readonly db: Kysely<Database>) {}

  /** 创建独立复抓作业。unique_request_key 唯一。 */
  async createReviewJob(input: {
    taskRunId: string;
    institutionSnapshotId: string | null;
    url: string;
    uniqueRequestKey: string;
  }): Promise<ReviewJobRow> {
    return this.db
      .insertInto("review_job")
      .values({
        task_run_id: input.taskRunId,
        institution_snapshot_id: input.institutionSnapshotId,
        url: input.url,
        status: "PENDING",
        unique_request_key: input.uniqueRequestKey,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  /** 写入 Reviewer 决策（六方面一致性与最终判定）。 */
  async addDecision(input: {
    taskRunId: string;
    reviewJobId: string;
    url: string;
    dimensionsMatch: unknown;
    decision: ReviewDecision;
    conflictReason: string | null;
  }): Promise<ReviewDecisionRow> {
    return this.db
      .insertInto("review_decision")
      .values({
        task_run_id: input.taskRunId,
        review_job_id: input.reviewJobId,
        url: input.url,
        dimensions_match: JSON.stringify(input.dimensionsMatch),
        decision: input.decision,
        conflict_reason: input.conflictReason,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  /** 查询某 URL 是否已有通过的 MATCH 决策（供 result_row 触发器与业务层核对）。 */
  async hasPassingDecision(taskRunId: string, url: string): Promise<boolean> {
    const row = await this.db
      .selectFrom("review_decision")
      .select("id")
      .where("task_run_id", "=", taskRunId)
      .where("url", "=", url)
      .where("decision", "=", "MATCH")
      .executeTakeFirst();
    return row !== undefined;
  }
}
