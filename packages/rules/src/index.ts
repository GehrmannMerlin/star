/**
 * @stellaris/rules —— 规则包骨架（第一阶段）。
 * 页面判型、当前性、领导结构、选人、准入与 Reviewer 在规则阶段按规格实现。
 */
export const RULES_PACKAGE_NAME = "@stellaris/rules" as const;

export { evaluateAccuracy } from "./evaluate.js";
export type {
  GoldenFile,
  GoldenInstitution,
  GoldenPrimary,
  PredictedRow,
  EvaluatedRow,
  AccuracyReport,
} from "./evaluate.js";
