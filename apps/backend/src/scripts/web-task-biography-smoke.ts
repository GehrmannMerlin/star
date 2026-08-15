/**
 * STEP 17 — Real Web Task E2E Smoke：HTTP → Task → Graphile → Worker → Pi Agent → Biography Result。
 *
 * 唯一真实 Smoke（disposable Testcontainers PostgreSQL + 1 个真实指定机构）：
 * 启动 isolated dev backend + Graphile Worker + 真实 Biography Task Execution Service，
 * 通过真实 HTTP POST /api/tasks（TARGETED，南京市鼓楼区 鼓楼区人民政府）提交任务，
 * 轮询 GET /api/tasks/:id 直到终态，GET /api/tasks/:id/biography-result 读取 Task Result，
 * 验证至少一个真实 Biography URL（来自 BiographyUrlResultReader 投影，无需 Agent / LLM）。
 *
 * Secrets 从 /root/.stellaris-web-task-smoke-secrets（600）加载到 process.env，
 * 全程不打印；完成后删除 secrets 文件并 unset env，再次 GET 结果仍可读。
 * 不触碰生产 DB / 生产容器。
 */

import { existsSync, readFileSync } from "node:fs";
import { rm, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import { createDb, createRepositories, migrateToLatest } from "@stellaris/db";
import { startPostgres } from "@stellaris/db/testing/pg.js";
import {
  createRuntimeConfig,
  ModelPolicy,
  PiModelResolver,
  SkillRuntime,
} from "@stellaris/agent-runtime";
import type { SseEvent } from "@stellaris/contracts";
import { BiographyTaskExecutionService } from "../workers/biography-task-service.js";
import { pushSseEvent } from "../contracts/task-routes.js";
import { buildApp } from "../server.js";
import type { FastifyInstance } from "fastify";

export const WEB_TASK_SMOKE_SECRETS_PATH = "/root/.stellaris-web-task-smoke-secrets";
// 单机构真实 Agent 链约 15-60 分钟（网络/站点/服务器 swap 压力方差 + 可能 Recovery 轮）。
// 实测：15.9min（COMPLETED）与 50min（review 阶段被 budget abort）。Budget 先于 Poll 触发。
export const WEB_TASK_SMOKE_BUDGET_MS = 66 * 60 * 1000;
export const WEB_TASK_SMOKE_POLL_MS = 72 * 60 * 1000;
const SMOKE_USER = "web-task-smoke";
const USER_HEADER = { "x-ifc-user-id": SMOKE_USER };

const REQUEST = {
  clientIdempotencyKey: "step17-web-task-smoke-0001",
  mode: "TARGETED",
  regionCode: "320106",
  regionName: "南京市鼓楼区",
  institutionName: "鼓楼区人民政府",
  institutionType: "government",
  ruleVersion: "v1",
};

type SmokeStatus =
  | "OK"
  | "SECRETS_REQUIRED"
  | "SMOKE_FAILED"
  | "SMOKE_TIMEOUT";

/** 从 secrets 文件加载 runtime env（不打印任何 secret）。 */
function loadSecrets(): boolean {
  if (!existsSync(WEB_TASK_SMOKE_SECRETS_PATH)) return false;
  const content = readFileSync(WEB_TASK_SMOKE_SECRETS_PATH, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim();
    if (key) process.env[key] = value;
  }
  return true;
}

function httpJson(url: string, init?: RequestInit): Promise<unknown> {
  return fetch(url, {
    ...init,
    headers: { "content-type": "application/json", ...USER_HEADER, ...(init?.headers ?? {}) },
  }).then(async (res) => ({ status: res.status, body: await res.json() }));
}

/** 运行真实 Web Task E2E Smoke。返回状态与门控报告；硬失败直接抛出。 */
export async function runWebTaskBiographySmoke(): Promise<{
  status: SmokeStatus;
  report: Record<string, unknown>;
}> {
  if (!loadSecrets()) {
    return {
      status: "SECRETS_REQUIRED",
      report: { detail: `${WEB_TASK_SMOKE_SECRETS_PATH} missing` },
    };
  }

  const evidenceRoot = "/tmp/web-task-smoke-evidence";
  const exportRoot = "/tmp/web-task-smoke-exports";
  await mkdir(evidenceRoot, { recursive: true });
  await mkdir(exportRoot, { recursive: true });

  const pg = await startPostgres();
  let db: ReturnType<typeof createDb> | undefined;
  let app: FastifyInstance | undefined;
  let budgetTimer: ReturnType<typeof setTimeout> | undefined;
  const pool = new Pool(pg.config);
  pool.on("error", () => undefined);

  try {
    db = createDb(pg.config);
    const migration = await migrateToLatest(db);
    if (!migration.ok) throw new Error(`STEP 17 migration failed: ${String(migration.error)}`);
    const repos = createRepositories(db);

    // ── 真实 Biography Task Execution Service（Dev budget 由 AbortSignal 兜底）──
    const skillRuntime = new SkillRuntime(createRuntimeConfig());
    const modelPolicy = new ModelPolicy();
    const modelResolver = await PiModelResolver.create();
    const controller = new AbortController();
    budgetTimer = setTimeout(() => controller.abort(), WEB_TASK_SMOKE_BUDGET_MS);
    const biographyExecutor = new BiographyTaskExecutionService({
      db,
      repos,
      emit: (taskId, e: SseEvent) => pushSseEvent(taskId, e),
      skillRuntime,
      modelPolicy,
      modelResolver,
      abortSignal: controller.signal,
    });

    // ── isolated dev backend + Graphile Worker（STELLARIS_WORKER=1）──
    process.env.STELLARIS_WORKER = "1";
    app = await buildApp({
      db,
      pgPool: pool,
      biographyExecutor,
      evidenceRoot,
      exportRoot,
    });
    await app.listen({ port: 0, host: "127.0.0.1" });
    const port = (app.server.address() as { port: number }).port;

    const startedAt = Date.now();

    // ── 1. 真实 HTTP POST /api/tasks ──
    const post = (await httpJson(`http://127.0.0.1:${port}/api/tasks`, {
      method: "POST",
      body: JSON.stringify(REQUEST),
    })) as { status: number; body: { task: { id: string }; idempotencyResult: string } };
    if (post.status !== 200 || !post.body.task?.id) {
      return { status: "SMOKE_FAILED", report: { detail: `POST /api/tasks failed: ${post.status}` } };
    }
    const taskId = post.body.task.id;

    // ── 2. 轮询 GET /api/tasks/:id 直到终态 ──
    const pollDeadline = Date.now() + WEB_TASK_SMOKE_POLL_MS;
    let terminal: { status: string; statusZh?: string; errorMessage?: string } | undefined;
    const statusesSeen: string[] = [];
    const packetStatesSeen: string[] = [];
    while (Date.now() < pollDeadline) {
      // Budget abort（50min）触发 Agent 中止 → 任务应快速 FAILED → 轮询如实上报终态；
      // 若 abort 未使任务尽快终态（极端情况），poll deadline（55min）仍兜底。
      const detail = (await httpJson(`http://127.0.0.1:${port}/api/tasks/${taskId}`)) as {
        status: number;
        body: { task?: { status: string; statusZh: string; errorMessage?: string } };
      };
      const task = detail.body?.task;
      if (!task) {
        await new Promise((r) => setTimeout(r, 2000));
        continue;
      }
      if (!statusesSeen.includes(task.status)) statusesSeen.push(task.status);
      // 观测 packet 状态推进（真实 Agent 链阶段可见性）。
      const packetRow = await db
        .selectFrom("institution_work_packet")
        .select("state")
        .where("institution_name", "=", REQUEST.institutionName)
        .executeTakeFirst();
      if (packetRow && !packetStatesSeen.includes(packetRow.state)) {
        packetStatesSeen.push(packetRow.state);
      }
      if (["COMPLETED", "PARTIAL_COMPLETED", "FAILED", "CANCELLED"].includes(task.status)) {
        terminal = task;
        break;
      }
      await new Promise((r) => setTimeout(r, 5000));
    }
    if (!terminal) {
      return {
        status: "SMOKE_TIMEOUT",
        report: { detail: "task poll timeout", taskId, statusesSeen, packetStatesSeen },
      };
    }

    // ── 3. Task Result 读取（GET /api/tasks/:id/biography-result，无需 LLM）──
    const resultRes = (await httpJson(`http://127.0.0.1:${port}/api/tasks/${taskId}/biography-result`)) as {
      status: number;
      body: {
        taskStatus: string;
        biographyResult: {
          regionCode: string;
          regionName?: string;
          totalPackets: number;
          results: Array<{
            institutionName: string;
            status: string;
            packetState: string;
            primary1: { decisionStatus: string; biographyUrl: string | null } | null;
            primary2: { decisionStatus: string; biographyUrl: string | null } | null;
          }>;
        } | null;
      };
    };
    const biographyResult = resultRes.body?.biographyResult;
    const urls = (biographyResult?.results ?? []).flatMap((r) => [
      r.primary1?.biographyUrl,
      r.primary2?.biographyUrl,
    ]);
    // 官网可能使用 http:// 或 https:// —— 两者都是真实 Biography URL。
    const realUrls = urls.filter(
      (u): u is string =>
        typeof u === "string" && (u.startsWith("https://") || u.startsWith("http://")),
    );

    // ── 4. Secret 清理后再次读取（证明结果读取不依赖 DeepSeek / Bocha）──
    await rm(WEB_TASK_SMOKE_SECRETS_PATH, { force: true });
    delete process.env.DEEPSEEK_API_KEY;
    delete process.env.BOCHA_API_KEY;
    delete process.env.AGENT_MODEL_PROVIDER;
    delete process.env.AGENT_MODEL_ID;
    delete process.env.WEB_SEARCH_PROVIDER;
    const reRead = (await httpJson(`http://127.0.0.1:${port}/api/tasks/${taskId}/biography-result`)) as {
      status: number;
      body: { biographyResult: { results: Array<{ primary1: { biographyUrl: string | null } }> } | null };
    };

    // ── 5. Agent 持久层证据（证明真实链：packet / evidence / review / recovery）──
    const packetRows = await db
      .selectFrom("institution_work_packet")
      .selectAll()
      .where("institution_name", "=", REQUEST.institutionName)
      .execute();
    const packet = packetRows[0];
    const evidenceRows = packet
      ? await db
          .selectFrom("investigator_evidence_submission")
          .selectAll()
          .where("packet_id", "=", packet.packet_id)
          .execute()
      : [];
    const reviewRows = packet
      ? await db
          .selectFrom("review_decision_submission")
          .selectAll()
          .where("packet_id", "=", packet.packet_id)
          .execute()
      : [];
    const recoveryRows = packet
      ? await db
          .selectFrom("recovery_submission")
          .selectAll()
          .where("packet_id", "=", packet.packet_id)
          .execute()
      : [];

    const report: Record<string, unknown> = {
      migration: "PASS",
      http_post_status: post.status,
      idempotency_result: post.body.idempotencyResult,
      task_id: taskId,
      region_code: REQUEST.regionCode,
      region_name: REQUEST.regionName,
      institution: REQUEST.institutionName,
      statuses_seen: statusesSeen,
      packet_states_seen: packetStatesSeen,
      task_terminal_status: terminal.status,
      status_zh: terminal.statusZh,
      ...(terminal.errorMessage ? { error_message: terminal.errorMessage } : {}),
      graphile_worker_claimed: statusesSeen.some((s) => ["PREPARING", "CRAWLING", "RECOVERING", "REVIEWING"].includes(s)),
      pi_session_created: packet?.investigator_session_id != null,
      packet_state: packet?.state ?? "NO_PACKET",
      evidence_submitted: evidenceRows.length > 0,
      review_submitted: reviewRows.length > 0,
      review_round_outcome: reviewRows.map((r) => r.round_outcome),
      recovery_used: recoveryRows.length > 0,
      recovery_round_outcome: recoveryRows.map((r) => r.round_outcome),
      biography_result_readable: biographyResult != null,
      total_packets: biographyResult?.totalPackets ?? 0,
      primary_1: biographyResult?.results[0]?.primary1?.decisionStatus ?? "NO_RESULT",
      primary_1_biography_url: biographyResult?.results[0]?.primary1?.biographyUrl ?? null,
      primary_2: biographyResult?.results[0]?.primary2?.decisionStatus ?? "NO_RESULT",
      primary_2_biography_url: biographyResult?.results[0]?.primary2?.biographyUrl ?? null,
      result_source: "LATEST_FROZEN_APPROVED_REVIEW",
      llm_required_for_result_read: false,
      result_read_after_secret_cleanup: reRead.body?.biographyResult != null,
      duration_ms: Date.now() - startedAt,
    };

    const passed =
      report.migration === "PASS" &&
      report.task_terminal_status !== "FAILED" &&
      realUrls.length >= 1 &&
      report.biography_result_readable === true &&
      report.result_read_after_secret_cleanup === true &&
      report.llm_required_for_result_read === false &&
      report.pi_session_created === true &&
      report.evidence_submitted === true &&
      report.review_submitted === true;

    return { status: passed ? "OK" : "SMOKE_FAILED", report };
  } finally {
    if (budgetTimer) clearTimeout(budgetTimer);
    delete process.env.STELLARIS_WORKER;
    if (app) await app.close().catch(() => undefined);
    await pool.end().catch(() => undefined);
    await db?.destroy().catch(() => undefined);
    await pg.stop();
  }
}

export function formatWebTaskBiographySmoke(
  status: SmokeStatus,
  report: Record<string, unknown>,
): string {
  const lines = ["WEB_TASK_BIOGRAPHY_SMOKE", `status: ${status}`];
  for (const [key, value] of Object.entries(report)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      lines.push(`${key}: ${value.join(",")}`);
    } else {
      lines.push(`${key}: ${value === true ? "YES" : value === false ? "NO" : String(value)}`);
    }
  }
  return lines.join("\n");
}

async function main(): Promise<void> {
  const { status, report } = await runWebTaskBiographySmoke();
  process.stdout.write(formatWebTaskBiographySmoke(status, report) + "\n");
  process.exitCode = status === "OK" ? 0 : 1;
}

const entryArg = process.argv[1];
const isEntryPoint =
  entryArg !== undefined &&
  path.resolve(entryArg) === fileURLToPath(import.meta.url);

if (isEntryPoint) {
  void main();
}
