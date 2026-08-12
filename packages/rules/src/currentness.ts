import type { CurrentnessStatus } from "@stellaris/contracts";
import type { PageFacts } from "@stellaris/crawler/page-facts.js";

/**
 * 当前性证据图（规格 §13.2）。
 * 六状态判定；弱辅助（页面日期/搜索摘要）不能单独确认当前性。
 */

/**
 * 判定某人员的当前性状态。
 * @param collectionMemberHrefs 当前领导集合页中的人员详情链接
 * @param detailHref 该人员详情页 URL（若存在）
 * @param factsList 相关页面事实
 */
export function evaluateCurrentness(
  personName: string,
  input: {
    collectionMemberHrefs: string[];
    detailHref: string | null;
    factsList: PageFacts[];
  },
): CurrentnessStatus {
  const { collectionMemberHrefs, detailHref } = input;

  // 详情页 URL 在集合成员链接中：DETAIL_LINKED_FROM_CURRENT_COLLECTION。
  if (detailHref && collectionMemberHrefs.some((href) => href === detailHref || href.endsWith(detailHref))) {
    return "DETAIL_LINKED_FROM_CURRENT_COLLECTION";
  }

  // 人员在集合页出现：CURRENT_COLLECTION_MEMBER。
  const inCollection = input.factsList.some((f) =>
    f.leadershipMembers.some((m) => m.name === personName),
  );
  if (inCollection) {
    return "CURRENT_COLLECTION_MEMBER";
  }

  // 详情页存在但不在当前集合：DETAIL_NOT_IN_CURRENT_COLLECTION（触发 Recovery）。
  if (detailHref) {
    return "DETAIL_NOT_IN_CURRENT_COLLECTION";
  }

  return "CURRENTNESS_UNRESOLVED";
}
