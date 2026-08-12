import type { SseEvent } from "@stellaris/contracts";
import type { Repositories } from "@stellaris/db";
import type { EvidenceStore } from "@stellaris/evidence";
import type { SafeEgressPolicy } from "@stellaris/crawler/safe-egress.js";
import type { SiteAdapter } from "@stellaris/crawler/adapter/loader.js";
import type { BrowserPool } from "@stellaris/crawler/browser/render.js";
import { runMultiInstitutionPipeline } from "./multi-institution-driver.js";
import { getTaskSignal } from "./task-signal.js";

/**
 * 多行政区编排驱动（规格 §5.1 完整机构模式用户工作流）。
 * 行政区串行：对每个冻结的行政区，调用已校准的多机构驱动（机构发现 + 多机构纵向链路）。
 * 每行政区完成更新 task.progress_changed（真实计数）。
 */

export interface MultiRegionPipelineInput {
  taskRunId: string;
  repos: Repositories;
  evidenceStore: EvidenceStore;
  policy: SafeEgressPolicy;
  fixtureUrl?: string;
  adapter?: SiteAdapter;
  emit: (e: SseEvent) => void;
  evidenceRoot: string;
  /** 进程内浏览器池（透传给多机构驱动，memberDetail.render=playwright 时升级渲染，规格 §10.2）。 */
  browserPool?: BrowserPool;
  /** 协作式取消信号（暂停/取消时在检查点中止，冻结 §5.3）。 */
  signal?: AbortSignal;
}

export interface RunMultiRegionPipeline {
  (input: MultiRegionPipelineInput): Promise<void>;
}

export async function runMultiRegionPipeline(input: MultiRegionPipelineInput): Promise<void> {
  const { taskRunId, repos, evidenceStore, policy, fixtureUrl, adapter, browserPool, emit, evidenceRoot, signal } = input;
  // 协作式取消：优先显式传入的信号；否则回退到进程内注册表（供 API 暂停/取消按任务中止）。
  const effectiveSignal = signal ?? getTaskSignal(taskRunId);
  const checkAbort = (): void => {
    effectiveSignal?.throwIfAborted();
  };

  const task = await repos.taskRun.findById(taskRunId);
  if (!task) throw new Error(`任务不存在: ${taskRunId}`);
  checkAbort();

  // 取冻结的行政区范围（target_scope 多行）。
  const scopes = await repos.targetScope.listByTask(taskRunId);
  const regions = scopes.filter((s) => s.included);
  const total = regions.length;
  if (total === 0) {
    throw new Error(`任务无行政区范围: ${taskRunId}`);
  }

  emit({ type: "task.state_changed", taskRunId, status: "CRAWLING", statusZh: "正在抓取", seq: 1 });
  // 持久化运行态（规格 §18.1）：DB 状态反映真实阶段，供任务控制/崩溃恢复读取。
  await repos.taskRun.markStarted(taskRunId);

  // 行政区串行：逐个行政区跑多机构驱动。
  let processed = 0;
  for (const region of regions) {
    checkAbort();
    emit({ type: "task.progress_changed", taskRunId, processedInstitutions: processed, totalInstitutions: total, seq: 2 + processed });

    // 为当前行政区创建独立的任务范围上下文：多机构驱动依赖任务的行政区。
    // 复用 runMultiInstitutionPipeline，但需按行政区隔离机构发现。
    try {
      await runMultiInstitutionPipelineForRegion({
        taskRunId,
        regionCode: region.region_code,
        regionName: region.region_name,
        repos,
        evidenceStore,
        policy,
        ...(fixtureUrl ? { fixtureUrl } : {}),
        ...(adapter ? { adapter } : {}),
        ...(browserPool ? { browserPool } : {}),
        emit,
        evidenceRoot,
        ...(signal ? { signal } : {}),
      });
    } catch (err) {
      // 协作式中止信号：不再继续其他行政区，抛出中止（不覆盖已设置的 PAUSED/CANCELLED 状态）。
      if (signal?.aborted) {
        throw err;
      }
      // 单个行政区失败不阻塞其他行政区：标记该行政区机构终态并继续。
      emit({
        type: "task.state_changed",
        taskRunId,
        status: "CRAWLING",
        statusZh: "正在抓取",
        seq: 3 + processed,
      });
      process.stderr.write(
        `[multi-region] 行政区 ${region.region_code} 处理失败: ${err instanceof Error ? err.message : String(err)}\n`,
      );
    }

    processed += 1;
    emit({ type: "task.progress_changed", taskRunId, processedInstitutions: processed, totalInstitutions: total, seq: 2 + processed });
  }

  // 全部行政区到终态 → 任务完成。
  await repos.taskRun.complete(taskRunId, "COMPLETED");
  emit({ type: "task.completed", taskRunId, statusZh: "已完成", seq: 100 + total });
}

/**
 * 为单个行政区跑多机构驱动。
 * 多机构驱动内部读取任务范围第一行作为行政区上下文；这里为每个行政区临时切换。
 * 说明：runMultiInstitutionPipeline 取 scopes[0] 作为行政区。为支持多行政区，
 * 这里在调用前不改变任务范围（多行），而是让多机构驱动按 region_code 过滤——见 multi-institution-driver 的行政区匹配增强。
 */
async function runMultiInstitutionPipelineForRegion(input: {
  taskRunId: string;
  regionCode: string;
  regionName: string;
  repos: Repositories;
  evidenceStore: EvidenceStore;
  policy: SafeEgressPolicy;
  fixtureUrl?: string;
  adapter?: SiteAdapter;
  emit: (e: SseEvent) => void;
  evidenceRoot: string;
  browserPool?: BrowserPool;
  signal?: AbortSignal;
}): Promise<void> {
  const { taskRunId, regionCode, regionName, repos, evidenceStore, policy, fixtureUrl, adapter, browserPool, emit, evidenceRoot, signal } = input;
  // 为该行政区指定 regionCode/regionName，多机构驱动据此做机构发现与结果标记。
  // completeTask=false：由多行政区驱动统一 complete，避免每行政区提前完成任务。
  await runMultiInstitutionPipeline({
    taskRunId,
    repos,
    evidenceStore,
    policy,
    ...(fixtureUrl ? { fixtureUrl } : {}),
    ...(adapter ? { adapter } : {}),
    ...(browserPool ? { browserPool } : {}),
    regionCode,
    regionName,
    completeTask: false,
    emit,
    evidenceRoot,
    ...(signal ? { signal } : {}),
  });
}
