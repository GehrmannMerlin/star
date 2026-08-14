import { describe, expect, it } from "vitest";
import type { InventorySubmissionPayload } from "@stellaris/agent-tools";
import { FakePacketRepo } from "../persistence/persistence-test-support.js";
import { PostgresInstitutionWorkPacketStore } from "../work-packet/institution-work-packet.js";
import {
  MultiInstitutionBiographyCoordinator,
  type PacketRunResult,
} from "./multi-institution-biography-coordinator.js";

function frozenWith(count: number): InventorySubmissionPayload {
  const inventory = Array.from({ length: count }, (_, index) => ({
    institution_id: `inst-${index + 1}`,
    standard_name: `机构${index + 1}`,
    administrative_level: "COUNTY" as const,
    core_institution_type: "GOVERNMENT",
    decision: "INCLUDE" as const,
  }));
  return { inventory };
}

describe("MultiInstitutionBiographyCoordinator", () => {
  it("2-packet 调度 + 聚合结果（全 SUCCESS）", async () => {
    const store = new PostgresInstitutionWorkPacketStore(new FakePacketRepo());
    const seen: string[] = [];
    const coordinator = new MultiInstitutionBiographyCoordinator({
      packetStore: store,
      concurrency: 1,
      runPacket: async (packet) => {
        seen.push(packet.packetId);
        return { packetId: packet.packetId, status: "SUCCESS", state: packet.state };
      },
    });

    const { packets, results } = await coordinator.run(frozenWith(2), {
      regionCode: "320106",
    });
    expect(packets).toHaveLength(2);
    expect(results).toHaveLength(2);
    expect(results.every((r) => r.status === "SUCCESS")).toBe(true);
    expect(seen.sort()).toEqual(packets.map((p) => p.packetId).sort());
  });

  it("bounded concurrency：并发上限受控", async () => {
    const store = new PostgresInstitutionWorkPacketStore(new FakePacketRepo());
    let active = 0;
    let maxActive = 0;
    const runPacket = async (packet: { packetId: string; state: string }): Promise<PacketRunResult> => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, 20));
      active -= 1;
      return { packetId: packet.packetId, status: "SUCCESS", state: packet.state as never };
    };
    const coordinator = new MultiInstitutionBiographyCoordinator({
      packetStore: store,
      concurrency: 2,
      runPacket,
    });

    const { results } = await coordinator.run(frozenWith(4));
    expect(results).toHaveLength(4);
    expect(maxActive).toBeLessThanOrEqual(2);
  });

  it("failure isolation：Packet A FAILED 不 crash，Packet B SUCCESS 结果不被覆盖", async () => {
    const store = new PostgresInstitutionWorkPacketStore(new FakePacketRepo());
    const coordinator = new MultiInstitutionBiographyCoordinator({
      packetStore: store,
      concurrency: 1,
      runPacket: async (packet) => {
        if (packet.institutionName === "机构1") {
          throw new Error("boom");
        }
        return { packetId: packet.packetId, status: "SUCCESS", state: packet.state };
      },
    });

    const { results } = await coordinator.run(frozenWith(2));
    const byName = new Map(results.map((r) => [r.packetId, r]));
    const packets = await store.list();
    const a = packets.find((p) => p.institutionName === "机构1")!;
    const b = packets.find((p) => p.institutionName === "机构2")!;

    expect(byName.get(a.packetId)).toMatchObject({ status: "FAILED", error: "boom" });
    expect(byName.get(b.packetId)).toMatchObject({ status: "SUCCESS" });
  });
});
