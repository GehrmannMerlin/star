import Fastify, { type FastifyInstance } from "fastify";
import { HEALTH_SERVICE_NAME, HEALTH_VERSION, type Health } from "@stellaris/contracts";
import { createDb, dbConfigFromEnv, createRepositories, migrateToLatest, type Repositories } from "@stellaris/db";
import { createEvidenceStore } from "@stellaris/evidence";
import { createSafeEgressPolicy, type SafeEgressPolicy } from "@stellaris/crawler/safe-egress.js";
import type { SiteAdapter } from "@stellaris/crawler/adapter/loader.js";
import { loadAdapter } from "@stellaris/crawler/adapter/loader.js";
import { createReplayDriver } from "./workers/replay-driver.js";
import { runMultiInstitutionPipeline } from "./workers/multi-institution-driver.js";
import { runMultiRegionPipeline } from "./workers/multi-region-driver.js";
import type { BiographyTaskExecutionService } from "./workers/biography-task-service.js";
import { registerTaskRoutes, toControlDeps, pushSseEvent } from "./contracts/task-routes.js";
import { registerRegionRoutes } from "./contracts/region-routes.js";
import { registerMetricsRoutes } from "./contracts/metrics-routes.js";
import { registerSessionRoutes } from "./contracts/session-routes.js";
import { metrics } from "./workers/metrics.js";
import { recoverInterruptedTasks } from "./workers/recovery.js";

export interface ServerDeps {
  /** 监听地址，默认仅本机。 */
  host?: string;
  /** 监听端口。 */
  port?: number;
  /** 数据库客户端（缺省按环境变量创建）。 */
  db?: Awaited<ReturnType<typeof createDb>>;
  /** P5：PostgreSQL 连接池（供 Graphile Worker 队列投递/worker；缺省无队列，直接调驱动）。 */
  pgPool?: import("pg").Pool;
  /**
   * STEP 17：Biography Agent Task Runtime 执行器（测试注入 seam）。
   * 缺省时，仅在 STELLARIS_TASK_RUNTIME=biography 且提供 pgPool 时构建真实执行器。
   */
  biographyExecutor?: Pick<BiographyTaskExecutionService, "run">;
  /** 离线金标 fixture 基础 URL（缺省关闭）。 */
  fixtureUrl?: string;
  /** 出口模式（缺省 production；离线测试传 offline-fixture）。 */
  egressMode?: "offline-fixture" | "production";
  /** offline-fixture 放行端口。 */
  fixturePort?: number;
  /** 证据根目录（缺省 E:\StellarisData\evidence）。 */
  evidenceRoot?: string;
  /** 导出根目录（缺省 E:\StellarisData\exports）。 */
  exportRoot?: string;
  /** 站点适配器（缺省从 config/site-adapters 加载安徽适配器）。 */
  adapter?: SiteAdapter;
}

const DEFAULT_EVIDENCE_ROOT = process.env.STELLARIS_EVIDENCE_ROOT ?? "E:\\StellarisData\\evidence";
const DEFAULT_EXPORT_ROOT = process.env.STELLARIS_EXPORT_ROOT ?? "E:\\StellarisData\\exports";

/**
 * 构造并启动 Fastify API。
 * 注册任务 API/SSE 与离线回放；/health 保持既有行为。
 */
