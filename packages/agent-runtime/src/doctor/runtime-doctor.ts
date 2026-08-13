import path from "node:path";
import { fileURLToPath } from "node:url";
import { VERSION as PI_SDK_VERSION } from "@earendil-works/pi-coding-agent";
import { createAgentToolRegistry } from "@stellaris/agent-tools";
import type { RuntimeConfig } from "../config/runtime-config.js";
import { createRuntimeConfig } from "../config/runtime-config.js";
import { ModelPolicy } from "../model/model-policy.js";
import type { SkillIdentity } from "../skill/skill-identity.js";
import { OFFICIAL_BIOGRAPHY_SKILL_NAME, SkillRuntime } from "../skill/skill-runtime.js";
import { SkillSchemaRegistry } from "../skill/skill-schema-registry.js";
import { PRODUCTION_TOOL_POLICY, resolveProductionTools } from "../session/tool-policy.js";

export type DoctorStatus = "OK" | "ERROR";

export type DoctorResult = {
  pi_sdk: DoctorStatus;
  pi_version: string;
  skill: { name: string; version: string; path: string; discovery: string; status: DoctorStatus; detail: string };
  schema_registry: { status: DoctorStatus; count: number; detail: string };
  model: { status: "NOT_CONFIGURED" | "CONFIGURED" };
  tool_gateway: { status: DoctorStatus; registered_tools: number; tools: string[]; detail: string };
  production_coding_tools: { enabled: "NO" | "YES"; tools: string[] };
  runtime: "FOUNDATION_READY" | "ERROR";
};

export async function runDoctor(config: RuntimeConfig = createRuntimeConfig()): Promise<DoctorResult> {
  const pi_sdk: DoctorStatus =
    typeof PI_SDK_VERSION === "string" && PI_SDK_VERSION.length > 0 ? "OK" : "ERROR";
  const toolGateway: DoctorResult["tool_gateway"] = {
    status: "ERROR",
    registered_tools: 0,
    tools: [],
    detail: "",
  };

  const skill: DoctorResult["skill"] = {
    name: "",
    version: "",
    path: "",
    discovery: "NOT_DISCOVERED",
    status: "ERROR",
    detail: "",
  };
  const schema: DoctorResult["schema_registry"] = { status: "ERROR", count: 0, detail: "" };

  let identity: SkillIdentity | undefined;
  try {
    const runtime = new SkillRuntime(config);
    await runtime.reload();
    identity = await runtime.resolveSkill(OFFICIAL_BIOGRAPHY_SKILL_NAME);
    skill.name = identity.name;
    skill.version = identity.version;
    skill.path = identity.path;
    skill.discovery = "PI_RESOURCE_LOADER";
    skill.status = "OK";
  } catch (err) {
    skill.detail = err instanceof Error ? err.message : String(err);
  }

  try {
    if (!identity) {
      throw new Error("Skill not resolved; cannot load schemas");
    }
    const registry = await SkillSchemaRegistry.load(path.join(identity.path, "schemas"));
    schema.count = registry.count();
    schema.status = "OK";
  } catch (err) {
    schema.detail = err instanceof Error ? err.message : String(err);
  }

  try {
    const registeredTools = createAgentToolRegistry().list().map((tool) => tool.name);
    toolGateway.registered_tools = registeredTools.length;
    toolGateway.tools = registeredTools;
    toolGateway.status = "OK";
  } catch (err) {
    toolGateway.detail = err instanceof Error ? err.message : String(err);
  }

  const modelResolution = new ModelPolicy().resolve("INVENTORY");
  const modelStatus = modelResolution.ok ? "CONFIGURED" : "NOT_CONFIGURED";

  const tools = resolveProductionTools();
  const productionCodingToolsEnabled: "NO" | "YES" =
    PRODUCTION_TOOL_POLICY.defaultCodingToolsEnabled ? "YES" : "NO";

  const runtimeStatus: DoctorResult["runtime"] =
    pi_sdk === "OK" && skill.status === "OK" && schema.status === "OK" && productionCodingToolsEnabled === "NO"
      && toolGateway.status === "OK"
      ? "FOUNDATION_READY"
      : "ERROR";

  return {
    pi_sdk,
    pi_version: PI_SDK_VERSION,
    skill,
    schema_registry: schema,
    model: { status: modelStatus },
    tool_gateway: toolGateway,
    production_coding_tools: { enabled: productionCodingToolsEnabled, tools },
    runtime: runtimeStatus,
  };
}

export function formatDoctorResult(result: DoctorResult): string {
  const lines = [
    "PI_RUNTIME_DOCTOR",
    `pi_sdk: ${result.pi_sdk}`,
    `pi_version: ${result.pi_version}`,
    "skill:",
    `  name: ${result.skill.name}`,
    `  version: ${result.skill.version}`,
    `  path: ${result.skill.path}`,
    `  discovery: ${result.skill.discovery}`,
    `  status: ${result.skill.status}`,
    "schema_registry:",
    `  status: ${result.schema_registry.status}`,
    `  count: ${result.schema_registry.count}`,
    "model:",
    `  status: ${result.model.status}`,
    "tool_gateway:",
    `  status: ${result.tool_gateway.status}`,
    `  registered_tools: ${result.tool_gateway.registered_tools}`,
    "tools:",
    ...result.tool_gateway.tools.map((tool) => `  - ${tool}`),
    "default_coding_tools:",
    `  enabled: ${result.production_coding_tools.enabled}`,
    `  tools: [${result.production_coding_tools.tools.join(", ")}]`,
    "runtime:",
    `  status: ${result.runtime}`,
  ];
  return lines.join("\n");
}

async function main(): Promise<void> {
  const result = await runDoctor();
  process.stdout.write(formatDoctorResult(result) + "\n");
  process.exitCode = result.runtime === "FOUNDATION_READY" ? 0 : 1;
}

const entryArg = process.argv[1];
const isEntryPoint = entryArg !== undefined && path.resolve(entryArg) === fileURLToPath(import.meta.url);

if (isEntryPoint) {
  void main();
}
