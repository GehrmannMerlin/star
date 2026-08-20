import path from "node:path";
import { fileURLToPath } from "node:url";
import { readFile } from "node:fs/promises";
import {
  composeToolEventSinks,
  createAgentToolRegistry,
  createSubmitInvestigationTool,
  MemoryToolEventSink,
  ToolFailureCode,
  type InvestigationSubmissionSink,
  type ToolEventSink,
} from "@stellaris/agent-tools";
import { createRuntimeConfig } from "../config/runtime-config.js";
import { ModelPolicy } from "../model/model-policy.js";
import { PiModelResolver } from "../model/pi-model-resolver.js";
import { AgentSessionFactory } from "../session/session-factory.js";
import { OFFICIAL_BIOGRAPHY_SKILL_NAME, SkillRuntime } from "../skill/skill-runtime.js";
import { InMemoryInvestigationSubmissionSink } from "../investigation/investigation-submission-sink.js";
import { createSkillInvestigationValidator } from "../investigation/skill-investigation-validator.js";
import { CanonicalSubmissionContract } from "../investigation/canonical-submission-contract.js";
import { SubmissionRepairGateway } from "../investigation/investigator-agent-runner.js";
import { SkillSchemaRegistry } from "../skill/skill-schema-registry.js";

export const SUBMISSION_ONLY_ARGS_REQUIRED = "SUBMISSION_ONLY_ARGS_REQUIRED" as const;
export const SUBMISSION_ONLY_FIXTURE_FAILED = "SUBMISSION_ONLY_FIXTURE_FAILED" as const;
export const SUBMISSION_ONLY_SMOKE_FAILED = "SUBMISSION_ONLY_SMOKE_FAILED" as const;
export const MODEL_NOT_CONFIGURED = "MODEL_NOT_CONFIGURED" as const;
export const MODEL_NOT_FOUND = "MODEL_NOT_FOUND" as const;

export type SubmissionOnlySmokeStatus =
  | "OK"
  | typeof SUBMISSION_ONLY_ARGS_REQUIRED
  | typeof SUBMISSION_ONLY_FIXTURE_FAILED
  | typeof MODEL_NOT_CONFIGURED
  | typeof MODEL_NOT_FOUND
  | typeof SUBMISSION_ONLY_SMOKE_FAILED;

export type SubmissionOnlySmokeArgs = {
  fixture: string | undefined;
  budgetMs: number | undefined;
};

export function parseSubmissionOnlySmokeArgs(argv: string[]): SubmissionOnlySmokeArgs {
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
    fixture: read("fixture"),
    budgetMs:
      budgetMs !== undefined && Number.isFinite(budgetMs) && budgetMs > 0 ? budgetMs : undefined,
  };
}

/**
 * STEP 19.4 — Submission-only Real DeepSeek Smoke。
 *
 * 用已持久化的合法调查结果（Frozen Finalization Input）驱动真实 Pi Agent +
 * 真实 DeepSeek 只做"提交"：
 *   Frozen Investigation Evidence → Finalization Context → 真实 Pi Agent →
 *   真实 DeepSeek → submit_investigation → Canonical Validator。
 *
 * 强制 Submission Repair Mode（从头开启）：search_web / fetch_page /
 * render_page / inspect_page / get_region_context 全部被网关拒绝。期望
 * Agent 直接调用 submit_investigation 提交冻结结构。
 */
