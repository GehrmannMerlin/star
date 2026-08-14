import type { Insertable, Kysely } from "kysely";
import type { Database } from "../schema.js";
import type { RecoverySubmissionRow } from "../types.js";

/**
 * recovery_submission 仓储（STEP 14 复核持久层）。
 *
 * 只负责 store / read / enforce uniqueness；不重新解释 Recovery 语义。
 * 数据库唯一约束 (packet_id, recovery_round) 保证同包同轮 Recovery Supplement
 * 只能冻结一次，append-only：Round 1 不可覆盖。唯一冲突以原生 pg 错误（code
 * 23505）抛出，由上层 Sink 映射为领域错误。
 */
export class RecoverySubmissionRepository {
  constructor(private readonly db: Kysely<Database>) {}

  /** 冻结一条 Recovery Supplement（同包同轮重复时抛唯一冲突）。 */
  async insertSubmission(
    row: Insertable<Database["recovery_submission"]>,
  ): Promise<RecoverySubmissionRow> {
    return this.db
      .insertInto("recovery_submission")
      .values({ ...row, payload: JSON.stringify(row.payload) })
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  /** 按逻辑 packet + round 读取已冻结 Recovery Supplement。 */
  async getByPacketAndRound(
    packetId: string,
    recoveryRound: number,
  ): Promise<RecoverySubmissionRow | null> {
    const row = await this.db
      .selectFrom("recovery_submission")
      .selectAll()
      .where("packet_id", "=", packetId)
      .where("recovery_round", "=", recoveryRound)
      .executeTakeFirst();
    return row ?? null;
  }

  /** 该 Packet 的完整 Recovery 历史（append-only，按 round 升序）。 */
  async listByPacket(packetId: string): Promise<RecoverySubmissionRow[]> {
    return this.db
      .selectFrom("recovery_submission")
      .selectAll()
      .where("packet_id", "=", packetId)
      .orderBy("recovery_round", "asc")
      .execute();
  }

  /** 该 Packet 的最近一次 Recovery Submission（最高 round）。 */
  async latestByPacket(packetId: string): Promise<RecoverySubmissionRow | null> {
    const row = await this.db
      .selectFrom("recovery_submission")
      .selectAll()
      .where("packet_id", "=", packetId)
      .orderBy("recovery_round", "desc")
      .limit(1)
      .executeTakeFirst();
    return row ?? null;
  }
}
