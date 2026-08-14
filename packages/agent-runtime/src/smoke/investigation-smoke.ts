import path from "node:path";
import { fileURLToPath } from "node:url";
import { listRegions } from "@stellaris/contracts";
import { MemoryToolEventSink } from "@stellaris/agent-tools";
import { createRuntimeConfig } from "../config/runtime-config.js";
import { ModelPolicy } from "../model/model-policy.js";
import { PiModelResolver } from "../model/pi-model-resolver.js";
import { OFFICIAL_BIOGRAPHY_SKILL_NAME, SkillRuntime } from "../skill/skill-runtime.js";
import { InventoryAgentRunner } from "../inventory/inventory-agent-runner.js";
import { InMemoryInstitutionWorkPacketStore } from "../work-packet/institution-work-packet.js";
import { InvestigatorAgentRunner } from "../investigation/investigator-agent-runner.js";
import type { InvestigationAgentResult } from "../investigation/investigation-types.js";

export const INVESTIGATION_ARGS_REQUIRED = "INVESTIGATION_ARGS_REQUIRED" as const;
export const INVESTIGATION_SMOKE_FAILED = "INVESTIGATION_SMOKE_FAILED" as const;
export const INVENTORY_NOT_FROZEN = "INVENTORY_NOT_FROZEN" as const;
export const PACKET_NOT_CREATED = "PACKET_NOT_CREATED" as const;
export const MODEL_NOT_CONFIGURED = "MODEL_NOT_CONFIGURED" as const;
export const MODEL_NOT_FOUND = "MODEL_NOT_FOUND" as const;

export type InvestigationSmokeStatus =
  | "OK"
  | typeof INVESTIGATION_ARGS_REQUIRED
  | typeof INVENTORY_NOT_FROZEN
  | typeof PACKET_NOT_CREATED
  | typeof MODEL_NOT_CONFIGURED
  | typeof MODEL_NOT_FOUND
  | typeof INVESTIGATION_SMOKE_FAILED;

export type InvestigationSmokeArgs = {
  regionCode: string | undefined;
  institution: string | undefined;
  budgetMs: number | undefined;
};

export function parseInvestigationSmokeArgs(argv: string[]): InvestigationSmokeArgs {
  const read = (name: string): string | undefined => {
    const eq = argv.find((arg) => arg.startsWith(`--${name}=`));
    if (eq) {
      const value = eq.slice(`--${name}=`.length);
      if (value) return value;
    }
    const index = argv.indexOf(`--${name}`);
    const value = index !== -1 ? argv[index + 1] : undefined;
    return value || undefined;
  };
  const budgetRaw = read("budget-ms");
  const budgetMs = budgetRaw !== undefined ? Number(budgetRaw) : undefined;
  return {
    regionCode: read("region-code"),
    institution: read("institution"),
    budgetMs:
      budgetMs !== undefined && Number.isFinite(budgetMs) && budgetMs > 0 ? budgetMs : undefined,
  };
}

/** One-packet smoke gate: every STEP 9 success condition must hold. */
export function investigationSmokePassed(report: Record<string, unknown>): boolean {
  const called = (name: string) => report[`${name}_called`] === true;
  return (
    report.packet_created === true &&
    report.packet_initial_state === "PENDING" &&
    report.investigator_session_created === true &&
    report.skill_loaded === true &&
    report.role === "INVESTIGATOR" &&
    called("get_region_context") &&
    called("search_web") &&
    report.bocha_called === true &&
    (called("fetch_page") || called("render_page")) &&
    called("inspect_page") &&
    called("submit_investigation") &&
    report.leadership_schema_valid === true &&
    report.selected_officials_schema_valid === true &&
    report.primary_1_present === true &&
    report.primary_2_present === true &&
    report.primary_people_distinct === true &&
    report.submission_frozen === true &&
    report.packet_final_state === "READY_FOR_REVIEW" &&
    report.agent_completed === true
  );
}

/**
 * Real one-packet Investigator smoke. Builds a real Frozen TARGETED Inventory
 * through the existing Inventory runtime, generates exactly one Institution
 * Work Packet from it, then runs one Investigator session on that packet.
 */
