import path from "node:path";
import { fileURLToPath } from "node:url";
import { listRegions } from "@stellaris/contracts";
import { createRuntimeConfig } from "../config/runtime-config.js";
import { ModelPolicy } from "../model/model-policy.js";
import { PiModelResolver } from "../model/pi-model-resolver.js";
import { OFFICIAL_BIOGRAPHY_SKILL_NAME, SkillRuntime } from "../skill/skill-runtime.js";
import { InventoryAgentRunner } from "../inventory/inventory-agent-runner.js";
import type { InventoryAgentResult } from "../inventory/inventory-types.js";

export const INVENTORY_ARGS_REQUIRED = "INVENTORY_ARGS_REQUIRED" as const;
export const INVENTORY_SMOKE_FAILED = "INVENTORY_SMOKE_FAILED" as const;
export const MODEL_NOT_CONFIGURED = "MODEL_NOT_CONFIGURED" as const;
export const MODEL_NOT_FOUND = "MODEL_NOT_FOUND" as const;

export type InventorySmokeStatus =
  | "OK"
  | typeof INVENTORY_ARGS_REQUIRED
  | typeof MODEL_NOT_CONFIGURED
  | typeof MODEL_NOT_FOUND
  | typeof INVENTORY_SMOKE_FAILED;

export type InventorySmokeMode = "targeted" | "full";

export type InventorySmokeArgs = {
  regionCode: string | undefined;
  institution: string | undefined;
  seedUrl: string | undefined;
  mode: InventorySmokeMode;
  budgetMs: number | undefined;
};

export function parseInventorySmokeArgs(argv: string[]): InventorySmokeArgs {
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
    seedUrl: read("seed-url"),
    mode: read("mode") === "full" ? "full" : "targeted",
    budgetMs:
      budgetMs !== undefined && Number.isFinite(budgetMs) && budgetMs > 0 ? budgetMs : undefined,
  };
}

/**
 * FULL gate: no-seed discovery must actually search, inspect, submit more than
 * one institution, and freeze. TARGETED gate keeps the STEP 8 closure criteria
 * (fetch/render + inspect + submit + freeze) without requiring search.
 */
export function inventorySmokePassed(
  mode: InventorySmokeMode,
  report: Record<string, unknown>,
): boolean {
  const called = (name: string) => report[`${name}_called`] === true;
  if (mode === "full") {
    return (
      report.inventory_frozen === true &&
      called("get_region_context") &&
      called("search_web") &&
      (called("fetch_page") || called("render_page")) &&
      called("inspect_page") &&
      called("submit_inventory") &&
      report.schema_valid === true &&
      typeof report.item_count === "number" &&
      report.item_count > 1
    );
  }
  return (
    report.inventory_frozen === true &&
    called("get_region_context") &&
    (called("fetch_page") || called("render_page")) &&
    called("inspect_page") &&
    called("submit_inventory") &&
    report.schema_valid === true
  );
}

