import type { UrlCandidatePoolRow } from "@stellaris/agent-tools";
import type { ReviewDecisionHistoryRow } from "../persistence/review-decision-reader.js";
import type {
  InstitutionWorkPacket,
  InstitutionWorkPacketStorePort,
  PrimaryPersonIdentity,
} from "../work-packet/institution-work-packet.js";

/**
 * Biography URL Final Result Read Model（STEP 15）。
 *
 * 业务语义严格跟随 Skill official-biography-evidence 3.1.0：最终 Artifact 是
 * `final_url_decisions[].selected_url` —— 即官员「个人简历 URL / 岗位信息 URL」。
 * 本 Read Model 只从「Packet + Latest Frozen APPROVED Review Decision + Candidate Pool」
 * 纯确定性投影，**不创建** biography_final_decision 第二张事实表、不调用任何 Agent /
 * DeepSeek / Bocha / Pi。Final URL 的 SSoT 永远是 latest frozen APPROVED review。
 */

export const BIOGRAPHY_RESULT_SOURCE_OF_TRUTH = "LATEST_FROZEN_APPROVED_REVIEW" as const;
export type BiographyResultSourceOfTruth = typeof BIOGRAPHY_RESULT_SOURCE_OF_TRUTH;

export const BIOGRAPHY_SLOT_STATUSES = ["RESOLVED", "UNRESOLVED"] as const;
export type BiographySlotStatus = (typeof BIOGRAPHY_SLOT_STATUSES)[number];

export const BIOGRAPHY_RESULT_STATUSES = ["RESOLVED", "PARTIAL", "UNRESOLVED"] as const;
export type BiographyResultStatus = (typeof BIOGRAPHY_RESULT_STATUSES)[number];

export type BiographyPrimarySlot = "PRIMARY_1" | "PRIMARY_2";

/** 单个 PRIMARY 人员的 Biography URL 结果（两个 slot 独立输出）。 */
export type BiographyUrlSlotResult = {
  primarySlot: BiographyPrimarySlot;
  targetId: string | null;
  personId: string | null;
  personName: string | null;
  /** Skill 语义：final_url_decisions.selected_url（个人简历 URL）。 */
  biographyUrl: string | null;
  /** RESOLVED = latest APPROVED review 选定候选且 URL 可解析；否则 UNRESOLVED（不伪造）。 */
  decisionStatus: BiographySlotStatus;
  /** 来源 review 的 round（latest frozen APPROVED）。 */
  reviewRound: number | null;
  /** 来源 review 的持久化行 id（review_decision_submission.id）。 */
  sourceReviewId: string | null;
};

/** 一个 Institution Packet 的 Biography URL 采集结果。 */
export type BiographyUrlResult = {
  packetId: string;
  regionCode: string | null;
  institutionId: string;
  institutionName: string;
  /** RESOLVED（两 slot 均 RESOLVED）| PARTIAL（仅一 slot）| UNRESOLVED（无）。 */
  status: BiographyResultStatus;
  /** 固定 SSoT 声明：来源是 latest frozen APPROVED review。 */
  sourceOfTruth: BiographyResultSourceOfTruth;
  primary1: BiographyUrlSlotResult;
  primary2: BiographyUrlSlotResult;
};

/** Read Model 依赖的 Review Reader 形状（PostgresReviewDecisionReader 结构兼容）。 */
export type ReviewDecisionReaderPort = {
  latestByPacket(packetId: string): Promise<ReviewDecisionHistoryRow | null>;
};

export type BiographyUrlResultReaderDeps = {
  packetStore: InstitutionWorkPacketStorePort;
  reviewReader: ReviewDecisionReaderPort;
  /** 候选池加载器：调用方决定 original pool 或 composite view（Reviewer 选中的候选必须在此池内）。 */
  loadCandidatePool: (packetId: string) => Promise<UrlCandidatePoolRow[]>;
};

function emptySlotResult(
  primarySlot: BiographyPrimarySlot,
  person: PrimaryPersonIdentity | null,
  source: ReviewDecisionHistoryRow | null,
): BiographyUrlSlotResult {
  return {
    primarySlot,
    targetId: person?.targetId ?? null,
    personId: person?.personId ?? null,
    personName: person?.personName ?? null,
    biographyUrl: null,
    decisionStatus: "UNRESOLVED",
    reviewRound: source?.reviewRound ?? null,
    sourceReviewId: source?.sourceReviewId ?? null,
  };
}

