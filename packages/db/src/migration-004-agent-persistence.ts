import type { Kysely } from "kysely";
import type { Migration } from "kysely/migration";
import { sql } from "kysely";
import type { Database } from "./schema.js";

/**
 * Agent 持久层迁移（STEP 11）：Tool Event 日志 + Investigator Evidence Submission 冻结。
 *
 * 设计要点：
 * - 只新增两个持久化关注点，不建 Packet / AgentSession / PageSnapshot / Reviewer / Recovery 表；
 * - tool_event 只存数据最小化后的投影元数据（url_metadata/search_metadata/submission_metadata），
 *   绝不存原始 HTML、检索 snippets 或 secret-like 载荷；
 * - tool_event 唯一 (call_id, status)：防止同一次调用同状态事件被静默覆盖；seq(serial) 提供确定性读取顺序；
 * - investigator_evidence_submission 唯一 (packet_id)：数据库保证同一 Packet 的 Evidence 只冻结一次
 *   （Freeze 由 DB 约束强制，不依赖进程锁）；
 * - packet_id / agent_session_id 均为逻辑身份字段（不建 FK，相应持久化仍 Deferred）。
 */
export const MIGRATION_004_AGENT_PERSISTENCE: { name: string; migration: Migration } = {
  name: "2026-08-14-agent-persistence",
  migration: {
    async up(db: Kysely<Database>): Promise<void> {
      await db.schema
        .createTable("tool_event")
        .addColumn("id", "uuid", (c) => c.primaryKey().defaultTo(sql`gen_random_uuid()`))
        .addColumn("seq", "serial")
        .addColumn("call_id", "text", (c) => c.notNull())
        .addColumn("tool_name", "text", (c) => c.notNull())
        .addColumn("status", "varchar(16)", (c) => c.notNull())
        .addColumn("agent_session_id", "text", (c) => c.notNull())
        .addColumn("packet_id", "text")
        .addColumn("agent_role", "varchar(32)", (c) => c.notNull())
        .addColumn("task_run_id", "text", (c) => c.notNull())
        .addColumn("started_at", "timestamptz", (c) => c.notNull())
        .addColumn("finished_at", "timestamptz")
        .addColumn("failure_code", "text")
        .addColumn("failure_message", "text")
        .addColumn("failure_retryable", "boolean")
        .addColumn("url_metadata", "jsonb")
        .addColumn("search_metadata", "jsonb")
        .addColumn("submission_metadata", "jsonb")
        .addColumn("created_at", "timestamptz", (c) => c.notNull().defaultTo(sql`now()`))
        .execute();

      await db.schema
        .alterTable("tool_event")
        .addUniqueConstraint("tool_event_call_status_unique", ["call_id", "status"])
        .execute();
      await sql`
        ALTER TABLE tool_event
        ADD CONSTRAINT tool_event_status_check
        CHECK (status IN ('STARTED', 'SUCCESS', 'FAILED', 'CANCELLED'))
      `.execute(db);
      await db.schema
        .createIndex("idx_tool_event_session_seq")
        .on("tool_event")
        .columns(["agent_session_id", "seq"])
        .execute();

      await db.schema
        .createTable("investigator_evidence_submission")
        .addColumn("id", "uuid", (c) => c.primaryKey().defaultTo(sql`gen_random_uuid()`))
        .addColumn("packet_id", "text", (c) => c.notNull())
        .addColumn("agent_session_id", "text", (c) => c.notNull())
        .addColumn("agent_role", "varchar(32)", (c) => c.notNull())
        .addColumn("skill_name", "text", (c) => c.notNull())
        .addColumn("skill_version", "text", (c) => c.notNull())
        .addColumn("canonical_schema", "text", (c) => c.notNull())
        .addColumn("payload", "jsonb", (c) => c.notNull())
        .addColumn("payload_hash", "text", (c) => c.notNull())
        .addColumn("frozen_at", "timestamptz", (c) => c.notNull())
        .addColumn("created_at", "timestamptz", (c) => c.notNull().defaultTo(sql`now()`))
        .execute();

      await db.schema
        .alterTable("investigator_evidence_submission")
        .addUniqueConstraint("investigator_evidence_submission_packet_unique", ["packet_id"])
        .execute();
      await db.schema
        .createIndex("idx_investigator_evidence_submission_packet")
        .on("investigator_evidence_submission")
        .columns(["packet_id"])
        .execute();
    },

    async down(db: Kysely<Database>): Promise<void> {
      await db.schema.dropTable("investigator_evidence_submission").execute();
      await db.schema.dropTable("tool_event").execute();
    },
  },
};
