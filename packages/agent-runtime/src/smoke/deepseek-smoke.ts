import path from "node:path";
import { fileURLToPath } from "node:url";
import type { AgentSession } from "@earendil-works/pi-coding-agent";
import {
  createAgentToolRegistry,
  MemoryToolEventSink,
  ToolGateway,
} from "@stellaris/agent-tools";
import type { RuntimeConfig } from "../config/runtime-config.js";
import { createRuntimeConfig } from "../config/runtime-config.js";
import { MODEL_NOT_CONFIGURED, ModelPolicy } from "../model/model-policy.js";
import { MODEL_NOT_FOUND, PiModelResolver } from "../model/pi-model-resolver.js";
import { AgentSessionFactory } from "../session/session-factory.js";
import { PI_DEFAULT_CODING_TOOLS } from "../session/tool-policy.js";
import { OFFICIAL_BIOGRAPHY_SKILL_NAME, SkillRuntime } from "../skill/skill-runtime.js";

export const REGION_CODE_REQUIRED = "REGION_CODE_REQUIRED" as const;
export const AUTHENTICATION_FAILED = "AUTHENTICATION_FAILED" as const;
export const AGENT_SMOKE_FAILED = "AGENT_SMOKE_FAILED" as const;
export const SMOKE_OUTPUT_MARKER = "REGION_CONTEXT_OK";

export type SmokeStatus =
  | "OK"
  | typeof REGION_CODE_REQUIRED
  | typeof MODEL_NOT_CONFIGURED
  | typeof MODEL_NOT_FOUND
  | typeof AUTHENTICATION_FAILED
  | typeof AGENT_SMOKE_FAILED;

export type DeepSeekSmokeResult = {
  status: SmokeStatus;
  provider?: string;
  model?: string;
  skill_loaded?: boolean;
  session_created?: boolean;
  coding_tools?: number;
  custom_tools?: string[];
  tool_called?: boolean;
  tool_status?: string;
  output_marker?: boolean;
  detail?: string;
};

/** Smoke prompt: minimal, the Skill is loaded through the ResourceLoader. */
export function buildSmokePrompt(regionCode: string): string {
  return [
    "你正在执行 Stellaris Agent Runtime 连通性测试。",
    "",
    `目标行政区代码：${regionCode}`,
    "",
    "必须调用 get_region_context 获取真实行政区信息。",
    "",
    "完成 Tool 调用后，用中文输出：",
    "",
    "REGION_CONTEXT_OK",
    "",
    "行政区：",
    "层级：",
    "代码：",
    "",
    "不要调用其它 Tool。",
    "不要读取文件。",
    "不要执行 shell。",
    "不要猜测行政区信息。",
    "",
    "Skill 已通过 ResourceLoader 加载，不要在 Prompt 重新复制 Skill 内容。",
  ].join("\n");
}

export function parseSmokeArgs(argv: string[]): { regionCode?: string } {
  const eq = argv.find((arg) => arg.startsWith("--region-code="));
  if (eq) {
    const value = eq.slice("--region-code=".length);
    if (value) return { regionCode: value };
  }
  const index = argv.indexOf("--region-code");
  const value = index !== -1 ? argv[index + 1] : undefined;
  if (value) return { regionCode: value };
  return {};
}

function extractAssistantText(session: AgentSession): string {
  const texts: string[] = [];
  for (const message of session.messages) {
    if (message.role !== "assistant") continue;
    const content = message.content;
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      if (part.type === "text") texts.push(part.text);
    }
  }
  return texts.join("\n");
}

function httpStatusOf(error: unknown): number | undefined {
  if (error && typeof error === "object") {
    const status = (error as { status?: unknown }).status;
    if (typeof status === "number") return status;
    const response = (error as { response?: { status?: unknown } }).response;
    if (response && typeof response.status === "number") return response.status;
  }
  return undefined;
}

function isAuthError(error: unknown): boolean {
  const status = httpStatusOf(error);
  if (status === 401 || status === 403) return true;
  const message = error instanceof Error ? error.message : String(error);
  return /authentication|unauthorized|invalid.{0,16}(api[ _-]?key|credential)|401|403/i.test(message);
}

/** Strip anything that could carry a credential from a diagnostic detail. */
function redactSecrets(text: string): string {
  return text
    .replace(/authorization\s*:\s*[^\r\n]+/gi, "authorization: ***")
    .replace(/\bsk-[A-Za-z0-9_-]{8,}\b/g, "sk-***")
    .replace(/\b[A-Za-z0-9_-]{40,}\b/g, "***");
}

const CODING_TOOL_NAMES = new Set<string>([...PI_DEFAULT_CODING_TOOLS]);

/**
 * Run one real Pi smoke turn against the server-configured provider.
 *
 * Full vertical slice: RuntimeModelConfig -> ModelPolicy -> Pi Model Registry
 * -> AgentSessionFactory -> Pi AgentSession (Skill loaded via ResourceLoader,
 * get_region_context via ToolGateway) -> prompt -> marker + tool evidence.
 */
