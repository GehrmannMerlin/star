import type { UrlCandidatePoolRow } from "@stellaris/agent-tools";

/** Evidence 读取仓储形状（@stellaris/db InvestigatorEvidenceSubmissionRepository 结构兼容）。 */
export interface EvidenceSubmissionReaderPort {
  getSubmissionByPacketId(packetId: string): Promise<{ payload: unknown } | null>;
}

/** 面向重水合/编排的 Evidence Reader 形状（PostgresEvidenceReader 实现）。 */
export interface EvidenceReaderPort {
  readOriginalCandidatePool(packetId: string): Promise<UrlCandidatePoolRow[]>;
}

/**
 * PostgreSQL Original Evidence Reader（STEP 14 重水合数据源之一）。
 *
 * 只读：从已冻结的 Investigator Evidence Submission 读取 Original Candidate
 * Pool。原始证据永不由此类写入或修改。
 */
export class PostgresEvidenceReader implements EvidenceReaderPort {
  constructor(private readonly repo: EvidenceSubmissionReaderPort) {}

  /** 原始 Position URL Candidate Pool；未冻结时返回空数组。 */
  async readOriginalCandidatePool(packetId: string): Promise<UrlCandidatePoolRow[]> {
    const row = await this.repo.getSubmissionByPacketId(packetId);
    if (!row) return [];
    const payload = (row.payload ?? {}) as { candidates?: unknown };
    if (!Array.isArray(payload.candidates)) return [];
    return payload.candidates as UrlCandidatePoolRow[];
  }
}
