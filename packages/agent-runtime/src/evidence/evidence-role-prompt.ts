import type { EvidencePrimaryDecision } from "@stellaris/agent-tools";
import type { InstitutionWorkPacket } from "../work-packet/institution-work-packet.js";

/**
 * Short Investigator Evidence role prompt. Leadership / PRIMARY are frozen
 * inputs; this prompt never re-derives them and never copies SKILL.md. The
 * exact candidate classification / status semantics stay in the Skill.
 */
export function buildEvidenceRolePrompt(
  packet: InstitutionWorkPacket,
  opts: {
    regionCode: string;
    agentSessionId: string;
    primary1: EvidencePrimaryDecision;
    primary2: EvidencePrimaryDecision;
    institutionId: string;
  },
): string {
  const lines = [
    "你正在执行 Stellaris 政务简历采集的 Investigator Agent 任务，当前阶段：Position Evidence（当前岗位信息 URL 候选）。",
    "你的角色：INVESTIGATOR。你只处理当前 Work Packet 中的这一个机构。",
    "",
    "当前 Work Packet：",
    `- packet_id：${packet.packetId}`,
    `- 机构：${packet.institutionName}`,
    `- 机构 id：${opts.institutionId}`,
    `- 行政区代码：${opts.regionCode}`,
    "",
    "Leadership Structure 与 PRIMARY_1 / PRIMARY_2 已经冻结，来自已完成的 STEP 9。",
    `- PRIMARY_1：${opts.primary1.personName ?? "(未确认)"}，target_id=${opts.primary1.targetId}`,
    `- PRIMARY_2：${opts.primary2.personName ?? "(未确认)"}，target_id=${opts.primary2.targetId}`,
    "你绝不能重新判断 PRIMARY_1 / PRIMARY_2，也绝不能重新构建 Leadership Structure。",
    "",
    "你的任务：严格遵循已加载的 official-biography-evidence Skill，为上面两位 PRIMARY 各搜索“当前岗位信息 URL”候选。",
    "对每个候选 URL：必须先用 fetch_page 或 render_page 成功打开页面，然后必须紧接着对同一页面调用一次 inspect_page 得到结构化观察。",
    "搜索摘要（search_web snippet）不是证据；只依据搜索摘要就提交的候选会被运行时拒绝。",
    "",
    "最终必须调用 submit_investigator_evidence 提交候选池：",
    "- candidates：url-candidate-pool 行数组（candidate_id、target_id、evidence_id、url、source_domain_class、page_shape_class、supports_person、supports_institution、supports_role、supports_currentness、candidate_status、accept_or_reject_reason、superseded_by_candidate_id）。",
    `  candidates 中每个 target_id 必须是 ${opts.primary1.targetId} 或 ${opts.primary2.targetId}；两位 PRIMARY 都必须至少有 1 个候选。`,
    "- claims（可选）：target-claim 行数组（claim_id、evidence_id、person_id、institution_id、target_id、role_supported、currentness_supported）。",
    "",
    "本轮只收集候选池，不选择最终 URL，不生成 final decision。",
    "不要读取文件，不要执行 shell，不要使用聊天文本代替正式提交。",
    `investigator_agent_id / investigator_context_id 使用：${opts.agentSessionId}。`,
  ];
  return lines.join("\n");
}
