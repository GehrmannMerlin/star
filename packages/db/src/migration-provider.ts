import type { Migration, MigrationProvider } from "kysely/migration";
import { MIGRATION_001_INITIAL } from "./migration-001-initial.js";
import { MIGRATION_002_INVARIANTS } from "./migration-002-invariants.js";
import { MIGRATION_003_TASK_OWNER } from "./migration-003-task-owner.js";
import { MIGRATION_004_AGENT_PERSISTENCE } from "./migration-004-agent-persistence.js";
import { MIGRATION_005_RECOVERY_REREVIEW_PERSISTENCE } from "./migration-005-recovery-rereview-persistence.js";
import { MIGRATION_006_WORK_PACKET_PERSISTENCE } from "./migration-006-work-packet-persistence.js";

/** 按文件顺序组织的迁移。 */
export interface MigrationEntry {
  name: string;
  migration: Migration;
}

export const MIGRATIONS: MigrationEntry[] = [
  { name: MIGRATION_001_INITIAL.name, migration: MIGRATION_001_INITIAL.migration },
  { name: MIGRATION_002_INVARIANTS.name, migration: MIGRATION_002_INVARIANTS.migration },
  { name: MIGRATION_003_TASK_OWNER.name, migration: MIGRATION_003_TASK_OWNER.migration },
  { name: MIGRATION_004_AGENT_PERSISTENCE.name, migration: MIGRATION_004_AGENT_PERSISTENCE.migration },
  {
    name: MIGRATION_005_RECOVERY_REREVIEW_PERSISTENCE.name,
    migration: MIGRATION_005_RECOVERY_REREVIEW_PERSISTENCE.migration,
  },
  {
    name: MIGRATION_006_WORK_PACKET_PERSISTENCE.name,
    migration: MIGRATION_006_WORK_PACKET_PERSISTENCE.migration,
  },
];

/**
 * Kysely MigrationProvider。
 * 迁移文件内容见 ./migration-001-initial.js。
 */
export const migrationProvider: MigrationProvider = {
  async getMigrations(): Promise<Record<string, Migration>> {
    const map: Record<string, Migration> = {};
    for (const entry of MIGRATIONS) {
      map[entry.name] = entry.migration;
    }
    return map;
  },
};

/** 待迁移的最新目标版本名（用于迁移工具）。 */
export const LATEST_MIGRATION_NAME = MIGRATIONS.at(-1)?.name ?? "";
