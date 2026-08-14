import type { Insertable, Kysely } from "kysely";
import type { Database } from "../schema.js";
import type { InstitutionWorkPacketRow } from "../types.js";

/**
 * institution_work_packet 仓储（STEP 15 Persistent Work Packet）。
 *
 * 只负责 store / read；不重新解释 Packet 状态机（合法 transition 由
 * agent-runtime 的 ALLOWED_TRANSITIONS 拒绝，Store 只是存储）。packet_id 为
 * 逻辑身份（text PK）；唯一冲突以原生 pg 错误（code 23505）抛出。
 *
 * 绝不写入 Raw Artifact：Leadership / Candidate Pool / Review / Recovery
 * 载荷各自已有 SSoT，本仓储只持久化 Packet 编排/状态 identity 与两个
 * PRIMARY 人员的身份。
 */
export class InstitutionWorkPacketRepository {
  constructor(private readonly db: Kysely<Database>) {}

  /** 持久化一个新 Packet（同 packet_id 重复时抛唯一冲突）。 */
  async insert(
    row: Insertable<Database["institution_work_packet"]>,
  ): Promise<InstitutionWorkPacketRow> {
    return this.db
      .insertInto("institution_work_packet")
      .values(row)
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  /** 按逻辑 packet 身份读取。 */
  async getByPacketId(packetId: string): Promise<InstitutionWorkPacketRow | null> {
    const row = await this.db
      .selectFrom("institution_work_packet")
      .selectAll()
      .where("packet_id", "=", packetId)
      .executeTakeFirst();
    return row ?? null;
  }

  /** 全部 Packet（协调器/批量读取）。 */
  async list(): Promise<InstitutionWorkPacketRow[]> {
    return this.db
      .selectFrom("institution_work_packet")
      .selectAll()
      .orderBy("created_at", "asc")
      .execute();
  }

  /**
   * 更新 Packet 状态位与编排元数据（state / investigator_session_id /
   * failure_code / updated_at）。调用方负责先校验合法 transition。
   */
  async updatePacket(
    packetId: string,
    patch: {
      state?: string;
      investigatorSessionId?: string | null;
      failureCode?: string | null;
      updatedAt: string;
    },
  ): Promise<InstitutionWorkPacketRow> {
    return this.db
      .updateTable("institution_work_packet")
      .set({
        ...(patch.state !== undefined ? { state: patch.state } : {}),
        ...(patch.investigatorSessionId !== undefined
          ? { investigator_session_id: patch.investigatorSessionId }
          : {}),
        ...(patch.failureCode !== undefined ? { failure_code: patch.failureCode } : {}),
        updated_at: patch.updatedAt,
      })
      .where("packet_id", "=", packetId)
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  /** 更新两个 PRIMARY 人员身份（target/person id/name，不影响 state）。 */
  async updatePrimaryPersons(
    packetId: string,
    patch: {
      primary1: {
        targetId: string | null;
        personId: string | null;
        personName: string | null;
      };
      primary2: {
        targetId: string | null;
        personId: string | null;
        personName: string | null;
      };
      updatedAt: string;
    },
  ): Promise<InstitutionWorkPacketRow> {
    return this.db
      .updateTable("institution_work_packet")
      .set({
        primary1_target_id: patch.primary1.targetId,
        primary1_person_id: patch.primary1.personId,
        primary1_person_name: patch.primary1.personName,
        primary2_target_id: patch.primary2.targetId,
        primary2_person_id: patch.primary2.personId,
        primary2_person_name: patch.primary2.personName,
        updated_at: patch.updatedAt,
      })
      .where("packet_id", "=", packetId)
      .returningAll()
      .executeTakeFirstOrThrow();
  }
}
