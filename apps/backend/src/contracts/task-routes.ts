import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { SseEvent, TaskMode } from "@stellaris/contracts";
import type { Repositories } from "@stellaris/db";
import { createRepositories } from "@stellaris/db";
import { mapResultRowToView } from "@stellaris/db";
import { createEvidenceStore, type EvidenceStore } from "@stellaris/evidence";
import { projectBiographyResultRows, renderBiographyResultRows } from "@stellaris/exporter";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { BIOGRAPHY_EXCEL_MIME, buildBiographyTaskResultReader, projectExportReadiness, readBiographyResultsForTask } from "./biography-export.js";
import type { SafeEgressPolicy } from "@stellaris/crawler/safe-egress.js";
import type { SiteAdapter } from "@stellaris/crawler/adapter/loader.js";
import type { RunTaskPipeline } from "../workers/replay-driver.js";
import type { RunMultiInstitutionPipeline } from "../workers/multi-institution-driver.js";
import type { RunMultiRegionPipeline } from "../workers/multi-region-driver.js";
import { expandRegions } from "@stellaris/contracts";
import { pauseTask, resumeTask, cancelTask, duplicateTask } from "../workers/task-control.js";
import type { TaskControlDeps } from "../workers/task-control.js";
import { metrics } from "../workers/metrics.js";
import type { TaskRunRow } from "@stellaris/db";
import { requireRequestUserId, UnauthenticatedError } from "../auth/request-user.js";

/** 队列投递函数（P5：生产由 server.ts 注入 Graphile Worker enqueueTask；测试缺省回退直接调驱动）。 */
export type EnqueueTaskFn = (task: TaskRunRow) => Promise<void> | void;

/**
 * 任务 API 与 SSE 路由（规格 §19）。
 * - POST /api/tasks：创建任务（幂等），TARGETED 冻结单机构，FULL_INSTITUTION 触发机构发现 + 多机构调度；
 * - GET /api/tasks/:id：任务详情；
 * - GET /api/tasks/:id/results：两槽位结果；
 * - GET /api/tasks/:id/evidence/:resultRowId：证据详情；
 * - GET /api/tasks/:id/export：触发 Excel 导出（Task 12）；
 * - GET /api/tasks/:id/events：SSE 事件流。
 * 用户可见位置只显示中文状态与结论。
 */

export interface TaskRoutesDeps {
  repos: Repositories;
  evidenceStore: EvidenceStore;
  runTaskPipeline: RunTaskPipeline;
  runMultiInstitutionPipeline?: RunMultiInstitutionPipeline;
  runMultiRegionPipeline?: RunMultiRegionPipeline;
  policy: SafeEgressPolicy;
  fixtureUrl?: string;
  adapter?: SiteAdapter;
  evidenceRoot: string;
  exportRoot: string;
  /** P5：Graphile Worker 队列投递（生产注入；缺省回退直接调驱动，测试兼容）。 */
  enqueueTask?: EnqueueTaskFn;
}

/** 从 TaskRoutesDeps 构造任务控制依赖（供路由与崩溃恢复复用，规格 §19.1）。 */
export function toControlDeps(deps: TaskRoutesDeps): TaskControlDeps {
  const { repos, evidenceStore, runTaskPipeline, runMultiInstitutionPipeline, runMultiRegionPipeline, policy, fixtureUrl, adapter, evidenceRoot } = deps;
  return {
    repos,
    evidenceStore,
    policy,
    ...(fixtureUrl ? { fixtureUrl } : {}),
    ...(adapter ? { adapter } : {}),
    runTaskPipeline,
    ...(runMultiInstitutionPipeline ? { runMultiInstitutionPipeline } : {}),
    ...(runMultiRegionPipeline ? { runMultiRegionPipeline } : {}),
    emit: pushSseEvent,
    evidenceRoot,
  };
}

