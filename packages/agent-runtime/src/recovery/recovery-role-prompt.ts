import type { EvidencePrimaryDecision, UrlCandidatePoolRow } from "@stellaris/agent-tools";
import type { InstitutionWorkPacket } from "../work-packet/institution-work-packet.js";

export type RecoveryPromptContext = {
  regionCode: string;
  institutionId: string;
  agentSessionId: string;
  primary1: EvidencePrimaryDecision;
  primary2: EvidencePrimaryDecision;
  /** Frozen ORIGINAL candidate pool (read-only). */
  candidates: UrlCandidatePoolRow[];
  /** Frozen canonical review records (the reviewer findings). */
  reviewRecords: Array<Record<string, unknown>>;
};

function reviewLine(review: Record<string, unknown>): string {
  const target = typeof review.target_id === "string" ? review.target_id : "";
  const result = typeof review.review_result === "string" ? review.review_result : "";
  const finalResult =
    typeof review.final_review_result === "string" ? review.final_review_result : "";
  const reason = typeof review.review_reason === "string" ? review.review_reason : "";
  return `- target_id=${target} review_result=${result} final_review_result=${finalResult} reason=${reason}`;
}

/**
 * Short, self-contained Recovery role prompt. Deliberately does NOT copy the
 * Skill; it points the fresh session at the frozen inputs, scopes the work to
 * the Reviewer-identified gap only, and names the single output boundary
 * (submit_recovery_evidence). New candidates must be really opened + inspected
 * in THIS session and must not repeat the frozen original pool.
 */
export function buildRecoveryRolePrompt(
  packet: InstitutionWorkPacket,
  ctx: RecoveryPromptContext,
): string {
  const primary1Name = ctx.primary1.personName ?? "PRIMARY_1";
  const primary2Name = ctx.primary2.personName ?? "PRIMARY_2";
  const candidateLines = ctx.candidates.map((candidate, index) => {
    const id = typeof candidate.candidate_id === "string" ? candidate.candidate_id : `#${index + 1}`;
    const url = typeof candidate.url === "string" ? candidate.url : "";
    const target = typeof candidate.target_id === "string" ? candidate.target_id : "";
    const shape = typeof candidate.page_shape_class === "string" ? candidate.page_shape_class : "";
    const status = typeof candidate.candidate_status === "string" ? candidate.candidate_status : "";
    return `- candidate_id=${id} target_id=${target} url=${url} page_shape=${shape} status=${status}`;
  });

  return [
    "你是 Recovery Agent。当前 Packet 已被独立 Reviewer 标记需要返工（REWORK_REQUIRED），需要你补充缺口。你没有参加 Investigator / Evidence / Reviewer 的任何决策。",
    "",
    `本机构：${packet.institutionName}（${ctx.regionCode}，institution_id=${ctx.institutionId}）`,
    "",
    "以下输入已经冻结，禁止重新推导、禁止更换人选、禁止改变 PRIMARY slot：",
    `- PRIMARY_1: ${primary1Name}（target_id=${ctx.primary1.targetId}）`,
    `- PRIMARY_2: ${primary2Name}（target_id=${ctx.primary2.targetId}）`,
    "- 原岗位 URL 候选池（只读，禁止修改/删除/覆盖）：",
    ...candidateLines,
    "- 独立 Reviewer 冻结结论（review-record）：",
    ...ctx.reviewRecords.map(reviewLine),
    "",
    "你的职责（只针对 Reviewer 标记 REWORK_REQUIRED 的 target 补充 CURRENT POSITION URL 候选；不扩展到任前公示、代理任命、选举任命、离任等其它证据类型）：",
    "1. 只调查 Reviewer 指出的缺口。不要重新调查已 APPROVED 的 PRIMARY。",
    "2. 必须使用与第一轮不同的访问或搜索方式，检查官网领导栏目和个人入口，为缺口 target 寻找官方 CURRENT POSITION URL。",
    "3. 新候选必须在本会话内真实 fetch_page（或 render_page）成功打开该 URL，再真实 inspect_page 成功检查它。Search 结果只是导航线索，绝不能把 search snippet 当作候选。",
    "4. 新候选必须属于本机构（institution_id 匹配）且是缺口 target 对应人员本人的官方当前页面；同名他区/他机构人员的页面属于 WRONG_PERSON/机构不符，不得提交。严禁提交原候选池中已存在的 URL，必须补充真正的新候选。",
    "5. 不能删除/修改原候选，不能改变 PRIMARY，不能执行最终 URL 选择（Finalize 由后续 Reviewer 完成）。",
    "6. 如果确实找不到合格新候选，outcome 用 NO_QUALIFIED_URL_AFTER_COMPLETE_SEARCH 并填写具体中文 remaining_empty_reason，禁止伪造 URL。",
    "7. 最后必须调用 submit_recovery_evidence，提交新候选（url-candidate-pool 格式）和对应的 recovery supplement。",
    "",
    `（Recovery session id: ${ctx.agentSessionId}）`,
  ].join("\n");
}
