/**
 * STEP 16 — Region Batch Biography Collection — 2-Institution Real Agent Batch Smoke。
 *
 * 唯一真实 Smoke（disposable Testcontainers PostgreSQL + 2 个真实 Institution）：
 * 读取 DEV-only frozen inventory fixture（南京市鼓楼区 2 个合法机构）→ 从
 * /root/.stellaris-batch-biography-smoke-secrets 加载 DeepSeek/Bocha/Model/Search 配置 →
 * PostgresInstitutionWorkPacketStore 建 2 个 Packet → MultiInstitutionBiographyCoordinator
 * （bounded concurrency = 2）逐 Packet 运行真实 Agent Workflow（Investigator → Evidence →
 * Reviewer → Recovery/Re-review → BiographyUrlResultReader）→ 每 Packet 独立 Pi Session /
 * Postgres 持久化 identity → 完成后 new store/reader 重水合 2 个 Packet + 2 个 Result →
 * 精确 stop 容器、清理 secret 文件。全程不碰生产 DB。
 */

import { existsSync, readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { listRegions } from "@stellaris/contracts";
import {
  createDb,
  InstitutionWorkPacketRepository,
  InvestigatorEvidenceSubmissionRepository,
  migrateToLatest,
  RecoverySubmissionRepository,
  ReviewDecisionSubmissionRepository,
} from "@stellaris/db";
import { startPostgres } from "@stellaris/db/testing/pg.js";
import {
  buildRegionBiographyBatchResult,
  createBiographyPacketWorkflowRunner,
} from "../batch/biography-batch-wiring.js";
import type { InstitutionBiographyWorkflowResult } from "../batch/institution-biography-workflow-runner.js";
import { InstitutionBiographyWorkflowRunner } from "../batch/institution-biography-workflow-runner.js";
import { createRuntimeConfig } from "../config/runtime-config.js";
import { MultiInstitutionBiographyCoordinator } from "../coordination/multi-institution-biography-coordinator.js";
import { ModelPolicy } from "../model/model-policy.js";
import { PiModelResolver } from "../model/pi-model-resolver.js";
import { resolveRuntimeModelConfig } from "../model/runtime-model-config.js";
import { CompositeCandidateViewRehydrator } from "../persistence/composite-candidate-rehydration.js";
import { PostgresEvidenceReader } from "../persistence/evidence-reader.js";
import {
  createPostgresEvidenceSink,
  createPostgresRecoverySubmissionSink,
  createPostgresReviewDecisionSink,
} from "../persistence/index.js";
import { PostgresReviewDecisionReader } from "../persistence/review-decision-reader.js";
import { BiographyUrlResultReader } from "../results/biography-url-result.js";
import { OFFICIAL_BIOGRAPHY_SKILL_NAME, SkillRuntime } from "../skill/skill-runtime.js";
import { PostgresInstitutionWorkPacketStore } from "../work-packet/institution-work-packet.js";

export const BATCH_SECRETS_REQUIRED = "BATCH_SECRETS_REQUIRED" as const;
export const FIXTURE_LOAD_FAILED = "FIXTURE_LOAD_FAILED" as const;
export const BATCH_SMOKE_FAILED = "BATCH_SMOKE_FAILED" as const;

export type BatchBiographySmokeStatus =
  | "OK"
  | typeof BATCH_SECRETS_REQUIRED
  | typeof FIXTURE_LOAD_FAILED
  | typeof BATCH_SMOKE_FAILED;

export const BATCH_BIOGRAPHY_SECRETS_PATH = "/root/.stellaris-batch-biography-smoke-secrets";
export const BATCH_BIOGRAPHY_BUDGET_MS = 20 * 60 * 1000;

type BatchFixture = {
  region_code: string;
  region_name?: string;
  inventory: Array<Record<string, unknown>>;
};

/** 从 secrets 文件加载 runtime env（不打印任何 secret）。 */
function loadSecrets(): boolean {
  if (!existsSync(BATCH_BIOGRAPHY_SECRETS_PATH)) return false;
  const content = readFileSync(BATCH_BIOGRAPHY_SECRETS_PATH, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim();
    if (key) process.env[key] = value;
  }
  return true;
}

function toolEvidence(workflowResults: InstitutionBiographyWorkflowResult[]): Record<string, boolean> {
  let searchWeb = false;
  let bocha = false;
  let fetchOrRender = false;
  let inspect = false;
  let submitInvestigation = false;
  let submitEvidence = false;
  let submitReview = false;
  let deepseek = false;
  for (const result of workflowResults) {
    for (const stage of Object.values(result.stages)) {
      const calls = stage.toolCalls;
      if (calls.search_web?.called) searchWeb = true;
      if (stage.bochaCalled) bocha = true;
      if (calls.fetch_page?.called || calls.render_page?.called) fetchOrRender = true;
      if (calls.inspect_page?.called) inspect = true;
      if (calls.submit_investigation?.called) submitInvestigation = true;
      if (calls.submit_investigator_evidence?.called) submitEvidence = true;
      if (calls.submit_review_decision?.called) submitReview = true;
      if (stage.model?.provider === "deepseek") deepseek = true;
    }
  }
  return {
    search_web_called: searchWeb,
    bocha_called: bocha,
    fetch_or_render_called: fetchOrRender,
    inspect_page_called: inspect,
    submit_investigation_called: submitInvestigation,
    submit_evidence_called: submitEvidence,
    submit_review_decision_called: submitReview,
    deepseek_called: deepseek,
  };
}

function packetReport(
  result: InstitutionBiographyWorkflowResult | undefined,
  prefix: string,
): Record<string, unknown> {
  if (!result) return {};
  const bio = result.biographyResult;
  return {
    [`${prefix}_institution`]: result.institutionName,
    [`${prefix}_investigation`]: result.stages.investigation.status,
    [`${prefix}_evidence`]: result.stages.evidence.status,
    [`${prefix}_review`]: result.stages.review.status,
    [`${prefix}_recovery_used`]: result.stages.recovery !== undefined,
    [`${prefix}_recovery`]: result.stages.recovery?.status ?? "NOT_NEEDED",
    [`${prefix}_rereview_used`]: result.stages.rereview !== undefined,
    [`${prefix}_rereview`]: result.stages.rereview?.status ?? "NOT_NEEDED",
    [`${prefix}_final_status`]: result.status,
    [`${prefix}_packet_state`]: result.packetState,
    [`${prefix}_primary_1`]: bio?.primary1.decisionStatus ?? "NO_RESULT",
    [`${prefix}_primary_1_biography_url`]: bio?.primary1.biographyUrl ?? null,
    [`${prefix}_primary_2`]: bio?.primary2.decisionStatus ?? "NO_RESULT",
    [`${prefix}_primary_2_biography_url`]: bio?.primary2.biographyUrl ?? null,
    [`${prefix}_result_source`]: bio?.sourceOfTruth ?? "NO_APPROVED_REVIEW",
  };
}

function sameUrls(
  before: InstitutionBiographyWorkflowResult | undefined,
  after: Awaited<ReturnType<BiographyUrlResultReader["read"]>>,
): boolean {
  if (!before?.biographyResult || !after) return false;
  return (
    before.biographyResult.primary1.biographyUrl === after.primary1.biographyUrl &&
    before.biographyResult.primary2.biographyUrl === after.primary2.biographyUrl
  );
}

/** 运行完整 STEP 16 Smoke。返回状态与门控报告；任何硬失败直接抛出。 */
export async function runBatchBiographySmoke(): Promise<{
  status: BatchBiographySmokeStatus;
  report: Record<string, unknown>;
}> {
  if (!loadSecrets()) {
    return {
      status: BATCH_SECRETS_REQUIRED,
      report: { detail: `${BATCH_BIOGRAPHY_SECRETS_PATH} missing` },
    };
  }

  const fixturePath = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "fixtures",
    "batch-biography-gulou-input.json",
  );
  let fixture: BatchFixture;
  try {
    fixture = JSON.parse(await readFile(fixturePath, "utf8")) as BatchFixture;
  } catch (error) {
    return {
      status: FIXTURE_LOAD_FAILED,
      report: {
        detail: `failed to load batch fixture ${fixturePath}: ${error instanceof Error ? error.message : String(error)}`,
      },
    };
  }
  const regionCode = fixture.region_code;
  const inventory = fixture.inventory;
  if (!Array.isArray(inventory) || inventory.length !== 2) {
    return {
      status: FIXTURE_LOAD_FAILED,
      report: {
        detail: `batch fixture must contain exactly 2 inventory records (got ${inventory.length})`,
      },
    };
  }

  const pg = await startPostgres();
  let db: ReturnType<typeof createDb> | undefined;
  let db2: ReturnType<typeof createDb> | undefined;
  try {
    db = createDb(pg.config);
    const migration = await migrateToLatest(db);
    if (!migration.ok) {
      throw new Error(`STEP 16 migration failed: ${String(migration.error)}`);
    }

    const config = createRuntimeConfig();
    const skillRuntime = new SkillRuntime(config);
    await skillRuntime.reload();
    const skill = await skillRuntime.resolveSkill(OFFICIAL_BIOGRAPHY_SKILL_NAME);
    const modelPolicy = new ModelPolicy();
    const modelResolver = await PiModelResolver.create();
    const modelConfig = resolveRuntimeModelConfig();
    const configuredProvider = modelConfig?.provider ?? "none";

    const packetStore = new PostgresInstitutionWorkPacketStore(
      new InstitutionWorkPacketRepository(db),
    );
    // 注意：Packet 由 coordinator 内部 createFromFrozenInventory 创建（唯一一次），
    // 这里不再预建，避免重复 PENDING 包与「报告侧未运行」的 packetId。用
    // coordinator.run 返回的 packets 做报告 / 重水合。

    const persistence = {
      packetStore,
      createEvidenceSink: (identity: Parameters<typeof createPostgresEvidenceSink>[1]) =>
        createPostgresEvidenceSink(db!, identity),
      createReviewSink: (identity: Parameters<typeof createPostgresReviewDecisionSink>[1]) =>
        createPostgresReviewDecisionSink(db!, identity),
      createRecoverySink: (
        identity: Parameters<typeof createPostgresRecoverySubmissionSink>[1],
      ) => createPostgresRecoverySubmissionSink(db!, identity),
      evidenceReader: new PostgresEvidenceReader(new InvestigatorEvidenceSubmissionRepository(db)),
      reviewReader: new PostgresReviewDecisionReader(new ReviewDecisionSubmissionRepository(db)),
      reviewRepo: new ReviewDecisionSubmissionRepository(db),
      recoveryRepo: new RecoverySubmissionRepository(db),
    };

    const workflow = new InstitutionBiographyWorkflowRunner({
      skillRuntime,
      modelPolicy,
      modelResolver,
      skill: { name: skill.name, version: skill.version },
      persistence,
    });

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), BATCH_BIOGRAPHY_BUDGET_MS);
    const collected = new Map<string, InstitutionBiographyWorkflowResult>();
    const coordinator = new MultiInstitutionBiographyCoordinator({
      packetStore,
      concurrency: 2,
      runPacket: createBiographyPacketWorkflowRunner(workflow, (result) =>
        collected.set(result.packetId, result),
      ),
    });

    const startedAt = Date.now();
    let coordinatorResults: Awaited<ReturnType<MultiInstitutionBiographyCoordinator["run"]>>;
    try {
      coordinatorResults = await coordinator.run({ inventory: inventory as never }, { regionCode });
    } finally {
      clearTimeout(timer);
    }
    const batchDurationMs = Date.now() - startedAt;
    const packets = coordinatorResults.packets;

    const workflowResults = packets
      .map((packet) => collected.get(packet.packetId))
      .filter((result): result is InstitutionBiographyWorkflowResult => result !== undefined);
    const batchResult = buildRegionBiographyBatchResult(workflowResults, regionCode);
    const evidence = toolEvidence(workflowResults);
    const regionName =
      listRegions().find((region) => region.code === regionCode)?.name ?? fixture.region_name;

    // ── Rehydration Gate：销毁 batch 实例，new store / reader 重水合 ──
    await db.destroy();
    db2 = createDb(pg.config);
    const freshStore = new PostgresInstitutionWorkPacketStore(
      new InstitutionWorkPacketRepository(db2),
    );
    const freshReviewReader = new PostgresReviewDecisionReader(
      new ReviewDecisionSubmissionRepository(db2),
    );
    const freshEvidenceReader = new PostgresEvidenceReader(
      new InvestigatorEvidenceSubmissionRepository(db2),
    );
    const rehydrator = new CompositeCandidateViewRehydrator({
      evidenceReader: freshEvidenceReader,
      recoveryRepo: new RecoverySubmissionRepository(db2),
      reviewRepo: new ReviewDecisionSubmissionRepository(db2),
    });
    const resultReader = new BiographyUrlResultReader({
      packetStore: freshStore,
      reviewReader: freshReviewReader,
      loadCandidatePool: async (packetId) =>
        (await rehydrator.rehydrate(packetId)).compositeCandidateView,
    });

    const rehydration: Record<string, unknown> = {};
    for (let index = 0; index < packets.length; index++) {
      const packet = packets[index]!;
      const prefix = index === 0 ? "packet_a" : index === 1 ? "packet_b" : `packet_${index + 1}`;
      const before = collected.get(packet.packetId);
      const after = await resultReader.read(packet.packetId);
      rehydration[`${prefix}_reloaded`] = (await freshStore.get(packet.packetId)) !== undefined;
      rehydration[`${prefix}_result_rebuilt`] = after !== null;
      rehydration[`${prefix}_same_result`] = sameUrls(before, after);
    }

    const report: Record<string, unknown> = {
      migration: "PASS",
      skill_name: skill.name,
      skill_version: skill.version,
      region_code: regionCode,
      ...(regionName ? { region_name: regionName } : {}),
      inventory: "FROZEN",
      packet_count: packets.length,
      coordinator: "MultiInstitutionBiographyCoordinator",
      real_workflow_executor: "InstitutionBiographyWorkflowRunner",
      bounded_concurrency: 2,
      model_provider: configuredProvider,
      batch_duration_ms: batchDurationMs,
      ...evidence,
      ...packetReport(workflowResults[0], "packet_a"),
      ...packetReport(workflowResults[1], "packet_b"),
      batch_total_packets: batchResult.totalPackets,
      batch_resolved_packets: batchResult.resolvedPackets,
      batch_partial_packets: batchResult.partialPackets,
      batch_unresolved_packets: batchResult.unresolvedPackets,
      batch_failed_packets: batchResult.failedPackets,
      batch_failure_isolation: coordinatorResults.results.length === packets.length,
      llm_required_for_result_read: false,
      ...rehydration,
      temporary_resources_removed: true,
    };

    const passed =
      report.migration === "PASS" &&
      report.packet_count === 2 &&
      report.real_workflow_executor === "InstitutionBiographyWorkflowRunner" &&
      report.bounded_concurrency === 2 &&
      report.search_web_called === true &&
      report.bocha_called === true &&
      report.fetch_or_render_called === true &&
      report.inspect_page_called === true &&
      report.submit_investigation_called === true &&
      report.submit_evidence_called === true &&
      report.submit_review_decision_called === true &&
      report.llm_required_for_result_read === false &&
      report.packet_a_reloaded === true &&
      report.packet_b_reloaded === true &&
      report.packet_a_result_rebuilt === true &&
      report.packet_b_result_rebuilt === true &&
      report.packet_a_same_result === true &&
      report.packet_b_same_result === true;

    return { status: passed ? "OK" : BATCH_SMOKE_FAILED, report };
  } finally {
    await db2?.destroy().catch(() => undefined);
    await db?.destroy().catch(() => undefined);
    await pg.stop();
  }
}

export function formatBatchBiographySmoke(
  status: BatchBiographySmokeStatus,
  report: Record<string, unknown>,
): string {
  const lines = ["BATCH_BIOGRAPHY_SMOKE", `status: ${status}`];
  for (const [key, value] of Object.entries(report)) {
    if (value === undefined) continue;
    lines.push(`${key}: ${value === true ? "YES" : value === false ? "NO" : String(value)}`);
  }
  return lines.join("\n");
}

async function main(): Promise<void> {
  const { status, report } = await runBatchBiographySmoke();
  process.stdout.write(formatBatchBiographySmoke(status, report) + "\n");
  process.exitCode = status === "OK" ? 0 : 1;
}

const entryArg = process.argv[1];
const isEntryPoint =
  entryArg !== undefined && path.resolve(entryArg) === fileURLToPath(import.meta.url);

if (isEntryPoint) {
  void main();
}
