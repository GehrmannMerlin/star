import { createHash } from "node:crypto";
import type {
  InvestigatorEvidenceSubmissionPayload,
  InvestigatorEvidenceSubmissionSink,
  InvestigatorEvidenceSubmitResult,
} from "@stellaris/agent-tools";
import type { AgentRole } from "@stellaris/contracts";
import type {
  InvestigatorEvidenceSubmissionRow,
  InvestigatorEvidenceSubmissionTable,
} from "@stellaris/db";

export const URL_CANDIDATE_POOL_SCHEMA_NAME = "url-candidate-pool.schema.json";
export const TARGET_CLAIM_SCHEMA_NAME = "target-claim.schema.json";

/** 持久化 Evidence 所需的 packet / session / skill 身份。 */
export type PostgresEvidenceSinkIdentity = {
  packetId: string;
  agentSessionId: string;
  agentRole: AgentRole;
  skill: { name: string; version: string };
};

/** 插入行类型（Generated 列由 DB 生成）。 */
export type EvidenceSubmissionInsertRow = Omit<
  InvestigatorEvidenceSubmissionTable,
  "id" | "created_at"
>;

/**
 * Sink 依赖的最小仓储形状（可注入：内存 fake 或 Postgres 实现均可）。
 * Postgres 类（@stellaris/db InvestigatorEvidenceSubmissionRepository）结构上兼容本接口。
 */
export interface InvestigatorEvidenceSubmissionRepositoryPort {
  insertSubmission(row: EvidenceSubmissionInsertRow): Promise<InvestigatorEvidenceSubmissionRow>;
  getSubmissionByPacketId(packetId: string): Promise<InvestigatorEvidenceSubmissionRow | null>;
  isFrozen(packetId: string): Promise<boolean>;
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

/**
 * PostgreSQL Evidence Submission Sink（STEP 11 持久化基础）。
 *
 * Freeze 由数据库唯一约束 UNIQUE(packet_id) 强制，不依赖进程锁：
 * - 正常重复提交 → 预检命中 → ALREADY_SUBMITTED；
 * - 并发竞争（预检未命中但 INSERT 唯一冲突）→ 捕获 23505 后重读 → ALREADY_SUBMITTED。
 *
 * 只负责 store / read / enforce uniqueness；不重新 rank、不修改 PRIMARY、
 * 不做 schema 语义判断（校验仍在现有 Runtime Boundary，即 SkillSchemaRegistry）。
 * payloadHash 与 InMemory sink 一致：sha256 over JSON.stringify(payload)。
 */
export class PostgresInvestigatorEvidenceSubmissionSink
  implements InvestigatorEvidenceSubmissionSink
{
  constructor(
    private readonly repo: InvestigatorEvidenceSubmissionRepositoryPort,
    private readonly identity: PostgresEvidenceSinkIdentity,
  ) {}

  async submit(
    payload: InvestigatorEvidenceSubmissionPayload,
  ): Promise<InvestigatorEvidenceSubmitResult> {
    const payloadHash = createHash("sha256").update(JSON.stringify(payload)).digest("hex");

    const existing = await this.repo.getSubmissionByPacketId(this.identity.packetId);
    if (existing) {
      return { status: "ALREADY_SUBMITTED", payloadHash: existing.payload_hash };
    }

    const canonicalSchema = payload.claims?.length
      ? `${URL_CANDIDATE_POOL_SCHEMA_NAME},${TARGET_CLAIM_SCHEMA_NAME}`
      : URL_CANDIDATE_POOL_SCHEMA_NAME;

    try {
      await this.repo.insertSubmission({
        packet_id: this.identity.packetId,
        agent_session_id: this.identity.agentSessionId,
        agent_role: this.identity.agentRole,
        skill_name: this.identity.skill.name,
        skill_version: this.identity.skill.version,
        canonical_schema: canonicalSchema,
        payload,
        payload_hash: payloadHash,
        frozen_at: new Date().toISOString(),
      });
      return { status: "ACCEPTED", payloadHash };
    } catch (error) {
      if (isUniqueViolation(error)) {
        const raced = await this.repo.getSubmissionByPacketId(this.identity.packetId);
        if (raced) {
          return { status: "ALREADY_SUBMITTED", payloadHash: raced.payload_hash };
        }
      }
      throw error;
    }
  }

  async getSubmission(): Promise<InvestigatorEvidenceSubmissionPayload | null> {
    const row = await this.repo.getSubmissionByPacketId(this.identity.packetId);
    if (!row) return null;
    return row.payload as InvestigatorEvidenceSubmissionPayload;
  }

  async isFrozen(): Promise<boolean> {
    return this.repo.isFrozen(this.identity.packetId);
  }
}
