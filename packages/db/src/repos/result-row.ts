import type { Kysely } from "kysely";
import type { Database } from "../schema.js";
import type { ResultRowRow } from "../types.js";
import type { Slot } from "@stellaris/contracts";

/**
 * result_row 仓储（规格 §16.4 输出层）。
 * 同任务/机构/槽位只有一个当前结果（规格 §16.6 不变量 1）。
 * 非空 position_url 必须引用通过的 Reviewer 决策、空 URL 必须有中文原因——由 DB 触发器强制。
 */
export class ResultRowRepository {
  constructor(private readonly db: Kysely<Database>) {}

  /** 幂等写入当前结果（同任务/机构/槽位唯一）。 */
  async upsertCurrentResult(input: {
    taskRunId: string;
    institutionSnapshotId: string;
    slot: Slot;
    regionCode: string;
    province?: string | null;
    city?: string | null;
    county?: string | null;
    town?: string | null;
    institutionName: string;
    positionDisplay: string;
    personName: string | null;
    currentStatusZh: string;
    positionUrl: string | null;
    pageTypeZh: string | null;
    resultZh: string;
    collectedAt: string;
  }): Promise<ResultRowRow> {
    const values = {
      task_run_id: input.taskRunId,
      institution_snapshot_id: input.institutionSnapshotId,
      slot: input.slot,
      region_code: input.regionCode,
      province: input.province ?? null,
      city: input.city ?? null,
      county: input.county ?? null,
      town: input.town ?? null,
      institution_name: input.institutionName,
      position_display: input.positionDisplay,
      person_name: input.personName,
      current_status_zh: input.currentStatusZh,
      position_url: input.positionUrl,
      page_type_zh: input.pageTypeZh,
      result_zh: input.resultZh,
      collected_at: input.collectedAt,
    };
    return this.db
      .insertInto("result_row")
      .values(values)
      .onConflict((oc) =>
        oc.columns(["task_run_id", "institution_snapshot_id", "slot"]).doUpdateSet(values),
      )
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  /** 按任务列出全部结果行。 */
  async listByTask(taskRunId: string): Promise<ResultRowRow[]> {
    return this.db
      .selectFrom("result_row")
      .selectAll()
      .where("task_run_id", "=", taskRunId)
      .orderBy("slot")
      .execute();
  }

  /** 按任务/机构/槽位查询。 */
  async getByTaskSlot(
    taskRunId: string,
    institutionSnapshotId: string,
    slot: Slot,
  ): Promise<ResultRowRow | undefined> {
    return this.db
      .selectFrom("result_row")
      .selectAll()
      .where("task_run_id", "=", taskRunId)
      .where("institution_snapshot_id", "=", institutionSnapshotId)
      .where("slot", "=", slot)
      .executeTakeFirst();
  }
}