function requireRouteUserId(
  req: FastifyRequest,
  reply: FastifyReply,
): string | undefined {
  try {
    return requireRequestUserId(req);
  } catch (error) {
    if (!(error instanceof UnauthenticatedError)) throw error;
    reply.code(401).send({ error: "UNAUTHENTICATED" });
    return undefined;
  }
}

async function requireOwnedTask(
  req: FastifyRequest,
  reply: FastifyReply,
  repos: Repositories,
  taskId: string,
): Promise<{ userId: string; task: TaskRunRow } | undefined> {
  const userId = requireRouteUserId(req, reply);
  if (!userId) return undefined;

  const task = await repos.taskRun.findByIdForOwner(taskId, userId);
  if (!task) {
    await reply.code(404).send({ error: "TASK_NOT_FOUND" });
    return undefined;
  }
  return { userId, task };
}

export async function registerTaskRoutes(
  app: FastifyInstance,
  deps: TaskRoutesDeps,
): Promise<void> {
  const { repos, evidenceStore, runTaskPipeline, runMultiInstitutionPipeline, runMultiRegionPipeline, policy, fixtureUrl, adapter, evidenceRoot, exportRoot, enqueueTask } = deps;

  // 任务控制依赖（暂停/继续/取消/复制，规格 §19.1）。
  const controlDeps = toControlDeps(deps);

  // 任务列表（P3，规格 §19.1「查询任务与结果」）：最近任务摘要 + 总数。
  app.get<{ Querystring: import("@stellaris/contracts").TaskListParams }>("/api/tasks", async (req, reply) => {
    const ownerUserId = requireRouteUserId(req, reply);
    if (!ownerUserId) return reply;
    const limit = Math.min(Math.max(req.query.limit ?? 20, 1), 100);
    const offset = Math.max(req.query.offset ?? 0, 0);
    const status = req.query.status;
    const mode = req.query.mode;
    const rows = await repos.taskRun.listRecent({ ownerUserId, limit, offset, ...(status ? { status } : {}), ...(mode ? { mode } : {}) });
    const total = await repos.taskRun.count({ ownerUserId, ...(status ? { status } : {}), ...(mode ? { mode } : {}) });
    return { tasks: rows.map(toTaskSummary), total };
  });

  // 创建任务：同一事务创建 task_run + target_scope + institution_snapshot（规格 §7.2）。
  app.post<{ Body: import("@stellaris/contracts").CreateTaskRequest }>("/api/tasks", async (req, reply) => {
    const ownerUserId = requireRouteUserId(req, reply);
    if (!ownerUserId) return reply;
    const body = req.body;
    const mode: TaskMode = body.mode ?? "TARGETED";
    const task = await repos.taskRun.createWithIdempotency({
      ownerUserId,
      idempotencyKey: body.clientIdempotencyKey,
      mode,
      expandLevel: "COUNTY",
      ruleVersion: body.ruleVersion,
    });

    const isNew = task.status === "PENDING";
    if (isNew) {
      const useMultiRegion = mode === "FULL_INSTITUTION" && body.regionCodes && body.regionCodes.length > 0;
      if (!useMultiRegion) {
        await repos.targetScope.addMany(task.id, [
          {
            regionCode: body.regionCode,
            regionName: body.regionName,
            parentRegionCode: null,
            regionLevel: mode === "FULL_INSTITUTION" ? "province" : "county",
            included: true,
          },
        ]);
      }
      if (mode === "FULL_INSTITUTION") {
        // 完整机构模式：多行政区（regionCodes）→ 展开冻结；单行政区（regionCode）→ 单行冻结。
        if (useMultiRegion) {
          // 多行政区：展开至目标层级并冻结多行。
          const expanded = expandRegions(body.regionCodes as string[], body.expandLevel ?? "COUNTY");
          await repos.targetScope.addMany(
            task.id,
            expanded.map((r) => ({
              regionCode: r.code,
              regionName: r.name,
              parentRegionCode: r.parentCode,
              regionLevel: r.level,
              included: true,
            })),
          );
          if (runMultiRegionPipeline) {
            // P5：有队列投递则入队（幂等 jobKey），否则直接拉起驱动（测试/离线兼容）。
            if (enqueueTask) {
              await enqueueTask(task);
            } else {
              void runMultiRegionPipeline({
                taskRunId: task.id,
                repos,
                evidenceStore,
                policy,
                ...(fixtureUrl ? { fixtureUrl } : {}),
                ...(adapter ? { adapter } : {}),
                emit: (e) => emitWithMetrics(task.id, e),
                evidenceRoot,
              }).catch((err) => {
                // 协作式中止（暂停/取消）或失败：如实记录，不向上抛。
                process.stderr.write(`[task] 任务 ${task.id} 多行政区驱动终止: ${err instanceof Error ? err.message : String(err)}\n`);
              });
            }
          }
        } else {
          // 单行政区完整机构模式：冻结单行，走多机构驱动。
          if (runMultiInstitutionPipeline) {
            if (enqueueTask) {
              await enqueueTask(task);
            } else {
              void runMultiInstitutionPipeline({
                taskRunId: task.id,
                repos,
                evidenceStore,
                policy,
                ...(fixtureUrl ? { fixtureUrl } : {}),
                ...(adapter ? { adapter } : {}),
                emit: (e) => emitWithMetrics(task.id, e),
                evidenceRoot,
              }).catch((err) => {
                process.stderr.write(`[task] 任务 ${task.id} 多机构驱动终止: ${err instanceof Error ? err.message : String(err)}\n`);
              });
            }
          }
        }
      } else {
        // 指定机构模式（第一闭环逻辑）。
        if (!body.institutionName || !body.institutionType) {
          return reply.status(400).send({ error: "TARGETED 模式需要 institutionName 与 institutionType" });
        }
        // R-35/R-37：用户未填官方入口时，从适配器声明机构自动补全（安徽已配置）。
        // 容错匹配：trim 前后空白 + 剥离「安徽省」/「省」前缀后做相等或子串匹配，
        // 覆盖「省公安厅」=「安徽省公安厅」、全名/简称、前导空格等用户输入变体。
        let officialEntryUrl = body.officialEntryUrl ?? null;
        if (!officialEntryUrl && adapter?.declaredInstitutions) {
          const match = matchDeclaredInstitution(adapter.declaredInstitutions, body.institutionName);
          if (match) {
            officialEntryUrl = match.officialEntryUrl;
          }
        }
        await repos.institutionSnapshot.addMany(task.id, [
          {
            regionCode: body.regionCode,
            officialName: body.institutionName,
            commonName: null,
            institutionType: body.institutionType,
            officialEntryUrl,
            discoverySource: "user_specified",
            selectTwoPrimary: true,
          },
        ]);
        // 异步回放（R-34：有 fixtureUrl 走离线金标，无则走机构官方入口真实抓取）。
        // P5：有队列投递则入队（幂等 jobKey），否则直接拉起驱动（测试/离线兼容）。
        if (enqueueTask) {
          await enqueueTask(task);
        } else {
          void runTaskPipeline({
            taskRunId: task.id,
            repos,
            evidenceStore,
            policy,
            ...(fixtureUrl ? { fixtureUrl } : {}),
            emit: (e) => emitWithMetrics(task.id, e),
            evidenceRoot,
          }).catch((err) => {
            process.stderr.write(`[task] 任务 ${task.id} 回放驱动终止: ${err instanceof Error ? err.message : String(err)}\n`);
          });
        }
      }
    }

    const taskView = toTaskSummary(task);
    return reply.send({ task: taskView, idempotencyResult: isNew ? "created" : "replayed" });
  });

  // 任务详情。
  app.get<{ Params: { id: string } }>("/api/tasks/:id", async (req, reply) => {
    const owned = await requireOwnedTask(req, reply, repos, req.params.id);
    if (!owned) return reply;
    const { task } = owned;
    const scopes = await repos.targetScope.listByTask(task.id);
    const institutions = await repos.institutionSnapshot.listByTask(task.id);
    const institution = institutions[0];
    return {
      task: toTaskSummary(task),
      scopes: scopes.map((s) => ({
        id: s.id,
        taskRunId: s.task_run_id,
        regionCode: s.region_code,
        regionName: s.region_name,
        parentRegionCode: s.parent_region_code ?? undefined,
        regionLevel: s.region_level,
        included: s.included,
      })),
      institution: institution
        ? {
            id: institution.id,
            taskRunId: institution.task_run_id,
            regionCode: institution.region_code,
            officialName: institution.official_name,
            commonName: institution.common_name ?? undefined,
            institutionType: institution.institution_type,
            officialEntryUrl: institution.official_entry_url ?? undefined,
            discoverySource: institution.discovery_source,
            selectTwoPrimary: institution.select_two_primary,
            frozenAt: institution.frozen_at,
            status: institution.status,
            terminalReason: institution.terminal_reason ?? undefined,
          }
        : undefined,
    };
  });

  // 结果。
  app.get<{ Params: { id: string } }>("/api/tasks/:id/results", async (req, reply) => {
    const owned = await requireOwnedTask(req, reply, repos, req.params.id);
    if (!owned) return reply;
    const rows = await repos.resultRow.listByTask(req.params.id);
    return rows.map(mapResultRowToView);
  });

  // Biography Task Result（STEP 17）：只读 task_run.result_summary 投影，无需 Agent / LLM。
  app.get<{ Params: { id: string } }>(
    "/api/tasks/:id/biography-result",
    async (req, reply) => {
      const owned = await requireOwnedTask(req, reply, repos, req.params.id);
      if (!owned) return reply;
      const task = owned.task;
      const raw = task.result_summary;
      // pg 解析 jsonb 列为 JS 对象（null = 尚未写入结果投影）。
      const biographyResult = raw !== null && typeof raw === "object" ? raw : null;
      return {
        taskId: task.id,
        taskStatus: task.status,
        biographyResult,
      };
    },
  );

  // 证据详情（简化：汇总支持片段与来源链接）。
  app.get<{ Params: { id: string; resultRowId: string } }>(
    "/api/tasks/:id/evidence/:resultRowId",
    async (req, reply) => {
      const owned = await requireOwnedTask(req, reply, repos, req.params.id);
      if (!owned) return reply;
      const all = await repos.resultRow.listByTask(req.params.id);
      const target = all.find((r) => r.id === req.params.resultRowId);
      if (!target) return { summary: { supportingSnippets: [], officialSourceUrls: [] } };
      return {
        summary: {
          pageTypeZh: target.page_type_zh ?? undefined,
          collectorAccessedAt: target.collected_at,
          reviewerAccessedAt: undefined,
          currentnessRelationZh: undefined,
          supportingSnippets: target.position_display ? [target.position_display] : [],
          terminalReasonZh: target.position_url ? undefined : target.result_zh,
          officialSourceUrls: target.position_url ? [target.position_url] : [],
        },
      };
    },
  );

  // Biography Excel 导出（STEP 18）：BiographyUrlResult → .xlsx Artifact → 直接回传文件。
  app.get<{ Params: { id: string } }>("/api/tasks/:id/export", async (req, reply) => {
    const taskId = req.params.id;
    const owned = await requireOwnedTask(req, reply, repos, taskId);
    if (!owned) return reply;

    const readiness = projectExportReadiness(owned.task.status);
    if (readiness === "NOT_TERMINAL") {
      return reply.code(409).send({ error: "TASK_NOT_READY" });
    }
    if (readiness === "NOT_FINAL_EXPORTABLE") {
      return reply.code(409).send({ error: "TASK_NOT_EXPORTABLE" });
    }

    // 幂等：同任务重复导出直接回传既有 artifact（文件丢失时重建）。
    const existing = await repos.exportArtifact.findLatestByTask(taskId);
    if (existing) {
      const existingBytes = await readFileOrNull(join(exportRoot, existing.filename));
      if (existingBytes !== null) {
        return sendBiographyFile(reply, existing.filename, existingBytes);
      }
    }

    try {
      const taskReader = buildBiographyTaskResultReader(repos);
      const results = await readBiographyResultsForTask(taskReader, repos, taskId);
      if (!results || results.length === 0) {
        return reply.code(409).send({ error: "TASK_NOT_EXPORTABLE" });
      }
      const rows = projectBiographyResultRows(results);
      const out = await renderBiographyResultRows({ taskRunId: taskId, rows, exportDir: exportRoot });
      await repos.exportArtifact.save({
        taskRunId: taskId,
        filename: out.filename,
        rowCount: out.rowCount,
        contentHash: out.contentHash,
        generatedAt: out.generatedAt,
      });
      const bytes = await readFile(out.filePath);
      return sendBiographyFile(reply, out.filename, bytes);
    } catch (error) {
      req.log.error(error);
      return reply.code(500).send({ error: "ARTIFACT_GENERATION_FAILED" });
    }
  });

  // SSE 事件流（断线按 seq 续传；只传用户可见中文状态与安全摘要）。
  app.get<{ Params: { id: string } }>("/api/tasks/:id/events", async (req, reply) => {
    const taskId = req.params.id;
    const owned = await requireOwnedTask(req, reply, repos, taskId);
    if (!owned) return reply;
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });
    const store = sseStore(taskId);
    // 回放既有事件。
    for (const e of store.buffer) {
      reply.raw.write(`event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`);
    }
    const handler = (e: SseEvent): void => {
      reply.raw.write(`event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`);
    };
    store.subscribers.add(handler);
    req.raw.on("close", () => {
      store.subscribers.delete(handler);
    });
    return reply;
  });

  // 任务控制（规格 §19.1：暂停、继续、取消、复制）。
  app.post<{ Params: { id: string } }>("/api/tasks/:id/pause", async (req, reply) => {
    const owned = await requireOwnedTask(req, reply, repos, req.params.id);
    if (!owned) return reply;
    const r = await pauseTask(req.params.id, controlDeps);
    return toControlResponse(r);
  });
  app.post<{ Params: { id: string } }>("/api/tasks/:id/resume", async (req, reply) => {
    const owned = await requireOwnedTask(req, reply, repos, req.params.id);
    if (!owned) return reply;
    const r = await resumeTask(req.params.id, controlDeps);
    return toControlResponse(r);
  });
  app.post<{ Params: { id: string } }>("/api/tasks/:id/cancel", async (req, reply) => {
    const owned = await requireOwnedTask(req, reply, repos, req.params.id);
    if (!owned) return reply;
    const r = await cancelTask(req.params.id, controlDeps);
    return toControlResponse(r);
  });
  app.post<{ Params: { id: string } }>("/api/tasks/:id/duplicate", async (req, reply) => {
    const owned = await requireOwnedTask(req, reply, repos, req.params.id);
    if (!owned) return reply;
    const r = await duplicateTask(req.params.id, owned.userId, controlDeps);
    return toControlResponse(r);
  });
}

