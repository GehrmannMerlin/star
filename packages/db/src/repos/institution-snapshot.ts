import type { Kysely } from "kysely";
import type { Database, InstitutionSnapshotRow } from "../schema.js";
import type { InstitutionType } from "@stellaris/contracts";

/**
 * institution_snapshot 仓储（规格 §16.1 / §8.2）。
 * 机构清单冻结；机构抓取失败不删除，仍保留终态记录（规格 §8.2）。
 */
export class InstitutionSnapshotRepository {
  constructor(private readonly db: Kysely<Database>) {}

  /** 为任务批量冻结机构快照。 */
  async addMany(
    taskRunId: string,
    institutions: Array<{
      regionCode: string;
      officialName: string;
      commonName: string | null;
      institutionType: InstitutionType;
      officialEntryUrl: string | null;
      discoverySource: string;
      selectTwoPrimary: boolean;
    }>,
  ): Promise<void> {
    if (institutions.length === 0) {
      return;
    }
    await this.db
      .insertInto("institution_snapshot")
      .values(
        institutions.map((i) => ({
          task_run_id: taskRunId,
          region_code: i.regionCode,
          official_name: i.officialName,
          common_name: i.commonName,
          institution_type: i.institutionType,
          official_entry_url: i.officialEntryUrl,
          discovery_source: i.discoverySource,
          select_two_primary: i.selectTwoPrimary,
          frozen_at: new Date().toISOString(),
        })),
      )
      .onConflict((oc) =>
        oc.columns(["task_run_id", "region_code", "official_name"]).doNothing(),
      )
      .execute();
  }

  /** 按任务列出全部机构（含已终态）。 */
  async listByTask(taskRunId: string): Promise<InstitutionSnapshotRow[]> {
    return this.db
      .selectFrom("institution_snapshot")
      .selectAll()
      .where("task_run_id", "=", taskRunId)
      .orderBy("frozen_at")
      .execute();
  }

  /** 标记机构终态（BLOCKED / FAILED），保留记录并写中文原因。 */
  async markTerminal(
    institutionId: string,
    status: "BLOCKED" | "FAILED",
    reason: string,
  ): Promise<void> {
    await this.db
      .updateTable("institution_snapshot")
      .set({ status, terminal_reason: reason })
      .where("id", "=", institutionId)
      .execute();
  }

  /** 统计任务内机构终态数。 */
  async countByStatus(
    taskRunId: string,
    status: "ACTIVE" | "BLOCKED" | "FAILED",
  ): Promise<number> {
    const row = await this.db
      .selectFrom("institution_snapshot")
      .select((eb) => eb.fn.countAll().as("cnt"))
      .where("task_run_id", "=", taskRunId)
      .where("status", "=", status)
      .executeTakeFirst();
    return Number(row?.cnt ?? 0);
  }
}
