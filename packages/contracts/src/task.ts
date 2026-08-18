import { Type, type Static } from "@sinclair/typebox";
import {
  TaskRunStatus,
  TaskMode,
  ExpandLevel,
  InstitutionType,
} from "./enums.js";

/**
 * 任务边界合同（第一闭环收敛子集，规格 §4.1 / §6.1 / §18.3）。
 * 指定机构或人员模式：一个行政区 + 一个机构，人员可选（只缩小目标，不跳过准入/Reviewer）。
 */

/** 创建任务请求。 */
export const CreateTaskRequest = Type.Object({
  clientIdempotencyKey: Type.String({ minLength: 8, maxLength: 128 }),
  /** 任务模式：TARGETED（默认，指定单机构）或 FULL_INSTITUTION（完整机构模式）。 */
  mode: Type.Optional(Type.Enum(TaskMode)),
  /** 行政区划代码（文本，保留前导零，规格 §8.1）。 */
  regionCode: Type.String({ minLength: 6, maxLength: 16 }),
  regionName: Type.String({ minLength: 1, maxLength: 128 }),
  /** 指定机构模式必填；完整机构模式由机构发现自动产生，可省略。 */
  institutionName: Type.Optional(Type.String({ minLength: 1, maxLength: 255 })),
  /** 可选：只缩小目标，不跳过完整领导结构/URL 准入/Reviewer。 */
  personName: Type.Optional(Type.String({ maxLength: 128 })),
  officialEntryUrl: Type.Optional(Type.String({ maxLength: 2048 })),
  institutionType: Type.Optional(Type.Enum(InstitutionType)),
  /** 多行政区代码清单（FULL_INSTITUTION 模式可选；TARGETED 忽略）。 */
  regionCodes: Type.Optional(Type.Array(Type.String({ minLength: 6, maxLength: 16 }))),
  /** 展开层级（FULL_INSTITUTION 模式；默认 COUNTY，可选 TOWN_STREET）。 */
  expandLevel: Type.Optional(Type.Enum(ExpandLevel)),
  ruleVersion: Type.String({ minLength: 1, maxLength: 64 }),
});
export type CreateTaskRequest = Static<typeof CreateTaskRequest>;

/**
 * Agent 运行阶段（STEP 19.3：任务状态卡展示）。
 * 由后端从运行态投影（agent_stage / status / progress），非 DB enum；
 * 不与 TaskRunStatus 重复——Status 是终态/控制语义，Stage 是 Agent 工作流进度。
 */
export const TaskStage = Type.Union([
  Type.Literal("QUEUED"),
  Type.Literal("PREPARING"),
  Type.Literal("INVENTORY_DISCOVERY"),
  Type.Literal("INVENTORY_FROZEN"),
  Type.Literal("INVESTIGATING"),
  Type.Literal("EVIDENCE_GATHERING"),
  Type.Literal("REVIEWING"),
  Type.Literal("RECOVERING"),
  Type.Literal("FINALIZING"),
  Type.Literal("COMPLETED"),
  Type.Literal("PARTIAL_COMPLETED"),
  Type.Literal("FAILED"),
  Type.Literal("CANCELLED"),
]);
export type TaskStage = Static<typeof TaskStage>;

/** 任务摘要（用户可见中文状态 + 真实计数）。 */
export const TaskRunSummary = Type.Object({
  id: Type.String(),
  status: Type.Enum(TaskRunStatus),
  statusZh: Type.String(),
  mode: Type.Enum(TaskMode),
  expandLevel: Type.Enum(ExpandLevel),
  ruleVersion: Type.String(),
  totalInstitutions: Type.Number(),
  processedInstitutions: Type.Number(),
  reviewedSlots: Type.Number(),
  recoveryCount: Type.Number(),
  blockedCount: Type.Number(),
  requestedAt: Type.String(),
  startedAt: Type.Optional(Type.String()),
  finishedAt: Type.Optional(Type.String()),
  errorMessage: Type.Optional(Type.String()),
  /** STEP 19.3：Agent 运行阶段（由后端投影；legacy 任务从 status/progress 推导）。 */
  stage: TaskStage,
  /** STEP 19.3：当前正在处理的机构名（Agent 进度；可能暂无）。 */
  currentInstitution: Type.Optional(Type.String()),
  /** 是否可执行暂停/取消等控制操作（非终态，规格 §19.1）。 */
  controlable: Type.Boolean(),
});
export type TaskRunSummary = Static<typeof TaskRunSummary>;

/** 任务控制响应（暂停/继续/取消/复制，规格 §19.1）。 */
export const TaskControlResponse = Type.Object({
  ok: Type.Boolean(),
  task: Type.Optional(TaskRunSummary),
  newTaskId: Type.Optional(Type.String()),
  error: Type.Optional(Type.String()),
});
export type TaskControlResponse = Static<typeof TaskControlResponse>;

