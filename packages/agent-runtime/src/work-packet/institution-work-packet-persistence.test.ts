import { describe, expect, it } from "vitest";
import type { InventorySubmissionPayload } from "@stellaris/agent-tools";
import { FakePacketRepo } from "../persistence/persistence-test-support.js";
import {
  PacketStateError,
  PostgresInstitutionWorkPacketStore,
} from "./institution-work-packet.js";

/** 两个 INCLUDE + 一个 EXCLUDE：证明机械过滤只 INCLUDE 建包。 */
const FROZEN: InventorySubmissionPayload = {
  inventory: [
    {
      institution_id: "inst-a",
      standard_name: "机构A",
      administrative_level: "COUNTY",
      core_institution_type: "GOVERNMENT",
      decision: "INCLUDE",
    },
    {
      institution_id: "inst-b",
      standard_name: "机构B",
      administrative_level: "COUNTY",
      core_institution_type: "GOVERNMENT",
      decision: "INCLUDE",
    },
    {
      institution_id: "inst-excluded",
      standard_name: "机构X",
      administrative_level: "COUNTY",
      decision: "EXCLUDE_OUT_OF_SCOPE",
    },
  ],
};

describe("PostgresInstitutionWorkPacketStore (targeted persistence)", () => {
  it("createFromFrozenInventory 只 INCLUDE 建包，且新实例 reload 相同", async () => {
    const repo = new FakePacketRepo();
    const store = new PostgresInstitutionWorkPacketStore(repo);
    const created = await store.createFromFrozenInventory(FROZEN, { regionCode: "320106" });
    expect(created).toHaveLength(2);

    // 新实例 reload（同一持久化数据源）。
    const fresh = new PostgresInstitutionWorkPacketStore(repo);
    const reloaded = await fresh.list();
    expect(reloaded).toHaveLength(2);
    const byName = new Map(reloaded.map((p) => [p.institutionName, p]));
    expect(byName.get("机构A")).toMatchObject({
      state: "PENDING",
      regionCode: "320106",
      administrativeLevel: "COUNTY",
    });
    expect(byName.get("机构B")).toBeDefined();
    expect(reloaded.some((p) => p.institutionName === "机构X")).toBe(false);
  });

  it("state update + reload 持久化", async () => {
    const repo = new FakePacketRepo();
    const store = new PostgresInstitutionWorkPacketStore(repo);
    const packet = (await store.createFromFrozenInventory(FROZEN))[0]!;
    await store.updateState(packet.packetId, "INVESTIGATING", {
      investigatorSessionId: "sess-1",
    });

    const fresh = new PostgresInstitutionWorkPacketStore(repo);
    const reloaded = await fresh.get(packet.packetId);
    expect(reloaded?.state).toBe("INVESTIGATING");
    expect(reloaded?.investigatorSessionId).toBe("sess-1");
  });

  it("非法 transition 仍被拒绝（状态机语义不变，Store 只是存储）", async () => {
    const repo = new FakePacketRepo();
    const store = new PostgresInstitutionWorkPacketStore(repo);
    const packet = (await store.createFromFrozenInventory(FROZEN))[0]!;

    await expect(
      store.updateState(packet.packetId, "POSITION_DECIDED"),
    ).rejects.toBeInstanceOf(PacketStateError);

    const fresh = new PostgresInstitutionWorkPacketStore(repo);
    expect((await fresh.get(packet.packetId))?.state).toBe("PENDING");
  });

  it("两个 packet 状态相互隔离", async () => {
    const repo = new FakePacketRepo();
    const store = new PostgresInstitutionWorkPacketStore(repo);
    const packets = await store.createFromFrozenInventory(FROZEN);
    const a = packets[0]!;
    const b = packets[1]!;
    await store.updateState(a.packetId, "INVESTIGATING");

    const fresh = new PostgresInstitutionWorkPacketStore(repo);
    expect((await fresh.get(a.packetId))?.state).toBe("INVESTIGATING");
    expect((await fresh.get(b.packetId))?.state).toBe("PENDING");
  });
});