/** 任务状态 → 中文（规格 §18.1）。 */
function mapTaskStatusZh(status: string): string {
  const map: Record<string, string> = {
    PENDING: "待开始",
    PREPARING: "正在准备",
    CRAWLING: "正在抓取",
    RECOVERING: "正在恢复搜索",
    REVIEWING: "正在复核",
    GENERATING: "正在生成结果",
    PAUSED: "已暂停",
    CANCELLING: "正在取消",
    CANCELLED: "已取消",
    COMPLETED: "已完成",
    PARTIAL_COMPLETED: "部分完成",
    FAILED: "失败",
  };
  return map[status] ?? "待开始";
}

/** 终态集合：不可暂停/取消/继续（规格 §18.4）。 */
const TERMINAL_STATUSES = new Set([
  "COMPLETED",
  "PARTIAL_COMPLETED",
  "FAILED",
  "CANCELLED",
]);

/** 任务行 → 用户可见摘要（含 controlable，规格 §19.1）。 */
function toTaskSummary(task: {
  id: string;
  status: string;
  mode: string;
  expand_level: string;
  rule_version: string;
  total_institutions: number | string;
  processed_institutions: number | string;
  reviewed_slots: number | string;
  recovery_count: number | string;
  blocked_count: number | string;
  requested_at: string;
  started_at: string | null;
  finished_at: string | null;
  error_message: string | null;
}): import("@stellaris/contracts").TaskRunSummary {
  return {
    id: task.id,
    status: task.status as import("@stellaris/contracts").TaskRunStatus,
    statusZh: mapTaskStatusZh(task.status),
    mode: task.mode as import("@stellaris/contracts").TaskMode,
    expandLevel: task.expand_level as import("@stellaris/contracts").ExpandLevel,
    ruleVersion: task.rule_version,
    totalInstitutions: Number(task.total_institutions),
    processedInstitutions: Number(task.processed_institutions),
    reviewedSlots: Number(task.reviewed_slots),
    recoveryCount: Number(task.recovery_count),
    blockedCount: Number(task.blocked_count),
    requestedAt: task.requested_at,
    ...(task.started_at ? { startedAt: task.started_at } : {}),
    ...(task.finished_at ? { finishedAt: task.finished_at } : {}),
    ...(task.error_message ? { errorMessage: task.error_message } : {}),
    controlable: !TERMINAL_STATUSES.has(task.status),
  };
}

