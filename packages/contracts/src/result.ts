import { Type, type Static } from "@sinclair/typebox";
import { Slot } from "./enums.js";

/**
 * 结果与证据边界合同（规格 §21.1 / §20.4）。
 * 网页与 Excel 只读取同一份已复核 result_row（同一投影，不做语义判断）。
 */

/** 用户可见结果行（两槽位各一行；不显示 PRIMARY_1/PRIMARY_2 内部标识）。 */
export const ResultRowView = Type.Object({
  id: Type.String(),
  taskRunId: Type.String(),
  institutionSnapshotId: Type.String(),
  slot: Type.Enum(Slot),
  regionCode: Type.String(),
  province: Type.Optional(Type.String()),
  city: Type.Optional(Type.String()),
  county: Type.Optional(Type.String()),
  town: Type.Optional(Type.String()),
  institutionName: Type.String(),
  /** 完整岗位显示值（正式机构 + 正式岗位，规格 §21.2）。 */
  positionDisplay: Type.String(),
  personName: Type.Optional(Type.String()),
  /** 当前状态中文：正式在任/代理中/主持工作/暂未确认/空缺。 */
  currentStatusZh: Type.String(),
  /** 岗位信息 URL（仅有通过的 Reviewer 决策才非空）。 */
  positionUrl: Type.Optional(Type.String()),
  pageTypeZh: Type.Optional(Type.String()),
  /** 采集结果中文。 */
  resultZh: Type.String(),
  collectedAt: Type.String(),
});
export type ResultRowView = Static<typeof ResultRowView>;

/** 证据摘要（证据抽屉展示；不含内部打分/Worker/英文枚举）。 */
export const EvidenceSummary = Type.Object({
  pageTypeZh: Type.Optional(Type.String()),
  collectorAccessedAt: Type.Optional(Type.String()),
  reviewerAccessedAt: Type.Optional(Type.String()),
  currentnessRelationZh: Type.Optional(Type.String()),
  supportingSnippets: Type.Array(Type.String()),
  terminalReasonZh: Type.Optional(Type.String()),
  officialSourceUrls: Type.Array(Type.String()),
});
export type EvidenceSummary = Static<typeof EvidenceSummary>;

/** 证据详情。 */
export const EvidenceDetail = Type.Object({
  summary: EvidenceSummary,
  documentSnapshotId: Type.Optional(Type.String()),
  contentHash: Type.Optional(Type.String()),
  relativePath: Type.Optional(Type.String()),
});
export type EvidenceDetail = Static<typeof EvidenceDetail>;
