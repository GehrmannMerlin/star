import type { SseEvent } from "@stellaris/contracts";
import type {
  InstitutionSnapshotRow,
  Repositories,
  TaskRunRow,
} from "@stellaris/db";
import {
  createDb,
  RecoverySubmissionRepository,
  ReviewDecisionSubmissionRepository,
} from "@stellaris/db";
import type { AdministrativeLevel, InventorySubmissionPayload } from "@stellaris/agent-tools";
import {
  createBiographyPacketWorkflowRunner,
  createPostgresEvidenceSink,
  createPostgresRecoverySubmissionSink,
  createPostgresReviewDecisionSink,
  createPostgresToolEventJournal,
  createRehydrationReaders,
  buildRegionBiographyBatchResult,
  InventoryAgentRunner,
  InstitutionBiographyWorkflowRunner,
  MultiInstitutionBiographyCoordinator,
  ModelPolicy,
  OFFICIAL_BIOGRAPHY_SKILL_NAME,
  PiModelResolver,
  PostgresInstitutionWorkPacketStore,
  SkillRuntime,
  type InstitutionBiographyWorkflowPersistence,
  type InstitutionBiographyWorkflowPort,
  type InstitutionBiographyWorkflowResult,
  type InventoryAgentResult,
  type RegionBiographyBatchResult,
} from "@stellaris/agent-runtime";

/**
 * Biography Task Execution Service（STEP 17）—— Web Task 到已有 Agent Batch Runtime 的适配器。
 *
 * 只做编排，不做任何业务语义决策：
 *   Task request → 解析 region/mode → 冻结 Inventory（FULL=InventoryAgentRunner；TARGETED=机构快照）
 *   → MultiInstitutionBiographyCoordinator（bounded concurrency）
 *   → 逐 Packet onResult → 进度投影（task_run 进度列 + SSE）
 *   → RegionBiographyBatchResult → 确定性终态投影（COMPLETED / PARTIAL_COMPLETED / FAILED）
 *   → task_run.result_summary（只存 aggregation/projection）。
 *
 * 严格边界：
 * - 不 search / fetch / inspect / 选人 / 选 PRIMARY / 选 URL / Review / Recovery —— 全部由 Pi + Skill + 已有 Runner；
 * - PARTIAL_COMPLETED 是合法终态：Reviewer 合法判断无 admissible URL = 业务 UNRESOLVED，不是 Runtime FAILED；
 * - 不伪造 URL；Task Result 只是投影，PRIMARY Biography URL 最终事实仍是 latest frozen APPROVED review；
 * - 无地区-specific code、无 provider/model/API Key（ModelPolicy + Server 环境配置）；
 * - 最小 Claim Gate（claimTask 原子 PENDING|PREPARING → PREPARING）：Graphile 重复投递不启动第二套 Agent。
 */

export type BiographyTaskTerminalStatus = "COMPLETED" | "PARTIAL_COMPLETED" | "FAILED";

/** Worker 对执行器的可见契约（runTaskJob 只依赖 run）。 */
export interface BiographyTaskExecutor {
  run(taskRunId: string, opts?: { signal?: AbortSignal }): Promise<void>;
}

export type BiographyTaskExecutionServiceDeps = {
  /** Kysely 客户端（agent 持久化 sinks 使用）。 */
  db: Awaited<ReturnType<typeof createDb>>;
  repos: Repositories;
  /** SSE 推送（进程内缓冲 + 指标挂钩由调用方决定）。 */
  emit: (taskId: string, e: SseEvent) => void;
  skillRuntime: SkillRuntime;
  modelPolicy?: ModelPolicy;
  modelResolver?: PiModelResolver;
  /** 测试 seam：真实 Workflow（Investigator→Evidence→Reviewer→Recovery→Re-review）。 */
  workflow?: InstitutionBiographyWorkflowPort;
  /** 测试 seam：FULL 模式的 Inventory Agent（真实默认）。 */
  inventoryRunner?: Pick<InventoryAgentRunner, "run">;
  /** bounded concurrency（缺省 = MultiInstitutionBiographyCoordinator 默认 2）。 */
  concurrency?: number;
  /** Dev-smoke-only budget / 最小取消传播。 */
  abortSignal?: AbortSignal;
};

