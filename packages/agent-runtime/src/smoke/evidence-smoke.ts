import path from "node:path";
import { fileURLToPath } from "node:url";
import { readFile } from "node:fs/promises";
import { listRegions } from "@stellaris/contracts";
import { MemoryToolEventSink } from "@stellaris/agent-tools";
import { createRuntimeConfig } from "../config/runtime-config.js";
import { ModelPolicy } from "../model/model-policy.js";
import { PiModelResolver } from "../model/pi-model-resolver.js";
import { OFFICIAL_BIOGRAPHY_SKILL_NAME, SkillRuntime } from "../skill/skill-runtime.js";
import { InMemoryInstitutionWorkPacketStore } from "../work-packet/institution-work-packet.js";
import { InvestigatorEvidenceRunner } from "../evidence/investigator-evidence-runner.js";
import type { InvestigatorEvidenceResult } from "../evidence/evidence-types.js";

export const EVIDENCE_ARGS_REQUIRED = "EVIDENCE_ARGS_REQUIRED" as const;
export const EVIDENCE_SMOKE_FAILED = "EVIDENCE_SMOKE_FAILED" as const;
export const FIXTURE_LOAD_FAILED = "FIXTURE_LOAD_FAILED" as const;
export const MODEL_NOT_CONFIGURED = "MODEL_NOT_CONFIGURED" as const;
export const MODEL_NOT_FOUND = "MODEL_NOT_FOUND" as const;

export type EvidenceSmokeStatus =
  | "OK"
  | typeof EVIDENCE_ARGS_REQUIRED
  | typeof FIXTURE_LOAD_FAILED
  | typeof MODEL_NOT_CONFIGURED
  | typeof MODEL_NOT_FOUND
  | typeof EVIDENCE_SMOKE_FAILED;

export type EvidenceSmokeArgs = {
  regionCode: string | undefined;
  institution: string | undefined;
  budgetMs: number | undefined;
  fixture: string | undefined;
};

export function parseEvidenceSmokeArgs(argv: string[]): EvidenceSmokeArgs {
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

/** One-packet Position Evidence smoke gate: every STEP 10 success condition must hold. */
export function evidenceSmokePassed(report: Record<string, unknown>): boolean {
  const called = (name: string) => report[`${name}_called`] === true;
  return (
    report.evidence_session_created === true &&
    report.step9_conversation_reused === false &&
    report.skill_loaded === true &&
    report.role === "INVESTIGATOR" &&
    called("search_web") &&
    report.bocha_called === true &&
    (called("fetch_page") || called("render_page")) &&
    called("inspect_page") &&
    called("submit_investigator_evidence") &&
    report.candidates_schema_valid === true &&
    Number(report.primary_1_candidate_count) >= 1 &&
    Number(report.primary_2_candidate_count) >= 1 &&
    report.all_candidates_opened === true &&
    report.all_candidates_inspected === true &&
    report.candidate_provenance_gate === "PASS" &&
    report.submission_frozen === true &&
    report.packet_final_state === "READY_FOR_REVIEW" &&
    report.agent_completed === true
  );
}

/**
 * Real one-packet Position Evidence smoke. Uses a frozen STEP 9 canonical
 * investigation fixture as input (Leadership + PRIMARY_1/PRIMARY_2 — already
 * verified by STEP 9), then runs one fresh INVESTIGATOR Evidence session that
 * must really search (Bocha), open + inspect candidate pages, and submit a
 * validated candidate pool through submit_investigator_evidence.
 */
export async function runEvidenceSmoke(
  args: EvidenceSmokeArgs,
): Promise<{ status: EvidenceSmokeStatus; report: Record<string, unknown> }> {
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
      status: FIXTURE_LOAD_FAILED,
      report: {
        detail: `failed to load STEP 9 fixture ${fixturePath}: ${error instanceof Error ? error.message : String(error)}`,
      },
    };
  }

  const regionCode = args.regionCode ?? (typeof fixture.region_code === "string" ? fixture.region_code : undefined);
  const institution =
    args.institution ?? (typeof fixture.institution_name === "string" ? fixture.institution_name : undefined);
  const budgetMs = args.budgetMs;
  if (!regionCode || !institution) {
    return {
      status: EVIDENCE_ARGS_REQUIRED,
      report: { detail: "--region-code and --institution are required (or present in the fixture)" },
    };
  }
  const inventory = Array.isArray(fixture.inventory) ? fixture.inventory : undefined;
  const leadership = fixture.leadership;
  const selectedOfficials = Array.isArray(fixture.selectedOfficials) ? fixture.selectedOfficials : undefined;
  if (!inventory || !leadership || !selectedOfficials) {
    return {
      status: FIXTURE_LOAD_FAILED,
      report: { detail: "fixture must include inventory, leadership and selectedOfficials" },
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
        status: EVIDENCE_ARGS_REQUIRED,
        report: {
          skill_loaded: true,
          packet_created: false,
          detail: `No INCLUDE packet for the targeted institution: ${institution}`,
        },
      };
    }
    // Represent the completed STEP 9 (Investigator) phase as EVIDENCE_PENDING.
    packetStore.updateState(packet.packetId, "INVESTIGATING", {
      investigatorSessionId: "step9-fixture-session",
    });
    packetStore.updateState(packet.packetId, "EVIDENCE_PENDING");

    const evidenceEventSink = new MemoryToolEventSink();
    const evidenceRunner = new InvestigatorEvidenceRunner({
      skillRuntime,
      packetStore,
      modelPolicy,
      modelResolver,
      eventSink: evidenceEventSink,
      ...(controller ? { abortSignal: controller.signal } : {}),
    });
    const result = await evidenceRunner.run({
      packetId: packet.packetId,
      frozenInput: { leadership: leadership as never, selectedOfficials: selectedOfficials as never },
    });

    report = buildEvidenceReport(result, {
      skill: { name: skill.name, version: skill.version },
      regionCode,
      institution,
      packetId: packet.packetId,
      packetInitialState: "EVIDENCE_PENDING",
      eventSink: evidenceEventSink,
      startedAt,
    });
  } finally {
    if (timer) clearTimeout(timer);
  }

  return { status: evidenceSmokePassed(report) ? "OK" : EVIDENCE_SMOKE_FAILED, report };
}

