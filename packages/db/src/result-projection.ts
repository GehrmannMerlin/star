import type { ResultRowView } from "@stellaris/contracts";
import type { ResultRowRow } from "./types.js";

/**
 * result_row 投影（规格 §21.1 / §28）。
 * 网页与 Excel 只读取同一份已复核 result_row（同一投影，不做语义判断）。
 * 投影只做字段重命名与可选映射，暴露用户可见中文字段，不暴露内部槽位/诊断字段。
 */

export interface TerminalChineseReasons {
  [key: string]: string;
}

/** 用户可见中文终态原因（规格 §28）。 */
export const TERMINAL_REASONS: TerminalChineseReasons = {
  NO_QUALIFIED_URL: "完整搜索后无合格URL",
  PERSON_UNCONFIRMED: "当前人员未确认",
  ROLE_VACANT: "岗位空缺",
  SITE_BLOCKED: "官网访问受限",
  SITE_TIMEOUT: "官网持续超时",
  STRUCTURE_UNCONFIRMED: "官网页面结构无法确认",
  CURRENTNESS_CONFLICT: "当前领导信息相互冲突",
  REVIEWER_CONFLICT: "Reviewer 复核不一致",
  SEARCH_UNAVAILABLE: "搜索服务暂不可用",
  USER_CANCELLED: "任务被用户取消",
  EVIDENCE_CORRUPT: "内部证据完整性错误",
};

/** 未知 code 的中文兜底。 */
const FALLBACK_REASON = "内部证据完整性错误";

/** 将 DB 行投影为合同 ResultRowView（与导出/网页共用）。 */
export function mapResultRowToView(row: ResultRowRow): ResultRowView {
  return {
    id: row.id,
    taskRunId: row.task_run_id,
    institutionSnapshotId: row.institution_snapshot_id,
    slot: row.slot,
    regionCode: row.region_code,
    ...(row.province != null ? { province: row.province } : {}),
    ...(row.city != null ? { city: row.city } : {}),
    ...(row.county != null ? { county: row.county } : {}),
    ...(row.town != null ? { town: row.town } : {}),
    institutionName: row.institution_name,
    positionDisplay: row.position_display,
    ...(row.person_name != null ? { personName: row.person_name } : {}),
    currentStatusZh: row.current_status_zh,
    ...(row.position_url != null ? { positionUrl: row.position_url } : {}),
    ...(row.page_type_zh != null ? { pageTypeZh: row.page_type_zh } : {}),
    resultZh: row.result_zh,
    collectedAt: row.collected_at,
  };
}

/** 解析终态原因 code 为中文；未知 code 返回兜底。 */
export function resolveTerminalReason(code: string): string {
  return TERMINAL_REASONS[code] ?? FALLBACK_REASON;
}
