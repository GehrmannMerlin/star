import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { Pool } from "pg";
import { createDb, createRepositories, migrateToLatest } from "@stellaris/db";
import { startPostgres, type StartedPostgres } from "@stellaris/db/testing/pg.js";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../server.js";
import type { BiographyTaskExecutor } from "./biography-task-service.js";

/**
 * STEP 17 — Web Task → Graphile → Worker → Biography Task Runtime wiring e2e。
 *
 * 使用 disposable PostgreSQL + 真实 Graphile Worker + Fake BiographyTaskExecutor
 * （不运行真实 Agent）：验证 POST /api/tasks → task 持久化 → Graphile job（{taskRunId}）
 * → worker claim → biographyExecutor 被调用；幂等键重复提交不产生第二次执行。
 */

const USER = { "x-ifc-user-id": "e2e-user" };

let pg: StartedPostgres;
let db: ReturnType<typeof createDb>;
let app: FastifyInstance;
let executor: { run: ReturnType<typeof vi.fn> } & BiographyTaskExecutor;

const TARGETED_BODY = {
  clientIdempotencyKey: "e2e-targeted-key-0001",
  mode: "TARGETED",
  regionCode: "320106",
  regionName: "南京市鼓楼区",
  institutionName: "鼓楼区人民政府",
  institutionType: "government",
  ruleVersion: "v1",
};

async function waitFor(cond: () => boolean, timeoutMs = 15_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (cond()) return;
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`等待条件超时（${timeoutMs}ms）`);
}

beforeAll(async () => {
  pg = await startPostgres();
  db = createDb(pg.config);
  const migration = await migrateToLatest(db);
  if (!migration.ok) throw new Error(`migration failed: ${String(migration.error)}`);
  const repos = createRepositories(db);

  const pool = new Pool(pg.config);
  // Graphile Worker 需要连接池 error 监听（否则 pool 报错未处理会污染测试日志）。
  pool.on("error", () => undefined);
  executor = {
    // Fake：记录调用 + 推进任务到 COMPLETED（镜像生产执行器行为，使幂等重放走 replayed 路径）。
    run: vi.fn(async (taskRunId: string) => {
      await repos.taskRun.complete(taskRunId, "COMPLETED");
    }),
  } as unknown as { run: ReturnType<typeof vi.fn> } & BiographyTaskExecutor;
  process.env.STELLARIS_WORKER = "1";
  app = await buildApp({
    db,
    pgPool: pool,
    biographyExecutor: executor,
    egressMode: "offline-fixture",
    fixturePort: 1,
    evidenceRoot: "/tmp/web-task-graphile-e2e-evidence",
    exportRoot: "/tmp/web-task-graphile-e2e-exports",
  });
  await app.listen({ port: 0, host: "127.0.0.1" });
}, 120_000);

afterAll(async () => {
  delete process.env.STELLARIS_WORKER;
  await app?.close();
  await db?.destroy().catch(() => undefined);
  await pg?.stop();
}, 30_000);

describe("P5-T3 STEP 17 — HTTP → Graphile → Worker wiring", () => {
  it("POST /api/tasks → task 持久化 → Graphile job → worker 调用 biographyExecutor", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/tasks",
      headers: USER,
      payload: TARGETED_BODY,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.idempotencyResult).toBe("created");
    const taskId = body.task.id as string;

    // 任务已持久化（Worker 异步处理，状态为 PENDING 或已被 fake executor 推进为 COMPLETED）。
    const detail = await app.inject({ method: "GET", url: `/api/tasks/${taskId}`, headers: USER });
    expect(["PENDING", "COMPLETED"]).toContain(detail.json().task.status);

    // Worker 应消费 stellaris_task job 并调用 biographyExecutor.run(taskId)。
    await waitFor(() => executor.run.mock.calls.length >= 1);
    expect(executor.run).toHaveBeenCalledTimes(1);
    expect(executor.run.mock.calls[0]![0]).toBe(taskId);
  });

  it("同幂等键重复 POST → replayed，不产生第二次 executor 调用", async () => {
    // 前一个用例已完成任务（fake executor 推进为 COMPLETED）。
    await waitFor(() => executor.run.mock.calls.length >= 1);
    const callsBefore = executor.run.mock.calls.length;
    const res = await app.inject({
      method: "POST",
      url: "/api/tasks",
      headers: USER,
      payload: TARGETED_BODY,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().idempotencyResult).toBe("replayed");
    expect(res.json().task.id).toBeTruthy();
    // 幂等键命中既有终态任务：不重复入队/执行。
    await new Promise((r) => setTimeout(r, 800));
    expect(executor.run.mock.calls.length).toBe(callsBefore);
  });

  it("GET /api/tasks/:id/biography-result 无结果时为 null（不依赖 Agent）", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/tasks/00000000-0000-0000-0000-000000000000/biography-result",
      headers: USER,
    });
    expect(res.statusCode).toBe(404);
  });
});
