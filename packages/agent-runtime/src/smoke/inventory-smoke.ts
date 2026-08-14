import path from "node:path";
import { fileURLToPath } from "node:url";
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

export type InventorySmokeArgs = {
  regionCode: string | undefined;
  institution: string | undefined;
  seedUrl: string | undefined;
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
  return {
    regionCode: read("region-code"),
    institution: read("institution"),
    seedUrl: read("seed-url"),
  };
}

export async function runInventorySmoke(
  args: InventorySmokeArgs,
): Promise<{ status: InventorySmokeStatus; report: Record<string, unknown> }> {
  const { regionCode, institution, seedUrl } = args;
  if (!regionCode || !institution) {
    return {
      status: INVENTORY_ARGS_REQUIRED,
      report: { detail: "--region-code and --institution are required" },
    };
  }
  const config = createRuntimeConfig();
  const skillRuntime = new SkillRuntime(config);
  await skillRuntime.reload();
  const skill = await skillRuntime.resolveSkill(OFFICIAL_BIOGRAPHY_SKILL_NAME);

  const runner = new InventoryAgentRunner({
    skillRuntime,
    modelPolicy: new ModelPolicy(),
    modelResolver: await PiModelResolver.create(),
    ...(seedUrl ? { devHints: { seedUrl } } : {}),
  });
  const result: InventoryAgentResult = await runner.run({
    regionCode,
    mode: "TARGETED",
    specifiedInstitutions: [institution],
  });

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

  const report: Record<string, unknown> = {
    skill_loaded: true,
    skill_name: skill.name,
    skill_version: skill.version,
    agent_role: "INVENTORY",
    session_created: result.agentSessionId.length > 0,
    region_code: regionCode,
    institution,
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

  const ok =
    result.status === "COMPLETED" &&
    called("get_region_context") &&
    (called("fetch_page") || called("render_page")) &&
    called("inspect_page") &&
    called("submit_inventory") &&
    succeeded("submit_inventory");
  return { status: ok ? "OK" : INVENTORY_SMOKE_FAILED, report };
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