/** 任务控制结果 → 合同响应（TaskRunRow → TaskRunSummary）。 */
function toControlResponse(r: import("../workers/task-control.js").TaskControlResult): import("@stellaris/contracts").TaskControlResponse {
  if (!r.ok) {
    return { ok: false, ...(r.error ? { error: r.error } : {}) };
  }
  return {
    ok: true,
    ...(r.task ? { task: toTaskSummary(r.task) } : {}),
    ...(r.newTaskId ? { newTaskId: r.newTaskId } : {}),
  };
}

/** 每任务 SSE 缓冲与订阅者（进程内简单实现；断线按 seq 续传由 seq 字段支撑）。 */
interface SseStore {
  buffer: SseEvent[];
  subscribers: Set<(e: SseEvent) => void>;
  seq: number;
}
const stores = new Map<string, SseStore>();
function sseStore(taskId: string): SseStore {
  let s = stores.get(taskId);
  if (!s) {
    s = { buffer: [], subscribers: new Set(), seq: 0 };
    stores.set(taskId, s);
  }
  return s;
}
function pushToStore(store: SseStore, e: SseEvent): void {
  const withSeq = { ...e, seq: (store.seq += 1) };
  store.buffer.push(withSeq);
  for (const h of store.subscribers) {
    h(withSeq);
  }
}

