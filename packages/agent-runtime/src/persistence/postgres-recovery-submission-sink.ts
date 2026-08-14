import { createHash } from "node:crypto";
import type {
  RecoverySubmissionPayload,
  RecoverySubmissionSink,
  RecoverySubmitResult,
} from "@stellaris/agent-tools";
import type { AgentRole } from "@stellaris/contracts";
import type {
  RecoverySubmissionRow,
  RecoverySubmissionTable,
} from "@stellaris/db";

/** 持久化 Recovery 所需的 packet / round / skill 身份。 */
export type PostgresRecoverySinkIdentity = {
  packetId: string;
  recoveryRound: number;
  agentRole: AgentRole;
  skill: { name: string; version: string };
};

/** 插入行类型（Generated 列由 DB 生成）。 */
export type RecoverySubmissionInsertRow = Omit<RecoverySubmissionTable, "id" | "created_at">;

/**
 * Sink 依赖的最小仓储形状（可注入：内存 fake 或 Postgres 实现均可）。
 * Postgres 类（@stellaris/db RecoverySubmissionRepository）结构上兼容本接口。
 */
export interface RecoverySubmissionRepositoryPort {
  insertSubmission(row: RecoverySubmissionInsertRow): Promise<RecoverySubmissionRow>;
  getByPacketAndRound(
    packetId: string,
    recoveryRound: number,
  ): Promise<RecoverySubmissionRow | null>;
  listByPacket(packetId: string): Promise<RecoverySubmissionRow[]>;
  latestByPacket(packetId: string): Promise<RecoverySubmissionRow | null>;
}

/** PostgreSQL 唯一冲突错误码。 */
const PG_UNIQUE_VIOLATION = "23505";

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === PG_UNIQUE_VIOLATION
  );
}

export type RecoveryRoundOutcome = "RECOVERED" | "NO_QUALIFIED_URL" | "NEEDS_RECHECK";

/**
 * 确定性 round 摘要：任一 RECOVERED_QUALIFIED_URL → RECOVERED；任一
 * NO_QUALIFIED_URL_AFTER_COMPLETE_SEARCH → NO_QUALIFIED_URL；否则 NEEDS_RECHECK。
 * 只用于历史读取与 latest 推导，不重判语义。
 */
export function recoveryRoundOutcome(payload: RecoverySubmissionPayload): RecoveryRoundOutcome {
  const outcomes = new Set(payload.supplements.map((supplement) => supplement.outcome));
  if (outcomes.has("RECOVERED_QUALIFIED_URL")) return "RECOVERED";
  if (outcomes.has("NO_QUALIFIED_URL_AFTER_COMPLETE_SEARCH")) return "NO_QUALIFIED_URL";
  return "NEEDS_RECHECK";
}

/**
 * PostgreSQL Recovery Supplement Sink（STEP 14）。
 *
 * Freeze 由数据库唯一约束 UNIQUE(packet_id, recovery_round) 强制，不依赖进程锁：
 * - 同包同轮重复提交 → 预检命中 → ALREADY_SUBMITTED；
 * - 并发竞争（预检未命中但 INSERT 唯一冲突）→ 捕获 23505 后重读 → ALREADY_SUBMITTED；
 * - 不同 round 互不覆盖：Round 1 与 Round 2 并存（append-only 历史）。
 *
 * 只负责 store / read / enforce uniqueness；不重新 rank、不修改 PRIMARY、
 * 不触碰 Original Investigator Evidence（证据表仍由 UNIQUE(packet_id) 只读冻结）。
 * payloadHash 与 InMemory sink 一致：sha256 over JSON.stringify(payload)。
 */
export class PostgresRecoverySubmissionSink implements RecoverySubmissionSink {
  constructor(
    private readonly repo: RecoverySubmissionRepositoryPort,
    private readonly identity: PostgresRecoverySinkIdentity,
  ) {}

  async submit(payload: RecoverySubmissionPayload): Promise<RecoverySubmitResult> {
    const payloadHash = createHash("sha256").update(JSON.stringify(payload)).digest("hex");

    const existing = await this.repo.getByPacketAndRound(
      this.identity.packetId,
      this.identity.recoveryRound,
    );
    if (existing) {
      return { status: "ALREADY_SUBMITTED", payloadHash: existing.payload_hash };
    }

    try {
      await this.repo.insertSubmission({
        packet_id: this.identity.packetId,
        recovery_round: this.identity.recoveryRound,
        agent_session_id: null,
        agent_role: this.identity.agentRole,
        skill_name: this.identity.skill.name,
        skill_version: this.identity.skill.version,
        canonical_schema: "recovery-record.schema.json",
        payload,
        payload_hash: payloadHash,
        round_outcome: recoveryRoundOutcome(payload),
        frozen_at: new Date().toISOString(),
      });
      return { status: "ACCEPTED", payloadHash };
    } catch (error) {
      if (isUniqueViolation(error)) {
        const raced = await this.repo.getByPacketAndRound(
          this.identity.packetId,
          this.identity.recoveryRound,
        );
        if (raced) {
          return { status: "ALREADY_SUBMITTED", payloadHash: raced.payload_hash };
        }
      }
      throw error;
    }
  }

  async getSubmission(): Promise<RecoverySubmissionPayload | null> {
    const row = await this.repo.getByPacketAndRound(
      this.identity.packetId,
      this.identity.recoveryRound,
    );
    if (!row) return null;
    return row.payload as RecoverySubmissionPayload;
  }

  async isFrozen(): Promise<boolean> {
    const row = await this.repo.getByPacketAndRound(
      this.identity.packetId,
      this.identity.recoveryRound,
    );
    return row !== null;
  }
}