function buildEvidenceReport(
  result: InvestigatorEvidenceResult,
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
    packet_initial_state: packetInitialState,
    evidence_session_created: false,
    step9_conversation_reused: false,
    search_web_called: called("search_web"),
    bocha_called: bochaCalled,
    fetch_page_called: called("fetch_page"),
    render_page_called: called("render_page"),
    fetch_or_render_called: fetchOrRenderSucceeded,
    inspect_page_called: inspectSucceeded,
    submit_investigator_evidence_called: succeeded("submit_investigator_evidence"),
    candidates_schema_valid: false,
    primary_1: undefined,
    primary_2: undefined,
    primary_1_candidate_count: 0,
    primary_2_candidate_count: 0,
    all_candidates_opened: false,
    all_candidates_inspected: false,
    candidate_provenance_gate: "NO",
    submission_frozen: false,
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
    report.evidence_session_created = result.agentSessionId.length > 0;
    report.packet_final_state = result.packet.state;
    report.failure_code = result.failureCode;
    report.submission_frozen = succeeded("submit_investigator_evidence");
    return report;
  }

  // COMPLETED
  report.evidence_session_created = result.agentSessionId.length > 0;
  report.candidates_schema_valid = result.receipt.candidatesValidated;
  report.primary_1 = result.receipt.primary1TargetId;
  report.primary_2 = result.receipt.primary2TargetId;
  report.primary_1_candidate_count = result.receipt.primary1CandidateCount;
  report.primary_2_candidate_count = result.receipt.primary2CandidateCount;
  report.all_candidates_opened = result.receipt.allCandidatesOpened;
  report.all_candidates_inspected = result.receipt.allCandidatesInspected;
  report.candidate_provenance_gate = result.provenance.passed ? "PASS" : "FAIL";
  report.submission_frozen = result.frozen === true;
  report.packet_final_state = result.packet.state;
  report.agent_completed = result.status === "COMPLETED";
  report.model_provider = result.model.provider;
  report.candidate_count = result.candidates.length;
  return report;
}

export function formatEvidenceSmokeResult(
  status: EvidenceSmokeStatus,
  report: Record<string, unknown>,
): string {
  const lines = ["EVIDENCE_SMOKE", `status: ${status}`];
  for (const [key, value] of Object.entries(report)) {
    if (value === undefined) continue;
    lines.push(`${key}: ${value === true ? "YES" : value === false ? "NO" : String(value)}`);
  }
  return lines.join("\n");
}

async function main(): Promise<void> {
  const args = parseEvidenceSmokeArgs(process.argv.slice(2));
  const { status, report } = await runEvidenceSmoke(args);
  process.stdout.write(formatEvidenceSmokeResult(status, report) + "\n");
  process.exitCode = status === "OK" ? 0 : 1;
}

const entryArg = process.argv[1];
const isEntryPoint =
  entryArg !== undefined && path.resolve(entryArg) === fileURLToPath(import.meta.url);

if (isEntryPoint) {
  void main();
}
