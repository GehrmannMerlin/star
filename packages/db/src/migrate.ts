import type { Kysely } from "kysely";
import { Migrator } from "kysely/migration";
import type { Database } from "./schema.js";
import { migrationProvider } from "./migration-provider.js";

export interface MigrateResult {
  ok: boolean;
  /** 已执行迁移名列表（本次运行）。 */
  executed: string[];
  /** 全部迁移名列表。 */
  all: string[];
  error?: unknown;
}

/**
 * 将数据库迁移到最新版本（幂等：已执行的迁移跳过）。
 * 供集成验证与部署入口调用。
 */
export async function migrateToLatest(
  db: Kysely<Database>,
): Promise<MigrateResult> {
  const migrator = new Migrator({ db, provider: migrationProvider });
  const result = await migrator.migrateToLatest();

  const executed = result.results
    ?.filter((r) => r.status === "Success")
    .map((r) => r.migrationName) ?? [];

  const all = result.results?.map((r) => r.migrationName) ?? [];

  if (result.error) {
    return { ok: false, executed, all, error: result.error };
  }

  return { ok: true, executed, all };
}

/** 回滚一个最近迁移（集成验证失败时清理用，谨慎调用）。 */
export async function migrateDown(
  db: Kysely<Database>,
): Promise<MigrateResult> {
  const migrator = new Migrator({ db, provider: migrationProvider });
  const result = await migrator.migrateDown();

  const executed = result.results
    ?.filter((r) => r.status === "Success")
    .map((r) => r.migrationName) ?? [];
  const all = result.results?.map((r) => r.migrationName) ?? [];

  if (result.error) {
    return { ok: false, executed, all, error: result.error };
  }
  return { ok: true, executed, all };
}
