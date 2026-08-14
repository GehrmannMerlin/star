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
import { RecoveryAgentRunner } from "../recovery/recovery-agent-runner.js";
import type { RecoveryResult } from "../recovery/recovery-types.js";

export const RECOVERY_ARGS_REQUIRED = "RECOVERY_ARGS_REQUIRED" as const;
export const RECOVERY_SMOKE_FAILED = "RECOVERY_SMOKE_FAILED" as const;
export const FIXTURE_LOAD_FAILED = "FIXTURE_LOAD_FAILED" as const;
export const MODEL_NOT_CONFIGURED = "MODEL_NOT_CONFIGURED" as const;
export const MODEL_NOT_FOUND = "MODEL_NOT_FOUND" as const;

export type RecoverySmokeStatus =
  | "OK"
  | typeof RECOVERY_ARGS_REQUIRED
  | typeof FIXTURE_LOAD_FAILED
  | typeof MODEL_NOT_CONFIGURED
  | typeof MODEL_NOT_FOUND
  | typeof RECOVERY_SMOKE_FAILED;

export type RecoverySmokeArgs = {
  regionCode: string | undefined;
  institution: string | undefined;
  budgetMs: number | undefined;
  fixture: string | undefined;
};

export function parseRecoverySmokeArgs(argv: string[]): RecoverySmokeArgs {
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

/** One-packet Recovery smoke gate: every STEP 13 success condition must hold. */
export function recoverySmokePassed(report: Record<string, unknown>): boolean {
  const called = (name: string) => report[`${name}_called`] === true;
  return (
    report.packet_initial_state === "RECOVERY_REQUIRED" &&
    report.recovery_session_created === true &&
    report.fresh_session === true &&
    report.reviewer_session_reused === false &&
    report.investigator_session_reused === false &&
    report.skill_loaded === true &&
    report.role === "RECOVERY" &&
    called("search_web") &&
    report.bocha_called === true &&
    (called("fetch_page") || called("render_page")) &&
    called("inspect_page") &&
    called("submit_recovery_evidence") &&
    typeof report.recovery_candidate_count === "number" &&
    report.recovery_candidate_count >= 1 &&
    report.new_candidate_not_in_original_pool === true &&
    report.all_new_candidates_opened === true &&
    report.all_new_candidates_inspected === true &&
    report.candidate_primary_join === "PASS" &&
    report.recovery_submission_frozen === true &&
    report.original_candidate_pool_modified === false &&
    report.composite_candidate_view_created === true &&
    report.packet_final_state === "READY_FOR_REVIEW" &&
    report.agent_completed === true
  );
}

/**
 * Real one-packet Recovery smoke. Uses a frozen schema-valid leadership +
 * person decisions + candidate pool + canonical review-records fixture
 * (鼓楼区人民政府; PRIMARY_1 APPROVED, PRIMARY_2 REWORK_REQUIRED), then runs one
 * fresh RECOVERY session that must really search (Bocha), open + inspect NEW
 * candidates for the PRIMARY_2 gap, and freeze a Recovery Supplement through
 * submit_recovery_evidence → READY_FOR_REVIEW.
 */
export async function runRecoverySmoke(
  args: RecoverySmokeArgs,
): Promise<{ status: RecoverySmokeStatus; report: Record<string, unknown> }> {
  const fixturePath =
    args.fixture ??
    path.join(
      path.dirname(fileURLToPath(import.meta.url)),
      "fixtures",
      "recovery-gulou-input.json",
    );

  let fixture: Record<string, unknown>;
  try {
    fixture = JSON.parse(await readFile(fixturePath, "utf8")) as Record<string, unknown>;
  } catch (error) {
    return {
      status: FIXTURE_LOAD_FAILED,
      report: {
        detail: `failed to load recovery fixture ${fixturePath}: ${error instanceof Error ? error.message : String(error)}`,
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
      status: RECOVERY_ARGS_REQUIRED,
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
  const reviewRecords = Array.isArray(fixture.reviewRecords)
    ? fixture.reviewRecords
    : undefined;
  if (!inventory || !leadership || !selectedOfficials || !candidatePool || !reviewRecords) {
    return {
      status: FIXTURE_LOAD_FAILED,
      report: {
        detail: "fixture must include inventory, leadership, selectedOfficials, candidatePool and reviewRecords",
      },
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
        status: RECOVERY_ARGS_REQUIRED,
        report: {
          skill_loaded: true,
          packet_created: false,
          detail: `No INCLUDE packet for the targeted institution: ${institution}`,
        },
      };
    }
    // Represent the completed STEP 9/10/11/12 pipeline as RECOVERY_REQUIRED.
    packetStore.updateState(packet.packetId, "INVESTIGATING", {
      investigatorSessionId: "step9-fixture-session",
    });
    packetStore.updateState(packet.packetId, "EVIDENCE_PENDING");
    packetStore.updateState(packet.packetId, "EVIDENCE_GATHERING");
    packetStore.updateState(packet.packetId, "READY_FOR_REVIEW");
    packetStore.updateState(packet.packetId, "REVIEWING", {
      investigatorSessionId: "reviewer-session-gulou",
    });
    packetStore.updateState(packet.packetId, "RECOVERY_REQUIRED");

    const recoveryEventSink = new MemoryToolEventSink();
    const recoveryRunner = new RecoveryAgentRunner({
      skillRuntime,
      packetStore,
      modelPolicy,
      modelResolver,
      eventSink: recoveryEventSink,
      ...(controller ? { abortSignal: controller.signal } : {}),
    });
    const result = await recoveryRunner.run({
      packetId: packet.packetId,
      frozenInput: {
        leadership: leadership as never,
        selectedOfficials: selectedOfficials as never,
        candidatePool,
        reviewRecords: reviewRecords as never,
      },
    });

    report = buildRecoveryReport(result, {
      skill: { name: skill.name, version: skill.version },
      regionCode,
      institution,
      packetId: packet.packetId,
      packetInitialState: "RECOVERY_REQUIRED",
      eventSink: recoveryEventSink,
      originalCandidatePool: candidatePool,
      startedAt,
    });
  } finally {
    if (timer) clearTimeout(timer);
  }

  return { status: recoverySmokePassed(report) ? "OK" : RECOVERY_SMOKE_FAILED, report };
}

function matchesUrl(data: unknown, norm: string): boolean {
  const record = (data ?? {}) as Record<string, unknown> | undefined;
  for (const key of ["requestedUrl", "finalUrl", "url"] as const) {
    const value = record?.[key];
    if (typeof value === "string" && value.length > 0 && normalizeUrlForJoin(value) === norm) {
      return true;
    }
  }
  return false;
}

function urlOpened(eventSink: MemoryToolEventSink, url: string): boolean {
  const norm = normalizeUrlForJoin(url);
  return eventSink.successes.some(
    (event) =>
      (event.toolName === "fetch_page" || event.toolName === "render_page") &&
      matchesUrl(event.data, norm),
  );
}

function urlInspected(eventSink: MemoryToolEventSink, url: string): boolean {
  const norm = normalizeUrlForJoin(url);
  return eventSink.successes.some(
    (event) => event.toolName === "inspect_page" && matchesUrl(event.data, norm),
  );
}

function buildRecoveryReport(
  result: RecoveryResult,
  meta: {
    skill: { name: string; version: string };
    regionCode: string;
    institution: string;
    packetId: string;
    packetInitialState: string;
    eventSink: MemoryToolEventSink;
    originalCandidatePool: UrlCandidatePoolRow[];
    startedAt: number;
  },
): Record<string, unknown> {
  const {
    skill,
    regionCode,
    institution,
    packetId,
    packetInitialState,
    eventSink,
    originalCandidatePool,
    startedAt,
  } = meta;
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
    role: "RECOVERY",
    region_code: regionCode,
    ...(regionName ? { region_name: regionName } : {}),
    institution,
    packet_id: packetId,
    packet_initial_state: packetInitialState,
    recovery_session_created: false,
    fresh_session: true,
    reviewer_session_reused: false,
    investigator_session_reused: false,
    search_web_called: called("search_web"),
    bocha_called: bochaCalled,
    fetch_page_called: called("fetch_page"),
    render_page_called: called("render_page"),
    inspect_page_called: called("inspect_page"),
    submit_recovery_evidence_called: succeeded("submit_recovery_evidence"),
    recovery_candidate_count: 0,
    new_candidate_not_in_original_pool: false,
    all_new_candidates_opened: false,
    all_new_candidates_inspected: false,
    candidate_primary_join: "NO",
    recovery_submission_frozen: false,
    original_candidate_pool_modified: false,
    composite_candidate_view_created: false,
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
    report.recovery_session_created = result.agentSessionId.length > 0;
    report.packet_final_state = result.packet.state;
    report.failure_code = result.failureCode;
    report.recovery_submission_frozen = succeeded("submit_recovery_evidence");
    return report;
  }

  // COMPLETED
  const newCandidates = result.newCandidates;
  const originalUrls = new Set(
    originalCandidatePool
      .map((candidate) => (typeof candidate.url === "string" ? candidate.url : ""))
      .filter((url) => url.length > 0)
      .map((url) => normalizeUrlForJoin(url)),
  );
  const newCandidateCount = newCandidates.length;
  const newUrls = newCandidates
    .map((candidate) => (typeof candidate.url === "string" ? candidate.url : ""))
    .filter((url) => url.length > 0);
  const hasNewOutsideOriginal = newUrls.some((url) => !originalUrls.has(normalizeUrlForJoin(url)));
  const allOpened = newUrls.length > 0 && newUrls.every((url) => urlOpened(eventSink, url));
  const allInspected = newUrls.length > 0 && newUrls.every((url) => urlInspected(eventSink, url));

  report.recovery_session_created = result.agentSessionId.length > 0;
  report.packet_running_state = "RECOVERING";
  report.recovery_candidate_count = newCandidateCount;
  report.new_candidate_not_in_original_pool = hasNewOutsideOriginal;
  report.all_new_candidates_opened = allOpened;
  report.all_new_candidates_inspected = allInspected;
  report.candidate_primary_join = "PASS";
  report.recovery_submission_frozen = result.frozen === true;
  report.composite_candidate_view_created = result.compositeCandidateView.length > 0;
  report.packet_final_state = result.packetFinalState;
  report.agent_completed = result.status === "COMPLETED";
  report.model_provider = result.model.provider;
  return report;
}

export function formatRecoverySmokeResult(
  status: RecoverySmokeStatus,
  report: Record<string, unknown>,
): string {
  const lines = ["RECOVERY_SMOKE", `status: ${status}`];
  for (const [key, value] of Object.entries(report)) {
    if (value === undefined) continue;
    lines.push(`${key}: ${value === true ? "YES" : value === false ? "NO" : String(value)}`);
  }
  return lines.join("\n");
}

async function main(): Promise<void> {
  const args = parseRecoverySmokeArgs(process.argv.slice(2));
  const { status, report } = await runRecoverySmoke(args);
  process.stdout.write(formatRecoverySmokeResult(status, report) + "\n");
  process.exitCode = status === "OK" ? 0 : 1;
}

const entryArg = process.argv[1];
const isEntryPoint =
  entryArg !== undefined && path.resolve(entryArg) === fileURLToPath(import.meta.url);

if (isEntryPoint) {
  void main();
}