/** 确定性终态投影：任务是否 COMPLETED / PARTIAL_COMPLETED / FAILED 由 Batch Result 机械决定，绝不由 LLM 决定。 */
export function projectTaskTerminalStatus(
  batch: RegionBiographyBatchResult,
): BiographyTaskTerminalStatus {
  if (batch.totalPackets === 0) return "FAILED";
  // 所有 Packet 运行失败且无可用业务结果 → 系统性失败。
  if (batch.failedPackets === batch.totalPackets) return "FAILED";
  // 所有目标 Packet 成功终止且全部 RESOLVED → COMPLETED。
  if (batch.resolvedPackets === batch.totalPackets) return "COMPLETED";
  // 其余（含 PARTIAL / 业务 UNRESOLVED 混合）→ PARTIAL_COMPLETED。
  // Reviewer 合法判断「无 admissible Biography URL」是业务 UNRESOLVED，不是 Runtime FAILED。
  return "PARTIAL_COMPLETED";
}

/** region_level → Skill Inventory 的 administrative_level。 */
export function mapRegionLevelToAdministrative(
  level: string,
): AdministrativeLevel {
  switch (level) {
    case "province":
      return "PROVINCIAL";
    case "city":
      return "PREFECTURE";
    default:
      return "COUNTY";
  }
}

/**
 * TARGETED / 指定机构模式：从冻结的 institution_snapshot 机械构造 1 条 INCLUDE Inventory。
 * 不在此重新判断机构 / 选人 / URL —— 只是把既有快照转成 Coordinator 需要的 Frozen Inventory。
 */
export function buildTargetedFrozenInventory(
  snapshot: InstitutionSnapshotRow,
  regionLevel: string,
): InventorySubmissionPayload {
  return {
    inventory: [
      {
        institution_id: snapshot.id,
        standard_name: snapshot.official_name,
        administrative_level: mapRegionLevelToAdministrative(regionLevel),
        ...(snapshot.institution_type !== null
          ? { core_institution_type: snapshot.institution_type }
          : {}),
        decision: "INCLUDE",
        ...(snapshot.official_entry_url ? { source_url: snapshot.official_entry_url } : {}),
      },
    ],
  };
}

/** Task Result 投影（只存批量结果摘要 + 任务身份；不做第二份 Final Decision SSoT）。 */
export type TaskBiographyResultSummary = RegionBiographyBatchResult & {
  taskId: string;
  regionCode: string;
  regionName?: string;
};

export function buildTaskBiographyResultSummary(
  taskId: string,
  regionCode: string,
  regionName: string,
  batch: RegionBiographyBatchResult,
): TaskBiographyResultSummary {
  return {
    ...batch,
    taskId,
    regionCode,
    regionName,
  };
}

/** 已解析 PRIMARY slot 数（result_summary 读取无需 Agent / LLM）。 */
export function countResolvedPrimarySlots(batch: RegionBiographyBatchResult): number {
  let count = 0;
  for (const result of batch.results) {
    if (result.primary1?.biographyUrl) count += 1;
    if (result.primary2?.biographyUrl) count += 1;
  }
  return count;
}

/** 最小 secret 脱敏（失败 message 不允许携带凭据）。 */
function redactSecrets(text: string): string {
  return text
    .replace(/authorization\s*:\s*[^\r\n]+/gi, "authorization: ***")
    .replace(/\bsk-[A-Za-z0-9_-]{8,}\b/g, "sk-***");
}

function terminalStatuses(): readonly string[] {
  return ["COMPLETED", "PARTIAL_COMPLETED", "FAILED", "CANCELLED", "CANCELLING"];
}

/** FULL 模式 Inventory 非 COMPLETED 的结构化失败原因（不伪造、不抛错）。 */
function inventoryFailureReason(result: Exclude<InventoryAgentResult, { status: "COMPLETED" }>): string {
  switch (result.status) {
    case "INVALID_REQUEST":
      return `机构发现请求无效: ${result.reason}`;
    case "MODEL_NOT_CONFIGURED":
      return "机构发现未配置模型（MODEL_NOT_CONFIGURED）";
    case "MODEL_NOT_FOUND":
      return `机构发现模型不可用: ${result.provider}/${result.model}`;
    case "INVENTORY_NOT_SUBMITTED":
      return "机构发现未冻结清单（INVENTORY_NOT_SUBMITTED）";
    default:
      return "机构发现失败";
  }
}

export class BiographyTaskExecutionService implements BiographyTaskExecutor {
  private readonly db: Awaited<ReturnType<typeof createDb>>;
  private readonly repos: Repositories;
  private readonly emit: (taskId: string, e: SseEvent) => void;
  private readonly skillRuntime: SkillRuntime;
  private readonly modelPolicy: ModelPolicy;
  private readonly modelResolverPromise: Promise<PiModelResolver>;
  private readonly workflow: InstitutionBiographyWorkflowPort | undefined;
  private readonly inventoryRunner: Pick<InventoryAgentRunner, "run">;
  private readonly concurrency: number;
  private readonly abortSignal: AbortSignal | undefined;

