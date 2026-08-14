import type { Insertable, Kysely } from "kysely";
import type { Database } from "../schema.js";
import type { ReviewDecisionSubmissionRow } from "../types.js";

/**
 * review_decision_submission 仓储（STEP 14 复核持久层）。
 *
 * 只负责 store / read / enforce uniqueness；不重新解释 Review 语义。
 * 数据库唯一约束 (packet_id, review_round) 保证同包同轮 Review 只能冻结一次，
 * append-only：Round 1 不被 Round 2 覆盖。唯一冲突以原生 pg 错误（code 23505）
 * 抛出，由上层 Sink 映射为领域错误。
 */
export class ReviewDecisionSubmissionRepository {
  constructor(private readonly db: Kysely<Database>) {}

  /** 冻结一条 Review Decision Submission（同包同轮重复时抛唯一冲突）。 */
  async insertSubmission(
    row: Insertable<Database["review_decision_submission"]>,
  ): Promise<ReviewDecisionSubmissionRow> {
    return this.db
      .insertInto("review_decision_submission")
      .values({ ...row, payload: JSON.stringify(row.payload) })
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  /** 按逻辑 packet + round 读取已冻结 Review。 */
  async getByPacketAndRound(
    packetId: string,
    reviewRound: number,
  ): Promise<ReviewDecisionSubmissionRow | null> {
    const row = await this.db
      .selectFrom("review_decision_submission")
      .selectAll()
      .where("packet_id", "=", packetId)
      .where("review_round", "=", reviewRound)
      .executeTakeFirst();
    return row ?? null;
  }

  /** 该 Packet 的完整 Review 历史（append-only，按 round 升序）。 */
  async listByPacket(packetId: string): Promise<ReviewDecisionSubmissionRow[]> {
    return this.db
      .selectFrom("review_decision_submission")
      .selectAll()
      .where("packet_id", "=", packetId)
      .orderBy("review_round", "asc")
      .execute();
  }

  /** 该 Packet 的最近一次 Review（最高 round）。 */
  async latestByPacket(packetId: string): Promise<ReviewDecisionSubmissionRow | null> {
    const row = await this.db
      .selectFrom("review_decision_submission")
      .selectAll()
      .where("packet_id", "=", packetId)
      .orderBy("review_round", "desc")
      .limit(1)
      .executeTakeFirst();
    return row ?? null;
  }
}
