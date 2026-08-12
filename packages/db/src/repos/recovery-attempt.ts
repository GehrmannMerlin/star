import type { Kysely } from "kysely";
import type { Database } from "../schema.js";
import type { RecoveryAttemptRow } from "../types.js";

/**
 * recovery_attempt 仓储（规格 §16.4 控制层）。
 * Recovery 必须改变发现路径或验证策略，不得只是刷新原页面（规格 §14.3）。
 */
export class RecoveryAttemptRepository {
  constructor(private readonly db: Kysely<Database>) {}

  /** 记录一次 Recovery 尝试。 */
  async addAttempt(input: {
    taskRunId: string;
    institutionSnapshotId: string | null;
    triggerReason: string;
    strategy: string;
    budgetUsed: number;
    result: "SUCCESS" | "FAILED" | "STILL_UNRESOLVED";
  }): Promise<RecoveryAttemptRow> {
    return this.db
      .insertInto("recovery_attempt")
      .values({
        task_run_id: input.taskRunId,
        institution_snapshot_id: input.institutionSnapshotId,
        trigger_reason: input.triggerReason,
        strategy: input.strategy,
        budget_used: input.budgetUsed,
        result: input.result,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  /** 按任务列出全部 Recovery 尝试（供测试/审计）。 */
  async listByTask(taskRunId: string): Promise<RecoveryAttemptRow[]> {
    return this.db
      .selectFrom("recovery_attempt")
      .selectAll()
      .where("task_run_id", "=", taskRunId)
      .orderBy("created_at")
      .execute();
  }
}
