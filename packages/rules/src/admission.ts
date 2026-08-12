import type { CurrentnessStatus, PageType } from "@stellaris/contracts";

/**
 * 九项最终 URL 硬门槛（规格 §4.3）。
 * 任何硬门槛失败都不能被候选分数抵消。
 */

export const HARD_GATES = [
  "official_domain",
  "allowed_page_type",
  "supports_person",
  "supports_institution",
  "supports_official_role",
  "currentness_ok",
  "priority_entry_checked",
  "reviewer_consistent",
  "no_forbidden_signal",
] as const;

export type HardGate = (typeof HARD_GATES)[number];

export interface HardGateResult {
  passed: boolean;
  failures: Array<{ gate: HardGate; reason: string }>;
}

export interface HardGateInput {
  url: string;
  pageType: PageType;
  forbidden: boolean;
  personName: string;
  institutionName: string;
  officialRole: string;
  currentness: CurrentnessStatus;
  priorityEntryChecked: boolean;
  reviewerConsistent: boolean;
  officialDomains: string[];
  forbiddenSignals: string[];
}

const CURRENTNESS_OK: ReadonlySet<CurrentnessStatus> = new Set([
  "CURRENT_COLLECTION_MEMBER",
  "DETAIL_LINKED_FROM_CURRENT_COLLECTION",
  "RECENT_CURRENT_OFFICIAL_EVIDENCE",
]);

export function checkHardGates(input: HardGateInput): HardGateResult {
  const failures: Array<{ gate: HardGate; reason: string }> = [];

  const push = (gate: HardGate, reason: string): void => {
    failures.push({ gate, reason });
  };

  // 1. 官方域名。
  const host = new URL(input.url).hostname;
  const isOfficial = input.officialDomains.some((d) => host === d || host.endsWith(`.${d}`));
  if (!isOfficial) {
    push("official_domain", `域名 ${host} 不在官方域清单内`);
  }

  // 2. 五类允许页面类型。
  const ALLOWED: PageType[] = [
    "OFFICIAL_BIOGRAPHY",
    "OFFICIAL_PROFILE_CARD",
    "LEADERSHIP_DIVISION",
    "CURRENT_LEADER_DETAIL",
    "CURRENT_LEADER_COLLECTION",
  ];
  if (!ALLOWED.includes(input.pageType)) {
    push("allowed_page_type", `页面类型 ${input.pageType} 不在五类允许内`);
  }
  if (input.forbidden) {
    push("no_forbidden_signal", "页面含禁止类型信号");
  }

  // 3-5. 人员/机构/岗位（由抽取与断言结果支撑，这里校验输入非空且一致）。
  if (!input.personName) {
    push("supports_person", "未明确支持目标自然人");
  }
  if (!input.institutionName) {
    push("supports_institution", "未明确支持目标机构");
  }
  if (!input.officialRole) {
    push("supports_official_role", "未明确支持目标正式岗位");
  }

  // 6. 当前性成立。
  if (!CURRENTNESS_OK.has(input.currentness)) {
    push("currentness_ok", `当前性状态 ${input.currentness} 不满足`);
  }

  // 7. 已检查更优个人入口。
  if (!input.priorityEntryChecked) {
    push("priority_entry_checked", "未检查优先级更高的官方个人入口");
  }

  // 8. Reviewer 独立复抓一致。
  if (!input.reviewerConsistent) {
    push("reviewer_consistent", "Reviewer 独立复抓结论不一致");
  }

  // 9. 禁止信号。
  if (input.forbiddenSignals.length > 0) {
    push("no_forbidden_signal", `页面含禁止信号: ${input.forbiddenSignals.join(", ")}`);
  }

  return { passed: failures.length === 0, failures };
}
