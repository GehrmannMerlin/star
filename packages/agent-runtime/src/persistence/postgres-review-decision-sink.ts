import { createHash } from "node:crypto";
import type {
  ReviewerDecisionSink,
  ReviewerDecisionSubmitResult,
  ReviewerSubmissionPayload,
} from "@stellaris/agent-tools";
import type { AgentRole } from "@stellaris/contracts";
import type {
  ReviewDecisionSubmissionRow,
  ReviewDecisionSubmissionTable,
} from "@stellaris/db";

/** 持久化 Review 所需的 packet / round / skill 身份。 */
export type PostgresReviewSinkIdentity = {
  packetId: string;
  reviewRound: number;
  agentRole: AgentRole;
  skill: { name: string; version: string };
};

/** 插入行类型（Generated 列由 DB 生成）。 */
export type ReviewDecisionSubmissionInsertRow = Omit<
  ReviewDecisionSubmissionTable,
  "id" | "created_at"
>;

/**
 * Sink 依赖的最小仓储形状（可注入：内存 fake 或 Postgres 实现均可）。
 * Postgres 类（@stellaris/db ReviewDecisionSubmissionRepository）结构上兼容本接口。
 */
export interface ReviewDecisionSubmissionRepositoryPort {
  insertSubmission(
    row: ReviewDecisionSubmissionInsertRow,
  ): Promise<ReviewDecisionSubmissionRow>;
  getByPacketAndRound(
    packetId: string,
    reviewRound: number,
  ): Promise<ReviewDecisionSubmissionRow | null>;
  listByPacket(packetId: string): Promise<ReviewDecisionSubmissionRow[]>;
  latestByPacket(packetId: string): Promise<ReviewDecisionSubmissionRow | null>;
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

export type ReviewRoundOutcome = "APPROVED" | "REWORK_REQUIRED" | "REJECTED";

/**
 * 确定性 round 摘要：全部 target APPROVED → APPROVED；任一 REWORK_REQUIRED →
 * REWORK_REQUIRED；否则 REJECTED。只用于历史读取与 latest 推导，不重判语义。
 */
export function reviewRoundOutcome(payload: ReviewerSubmissionPayload): ReviewRoundOutcome {
  if (payload.reviews.every((review) => review.review_result === "APPROVED")) return "APPROVED";
  if (payload.reviews.some((review) => review.review_result === "REWORK_REQUIRED")) {
    return "REWORK_REQUIRED";
  }
  return "REJECTED";
}

/**
 * PostgreSQL Review Decision Sink（STEP 14）。
 *
 * Freeze 由数据库唯一约束 UNIQUE(packet_id, review_round) 强制，不依赖进程锁：
 * - 同包同轮重复提交 → 预检命中 → ALREADY_SUBMITTED；
 * - 并发竞争（预检未命中但 INSERT 唯一冲突）→ 捕获 23505 后重读 → ALREADY_SUBMITTED；
 * - 不同 round 互不覆盖：Round 1 与 Round 2 并存（append-only 历史）。
 *
 * 只负责 store / read / enforce uniqueness；不重新 rank、不修改 PRIMARY、
 * 不做 schema 语义判断（校验仍在现有 Runtime Boundary，即 SkillSchemaRegistry）。
 * payloadHash 与 InMemory sink 一致：sha256 over JSON.stringify(payload)。
 */
export class PostgresReviewDecisionSink implements ReviewerDecisionSink {
  constructor(
    private readonly repo: ReviewDecisionSubmissionRepositoryPort,
    private readonly identity: PostgresReviewSinkIdentity,
  ) {}

  async submit(payload: ReviewerSubmissionPayload): Promise<ReviewerDecisionSubmitResult> {
    const payloadHash = createHash("sha256").update(JSON.stringify(payload)).digest("hex");

    const existing = await this.repo.getByPacketAndRound(
      this.identity.packetId,
      this.identity.reviewRound,
    );
    if (existing) {
      return { status: "ALREADY_SUBMITTED", payloadHash: existing.payload_hash };
    }

    try {
      await this.repo.insertSubmission({
        packet_id: this.identity.packetId,
        review_round: this.identity.reviewRound,
        agent_session_id: null,
        agent_role: this.identity.agentRole,
        skill_name: this.identity.skill.name,
        skill_version: this.identity.skill.version,
        canonical_schema: "review-record.schema.json",
        payload,
        payload_hash: payloadHash,
        round_outcome: reviewRoundOutcome(payload),
        frozen_at: new Date().toISOString(),
      });
      return { status: "ACCEPTED", payloadHash };
    } catch (error) {
      if (isUniqueViolation(error)) {
        const raced = await this.repo.getByPacketAndRound(
          this.identity.packetId,
          this.identity.reviewRound,
        );
        if (raced) {
          return { status: "ALREADY_SUBMITTED", payloadHash: raced.payload_hash };
        }
      }
      throw error;
    }
  }

  async getSubmission(): Promise<ReviewerSubmissionPayload | null> {
    const row = await this.repo.getByPacketAndRound(
      this.identity.packetId,
      this.identity.reviewRound,
    );
    if (!row) return null;
    return row.payload as ReviewerSubmissionPayload;
  }

  async isFrozen(): Promise<boolean> {
    const row = await this.repo.getByPacketAndRound(
      this.identity.packetId,
      this.identity.reviewRound,
    );
    return row !== null;
  }
}
