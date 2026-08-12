import { run, quickAddJob, type Runner } from "graphile-worker";
import type { Pool } from "pg";
import type { Repositories, TaskRunRow } from "@stellaris/db";
import type { EvidenceStore } from "@stellaris/evidence";
import type { SafeEgressPolicy } from "@stellaris/crawler/safe-egress.js";
import type { SiteAdapter } from "@stellaris/crawler/adapter/loader.js";
import type { BrowserPool } from "@stellaris/crawler/browser/render.js";
import type { RunTaskPipeline } from "./replay-driver.js";
import type { RunMultiInstitutionPipeline } from "./multi-institution-driver.js";
import type { RunMultiRegionPipeline } from "./multi-region-driver.js";
import { newTraceId, type SseEvent } from "@stellaris/contracts";
import { emitWithMetrics } from "../contracts/task-routes.js";

/**
 * Graphile Worker 持久队列入口（规格 §18.2）。
 * - 监听 `stellaris_task` 任务，处理函数按 task_run.mode 路由到对应驱动；
 * - 可靠投递/并发领取/指数退避/锁恢复由 Graphile Worker 提供；
 * - 永久业务状态保留在项目表中；处理函数按「至少一次」执行设计（驱动内部幂等 upsert）。
 * - 优雅关闭：runner.stop() 停止领取新作业。
 */

export interface WorkerDeps {
  /** Graphile Worker 需要的 PostgreSQL 连接池（项目 DB）。 */
  pgPool: Pool;
  repos: Repositories;
  evidenceStore: EvidenceStore;
  policy: SafeEgressPolicy;
  adapter?: SiteAdapter;
  fixtureUrl?: string;
  evidenceRoot: string;
  exportRoot: string;
  browserPool?: BrowserPool;
  /** SSE 推送（进程内缓冲，task-routes pushSseEvent）。 */
  emit: (taskId: string, e: SseEvent) => void;
  runTaskPipeline: RunTaskPipeline;
  runMultiInstitutionPipeline?: RunMultiInstitutionPipeline;
  runMultiRegionPipeline?: RunMultiRegionPipeline;
}

/** 队列作业载荷（任务级投递，R-58/D1）。 */
export interface StellarisTaskJob {
  taskRunId: string;
}

/** 任务作业幂等键（§18.3 任务级：任务ID+模式+规则版本）。 */
export function taskJobKey(task: TaskRunRow): string {
  return `task:${task.id}:${task.mode}:${task.rule_version}`;
}

/**
 * 启动 Graphile Worker（监听 stellaris_task）。
 * 返回 stop 函数（优雅关闭）。
 */
export async function runWorker(
  deps: WorkerDeps,
  opts: { concurrency?: number } = {},
): Promise<() => Promise<void>> {
  const runner: Runner = await run({
    pgPool: deps.pgPool,
    concurrency: opts.concurrency ?? 1,
    taskList: {
      stellaris_task: async (payload) => {
        const job = payload as StellarisTaskJob;
        await runTaskJob(deps, job.taskRunId);
      },
    },
  });
  return () => runner.stop();
}

/**
 * 任务作业处理函数：查 task_run → 按 mode 路由到对应驱动。
 * 异常重抛（Graphile Worker 指数退避重试）；协作式中止（暂停/取消）经 task-signal 注册表。
 * P6-Trace：每任务根 Trace——traceId 贯穿日志（§25.1）。
 */
export async function runTaskJob(deps: WorkerDeps, taskRunId: string): Promise<void> {
  const traceId = newTraceId();
  const log = (span: string, msg: string): void => {
    process.stderr.write(`[${traceId}] ${span}: ${msg}\n`);
  };
  const task = await deps.repos.taskRun.findById(taskRunId);
  if (!task) {
    log("task", `任务不存在 ${taskRunId}`);
    throw new Error(`任务不存在: ${taskRunId}`);
  }
  // 终态任务不执行（已取消/完成等）。
  if (["COMPLETED", "PARTIAL_COMPLETED", "FAILED", "CANCELLED", "CANCELLING"].includes(task.status)) {
    log("task", `终态跳过 ${task.status}`);
    return;
  }
  log("task", `开始 ${task.mode} ${taskRunId}`);

  const base = {
    taskRunId,
    repos: deps.repos,
    evidenceStore: deps.evidenceStore,
    policy: deps.policy,
    ...(deps.fixtureUrl ? { fixtureUrl: deps.fixtureUrl } : {}),
    emit: (e: SseEvent) => {
      // R-66：队列路径指标挂钩——emitWithMetrics 内部 push SSE + 计数指标（URL 数/分歧/恢复/阻断/批次）。
      emitWithMetrics(taskRunId, e);
    },
    evidenceRoot: deps.evidenceRoot,
    ...(deps.browserPool ? { browserPool: deps.browserPool } : {}),
  };

  switch (task.mode) {
    case "TARGETED":
      log("pipeline", "TARGETED 回放");
      await deps.runTaskPipeline(base);
      log("pipeline", "TARGETED 完成");
      break;
    case "FULL_INSTITUTION": {
      log("pipeline", "FULL_INSTITUTION 多机构");
      const scopes = await deps.repos.targetScope.listByTask(taskRunId);
      const hasRegionCodes = scopes.length > 1;
      if (hasRegionCodes && deps.runMultiRegionPipeline) {
        await deps.runMultiRegionPipeline({
          ...base,
          ...(deps.adapter ? { adapter: deps.adapter } : {}),
        });
      } else if (deps.runMultiInstitutionPipeline) {
        await deps.runMultiInstitutionPipeline({
          ...base,
          ...(deps.adapter ? { adapter: deps.adapter } : {}),
        });
      } else {
        throw new Error(`任务 ${taskRunId} 无多机构驱动`);
      }
      log("pipeline", "FULL_INSTITUTION 完成");
      break;
    }
    default:
      throw new Error(`未知任务模式: ${task.mode}`);
  }
}

/**
 * 投递任务作业到队列（幂等：jobKey 含任务ID+模式+规则版本）。
 * 供 task-routes / task-control resume 使用。
 */
export async function enqueueTask(pgPool: Pool, task: TaskRunRow): Promise<void> {
  await quickAddJob(
    { pgPool },
    "stellaris_task",
    { taskRunId: task.id } satisfies StellarisTaskJob,
    { jobKey: taskJobKey(task) },
  );
}