  constructor(private readonly deps: BiographyTaskExecutionServiceDeps) {
    this.db = deps.db;
    this.repos = deps.repos;
    this.emit = deps.emit;
    this.skillRuntime = deps.skillRuntime;
    this.modelPolicy = deps.modelPolicy ?? new ModelPolicy();
    this.modelResolverPromise =
      deps.modelResolver !== undefined ? Promise.resolve(deps.modelResolver) : PiModelResolver.create();
    this.workflow = deps.workflow;
    this.concurrency = deps.concurrency ?? 2;
    this.abortSignal = deps.abortSignal;
    this.inventoryRunner =
      deps.inventoryRunner ??
      new InventoryAgentRunner({
        skillRuntime: this.skillRuntime,
        modelPolicy: this.modelPolicy,
        ...(this.abortSignal ? { abortSignal: this.abortSignal } : {}),
      });
  }

  /** Worker 入口：claim → 编排 → 终态。重复投递/终态任务安全。 */
  async run(taskRunId: string, opts?: { signal?: AbortSignal }): Promise<void> {
    const task = await this.repos.taskRun.findById(taskRunId);
    if (!task) throw new Error(`任务不存在: ${taskRunId}`);
    if (terminalStatuses().includes(task.status)) {
      return; // 终态任务：job no-op。
    }
    const claimed = await this.repos.taskRun.claimTask(taskRunId);
    if (!claimed) {
      return; // 已被其它 Worker 领取（或状态不可领取）→ 不启动第二套 Agent Workflow。
    }
    // 取消：Task-level signal（runTaskJob 经 getTaskSignal 传入；缺省回退构造期静态 budget）。
    const signal = opts?.signal ?? this.abortSignal;
    if (signal?.aborted) return; // 已取消：不启动 Agent Workflow（终态已由 cancelTask 持久化）。
    const emit = (e: SseEvent): void => this.emit(taskRunId, e);
    try {
      await this.execute(claimed, emit, signal);
    } catch (error) {
      // 取消：control-flow cancellation → 直接返回（不记 FAILED、不重抛 → Graphile 不重试）。
      if (signal?.aborted) return;
      const message = redactSecrets(error instanceof Error ? error.message : String(error));
      // 系统异常：如实记 FAILED，再向上抛（Graphile 重试 → 终态 fast-path no-op）。
      await this.repos.taskRun.complete(taskRunId, "FAILED", message).catch(() => undefined);
      throw error;
    }
  }

