import { createHash, randomUUID } from "node:crypto";
import type {
  AdministrativeLevel,
  InventorySubmissionPayload,
} from "@stellaris/agent-tools";
import type { InstitutionWorkPacketRow } from "@stellaris/db";

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
  "REVIEWING",
  "POSITION_DECIDED",
  "RECOVERY_REQUIRED",
  "RECOVERING",
  "FAILED",
  "CANCELLED",
] as const;
export type InstitutionWorkPacketState = (typeof PACKET_STATES)[number];

/** 一个 PRIMARY 人员的身份（Result 投影在无 Agent 时确定 slot → 人员映射）。 */
export type PrimaryPersonIdentity = {
  targetId: string | null;
  personId: string | null;
  personName: string | null;
};

/** 两个 PRIMARY 人员身份（都可空：人员未确认时不伪造）。 */
export type PrimaryPersons = {
  primary1: PrimaryPersonIdentity | null;
  primary2: PrimaryPersonIdentity | null;
};

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
  /** 两个 PRIMARY 人员的身份（编排 identity；人员确认后由 setPrimaryPersons 写入）。 */
  primaryPersons?: PrimaryPersons;
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
  READY_FOR_REVIEW: ["REVIEWING"],
  REVIEWING: ["POSITION_DECIDED", "RECOVERY_REQUIRED", "FAILED"],
  POSITION_DECIDED: [],
  RECOVERY_REQUIRED: ["RECOVERING"],
  RECOVERING: ["READY_FOR_REVIEW", "FAILED"],
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

/** pg timestamptz 读取时为 Date 对象，统一归一化为 ISO string。 */
function toIso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

/**
 * 机械地从 frozen inventory 构造 Packets：只 INCLUDE record 建包。
 * EXCLUDE / DUPLICATE / MERGE 决策原样保留——绝不在此重新判断。
 * InMemory 与 Postgres 实现共用同一构造逻辑（同一 inventoryHash / 同一包身份）。
 */
export function createPacketsFromFrozenInventory(
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
    created.push(packet);
  }
  return created;
}

