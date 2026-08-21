import type { ValidationIssue } from "@stellaris/agent-tools";
import type { EvidencePrimaryDecision } from "@stellaris/agent-tools";
import type { InstitutionWorkPacket } from "../work-packet/institution-work-packet.js";
import type { CanonicalEvidenceContract } from "./canonical-evidence-contract.js";

export type EvidencePromptOptions = {
  regionCode: string;
  agentSessionId: string;
  primary1: EvidencePrimaryDecision;
  primary2: EvidencePrimaryDecision;
  institutionId: string;
  /** STEP 20.1：Canonical Evidence Contract（enum 唯一真相源，动态投影）。 */
  contract?: CanonicalEvidenceContract;
};

/**
 * 从 Canonical Evidence Contract 动态投影枚举约束。
 *
 * 绝不硬编码 enum 副本；这里只把 schema 的真实 allowed values 原样写给模型。
 * 没有 contract 时不输出枚举（保持向后兼容的字段名提示），由 validator 兜底。
 */
function renderEvidenceEnumContract(
  contract: CanonicalEvidenceContract | undefined,
): string[] {
  if (!contract) return [];
  const lines: string[] = [];
  for (const entry of contract.enumFields()) {
    if (entry.allowedValues.length === 0) continue;
    lines.push(
      `- ${entry.field} 必须严格从以下值中选择（禁止翻译、禁止缩写、禁止创建新枚举值）：${entry.allowedValues.join(" / ")}`,
    );
  }
  return lines;
}

/**
 * Short Investigator Evidence role prompt. Leadership / PRIMARY are frozen
 * inputs; this prompt never re-derives them and never copies SKILL.md. The
 * exact candidate classification / status semantics stay in the Skill.
 */
export function buildEvidenceRolePrompt(
  packet: InstitutionWorkPacket,
  opts: EvidencePromptOptions,
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

  const enumLines = renderEvidenceEnumContract(opts.contract);
  if (enumLines.length > 0) {
    lines.push("", "URL Candidate Pool 枚举约束（来自 canonical Skill schema）：");
    lines.push(...enumLines);
  }

  return lines.join("\n");
}

/**
 * STEP 20.1 — Evidence Finalize steering。
 *
 * 证据 prompt 结束后 Agent 未提交：给一次短 steering，指示用
 * submit_investigator_evidence 提交。不重新发送长 Skill。
 */
export function buildEvidenceFinalizePrompt(
  packet: InstitutionWorkPacket,
  opts: EvidencePromptOptions,
): string {
  const lines = [
    "证据采集已完成。不要继续搜索。",
    `请使用 submit_investigator_evidence 提交 ${packet.institutionName} 的 URL Candidate Pool（candidates 覆盖 PRIMARY_1 与 PRIMARY_2）。`,
    `investigator_agent_id / investigator_context_id 使用：${opts.agentSessionId}。`,
  ];
  const enumLines = renderEvidenceEnumContract(opts.contract);
  if (enumLines.length > 0) {
    lines.push("", "URL Candidate Pool 枚举约束（来自 canonical Skill schema）：");
    lines.push(...enumLines);
  }
  lines.push("", "提交成功后结束任务。不要继续调查。");
  return lines.join("\n");
}

/**
 * STEP 20.1 — Evidence Repair steering。
 *
 * submit_investigator_evidence 因 schema 失败被拒后，把结构化 issue（fieldPath /
 * receivedValue / allowedValues）反馈给 Agent，指示仅修正这些字段后重试。
 * 不重新发送长 Skill，不包含完整 payload。
 */
export function buildEvidenceRepairPrompt(
  issues: ValidationIssue[],
  agentSessionId: string,
): string {
  const lines = [
    "证据采集已完成，submit_investigator_evidence 提交因 schema 校验失败被拒绝。",
    "请仅修正以下字段后再次调用 submit_investigator_evidence。不要重新搜索。不要修改已验证证据。不要创建新的枚举值。",
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
