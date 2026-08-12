import type { Kysely, Transaction } from "kysely";
import type { Database, TaskRunRow } from "../schema.js";
import type { TaskMode, TaskRunStatus, ExpandLevel } from "@stellaris/contracts";

/**
 * task_run 仓储（规格 §16.1 范围层）。
 * 负责任务创建（幂等）、状态推进与完成记录。
 */
export class TaskRunRepository {
  constructor(private readonly db: Kysely<Database>) {}

  /**
   * 按幂等键创建任务。若已存在则返回既有任务（规格 §18.3：重复点击只创建一个任务）。
   * 使用 upsert 保证并发安全。
   */
  async createWithIdempotency(input: {
    ownerUserId: string;
    idempotencyKey: string;
    mode: TaskMode;
    expandLevel: ExpandLevel;
    ruleVersion: string;
  }): Promise<TaskRunRow> {
    const inserted = await this.db
      .insertInto("task_run")
      .values({
        owner_user_id: input.ownerUserId,
        idempotency_key: input.idempotencyKey,
        mode: input.mode,
        expand_level: input.expandLevel,
        rule_version: input.ruleVersion,
        status: "PENDING",
      })
      .onConflict((oc) =>
        oc.columns(["owner_user_id", "idempotency_key"]).doNothing(),
      )
      .returningAll()
      .executeTakeFirst();

    if (inserted) {
      return inserted;
    }
    // 冲突：返回既有任务。
    const existing = await this.db
      .selectFrom("task_run")
      .selectAll()
      .where("owner_user_id", "=", input.ownerUserId)
      .where("idempotency_key", "=", input.idempotencyKey)
      .executeTakeFirstOrThrow();
    return existing;
  }

  /** 更新任务状态并返回更新后的行。 */
  async setStatus(
    taskRunId: string,
    status: TaskRunStatus,
  ): Promise<TaskRunRow> {
    return this.db
      .updateTable("task_run")
      .set({ status })
      .where("id", "=", taskRunId)
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  /** 任务开始。 */
  async markStarted(taskRunId: string): Promise<void> {
    await this.db
      .updateTable("task_run")
      .set({ status: "CRAWLING", started_at: new Date().toISOString() })
      .where("id", "=", taskRunId)
      .execute();
  }

  /**
   * 推进机构处理计数（原子自增，规格 §20.2 真实计数）。
   * 返回更新后的任务行。
   */
  async incrementProcessed(taskRunId: string): Promise<TaskRunRow> {
    return this.db
      .updateTable("task_run")
      .set((eb) => ({
        processed_institutions: eb("processed_institutions", "+", 1),
      }))
      .where("id", "=", taskRunId)
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  /** 完成任务（设置终态与完成时间）。 */
  async complete(
    taskRunId: string,
    status: "COMPLETED" | "PARTIAL_COMPLETED" | "FAILED",
    errorMessage?: string,
  ): Promise<void> {
    await this.db
      .updateTable("task_run")
      .set({
        status,
        finished_at: new Date().toISOString(),
        ...(errorMessage ? { error_message: errorMessage } : {}),
      })
      .where("id", "=", taskRunId)
      .execute();
  }

  /** 查询任务。 */
  async findById(taskRunId: string): Promise<TaskRunRow | undefined> {
    return this.db
      .selectFrom("task_run")
      .selectAll()
      .where("id", "=", taskRunId)
      .executeTakeFirst();
  }

  /** Query a task only when it belongs to the supplied owner. */
  async findByIdForOwner(
    taskRunId: string,
    ownerUserId: string,
  ): Promise<TaskRunRow | undefined> {
    return this.db
      .selectFrom("task_run")
      .selectAll()
      .where("id", "=", taskRunId)
      .where("owner_user_id", "=", ownerUserId)
      .executeTakeFirst();
  }

  /** 崩溃恢复：列出可恢复（运行中且已开始）的任务（规格 §18.2）。 */
  async listRecoverable(): Promise<TaskRunRow[]> {
    return this.db
      .selectFrom("task_run")
      .selectAll()
      .where("status", "in", [
        "PENDING",
        "PREPARING",
        "CRAWLING",
        "RECOVERING",
        "REVIEWING",
        "GENERATING",
      ])
      .where("started_at", "is not", null)
      .execute();
  }

  /** 任务列表（P3：最近任务摘要，按 requested_at 降序 + 分页 + 可选筛选）。 */
  async listRecent(opts: {
    ownerUserId: string;
    limit: number;
    offset: number;
    status?: TaskRunStatus;
    mode?: TaskMode;
  }): Promise<TaskRunRow[]> {
    let q = this.db
      .selectFrom("task_run")
      .selectAll()
      .where("owner_user_id", "=", opts.ownerUserId);
    if (opts.status) q = q.where("status", "=", opts.status);
    if (opts.mode) q = q.where("mode", "=", opts.mode);
    return q.orderBy("requested_at", "desc").limit(opts.limit).offset(opts.offset).execute();
  }

  /** 任务总数（P3：支持可选筛选，供列表 total 字段）。 */
  async count(opts: {
    ownerUserId: string;
    status?: TaskRunStatus;
    mode?: TaskMode;
  }): Promise<number> {
    let q = this.db
      .selectFrom("task_run")
      .select((eb) => eb.fn.countAll().as("n"))
      .where("owner_user_id", "=", opts.ownerUserId);
    if (opts.status) q = q.where("status", "=", opts.status);
    if (opts.mode) q = q.where("mode", "=", opts.mode);
    const row = await q.executeTakeFirst();
    return Number(row?.n ?? 0);
  }

  /** 在事务中执行（供多表操作原子提交，规格 §18.4）。 */
  async transaction<T>(
    fn: (trx: Transaction<Database>) => Promise<T>,
  ): Promise<T> {
    return this.db.transaction().execute(fn);
  }
}
