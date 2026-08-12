import type { PageType } from "@stellaris/contracts";
import type { PageFacts } from "@stellaris/crawler/page-facts.js";

/**
 * 五类允许页面判型（规格 §4.1 / §4.2 纯规则，不调用 LLM）。
 * 返回允许的 PageType，或 forbidden=true 的禁止页面。
 */

export type PageClassification =
  | { pageType: PageType; forbidden: false }
  | { pageType: null; forbidden: true; forbiddenReason: string };

const FORBIDDEN_TITLE_MARKERS = [
  "工作动态",
  "新闻",
  "会议",
  "调研",
  "活动报道",
  "任免",
  "媒体报道",
  "政务公开",
  "机构职能",
  "信息公开",
  "首页",
];

/** 判断标题是否命中禁止信号（新闻/动态/栏目/职能/首页等，规格 §4.2）。 */
function hasForbiddenMarker(title: string, bodyText: string): string | null {
  for (const marker of FORBIDDEN_TITLE_MARKERS) {
    if (title.includes(marker)) {
      return `标题含禁止信号: ${marker}`;
    }
  }
  // 正文强禁止信号：任免/离任/活动报道。
  if (/任免|离任|不再担任|逝世/.test(bodyText)) {
    return "正文含任免/离任信号";
  }
  return null;
}

/**
 * 页面判型：
 * - 含禁止信号 -> forbidden；
 * - 标题/结构匹配五类之一 -> 对应 PageType；
 * - 否则 -> forbidden（未知页面类型，规格 §4.2）。
 */
export function classifyPage(title: string, bodyText: string, facts: PageFacts): PageClassification {
  const forbidden = hasForbiddenMarker(title, bodyText);
  if (forbidden) {
    return { pageType: null, forbidden: true, forbiddenReason: forbidden };
  }

  const t = title;

  // 个人简介/详情：标题含人员姓名 + 岗位（"张三 区长"）。
  if (facts.leadershipMembers.length > 0) {
    // 集合页：包含多名领导 + "领导信息/领导班子/领导成员"。
    if (/领导信息|领导班子|领导成员|领导集体/.test(t) && facts.leadershipMembers.length >= 2) {
      return { pageType: "CURRENT_LEADER_COLLECTION", forbidden: false };
    }
    // 领导分工页。
    if (/分工|职责分工/.test(t)) {
      return { pageType: "LEADERSHIP_DIVISION", forbidden: false };
    }
    // 个人详情/简介页。
    if (/简历|简介|个人资料|现任领导|领导详情/.test(t) || facts.leadershipMembers.length === 1) {
      return { pageType: "OFFICIAL_BIOGRAPHY", forbidden: false };
    }
    return { pageType: "CURRENT_LEADER_COLLECTION", forbidden: false };
  }

  // 详情页无表格结构：标题含机构名 + 岗位关键词（区长/局长/书记等）判为个人简介页。
  const ROLE_MARKERS = /区长|县长|市长|乡长|镇长|局长|主任|书记|院长|检察长|会长|校长|所长|省长|副省长|部|委|厅/;
  if (ROLE_MARKERS.test(t) && facts.bodyText.length > 0) {
    return { pageType: "OFFICIAL_BIOGRAPHY", forbidden: false };
  }
  // 标题为纯姓名 + 正文含简历结构（"，男，汉族，…" 或 岗位关键词）→ 个人简介页（规格 §4.1）。
  // 真实官网领导详情页常以姓名作标题、简历在正文（R-09 校准），无表格结构时按正文岗位词判型。
  if (facts.bodyText.length > 0 && /男，|女，|汉族|省委|党委|主持|负责/.test(facts.bodyText)) {
    return { pageType: "OFFICIAL_BIOGRAPHY", forbidden: false };
  }

  return { pageType: null, forbidden: true, forbiddenReason: "未知页面类型（无领导结构信号）" };
}
