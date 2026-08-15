import type { Repositories } from "@stellaris/db";
import {
  BiographyTaskResultReader,
  BiographyUrlResultReader,
  CompositeCandidateViewRehydrator,
  PostgresEvidenceReader,
  PostgresInstitutionWorkPacketStore,
  PostgresReviewDecisionReader,
  type BiographyUrlResult,
} from "@stellaris/agent-runtime";

/**
 * Biography Excel 导出编排（STEP 18）。
 *
 * 只做确定性组装，不做业务判断：
 * - export readiness（终态投影）：COMPLETED/PARTIAL_COMPLETED 可导出；非终态拒绝；
 *   FAILED/CANCELLED 不导出 Final Excel。
 * - Biography Result Reader 从 repos 直接装配（无裸 db）：packet + latest frozen
 *   APPROVED review + composite candidate pool → BiographyUrlResult（URL SSoT 不变）。
 * - readForTask：result_summary 仅用于取 packet ids + inventory 顺序，URL 仍经 reader。
 * 不调用 LLM / Search / Agent；不新增 Graphile job；不新建 Final Decision SSoT。
 */

export const BIOGRAPHY_EXCEL_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export type ExportReadiness =
  | "EXPORTABLE"
  | "NOT_TERMINAL"
  | "NOT_FINAL_EXPORTABLE";

const EXPORTABLE_STATUSES = new Set(["COMPLETED", "PARTIAL_COMPLETED"]);
const NON_FINAL_EXPORTABLE_STATUSES = new Set(["FAILED", "CANCELLED"]);

/** 确定性 export readiness 投影（不引入新 Task 状态）。 */
export function projectExportReadiness(status: string): ExportReadiness {
  if (EXPORTABLE_STATUSES.has(status)) return "EXPORTABLE";
  if (NON_FINAL_EXPORTABLE_STATUSES.has(status)) return "NOT_FINAL_EXPORTABLE";
  return "NOT_TERMINAL";
}

/** 从 repos 装配单 Packet Reader + 薄 Batch Reader（复用 rehydrator）。 */
export function buildBiographyTaskResultReader(
  repos: Repositories,
): BiographyTaskResultReader {
  const rehydrator = new CompositeCandidateViewRehydrator({
    evidenceReader: new PostgresEvidenceReader(repos.investigatorEvidence),
    recoveryRepo: repos.recoverySubmission,
    reviewRepo: repos.reviewDecisionSubmission,
  });
  const single = new BiographyUrlResultReader({
    packetStore: new PostgresInstitutionWorkPacketStore(
      repos.institutionWorkPacket,
    ),
    reviewReader: new PostgresReviewDecisionReader(repos.reviewDecisionSubmission),
    loadCandidatePool: async (packetId) =>
      (await rehydrator.rehydrate(packetId)).compositeCandidateView,
  });
  return new BiographyTaskResultReader(single);
}

/** result_summary 内 results[].packetId 的最小结构（不依赖具体 summary 类型）。 */
type BiographyResultSummaryLike = {
  results?: Array<{ packetId: string }>;
} | null;

/**
 * task → packet ids（result_summary 的 inventory 顺序）→ BiographyUrlResult[]。
 * 无 result_summary / 无 packet 时返回 null（调用方据此判定不可导出）。
 */
export async function readBiographyResultsForTask(
  taskReader: BiographyTaskResultReader,
  repos: Repositories,
  taskId: string,
): Promise<BiographyUrlResult[] | null> {
  const task = await repos.taskRun.findById(taskId);
  if (!task) return null;
  const summary = (task.result_summary ?? null) as BiographyResultSummaryLike;
  const packetIds = summary?.results?.map((r) => r.packetId) ?? [];
  if (packetIds.length === 0) return null;
  return taskReader.readMany(packetIds);
}
