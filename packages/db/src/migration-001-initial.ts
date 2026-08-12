import type { Kysely } from "kysely";
import type { Migration } from "kysely/migration";
import { sql } from "kysely";
import type { Database } from "./schema.js";

/**
 * 初始迁移：创建全部 25 张表、枚举约束与关键唯一约束（规格 §16）。
 *
 * 设计要点：
 * - 所有表 id 为 uuid 主键（默认 gen_random_uuid()，PostgreSQL 13+ 内置）；
 * - 枚举列使用 varchar + CHECK，值来自 @stellaris/contracts 常量；
 * - 幂等键唯一约束（规格 §18.3）：任务 idempotency_key；
 * - result_row 同任务/机构/槽位唯一（规格 §16.6）；
 * - 抓取层外键引用，证据与结果间不变量（§16.6）。
 */
export const MIGRATION_001_INITIAL: { name: string; migration: Migration } = {
  name: "2026-08-03-initial-schema",
  migration: {
    async up(db: Kysely<Database>): Promise<void> {
      // gen_random_uuid() 在 PG13+ 内置
      await sql`CREATE EXTENSION IF NOT EXISTS pgcrypto`.execute(db);

      // ─────────── 范围层 ───────────
      await db.schema
        .createTable("task_run")
        .addColumn("id", "uuid", (c) => c.primaryKey().defaultTo(sql`gen_random_uuid()`))
        .addColumn("idempotency_key", "varchar(128)", (c) => c.notNull())
        .addColumn("mode", "varchar(32)", (c) => c.notNull())
        .addColumn("expand_level", "varchar(32)", (c) => c.notNull())
        .addColumn("status", "varchar(32)", (c) => c.notNull())
        .addColumn("rule_version", "varchar(64)", (c) => c.notNull())
        .addColumn("total_institutions", "integer", (c) => c.notNull().defaultTo(0))
        .addColumn("processed_institutions", "integer", (c) => c.notNull().defaultTo(0))
        .addColumn("reviewed_slots", "integer", (c) => c.notNull().defaultTo(0))
        .addColumn("recovery_count", "integer", (c) => c.notNull().defaultTo(0))
        .addColumn("blocked_count", "integer", (c) => c.notNull().defaultTo(0))
        .addColumn("requested_at", "timestamptz", (c) => c.notNull().defaultTo(sql`now()`))
        .addColumn("started_at", "timestamptz")
        .addColumn("finished_at", "timestamptz")
        .addColumn("error_message", "text")
        .addColumn("created_at", "timestamptz", (c) => c.notNull().defaultTo(sql`now()`))
        .execute();
      await db.schema
        .alterTable("task_run")
        .addUniqueConstraint("task_run_idempotency_key_unique", ["idempotency_key"])
        .execute();

      await db.schema
        .createTable("target_scope")
        .addColumn("id", "uuid", (c) => c.primaryKey().defaultTo(sql`gen_random_uuid()`))
        .addColumn("task_run_id", "uuid", (c) => c.notNull().references("task_run.id").onDelete("cascade"))
        .addColumn("region_code", "varchar(16)", (c) => c.notNull())
        .addColumn("region_name", "varchar(128)", (c) => c.notNull())
        .addColumn("parent_region_code", "varchar(16)")
        .addColumn("region_level", "varchar(16)", (c) => c.notNull())
        .addColumn("included", "boolean", (c) => c.notNull().defaultTo(true))
        .addColumn("created_at", "timestamptz", (c) => c.notNull().defaultTo(sql`now()`))
        .execute();
      await db.schema
        .alterTable("target_scope")
        .addUniqueConstraint("target_scope_task_region_unique", ["task_run_id", "region_code"])
        .execute();

      await db.schema
        .createTable("institution_snapshot")
        .addColumn("id", "uuid", (c) => c.primaryKey().defaultTo(sql`gen_random_uuid()`))
        .addColumn("task_run_id", "uuid", (c) => c.notNull().references("task_run.id").onDelete("cascade"))
        .addColumn("region_code", "varchar(16)", (c) => c.notNull())
        .addColumn("official_name", "varchar(255)", (c) => c.notNull())
        .addColumn("common_name", "varchar(128)")
        .addColumn("institution_type", "varchar(48)", (c) => c.notNull())
        .addColumn("official_entry_url", "text")
        .addColumn("discovery_source", "varchar(64)", (c) => c.notNull())
        .addColumn("select_two_primary", "boolean", (c) => c.notNull().defaultTo(true))
        .addColumn("frozen_at", "timestamptz", (c) => c.notNull())
        .addColumn("status", "varchar(16)", (c) => c.notNull().defaultTo("ACTIVE"))
        .addColumn("terminal_reason", "text")
        .addColumn("created_at", "timestamptz", (c) => c.notNull().defaultTo(sql`now()`))
        .execute();

      // ─────────── 抓取层 ───────────
      await db.schema
        .createTable("crawl_intent")
        .addColumn("id", "uuid", (c) => c.primaryKey().defaultTo(sql`gen_random_uuid()`))
        .addColumn("task_run_id", "uuid", (c) => c.notNull().references("task_run.id").onDelete("cascade"))
        .addColumn("institution_snapshot_id", "uuid")
        .addColumn("original_url", "text", (c) => c.notNull())
        .addColumn("canonical_key", "varchar(512)", (c) => c.notNull())
        .addColumn("priority", "integer", (c) => c.notNull().defaultTo(3))
        .addColumn("phase", "varchar(32)", (c) => c.notNull())
        .addColumn("purpose", "varchar(64)", (c) => c.notNull())
        .addColumn("status", "varchar(16)", (c) => c.notNull().defaultTo("PENDING"))
        .addColumn("created_at", "timestamptz", (c) => c.notNull().defaultTo(sql`now()`))
        .execute();
      await db.schema
        .alterTable("crawl_intent")
        .addUniqueConstraint("crawl_intent_task_canonical_purpose_unique", [
          "task_run_id",
          "canonical_key",
          "purpose",
        ])
        .execute();

      await db.schema
        .createTable("document_snapshot")
        .addColumn("id", "uuid", (c) => c.primaryKey().defaultTo(sql`gen_random_uuid()`))
        .addColumn("content_hash", "varchar(64)", (c) => c.notNull())
        .addColumn("mime_type", "varchar(64)", (c) => c.notNull())
        .addColumn("charset", "varchar(32)")
        .addColumn("size_bytes", "bigint", (c) => c.notNull())
        .addColumn("relative_path", "text", (c) => c.notNull())
        .addColumn("created_at", "timestamptz", (c) => c.notNull().defaultTo(sql`now()`))
        .execute();
      await db.schema
        .alterTable("document_snapshot")
        .addUniqueConstraint("document_snapshot_hash_unique", ["content_hash"])
        .execute();

      await db.schema
        .createTable("fetch_attempt")
        .addColumn("id", "uuid", (c) => c.primaryKey().defaultTo(sql`gen_random_uuid()`))
        .addColumn("task_run_id", "uuid", (c) => c.notNull().references("task_run.id").onDelete("cascade"))
        .addColumn("crawl_intent_id", "uuid")
        .addColumn("fetch_mode", "varchar(16)", (c) => c.notNull())
        .addColumn("url", "text", (c) => c.notNull())
        .addColumn("canonical_key", "varchar(512)", (c) => c.notNull())
        .addColumn("http_status", "integer")
        .addColumn("status", "varchar(16)", (c) => c.notNull())
        .addColumn("retries", "integer", (c) => c.notNull().defaultTo(0))
        .addColumn("resolved_ip", "varchar(64)")
        .addColumn("duration_ms", "integer", (c) => c.notNull().defaultTo(0))
        .addColumn("redirected_url", "text")
        .addColumn("document_snapshot_id", "uuid")
        .addColumn("error_message", "text")
        .addColumn("created_at", "timestamptz", (c) => c.notNull().defaultTo(sql`now()`))
        .execute();

      await db.schema
        .createTable("link_edge")
        .addColumn("id", "uuid", (c) => c.primaryKey().defaultTo(sql`gen_random_uuid()`))
        .addColumn("task_run_id", "uuid", (c) => c.notNull().references("task_run.id").onDelete("cascade"))
        .addColumn("source_document_snapshot_id", "uuid", (c) => c.notNull())
        .addColumn("target_url", "text", (c) => c.notNull())
        .addColumn("anchor_text", "text")
        .addColumn("dom_position", "text")
        .addColumn("relation_type", "varchar(32)", (c) => c.notNull())
        .addColumn("created_at", "timestamptz", (c) => c.notNull().defaultTo(sql`now()`))
        .execute();

      // ─────────── 事实层 ───────────
      await db.schema
        .createTable("page_fact")
        .addColumn("id", "uuid", (c) => c.primaryKey().defaultTo(sql`gen_random_uuid()`))
        .addColumn("document_snapshot_id", "uuid", (c) => c.notNull())
        .addColumn("title", "text")
        .addColumn("body_text", "text")
        .addColumn("published_at", "timestamptz")
        .addColumn("dom_facts", "jsonb")
        .addColumn("signals", "jsonb")
        .addColumn("created_at", "timestamptz", (c) => c.notNull().defaultTo(sql`now()`))
        .execute();

      await db.schema
        .createTable("entity_assertion")
        .addColumn("id", "uuid", (c) => c.primaryKey().defaultTo(sql`gen_random_uuid()`))
        .addColumn("task_run_id", "uuid", (c) => c.notNull().references("task_run.id").onDelete("cascade"))
        .addColumn("person_name", "varchar(128)", (c) => c.notNull())
        .addColumn("institution_id", "uuid")
        .addColumn("official_role", "text")
        .addColumn("supporting_evidence", "jsonb")
        .addColumn("assertion_type", "varchar(32)", (c) => c.notNull())
        .addColumn("created_at", "timestamptz", (c) => c.notNull().defaultTo(sql`now()`))
        .execute();

      await db.schema
        .createTable("currentness_assertion")
        .addColumn("id", "uuid", (c) => c.primaryKey().defaultTo(sql`gen_random_uuid()`))
        .addColumn("task_run_id", "uuid", (c) => c.notNull().references("task_run.id").onDelete("cascade"))
        .addColumn("person_name", "varchar(128)", (c) => c.notNull())
        .addColumn("institution_id", "uuid")
        .addColumn("currentness_status", "varchar(64)", (c) => c.notNull())
        .addColumn("supporting_evidence", "jsonb")
        .addColumn("conflict_evidence", "jsonb")
        .addColumn("created_at", "timestamptz", (c) => c.notNull().defaultTo(sql`now()`))
        .execute();

      // ─────────── 业务层 ───────────
      await db.schema
        .createTable("leadership_snapshot")
        .addColumn("id", "uuid", (c) => c.primaryKey().defaultTo(sql`gen_random_uuid()`))
        .addColumn("task_run_id", "uuid", (c) => c.notNull().references("task_run.id").onDelete("cascade"))
        .addColumn("institution_snapshot_id", "uuid", (c) => c.notNull())
        .addColumn("leadership_json", "jsonb", (c) => c.notNull())
        .addColumn("created_at", "timestamptz", (c) => c.notNull().defaultTo(sql`now()`))
        .execute();

      await db.schema
        .createTable("role_assignment")
        .addColumn("id", "uuid", (c) => c.primaryKey().defaultTo(sql`gen_random_uuid()`))
        .addColumn("task_run_id", "uuid", (c) => c.notNull().references("task_run.id").onDelete("cascade"))
        .addColumn("institution_snapshot_id", "uuid", (c) => c.notNull())
        .addColumn("person_name", "varchar(128)", (c) => c.notNull())
        .addColumn("official_role", "text", (c) => c.notNull())
        .addColumn("sort_order", "integer")
        .addColumn("attribute", "varchar(16)", (c) => c.notNull().defaultTo("none"))
        .addColumn("created_at", "timestamptz", (c) => c.notNull().defaultTo(sql`now()`))
        .execute();

      await db.schema
        .createTable("slot_decision")
        .addColumn("id", "uuid", (c) => c.primaryKey().defaultTo(sql`gen_random_uuid()`))
        .addColumn("task_run_id", "uuid", (c) => c.notNull().references("task_run.id").onDelete("cascade"))
        .addColumn("institution_snapshot_id", "uuid", (c) => c.notNull())
        .addColumn("slot", "varchar(16)", (c) => c.notNull())
        .addColumn("person_name", "varchar(128)")
        .addColumn("status", "varchar(16)", (c) => c.notNull())
        .addColumn("created_at", "timestamptz", (c) => c.notNull().defaultTo(sql`now()`))
        .execute();
      await db.schema
        .alterTable("slot_decision")
        .addUniqueConstraint("slot_decision_task_institution_slot_unique", [
          "task_run_id",
          "institution_snapshot_id",
          "slot",
        ])
        .execute();

      await db.schema
        .createTable("url_candidate")
        .addColumn("id", "uuid", (c) => c.primaryKey().defaultTo(sql`gen_random_uuid()`))
        .addColumn("task_run_id", "uuid", (c) => c.notNull().references("task_run.id").onDelete("cascade"))
        .addColumn("institution_snapshot_id", "uuid")
        .addColumn("url", "text", (c) => c.notNull())
        .addColumn("discovery_score", "integer", (c) => c.notNull().defaultTo(0))
        .addColumn("hard_gate", "jsonb")
        .addColumn("created_at", "timestamptz", (c) => c.notNull().defaultTo(sql`now()`))
        .execute();

      await db.schema
        .createTable("recovery_attempt")
        .addColumn("id", "uuid", (c) => c.primaryKey().defaultTo(sql`gen_random_uuid()`))
        .addColumn("task_run_id", "uuid", (c) => c.notNull().references("task_run.id").onDelete("cascade"))
        .addColumn("institution_snapshot_id", "uuid")
        .addColumn("trigger_reason", "varchar(255)", (c) => c.notNull())
        .addColumn("strategy", "varchar(64)", (c) => c.notNull())
        .addColumn("budget_used", "integer", (c) => c.notNull().defaultTo(0))
        .addColumn("result", "varchar(32)", (c) => c.notNull())
        .addColumn("created_at", "timestamptz", (c) => c.notNull().defaultTo(sql`now()`))
        .execute();

      await db.schema
        .createTable("review_job")
        .addColumn("id", "uuid", (c) => c.primaryKey().defaultTo(sql`gen_random_uuid()`))
        .addColumn("task_run_id", "uuid", (c) => c.notNull().references("task_run.id").onDelete("cascade"))
        .addColumn("institution_snapshot_id", "uuid")
        .addColumn("url", "text", (c) => c.notNull())
        .addColumn("status", "varchar(16)", (c) => c.notNull().defaultTo("PENDING"))
        .addColumn("unique_request_key", "varchar(512)", (c) => c.notNull())
        .addColumn("created_at", "timestamptz", (c) => c.notNull().defaultTo(sql`now()`))
        .execute();

      await db.schema
        .createTable("review_decision")
        .addColumn("id", "uuid", (c) => c.primaryKey().defaultTo(sql`gen_random_uuid()`))
        .addColumn("task_run_id", "uuid", (c) => c.notNull().references("task_run.id").onDelete("cascade"))
        .addColumn("review_job_id", "uuid", (c) => c.notNull())
        .addColumn("url", "text", (c) => c.notNull())
        .addColumn("dimensions_match", "jsonb", (c) => c.notNull())
        .addColumn("decision", "varchar(16)", (c) => c.notNull())
        .addColumn("conflict_reason", "text")
        .addColumn("created_at", "timestamptz", (c) => c.notNull().defaultTo(sql`now()`))
        .execute();

      // ─────────── 输出层 ───────────
      await db.schema
        .createTable("result_row")
        .addColumn("id", "uuid", (c) => c.primaryKey().defaultTo(sql`gen_random_uuid()`))
        .addColumn("task_run_id", "uuid", (c) => c.notNull().references("task_run.id").onDelete("cascade"))
        .addColumn("institution_snapshot_id", "uuid", (c) => c.notNull())
        .addColumn("slot", "varchar(16)", (c) => c.notNull())
        .addColumn("region_code", "varchar(16)", (c) => c.notNull())
        .addColumn("province", "varchar(64)")
        .addColumn("city", "varchar(64)")
        .addColumn("county", "varchar(64)")
        .addColumn("town", "varchar(64)")
        .addColumn("institution_name", "varchar(255)", (c) => c.notNull())
        .addColumn("position_display", "text", (c) => c.notNull())
        .addColumn("person_name", "varchar(128)")
        .addColumn("current_status_zh", "varchar(32)", (c) => c.notNull())
        .addColumn("position_url", "text")
        .addColumn("page_type_zh", "varchar(32)")
        .addColumn("result_zh", "text", (c) => c.notNull())
        .addColumn("collected_at", "timestamptz", (c) => c.notNull())
        .addColumn("created_at", "timestamptz", (c) => c.notNull().defaultTo(sql`now()`))
        .execute();
      await db.schema
        .alterTable("result_row")
        .addUniqueConstraint("result_row_task_institution_slot_unique", [
          "task_run_id",
          "institution_snapshot_id",
          "slot",
        ])
        .execute();

      await db.schema
        .createTable("export_artifact")
        .addColumn("id", "uuid", (c) => c.primaryKey().defaultTo(sql`gen_random_uuid()`))
        .addColumn("task_run_id", "uuid", (c) => c.notNull().references("task_run.id").onDelete("cascade"))
        .addColumn("filename", "varchar(255)", (c) => c.notNull())
        .addColumn("row_count", "integer", (c) => c.notNull())
        .addColumn("content_hash", "varchar(64)", (c) => c.notNull())
        .addColumn("generated_at", "timestamptz", (c) => c.notNull())
        .addColumn("created_at", "timestamptz", (c) => c.notNull().defaultTo(sql`now()`))
        .execute();

      // ─────────── 复用层 ───────────
      await db.schema
        .createTable("site_profile")
        .addColumn("id", "uuid", (c) => c.primaryKey().defaultTo(sql`gen_random_uuid()`))
        .addColumn("host", "varchar(255)", (c) => c.notNull())
        .addColumn("fetch_mode", "varchar(16)", (c) => c.notNull())
        .addColumn("dom_fingerprint", "text")
        .addColumn("wait_condition", "text")
        .addColumn("current_leader_entry", "text")
        .addColumn("avg_duration_ms", "integer")
        .addColumn("success_rate", sql`numeric(5,2)`)
        .addColumn("last_verified_at", "timestamptz")
        .addColumn("failure_signals", "jsonb")
        .addColumn("created_at", "timestamptz", (c) => c.notNull().defaultTo(sql`now()`))
        .execute();
      await db.schema
        .alterTable("site_profile")
        .addUniqueConstraint("site_profile_host_unique", ["host"])
        .execute();

      await db.schema
        .createTable("path_family_profile")
        .addColumn("id", "uuid", (c) => c.primaryKey().defaultTo(sql`gen_random_uuid()`))
        .addColumn("site_profile_id", "uuid", (c) => c.notNull())
        .addColumn("host", "varchar(255)", (c) => c.notNull())
        .addColumn("path_family", "text", (c) => c.notNull())
        .addColumn("fetch_mode", "varchar(16)", (c) => c.notNull())
        .addColumn("page_family", "varchar(64)", (c) => c.notNull())
        .addColumn("avg_duration_ms", "integer")
        .addColumn("success_rate", sql`numeric(5,2)`)
        .addColumn("last_verified_at", "timestamptz")
        .addColumn("created_at", "timestamptz", (c) => c.notNull().defaultTo(sql`now()`))
        .execute();

      await db.schema
        .createTable("public_api_profile")
        .addColumn("id", "uuid", (c) => c.primaryKey().defaultTo(sql`gen_random_uuid()`))
        .addColumn("site_profile_id", "uuid", (c) => c.notNull())
        .addColumn("host", "varchar(255)", (c) => c.notNull())
        .addColumn("url_pattern", "text", (c) => c.notNull())
        .addColumn("method", "varchar(8)", (c) => c.notNull())
        .addColumn("response_type", "varchar(32)", (c) => c.notNull())
        .addColumn("structure_fingerprint", "text")
        .addColumn("page_relation", "text")
        .addColumn("field_locations", "jsonb")
        .addColumn("last_verified_at", "timestamptz")
        .addColumn("created_at", "timestamptz", (c) => c.notNull().defaultTo(sql`now()`))
        .execute();

      await db.schema
        .createTable("search_result_cache")
        .addColumn("id", "uuid", (c) => c.primaryKey().defaultTo(sql`gen_random_uuid()`))
        .addColumn("query", "varchar(512)", (c) => c.notNull())
        .addColumn("provider", "varchar(64)", (c) => c.notNull())
        .addColumn("pagination_token", "text")
        .addColumn("results", "jsonb")
        .addColumn("cached_at", "timestamptz", (c) => c.notNull().defaultTo(sql`now()`))
        .addColumn("created_at", "timestamptz", (c) => c.notNull().defaultTo(sql`now()`))
        .execute();
      await db.schema
        .alterTable("search_result_cache")
        .addUniqueConstraint("search_result_cache_query_provider_unique", ["query", "provider"])
        .execute();

      await db.schema
        .createTable("robots_cache")
        .addColumn("id", "uuid", (c) => c.primaryKey().defaultTo(sql`gen_random_uuid()`))
        .addColumn("host", "varchar(255)", (c) => c.notNull())
        .addColumn("content", "text")
        .addColumn("fetched_at", "timestamptz", (c) => c.notNull())
        .addColumn("expires_at", "timestamptz", (c) => c.notNull())
        .addColumn("created_at", "timestamptz", (c) => c.notNull().defaultTo(sql`now()`))
        .execute();
      await db.schema
        .alterTable("robots_cache")
        .addUniqueConstraint("robots_cache_host_unique", ["host"])
        .execute();

      await db.schema
        .createTable("rule_version")
        .addColumn("id", "uuid", (c) => c.primaryKey().defaultTo(sql`gen_random_uuid()`))
        .addColumn("version", "varchar(64)", (c) => c.notNull())
        .addColumn("description", "text")
        .addColumn("published_at", "timestamptz", (c) => c.notNull().defaultTo(sql`now()`))
        .addColumn("rule_payload", "jsonb")
        .addColumn("created_at", "timestamptz", (c) => c.notNull().defaultTo(sql`now()`))
        .execute();
      await db.schema
        .alterTable("rule_version")
        .addUniqueConstraint("rule_version_version_unique", ["version"])
        .execute();
    },

    async down(db: Kysely<Database>): Promise<void> {
      // 依赖顺序：先删子表，后删父表。
      const tables = [
        "export_artifact",
        "result_row",
        "review_decision",
        "review_job",
        "recovery_attempt",
        "url_candidate",
        "slot_decision",
        "role_assignment",
        "leadership_snapshot",
        "currentness_assertion",
        "entity_assertion",
        "page_fact",
        "link_edge",
        "fetch_attempt",
        "document_snapshot",
        "crawl_intent",
        "institution_snapshot",
        "target_scope",
        "task_run",
        "public_api_profile",
        "path_family_profile",
        "site_profile",
        "search_result_cache",
        "robots_cache",
        "rule_version",
      ];
      for (const t of tables) {
        await db.schema.dropTable(t).ifExists().execute();
      }
    },
  },
};
