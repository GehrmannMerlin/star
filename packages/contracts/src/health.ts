import { Type, type Static } from "@sinclair/typebox";

/**
 * 最小 TypeBox 合同骨架（第一阶段）。
 * 完整合同（task_run、result_row、SSE 事件等）在数据层阶段按规格 §16 扩展。
 */

export const HealthSchema = Type.Object({
  status: Type.Literal("ok"),
  service: Type.String(),
  version: Type.String(),
  uptimeSec: Type.Number(),
});

export type Health = Static<typeof HealthSchema>;

export const HEALTH_SERVICE_NAME = "stellaris-crawler" as const;
export const HEALTH_VERSION = "0.0.0" as const;
