import type { InventorySubmissionPayload } from "@stellaris/agent-tools";
import type {
  InstitutionWorkPacket,
  InstitutionWorkPacketState,
  InstitutionWorkPacketStorePort,
} from "../work-packet/institution-work-packet.js";

/**
 * Multi-Institution Biography Workflow Orchestration Foundation（STEP 15）。
 *
 * 输入 Frozen Inventory → packetStore 机械生成多个 InstitutionWorkPacket →
 * 以 bounded concurrency 逐 Packet 调用注入的 runPacket（已有 Workflow Boundary）。
 *
 * 严格边界：
 * - Coordinator 自身**不做**任何业务语义决策：不 search / fetch / inspect /
 *   选人 / 选 PRIMARY / 选 URL / Review / Recovery；
 * - 无地区-specific code、无全国行政区 Adapter；
 * - 无 Scheduler / Retry / Queue / Priority / Distributed Lock（Retry/Resume 留待后续）；
 * - 单个 Packet 失败不 crash、不覆盖其它 Packet 的成功结果 → per-packet result。
 */

export const PACKET_RUN_STATUSES = ["SUCCESS", "FAILED"] as const;
export type PacketRunStatus = (typeof PACKET_RUN_STATUSES)[number];

export type PacketRunResult = {
  packetId: string;
  status: PacketRunStatus;
  state: InstitutionWorkPacketState;
  error?: string;
};

/** 已有 Workflow Boundary：真实 Runner（Investigator/Evidence/Reviewer/Recovery）或测试 Fake。 */
export type PacketWorkflowRunner = (packet: InstitutionWorkPacket) => Promise<PacketRunResult>;

export type MultiInstitutionBiographyCoordinatorDeps = {
  packetStore: InstitutionWorkPacketStorePort;
  runPacket: PacketWorkflowRunner;
  /** bounded concurrency；默认 2（server 4 vCPU 的开发值）。 */
  concurrency?: number;
};

export type MultiInstitutionBiographyCoordinatorResult = {
  packets: InstitutionWorkPacket[];
  results: PacketRunResult[];
};

export const DEFAULT_BIOGRAPHY_COORDINATOR_CONCURRENCY = 2;

/** 简单 in-process bounded pool：同一时刻最多 limit 个 runPacket 在执行。 */
async function runWithBoundedConcurrency(
  packets: InstitutionWorkPacket[],
  run: PacketWorkflowRunner,
  limit: number,
): Promise<PacketRunResult[]> {
  const results: PacketRunResult[] = new Array<PacketRunResult>(packets.length);
  let next = 0;
  const worker = async (): Promise<void> => {
    for (;;) {
      const index = next;
      next += 1;
      if (index >= packets.length) return;
      const packet = packets[index];
      if (packet === undefined) return;
      try {
        results[index] = await run(packet);
      } catch (error) {
        results[index] = {
          packetId: packet.packetId,
          status: "FAILED",
          state: packet.state,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }
  };
  const workerCount = Math.max(1, Math.min(limit, packets.length));
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}

/**
 * 多机构 Biography 工作流编排骨架。
 *
 * 只负责：Frozen Inventory → packets → bounded execution → per-packet result。
 * 业务语义（选人 / 选 URL / Review / Recovery）全部留在注入的 runPacket。
 */
export class MultiInstitutionBiographyCoordinator {
  constructor(private readonly deps: MultiInstitutionBiographyCoordinatorDeps) {}

  async run(
    frozen: InventorySubmissionPayload,
    opts?: { regionCode?: string },
  ): Promise<MultiInstitutionBiographyCoordinatorResult> {
    const packets = await this.deps.packetStore.createFromFrozenInventory(frozen, opts);
    const concurrency = this.deps.concurrency ?? DEFAULT_BIOGRAPHY_COORDINATOR_CONCURRENCY;
    const results = await runWithBoundedConcurrency(packets, this.deps.runPacket, concurrency);
    return { packets, results };
  }
}
