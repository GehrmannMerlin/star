/**
 * Task 状态 → 终态 / 可导出判断（前端纯函数，后端 enum 为唯一事实来源）。
 * 终态与可导出集合与后端 `toTaskSummary` / `projectExportReadiness` 保持一致。
 */

export const TERMINAL_STATUSES: ReadonlySet<string> = new Set([
  "COMPLETED",
  "PARTIAL_COMPLETED",
  "FAILED",
  "CANCELLED",
]);

export const EXPORTABLE_STATUSES: ReadonlySet<string> = new Set([
  "COMPLETED",
  "PARTIAL_COMPLETED",
]);

export function isTerminalStatus(status: string): boolean {
  return TERMINAL_STATUSES.has(status);
}

export function isExportableStatus(status: string): boolean {
  return EXPORTABLE_STATUSES.has(status);
}

/**
 * Agent 运行阶段 → 中文展示（STEP 19.3）。
 * 后端 TaskRunSummary.stage 是唯一事实来源（agent_stage 投影 / status 推导）。
 */
export const STAGE_ZH: Readonly<Record<string, string>> = {
  QUEUED: "排队中",
  PREPARING: "准备中",
  INVENTORY_DISCOVERY: "机构发现",
  INVENTORY_FROZEN: "机构冻结",
  INVESTIGATING: "人员调查",
  EVIDENCE_GATHERING: "证据采集",
  REVIEWING: "复核中",
  RECOVERING: "恢复处理",
  FINALIZING: "结果生成",
  COMPLETED: "已完成",
  PARTIAL_COMPLETED: "部分完成",
  FAILED: "采集失败",
  CANCELLED: "已取消",
};

export function stageZh(stage: string | undefined): string {
  if (!stage) return "—";
  return STAGE_ZH[stage] ?? stage;
}