/** 供 replay-driver 的 emit 使用：向任务 SSE 缓冲推送事件。 */
export function pushSseEvent(taskId: string, e: SseEvent): void {
  pushToStore(sseStore(taskId), e);
}

/**
 * emit 指标挂钩（P6-D2，规格 §25.2）：驱动事件 → 指标计数。
 * - result.upserted：positionUrl 非空 → qualifiedUrls，空 → emptyUrls；
 * - result.reviewed：reviewed=false → reviewerDivergence；
 * - result.recovery_started：recovery 触发计数（Recovery 成功率由后续 review 判断）；
 * - result.terminal_blank：blockedPages；
 * - task.completed：batchCompleted + firstResultMs。
 */
export function emitWithMetrics(taskId: string, e: SseEvent): void {
  switch (e.type) {
    case "result.upserted":
      if (e.result.positionUrl) {
        metrics.increment("qualifiedUrls");
      } else {
        metrics.increment("emptyUrls");
      }
      break;
    case "result.reviewed":
      if (!e.reviewed) metrics.increment("reviewerDivergence");
      break;
    case "result.recovery_started":
      metrics.increment("recoverySuccess");
      break;
    case "result.terminal_blank":
      metrics.increment("blockedPages");
      break;
    case "task.completed":
      metrics.recordBatchCompleted();
      if (e.statusZh) {
        // 首个结果耗时用批次完成近似（真实首个结果见 firstResultMs 语义，此处不精确）。
      }
      break;
    default:
      break;
  }
  pushSseEvent(taskId, e);
}