export async function runInvestigationSmoke(
  args: InvestigationSmokeArgs,
): Promise<{ status: InvestigationSmokeStatus; report: Record<string, unknown> }> {
  const { regionCode, institution, budgetMs } = args;
  if (!regionCode || !institution) {
    return {
      status: INVESTIGATION_ARGS_REQUIRED,
      report: { detail: "--region-code and --institution are required" },
    };
  }

  const config = createRuntimeConfig();
  const skillRuntime = new SkillRuntime(config);
  await skillRuntime.reload();
  const skill = await skillRuntime.resolveSkill(OFFICIAL_BIOGRAPHY_SKILL_NAME);
  const modelPolicy = new ModelPolicy();
  const modelResolver = await PiModelResolver.create();

  const controller = budgetMs ? new AbortController() : undefined;
  const timer = controller ? setTimeout(() => controller.abort(), budgetMs) : undefined;
  let report: Record<string, unknown>;
  try {
    // 1. Real Frozen TARGETED Inventory (reuses the existing Inventory runtime).
    const inventoryRunner = new InventoryAgentRunner({
      skillRuntime,
      modelPolicy,
      modelResolver,
      ...(controller ? { abortSignal: controller.signal } : {}),
    });
    const inventoryResult = await inventoryRunner.run({
      regionCode,
      mode: "TARGETED",
      specifiedInstitutions: [institution],
    });
    if (inventoryResult.status !== "COMPLETED") {
      return {
        status: INVENTORY_NOT_FROZEN,
        report: { skill_loaded: true, detail: `inventory status: ${inventoryResult.status}` },
      };
    }

    // 2. Generate work packets from the frozen inventory (INCLUDE only).
    const packetStore = new InMemoryInstitutionWorkPacketStore();
    const packets = packetStore.createFromFrozenInventory(
      { inventory: inventoryResult.inventory },
      { regionCode },
    );
    const packet = packets.find((p) => p.institutionName === institution) ?? packets[0];
    if (!packet) {
      return {
        status: PACKET_NOT_CREATED,
        report: {
          skill_loaded: true,
          packet_created: false,
          detail: `No INCLUDE packet for the targeted institution: ${institution}`,
        },
      };
    }

    // 3. One Investigator session on that single packet.
    const investigatorEventSink = new MemoryToolEventSink();
    const investigatorRunner = new InvestigatorAgentRunner({
      skillRuntime,
      packetStore,
      modelPolicy,
      modelResolver,
      eventSink: investigatorEventSink,
      ...(controller ? { abortSignal: controller.signal } : {}),
    });
    const result = await investigatorRunner.run({ packetId: packet.packetId });

    report = buildInvestigationReport(result, {
      skill: { name: skill.name, version: skill.version },
      regionCode,
      institution,
      packetId: packet.packetId,
      packetInitialState: packet.state,
      eventSink: investigatorEventSink,
    });
  } finally {
    if (timer) clearTimeout(timer);
  }

  return { status: investigationSmokePassed(report) ? "OK" : INVESTIGATION_SMOKE_FAILED, report };
}

