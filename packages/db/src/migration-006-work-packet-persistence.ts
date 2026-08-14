import type { Kysely } from "kysely";
import type { Migration } from "kysely/migration";
import { sql } from "kysely";
import type { Database } from "./schema.js";

/**
 * Agent Work Packet 持久层迁移（STEP 15）。
 *
 * 设计要点：
 * - 只新增一张 Packet 编排/状态 identity 表，不存任何 Raw Artifact；
 *   Leadership JSON / Candidate Pool / Review payload / Recovery payload
 *   各自已有 SSoT（tool_event / investigator_evidence_submission /
 *   review_decision_submission / recovery_submission），Packet 表不重复存储；
 * - packet_id 为 PK（text，runtime 生成的逻辑身份）；institution_id 只加普通索引，
 *   不建 FK 到旧表（本轮优先 logical packet_id）；
 * - state 为确定性枚举摘要列（PACKET_STATES），值与 agent-runtime 状态机一致；
 *   非法 transition 由 agent-runtime 的 ALLOWED_TRANSITIONS 拒绝，Store 只是存储；
 * - primary1/primary2 人员身份列：只存两个 PRIMARY 人员的 target/person id/name，
 *   供 Biography Url Result 投影在无 Agent 情况下确定 slot → 人员映射；
 * - created_at / updated_at 由 DB 默认 now()，state 变化时由 store 显式更新。
 */
export const MIGRATION_006_WORK_PACKET_PERSISTENCE: {
  name: string;
  migration: Migration;
} = {
  name: "2026-08-14-institution-work-packet-persistence",
  migration: {
    async up(db: Kysely<Database>): Promise<void> {
      await db.schema
        .createTable("institution_work_packet")
        .addColumn("packet_id", "text", (c) => c.primaryKey())
        .addColumn("inventory_hash", "text", (c) => c.notNull())
        .addColumn("region_code", "text")
        .addColumn("institution_id", "text", (c) => c.notNull())
        .addColumn("institution_name", "text", (c) => c.notNull())
        .addColumn("administrative_level", "varchar(32)", (c) => c.notNull())
        .addColumn("institution_type", "text")
        .addColumn("state", "varchar(24)", (c) => c.notNull())
        .addColumn("attempt_no", "integer", (c) => c.notNull().defaultTo(1))
        .addColumn("investigator_session_id", "text")
        .addColumn("failure_code", "text")
        .addColumn("primary1_target_id", "text")
        .addColumn("primary1_person_id", "text")
        .addColumn("primary1_person_name", "text")
        .addColumn("primary2_target_id", "text")
        .addColumn("primary2_person_id", "text")
        .addColumn("primary2_person_name", "text")
        .addColumn("created_at", "timestamptz", (c) => c.notNull().defaultTo(sql`now()`))
        .addColumn("updated_at", "timestamptz", (c) => c.notNull().defaultTo(sql`now()`))
        .execute();

      await db.schema
        .createIndex("idx_institution_work_packet_institution")
        .on("institution_work_packet")
        .columns(["institution_id"])
        .execute();
    },

    async down(db: Kysely<Database>): Promise<void> {
      await db.schema.dropTable("institution_work_packet").execute();
    },
  },
};
