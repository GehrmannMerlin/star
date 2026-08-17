import type { PacketWorkflowRunner } from "../coordination/multi-institution-biography-coordinator.js";
import type {
  InstitutionBiographyWorkflowPort,
  InstitutionBiographyWorkflowResult,
} from "./institution-biography-workflow-runner.js";

/**
 * Region Batch Biography URL — MultiInstitutionBiographyCoordinator 接线（STEP 16）。
 *
 * 只做两件事：
 * 1. 把 per-packet `InstitutionBiographyWorkflowPort` 适配成 coordinator 需要的
 *    `PacketWorkflowRunner`（不包含任何业务语义）；
 * 2. 把 batch 结果聚合为 `RegionBiographyBatchResult`（纯确定性计数，不调用 Agent）。
 */

/**
 * 把 Workflow Port 适配为 coordinator 的 runPacket。
 *
 * workflow 返回 FAILED 或抛错时 → `{ status: "FAILED" }`；否则 SUCCESS。
 * 可选 onResult 收集器用于报告（batch summary / per-packet workflow detail）。
 */
export function createBiographyPacketWorkflowRunner(
  workflow: InstitutionBiographyWorkflowPort,
  onResult?: (result: InstitutionBiographyWorkflowResult) => void,
  signal?: AbortSignal,
): PacketWorkflowRunner {
  return async (packet) => {
    try {
      const result = await workflow.run(packet);
      onResult?.(result);
      return {
        packetId: packet.packetId,
        status: result.status === "FAILED" ? "FAILED" : "SUCCESS",
        state: result.packetState,
        ...(result.failure ? { error: result.failure.message } : {}),
      };
    } catch (error) {
      // 取消：control-flow cancellation 向上传播（不作为 per-packet FAILED 吞掉）。
      if (signal?.aborted) throw error;
      return {
        packetId: packet.packetId,
        status: "FAILED",
        state: packet.state,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  };
}

export type RegionBiographyBatchStatus = "RESOLVED" | "PARTIAL" | "UNRESOLVED" | "FAILED";

export type RegionBiographyBatchResult = {
  regionCode: string | null;
  totalPackets: number;
  resolvedPackets: number;
  partialPackets: number;
  unresolvedPackets: number;
  failedPackets: number;
  results: Array<{
    packetId: string;
    institutionId: string;
    institutionName: string;
    status: RegionBiographyBatchStatus;
    packetState: string;
    primary1: { decisionStatus: string; biographyUrl: string | null } | null;
    primary2: { decisionStatus: string; biographyUrl: string | null } | null;
  }>;
};

/** 纯确定性聚合（计数 + 投影结果摘要；不做任何业务判断）。 */
export function buildRegionBiographyBatchResult(
  workflowResults: InstitutionBiographyWorkflowResult[],
  regionCode: string | null,
): RegionBiographyBatchResult {
  let resolvedPackets = 0;
  let partialPackets = 0;
  let unresolvedPackets = 0;
  let failedPackets = 0;
  const results = workflowResults.map((result) => {
    if (result.status === "RESOLVED") resolvedPackets += 1;
    else if (result.status === "PARTIAL") partialPackets += 1;
    else if (result.status === "FAILED") failedPackets += 1;
    else unresolvedPackets += 1;
    return {
      packetId: result.packetId,
      institutionId: result.institutionId,
      institutionName: result.institutionName,
      status: result.status,
      packetState: result.packetState,
      primary1: result.biographyResult
        ? {
            decisionStatus: result.biographyResult.primary1.decisionStatus,
            biographyUrl: result.biographyResult.primary1.biographyUrl,
          }
        : null,
      primary2: result.biographyResult
        ? {
            decisionStatus: result.biographyResult.primary2.decisionStatus,
            biographyUrl: result.biographyResult.primary2.biographyUrl,
          }
        : null,
    };
  });
  return {
    regionCode,
    totalPackets: results.length,
    resolvedPackets,
    partialPackets,
    unresolvedPackets,
    failedPackets,
    results,
  };
}
