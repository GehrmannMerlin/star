import type { InstitutionWorkPacket } from "../work-packet/institution-work-packet.js";
import type { ValidationIssue } from "@stellaris/agent-tools";
import type { CanonicalSubmissionContract } from "./canonical-submission-contract.js";

export type InvestigationPromptDevHints = { seedUrl?: string };

export type InvestigationPromptOptions = {
  regionCode: string;
  agentSessionId: string;
  devHints?: InvestigationPromptDevHints;
  /** STEP 19.4：Canonical Submission Contract（enum 唯一真相源，动态投影）。 */
  contract?: CanonicalSubmissionContract | undefined;
};

/**
 * 从 Canonical Submission Contract 动态投影枚举约束。
 *
 * 绝不硬编码 enum 副本；这里只把 schema 的真实 allowed values 原样写给模型。
 * 没有 contract 时不输出枚举（保持向后兼容的字段名提示），由 validator 兜底。
 */
function renderEnumContract(
  contract: CanonicalSubmissionContract | undefined,
): string[] {
  if (!contract) return [];
  const lines: string[] = [];
  try {
    const personStatus = contract.personStatusAllowedValues();
    lines.push(`- person_status 必须严格从以下值中选择（禁止翻译、禁止缩写、禁止创建新枚举值）：${personStatus.join(" / ")}`);
  } catch {
    // contract 缺字段时跳过该行（validator 仍会兜底拒绝非法值）。
  }
  try {
    const currentness = contract.currentnessQualityAllowedValues();
    lines.push(`- currentness_quality 必须严格从以下值中选择（禁止翻译、禁止缩写、禁止创建新枚举值）：${currentness.join(" / ")}`);
  } catch {
    // 同上。
  }
  return lines;
}

/**
 * Build the short Investigator role prompt. The Skill is loaded via
 * ResourceLoader; this prompt never copies SKILL.md. Leadership-completeness
 * before PRIMARY selection is a Skill workflow boundary, stated here so the
 * Agent does not stop after two names — the exact "complete" semantics stay
 * in the Skill.
 */
export function buildInvestigationRolePrompt(
  packet: InstitutionWorkPacket,
  opts: InvestigationPromptOptions,
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

  // STEP 19.4：枚举契约动态投影（不硬编码 enum 副本）。
  const enumLines = renderEnumContract(opts.contract);
  if (enumLines.length > 0) {
    lines.push("", "Person Decision 枚举约束（来自 canonical Skill schema）：");
    lines.push(...enumLines);
  }

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

/**
 * STEP 19.4 — Finalize steering。
 *
 * 调查 prompt 结束后 Agent 未提交：给一次短 steering，指示用
 * submit_investigation 提交。不重新发送长 Skill。
 */
export function buildInvestigationFinalizePrompt(
  packet: InstitutionWorkPacket,
  opts: InvestigationPromptOptions,
): string {
  const lines = [
    "调查已完成。不要继续搜索。",
    `请使用 submit_investigation 提交 ${packet.institutionName} 的结构化结果（leadership + selectedOfficials PRIMARY_1/PRIMARY_2）。`,
    `investigator_agent_id / investigator_context_id 使用：${opts.agentSessionId}。`,
  ];
  const enumLines = renderEnumContract(opts.contract);
  if (enumLines.length > 0) {
    lines.push("", "Person Decision 枚举约束（来自 canonical Skill schema）：");
    lines.push(...enumLines);
  }
  lines.push("", "提交成功后结束任务。不要继续调查。");
  return lines.join("\n");
}

/**
 * STEP 19.4 — Repair steering。
 *
 * submit_investigation 因 schema 失败被拒后，把结构化 issue（fieldPath /
 * receivedValue / allowedValues）反馈给 Agent，指示仅修正这些字段后重试。
 * 不重新发送长 Skill，不包含完整 payload。
 */
export function buildInvestigationRepairPrompt(
  issues: ValidationIssue[],
  agentSessionId: string,
): string {
  const lines = [
    "调查已完成，submit_investigation 提交因 schema 校验失败被拒绝。",
    "请仅修正以下字段后再次调用 submit_investigation。不要重新搜索。不要修改已验证证据。不要创建新的枚举值。",
  ];
  issues.forEach((issue, index) => {
    const allowed =
      issue.allowedValues.length > 0 ? issue.allowedValues.join(" / ") : "(无枚举约束)";
    lines.push(
      `- [${index + 1}] 字段 ${issue.fieldPath}：收到值 ${JSON.stringify(issue.receivedValue)}；允许值 ${allowed}`,
    );
  });
  lines.push(`使用 agent id：${agentSessionId}。`);
  lines.push("提交成功后结束任务，不要继续调查。");
  return lines.join("\n");
}
