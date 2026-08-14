import { describe, expect, it } from "vitest";
import { InMemoryInstitutionWorkPacketStore } from "../work-packet/institution-work-packet.js";

function freshStore() {
  const store = new InMemoryInstitutionWorkPacketStore();
  const packets = store.createFromFrozenInventory(
    {
      inventory: [
        {
          institution_id: "glq-people-gov",
          standard_name: "鼓楼区人民政府",
          administrative_level: "COUNTY",
          decision: "INCLUDE",
        },
      ],
    } as never,
    { regionCode: "320106" },
  );
  const packet = packets[0];
  if (!packet) throw new Error("test setup: expected an INCLUDE packet");
  store.updateState(packet.packetId, "INVESTIGATING", { investigatorSessionId: "step9-session" });
  store.updateState(packet.packetId, "EVIDENCE_PENDING");
  store.updateState(packet.packetId, "EVIDENCE_GATHERING");
  store.updateState(packet.packetId, "READY_FOR_REVIEW");
  return { store, packetId: packet.packetId };
}

describe("packet review-state transitions", () => {
  it("walks READY_FOR_REVIEW → REVIEWING → POSITION_DECIDED", () => {
    const { store, packetId } = freshStore();
    expect(store.get(packetId)?.state).toBe("READY_FOR_REVIEW");
    store.updateState(packetId, "REVIEWING", { investigatorSessionId: "reviewer-session" });
    expect(store.get(packetId)?.state).toBe("REVIEWING");
    expect(store.get(packetId)?.investigatorSessionId).toBe("reviewer-session");
    store.updateState(packetId, "POSITION_DECIDED");
    expect(store.get(packetId)?.state).toBe("POSITION_DECIDED");
  });

  it("walks READY_FOR_REVIEW → REVIEWING → RECOVERY_REQUIRED", () => {
    const { store, packetId } = freshStore();
    store.updateState(packetId, "REVIEWING");
    store.updateState(packetId, "RECOVERY_REQUIRED");
    expect(store.get(packetId)?.state).toBe("RECOVERY_REQUIRED");
  });

  it("rejects a direct jump READY_FOR_REVIEW → POSITION_DECIDED (must pass REVIEWING)", () => {
    const { store, packetId } = freshStore();
    expect(() => store.updateState(packetId, "POSITION_DECIDED")).toThrow(/Invalid packet state transition/);
  });

  it("never uses COMPLETED as a terminal institution state", () => {
    const { store, packetId } = freshStore();
    store.updateState(packetId, "REVIEWING");
    store.updateState(packetId, "POSITION_DECIDED");
    const state = store.get(packetId)?.state;
    expect(state).toBe("POSITION_DECIDED");
    expect(state).not.toBe("COMPLETED");
  });
});
