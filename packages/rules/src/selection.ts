import type { InstitutionType, Slot } from "@stellaris/contracts";
import type { LeadershipStructure } from "./leadership.js";

/**
 * 两名主要自然人选择（规格 §13.4）。
 * - 按机构类型选择 PRIMARY_1 / PRIMARY_2；
 * - 同一自然人不能占两个槽位；
 * - 正式岗位空缺输出"空缺"（status=VACANT），不用普通副职顶替；
 * - 第二人无法确认进入 UNCONFIRMED（触发 Recovery）。
 */

export interface SlotSelection {
  slot: Slot;
  personName: string | null;
  status: "FILLED" | "VACANT" | "UNCONFIRMED";
}

/** 机构类型 → 主要负责人岗位关键词（按优先级排序）。 */
const PRIMARY_ROLE_KEYWORDS: Partial<Record<InstitutionType, string[]>> = {
  party_committee: ["书记"],
  government: ["省长", "市长", "区长", "县长", "乡长", "镇长", "主任"],
  people_congress: ["主任"],
  cppcc: ["主席"],
  discipline_inspection: ["书记"],
  supervision_committee: ["主任"],
  court: ["院长"],
  procuratorate: ["检察长"],
  government_department: ["局长", "主任", "厅长"],
  public_security: ["局长"],
  development_zone: ["主任", "管委会主任"],
  town_street: ["书记", "乡长", "镇长", "街道办主任"],
  mass_organization: ["主席", "会长"],
  public_institution: ["主任", "所长", "校长", "院长"],
};

const SECONDARY_ROLE_KEYWORDS: Partial<Record<InstitutionType, string[]>> = {
  government: ["常务副省长", "常务副市长", "常务副区长", "常务副县长", "常务副乡长", "常务副镇长", "常务副职"],
  people_congress: ["副主任"],
  cppcc: ["副主席"],
  party_committee: ["副书记"],
  discipline_inspection: ["副书记"],
  supervision_committee: ["副主任"],
  court: ["副院长"],
  procuratorate: ["副检察长"],
  government_department: ["副局长", "副主任"],
  town_street: ["副书记", "副主任"],
  public_institution: ["副主任", "副校长", "副院长"],
};

function matchRole(roles: string[], keywords: string[]): boolean {
  return roles.some((r) => keywords.some((k) => r.includes(k)));
}

/**
 * 选择两名主要自然人。
 * PRIMARY_1：机构正式负责人（含"主持工作"者仍保留原岗位）。
 * PRIMARY_2：常务副职；其次排第一的副职；再其次主持工作；否则 UNCONFIRMED。
 */
export function selectTwoPrimary(
  institutionType: InstitutionType,
  structure: LeadershipStructure,
): [SlotSelection, SlotSelection] {
  const members = [...structure.members].sort((a, b) => a.sortOrder - b.sortOrder);
  const primaryKw = PRIMARY_ROLE_KEYWORDS[institutionType] ?? [];
  const secondaryKw = SECONDARY_ROLE_KEYWORDS[institutionType] ?? [];

  const primary = members.find((m) => matchRole(m.roles, primaryKw));
  const primarySelection: SlotSelection = primary
    ? { slot: "PRIMARY_1", personName: primary.personName, status: "FILLED" }
    : { slot: "PRIMARY_1", personName: null, status: "VACANT" };

  // 第二人：常务副职优先，其次未选中的第一顺位，再其次主持工作。
  const others = members.filter((m) => m.personName !== primary?.personName);
  const secondary =
    others.find((m) => matchRole(m.roles, secondaryKw)) ??
    others.find((m) => /副/.test(m.roles.join(""))) ??
    others.find((m) => /主持工作|主持日常/.test(m.roles.join("")));

  const secondarySelection: SlotSelection = secondary
    ? { slot: "PRIMARY_2", personName: secondary.personName, status: "FILLED" }
    : { slot: "PRIMARY_2", personName: null, status: members.length > 1 ? "UNCONFIRMED" : "VACANT" };

  return [primarySelection, secondarySelection];
}
