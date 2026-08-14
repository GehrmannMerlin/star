import path from "node:path";
import { fileURLToPath } from "node:url";
import { readFile } from "node:fs/promises";
import { listRegions } from "@stellaris/contracts";
import {
  MemoryToolEventSink,
  normalizeUrlForJoin,
  type UrlCandidatePoolRow,
} from "@stellaris/agent-tools";
import { createRuntimeConfig } from "../config/runtime-config.js";
import { ModelPolicy } from "../model/model-policy.js";
import { PiModelResolver } from "../model/pi-model-resolver.js";
import { OFFICIAL_BIOGRAPHY_SKILL_NAME, SkillRuntime } from "../skill/skill-runtime.js";
import { InMemoryInstitutionWorkPacketStore } from "../work-packet/institution-work-packet.js";
import { ReviewerAgentRunner } from "../reviewer/reviewer-agent-runner.js";
import type { ReviewerResult } from "../reviewer/reviewer-types.js";

export const REVIEWER_ARGS_REQUIRED = "REVIEWER_ARGS_REQUIRED" as const;
export const REVIEWER_SMOKE_FAILED = "REVIEWER_SMOKE_FAILED" as const;
export const FIXTURE_LOAD_FAILED = "FIXTURE_LOAD_FAILED" as const;
export const MODEL_NOT_CONFIGURED = "MODEL_NOT_CONFIGURED" as const;
export const MODEL_NOT_FOUND = "MODEL_NOT_FOUND" as const;

export type ReviewerSmokeStatus =
  | "OK"
  | typeof REVIEWER_ARGS_REQUIRED
  | typeof FIXTURE_LOAD_FAILED
  | typeof MODEL_NOT_CONFIGURED
  | typeof MODEL_NOT_FOUND
  | typeof REVIEWER_SMOKE_FAILED;

export type ReviewerSmokeArgs = {
  regionCode: string | undefined;
  institution: string | undefined;
  budgetMs: number | undefined;
  fixture: string | undefined;
};

export function parseReviewerSmokeArgs(argv: string[]): ReviewerSmokeArgs {
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
    fixture: read("fixture"),
    budgetMs:
      budgetMs !== undefined && Number.isFinite(budgetMs) && budgetMs > 0 ? budgetMs : undefined,
  };
}

/** One-packet Reviewer smoke gate: every STEP 12 success condition must hold. */
export function reviewerSmokePassed(report: Record<string, unknown>): boolean {
  const called = (name: string) => report[`${name}_called`] === true;
  return (
    report.reviewer_session_created === true &&
    report.fresh_session === true &&
    report.investigator_session_reused === false &&
    report.evidence_session_reused === false &&
    report.skill_loaded === true &&
    report.role === "REVIEWER" &&
    called("search_web") &&
    report.bocha_called === true &&
    (called("fetch_page") || called("render_page")) &&
    called("inspect_page") &&
    called("submit_review_decision") &&
    report.primary_1_outcome === "APPROVED" &&
    report.primary_2_outcome === "APPROVED" &&
    report.primary_1_candidate_in_pool === true &&
    report.primary_2_candidate_in_pool === true &&
    report.primary_1_reopened === true &&
    report.primary_1_inspected === true &&
    report.primary_2_reopened === true &&
    report.primary_2_inspected === true &&
    report.observation_gate === "PASS" &&
    report.decision_frozen === true &&
    report.packet_final_state === "POSITION_DECIDED" &&
    report.agent_completed === true
  );
}

/**
 * Real one-packet Reviewer smoke. Uses a frozen schema-valid leadership +
 * person decisions + candidate pool fixture (鼓楼区人民政府, real current
 * leader profile pages), then runs one fresh REVIEWER session that must really
 * search (Bocha), reopen + inspect the approved candidates, and submit a frozen
 * Review Decision through submit_review_decision → POSITION_DECIDED.
 */