/** DB 行 → domain Packet（状态 / 人员身份 / 时间归一化）。 */
export function packetRowToDomain(row: InstitutionWorkPacketRow): InstitutionWorkPacket {
  const packet: InstitutionWorkPacket = {
    packetId: row.packet_id,
    inventoryHash: row.inventory_hash,
    institutionId: row.institution_id,
    institutionName: row.institution_name,
    administrativeLevel: row.administrative_level as AdministrativeLevel,
    state: row.state as InstitutionWorkPacketState,
    attemptNo: row.attempt_no,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
  if (row.region_code !== null) packet.regionCode = row.region_code;
  if (row.institution_type !== null) packet.institutionType = row.institution_type;
  if (row.investigator_session_id !== null) {
    packet.investigatorSessionId = row.investigator_session_id;
  }
  if (row.failure_code !== null) packet.failureCode = row.failure_code;
  const hasP1 =
    row.primary1_target_id !== null ||
    row.primary1_person_id !== null ||
    row.primary1_person_name !== null;
  const hasP2 =
    row.primary2_target_id !== null ||
    row.primary2_person_id !== null ||
    row.primary2_person_name !== null;
  if (hasP1 || hasP2) {
    packet.primaryPersons = {
      primary1: hasP1
        ? {
            targetId: row.primary1_target_id,
            personId: row.primary1_person_id,
            personName: row.primary1_person_name,
          }
        : null,
      primary2: hasP2
        ? {
            targetId: row.primary2_target_id,
            personId: row.primary2_person_id,
            personName: row.primary2_person_name,
          }
        : null,
    };
  }
  return packet;
}

/** domain Packet → DB 行（只存编排 identity，不存 Raw Artifact）。 */
export function packetToInsertRow(packet: InstitutionWorkPacket): InstitutionWorkPacketRow {
  return {
    packet_id: packet.packetId,
    inventory_hash: packet.inventoryHash,
    region_code: packet.regionCode ?? null,
    institution_id: packet.institutionId,
    institution_name: packet.institutionName,
    administrative_level: packet.administrativeLevel,
    institution_type: packet.institutionType ?? null,
    state: packet.state,
    attempt_no: packet.attemptNo,
    investigator_session_id: packet.investigatorSessionId ?? null,
    failure_code: packet.failureCode ?? null,
    primary1_target_id: packet.primaryPersons?.primary1?.targetId ?? null,
    primary1_person_id: packet.primaryPersons?.primary1?.personId ?? null,
    primary1_person_name: packet.primaryPersons?.primary1?.personName ?? null,
    primary2_target_id: packet.primaryPersons?.primary2?.targetId ?? null,
    primary2_person_id: packet.primaryPersons?.primary2?.personId ?? null,
    primary2_person_name: packet.primaryPersons?.primary2?.personName ?? null,
    created_at: packet.createdAt,
    updated_at: packet.updatedAt,
  };
}

/** Packet Store 异步契约（Postgres 实现；协调器/批量读取依赖）。 */
export interface InstitutionWorkPacketStorePort {
  createFromFrozenInventory(
    frozen: InventorySubmissionPayload,
    opts?: { regionCode?: string },
  ): Promise<InstitutionWorkPacket[]>;
  get(packetId: string): Promise<InstitutionWorkPacket | undefined>;
  list(): Promise<InstitutionWorkPacket[]>;
  updateState(
    packetId: string,
    to: InstitutionWorkPacketState,
    meta?: PacketStateMeta,
  ): Promise<InstitutionWorkPacket>;
  setPrimaryPersons(
    packetId: string,
    persons: PrimaryPersons,
  ): Promise<InstitutionWorkPacket>;
}

/** 持久化 Packet 仓储形状（@stellaris/db InstitutionWorkPacketRepository 结构兼容）。 */
export interface InstitutionWorkPacketRepositoryPort {
  insert(row: InstitutionWorkPacketRow): Promise<InstitutionWorkPacketRow>;
  getByPacketId(packetId: string): Promise<InstitutionWorkPacketRow | null>;
  list(): Promise<InstitutionWorkPacketRow[]>;
  updatePacket(
    packetId: string,
    patch: {
      state?: string;
      investigatorSessionId?: string | null;
      failureCode?: string | null;
      updatedAt: string;
    },
  ): Promise<InstitutionWorkPacketRow>;
  updatePrimaryPersons(
    packetId: string,
    patch: {
      primary1: {
        targetId: string | null;
        personId: string | null;
        personName: string | null;
      };
      primary2: {
        targetId: string | null;
        personId: string | null;
        personName: string | null;
      };
      updatedAt: string;
    },
  ): Promise<InstitutionWorkPacketRow>;
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
    const created = createPacketsFromFrozenInventory(frozen, opts);
    for (const packet of created) {
      this.packets.set(packet.packetId, packet);
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

  /** 附加两个 PRIMARY 人员身份（不改变 state，合法编排元数据）。 */
  setPrimaryPersons(packetId: string, persons: PrimaryPersons): InstitutionWorkPacket {
    const packet = this.packets.get(packetId);
    if (!packet) throw new PacketNotFoundError(packetId);
    const updated: InstitutionWorkPacket = {
      ...packet,
      primaryPersons: persons,
      updatedAt: new Date().toISOString(),
    };
    this.packets.set(packetId, updated);
    return updated;
  }
}

/**
 * PostgreSQL work packet store（STEP 15 Persistent Institution Work Packet）。
 *
 * 与 InMemory 共享同一机械构造（createPacketsFromFrozenInventory）与同一状态机
 * （ALLOWED_TRANSITIONS）：Store 只是存储——非法 transition 仍抛 PacketStateError，
 * 不重新 rank、不重选 PRIMARY、不重判语义。持久化字段只含编排/状态 identity。
 */
export class PostgresInstitutionWorkPacketStore implements InstitutionWorkPacketStorePort {
  constructor(private readonly repo: InstitutionWorkPacketRepositoryPort) {}

  async createFromFrozenInventory(
    frozen: InventorySubmissionPayload,
    opts?: { regionCode?: string },
  ): Promise<InstitutionWorkPacket[]> {
    const created = createPacketsFromFrozenInventory(frozen, opts);
    for (const packet of created) {
      await this.repo.insert(packetToInsertRow(packet));
    }
    return created;
  }

  async get(packetId: string): Promise<InstitutionWorkPacket | undefined> {
    const row = await this.repo.getByPacketId(packetId);
    return row ? packetRowToDomain(row) : undefined;
  }

  async list(): Promise<InstitutionWorkPacket[]> {
    const rows = await this.repo.list();
    return rows.map(packetRowToDomain);
  }

  async updateState(
    packetId: string,
    to: InstitutionWorkPacketState,
    meta?: PacketStateMeta,
  ): Promise<InstitutionWorkPacket> {
    const current = await this.get(packetId);
    if (!current) throw new PacketNotFoundError(packetId);
    const allowed = ALLOWED_TRANSITIONS[current.state];
    if (!allowed.includes(to)) {
      throw new PacketStateError(packetId, current.state, to);
    }
    const patch: {
      state: string;
      updatedAt: string;
      investigatorSessionId?: string | null;
      failureCode?: string | null;
    } = { state: to, updatedAt: new Date().toISOString() };
    if (meta?.investigatorSessionId !== undefined) {
      patch.investigatorSessionId = meta.investigatorSessionId;
    }
    if (meta?.failureCode !== undefined) {
      patch.failureCode = meta.failureCode;
    }
    const row = await this.repo.updatePacket(packetId, patch);
    return packetRowToDomain(row);
  }

  async setPrimaryPersons(
    packetId: string,
    persons: PrimaryPersons,
  ): Promise<InstitutionWorkPacket> {
    const current = await this.get(packetId);
    if (!current) throw new PacketNotFoundError(packetId);
    const updatedAt = new Date().toISOString();
    const row = await this.repo.updatePrimaryPersons(packetId, {
      primary1: {
        targetId: persons.primary1?.targetId ?? null,
        personId: persons.primary1?.personId ?? null,
        personName: persons.primary1?.personName ?? null,
      },
      primary2: {
        targetId: persons.primary2?.targetId ?? null,
        personId: persons.primary2?.personId ?? null,
        personName: persons.primary2?.personName ?? null,
      },
      updatedAt,
    });
    return packetRowToDomain(row);
  }
}
