/**
 * STEP 14 — Recovery Re-Review Loop and Decision Persistence — real smoke.
 *
 * 唯一真实 Smoke（disposable Testcontainers PostgreSQL + Round-2 Reviewer）：
 * 用合法 fixtures 持久化 Original Evidence / Round-1 REWORK_REQUIRED Review /
 * Recovery Round-1 Supplement → 销毁实例 → new Evidence/Recovery/Review Reader
 * 重水合 Composite Candidate View → 真实 Round-2 Reviewer Session（DeepSeek +
 * Bocha: search_web → fetch/render → inspect → submit_review_decision）→
 * persist Round-2 Review → new Review Reader 读取 Review History（count=2,
 * latest round=2, latest outcome=APPROVED）→ POSITION_DECIDED。
 *
 * 若模型未配置（无 DeepSeek/Bocha 凭据），在真实 Reviewer Smoke 前返回
 * STEP_14_WAITING_FOR_REVIEWER_SMOKE_CREDENTIALS（持久化阶段证据完整返回）。
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { readFile } from "node:fs/promises";
import { listRegions } from "@stellaris/contracts";
import {
  MemoryToolEventSink,
  normalizeUrlForJoin,
  type ReviewerSubmissionPayload,
  type RecoverySubmissionPayload,
  type UrlCandidatePoolRow,
} from "@stellaris/agent-tools";
import {
  createDb,
  InvestigatorEvidenceSubmissionRepository,
  migrateToLatest,
  RecoverySubmissionRepository,
  ReviewDecisionSubmissionRepository,
} from "@stellaris/db";
import { startPostgres } from "@stellaris/db/testing/pg.js";
import { createRuntimeConfig } from "../config/runtime-config.js";
import { ModelPolicy } from "../model/model-policy.js";
import { PiModelResolver } from "../model/pi-model-resolver.js";
import { OFFICIAL_BIOGRAPHY_SKILL_NAME, SkillRuntime } from "../skill/skill-runtime.js";
import { InMemoryInstitutionWorkPacketStore } from "../work-packet/institution-work-packet.js";
import { ReviewerAgentRunner } from "../reviewer/reviewer-agent-runner.js";
import { PostgresInvestigatorEvidenceSubmissionSink } from "../persistence/postgres-investigator-evidence-sink.js";
import { PostgresReviewDecisionSink } from "../persistence/postgres-review-decision-sink.js";
import { PostgresRecoverySubmissionSink } from "../persistence/postgres-recovery-submission-sink.js";
import { PostgresEvidenceReader } from "../persistence/evidence-reader.js";
import { PostgresRecoveryReader } from "../persistence/recovery-reader.js";
import {
  finalPositionDecisionsFromReview,
  PostgresReviewDecisionReader,
} from "../persistence/review-decision-reader.js";
import { CompositeCandidateViewRehydrator } from "../persistence/composite-candidate-rehydration.js";
import type { ReviewerResult } from "../reviewer/reviewer-types.js";
import { resolveRuntimeModelConfig } from "../model/runtime-model-config.js";

export const REREVIEW_ARGS_REQUIRED = "REREVIEW_ARGS_REQUIRED" as const;
export const REREVIEW_SMOKE_FAILED = "REREVIEW_SMOKE_FAILED" as const;
export const FIXTURE_LOAD_FAILED = "FIXTURE_LOAD_FAILED" as const;
export const MODEL_NOT_CONFIGURED = "MODEL_NOT_CONFIGURED" as const;
export const STEP_14_WAITING_FOR_REVIEWER_SMOKE_CREDENTIALS =
  "STEP_14_WAITING_FOR_REVIEWER_SMOKE_CREDENTIALS" as const;

export type RecoveryRereviewSmokeStatus =
  | "OK"
  | typeof REREVIEW_ARGS_REQUIRED
  | typeof FIXTURE_LOAD_FAILED
  | typeof MODEL_NOT_CONFIGURED
  | typeof REREVIEW_SMOKE_FAILED
  | typeof STEP_14_WAITING_FOR_REVIEWER_SMOKE_CREDENTIALS;

export type RecoveryRereviewSmokeArgs = {
  regionCode: string | undefined;
  institution: string | undefined;
  budgetMs: number | undefined;
  fixture: string | undefined;
};

export function parseRecoveryRereviewSmokeArgs(argv: string[]): RecoveryRereviewSmokeArgs {
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

/** One-packet STEP 14 smoke gate: every completion criterion must hold. */
export function recoveryRereviewSmokePassed(report: Record<string, unknown>): boolean {
  const called = (name: string) => report[`${name}_called`] === true;
  return (
    report.migration === "PASS" &&
    report.evidence_persisted === true &&
    report.round1_review_persisted === true &&
    report.recovery_round1_persisted === true &&
    report.repositories_recreated === true &&
    report.original_evidence_reloaded === true &&
    report.recovery_supplement_reloaded === true &&
    report.composite_rehydrated === true &&
    report.original_pool_unchanged === true &&
    report.round2_reviewer_fresh_session === true &&
    report.search_web_called === true &&
    report.bocha_called === true &&
    report.fetch_or_render_called === true &&
    report.inspect_page_called === true &&
    report.submit_review_decision_called === true &&
    report.round2_review_persisted === true &&
    report.review_history_count === 2 &&
    report.latest_review_round === 2 &&
    report.latest_review_outcome === "APPROVED" &&
    report.final_position_decision_source === "LATEST_FROZEN_APPROVED_REVIEW" &&
    report.packet_final_state === "POSITION_DECIDED" &&
    report.agent_completed === true
  );
}