export async function buildApp(deps: ServerDeps = {}): Promise<FastifyInstance> {
  const logger =
    process.env.NODE_ENV === "development"
      ? { transport: { target: "pino-pretty" } }
      : true;

  const app = Fastify({ logger });

  const db = deps.db ?? createDb(dbConfigFromEnv());
  await migrateToLatest(db);
  const repos = createRepositories(db);
  const evidenceRoot = deps.evidenceRoot ?? DEFAULT_EVIDENCE_ROOT;
  const exportRoot = deps.exportRoot ?? DEFAULT_EXPORT_ROOT;
  const evidenceStore = createEvidenceStore(evidenceRoot);

  const egressMode = deps.egressMode ?? "production";
  const policy: SafeEgressPolicy = createSafeEgressPolicy({
    mode: egressMode,
    ...(egressMode === "offline-fixture" && deps.fixturePort
      ? { allowedTestPorts: new Set([deps.fixturePort]) }
      : {}),
  });

  app.get("/health", async (): Promise<Health> => ({
    status: "ok",
    service: HEALTH_SERVICE_NAME,
    version: HEALTH_VERSION,
    uptimeSec: Math.round(process.uptime()),
  }));

  await registerRegionRoutes(app);
  await registerMetricsRoutes(app, metrics);
  await registerSessionRoutes(app);

  const taskRoutesDeps = {
    repos,
    evidenceStore,
    runTaskPipeline: createReplayDriver(),
    runMultiInstitutionPipeline,
    runMultiRegionPipeline,
    policy,
    ...(deps.fixtureUrl ? { fixtureUrl: deps.fixtureUrl } : {}),
    adapter: deps.adapter ?? loadAdapter("anhui-provincial-government"),
    evidenceRoot,
    exportRoot,
    ...(deps.pgPool ? { enqueueTask: makeEnqueueTask(deps.pgPool) } : {}),
  };
  await registerTaskRoutes(app, taskRoutesDeps);

  // 崩溃恢复：启动时扫描未完成任务并重新拉起驱动（规格 §18.2）。
  // 进程内调度；真实部署由 API 进程启动即触发。
  await recoverInterruptedTasks(toControlDeps(taskRoutesDeps));

  // P5：启动 Graphile Worker 持久队列（STELLARIS_WORKER=1 或提供 pgPool 时）。
  if (deps.pgPool && process.env.STELLARIS_WORKER === "1") {
    const { runWorker } = await import("./workers/queue.js");
    // STEP 17：服务器后台配置选择 Biography Agent Task Runtime（缺省 legacy）。
    const biographyExecutor =
      deps.biographyExecutor ??
      (process.env.STELLARIS_TASK_RUNTIME === "biography"
        ? await createBiographyTaskExecutor(db, repos)
        : undefined);
    const stopWorker = await runWorker({
      pgPool: deps.pgPool,
      repos,
      evidenceStore,
      policy,
      ...(deps.fixtureUrl ? { fixtureUrl: deps.fixtureUrl } : {}),
      adapter: deps.adapter ?? loadAdapter("anhui-provincial-government"),
      evidenceRoot,
      exportRoot,
      emit: (taskId, e) => pushSseEvent(taskId, e),
      runTaskPipeline: createReplayDriver(),
      runMultiInstitutionPipeline,
      runMultiRegionPipeline,
      ...(biographyExecutor ? { biographyExecutor } : {}),
    });
    app.addHook("onClose", () => void stopWorker());
  }

  return app;
}

/**
 * STEP 17：构建真实 Biography Agent Task Runtime 执行器（服务器后台配置，非用户请求字段）。
 * Provider-neutral：模型/搜索由 ModelPolicy + 服务器环境配置决定，任务请求永不携带。
 */
async function createBiographyTaskExecutor(
  db: Awaited<ReturnType<typeof createDb>>,
  repos: Repositories,
): Promise<Pick<BiographyTaskExecutionService, "run">> {
  const {
    createRuntimeConfig,
    ModelPolicy,
    PiModelResolver,
    SkillRuntime,
  } = await import("@stellaris/agent-runtime");
  const { BiographyTaskExecutionService } = await import("./workers/biography-task-service.js");
  const skillRuntime = new SkillRuntime(createRuntimeConfig());
  const modelResolver = await PiModelResolver.create();
  return new BiographyTaskExecutionService({
    db,
    repos,
    emit: (taskId, e) => pushSseEvent(taskId, e),
    skillRuntime,
    modelPolicy: new ModelPolicy(),
    modelResolver,
  });
}

/** 构造 enqueueTask（Graphile Worker 投递，幂等 jobKey）。 */
function makeEnqueueTask(pgPool: import("pg").Pool): import("./contracts/task-routes.js").EnqueueTaskFn {
  return async (task) => {
    const { enqueueTask } = await import("./workers/queue.js");
    await enqueueTask(pgPool, task);
  };
}

/** 仅在直接运行时启动监听（便于测试时以 buildApp 组装而不启动端口）。 */
async function main(): Promise<void> {
  const host = process.env.HOST ?? "127.0.0.1";
  const port = Number(process.env.PORT ?? 3000);

  // P5：生产创建 pg Pool 供 Graphile Worker 队列（投递 + worker）。
  const { default: pg } = await import("pg");
  const config = dbConfigFromEnv();
  const pgPool = new pg.Pool({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: config.database,
    max: config.max ?? 10,
  });

  const app = await buildApp({ host, port, pgPool });
  try {
    await app.listen({ host, port });
  } catch (err) {
    app.log.error(err);
    process.exitCode = 1;
  }
}

// NodeNext 下入口检测：直接执行时启动，被 import（测试/启动器）时不启动。
const isDirectRun =
  process.argv[1] !== undefined &&
  import.meta.url === new URL(`file://${process.argv[1]}`).href;

if (isDirectRun) {
  void main();
}
