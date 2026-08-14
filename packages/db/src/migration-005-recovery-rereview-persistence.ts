import type { Kysely } from "kysely";
import type { Migration } from "kysely/migration";
import { sql } from "kysely";
import type { Database } from "./schema.js";

/**
 * Agent 复核持久层迁移（STEP 14）：Reviewer Decision + Recovery Supplement 冻结。
 *
 * 设计要点：
 * - 只新增两个 append-only 持久化关注点，不建 Packet / AgentSession 表；
 * - review_decision_submission 唯一 (packet_id, review_round)：同包同轮只冻结一次
 *   （Round 1 不可被 Round 2 覆盖，Freeze 由 DB 约束强制，不依赖进程锁）；
 * - recovery_submission 唯一 (packet_id, recovery_round)：Recovery 历史 append-only，
 *   Round 1 不可覆盖；
 * - payload 只存 thin 传输载荷（ReviewerSubmissionPayload / RecoverySubmissionPayload），
 *   绝不存原始 HTML、检索 snippets 或 secret-like 载荷；完整 canonical record 由
 *   runtime 在现有边界构造并校验；
 * - round_outcome 为确定性摘要列（review: APPROVED/REWORK_REQUIRED/REJECTED；
 *   recovery: RECOVERED/NO_QUALIFIED_URL/NEEDS_RECHECK），供历史读取与 latest 推导；
 * - packet_id / agent_session_id 均为逻辑身份字段（不建 FK）；agent_session_id 可空，
 *   因为 sink 在 session 建立前构造。
 */
export const MIGRATION_005_RECOVERY_REREVIEW_PERSISTENCE: {
  name: string;
  migration: Migration;
} = {
  name: "2026-08-14-recovery-rereview-persistence",
  migration: {
    async up(db: Kysely<Database>): Promise<void> {
      await db.schema
        .createTable("review_decision_submission")
        .addColumn("id", "uuid", (c) => c.primaryKey().defaultTo(sql`gen_random_uuid()`))
        .addColumn("packet_id", "text", (c) => c.notNull())
        .addColumn("review_round", "integer", (c) => c.notNull())
        .addColumn("agent_session_id", "text")
        .addColumn("agent_role", "varchar(32)", (c) => c.notNull())
        .addColumn("skill_name", "text", (c) => c.notNull())
        .addColumn("skill_version", "text", (c) => c.notNull())
        .addColumn("canonical_schema", "text", (c) => c.notNull())
        .addColumn("payload", "jsonb", (c) => c.notNull())
        .addColumn("payload_hash", "text", (c) => c.notNull())
        .addColumn("round_outcome", "varchar(16)", (c) => c.notNull())
        .addColumn("frozen_at", "timestamptz", (c) => c.notNull())
        .addColumn("created_at", "timestamptz", (c) => c.notNull().defaultTo(sql`now()`))
        .execute();

      await db.schema
        .alterTable("review_decision_submission")
        .addUniqueConstraint("review_decision_submission_round_unique", [
          "packet_id",
          "review_round",
        ])
        .execute();
      await sql`
        ALTER TABLE review_decision_submission
        ADD CONSTRAINT review_decision_submission_outcome_check
        CHECK (round_outcome IN ('APPROVED', 'REWORK_REQUIRED', 'REJECTED'))
      `.execute(db);
      await db.schema
        .createIndex("idx_review_decision_submission_packet_round")
        .on("review_decision_submission")
        .columns(["packet_id", "review_round"])
        .execute();

      await db.schema
        .createTable("recovery_submission")
        .addColumn("id", "uuid", (c) => c.primaryKey().defaultTo(sql`gen_random_uuid()`))
        .addColumn("packet_id", "text", (c) => c.notNull())
        .addColumn("recovery_round", "integer", (c) => c.notNull())
        .addColumn("agent_session_id", "text")
        .addColumn("agent_role", "varchar(32)", (c) => c.notNull())
        .addColumn("skill_name", "text", (c) => c.notNull())
        .addColumn("skill_version", "text", (c) => c.notNull())
        .addColumn("canonical_schema", "text", (c) => c.notNull())
        .addColumn("payload", "jsonb", (c) => c.notNull())
        .addColumn("payload_hash", "text", (c) => c.notNull())
        .addColumn("round_outcome", "varchar(24)", (c) => c.notNull())
        .addColumn("frozen_at", "timestamptz", (c) => c.notNull())
        .addColumn("created_at", "timestamptz", (c) => c.notNull().defaultTo(sql`now()`))
        .execute();

      await db.schema
        .alterTable("recovery_submission")
        .addUniqueConstraint("recovery_submission_round_unique", ["packet_id", "recovery_round"])
        .execute();
      await sql`
        ALTER TABLE recovery_submission
        ADD CONSTRAINT recovery_submission_outcome_check
        CHECK (round_outcome IN ('RECOVERED', 'NO_QUALIFIED_URL', 'NEEDS_RECHECK'))
      `.execute(db);
      await db.schema
        .createIndex("idx_recovery_submission_packet_round")
        .on("recovery_submission")
        .columns(["packet_id", "recovery_round"])
        .execute();
    },

    async down(db: Kysely<Database>): Promise<void> {
      await db.schema.dropTable("recovery_submission").execute();
      await db.schema.dropTable("review_decision_submission").execute();
    },
  },
};