/** 创建任务响应：created=首次创建，replayed=命中既有幂等键。 */
export const CreateTaskResponse = Type.Object({
  task: TaskRunSummary,
  idempotencyResult: Type.Union([
    Type.Literal("created"),
    Type.Literal("replayed"),
  ]),
});
export type CreateTaskResponse = Static<typeof CreateTaskResponse>;

/** 任务列表查询参数（P3：GET /api/tasks 分页/筛选）。 */
export const TaskListParams = Type.Object({
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })),
  offset: Type.Optional(Type.Integer({ minimum: 0 })),
  status: Type.Optional(Type.Enum(TaskRunStatus)),
  mode: Type.Optional(Type.Enum(TaskMode)),
});
export type TaskListParams = Static<typeof TaskListParams>;

/** 任务列表响应（P3：最近任务摘要数组 + 总数）。 */
export const TaskListResponse = Type.Object({
  tasks: Type.Array(TaskRunSummary),
  total: Type.Number(),
});
export type TaskListResponse = Static<typeof TaskListResponse>;

/** 冻结行政区范围快照（规格 §16.1）。 */
export const TargetScopeView = Type.Object({
  id: Type.String(),
  taskRunId: Type.String(),
  regionCode: Type.String(),
  regionName: Type.String(),
  parentRegionCode: Type.Optional(Type.String()),
  regionLevel: Type.String(),
  included: Type.Boolean(),
});
export type TargetScopeView = Static<typeof TargetScopeView>;

/** 冻结机构快照（规格 §16.1 / §8.2，失败时保留终态）。 */
export const InstitutionSnapshotView = Type.Object({
  id: Type.String(),
  taskRunId: Type.String(),
  regionCode: Type.String(),
  officialName: Type.String(),
  commonName: Type.Optional(Type.String()),
  institutionType: Type.Enum(InstitutionType),
  officialEntryUrl: Type.Optional(Type.String()),
  discoverySource: Type.String(),
  selectTwoPrimary: Type.Boolean(),
  frozenAt: Type.String(),
  status: Type.String(),
  terminalReason: Type.Optional(Type.String()),
});
export type InstitutionSnapshotView = Static<typeof InstitutionSnapshotView>;

/** 任务详情（含冻结范围 + 单一机构快照）。 */
export const TaskDetail = Type.Object({
  task: TaskRunSummary,
  scopes: Type.Array(TargetScopeView),
  institution: InstitutionSnapshotView,
});
export type TaskDetail = Static<typeof TaskDetail>;

// ─────────────────────────── Biography Task Result（STEP 17） ───────────────────────────

/** 单个 PRIMARY 人员的 Biography URL 结果（decisionStatus：RESOLVED | UNRESOLVED）。 */
export const BiographyTaskPrimaryResult = Type.Object({
  decisionStatus: Type.Union([Type.Literal("RESOLVED"), Type.Literal("UNRESOLVED")]),
  biographyUrl: Type.Union([Type.String(), Type.Null()]),
});

/** 单个机构（Packet）的 Biography 采集结果摘要。 */
export const BiographyTaskInstitutionResult = Type.Object({
  packetId: Type.String(),
  institutionId: Type.String(),
  institutionName: Type.String(),
  /** RESOLVED | PARTIAL | UNRESOLVED | FAILED（Packet 级投影状态）。 */
  status: Type.String(),
  packetState: Type.String(),
  primary1: Type.Union([BiographyTaskPrimaryResult, Type.Null()]),
  primary2: Type.Union([BiographyTaskPrimaryResult, Type.Null()]),
});

/**
 * Biography Task Result 投影（STEP 17）。
 * 只存 RegionBiographyBatchResult 的 aggregation/projection 摘要；PRIMARY Biography URL
 * 最终事实仍是 latest frozen APPROVED review。读取无需 Agent / LLM。
 */
export const BiographyTaskResultView = Type.Object({
  taskId: Type.String(),
  regionCode: Type.String(),
  regionName: Type.Optional(Type.String()),
  /** COMPLETED | PARTIAL_COMPLETED | FAILED（确定性终态投影）。 */
  status: Type.String(),
  totalPackets: Type.Number(),
  resolvedPackets: Type.Number(),
  partialPackets: Type.Number(),
  unresolvedPackets: Type.Number(),
  failedPackets: Type.Number(),
  results: Type.Array(BiographyTaskInstitutionResult),
});
export type BiographyTaskResultView = Static<typeof BiographyTaskResultView>;

/** Biography Task Result 查询响应（无结果时 biographyResult 为 null）。 */
export const BiographyTaskResultResponse = Type.Object({
  taskId: Type.String(),
  taskStatus: Type.Enum(TaskRunStatus),
  biographyResult: Type.Union([BiographyTaskResultView, Type.Null()]),
});
export type BiographyTaskResultResponse = Static<typeof BiographyTaskResultResponse>;
