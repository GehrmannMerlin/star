import type { Kysely } from "kysely";
import type { Migration } from "kysely/migration";
import type { Database } from "./schema.js";

/**
 * Web Task Runtime Result 持久层迁移（STEP 17）。
 *
 * 设计要点：
 * - 只给 task_run 增加一个 `result_summary jsonb` 可空列：保存 Biography Task 的
 *   Task Result 投影（RegionBiographyBatchResult 摘要 + taskId/regionName）。
 *   Task Result 只是 aggregation/projection —— PRIMARY Biography URL 的最终事实
 *   仍是 latest frozen APPROVED review（review_decision_submission），不在此表复制
 *   Leadership / Candidate Pool / Review History / Raw Artifact；
 * - progress 复用既有列（total_institutions / processed_institutions / reviewed_slots /
 *   recovery_count / blocked_count），不新增平行进度表；
 * - PARTIAL_COMPLETED 是合法终态（既有 TaskRunStatus），无 schema 变更。
 */
export const MIGRATION_007_TASK_RUNTIME_RESULT: {
  name: string;
  migration: Migration;
} = {
  name: "2026-08-14-task-runtime-result",
  migration: {
    async up(db: Kysely<Database>): Promise<void> {
      await db.schema
        .alterTable("task_run")
        .addColumn("result_summary", "jsonb")
        .execute();
    },

    async down(db: Kysely<Database>): Promise<void> {
      await db.schema
        .alterTable("task_run")
        .dropColumn("result_summary")
        .execute();
    },
  },
};
