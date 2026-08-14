import type { InstitutionWorkPacket } from "../work-packet/institution-work-packet.js";

export type InvestigationPromptDevHints = { seedUrl?: string };

/**
 * Build the short Investigator role prompt. The Skill is loaded via
 * ResourceLoader; this prompt never copies SKILL.md. Leadership-completeness
 * before PRIMARY selection is a Skill workflow boundary, stated here so the
 * Agent does not stop after two names — the exact "complete" semantics stay
 * in the Skill.
 */
export function buildInvestigationRolePrompt(
  packet: InstitutionWorkPacket,
  opts: {
    regionCode: string;
    agentSessionId: string;
    devHints?: InvestigationPromptDevHints;
  },
): string {
  const lines = [
    "你正在执行 Stellaris 政务简历采集的 Investigator Agent 任务。",
    "你的角色：INVESTIGATOR。",
    "你只负责当前 Work Packet 中的这一个机构，不要处理其他机构。",
    "",
    "当前 Work Packet：",
    `- packet_id：${packet.packetId}`,
    `- 机构：${packet.institutionName}`,
    `- 行政区代码：${opts.regionCode}`,
    "",
    "必须严格遵循已加载的 official-biography-evidence Skill 工作流。",
    "先调用 get_region_context 确认行政区上下文。",
    "",
    "必须按 Skill 的机构优先顺序推进：",
    "1. 官网发现：通过 search_web 定位该机构的官网 / 当前领导栏目页面。",
    "2. 用 fetch_page 或 render_page 打开页面。每次成功打开页面后，必须紧接着对同一页面调用一次 inspect_page，把页面解析为结构化观察（领导列表、分工、字段）。",
    "3. 基于 inspect_page 返回的结构化观察构建完整的 Leadership Structure（all_visible_leaders、official_order、party_head/administrative_head 等，structure_complete 必须为 true），结构完整后再进入下一步。",
    "4. 然后依据 Skill 选择 PRIMARY_1 与 PRIMARY_2 两名不同自然人，形成对应的 Person Decision 记录。",
    "",
    "硬性要求：调用 submit_investigation 之前，本次会话必须已经存在至少一次成功的 inspect_page 结构化观察，并且 Leadership Structure 与两条 Person Decision 必须基于该观察构建。运行时会在缺少成功 inspect_page 观察时拒绝本次提交；禁止直接根据搜索摘要或页面原文提交。",
    "",
    "最终必须调用 submit_investigation 提交结构化结果：",
    "- leadership：完整的 Leadership Structure artifact",
    "- selectedOfficials：恰好两条 Person Decision artifact（primary_slot 分别为 PRIMARY_1、PRIMARY_2）",
    "Person Decision 必须引用 leadership 的 structure_id。",
    `investigator_agent_id / investigator_context_id 使用：${opts.agentSessionId}。`,
    "",
    "submit 的 leadership 必须包含：structure_id、institution_id、all_visible_leaders（每人 person_name + visible_roles）、official_order、party_head、administrative_head、party_deputy_secretaries、executive_deputies、other_deputies、vacancy_information、supporting_evidence_ids、structure_complete（必须为 true）、investigator_agent_id、investigator_context_id、decided_at。",
    "selectedOfficials 每人必须包含：person_decision_id、person_id、target_id、institution_id、primary_slot、leadership_structure_id、person_status、person_name、role_canonical、selection_basis、rank_information、responsibility_description、currentness_quality、supporting_evidence_ids、investigator_agent_id、investigator_context_id、decided_at。",
  ];
  if (opts.devHints?.seedUrl) {
    lines.push("", "开发提示（仅本次 smoke）：", `优先从官方入口开始验证：${opts.devHints.seedUrl}`);
  }
  lines.push(
    "",
    "Skill 已通过 ResourceLoader 加载，不要在本提示中复制 Skill 内容。",
    "不要读取文件，不要执行 shell，不要使用聊天文本代替正式提交。",
  );
  return lines.join("\n");
}
