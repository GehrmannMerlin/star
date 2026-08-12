import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sql } from "kysely";
import { createDb } from "./client.js";
import { MIGRATION_003_TASK_OWNER } from "./migration-003-task-owner.js";
import { migrateToLatest } from "./migrate.js";
import { TaskRunRepository } from "./repos/task-run.js";
import { startPostgres, type StartedPostgres } from "./testing/pg.js";

let pg: StartedPostgres;
let db: ReturnType<typeof createDb>;

beforeAll(async () => {
  pg = await startPostgres();
  db = createDb(pg.config);
  await migrateToLatest(db);
}, 120_000);

afterAll(async () => {
  await db.destroy();
  await pg.stop();
});

describe("task ownership boundary", () => {
  it("isolates idempotency, lookup, listing, and counts by owner", async () => {
    const repo = new TaskRunRepository(db);
    const a = await repo.createWithIdempotency({
      ownerUserId: "user-a",
      idempotencyKey: "same-key",
      mode: "TARGETED",
      expandLevel: "COUNTY",
      ruleVersion: "v1",
    });
    const b = await repo.createWithIdempotency({
      ownerUserId: "user-b",
      idempotencyKey: "same-key",
      mode: "TARGETED",
      expandLevel: "COUNTY",
      ruleVersion: "v1",
    });

    expect(a.id).not.toBe(b.id);
    expect(await repo.findByIdForOwner(a.id, "user-a")).toBeDefined();
    expect(await repo.findByIdForOwner(a.id, "user-b")).toBeUndefined();
    expect(
      await repo.listRecent({ ownerUserId: "user-a", limit: 20, offset: 0 }),
    ).toHaveLength(1);
    expect(await repo.count({ ownerUserId: "user-b" })).toBe(1);
  });

  it("preserves duplicate owner-scoped tasks when migration 003 is downgraded", async () => {
    const repo = new TaskRunRepository(db);
    const a = await repo.createWithIdempotency({
      ownerUserId: "downgrade-user-a",
      idempotencyKey: "downgrade-key",
      mode: "TARGETED",
      expandLevel: "COUNTY",
      ruleVersion: "v1",
    });
    const b = await repo.createWithIdempotency({
      ownerUserId: "downgrade-user-b",
      idempotencyKey: "downgrade-key",
      mode: "TARGETED",
      expandLevel: "COUNTY",
      ruleVersion: "v1",
    });

    const down = MIGRATION_003_TASK_OWNER.migration.down;
    expect(down).toBeDefined();
    await down!(db);

    const downgraded = await sql<{ id: string; idempotency_key: string }>`
      SELECT id, idempotency_key
      FROM task_run
      WHERE id IN (${a.id}::uuid, ${b.id}::uuid)
      ORDER BY id
    `.execute(db);
    const rows = downgraded.rows;

    expect(rows).toHaveLength(2);
    expect(new Set(rows.map((row) => row.id))).toEqual(new Set([a.id, b.id]));
    expect(new Set(rows.map((row) => row.idempotency_key))).toEqual(
      new Set([`${a.id}:downgrade-key`, `${b.id}:downgrade-key`]),
    );
    expect(rows[0]!.idempotency_key).not.toBe(rows[1]!.idempotency_key);

    await expect(sql`
      INSERT INTO task_run (idempotency_key, mode, expand_level, status, rule_version)
      VALUES (${rows[0]!.idempotency_key}, 'TARGETED', 'COUNTY', 'PENDING', 'v1')
    `.execute(db)).rejects.toThrow(/task_run_idempotency_key_unique/);
  });
});
