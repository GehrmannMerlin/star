import type { EvidencePrimaryDecision, UrlCandidatePoolRow } from "@stellaris/agent-tools";
import type { InstitutionWorkPacket } from "../work-packet/institution-work-packet.js";

export type ReviewerPromptContext = {
  regionCode: string;
  institutionId: string;
  agentSessionId: string;
  primary1: EvidencePrimaryDecision;
  primary2: EvidencePrimaryDecision;
  candidates: UrlCandidatePoolRow[];
};

/**
 * Short, self-contained Reviewer role prompt. Deliberately does NOT copy the
 * Skill; it points the fresh session at the frozen inputs and the single
 * output boundary (submit_review_decision). Independent search is required as
 * an omission check; the approved candidate must be reopened + inspected in
 * THIS session; the final URL must come from the frozen pool or the review is
 * REWORK_REQUIRED.
 */
export function buildReviewerRolePrompt(
  packet: InstitutionWorkPacket,
  ctx: ReviewerPromptContext,
): string {
  const primary1Name = ctx.primary1.personName ?? "PRIMARY_1";
  const primary2Name = ctx.primary2.personName ?? "PRIMARY_2";
  const lines = ctx.candidates.map((candidate, index) => {
    const id = typeof candidate.candidate_id === "string" ? candidate.candidate_id : `#${index + 1}`;
    const url = typeof candidate.url === "string" ? candidate.url : "";
    const target = typeof candidate.target_id === "string" ? candidate.target_id : "";
    const shape = typeof candidate.page_shape_class === "string" ? candidate.page_shape_class : "";
    const source = typeof candidate.source_domain_class === "string" ? candidate.source_domain_class : "";
    const status = typeof candidate.candidate_status === "string" ? candidate.candidate_status : "";
    return `- candidate_id=${id} target_id=${target} url=${url} page_shape=${shape} source_domain=${source} status=${status}`;
  });

  return [
    "你是本机构岗位信息 URL 的独立 Reviewer。你没有参加 Investigator 的任何决策。",
    "",
    `本机构：${packet.institutionName}（${ctx.regionCode}，institution_id=${ctx.institutionId}）`,
    "",
    "以下输入已经冻结，禁止重新推导、禁止更换人选、禁止改变 PRIMARY slot：",
    `- PRIMARY_1: ${primary1Name}（target_id=${ctx.primary1.targetId}）`,
    `- PRIMARY_2: ${primary2Name}（target_id=${ctx.primary2.targetId}）`,
    "- 岗位信息 URL 候选池（只读，禁止新增/删除/改写候选）：",
    ...lines,
    "",
    "你的职责（只审核 CURRENT POSITION URL，不扩展到任前公示、代理任命、选举任命、离任等其它证据类型）：",
    "1. 先做一次独立的 web search 做遗漏交叉检查（一次 targeted query 即可）。Search 结果只是遗漏检查线索，绝不能直接当作最终 URL。",
    "2. 对你要批准（APPROVE）的候选，必须在本会话内真实 fetch_page（或 render_page）成功打开该 URL，再真实 inspect_page 成功检查它。",
    "3. 依据 official-biography-evidence Skill 的独立审查标准判断每个 PRIMARY：域名归属、页面类型、人员+机构匹配、当前性、新闻/媒体/Wiki/栏目首页污染、遗漏更优官方页面。",
    "4. 每个 PRIMARY 独立决定：",
    "   - APPROVED：所选候选必须在冻结候选池内，且你已在本会话真实打开并检查它。",
    "   - 如果冻结候选池不足以支持该人员+岗位+机构（页面打开失败、错人、池外存在更优官方页面、只有新闻/工作动态等），选择 REWORK_REQUIRED。绝不能伪造最终 URL，绝不允许选择候选池之外的 URL 作为最终结果。",
    "5. 最后必须调用 submit_review_decision，为 PRIMARY_1 和 PRIMARY_2 各提交一条 review（共两条），包含 review_result、final_review_result、review_reason、currentness_quality、checks，以及 selected_candidate_id（批准的池内候选 id；REWORK 时填 null）。",
    "",
    `（Reviewer session id: ${ctx.agentSessionId}）`,
  ].join("\n");
}