  private async execute(
    task: TaskRunRow,
    emit: (e: SseEvent) => void,
    signal: AbortSignal | undefined,
  ): Promise<void> {
    // STEP 19.3：Agent 阶段投影（业务边界更新；SSE 实时 + task_run.agent_stage 持久化）。
    emit({ type: "task.state_changed", taskRunId: task.id, status: "PREPARING", statusZh: "正在准备", stage: "PREPARING", seq: 1 });
    await this.repos.taskRun.setAgentProgress(task.id, { stage: "PREPARING" }).catch(() => undefined);

    const scopes = await this.repos.targetScope.listByTask(task.id);
    const scope = scopes[0];
    if (!scope) throw new Error(`任务无行政区范围: ${task.id}`);
    const regionCode = scope.region_code;
    const regionName = scope.region_name;

    // ── 冻结 Inventory ──
    let frozen: InventorySubmissionPayload;
    if (task.mode === "TARGETED") {
      const snapshots = await this.repos.institutionSnapshot.listByTask(task.id);
      const snapshot = snapshots[0];
      if (!snapshot) throw new Error(`任务无指定机构: ${task.id}`);
      frozen = buildTargetedFrozenInventory(snapshot, scope.region_level);
    } else if (task.mode === "FULL_INSTITUTION") {
      // STEP 19.3：机构发现阶段（FULL 专属）。
      emit({ type: "task.state_changed", taskRunId: task.id, status: "PREPARING", statusZh: "正在发现机构", stage: "INVENTORY_DISCOVERY", seq: 2 });
      await this.repos.taskRun.setAgentProgress(task.id, { stage: "INVENTORY_DISCOVERY" }).catch(() => undefined);
      // STEP 19.3：多行政区 scope 合并为单一 Frozen Inventory（按机构去重），
      // 避免 FULL 任务被 expandRegions 展开后误走 legacy multi-region 业务主流程。
      const includedScopes = scopes.filter((s) => s.included);
      const inventory: InventorySubmissionPayload["inventory"] = [];
      const seen = new Set<string>();
      for (const s of includedScopes) {
        const inventoryResult = await this.inventoryRunner.run({ regionCode: s.region_code, mode: "FULL" });
        if (signal?.aborted) return; // 取消：不推进后续编排（终态已持久化）。
        if (inventoryResult.status !== "COMPLETED") {
          const reason = inventoryFailureReason(inventoryResult);
          await this.repos.taskRun.setAgentProgress(task.id, { stage: "FAILED" }).catch(() => undefined);
          await this.repos.taskRun.complete(task.id, "FAILED", reason);
          emit({ type: "task.failed", taskRunId: task.id, errorMessageZh: reason, seq: 2 });
          return; // 结构化失败（业务失败语义，非系统异常 → 不重抛）。
        }
        for (const record of inventoryResult.inventory) {
          if (seen.has(record.standard_name)) continue; // 跨 scope 机构去重。
          seen.add(record.standard_name);
          inventory.push(record);
        }
      }
      frozen = { inventory };
      // STEP 19.3：Empty Inventory 不得静默 COMPLETED（规格 §97）。
      if (inventory.length === 0) {
        const reason = "未发现可采集机构（EMPTY_INVENTORY）";
        await this.repos.taskRun.setAgentProgress(task.id, { stage: "FAILED" }).catch(() => undefined);
        await this.repos.taskRun.complete(task.id, "FAILED", reason);
        emit({ type: "task.failed", taskRunId: task.id, errorMessageZh: reason, seq: 2 });
        return;
      }
    } else {
      throw new Error(`Biography 运行时暂不支持任务模式: ${task.mode}`);
    }

    // STEP 19.3：冻结完成 → 阶段（FULL=INVENTORY_FROZEN；TARGETED 直接 INVESTIGATING）。
    const postFreezeStage = task.mode === "FULL_INSTITUTION" ? "INVENTORY_FROZEN" : "INVESTIGATING";
    emit({
      type: "task.state_changed",
      taskRunId: task.id,
      status: "CRAWLING",
      statusZh: task.mode === "FULL_INSTITUTION" ? "正在抓取" : "正在调查",
      stage: postFreezeStage,
      seq: 3,
    });
    await this.repos.taskRun.setAgentProgress(task.id, { stage: postFreezeStage }).catch(() => undefined);
    // 持久化运行态（Claim 后立即推进）：重复投递在 CRAWLING 时 claimTask 返回 undefined。
    await this.repos.taskRun.setStatus(task.id, "CRAWLING");
    // 进度总目标：Inventory INCLUDE 记录数（Packet 机械一一对应）。
    const expectedPackets = frozen.inventory.filter((record) => record.decision === "INCLUDE").length;
    await this.repos.taskRun.setProgress(task.id, { totalInstitutions: expectedPackets });

    // ── 每任务 fresh Workflow + Coordinator（不跨任务共享 Agent Session）──
    const workflow = this.workflow ?? (await this.buildRealWorkflow(signal));
    const packetStore = new PostgresInstitutionWorkPacketStore(this.repos.institutionWorkPacket);
    const collected = new Map<string, InstitutionBiographyWorkflowResult>();
    const innerRunPacket = createBiographyPacketWorkflowRunner(
      workflow,
      (result) => {
        collected.set(result.packetId, result);
        // 逐 Packet 完成：原子自增 + SSE 进度（不记录每次 search/fetch/inspect —— 那些已有 ToolEvent）。
        void this.repos.taskRun
          .incrementProcessed(task.id)
          .then((row) =>
            emit({
              type: "task.progress_changed",
              taskRunId: task.id,
              processedInstitutions: row?.processed_institutions ?? 0,
              totalInstitutions: row?.total_institutions ?? 0,
              seq: 10,
            }),
          )
          .catch(() => undefined);
      },
      signal,
    );
    const coordinator = new MultiInstitutionBiographyCoordinator({
      packetStore,
      concurrency: this.concurrency,
      // STEP 19.3：Coordinator 开始 Institution Packet → 更新当前机构 + 阶段。
      runPacket: async (packet) => {
        await this.repos.taskRun
          .setAgentProgress(task.id, { currentInstitution: packet.institutionName })
          .catch(() => undefined);
        emit({
          type: "task.state_changed",
          taskRunId: task.id,
          status: "CRAWLING",
          statusZh: "正在调查",
          stage: "INVESTIGATING",
          seq: 4,
        });
        return innerRunPacket(packet);
      },
    });

    const { packets } = await coordinator.run(frozen, { regionCode, ...(signal ? { signal } : {}) });
    // 取消：不再聚合 / 投影 / 写终态（终态已由 cancelTask 持久化为 CANCELLED）。
    if (signal?.aborted) return;
    await this.repos.taskRun.setProgress(task.id, { totalInstitutions: packets.length });

    // ── 聚合 + 确定性终态投影 + Task Result 投影 ──
    emit({ type: "task.state_changed", taskRunId: task.id, status: "CRAWLING", statusZh: "正在生成结果", stage: "FINALIZING", seq: 5 });
    await this.repos.taskRun.setAgentProgress(task.id, { stage: "FINALIZING" }).catch(() => undefined);
    const workflowResults = packets
      .map((packet) => collected.get(packet.packetId))
      .filter((result): result is InstitutionBiographyWorkflowResult => result !== undefined);
    const batch = buildRegionBiographyBatchResult(workflowResults, regionCode);
    const terminal = projectTaskTerminalStatus(batch);
    const summary = buildTaskBiographyResultSummary(task.id, regionCode, regionName, batch);
    const reviewedSlots = countResolvedPrimarySlots(batch);

    await this.repos.taskRun.setResultSummary(task.id, summary);
    await this.repos.taskRun.setProgress(task.id, { reviewedSlots });
    // STEP 19.3：终态 stage 投影（在 complete 前写，避免 terminal 状态守卫拦截；清除当前机构）。
    const terminalStage = terminal === "FAILED" ? "FAILED" : terminal === "COMPLETED" ? "COMPLETED" : "PARTIAL_COMPLETED";
    await this.repos.taskRun
      .setAgentProgress(task.id, { stage: terminalStage, currentInstitution: null })
      .catch(() => undefined);
    await this.repos.taskRun.complete(
      task.id,
      terminal,
      terminal === "FAILED"
        ? `全部机构采集失败（${batch.failedPackets}/${batch.totalPackets} 个 Packet 运行失败）`
        : undefined,
    );

    if (terminal === "FAILED") {
      emit({ type: "task.failed", taskRunId: task.id, errorMessageZh: "全部机构采集失败", seq: 6 });
    } else {
      emit({
        type: "task.completed",
        taskRunId: task.id,
        statusZh: terminal === "COMPLETED" ? "已完成" : "部分完成",
        seq: 3,
      });
    }
  }

