import { Type, type Static } from "@sinclair/typebox";
import { TaskRunStatus, Slot } from "./enums.js";
import { ResultRowView } from "./result.js";

/**
 * SSE 事件联合类型（规格 §19.2）。
 * type 字段作判别；每条事件带 seq 支持断线续传。
 * SSE 只传用户可见中文状态与安全摘要，不传原始 HTML。
 */

const TaskStateChanged = Type.Object({
  type: Type.Literal("task.state_changed"),
  taskRunId: Type.String(),
  status: Type.Enum(TaskRunStatus),
  statusZh: Type.String(),
  seq: Type.Number(),
});
const TaskProgressChanged = Type.Object({
  type: Type.Literal("task.progress_changed"),
  taskRunId: Type.String(),
  processedInstitutions: Type.Number(),
  totalInstitutions: Type.Number(),
  seq: Type.Number(),
});
const InstitutionCompleted = Type.Object({
  type: Type.Literal("institution.completed"),
  taskRunId: Type.String(),
  institutionSnapshotId: Type.String(),
  statusZh: Type.String(),
  seq: Type.Number(),
});
const ResultUpserted = Type.Object({
  type: Type.Literal("result.upserted"),
  taskRunId: Type.String(),
  result: ResultRowView,
  seq: Type.Number(),
});
const ResultReviewed = Type.Object({
  type: Type.Literal("result.reviewed"),
  taskRunId: Type.String(),
  institutionSnapshotId: Type.String(),
  slot: Type.Enum(Slot),
  reviewed: Type.Boolean(),
  seq: Type.Number(),
});
const ResultRecoveryStarted = Type.Object({
  type: Type.Literal("result.recovery_started"),
  taskRunId: Type.String(),
  institutionSnapshotId: Type.String(),
  seq: Type.Number(),
});
const ResultTerminalBlank = Type.Object({
  type: Type.Literal("result.terminal_blank"),
  taskRunId: Type.String(),
  institutionSnapshotId: Type.String(),
  slot: Type.Enum(Slot),
  terminalReasonZh: Type.String(),
  seq: Type.Number(),
});
const ExportReady = Type.Object({
  type: Type.Literal("export.ready"),
  taskRunId: Type.String(),
  filename: Type.String(),
  seq: Type.Number(),
});
const TaskCompleted = Type.Object({
  type: Type.Literal("task.completed"),
  taskRunId: Type.String(),
  statusZh: Type.String(),
  seq: Type.Number(),
});
const TaskFailed = Type.Object({
  type: Type.Literal("task.failed"),
  taskRunId: Type.String(),
  errorMessageZh: Type.String(),
  seq: Type.Number(),
});
const TaskPaused = Type.Object({
  type: Type.Literal("task.paused"),
  taskRunId: Type.String(),
  statusZh: Type.String(),
  seq: Type.Number(),
});
const TaskResumed = Type.Object({
  type: Type.Literal("task.resumed"),
  taskRunId: Type.String(),
  statusZh: Type.String(),
  seq: Type.Number(),
});
const TaskCancelled = Type.Object({
  type: Type.Literal("task.cancelled"),
  taskRunId: Type.String(),
  statusZh: Type.String(),
  seq: Type.Number(),
});

export const SseEvent = Type.Union([
  TaskStateChanged,
  TaskProgressChanged,
  InstitutionCompleted,
  ResultUpserted,
  ResultReviewed,
  ResultRecoveryStarted,
  ResultTerminalBlank,
  ExportReady,
  TaskCompleted,
  TaskFailed,
  TaskPaused,
  TaskResumed,
  TaskCancelled,
]);
export type SseEvent = Static<typeof SseEvent>;

/** 判别字段名（供序列化/反序列化使用）。 */
export const SSE_DISCRIMINATOR = "type" as const;
