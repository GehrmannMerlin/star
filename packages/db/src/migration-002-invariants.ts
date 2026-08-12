import type { Kysely } from "kysely";
import type { Migration } from "kysely/migration";
import { sql } from "kysely";
import type { Database } from "./schema.js";

/**
 * 不变量迁移：补齐关键外键、唯一约束、索引与跨表不变量（规格 §16.6 / §15.2 / §23）。
 *
 * 覆盖第一闭环五项不变量：
 * 1. 同任务、机构和槽位只有一个当前结果 —— result_row (task_run_id, institution_snapshot_id, slot) 唯一（迁移1已有）；
 * 2. 非空最终 URL 必须对应通过的独立 Reviewer 决策 —— 触发器 trg_result_row_url_requires_review；
 * 3. 空 URL 必须有中文终态原因 —— 同一触发器对 result_zh 的 NOT NULL/trim 校验；
 * 4. Reviewer 请求不能复用 Collector 请求唯一键 —— review_job.unique_request_key 唯一；
 * 5. 网页和 Excel 只读取同一份已复核 result_row —— 由应用层统一投影（Task 10）+ 上述约束支撑。
 */
export const MIGRATION_002_INVARIANTS: { name: string; migration: Migration } = {
  name: "2026-08-03-invariants",
  migration: {
    async up(db: Kysely<Database>): Promise<void> {
      // ─────────── 外键补齐（迁移1遗漏的 references） ───────────
      await db.schema
        .alterTable("fetch_attempt")
        .addForeignKeyConstraint("fetch_attempt_document_fk", ["document_snapshot_id"], "document_snapshot", ["id"], (c) => c.onDelete("set null"))
        .execute();
      await db.schema
        .alterTable("fetch_attempt")
        .addForeignKeyConstraint("fetch_attempt_intent_fk", ["crawl_intent_id"], "crawl_intent", ["id"], (c) => c.onDelete("set null"))
        .execute();
      await db.schema
        .alterTable("link_edge")
        .addForeignKeyConstraint("link_edge_source_doc_fk", ["source_document_snapshot_id"], "document_snapshot", ["id"], (c) => c.onDelete("cascade"))
        .execute();
      await db.schema
        .alterTable("page_fact")
        .addForeignKeyConstraint("page_fact_doc_fk", ["document_snapshot_id"], "document_snapshot", ["id"], (c) => c.onDelete("cascade"))
        .execute();
      await db.schema
        .alterTable("entity_assertion")
        .addForeignKeyConstraint("entity_assertion_institution_fk", ["institution_id"], "institution_snapshot", ["id"], (c) => c.onDelete("set null"))
        .execute();
      await db.schema
        .alterTable("currentness_assertion")
        .addForeignKeyConstraint("currentness_assertion_institution_fk", ["institution_id"], "institution_snapshot", ["id"], (c) => c.onDelete("set null"))
        .execute();
      await db.schema
        .alterTable("leadership_snapshot")
        .addForeignKeyConstraint("leadership_snapshot_institution_fk", ["institution_snapshot_id"], "institution_snapshot", ["id"], (c) => c.onDelete("cascade"))
        .execute();
      await db.schema
        .alterTable("role_assignment")
        .addForeignKeyConstraint("role_assignment_institution_fk", ["institution_snapshot_id"], "institution_snapshot", ["id"], (c) => c.onDelete("cascade"))
        .execute();
      await db.schema
        .alterTable("slot_decision")
        .addForeignKeyConstraint("slot_decision_institution_fk", ["institution_snapshot_id"], "institution_snapshot", ["id"], (c) => c.onDelete("cascade"))
        .execute();
      await db.schema
        .alterTable("url_candidate")
        .addForeignKeyConstraint("url_candidate_institution_fk", ["institution_snapshot_id"], "institution_snapshot", ["id"], (c) => c.onDelete("set null"))
        .execute();
      await db.schema
        .alterTable("recovery_attempt")
        .addForeignKeyConstraint("recovery_attempt_institution_fk", ["institution_snapshot_id"], "institution_snapshot", ["id"], (c) => c.onDelete("set null"))
        .execute();
      await db.schema
        .alterTable("review_job")
        .addForeignKeyConstraint("review_job_institution_fk", ["institution_snapshot_id"], "institution_snapshot", ["id"], (c) => c.onDelete("set null"))
        .execute();
      await db.schema
        .alterTable("review_decision")
        .addForeignKeyConstraint("review_decision_review_job_fk", ["review_job_id"], "review_job", ["id"], (c) => c.onDelete("cascade"))
        .execute();
      await db.schema
        .alterTable("result_row")
        .addForeignKeyConstraint("result_row_institution_fk", ["institution_snapshot_id"], "institution_snapshot", ["id"], (c) => c.onDelete("cascade"))
        .execute();
      await db.schema
        .alterTable("path_family_profile")
        .addForeignKeyConstraint("path_family_site_fk", ["site_profile_id"], "site_profile", ["id"], (c) => c.onDelete("cascade"))
        .execute();
      await db.schema
        .alterTable("public_api_profile")
        .addForeignKeyConstraint("public_api_site_fk", ["site_profile_id"], "site_profile", ["id"], (c) => c.onDelete("cascade"))
        .execute();

      // ─────────── 唯一约束 ───────────
      // Reviewer 请求唯一键：不得复用 Collector 键（规格 §15.2 / §16.6）
      await db.schema
        .alterTable("review_job")
        .addUniqueConstraint("review_job_unique_request_key_unique", ["unique_request_key"])
        .execute();

      // 导出记录同任务同文件幂等（规格 §18.4）
      await db.schema
        .alterTable("export_artifact")
        .addUniqueConstraint("export_artifact_task_filename_unique", ["task_run_id", "filename"])
        .execute();

      // 机构快照按行政区去重（多行政区模块：每行政区冻结各自机构，不跨区重复）
      await db.schema
        .alterTable("institution_snapshot")
        .addUniqueConstraint("institution_snapshot_task_region_name_unique", ["task_run_id", "region_code", "official_name"])
        .execute();

      // ─────────── 查询路径索引 ───────────
      await db.schema
        .createIndex("idx_fetch_attempt_task")
        .on("fetch_attempt")
        .column("task_run_id")
        .execute();
      await db.schema
        .createIndex("idx_fetch_attempt_canonical")
        .on("fetch_attempt")
        .column("canonical_key")
        .execute();
      await db.schema
        .createIndex("idx_review_decision_review_job")
        .on("review_decision")
        .column("review_job_id")
        .execute();
      await db.schema
        .createIndex("idx_result_row_task_institution")
        .on("result_row")
        .columns(["task_run_id", "institution_snapshot_id"])
        .execute();
      await db.schema
        .createIndex("idx_institution_snapshot_task")
        .on("institution_snapshot")
        .column("task_run_id")
        .execute();

      // ─────────── 不变量触发器 ───────────
      await sql`
        CREATE OR REPLACE FUNCTION fn_result_row_url_requires_review() RETURNS trigger AS $$
        BEGIN
          IF NEW.position_url IS NOT NULL THEN
            IF NOT EXISTS (
              SELECT 1 FROM review_decision rd
              WHERE rd.task_run_id = NEW.task_run_id
                AND rd.url = NEW.position_url
                AND rd.decision = 'MATCH'
            ) THEN
              RAISE EXCEPTION 'result_row.position_url 必须引用通过的 Reviewer 决策 (MATCH)';
            END IF;
          ELSE
            IF NEW.result_zh IS NULL OR length(trim(NEW.result_zh)) = 0 THEN
              RAISE EXCEPTION '空 position_url 必须有中文终态原因 result_zh';
            END IF;
          END IF;
          RETURN NEW;
        END $$ LANGUAGE plpgsql;
      `.execute(db);
      await sql`
        CREATE TRIGGER trg_result_row_url_requires_review
          BEFORE INSERT OR UPDATE OF position_url, result_zh ON result_row
          FOR EACH ROW EXECUTE FUNCTION fn_result_row_url_requires_review();
      `.execute(db);
    },

    async down(db: Kysely<Database>): Promise<void> {
      await sql`DROP TRIGGER IF EXISTS trg_result_row_url_requires_review ON result_row`.execute(db);
      await sql`DROP FUNCTION IF EXISTS fn_result_row_url_requires_review()`.execute(db);
      await db.schema.dropIndex("idx_institution_snapshot_task").ifExists().execute();
      await db.schema.dropIndex("idx_result_row_task_institution").ifExists().execute();
      await db.schema.dropIndex("idx_review_decision_review_job").ifExists().execute();
      await db.schema.dropIndex("idx_fetch_attempt_canonical").ifExists().execute();
      await db.schema.dropIndex("idx_fetch_attempt_task").ifExists().execute();
      await db.schema.alterTable("review_job").dropConstraint("review_job_unique_request_key_unique").execute();
      await db.schema.alterTable("export_artifact").dropConstraint("export_artifact_task_filename_unique").execute();
      await db.schema.alterTable("institution_snapshot").dropConstraint("institution_snapshot_task_region_name_unique").execute();
      await db.schema.alterTable("public_api_profile").dropConstraint("public_api_site_fk").execute();
      await db.schema.alterTable("path_family_profile").dropConstraint("path_family_site_fk").execute();
      await db.schema.alterTable("result_row").dropConstraint("result_row_institution_fk").execute();
      await db.schema.alterTable("review_decision").dropConstraint("review_decision_review_job_fk").execute();
      await db.schema.alterTable("review_job").dropConstraint("review_job_institution_fk").execute();
      await db.schema.alterTable("recovery_attempt").dropConstraint("recovery_attempt_institution_fk").execute();
      await db.schema.alterTable("url_candidate").dropConstraint("url_candidate_institution_fk").execute();
      await db.schema.alterTable("slot_decision").dropConstraint("slot_decision_institution_fk").execute();
      await db.schema.alterTable("role_assignment").dropConstraint("role_assignment_institution_fk").execute();
      await db.schema.alterTable("leadership_snapshot").dropConstraint("leadership_snapshot_institution_fk").execute();
      await db.schema.alterTable("currentness_assertion").dropConstraint("currentness_assertion_institution_fk").execute();
      await db.schema.alterTable("entity_assertion").dropConstraint("entity_assertion_institution_fk").execute();
      await db.schema.alterTable("page_fact").dropConstraint("page_fact_doc_fk").execute();
      await db.schema.alterTable("link_edge").dropConstraint("link_edge_source_doc_fk").execute();
      await db.schema.alterTable("fetch_attempt").dropConstraint("fetch_attempt_intent_fk").execute();
      await db.schema.alterTable("fetch_attempt").dropConstraint("fetch_attempt_document_fk").execute();
    },
  },
};
