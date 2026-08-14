import type { InventoryAgentRequest } from "./inventory-types.js";

export type InventoryPromptDevHints = { seedUrl?: string };

/** Build the short Inventory role prompt. The Skill is loaded via
 *  ResourceLoader; this prompt never copies SKILL.md. */
export function buildInventoryRolePrompt(
  request: InventoryAgentRequest,
  regionName: string,
  devHints?: InventoryPromptDevHints,
): string {
  const lines = [
    "你正在执行 Stellaris 政务简历采集的 Inventory Agent 任务。",
    "你的角色：INVENTORY。",
    "",
    `目标行政区：${regionName}（代码 ${request.regionCode}）。`,
    `模式：${request.mode}（${request.mode === "TARGETED" ? "仅验证并规范指定机构" : "按 Skill 主动发现机构清单"}）。`,
  ];
  if (
    request.mode === "TARGETED" &&
    request.specifiedInstitutions &&
    request.specifiedInstitutions.length > 0
  ) {
    lines.push("指定机构：");
    for (const institution of request.specifiedInstitutions) {
      lines.push(`- ${institution}`);
    }
  }
  lines.push(
    "",
    "必须严格遵循已加载的 official-biography-evidence Skill 工作流判断机构归属。",
    "先调用 get_region_context 确认行政区。",
  );
  if (request.mode === "FULL") {
    // FULL has no seed URL: the Agent must discover candidate pages itself.
    lines.push(
      "先从 search_web 检索本行政区的候选官方页面（机构官网 / 机构目录），",
      "再 fetch_page / render_page 获取页面。",
      "每个候选机构都必须先用 inspect_page 解析页面为结构化观察，",
      "基于结构化观察判断归属；禁止只凭搜索摘要或页面原文直接提交。",
    );
  } else {
    lines.push("通过 fetch_page / render_page 获取官方页面，用 inspect_page 解析为结构化观察。");
  }
  lines.push(
    "依据 Skill 判断每个机构应 INCLUDE 还是 EXCLUDE；TypeScript 不替你判断。",
    "最终必须调用 submit_inventory 提交结构化 Inventory，禁止用聊天文本代替正式提交。",
    "每次 run 只能成功提交一次 Inventory；不得覆盖已提交结果。",
  );
  if (devHints?.seedUrl) {
    lines.push("", "开发提示（仅本次 smoke）：", `优先从官方入口开始验证：${devHints.seedUrl}`);
  }
  lines.push(
    "",
    "Skill 已通过 ResourceLoader 加载，不要复制 Skill 内容到本提示。",
    "不要读取文件，不要执行 shell，不要使用自由文本提交 Inventory。",
  );
  return lines.join("\n");
}