export async function runReviewerSmoke(
  args: ReviewerSmokeArgs,
): Promise<{ status: ReviewerSmokeStatus; report: Record<string, unknown> }> {
  const fixturePath =
    args.fixture ??
    path.join(
      path.dirname(fileURLToPath(import.meta.url)),
      "fixtures",
      "reviewer-gulou-input.json",
    );

  let fixture: Record<string, unknown>;
  try {
    fixture = JSON.parse(await readFile(fixturePath, "utf8")) as Record<string, unknown>;
  } catch (error) {
    return {
      status: FIXTURE_LOAD_FAILED,
      report: {
        detail: `failed to load reviewer fixture ${fixturePath}: ${error instanceof Error ? error.message : String(error)}`,
      },
    };
  }

  const regionCode =
    args.regionCode ?? (typeof fixture.region_code === "string" ? fixture.region_code : undefined);
  const institution =
    args.institution ??
    (typeof fixture.institution_name === "string" ? fixture.institution_name : undefined);
  const budgetMs = args.budgetMs;
  if (!regionCode || !institution) {
    return {
      status: REVIEWER_ARGS_REQUIRED,
      report: { detail: "--region-code and --institution are required (or present in the fixture)" },
    };
  }
  const inventory = Array.isArray(fixture.inventory) ? fixture.inventory : undefined;
  const leadership = fixture.leadership;
  const selectedOfficials = Array.isArray(fixture.selectedOfficials)
    ? fixture.selectedOfficials
    : undefined;
  const candidatePool = Array.isArray(fixture.candidatePool)
    ? (fixture.candidatePool as UrlCandidatePoolRow[])
    : undefined;
  if (!inventory || !leadership || !selectedOfficials || !candidatePool) {
    return {
      status: FIXTURE_LOAD_FAILED,
      report: { detail: "fixture must include inventory, leadership, selectedOfficials and candidatePool" },
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
  const startedAt = Date.now();
  let report: Record<string, unknown>;
  try {
    const packetStore = new InMemoryInstitutionWorkPacketStore();
    const packets = packetStore.createFromFrozenInventory(
      { inventory: inventory as never },
      { regionCode },
    );
    const packet = packets.find((p) => p.institutionName === institution) ?? packets[0];
    if (!packet) {
      return {
        status: REVIEWER_ARGS_REQUIRED,
        report: {
          skill_loaded: true,
          packet_created: false,
          detail: `No INCLUDE packet for the targeted institution: ${institution}`,
        },
      };
    }
    // Represent the completed STEP 9/10/11 pipeline as READY_FOR_REVIEW.
    packetStore.updateState(packet.packetId, "INVESTIGATING", {
      investigatorSessionId: "step9-fixture-session",
    });
    packetStore.updateState(packet.packetId, "EVIDENCE_PENDING");
    packetStore.updateState(packet.packetId, "EVIDENCE_GATHERING");
    packetStore.updateState(packet.packetId, "READY_FOR_REVIEW");

    const reviewerEventSink = new MemoryToolEventSink();
    const reviewerRunner = new ReviewerAgentRunner({
      skillRuntime,
      packetStore,
      modelPolicy,
      modelResolver,
      eventSink: reviewerEventSink,
      ...(controller ? { abortSignal: controller.signal } : {}),
    });
    const result = await reviewerRunner.run({
      packetId: packet.packetId,
      frozenInput: {
        leadership: leadership as never,
        selectedOfficials: selectedOfficials as never,
        candidatePool,
      },
    });

    report = buildReviewerReport(result, {
      skill: { name: skill.name, version: skill.version },
      regionCode,
      institution,
      packetId: packet.packetId,
      packetInitialState: "READY_FOR_REVIEW",
      eventSink: reviewerEventSink,
      startedAt,
    });
  } finally {
    if (timer) clearTimeout(timer);
  }

  return { status: reviewerSmokePassed(report) ? "OK" : REVIEWER_SMOKE_FAILED, report };
}

function buildReviewerReport(
  result: ReviewerResult,
  meta: {
    skill: { name: string; version: string };
    regionCode: string;
    institution: string;
    packetId: string;
    packetInitialState: string;
    eventSink: MemoryToolEventSink;
    startedAt: number;
  },
): Record<string, unknown> {
  const { skill, regionCode, institution, packetId, packetInitialState, eventSink, startedAt } = meta;
  const called = (name: string) => eventSink.starts.some((event) => event.toolName === name);
  const succeeded = (name: string) => eventSink.successes.some((event) => event.toolName === name);
  const bochaCalled = eventSink.successes.some(
    (event) =>
      event.toolName === "search_web" &&
      (event.data as { provider?: string } | undefined)?.provider === "bocha",
  );
  const regionName = listRegions().find((region) => region.code === regionCode)?.name;

  const report: Record<string, unknown> = {
    skill_loaded: true,
    skill_name: skill.name,
    skill_version: skill.version,
    role: "REVIEWER",
    region_code: regionCode,
    ...(regionName ? { region_name: regionName } : {}),
    institution,
    packet_id: packetId,
    packet_initial_state: packetInitialState,
    reviewer_session_created: false,
    fresh_session: true,
    investigator_session_reused: false,
    evidence_session_reused: false,
    search_web_called: called("search_web"),
    bocha_called: bochaCalled,
    fetch_page_called: called("fetch_page"),
    render_page_called: called("render_page"),
    inspect_page_called: called("inspect_page"),
    submit_review_decision_called: succeeded("submit_review_decision"),
    primary_1: undefined,
    primary_2: undefined,
    primary_1_outcome: undefined,
    primary_2_outcome: undefined,
    primary_1_candidate_id: undefined,
    primary_2_candidate_id: undefined,
    primary_1_final_url: undefined,
    primary_2_final_url: undefined,
    primary_1_candidate_in_pool: false,
    primary_2_candidate_in_pool: false,
    primary_1_reopened: false,
    primary_1_inspected: false,
    primary_2_reopened: false,
    primary_2_inspected: false,
    observation_gate: "NO",
    decision_frozen: false,
    agent_completed: false,
    packet_final_state: undefined,
    duration_ms: Date.now() - startedAt,
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
  if (result.status === "PACKET_NOT_ELIGIBLE") {
    return { ...report, detail: result.reason };
  }
  if (result.status === "INVALID_REQUEST") {
    return { ...report, detail: result.reason };
  }
  if (result.status === "FAILED") {
    report.reviewer_session_created = result.agentSessionId.length > 0;
    report.packet_final_state = result.packet.state;
    report.failure_code = result.failureCode;
    report.decision_frozen = succeeded("submit_review_decision");
    return report;
  }

  // COMPLETED / RECOVERY_REQUIRED
  const decisionFor = (slot: "PRIMARY_1" | "PRIMARY_2") =>
    result.finalDecisions.find((decision) => decision.primarySlot === slot);
  const primary1 = decisionFor("PRIMARY_1");
  const primary2 = decisionFor("PRIMARY_2");
  report.reviewer_session_created = result.agentSessionId.length > 0;
  report.primary_1 = primary1?.targetId;
  report.primary_2 = primary2?.targetId;
  report.primary_1_outcome = result.receipt.primary1Outcome;
  report.primary_2_outcome = result.receipt.primary2Outcome;
  report.primary_1_candidate_id = primary1?.selectedCandidateId;
  report.primary_2_candidate_id = primary2?.selectedCandidateId;
  report.primary_1_final_url = primary1?.finalUrl;
  report.primary_2_final_url = primary2?.finalUrl;
  report.primary_1_candidate_in_pool = primary1?.selectedCandidateId !== null;
  report.primary_2_candidate_in_pool = primary2?.selectedCandidateId !== null;
  report.primary_1_reopened = finalUrlReopened(eventSink, primary1?.finalUrl ?? null);
  report.primary_1_inspected = finalUrlInspected(eventSink, primary1?.finalUrl ?? null);
  report.primary_2_reopened = finalUrlReopened(eventSink, primary2?.finalUrl ?? null);
  report.primary_2_inspected = finalUrlInspected(eventSink, primary2?.finalUrl ?? null);
  report.observation_gate = result.receipt.observationGate;
  report.decision_frozen = result.frozen === true;
  report.packet_final_state = result.packetFinalState;
  report.agent_completed = result.status === "COMPLETED" || result.status === "RECOVERY_REQUIRED";
  report.model_provider = result.model.provider;
  return report;
}

function matchesFinalUrl(data: unknown, norm: string): boolean {
  const record = (data ?? {}) as Record<string, unknown> | undefined;
  for (const key of ["requestedUrl", "finalUrl", "url"] as const) {
    const value = record?.[key];
    if (typeof value === "string" && value.length > 0 && normalizeUrlForJoin(value) === norm) {
      return true;
    }
  }
  return false;
}

function finalUrlReopened(eventSink: MemoryToolEventSink, url: string | null): boolean {
  if (!url) return false;
  const norm = normalizeUrlForJoin(url);
  return eventSink.successes.some(
    (event) =>
      (event.toolName === "fetch_page" || event.toolName === "render_page") &&
      matchesFinalUrl(event.data, norm),
  );
}

function finalUrlInspected(eventSink: MemoryToolEventSink, url: string | null): boolean {
  if (!url) return false;
  const norm = normalizeUrlForJoin(url);
  return eventSink.successes.some(
    (event) => event.toolName === "inspect_page" && matchesFinalUrl(event.data, norm),
  );
}

export function formatReviewerSmokeResult(
  status: ReviewerSmokeStatus,
  report: Record<string, unknown>,
): string {
  const lines = ["REVIEWER_SMOKE", `status: ${status}`];
  for (const [key, value] of Object.entries(report)) {
    if (value === undefined) continue;
    lines.push(`${key}: ${value === true ? "YES" : value === false ? "NO" : String(value)}`);
  }
  return lines.join("\n");
}

async function main(): Promise<void> {
  const args = parseReviewerSmokeArgs(process.argv.slice(2));
  const { status, report } = await runReviewerSmoke(args);
  process.stdout.write(formatReviewerSmokeResult(status, report) + "\n");
  process.exitCode = status === "OK" ? 0 : 1;
}

const entryArg = process.argv[1];
const isEntryPoint =
  entryArg !== undefined && path.resolve(entryArg) === fileURLToPath(import.meta.url);

if (isEntryPoint) {
  void main();
}
