/**
 * 业务枚举层（唯一类型合同来源，规格 §6.3）。
 *
 * 这些内部规则枚举使用稳定英文标识，只存在于规则、数据库与代码中；
 * 网页与 Excel 只显示中文结论（见本文件底部的 zh 映射与 §4.1）。
 */

/** 任务生命周期状态（规格 §18.1，12 项）。 */
export const TaskRunStatus = {
  PENDING: "PENDING",
  PREPARING: "PREPARING",
  CRAWLING: "CRAWLING",
  RECOVERING: "RECOVERING",
  REVIEWING: "REVIEWING",
  GENERATING: "GENERATING",
  PAUSED: "PAUSED",
  CANCELLING: "CANCELLING",
  CANCELLED: "CANCELLED",
  COMPLETED: "COMPLETED",
  PARTIAL_COMPLETED: "PARTIAL_COMPLETED",
  FAILED: "FAILED",
} as const;
export type TaskRunStatus = (typeof TaskRunStatus)[keyof typeof TaskRunStatus];

/** 当前性证据强度状态（规格 §13.2，6 项）。 */
export const CurrentnessStatus = {
  CURRENT_COLLECTION_MEMBER: "CURRENT_COLLECTION_MEMBER",
  DETAIL_LINKED_FROM_CURRENT_COLLECTION: "DETAIL_LINKED_FROM_CURRENT_COLLECTION",
  RECENT_CURRENT_OFFICIAL_EVIDENCE: "RECENT_CURRENT_OFFICIAL_EVIDENCE",
  DETAIL_NOT_IN_CURRENT_COLLECTION: "DETAIL_NOT_IN_CURRENT_COLLECTION",
  DETAIL_COLLECTION_CONFLICT: "DETAIL_COLLECTION_CONFLICT",
  CURRENTNESS_UNRESOLVED: "CURRENTNESS_UNRESOLVED",
} as const;
export type CurrentnessStatus =
  (typeof CurrentnessStatus)[keyof typeof CurrentnessStatus];

/** 机构类型（规格 §13.4，14 类）。 */
export const InstitutionType = {
  PARTY_COMMITTEE: "party_committee",
  GOVERNMENT: "government",
  PEOPLE_CONGRESS: "people_congress",
  CPPCC: "cppcc",
  DISCIPLINE_INSPECTION: "discipline_inspection",
  SUPERVISION_COMMITTEE: "supervision_committee",
  COURT: "court",
  PROCURATORATE: "procuratorate",
  GOVERNMENT_DEPARTMENT: "government_department",
  PUBLIC_SECURITY: "public_security",
  DEVELOPMENT_ZONE: "development_zone",
  TOWN_STREET: "town_street",
  MASS_ORGANIZATION: "mass_organization",
  PUBLIC_INSTITUTION: "public_institution",
} as const;
export type InstitutionType =
  (typeof InstitutionType)[keyof typeof InstitutionType];

/** 五类允许页面类型（规格 §4.1）。 */
export const PageType = {
  OFFICIAL_BIOGRAPHY: "OFFICIAL_BIOGRAPHY",
  OFFICIAL_PROFILE_CARD: "OFFICIAL_PROFILE_CARD",
  LEADERSHIP_DIVISION: "LEADERSHIP_DIVISION",
  CURRENT_LEADER_DETAIL: "CURRENT_LEADER_DETAIL",
  CURRENT_LEADER_COLLECTION: "CURRENT_LEADER_COLLECTION",
} as const;
export type PageType = (typeof PageType)[keyof typeof PageType];

/** 任务模式（规格 §5.1 / §5.2）。 */
export const TaskMode = {
  FULL_INSTITUTION: "FULL_INSTITUTION",
  TARGETED: "TARGETED",
} as const;
export type TaskMode = (typeof TaskMode)[keyof typeof TaskMode];

/** 展开层级（规格 §3）。 */
export const ExpandLevel = {
  COUNTY: "COUNTY",
  TOWN_STREET: "TOWN_STREET",
} as const;
export type ExpandLevel = (typeof ExpandLevel)[keyof typeof ExpandLevel];

/** 抓取方式（规格 §10）。 */
export const FetchMode = {
  HTTP: "HTTP",
  PLAYWRIGHT: "PLAYWRIGHT",
  PUBLIC_API: "PUBLIC_API",
} as const;
export type FetchMode = (typeof FetchMode)[keyof typeof FetchMode];

/** 候选 URL 优先级（规格 §9.1）。 */
export const FrontierPriority = {
  P0: 0,
  P1: 1,
  P2: 2,
  P3: 3,
  P4: 4,
} as const;
export type FrontierPriority =
  (typeof FrontierPriority)[keyof typeof FrontierPriority];

/** 两名主要自然人槽位（内部标识，不显示给用户，规格 §21.2）。 */
export const Slot = {
  PRIMARY_1: "PRIMARY_1",
  PRIMARY_2: "PRIMARY_2",
} as const;
export type Slot = (typeof Slot)[keyof typeof Slot];

/** 盲审 Reviewer 决策（规格 §15.3）。 */
export const ReviewDecision = {
  MATCH: "MATCH",
  CONFLICT: "CONFLICT",
} as const;
export type ReviewDecision =
  (typeof ReviewDecision)[keyof typeof ReviewDecision];

/** 机构抓取终态（规格 §8.2：机构抓取失败不删除，仍形成终态记录）。 */
export const InstitutionOutcome = {
  COMPLETED: "COMPLETED",
  BLOCKED: "BLOCKED",
  FAILED: "FAILED",
} as const;
export type InstitutionOutcome =
  (typeof InstitutionOutcome)[keyof typeof InstitutionOutcome];

/** 任务状态 → 用户可见中文（规格 §18.1）。 */
export const TaskRunStatusZh: Record<TaskRunStatus, string> = {
  PENDING: "待开始",
  PREPARING: "正在准备",
  CRAWLING: "正在抓取",
  RECOVERING: "正在恢复搜索",
  REVIEWING: "正在复核",
  GENERATING: "正在生成结果",
  PAUSED: "已暂停",
  CANCELLING: "正在取消",
  CANCELLED: "已取消",
  COMPLETED: "已完成",
  PARTIAL_COMPLETED: "部分完成",
  FAILED: "失败",
};

/** 当前性状态 → 用户可见中文（规格 §13.2，仅规则与数据库，用户可见位置映射中文）。 */
export const CurrentnessStatusZh: Record<CurrentnessStatus, string> = {
  CURRENT_COLLECTION_MEMBER: "当前领导集合成员",
  DETAIL_LINKED_FROM_CURRENT_COLLECTION: "详情由当前领导集合链接",
  RECENT_CURRENT_OFFICIAL_EVIDENCE: "近期官方现任证据",
  DETAIL_NOT_IN_CURRENT_COLLECTION: "详情不在当前领导集合",
  DETAIL_COLLECTION_CONFLICT: "详情与当前领导集合冲突",
  CURRENTNESS_UNRESOLVED: "当前性未解决",
};

/** 五类允许页面类型 → 用户可见中文（规格 §21.2）。 */
export const PageTypeZh: Record<PageType, string> = {
  OFFICIAL_BIOGRAPHY: "个人简介页",
  OFFICIAL_PROFILE_CARD: "个人卡片页",
  LEADERSHIP_DIVISION: "领导分工页",
  CURRENT_LEADER_DETAIL: "当前领导详情页",
  CURRENT_LEADER_COLLECTION: "当前领导集合页",
};
