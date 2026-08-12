import type { Kysely } from "kysely";
import type { Database } from "../schema.js";
import type { SlotDecisionRow } from "../types.js";
import type { Slot } from "@stellaris/contracts";

/**
 * slot_decision 仓储（规格 §16.4 业务层）。
 * 同任务/机构/槽位唯一（规格 §16.6：两名主要自然人槽位）。
 */
export class SlotDecisionRepository {
  constructor(private readonly db: Kysely<Database>) {}

  /** 幂等写入槽位决策；已存在则更新。 */
  async upsertSlot(input: {
    taskRunId: string;
    institutionSnapshotId: string;
    slot: Slot;
    personName: string | null;
    status: "FILLED" | "VACANT" | "UNCONFIRMED";
  }): Promise<SlotDecisionRow> {
    return this.db
      .insertInto("slot_decision")
      .values({
        task_run_id: input.taskRunId,
        institution_snapshot_id: input.institutionSnapshotId,
        slot: input.slot,
        person_name: input.personName,
        status: input.status,
      })
      .onConflict((oc) =>
        oc.columns(["task_run_id", "institution_snapshot_id", "slot"]).doUpdateSet({
          person_name: input.personName,
          status: input.status,
        }),
      )
      .returningAll()
      .executeTakeFirstOrThrow();
  }
}
