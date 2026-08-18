import type { Kysely } from "kysely";
import type { Migration } from "kysely/migration";
import type { Database } from "./schema.js";

/**
 * Agent 运行进度持久层迁移（STEP 19.3）。
 *
 * 设计要点：
 * - 只给 task_run 增加两个可空 text 列：`agent_stage`（Agent 运行阶段，如
 *   INVENTORY_DISCOVERY / INVESTIGATING / REVIEWING / FINALIZING）与
 *   `current_institution`（当前正在处理的机构名）。它们是任务进度投影，
 *   不是新的状态机 enum；TaskRunStatus 语义保持不变；
 * - stage 只在业务边界更新（Inventory Start/Frozen、Investigator Start、
 *   Evidence Start、Review Start、Recovery Start、Finalizing），不随每个
 *   HTTP fetch 变化；
 * - legacy 任务（agent_stage 为 null）由投影侧从 status/progress 推导兜底。
 */
export const MIGRATION_008_TASK_AGENT_PROGRESS: {
  name: string;
  migration: Migration;
} = {
  name: "2026-08-18-task-agent-progress",
  migration: {
    async up(db: Kysely<Database>): Promise<void> {
      await db.schema
        .alterTable("task_run")
        .addColumn("agent_stage", "text")
        .addColumn("current_institution", "text")
        .execute();
    },
    async down(db: Kysely<Database>): Promise<void> {
      await db.schema
        .alterTable("task_run")
        .dropColumn("current_institution")
        .execute();
      await db.schema
        .alterTable("task_run")
        .dropColumn("agent_stage")
        .execute();
    },
  },
};
