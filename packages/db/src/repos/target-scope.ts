import type { Kysely } from "kysely";
import type { Database, TargetScopeRow } from "../schema.js";

/**
 * target_scope 仓储（规格 §16.1 范围层）。
 * 任务创建后冻结范围快照；后续行政区数据更新不改变正在运行的任务（规格 §8.1）。
 */
export class TargetScopeRepository {
  constructor(private readonly db: Kysely<Database>) {}

  /** 为任务批量写入行政区范围（冻结快照）。 */
  async addMany(
    taskRunId: string,
    scopes: Array<{
      regionCode: string;
      regionName: string;
      parentRegionCode: string | null;
      regionLevel: string;
      included: boolean;
    }>,
  ): Promise<void> {
    if (scopes.length === 0) {
      return;
    }
    await this.db
      .insertInto("target_scope")
      .values(
        scopes.map((s) => ({
          task_run_id: taskRunId,
          region_code: s.regionCode,
          region_name: s.regionName,
          parent_region_code: s.parentRegionCode,
          region_level: s.regionLevel,
          included: s.included,
        })),
      )
      .onConflict((oc) =>
        oc.columns(["task_run_id", "region_code"]).doNothing(),
      )
      .execute();
  }

  /** 按任务查询范围。 */
  async listByTask(taskRunId: string): Promise<TargetScopeRow[]> {
    return this.db
      .selectFrom("target_scope")
      .selectAll()
      .where("task_run_id", "=", taskRunId)
      .orderBy("region_code")
      .execute();
  }
}
