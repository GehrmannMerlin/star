import type { Kysely } from "kysely";
import type { Migration } from "kysely/migration";
import { sql } from "kysely";
import type { Database } from "./schema.js";

/** Scope task idempotency and recent-task access to the owning user. */
export const MIGRATION_003_TASK_OWNER: { name: string; migration: Migration } = {
  name: "2026-08-11-task-owner",
  migration: {
    async up(db: Kysely<Database>): Promise<void> {
      await sql`ALTER TABLE task_run ADD COLUMN owner_user_id text`.execute(db);
      await sql`UPDATE task_run SET owner_user_id = '__legacy__' WHERE owner_user_id IS NULL`.execute(db);
      await sql`ALTER TABLE task_run ALTER COLUMN owner_user_id SET NOT NULL`.execute(db);
      await sql`ALTER TABLE task_run DROP CONSTRAINT task_run_idempotency_key_unique`.execute(db);
      await sql`
        ALTER TABLE task_run ADD CONSTRAINT task_run_owner_idempotency_key_unique
          UNIQUE (owner_user_id, idempotency_key)
      `.execute(db);
      await sql`
        CREATE INDEX idx_task_run_owner_requested_at
          ON task_run (owner_user_id, requested_at DESC)
      `.execute(db);
    },

    async down(db: Kysely<Database>): Promise<void> {
      await sql`DROP INDEX idx_task_run_owner_requested_at`.execute(db);
      await sql`ALTER TABLE task_run DROP CONSTRAINT task_run_owner_idempotency_key_unique`.execute(db);
      // Explicit downgrade preserves every task by making formerly owner-scoped
      // keys globally unique. Retrying an original pre-downgrade key therefore
      // creates a new task under the legacy schema.
      await sql`ALTER TABLE task_run ALTER COLUMN idempotency_key TYPE text`.execute(db);
      await sql`
        UPDATE task_run
        SET idempotency_key = id::text || ':' || idempotency_key
      `.execute(db);
      await sql`
        ALTER TABLE task_run ADD CONSTRAINT task_run_idempotency_key_unique
          UNIQUE (idempotency_key)
      `.execute(db);
      await sql`ALTER TABLE task_run DROP COLUMN owner_user_id`.execute(db);
    },
  },
};