export async function runDeepSeekSmoke(
  regionCode: string,
  config: RuntimeConfig = createRuntimeConfig(),
): Promise<DeepSeekSmokeResult> {
  const skillRuntime = new SkillRuntime(config);
  await skillRuntime.reload();
  const skillLoaded = skillRuntime
    .getSkills()
    .some((skill) => skill.name === OFFICIAL_BIOGRAPHY_SKILL_NAME);
  const resourceLoader = skillRuntime.getResourceLoader();

  const resolved = new ModelPolicy().resolve("INVESTIGATOR");
  if (!resolved.ok) {
    return { status: MODEL_NOT_CONFIGURED };
  }

  const resolver = await PiModelResolver.create();
  const model = resolver.resolveConfiguredModel(resolved.provider, resolved.model);
  if (!model.ok) {
    return { status: MODEL_NOT_FOUND, provider: model.provider, model: model.modelId };
  }

  const registry = createAgentToolRegistry();
  const sink = new MemoryToolEventSink();
  const gateway = new ToolGateway(registry, sink);
  const factory = new AgentSessionFactory({
    modelPolicy: new ModelPolicy(),
    modelResolver: resolver,
    resourceLoader,
    gateway,
    eventSink: sink,
    registry,
  });

  const created = await factory.createAgentSession("INVESTIGATOR", {
    taskRunId: `smoke-${regionCode}`,
  });
  if (created.status !== "READY") {
    return {
      status: created.status === "MODEL_NOT_FOUND" ? MODEL_NOT_FOUND : MODEL_NOT_CONFIGURED,
      provider: resolved.provider,
      model: resolved.model,
    };
  }
  const { session } = created;

  try {
    await session.prompt(buildSmokePrompt(regionCode));
  } catch (error) {
    if (isAuthError(error)) {
      return {
        status: AUTHENTICATION_FAILED,
        provider: resolved.provider,
        model: resolved.model,
        session_created: true,
      };
    }
    return {
      status: AGENT_SMOKE_FAILED,
      provider: resolved.provider,
      model: resolved.model,
      session_created: true,
      detail: redactSecrets(error instanceof Error ? error.message : String(error)),
    };
  }

  const activeTools = session.getAllTools().map((tool) => tool.name);
  const codingTools = activeTools.filter((name) => CODING_TOOL_NAMES.has(name));
  const regionCalled = sink.starts.some((event) => event.toolName === "get_region_context");
  const regionSuccess = sink.successes.some((event) => event.toolName === "get_region_context");
  const output = extractAssistantText(session);
  const outputMarker = output.includes(SMOKE_OUTPUT_MARKER);

  const ok =
    skillLoaded &&
    codingTools.length === 0 &&
    activeTools.includes("get_region_context") &&
    regionCalled &&
    regionSuccess &&
    outputMarker;

  const result: DeepSeekSmokeResult = {
    status: ok ? "OK" : AGENT_SMOKE_FAILED,
    provider: resolved.provider,
    model: resolved.model,
    skill_loaded: skillLoaded,
    session_created: true,
    coding_tools: codingTools.length,
    custom_tools: activeTools,
    tool_called: regionCalled,
    tool_status: regionSuccess ? "SUCCESS" : "NOT_SUCCESS",
    output_marker: outputMarker,
  };
  if (!ok) {
    result.detail = "one or more smoke gates not satisfied";
  }
  return result;
}

export function formatSmokeResult(result: DeepSeekSmokeResult): string {
  const lines = ["DEEPSEEK_SMOKE", `status: ${result.status}`];
  if (result.provider) lines.push(`provider: ${result.provider}`);
  if (result.model) lines.push(`model: ${result.model}`);
  if (result.skill_loaded !== undefined) lines.push(`skill_loaded: ${result.skill_loaded ? "YES" : "NO"}`);
  if (result.session_created !== undefined) lines.push(`session_created: ${result.session_created ? "YES" : "NO"}`);
  if (result.coding_tools !== undefined) lines.push(`coding_tools: ${result.coding_tools}`);
  if (result.custom_tools) lines.push("custom_tools:", ...result.custom_tools.map((tool) => `  - ${tool}`));
  if (result.tool_called !== undefined) lines.push(`tool_gateway: ${result.tool_called ? "RECEIVED" : "NOT_RECEIVED"}`);
  if (result.tool_status) lines.push(`tool_status: ${result.tool_status}`);
  if (result.output_marker !== undefined) lines.push(`output_marker: ${result.output_marker ? "REGION_CONTEXT_OK" : "MISSING"}`);
  if (result.detail) lines.push(`detail: ${result.detail}`);
  return lines.join("\n");
}

async function main(): Promise<void> {
  const { regionCode } = parseSmokeArgs(process.argv.slice(2));
  if (!regionCode) {
    process.stdout.write(REGION_CODE_REQUIRED + "\n");
    process.exitCode = 2;
    return;
  }
  const result = await runDeepSeekSmoke(regionCode);
  process.stdout.write(formatSmokeResult(result) + "\n");
  process.exitCode = result.status === "OK" ? 0 : 1;
}

const entryArg = process.argv[1];
const isEntryPoint = entryArg !== undefined && path.resolve(entryArg) === fileURLToPath(import.meta.url);

if (isEntryPoint) {
  void main();
}