export async function runSubmissionOnlySmoke(
  args: SubmissionOnlySmokeArgs,
): Promise<{ status: SubmissionOnlySmokeStatus; report: Record<string, unknown> }> {
  const fixturePath =
    args.fixture ??
    path.join(
      path.dirname(fileURLToPath(import.meta.url)),
      "fixtures",
      "step9-gulou-investigation.json",
    );

  let fixture: Record<string, unknown>;
  try {
    fixture = JSON.parse(await readFile(fixturePath, "utf8")) as Record<string, unknown>;
  } catch (error) {
    return {
      status: SUBMISSION_ONLY_FIXTURE_FAILED,
      report: {
        detail: `failed to load fixture ${fixturePath}: ${error instanceof Error ? error.message : String(error)}`,
      },
    };
  }

  const institution =
    typeof fixture.institution_name === "string" ? fixture.institution_name : undefined;
  const regionCode =
    typeof fixture.region_code === "string" ? fixture.region_code : undefined;
  const leadership = fixture.leadership as Record<string, unknown> | undefined;
  const selectedOfficials = Array.isArray(fixture.selectedOfficials)
    ? (fixture.selectedOfficials as Record<string, unknown>[])
    : undefined;
  if (!institution || !regionCode || !leadership || !selectedOfficials) {
    return {
      status: SUBMISSION_ONLY_FIXTURE_FAILED,
      report: {
        detail: "fixture must include institution_name, region_code, leadership and selectedOfficials",
      },
    };
  }

  const config = createRuntimeConfig();
  const skillRuntime = new SkillRuntime(config);
  await skillRuntime.reload();
  const identity = await skillRuntime.resolveSkill(OFFICIAL_BIOGRAPHY_SKILL_NAME);
  const modelPolicy = new ModelPolicy();
  const modelResolver = await PiModelResolver.create();

  const controller = args.budgetMs ? new AbortController() : undefined;
  const timer = controller ? setTimeout(() => controller.abort(), args.budgetMs) : undefined;
  const startedAt = Date.now();
  let report: Record<string, unknown>;
  try {
    const validator = await createSkillInvestigationValidator(identity);
    const sink = new InMemoryInvestigationSubmissionSink();
    const eventSink = new MemoryToolEventSink();
    const persistentSink = new MemoryToolEventSink();
    const registry = createAgentToolRegistry({
      submitInvestigationTool: createSubmitInvestigationTool({ validator, sink }),
    });
    const effectiveSink: ToolEventSink = composeToolEventSinks(eventSink, persistentSink);
    const gateway = new SubmissionRepairGateway(registry, effectiveSink);
    // 强制 Submission Repair Mode：禁止一切研究工具。
    gateway.setRepairMode(true);

    const factory = new AgentSessionFactory({
      modelPolicy,
      modelResolver,
      resourceLoader: skillRuntime.getResourceLoader(),
      gateway,
      eventSink,
      registry,
    });
    const created = await factory.createAgentSession("INVESTIGATOR", {
      taskRunId: `submission-only-${Date.now()}`,
    });
    if (created.status !== "READY") {
      report = {
        pi_session_created: false,
        detail:
          created.status === "NOT_CONFIGURED"
            ? "AGENT_MODEL_PROVIDER/AGENT_MODEL_ID not configured"
            : `model not found: ${created.provider}/${created.model}`,
      };
      return { status: MODEL_NOT_CONFIGURED, report };
    }
    const { session, agentSessionId } = created;

    // Finalization Context Projection：只给必要数据（机构/行政区/领导事实/
    // PRIMARY 决定/枚举契约/提交指令），不塞全部 tool events / raw HTML。
    const contract = await loadContract(identity);
    const promptText = buildSubmitOnlyPrompt({
      institution,
      regionCode,
      leadership,
      selectedOfficials,
      agentSessionId,
      contract,
    });

    if (controller) {
      const onAbort = () => void session.abort();
      controller.signal.addEventListener("abort", onAbort, { once: true });
      try {
        await session.prompt(promptText);
      } catch (error) {
        if (!controller.signal.aborted) throw error;
      } finally {
        controller.signal.removeEventListener("abort", onAbort);
      }
    } else {
      await session.prompt(promptText);
    }

    const frozen = await sink.isFrozen();
    const submission = frozen ? await sink.getSubmission() : null;
    const submitStarts = eventSink.starts.filter(
      (event) => event.toolName === "submit_investigation",
    ).length;
    const submitFailures = eventSink.failures.filter(
      (event) =>
        event.toolName === "submit_investigation" &&
        (event.failure.code === ToolFailureCode.SCHEMA_VALIDATION_FAILED ||
          event.failure.code === ToolFailureCode.INVESTIGATION_SCHEMA_VALIDATION_FAILED),
    ).length;
    const researchCalls = eventSink.starts.filter(
      (event) => event.toolName !== "submit_investigation",
    ).length;
    const repairAttempts = Math.min(submitFailures, 2);
    const schemaValid = frozen && submission !== null;
    const durationMs = Date.now() - startedAt;
    const resolvedModel = modelPolicy.resolve("INVESTIGATOR");
    const provider =
      resolvedModel.ok && typeof resolvedModel.provider === "string"
        ? resolvedModel.provider
        : undefined;
    const model =
      resolvedModel.ok && typeof resolvedModel.model === "string"
        ? resolvedModel.model
        : undefined;

    report = {
      pi_session_created: true,
      provider,
      model,
      model_request: true,
      submit_investigation_called: frozen,
      submit_attempts: submitStarts,
      schema_validation_failures: submitFailures,
      repair_attempts: repairAttempts,
      schema_valid: schemaValid,
      search_calls: eventSink.starts.filter((e) => e.toolName === "search_web").length,
      fetch_calls: eventSink.starts.filter((e) => e.toolName === "fetch_page").length,
      render_calls: eventSink.starts.filter((e) => e.toolName === "render_page").length,
      inspect_calls: eventSink.starts.filter((e) => e.toolName === "inspect_page").length,
      get_region_context_calls: eventSink.starts.filter(
        (e) => e.toolName === "get_region_context",
      ).length,
      research_tool_calls_total: researchCalls,
      research_tool_calls_after_first_submit_failure:
        countResearchAfterFirstFailure(eventSink),
      primary_1:
        submission?.selectedOfficials.find((r) => r.primary_slot === "PRIMARY_1")?.person_name ??
        null,
      primary_2:
        submission?.selectedOfficials.find((r) => r.primary_slot === "PRIMARY_2")?.person_name ??
        null,
      institution,
      agent_session_id: agentSessionId,
      skill_name: identity.name,
      skill_version: identity.version,
      duration_ms: durationMs,
    };

    const passed =
      frozen &&
      schemaValid &&
      repairAttempts <= 1 &&
      report.research_tool_calls_total === 0;
    return { status: passed ? "OK" : SUBMISSION_ONLY_SMOKE_FAILED, report };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function countResearchAfterFirstFailure(eventSink: MemoryToolEventSink): number {
  const failures = eventSink.failures.filter((e) => e.toolName === "submit_investigation");
  if (failures.length === 0) return 0;
  const first = failures[0];
  if (!first) return 0;
  return eventSink.starts.filter(
    (e) => e.toolName !== "submit_investigation" && e.startedAt > first.startedAt,
  ).length;
}

async function loadContract(
  identity: { path: string },
): Promise<CanonicalSubmissionContract> {
  const registry = await SkillSchemaRegistry.load(path.join(identity.path, "schemas"));
  const personDecision = registry.get("Person Decision");
  const leadership = registry.get("Leadership Structure");
  if (!personDecision || !leadership) {
    throw new Error("canonical schemas not found");
  }
  return new CanonicalSubmissionContract(personDecision, leadership);
}

/** Finalization Context Projection prompt：只包含提交必需的最小信息。 */
export function buildSubmitOnlyPrompt(opts: {
  institution: string;
  regionCode: string;
  leadership: Record<string, unknown>;
  selectedOfficials: Record<string, unknown>[];
  agentSessionId: string;
  contract: CanonicalSubmissionContract;
}): string {
  const lines = [
    "你正在执行 Stellaris 政务简历采集的 Investigator Agent 任务（仅提交阶段）。",
    "调查已经完成，证据已经过验证。你不需要也不允许进行任何搜索、抓取或检查。",
    "",
    `机构：${opts.institution}`,
    `行政区代码：${opts.regionCode}`,
    "",
    "以下是已经验证的 Leadership Structure（完整结构）：",
    JSON.stringify(opts.leadership),
    "",
    "以下是已经验证的 PRIMARY_1 / PRIMARY_2 Person Decision：",
    JSON.stringify(opts.selectedOfficials),
    "",
    "你的唯一任务：调用 submit_investigation，把上面的 leadership 和 selectedOfficials 原样提交。",
    "禁止修改字段值，禁止重新搜索，禁止调用 search_web / fetch_page / render_page / inspect_page / get_region_context。",
    `investigator_agent_id / investigator_context_id 使用：${opts.agentSessionId}。`,
    "",
    "Person Decision 枚举约束（来自 canonical Skill schema，禁止翻译/缩写/新建）：",
    `- person_status 必须严格从以下值中选择：${opts.contract.personStatusAllowedValues().join(" / ")}`,
    `- currentness_quality 必须严格从以下值中选择：${opts.contract.currentnessQualityAllowedValues().join(" / ")}`,
    "",
    "提交成功后结束任务。",
  ];
  return lines.join("\n");
}

export function formatSubmissionOnlySmokeResult(
  status: SubmissionOnlySmokeStatus,
  report: Record<string, unknown>,
): string {
  const lines = ["SUBMISSION_ONLY_SMOKE", `status: ${status}`];
  for (const [key, value] of Object.entries(report)) {
    if (value === undefined) continue;
    lines.push(`${key}: ${value === true ? "YES" : value === false ? "NO" : String(value)}`);
  }
  return lines.join("\n");
}

async function main(): Promise<void> {
  const args = parseSubmissionOnlySmokeArgs(process.argv.slice(2));
  const { status, report } = await runSubmissionOnlySmoke(args);
  process.stdout.write(formatSubmissionOnlySmokeResult(status, report) + "\n");
  process.exitCode = status === "OK" ? 0 : 1;
}

const entryArg = process.argv[1];
const isEntryPoint =
  entryArg !== undefined && path.resolve(entryArg) === fileURLToPath(import.meta.url);

if (isEntryPoint) {
  void main();
}