type RereviewFixture = {
  region_code: string;
  institution_name: string;
  inventory: Array<Record<string, unknown>>;
  leadership: Record<string, unknown>;
  selectedOfficials: Array<Record<string, unknown>>;
  originalCandidatePool: UrlCandidatePoolRow[];
  round1Review: ReviewerSubmissionPayload;
  recoverySupplement: RecoverySubmissionPayload;
};

/**
 * 运行完整 STEP 14 Smoke。返回状态与门控报告；任何硬失败直接抛出。
 * Testcontainers 容器在 finally 中精确 stop。
 */
export async function runRecoveryRereviewSmoke(
  args: RecoveryRereviewSmokeArgs,
): Promise<{ status: RecoveryRereviewSmokeStatus; report: Record<string, unknown> }> {
  const fixturePath =
    args.fixture ??
    path.join(
      path.dirname(fileURLToPath(import.meta.url)),
      "fixtures",
      "recovery-rereview-gulou-input.json",
    );

  let fixture: RereviewFixture;
  try {
    fixture = JSON.parse(await readFile(fixturePath, "utf8")) as RereviewFixture;
  } catch (error) {
    return {
      status: FIXTURE_LOAD_FAILED,
      report: {
        detail: `failed to load STEP 14 fixture ${fixturePath}: ${error instanceof Error ? error.message : String(error)}`,
      },
    };
  }

  const regionCode = args.regionCode ?? fixture.region_code;
  const institution = args.institution ?? fixture.institution_name;
  const budgetMs = args.budgetMs;
  if (!regionCode || !institution) {
    return {
      status: REREVIEW_ARGS_REQUIRED,
      report: { detail: "--region-code and --institution are required (or present in the fixture)" },
    };
  }
  const inventory = fixture.inventory;
  const leadership = fixture.leadership;
  const selectedOfficials = fixture.selectedOfficials;
  const originalCandidatePool = fixture.originalCandidatePool;
  const round1Review = fixture.round1Review;
  const recoverySupplement = fixture.recoverySupplement;
  if (
    !inventory ||
    !leadership ||
    !selectedOfficials ||
    !originalCandidatePool ||
    !round1Review ||
    !recoverySupplement
  ) {
    return {
      status: FIXTURE_LOAD_FAILED,
      report: {
        detail:
          "fixture must include inventory, leadership, selectedOfficials, originalCandidatePool, round1Review and recoverySupplement",
      },
    };
  }

  const pg = await startPostgres();
  let db: ReturnType<typeof createDb> | undefined;
  try {
    db = createDb(pg.config);
    const migration = await migrateToLatest(db);
    if (!migration.ok) {
      throw new Error(`STEP 14 migration failed: ${String(migration.error)}`);
    }

    const config = createRuntimeConfig();
    const skillRuntime = new SkillRuntime(config);
    await skillRuntime.reload();
    const skill = await skillRuntime.resolveSkill(OFFICIAL_BIOGRAPHY_SKILL_NAME);

    // ── Phase 1: 同一批实例写入三个冻结关注点 ──
    const evidenceRepo = new InvestigatorEvidenceSubmissionRepository(db);
    const reviewRepo = new ReviewDecisionSubmissionRepository(db);
    const recoveryRepo = new RecoverySubmissionRepository(db);

    const packetStore = new InMemoryInstitutionWorkPacketStore();
    const packets = packetStore.createFromFrozenInventory(
      { inventory: inventory as never },
      { regionCode },
    );
    const packet = packets.find((p) => p.institutionName === institution) ?? packets[0];
    if (!packet) {
      return {
        status: REREVIEW_ARGS_REQUIRED,
        report: {
          migration: "PASS",
          skill_loaded: true,
          packet_created: false,
          detail: `No INCLUDE packet for the targeted institution: ${institution}`,
        },
      };
    }
    // 模拟已完成的 Investigator → Evidence → Round-1 Review → Recovery Round 1 状态链。
    packetStore.updateState(packet.packetId, "INVESTIGATING", {
      investigatorSessionId: "step9-fixture-session",
    });
    packetStore.updateState(packet.packetId, "EVIDENCE_PENDING");
    packetStore.updateState(packet.packetId, "EVIDENCE_GATHERING");
    packetStore.updateState(packet.packetId, "READY_FOR_REVIEW");
    packetStore.updateState(packet.packetId, "REVIEWING", {
      investigatorSessionId: "reviewer-session-round1",
    });
    packetStore.updateState(packet.packetId, "RECOVERY_REQUIRED");
    packetStore.updateState(packet.packetId, "RECOVERING", {
      investigatorSessionId: "recovery-session-round1",
    });
    packetStore.updateState(packet.packetId, "READY_FOR_REVIEW");

    const evidenceSink = new PostgresInvestigatorEvidenceSubmissionSink(evidenceRepo, {
      packetId: packet.packetId,
      agentSessionId: "evidence-session-step14",
      agentRole: "INVESTIGATOR",
      skill: { name: skill.name, version: skill.version },
    });
    const evidenceResult = await evidenceSink.submit({ candidates: originalCandidatePool });
    const evidencePersisted = evidenceResult.status === "ACCEPTED";

    const round1Sink = new PostgresReviewDecisionSink(reviewRepo, {
      packetId: packet.packetId,
      reviewRound: 1,
      agentRole: "REVIEWER",
      skill: { name: skill.name, version: skill.version },
    });
    const round1Result = await round1Sink.submit(round1Review);
    const round1Persisted = round1Result.status === "ACCEPTED";

    const recoverySink = new PostgresRecoverySubmissionSink(recoveryRepo, {
      packetId: packet.packetId,
      recoveryRound: 1,
      agentRole: "RECOVERY",
      skill: { name: skill.name, version: skill.version },
    });
    const recoveryResult = await recoverySink.submit(recoverySupplement);
    const recoveryPersisted = recoveryResult.status === "ACCEPTED";

    // 重复同轮提交必须拒绝（append-only / Round 1 不可覆盖）。
    const round1Duplicate = await round1Sink.submit(round1Review);
    const round1DuplicateRejected = round1Duplicate.status === "ALREADY_SUBMITTED";

    // ── Phase 2: 销毁实例，创建全新 Reader / Rehydrator（证明数据来自 PostgreSQL） ──
    const evidenceReader = new PostgresEvidenceReader(
      new InvestigatorEvidenceSubmissionRepository(db),
    );
    const recoveryReader = new PostgresRecoveryReader(new RecoverySubmissionRepository(db));
    const reviewReader = new PostgresReviewDecisionReader(new ReviewDecisionSubmissionRepository(db));
    const rehydrator = new CompositeCandidateViewRehydrator({
      evidenceReader,
      recoveryRepo: new RecoverySubmissionRepository(db),
      reviewRepo: new ReviewDecisionSubmissionRepository(db),
    });
    const rehydrated = await rehydrator.rehydrate(packet.packetId);

    const originalReloaded = rehydrated.originalCandidatePool.length === originalCandidatePool.length;
    const supplementReloaded = rehydrated.recoverySupplement.length === recoverySupplement.candidates.length;
    const compositeRehydrated = rehydrated.compositeCandidateView.length >= 1;
    const originalPoolUnchanged =
      rehydrated.originalCandidatePool.map((c) => c.candidate_id).join(",") ===
      originalCandidatePool.map((c) => c.candidate_id).join(",");

    const baseReport: Record<string, unknown> = {
      migration: "PASS",
      skill_loaded: true,
      skill_name: skill.name,
      skill_version: skill.version,
      role: "REVIEWER",
      region_code: regionCode,
      region_name: listRegions().find((region) => region.code === regionCode)?.name,
      institution,
      packet_id: packet.packetId,
      packet_initial_state: "READY_FOR_REVIEW",
      evidence_persisted: evidencePersisted,
      round1_review_persisted: round1Persisted,
      recovery_round1_persisted: recoveryPersisted,
      round1_duplicate_rejected: round1DuplicateRejected,
      repositories_recreated: true,
      original_evidence_reloaded: originalReloaded,
      recovery_supplement_reloaded: supplementReloaded,
      composite_rehydrated: compositeRehydrated,
      original_pool_unchanged: originalPoolUnchanged,
      composite_view_count: rehydrated.compositeCandidateView.length,
      review_history_count_before_round2: rehydrated.reviewHistory.length,
    };

    // ── Phase 3: 真实 Round-2 Reviewer（需 DeepSeek + Bocha 凭据） ──
    const modelConfig = resolveRuntimeModelConfig();
    if (!modelConfig) {
      return {
        status: STEP_14_WAITING_FOR_REVIEWER_SMOKE_CREDENTIALS,
        report: {
          ...baseReport,
          detail:
            "persistence phase PASS (migration/evidence/round-1 review/recovery persisted + rehydrated); DeepSeek + Bocha credentials unavailable — real Round-2 Reviewer smoke deferred",
        },
      };
    }

    const controller = budgetMs ? new AbortController() : undefined;
    const timer = controller ? setTimeout(() => controller.abort(), budgetMs) : undefined;
    const startedAt = Date.now();
    let report: Record<string, unknown>;
    try {
      const round2Sink = new PostgresReviewDecisionSink(
        new ReviewDecisionSubmissionRepository(db),
        {
          packetId: packet.packetId,
          reviewRound: 2,
          agentRole: "REVIEWER",
          skill: { name: skill.name, version: skill.version },
        },
      );
      const reviewerEventSink = new MemoryToolEventSink();
      const modelPolicy = new ModelPolicy();
      const modelResolver = await PiModelResolver.create();
      const reviewerRunner = new ReviewerAgentRunner({
        skillRuntime,
        packetStore,
        modelPolicy,
        modelResolver,
        eventSink: reviewerEventSink,
        sink: round2Sink,
        ...(controller ? { abortSignal: controller.signal } : {}),
      });
      const result = await reviewerRunner.run({
        packetId: packet.packetId,
        frozenInput: {
          leadership,
          selectedOfficials: selectedOfficials as never,
          candidatePool: rehydrated.compositeCandidateView,
        },
      });

      report = await buildRereviewReport(result, {
        baseReport,
        packetStore,
        packetId: packet.packetId,
        eventSink: reviewerEventSink,
        rehydratedComposite: rehydrated.compositeCandidateView,
        reviewReader: new PostgresReviewDecisionReader(
          new ReviewDecisionSubmissionRepository(db),
        ),
        startedAt,
      });
    } finally {
      if (timer) clearTimeout(timer);
    }

    return { status: recoveryRereviewSmokePassed(report) ? "OK" : REREVIEW_SMOKE_FAILED, report };
  } finally {
    // 先销毁 Kysely/pg 连接池，再停容器，避免 pool 在容器关闭时抛出未处理的
    // "terminating connection due to administrator command" 错误。
    await db?.destroy().catch(() => undefined);
    await pg.stop();
  }
}