export async function runInventorySmoke(
  args: InventorySmokeArgs,
): Promise<{ status: InventorySmokeStatus; report: Record<string, unknown> }> {
  const { regionCode, institution, seedUrl, mode, budgetMs } = args;
  if (!regionCode) {
    return {
      status: INVENTORY_ARGS_REQUIRED,
      report: { detail: "--region-code is required" },
    };
  }
  if (mode === "targeted" && !institution) {
    return {
      status: INVENTORY_ARGS_REQUIRED,
      report: { detail: "--institution is required in targeted mode" },
    };
  }
  if (mode === "full" && seedUrl) {
    return {
      status: INVENTORY_SMOKE_FAILED,
      report: { detail: "FULL smoke does not accept --seed-url (must be no-seed)" },
    };
  }
  const config = createRuntimeConfig();
  const skillRuntime = new SkillRuntime(config);
  await skillRuntime.reload();
  const skill = await skillRuntime.resolveSkill(OFFICIAL_BIOGRAPHY_SKILL_NAME);

  // Dev-smoke-only budget: abort the Pi session when the timer fires. Cleared
  // in finally so a finished run never leaves a pending timer open.
  const controller = budgetMs ? new AbortController() : undefined;
  const timer = controller ? setTimeout(() => controller.abort(), budgetMs) : undefined;
  let result: InventoryAgentResult;
  try {
    const runner = new InventoryAgentRunner({
      skillRuntime,
      modelPolicy: new ModelPolicy(),
      modelResolver: await PiModelResolver.create(),
      ...(mode === "targeted" && seedUrl ? { devHints: { seedUrl } } : {}),
      ...(controller ? { abortSignal: controller.signal } : {}),
    });
    // For targeted mode the guard above guarantees `institution` is defined.
    const institutionName = mode === "full" ? undefined : institution;
    result = await runner.run(
      mode === "full"
        ? { regionCode, mode: "FULL" }
        : { regionCode, mode: "TARGETED", specifiedInstitutions: institutionName ? [institutionName] : [] },
    );
  } finally {
    if (timer) clearTimeout(timer);
  }

  const tools = new Map(
    (result.status === "COMPLETED" || result.status === "INVENTORY_NOT_SUBMITTED"
      ? result.toolCalls
      : []
    ).map((tool) => [tool.toolName, tool]),
  );
  const called = (name: string) => tools.get(name)?.called ?? false;
  const succeeded = (name: string) => tools.get(name)?.succeeded ?? false;

  if (result.status === "MODEL_NOT_CONFIGURED") {
    return {
      status: MODEL_NOT_CONFIGURED,
      report: { skill_loaded: true, detail: "AGENT_MODEL_PROVIDER/AGENT_MODEL_ID not configured" },
    };
  }
  if (result.status === "MODEL_NOT_FOUND") {
    return {
      status: MODEL_NOT_FOUND,
      report: { skill_loaded: true, detail: `${result.provider}/${result.model} not found` },
    };
  }
  if (result.status === "INVALID_REQUEST") {
    return {
      status: INVENTORY_SMOKE_FAILED,
      report: { skill_loaded: true, detail: result.reason },
    };
  }

  const regionName = listRegions().find((region) => region.code === regionCode)?.name;
  const report: Record<string, unknown> = {
    skill_loaded: true,
    skill_name: skill.name,
    skill_version: skill.version,
    agent_role: "INVENTORY",
    session_created: result.agentSessionId.length > 0,
    mode,
    region_code: regionCode,
    ...(regionName ? { region_name: regionName } : {}),
    institution,
    seed_url_used: mode === "full" ? "NO" : seedUrl ? "YES" : "NO",
    get_region_context_called: called("get_region_context"),
    search_web_called: called("search_web"),
    fetch_page_called: called("fetch_page"),
    render_page_called: called("render_page"),
    inspect_page_called: called("inspect_page"),
    submit_inventory_called: called("submit_inventory"),
    schema_valid: succeeded("submit_inventory"),
    inventory_frozen: result.status === "COMPLETED",
    agent_completed: result.status === "COMPLETED",
    model_provider: result.status === "COMPLETED" ? result.model.provider : undefined,
    item_count: result.status === "COMPLETED" ? result.receipt.itemCount : undefined,
    payload_hash: result.status === "COMPLETED" ? result.receipt.payloadHash : undefined,
  };

  return { status: inventorySmokePassed(mode, report) ? "OK" : INVENTORY_SMOKE_FAILED, report };
}

export function formatInventorySmokeResult(
  status: InventorySmokeStatus,
  report: Record<string, unknown>,
): string {
  const lines = ["INVENTORY_SMOKE", `status: ${status}`];
  for (const [key, value] of Object.entries(report)) {
    if (value === undefined) continue;
    lines.push(`${key}: ${value === true ? "YES" : value === false ? "NO" : String(value)}`);
  }
  return lines.join("\n");
}

async function main(): Promise<void> {
  const args = parseInventorySmokeArgs(process.argv.slice(2));
  const { status, report } = await runInventorySmoke(args);
  process.stdout.write(formatInventorySmokeResult(status, report) + "\n");
  process.exitCode = status === "OK" ? 0 : 1;
}

const entryArg = process.argv[1];
const isEntryPoint = entryArg !== undefined && path.resolve(entryArg) === fileURLToPath(import.meta.url);

if (isEntryPoint) {
  void main();
}
