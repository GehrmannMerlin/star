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
   * 原子领取任务（STEP 17：Graphile 重复投递/多 Worker 竞态的最小 Claim Gate）。
   * 只允许 PENDING → PREPARING：一旦领取即进入运行态（PREPARING→CRAWLING 由执行器推进），
   * 后续重复投递（任务已在 PREPARING/CRAWLING）返回 undefined → 调用方不启动第二套 Agent。
   * 崩溃后重新领取（Resume）本轮 Deferred。不做分布式锁框架（规格 §53）。
   */
  async claimTask(taskRunId: string): Promise<TaskRunRow | undefined> {
    return this.db
      .updateTable("task_run")
      .set({ status: "PREPARING", started_at: new Date().toISOString() })
      .where("id", "=", taskRunId)
      .where("status", "=", "PENDING")
      .returningAll()
      .executeTakeFirst();
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

  /**
   * 更新进度计数（STEP 17：Biography Task 进度投影到既有 task_run 进度列）。
   * 只更新显式传入的字段；total_institutions 在 inventory 冻结后设置一次，
   * processed_institutions 逐 Packet 完成时自增（既有 incrementProcessed）。
   */
  async setProgress(
    taskRunId: string,
    patch: {
      totalInstitutions?: number;
      processedInstitutions?: number;
      reviewedSlots?: number;
      recoveryCount?: number;
      blockedCount?: number;
    },
  ): Promise<TaskRunRow> {
    const set: Record<string, number> = {};
    if (patch.totalInstitutions !== undefined) set.total_institutions = patch.totalInstitutions;
    if (patch.processedInstitutions !== undefined) set.processed_institutions = patch.processedInstitutions;
    if (patch.reviewedSlots !== undefined) set.reviewed_slots = patch.reviewedSlots;
    if (patch.recoveryCount !== undefined) set.recovery_count = patch.recoveryCount;
    if (patch.blockedCount !== undefined) set.blocked_count = patch.blockedCount;
    return this.db
      .updateTable("task_run")
      .set(set)
      .where("id", "=", taskRunId)
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  /**
   * 保存 Task Result 投影（STEP 17：Biography Task 的批量结果摘要）。
   * result_summary 只是 aggregation/projection（RegionBiographyBatchResult + taskId/regionName）；
   * PRIMARY Biography URL 最终事实仍是 latest frozen APPROVED review，不在此重复 Artifact。
   * jsonb 列：pg 绑定对象参数即 JSON.stringify，读取时 pg 解析为 JS 对象。
   */
  async setResultSummary(
    taskRunId: string,
    summary: unknown,
  ): Promise<TaskRunRow> {
    return this.db
      .updateTable("task_run")
      .set({ result_summary: summary })
      .where("id", "=", taskRunId)
      .returningAll()
      .executeTakeFirstOrThrow();
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