/**
 * 纯确定性投影（无 IO、无 Agent）。
 *
 * 规则：
 * - latest review 不存在或 roundOutcome !== 'APPROVED' → 两 slot 均 UNRESOLVED
 *   （packet 处于 RECOVERY_REQUIRED / READY_FOR_REVIEW / FAILED 等未决态时绝不伪造 URL）；
 * - latest review APPROVED → 逐 review.target_id 匹配 primary slot（优先 packet 人员身份映射，
 *   否则按 Reviewer 契约数组顺序 PRIMARY_1 → PRIMARY_2）→ selected_candidate_id 在 pool 中
 *   解析 URL → RESOLVED；仅一 slot 有 URL → PARTIAL；
 * - Round 2 覆盖 Round 1 只发生在投影（latestByPacket 取最高 round）；DB append-only 历史不变。
 */
export function projectBiographyUrlResult(
  packet: InstitutionWorkPacket,
  latest: ReviewDecisionHistoryRow | null,
  pool: UrlCandidatePoolRow[],
): BiographyUrlResult {
  const p1 = packet.primaryPersons?.primary1 ?? null;
  const p2 = packet.primaryPersons?.primary2 ?? null;

  const approved = latest && latest.roundOutcome === "APPROVED" ? latest : null;
  const reviews = approved?.payload.reviews ?? [];

  const byId = new Map<string, UrlCandidatePoolRow>();
  for (const candidate of pool) {
    const id = typeof candidate.candidate_id === "string" ? candidate.candidate_id : "";
    if (id.length > 0) byId.set(id, candidate);
  }

  const slotForTarget = (targetId: string): BiographyPrimarySlot | null => {
    if (p1 && p1.targetId === targetId) return "PRIMARY_1";
    if (p2 && p2.targetId === targetId) return "PRIMARY_2";
    return null;
  };

  // 逐 review 决议；无 target 匹配时按 Reviewer 契约顺序 PRIMARY_1 → PRIMARY_2 兜底。
  const resolvedBySlot = new Map<BiographyPrimarySlot, { targetId: string }>();
  let fallbackIndex = 0;
  for (const review of reviews) {
    const matched = slotForTarget(review.target_id);
    const slot: BiographyPrimarySlot = matched ?? (fallbackIndex === 0 ? "PRIMARY_1" : "PRIMARY_2");
    if (matched === null) fallbackIndex += 1;
    if (resolvedBySlot.has(slot)) continue;
    resolvedBySlot.set(slot, { targetId: review.target_id });
  }

  const buildSlot = (
    primarySlot: BiographyPrimarySlot,
    person: PrimaryPersonIdentity | null,
  ): BiographyUrlSlotResult => {
    const entry = resolvedBySlot.get(primarySlot);
    if (!entry) {
      return emptySlotResult(primarySlot, person, approved);
    }
    const review = (approved?.payload.reviews ?? []).find((r) => r.target_id === entry.targetId);
    const candidate =
      review && review.selected_candidate_id !== null
        ? byId.get(review.selected_candidate_id)
        : undefined;
    const url = candidate && typeof candidate.url === "string" ? candidate.url : null;
    const resolved =
      review !== undefined &&
      review.review_result === "APPROVED" &&
      review.selected_candidate_id !== null &&
      url !== null;
    return {
      primarySlot,
      targetId: person?.targetId ?? review?.target_id ?? null,
      personId: person?.personId ?? null,
      personName: person?.personName ?? null,
      biographyUrl: resolved ? url : null,
      decisionStatus: resolved ? "RESOLVED" : "UNRESOLVED",
      reviewRound: approved?.reviewRound ?? null,
      sourceReviewId: approved?.sourceReviewId ?? null,
    };
  };

  const primary1 = buildSlot("PRIMARY_1", p1);
  const primary2 = buildSlot("PRIMARY_2", p2);
  const resolvedCount =
    (primary1.decisionStatus === "RESOLVED" ? 1 : 0) +
    (primary2.decisionStatus === "RESOLVED" ? 1 : 0);
  const status: BiographyResultStatus =
    resolvedCount === 2 ? "RESOLVED" : resolvedCount === 1 ? "PARTIAL" : "UNRESOLVED";

  return {
    packetId: packet.packetId,
    regionCode: packet.regionCode ?? null,
    institutionId: packet.institutionId,
    institutionName: packet.institutionName,
    status,
    sourceOfTruth: BIOGRAPHY_RESULT_SOURCE_OF_TRUTH,
    primary1,
    primary2,
  };
}

/**
 * Biography URL Result Reader 容器：new Packet Store + new Review Reader + new
 * pool loader → 重新生成相同 Biography Result（不依赖 Agent Session / LLM）。
 */
export class BiographyUrlResultReader {
  constructor(private readonly deps: BiographyUrlResultReaderDeps) {}

  /** packet 不存在返回 null；否则返回纯投影结果。 */
  async read(packetId: string): Promise<BiographyUrlResult | null> {
    const packet = await this.deps.packetStore.get(packetId);
    if (!packet) return null;
    const latest = await this.deps.reviewReader.latestByPacket(packetId);
    const pool = await this.deps.loadCandidatePool(packetId);
    return projectBiographyUrlResult(packet, latest, pool);
  }
}
