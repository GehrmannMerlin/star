/**
 * Recovery 触发、预算与顺序（规格 §14.2 / §14.3）。
 * Recovery 必须改变发现路径或验证策略，不得只是刷新原页面。
 */

export interface RecoveryContext {
  urlEmpty: boolean;
  forbidden: boolean;
  personMismatch: boolean;
  institutionMismatch: boolean;
  roleMismatch: boolean;
  currentnessConflict: boolean;
  priorityNotChecked: boolean;
  secondUnconfirmed: boolean;
  reviewerDisagree: boolean;
}

export interface RecoveryDecision {
  triggered: boolean;
  reason?: string;
  nextStrategies: string[];
}

/** 任一触发条件成立即触发 Recovery（规格 §14.2）。 */
export function decideRecovery(context: RecoveryContext): RecoveryDecision {
  const reasons: string[] = [];
  if (context.urlEmpty) reasons.push("URL 为空");
  if (context.forbidden) reasons.push("页面类型被禁止");
  if (context.personMismatch) reasons.push("人员错误");
  if (context.institutionMismatch) reasons.push("机构错误");
  if (context.roleMismatch) reasons.push("岗位错误");
  if (context.currentnessConflict) reasons.push("当前性冲突");
  if (context.priorityNotChecked) reasons.push("未检查更优个人入口");
  if (context.secondUnconfirmed) reasons.push("第二名主要自然人未确认");
  if (context.reviewerDisagree) reasons.push("Reviewer 分歧");

  if (reasons.length === 0) {
    return { triggered: false, nextStrategies: [] };
  }
  return {
    triggered: true,
    reason: reasons.join("；"),
    nextStrategies: buildRecoveryOrder(),
  };
}

/** Recovery 默认顺序（规格 §14.3 八步）。 */
export function buildRecoveryOrder(): string[] {
  return [
    "site_profile_entry",
    "gov_openness_directory",
    "verified_public_api",
    "sitemap_site_search",
    "domain_limited_external_search",
    "role_person_combined_search",
    "superior_current_leader_entry",
    "region_success_pattern",
  ];
}