async function buildRereviewReport(
  result: ReviewerResult,
  meta: {
    baseReport: Record<string, unknown>;
    packetStore: InMemoryInstitutionWorkPacketStore;
    packetId: string;
    eventSink: MemoryToolEventSink;
    rehydratedComposite: UrlCandidatePoolRow[];
    reviewReader: PostgresReviewDecisionReader;
    startedAt: number;
  },
): Promise<Record<string, unknown>> {
  const {
    baseReport,
    packetStore,
    packetId,
    eventSink,
    rehydratedComposite,
    reviewReader,
    startedAt,
  } = meta;
  const called = (name: string) => eventSink.starts.some((event) => event.toolName === name);
  const succeeded = (name: string) => eventSink.successes.some((event) => event.toolName === name);
  const bochaCalled = eventSink.successes.some(
    (event) =>
      event.toolName === "search_web" &&
      (event.data as { provider?: string } | undefined)?.provider === "bocha",
  );

  const report: Record<string, unknown> = {
    ...baseReport,
    round2_reviewer_fresh_session: false,
    investigator_session_reused: false,
    reviewer_session_reused: false,
    recovery_session_reused: false,
    search_web_called: called("search_web"),
    bocha_called: bochaCalled,
    fetch_page_called: called("fetch_page"),
    render_page_called: called("render_page"),
    fetch_or_render_called: called("fetch_page") || called("render_page"),
    inspect_page_called: called("inspect_page"),
    submit_review_decision_called: succeeded("submit_review_decision"),
    round2_review_persisted: false,
    review_history_count: baseReport.review_history_count_before_round2,
    latest_review_round: undefined,
    latest_review_outcome: undefined,
    final_position_decision_source: undefined,
    final_urls: undefined,
    packet_final_state: undefined,
    agent_completed: false,
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
    report.round2_reviewer_fresh_session = result.agentSessionId.length > 0;
    report.packet_final_state = result.packet.state;
    report.failure_code = result.failureCode;
    report.round2_review_persisted = succeeded("submit_review_decision");
    return report;
  }

  // COMPLETED / RECOVERY_REQUIRED
  const history = await reviewReader.listByPacket(packetId);
  const latest = history.length > 0 ? history[history.length - 1]! : undefined;
  const historyCountBefore = Number(baseReport.review_history_count_before_round2 ?? 0);
  report.round2_reviewer_fresh_session = result.agentSessionId.length > 0;
  report.round2_review_persisted = history.length > historyCountBefore;
  report.review_history_count = history.length;
  report.latest_review_round = latest?.reviewRound;
  report.latest_review_outcome = latest?.roundOutcome;
  report.final_position_decision_source =
    latest && latest.roundOutcome === "APPROVED"
      ? "LATEST_FROZEN_APPROVED_REVIEW"
      : undefined;
  report.final_urls = latest
    ? finalPositionDecisionsFromReview(latest.payload, rehydratedComposite)
    : [];
  report.packet_final_state = result.packetFinalState;
  report.agent_completed = result.status === "COMPLETED" || result.status === "RECOVERY_REQUIRED";
  report.model_provider = result.model.provider;
  report.packet_live_state = packetStore.get(packetId)?.state;
  return report;
}

export function formatRecoveryRereviewSmokeResult(
  status: RecoveryRereviewSmokeStatus,
  report: Record<string, unknown>,
): string {
  const lines = ["RECOVERY_REREVIEW_SMOKE", `status: ${status}`];
  for (const [key, value] of Object.entries(report)) {
    if (value === undefined) continue;
    lines.push(`${key}: ${value === true ? "YES" : value === false ? "NO" : String(value)}`);
  }
  return lines.join("\n");
}

async function main(): Promise<void> {
  const args = parseRecoveryRereviewSmokeArgs(process.argv.slice(2));
  const { status, report } = await runRecoveryRereviewSmoke(args);
  process.stdout.write(formatRecoveryRereviewSmokeResult(status, report) + "\n");
  process.exitCode = status === "OK" ? 0 : 1;
}

const entryArg = process.argv[1];
const isEntryPoint =
  entryArg !== undefined && path.resolve(entryArg) === fileURLToPath(import.meta.url);

if (isEntryPoint) {
  void main();
}