/** 机构名结尾特征词（仅此类名称参与保守子串匹配，避免「人民政府」等通用词误配）。 */
const ORG_TAIL = /(厅|局|委|办|署|中心|院|社)$/;

/**
 * 机构名归一化（R-37 自动补全容错）：
 * - 去空白（含用户误输的 `" 安徽省人民政府"` 前导空格）；
 * - 去开头行政区/层级前缀（「安徽省」「省」「市」「区」「县」），对齐全名/简称；
 * - 「委员会」→「委」、「和」去除（「发展和改革委员会」=「发展改革委」）。
 */
function normalizeInstitutionName(name: string): string {
  return name
    .replace(/\s+/g, "")
    .replace(/^安徽省/, "")
    .replace(/^省/, "")
    .replace(/^[市区县]/, "")
    .replace(/委员会/g, "委")
    .replace(/和/g, "");
}

/**
 * R-37：从适配器声明机构容错匹配官方入口。
 * 先归一化精确相等；未命中且名称以机构特征词结尾时做保守子串匹配（避免误配）。
 * 匹配不到返回 null（如实「受限」而非误配）。
 */
export function matchDeclaredInstitution(
  declared: Array<{ officialName: string; officialEntryUrl: string; leadershipUrl?: string }>,
  rawName: string,
): { officialName: string; officialEntryUrl: string; leadershipUrl?: string } | null {
  const normalized = normalizeInstitutionName(rawName);
  if (!normalized) return null;
  const normDeclared = declared.map((d) => ({ d, norm: normalizeInstitutionName(d.officialName) }));

  // 1. 归一化精确相等。
  const exact = normDeclared.find((x) => x.norm === normalized);
  if (exact) return exact.d;

  // 2. 保守子串匹配：仅当输入或声明以机构特征词结尾（厅/局/委/办/署/中心/院/社）时触发，
  //    且双方长度 ≥ 4，避免「人民政府」「政府」等通用后缀误配。
  const keyIsOrg = ORG_TAIL.test(normalized);
  const anyOrg = normDeclared.some((x) => ORG_TAIL.test(x.norm));
  if (keyIsOrg && anyOrg) {
    const subs = normDeclared.filter(
      (x) => x.norm.length >= 4 && normalized.length >= 4 && (x.norm.includes(normalized) || normalized.includes(x.norm)),
    );
    if (subs.length === 1) return subs[0]!.d;

    // 多候选：后缀一致优先（「省XX厅」vs「XX厅」）。
    const tails = subs.filter((x) => x.norm.endsWith(normalized) || normalized.endsWith(x.norm));
    if (tails.length === 1) return tails[0]!.d;
  }

  return null;
}

/** 读取导出文件；不存在/读失败返回 null（artifact 可重建）。 */
async function readFileOrNull(filePath: string): Promise<Buffer | null> {
  try {
    return await readFile(filePath);
  } catch {
    return null;
  }
}

/** 以附件形式回传 .xlsx 文件（不暴露服务器绝对路径）。 */
function sendBiographyFile(reply: FastifyReply, filename: string, bytes: Buffer) {
  return reply
    .header("Content-Type", BIOGRAPHY_EXCEL_MIME)
    .header("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`)
    .send(bytes);
}
