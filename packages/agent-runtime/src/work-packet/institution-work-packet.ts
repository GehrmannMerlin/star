import { createHash, randomUUID } from "node:crypto";
import type {
  AdministrativeLevel,
  InventorySubmissionPayload,
} from "@stellaris/agent-tools";

/**
 * Runtime-only work packet state. This is a scheduling object for the Pi Agent
 * runtime — it deliberately does NOT replicate the Skill's workspace
 * institution-work-packet schema (source routes, expected leader section names,
 * Skill `status` enum). Business semantics live in Skill -> Pi.
 */
export const PACKET_STATES = [
  "PENDING",
  "INVESTIGATING",
  "EVIDENCE_PENDING",
  "EVIDENCE_GATHERING",
  "READY_FOR_REVIEW",
  "FAILED",
  "CANCELLED",
] as const;
export type InstitutionWorkPacketState = (typeof PACKET_STATES)[number];

export type InstitutionWorkPacket = {
  packetId: string;
  /** sha256 of the frozen inventory payload this packet was generated from. */
  inventoryHash: string;
  regionCode?: string;
  institutionId: string;
  institutionName: string;
  administrativeLevel: AdministrativeLevel;
  institutionType?: string;
  state: InstitutionWorkPacketState;
  attemptNo: number;
  investigatorSessionId?: string;
  failureCode?: string;
  createdAt: string;
  updatedAt: string;
};

export type PacketStateMeta = {
  investigatorSessionId?: string;
  failureCode?: string;
};

const ALLOWED_TRANSITIONS: Record<
  InstitutionWorkPacketState,
  readonly InstitutionWorkPacketState[]
> = {
  PENDING: ["INVESTIGATING", "CANCELLED"],
  INVESTIGATING: ["EVIDENCE_PENDING", "FAILED", "CANCELLED"],
  EVIDENCE_PENDING: ["EVIDENCE_GATHERING", "FAILED", "CANCELLED"],
  EVIDENCE_GATHERING: ["READY_FOR_REVIEW", "FAILED", "CANCELLED"],
  READY_FOR_REVIEW: [],
  FAILED: [],
  CANCELLED: [],
};

export class PacketStateError extends Error {
  constructor(
    public readonly packetId: string,
    public readonly from: InstitutionWorkPacketState,
    public readonly to: InstitutionWorkPacketState,
  ) {
    super(`Invalid packet state transition: ${from} -> ${to} (packet ${packetId})`);
    this.name = "PacketStateError";
  }
}

export class PacketNotFoundError extends Error {
  constructor(public readonly packetId: string) {
    super(`Work packet not found: ${packetId}`);
    this.name = "PacketNotFoundError";
  }
}

/**
 * In-memory work packet store. Packets are generated mechanically from a
 * frozen inventory: only INCLUDE records become packets. EXCLUDE / DUPLICATE /
 * MERGE decisions are honored as-is — never re-judged here.
 */
export class InMemoryInstitutionWorkPacketStore {
  private packets = new Map<string, InstitutionWorkPacket>();

  createFromFrozenInventory(
    frozen: InventorySubmissionPayload,
    opts?: { regionCode?: string },
  ): InstitutionWorkPacket[] {
    const inventoryHash = createHash("sha256").update(JSON.stringify(frozen)).digest("hex");
    const now = new Date().toISOString();
    const created: InstitutionWorkPacket[] = [];
    for (const record of frozen.inventory) {
      if (record.decision !== "INCLUDE") continue;
      const packet: InstitutionWorkPacket = {
        packetId: randomUUID(),
        inventoryHash,
        ...(opts?.regionCode !== undefined ? { regionCode: opts.regionCode } : {}),
        institutionId: record.institution_id,
        institutionName: record.standard_name,
        administrativeLevel: record.administrative_level,
        ...(record.core_institution_type !== undefined
          ? { institutionType: record.core_institution_type }
          : {}),
        state: "PENDING",
        attemptNo: 1,
        createdAt: now,
        updatedAt: now,
      };
      this.packets.set(packet.packetId, packet);
      created.push(packet);
    }
    return created;
  }

  get(packetId: string): InstitutionWorkPacket | undefined {
    return this.packets.get(packetId);
  }

  list(): InstitutionWorkPacket[] {
    return [...this.packets.values()];
  }

  updateState(
    packetId: string,
    to: InstitutionWorkPacketState,
    meta?: PacketStateMeta,
  ): InstitutionWorkPacket {
    const packet = this.packets.get(packetId);
    if (!packet) throw new PacketNotFoundError(packetId);
    const allowed = ALLOWED_TRANSITIONS[packet.state];
    if (!allowed.includes(to)) {
      throw new PacketStateError(packetId, packet.state, to);
    }
    const updated: InstitutionWorkPacket = {
      ...packet,
      state: to,
      ...(meta?.investigatorSessionId !== undefined
        ? { investigatorSessionId: meta.investigatorSessionId }
        : {}),
      ...(meta?.failureCode !== undefined ? { failureCode: meta.failureCode } : {}),
      updatedAt: new Date().toISOString(),
    };
    this.packets.set(packetId, updated);
    return updated;
  }
}