  /** 真实 per-packet Workflow（与 STEP 16 一致的持久化 identity 组装）。 */
  private async buildRealWorkflow(signal?: AbortSignal): Promise<InstitutionBiographyWorkflowPort> {
    await this.skillRuntime.reload();
    const identity = await this.skillRuntime.resolveSkill(OFFICIAL_BIOGRAPHY_SKILL_NAME);
    const modelResolver = await this.modelResolverPromise;
    return new InstitutionBiographyWorkflowRunner({
      skillRuntime: this.skillRuntime,
      modelPolicy: this.modelPolicy,
      modelResolver,
      skill: { name: identity.name, version: identity.version },
      persistence: this.buildPersistence(),
      // STEP 19.3：Investigator/Evidence 阶段 ToolEvent 作为 Agent provenance 持久化到
      // tool_event 表（gate/总结仍走内存 sink）。不记录凭据/完整网页正文/模型推理。
      toolEventSinkFactory: () => createPostgresToolEventJournal(this.db),
      ...(signal ? { abortSignal: signal } : {}),
    });
  }

  /** 三路持久化读取器 + 重水合（与 STEP 16 batch smoke 同构）。 */
  private buildPersistence(): InstitutionBiographyWorkflowPersistence {
    const readers = createRehydrationReaders(this.db);
    return {
      packetStore: new PostgresInstitutionWorkPacketStore(this.repos.institutionWorkPacket),
      createEvidenceSink: (identity) => createPostgresEvidenceSink(this.db, identity),
      createReviewSink: (identity) => createPostgresReviewDecisionSink(this.db, identity),
      createRecoverySink: (identity) => createPostgresRecoverySubmissionSink(this.db, identity),
      evidenceReader: readers.evidenceReader,
      reviewReader: readers.reviewReader,
      reviewRepo: new ReviewDecisionSubmissionRepository(this.db),
      recoveryRepo: new RecoverySubmissionRepository(this.db),
    };
  }
}
