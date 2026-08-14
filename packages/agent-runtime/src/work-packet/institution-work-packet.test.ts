import { describe, expect, it } from "vitest";
import type { InventorySubmissionPayload } from "@stellaris/agent-tools";
import {
  InMemoryInstitutionWorkPacketStore,
  PacketStateError,
} from "./institution-work-packet.js";

const FROZEN_INVENTORY: InventorySubmissionPayload = {
  inventory: [
    {
      institution_id: "glq-people-gov",
      standard_name: "鼓楼区人民政府",
      administrative_level: "COUNTY",
      decision: "INCLUDE",
      source_url: "https://www.gulou.gov.cn/",
    },
    {
      institution_id: "glq-sfj",
      standard_name: "鼓楼区司法局",
      administrative_level: "COUNTY",
      decision: "EXCLUDE_INTERNAL_DEPARTMENT",
    },
    {
      institution_id: "dup-1",
      standard_name: "重复单位",
      administrative_level: "COUNTY",
      decision: "DUPLICATE_ENTRY",
    },
  ],
};

describe("InMemoryInstitutionWorkPacketStore", () => {
  it("creates a PENDING packet only for INCLUDE records from a frozen inventory", () => {
    const store = new InMemoryInstitutionWorkPacketStore();
    const packets = store.createFromFrozenInventory(FROZEN_INVENTORY, { regionCode: "320106" });
    expect(packets).toHaveLength(1);
    const packet = packets[0];
    if (!packet) throw new Error("test setup: expected an INCLUDE packet");
    expect(packet.institutionId).toBe("glq-people-gov");
    expect(packet.institutionName).toBe("鼓楼区人民政府");
    expect(packet.administrativeLevel).toBe("COUNTY");
    expect(packet.regionCode).toBe("320106");
    expect(packet.state).toBe("PENDING");
    expect(packet.attemptNo).toBe(1);
    expect(packet.inventoryHash.length).toBe(64);
    expect(store.list()).toHaveLength(1);
  });

  it("does not create a packet for EXCLUDE / DUPLICATE entries", () => {
    const store = new InMemoryInstitutionWorkPacketStore();
    const packets = store.createFromFrozenInventory(FROZEN_INVENTORY);
    expect(packets.map((p) => p.institutionId)).toEqual(["glq-people-gov"]);
  });

  it("transitions PENDING -> INVESTIGATING -> EVIDENCE_PENDING -> EVIDENCE_GATHERING -> READY_FOR_REVIEW and stamps updatedAt", () => {
    const store = new InMemoryInstitutionWorkPacketStore();
    const packets = store.createFromFrozenInventory(FROZEN_INVENTORY);
    const packet = packets[0];
    if (!packet) throw new Error("test setup: expected an INCLUDE packet");
    const investigating = store.updateState(packet.packetId, "INVESTIGATING", {
      investigatorSessionId: "session-1",
    });
    expect(investigating.state).toBe("INVESTIGATING");
    expect(investigating.investigatorSessionId).toBe("session-1");
    const evidencePending = store.updateState(packet.packetId, "EVIDENCE_PENDING");
    expect(evidencePending.state).toBe("EVIDENCE_PENDING");
    expect(evidencePending.investigatorSessionId).toBe("session-1");
    const gathering = store.updateState(packet.packetId, "EVIDENCE_GATHERING");
    expect(gathering.state).toBe("EVIDENCE_GATHERING");
    const ready = store.updateState(packet.packetId, "READY_FOR_REVIEW");
    expect(ready.state).toBe("READY_FOR_REVIEW");
    expect(ready.investigatorSessionId).toBe("session-1");
  });

  it("rejects jumping from INVESTIGATING directly to READY_FOR_REVIEW", () => {
    const store = new InMemoryInstitutionWorkPacketStore();
    const packets = store.createFromFrozenInventory(FROZEN_INVENTORY);
    const packet = packets[0];
    if (!packet) throw new Error("test setup: expected an INCLUDE packet");
    store.updateState(packet.packetId, "INVESTIGATING");
    expect(() => store.updateState(packet.packetId, "READY_FOR_REVIEW")).toThrow(PacketStateError);
  });

  it("rejects a duplicate start (second INVESTIGATING transition)", () => {
    const store = new InMemoryInstitutionWorkPacketStore();
    const packets = store.createFromFrozenInventory(FROZEN_INVENTORY);
    const packet = packets[0];
    if (!packet) throw new Error("test setup: expected an INCLUDE packet");
    store.updateState(packet.packetId, "INVESTIGATING");
    expect(() => store.updateState(packet.packetId, "INVESTIGATING")).toThrow(PacketStateError);
  });

  it("keeps a FAILED packet (with failureCode) rather than deleting it", () => {
    const store = new InMemoryInstitutionWorkPacketStore();
    const packets = store.createFromFrozenInventory(FROZEN_INVENTORY);
    const packet = packets[0];
    if (!packet) throw new Error("test setup: expected an INCLUDE packet");
    store.updateState(packet.packetId, "INVESTIGATING");
    const failed = store.updateState(packet.packetId, "FAILED", {
      failureCode: "INVESTIGATION_NOT_SUBMITTED",
    });
    expect(failed.state).toBe("FAILED");
    expect(failed.failureCode).toBe("INVESTIGATION_NOT_SUBMITTED");
    expect(store.get(packet.packetId)?.state).toBe("FAILED");
  });
});
