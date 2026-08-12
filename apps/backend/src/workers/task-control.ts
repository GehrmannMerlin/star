import type { SseEvent, TaskRunStatus, TaskMode } from "@stellaris/contracts";
import type { Repositories, TaskRunRow } from "@stellaris/db";
import type { EvidenceStore } from "@stellaris/evidence";
import type { SafeEgressPolicy } from "@stellaris/crawler/safe-egress.js";
import type { SiteAdapter } from "@stellaris/crawler/adapter/loader.js";
import type { RunTaskPipeline } from "./replay-driver.js";
import type { RunMultiInstitutionPipeline } from "./multi-institution-driver.js";
import type { RunMultiRegionPipeline } from "./multi-region-driver.js";
import { getTaskSignal, abortTask, resetTaskSignal } from "./task-signal.js";

/**
 * 任务控制核心（冻结 §5.3 暂停继续 / §5.4 取消 / §18.4 完成语义 / §18.3 幂等）。
 * - pause：非终态 → PAUSED + 协作式中止信号；活动 Worker 在检查点中止；
 * - resume：PAUSED → 清信号 + 重新拉起对应驱动；
 * - cancel：非终态 → CANCELLING + 协作式中止信号 → CANCELLED（终态，保留证据，不 complete）；不可继续；
 * - duplicate：复制范围 + 机构快照到新任务（新 idempotency_key、新任务 ID）。
 * 状态机不变量：PAUSED 仅从非终态进入且可 resume；CANCELLED 仅从非终态进入且为终态。
 */

export interface TaskControlDeps {
  repos: Repositories;
  evidenceStore: EvidenceStore;
  policy: SafeEgressPolicy;
  fixtureUrl?: string;
  adapter?: SiteAdapter;
  runTaskPipeline: RunTaskPipeline;
  runMultiInstitutionPipeline?: RunMultiInstitutionPipeline;
  runMultiRegionPipeline?: RunMultiRegionPipeline;
  emit: (taskId: string, e: SseEvent) => void;
  evidenceRoot: string;
}

export interface TaskControlResult {
  ok: boolean;
  task?: TaskRunRow;
  newTaskId?: string;
  error?: string;
}

/** 非终态集合：可被暂停/取消。 */
const TERMINAL: ReadonlySet<TaskRunStatus> = new Set<TaskRunStatus>([
  "COMPLETED",
  "PARTIAL_COMPLETED",
  "FAILED",
  "CANCELLED",
]);

/** 可暂停状态（非终态 + 未处于取消过渡）。 */
const PAUSABLE: ReadonlySet<TaskRunStatus> = new Set<TaskRunStatus>([
  "PENDING",
  "PREPARING",
  "CRAWLING",
  "RECOVERING",
  "REVIEWING",
]);

/** 可取消状态（非终态）。 */
const CANCELLABLE: ReadonlySet<TaskRunStatus> = new Set<TaskRunStatus>([
  "PENDING",
  "PREPARING",
  "CRAWLING",
  "RECOVERING",
  "REVIEWING",
  "GENERATING",
]);

/** 按任务模式重新拉起对应驱动（resume / 崩溃恢复复用）。 */
export function relaunchPipeline(taskRunId: string, task: TaskRunRow, deps: TaskControlDeps): void {
  const { repos, evidenceStore, policy, fixtureUrl, adapter, runTaskPipeline, runMultiInstitutionPipeline, runMultiRegionPipeline, emit, evidenceRoot } = deps;
  resetTaskSignal(taskRunId);
  const signal = getTaskSignal(taskRunId);
  const base = { taskRunId, repos, evidenceStore, policy, emit: (e: SseEvent) => emit(taskRunId, e), evidenceRoot, signal };
  if (task.mode === "TARGETED") {
    if (fixtureUrl) {
      runTaskPipeline({ ...base, fixtureUrl }).catch((err) => {
        // 驱动异步失败：如实记录（终态由状态机/恢复入口兜底）。
        process.stderr.write(`[task-control] TARGETED 任务 ${taskRunId} 驱动失败: ${err instanceof Error ? err.message : String(err)}\n`);
      });
    }
    return;
  }
  // FULL_INSTITUTION：多行政区（范围多行）走多行政区驱动；否则多机构驱动。
  void repos.targetScope.listByTask(taskRunId).then((scopes) => {
    const multi = scopes.length > 1;
    if (multi && runMultiRegionPipeline && fixtureUrl) {
      runMultiRegionPipeline({ ...base, fixtureUrl, ...(adapter ? { adapter } : {}) }).catch((err) => {
        process.stderr.write(`[task-control] 多行政区任务 ${taskRunId} 驱动失败: ${err instanceof Error ? err.message : String(err)}\n`);
      });
    } else if (runMultiInstitutionPipeline && fixtureUrl) {
      runMultiInstitutionPipeline({ ...base, fixtureUrl, ...(adapter ? { adapter } : {}) }).catch((err) => {
        process.stderr.write(`[task-control] 多机构任务 ${taskRunId} 驱动失败: ${err instanceof Error ? err.message : String(err)}\n`);
      });
    } else {
      process.stderr.write(`[task-control] 任务 ${taskRunId} 无可用驱动（缺少 fixtureUrl 或驱动未注入）\n`);
    }
  }).catch((err) => {
    // 协作式中止 / 范围查询失败：如实记录，不向上抛（避免 unhandled rejection）。
    process.stderr.write(`[task-control] 任务 ${taskRunId} 驱动启动失败: ${err instanceof Error ? err.message : String(err)}\n`);
  });
}

