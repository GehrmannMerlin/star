import type { Kysely } from "kysely";
import type { Database } from "../schema.js";
import type { LeadershipSnapshotRow, RoleAssignmentRow } from "../types.js";

/**
 * leadership 仓储（规格 §16.4 业务层）。
 * 完整领导结构先于两人选择产生（规格 §13.3）。
 */
export class LeadershipRepository {
  constructor(private readonly db: Kysely<Database>) {}

  /** 保存完整领导结构（jsonb）。 */
  async saveLeadership(input: {
    taskRunId: string;
    institutionSnapshotId: string;
    leadershipJson: unknown;
  }): Promise<LeadershipSnapshotRow> {
    return this.db
      .insertInto("leadership_snapshot")
      .values({
        task_run_id: input.taskRunId,
        institution_snapshot_id: input.institutionSnapshotId,
        leadership_json: JSON.stringify(input.leadershipJson),
      })
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  /** 批量写入岗位分配。 */
  async addRoleAssignments(
    taskRunId: string,
    institutionSnapshotId: string,
    assignments: Array<{
      personName: string;
      officialRole: string;
      sortOrder: number | null;
      attribute: "full_time" | "acting" | "presiding" | "none";
    }>,
  ): Promise<RoleAssignmentRow[]> {
    if (assignments.length === 0) {
      return [];
    }
    return this.db
      .insertInto("role_assignment")
      .values(
        assignments.map((a) => ({
          task_run_id: taskRunId,
          institution_snapshot_id: institutionSnapshotId,
          person_name: a.personName,
          official_role: a.officialRole,
          sort_order: a.sortOrder,
          attribute: a.attribute,
        })),
      )
      .returningAll()
      .execute();
  }
}
