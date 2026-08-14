import type { Insertable, Kysely } from "kysely";
import type { Database } from "../schema.js";
import type { InvestigatorEvidenceSubmissionRow } from "../types.js";

/**
 * investigator_evidence_submission 仓储（STEP 11 Agent 持久层）。
 *
 * 只负责 store / read / enforce uniqueness；不重新解释 Evidence 语义。
 * 数据库唯一约束 (packet_id) 保证同一 Packet 的 Evidence Submission 只能冻结一次。
 * 唯一冲突以原生 pg 错误（code 23505）抛出，由上层 Sink 映射为领域错误。
 */
export class InvestigatorEvidenceSubmissionRepository {
  constructor(private readonly db: Kysely<Database>) {}

  /** 冻结一条 Evidence Submission（packet_id 重复时抛唯一冲突）。 */
  async insertSubmission(
    row: Insertable<Database["investigator_evidence_submission"]>,
  ): Promise<InvestigatorEvidenceSubmissionRow> {
    return this.db
      .insertInto("investigator_evidence_submission")
      .values({ ...row, payload: JSON.stringify(row.payload) })
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  /** 按逻辑 packet 身份读取已冻结提交。 */
  async getSubmissionByPacketId(
    packetId: string,
  ): Promise<InvestigatorEvidenceSubmissionRow | null> {
    const row = await this.db
      .selectFrom("investigator_evidence_submission")
      .selectAll()
      .where("packet_id", "=", packetId)
      .executeTakeFirst();
    return row ?? null;
  }

  /** 该 Packet 是否已冻结。 */
  async isFrozen(packetId: string): Promise<boolean> {
    const row = await this.db
      .selectFrom("investigator_evidence_submission")
      .select("id")
      .where("packet_id", "=", packetId)
      .executeTakeFirst();
    return row !== undefined;
  }
}