export async function pauseTask(taskRunId: string, deps: TaskControlDeps): Promise<TaskControlResult> {
  const task = await deps.repos.taskRun.findById(taskRunId);
  if (!task) return { ok: false, error: "任务不存在" };
  if (TERMINAL.has(task.status)) return { ok: false, error: "任务已处于终态，不能暂停" };
  if (!PAUSABLE.has(task.status)) return { ok: false, error: "任务当前状态不能暂停" };
  await deps.repos.taskRun.setStatus(taskRunId, "PAUSED");
  abortTask(taskRunId, "pause");
  deps.emit(taskRunId, { type: "task.paused", taskRunId, statusZh: "已暂停", seq: 1 });
  return { ok: true, task: (await deps.repos.taskRun.findById(taskRunId))! };
}

export async function resumeTask(taskRunId: string, deps: TaskControlDeps): Promise<TaskControlResult> {
  const task = await deps.repos.taskRun.findById(taskRunId);
  if (!task) return { ok: false, error: "任务不存在" };
  if (task.status !== "PAUSED") return { ok: false, error: "仅已暂停任务可继续" };
  await deps.repos.taskRun.setStatus(taskRunId, "CRAWLING");
  relaunchPipeline(taskRunId, task, deps);
  deps.emit(taskRunId, { type: "task.resumed", taskRunId, statusZh: "正在抓取", seq: 1 });
  return { ok: true, task: (await deps.repos.taskRun.findById(taskRunId))! };
}

export async function cancelTask(taskRunId: string, deps: TaskControlDeps): Promise<TaskControlResult> {
  const task = await deps.repos.taskRun.findById(taskRunId);
  if (!task) return { ok: false, error: "任务不存在" };
  if (TERMINAL.has(task.status)) return { ok: false, error: "任务已处于终态，不能取消" };
  if (!CANCELLABLE.has(task.status)) return { ok: false, error: "任务当前状态不能取消" };
  // 终态直落 + 协作式中止信号：保留已有证据，不标记为完整完成（冻结 §5.4）。
  // 活动驱动在下一检查点 abort 中止；已提交证据不覆盖不重复写（幂等 upsert）。
  await deps.repos.taskRun.setStatus(taskRunId, "CANCELLED");
  abortTask(taskRunId, "cancel");
  deps.emit(taskRunId, { type: "task.cancelled", taskRunId, statusZh: "已取消", seq: 1 });
  return { ok: true, task: (await deps.repos.taskRun.findById(taskRunId))! };
}

export async function duplicateTask(
  taskRunId: string,
  ownerUserId: string,
  deps: TaskControlDeps,
): Promise<TaskControlResult> {
  const { repos } = deps;
  const src = await repos.taskRun.findByIdForOwner(taskRunId, ownerUserId);
  if (!src) return { ok: false, error: "任务不存在" };
  // 新任务：新 idempotency_key（复制语义，规格 §18.3「重新采集生成新任务 ID」）。
  const idempotencyKey = `duplicate-${taskRunId}`;
  // 复用 createWithIdempotency 生成新任务（同 key 幂等）。
  const created = await repos.taskRun.createWithIdempotency({
    ownerUserId,
    idempotencyKey,
    mode: src.mode,
    expandLevel: "COUNTY",
    ruleVersion: src.rule_version,
  });
  const newId = created.id;
  if (newId === src.id) {
    return { ok: false, error: "复制失败：未生成新任务" };
  }
  // 复制范围。
  const scopes = await repos.targetScope.listByTask(src.id);
  if (scopes.length > 0) {
    await repos.targetScope.addMany(
      newId,
      scopes.map((s) => ({
        regionCode: s.region_code,
        regionName: s.region_name,
        parentRegionCode: s.parent_region_code,
        regionLevel: s.region_level,
        included: s.included,
      })),
    );
  }
  // 复制机构快照。
  const insts = await repos.institutionSnapshot.listByTask(src.id);
  if (insts.length > 0) {
    await repos.institutionSnapshot.addMany(
      newId,
      insts.map((i) => ({
        regionCode: i.region_code,
        officialName: i.official_name,
        commonName: i.common_name,
        institutionType: i.institution_type,
        officialEntryUrl: i.official_entry_url,
        discoverySource: i.discovery_source,
        selectTwoPrimary: i.select_two_primary,
      })),
    );
  }
  return { ok: true, newTaskId: newId };
}