function buildInvestigationReport(
  result: InvestigationAgentResult,
  meta: {
    skill: { name: string; version: string };
    regionCode: string;
    institution: string;
    packetId: string;
    packetInitialState: string;
    eventSink: MemoryToolEventSink;
  },
): Record<string, unknown> {
  const { skill, regionCode, institution, packetId, packetInitialState, eventSink } = meta;
  const called = (name: string) => eventSink.starts.some((event) => event.toolName === name);
  const succeeded = (name: string) =>
    eventSink.successes.some((event) => event.toolName === name);
  const bochaCalled = eventSink.successes.some(
    (event) =>
      event.toolName === "search_web" &&
      (event.data as { provider?: string } | undefined)?.provider === "bocha",
  );

  const regionName = listRegions().find((region) => region.code === regionCode)?.name;
  const fetchOrRenderSucceeded = eventSink.successes.some(
    (event) => event.toolName === "fetch_page" || event.toolName === "render_page",
  );
  const inspectSucceeded = eventSink.successes.some((event) => event.toolName === "inspect_page");
  const report: Record<string, unknown> = {
    skill_loaded: true,
    skill_name: skill.name,
    skill_version: skill.version,
    role: "INVESTIGATOR",
    region_code: regionCode,
    ...(regionName ? { region_name: regionName } : {}),
    institution,
    packet_id: packetId,
    packet_created: true,
    packet_initial_state: packetInitialState,
    get_region_context_called: called("get_region_context"),
    search_web_called: called("search_web"),
    bocha_called: bochaCalled,
    fetch_page_called: called("fetch_page"),
    render_page_called: called("render_page"),
    inspect_page_called: called("inspect_page"),
    submit_investigation_called: succeeded("submit_investigation"),
    fetch_or_render_succeeded: fetchOrRenderSucceeded,
    inspect_succeeded: inspectSucceeded,
    leadership_schema_valid: false,
    selected_officials_schema_valid: false,
    primary_1_present: false,
    primary_2_present: false,
    primary_people_distinct: false,
    submission_frozen: false,
    agent_completed: false,
    packet_final_state: undefined,
    observation_gate: "NO",
  };

  if (result.status === "MODEL_NOT_CONFIGURED") {
    return { ...report, detail: "AGENT_MODEL_PROVIDER/AGENT_MODEL_ID not configured" };
  }
  if (result.status === "MODEL_NOT_FOUND") {
    return { ...report, detail: `${result.provider}/${result.model} not found` };
  }
  if (result.status === "PACKET_NOT_FOUND") {
    return { ...report, detail: `packet not found: ${result.packetId}` };
  }
  if (result.status === "PACKET_ALREADY_STARTED") {
    return { ...report, detail: `packet already started: ${result.packetId}` };
  }
  if (result.status === "INVALID_REQUEST") {
    return { ...report, detail: result.reason };
  }
  if (result.status === "FAILED") {
    report.investigator_session_created = result.agentSessionId.length > 0;
    report.packet_final_state = result.packet.state;
    report.failure_code = result.failureCode;
    // A schema-valid submit may still fail the Observation Gate; surface the
    // actual freeze state for diagnosis.
    report.submission_frozen = succeeded("submit_investigation");
    return report;
  }

  // COMPLETED
  report.investigator_session_created = result.agentSessionId.length > 0;
  const leadership = result.leadership as Record<string, unknown>;
  const primary1 = result.receipt.primary1;
  const primary2 = result.receipt.primary2;
  report.leadership_schema_valid = true;
  report.selected_officials_schema_valid = true;
  report.primary_1 = primary1;
  report.primary_2 = primary2;
  report.primary_1_present = primary1 !== null && primary1 !== undefined;
  report.primary_2_present = primary2 !== null && primary2 !== undefined;
  report.primary_people_distinct = result.receipt.primaryPeopleDistinct;
  report.submission_frozen = result.frozen === true;
  report.packet_final_state = result.packet.state;
  report.agent_completed = result.status === "COMPLETED";
  report.model_provider = result.model.provider;
  report.observation_gate = result.observationGate.passed ? "PASS" : "FAIL";
  const visibleLeaders = Array.isArray(leadership.all_visible_leaders)
    ? leadership.all_visible_leaders.length
    : 0;
  report.leadership_entry_count = visibleLeaders;
  return report;
}

export function formatInvestigationSmokeResult(
  status: InvestigationSmokeStatus,
  report: Record<string, unknown>,
): string {
  const lines = ["INVESTIGATION_SMOKE", `status: ${status}`];
  for (const [key, value] of Object.entries(report)) {
    if (value === undefined) continue;
    lines.push(`${key}: ${value === true ? "YES" : value === false ? "NO" : String(value)}`);
  }
  return lines.join("\n");
}

async function main(): Promise<void> {
  const args = parseInvestigationSmokeArgs(process.argv.slice(2));
  const { status, report } = await runInvestigationSmoke(args);
  process.stdout.write(formatInvestigationSmokeResult(status, report) + "\n");
  process.exitCode = status === "OK" ? 0 : 1;
}

const entryArg = process.argv[1];
const isEntryPoint =
  entryArg !== undefined && path.resolve(entryArg) === fileURLToPath(import.meta.url);

if (isEntryPoint) {
  void main();
}
