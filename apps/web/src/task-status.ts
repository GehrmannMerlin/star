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
