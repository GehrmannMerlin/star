import type { SseEvent } from "@stellaris/contracts";
import type {
  Repositories,
  ResultRowRow,
} from "@stellaris/db";
import { mapResultRowToView } from "@stellaris/db";
import type { EvidenceStore } from "@stellaris/evidence";
import { httpFetch } from "@stellaris/crawler/http-fetch.js";
import { extractPageFacts } from "@stellaris/crawler/page-facts.js";
import type { SafeEgressPolicy } from "@stellaris/crawler/safe-egress.js";
import { classifyPage } from "@stellaris/rules/classify.js";
import { assembleLeadership } from "@stellaris/rules/leadership.js";
import { selectTwoPrimary } from "@stellaris/rules/selection.js";
import { evaluateCurrentness } from "@stellaris/rules/currentness.js";
import { checkHardGates } from "@stellaris/rules/admission.js";
import { decideRecovery } from "@stellaris/rules/recovery.js";
import { runReviewer, makeRequestKey } from "@stellaris/rules/reviewer.js";
import { getTaskSignal } from "./task-signal.js";

/**
 * 离线回放编排（第一闭环纵向链路）。
 * 任务 -> 冻结范围/机构 -> CrawlIntent -> httpFetch(fixture) -> 证据保存
 * -> extractPageFacts -> assembleLeadership -> selectTwoPrimary
 * -> checkHardGates -> 必要时 decideRecovery/runReviewer
 * -> result_row.upsertCurrentResult（事务；position_url 仅 Reviewer MATCH 时非空）
 * -> 触发 SSE 事件。
 * 全部在离线 fixture 下运行，不访问真实公网。
 */

export interface RunTaskPipelineInput {
  taskRunId: string;
  repos: Repositories;
  evidenceStore: EvidenceStore;
  policy: SafeEgressPolicy;
  fixtureUrl?: string;
  emit: (e: SseEvent) => void;
  evidenceRoot: string;
  /** 协作式取消信号（暂停/取消时在检查点中止，冻结 §5.3）。 */
  signal?: AbortSignal;
}

export interface RunTaskPipeline {
  (input: RunTaskPipelineInput): Promise<void>;
}

export function createReplayDriver(): RunTaskPipeline {
  return async function runTaskPipeline(input: RunTaskPipelineInput): Promise<void> {
    const { taskRunId, repos, evidenceStore, policy, fixtureUrl, emit, evidenceRoot, signal } = input;
    // 协作式取消：优先显式传入的信号；否则回退到进程内注册表（供 API 暂停/取消按任务中止）。
    const effectiveSignal = signal ?? getTaskSignal(taskRunId);
    const checkAbort = (): void => {
      effectiveSignal?.throwIfAborted();
    };

    // 1. 取任务与机构。
    const task = await repos.taskRun.findById(taskRunId);
    if (!task) throw new Error(`任务不存在: ${taskRunId}`);
    const institutions = await repos.institutionSnapshot.listByTask(taskRunId);
    const institution = institutions[0];
    if (!institution) throw new Error(`任务无机构: ${taskRunId}`);
    checkAbort();

    emit({
      type: "task.state_changed",
      taskRunId,
      status: "CRAWLING",
      statusZh: "正在抓取",
      seq: 1,
    });
    // 持久化运行态（规格 §18.1）：DB 状态反映真实阶段，供任务控制/崩溃恢复读取。
    await repos.taskRun.markStarted(taskRunId);

    // 2. 主入口抓取（指定机构模式：先用机构官方入口，否则用 fixture 集合页）。
    const entryUrl = institution.official_entry_url ?? (fixtureUrl ? `${fixtureUrl}/golden/collection.html` : null);
    if (!entryUrl) {
      // 无机构入口且无 fixture 集合页 → 无法抓取（真实模式需机构提供官方入口）。
      await repos.resultRow.upsertCurrentResult({
        taskRunId,
        institutionSnapshotId: institution.id,
        slot: "PRIMARY_1",
        regionCode: institution.region_code,
        institutionName: institution.official_name,
        positionDisplay: `${institution.official_name} 主要负责人`,
        personName: null,
        currentStatusZh: "暂未确认",
        positionUrl: null,
        pageTypeZh: null,
        resultZh: "官网访问受限",
        collectedAt: new Date().toISOString(),
      });
      await repos.resultRow.upsertCurrentResult({
        taskRunId,
        institutionSnapshotId: institution.id,
        slot: "PRIMARY_2",
        regionCode: institution.region_code,
        institutionName: institution.official_name,
        positionDisplay: `${institution.official_name} 常务副职`,
        personName: null,
        currentStatusZh: "暂未确认",
        positionUrl: null,
        pageTypeZh: null,
        resultZh: "官网访问受限",
        collectedAt: new Date().toISOString(),
      });
      emit({ type: "task.completed", taskRunId, statusZh: "已完成", seq: 8 });
      // R-37：空入口分支此前漏调 complete()，任务永久卡 CRAWLING；补终态。
      await repos.taskRun.complete(taskRunId, "COMPLETED");
      return;
    }
    const entryCanonical = makeRequestKey(taskRunId, "collector", entryUrl);
    await repos.crawlIntent.createIfAbsent({
      taskRunId,
      institutionSnapshotId: institution.id,
      originalUrl: entryUrl,
      canonicalKey: entryCanonical,
      priority: 0,
      phase: "primary",
      purpose: "collector",
    });

    const collectionRes = await httpFetch(entryUrl, policy);
    const collectionFacts = await extractPageFacts(collectionRes.body);
    // 证据保存：集合页原始 HTML。
    await saveEvidence(evidenceStore, evidenceRoot, collectionRes.body, "html", repos, taskRunId, collectionRes.status);
    emit({ type: "institution.completed", taskRunId, institutionSnapshotId: institution.id, statusZh: "正在抓取", seq: 2 });

    // 3. 判型与当前性（集合页；每槽位各自评估当前性）。
    const collectionClass = classifyPage(collectionFacts.title ?? "", collectionFacts.bodyText, collectionFacts);
    const upstreamHrefs = collectionFacts.links.map((l) => l.href);
    const evaluateCurrentnessFor = (personName: string) =>
      evaluateCurrentness(personName, {
        collectionMemberHrefs: upstreamHrefs,
        detailHref: null,
        factsList: [collectionFacts],
      });

    // 4. 完整领导结构 + 两名主要自然人。
    const structure = assembleLeadership(institution.id, [collectionFacts], new Map());
    const [slot1, slot2] = selectTwoPrimary(institution.institution_type, structure);
    await repos.leadership.saveLeadership({
      taskRunId,
      institutionSnapshotId: institution.id,
      leadershipJson: structure.members,
    });
    await repos.slotDecision.upsertSlot({ taskRunId, institutionSnapshotId: institution.id, slot: slot1.slot, personName: slot1.personName, status: slot1.status });
    await repos.slotDecision.upsertSlot({ taskRunId, institutionSnapshotId: institution.id, slot: slot2.slot, personName: slot2.personName, status: slot2.status });
    emit({ type: "task.progress_changed", taskRunId, processedInstitutions: 1, totalInstitutions: 1, seq: 3 });

    // 5. 每个槽位：抓详情页 -> 硬门槛 -> Reviewer -> result_row。
    const slots = [slot1, slot2];
    for (const slot of slots) {
      checkAbort();
      if (slot.personName == null) {
        // 空缺/未确认：写空 URL + 中文终态原因。
        const reasonZh = slot.status === "VACANT" ? "岗位空缺" : "当前人员未确认";
        await repos.resultRow.upsertCurrentResult({
          taskRunId,
          institutionSnapshotId: institution.id,
          slot: slot.slot,
          regionCode: institution.region_code,
          institutionName: institution.official_name,
          positionDisplay: `${institution.official_name} ${slot.slot === "PRIMARY_1" ? "主要负责人" : "常务副职"}`,
          personName: slot.personName,
          currentStatusZh: slot.status === "VACANT" ? "空缺" : "暂未确认",
          positionUrl: null,
          pageTypeZh: null,
          resultZh: reasonZh,
          collectedAt: new Date().toISOString(),
        });
        emit({ type: "result.terminal_blank", taskRunId, institutionSnapshotId: institution.id, slot: slot.slot, terminalReasonZh: reasonZh, seq: 4 });
        continue;
      }

      // 详情页 URL：从集合页该人员链接解析（fixture 下为相对路径 -> 拼接）。
      const member = collectionFacts.leadershipMembers.find((m) => m.name === slot.personName);
      const detailUrl = member?.href ? new URL(member.href, collectionRes.fetchUrl).toString() : null;
      if (!detailUrl) {
        await repos.resultRow.upsertCurrentResult({
          taskRunId,
          institutionSnapshotId: institution.id,
          slot: slot.slot,
          regionCode: institution.region_code,
          institutionName: institution.official_name,
          positionDisplay: `${institution.official_name} ${slot.personName}`,
          personName: slot.personName,
          currentStatusZh: "暂未确认",
          positionUrl: null,
          pageTypeZh: null,
          resultZh: "完整搜索后无合格URL",
          collectedAt: new Date().toISOString(),
        });
        emit({ type: "result.terminal_blank", taskRunId, institutionSnapshotId: institution.id, slot: slot.slot, terminalReasonZh: "完整搜索后无合格URL", seq: 4 });
        continue;
      }

      const detailRes = await httpFetch(detailUrl, policy);
      const detailFacts = await extractPageFacts(detailRes.body);
      await saveEvidence(evidenceStore, evidenceRoot, detailRes.body, "html", repos, taskRunId, detailRes.status);
      const detailClass = classifyPage(detailFacts.title ?? "", detailFacts.bodyText, detailFacts);

      // Reviewer 独立复抓先行（六方面一致后再检查硬门槛，规格 §15.3）。
      let reviewerOk = false;
      if (!detailClass.forbidden && detailClass.pageType != null) {
        const review = await runReviewer(
          {
            taskRunId,
            institutionSnapshotId: institution.id,
            personName: slot.personName,
            institutionName: institution.official_name,
            officialRole: member?.roles[0] ?? "",
            urlToReview: detailUrl,
            upstreamUrls: [collectionRes.fetchUrl],
            policy,
          },
          { fetchAttempts: repos.fetchAttempt, reviews: repos.review },
        );
        reviewerOk = review.decision === "MATCH";
        emit({ type: "result.reviewed", taskRunId, institutionSnapshotId: institution.id, slot: slot.slot, reviewed: reviewerOk, seq: 6 });
        if (!reviewerOk) {
          await repos.recoveryAttempt.addAttempt({
            taskRunId,
            institutionSnapshotId: institution.id,
            triggerReason: "Reviewer 复核不一致",
            strategy: "re-fetch",
            budgetUsed: 1,
            result: "STILL_UNRESOLVED",
          });
        }
      }

      // 9 项硬门槛（Reviewer 一致作为其一）。
      const gates = checkHardGates({
        url: detailUrl,
        pageType: detailClass.pageType ?? "CURRENT_LEADER_COLLECTION",
        forbidden: detailClass.forbidden,
        personName: slot.personName,
        institutionName: institution.official_name,
        officialRole: member?.roles[0] ?? "",
        currentness: evaluateCurrentnessFor(slot.personName),
        priorityEntryChecked: true,
        reviewerConsistent: reviewerOk,
        officialDomains: [new URL(collectionRes.fetchUrl).hostname],
        forbiddenSignals: [],
      });
      await repos.urlCandidate.addCandidate({
        taskRunId,
        institutionSnapshotId: institution.id,
        url: detailUrl,
        discoveryScore: 0,
        hardGate: { passed: gates.passed, failures: gates.failures },
      });

      // Recovery 判定（简化：硬门槛失败即触发）。
      const recovery = decideRecovery({
        urlEmpty: false,
        forbidden: gates.failures.some((f) => f.gate === "no_forbidden_signal"),
        personMismatch: gates.failures.some((f) => f.gate === "supports_person"),
        institutionMismatch: gates.failures.some((f) => f.gate === "supports_institution"),
        roleMismatch: gates.failures.some((f) => f.gate === "supports_official_role"),
        currentnessConflict: gates.failures.some((f) => f.gate === "currentness_ok"),
        priorityNotChecked: false,
        secondUnconfirmed: false,
        reviewerDisagree: !reviewerOk,
      });
      if (recovery.triggered) {
        await repos.recoveryAttempt.addAttempt({
          taskRunId,
          institutionSnapshotId: institution.id,
          triggerReason: recovery.reason ?? "硬门槛失败",
          strategy: recovery.nextStrategies[0] ?? "re-fetch",
          budgetUsed: 1,
          result: "FAILED",
        });
        emit({ type: "result.recovery_started", taskRunId, institutionSnapshotId: institution.id, seq: 5 });
      }

      // 写 result_row：非空 URL 仅当 Reviewer MATCH 且硬门槛通过。
      const finalUrl = reviewerOk && gates.passed ? detailUrl : null;
      const resultZh = finalUrl ? "已找到并复核" : reviewerOk && !gates.passed ? "页面结构无法确认" : "完整搜索后无合格URL";
      const row = await repos.resultRow.upsertCurrentResult({
        taskRunId,
        institutionSnapshotId: institution.id,
        slot: slot.slot,
        regionCode: institution.region_code,
        institutionName: institution.official_name,
        positionDisplay: `${institution.official_name} ${member?.roles[0] ?? ""}`.trim(),
        personName: slot.personName,
        currentStatusZh: "正式在任",
        positionUrl: finalUrl,
        pageTypeZh: finalUrl && detailClass.pageType ? mapPageTypeZh(detailClass.pageType) : null,
        resultZh,
        collectedAt: new Date().toISOString(),
      });
      emit({ type: "result.upserted", taskRunId, result: mapResultRowToView(row), seq: 7 });
    }

    // 6. 任务完成。
    await repos.taskRun.complete(taskRunId, "COMPLETED");
    emit({ type: "task.completed", taskRunId, statusZh: "已完成", seq: 8 });
  };
}

/** 证据保存（写文件 + document_snapshot 记录，DB 只存相对路径）。 */
async function saveEvidence(
  evidenceStore: EvidenceStore,
  evidenceRoot: string,
  raw: Uint8Array,
  category: "html" | "json" | "headers" | "screenshot",
  repos: Repositories,
  taskRunId: string,
  httpStatus: number,
): Promise<void> {
  const saved = await evidenceStore.save({ raw, mimeType: category === "html" ? "text/html" : "application/octet-stream", category });
  await repos.documentSnapshot.upsertByHash({
    contentHash: saved.contentHash,
    mimeType: category === "html" ? "text/html" : "application/octet-stream",
    charset: null,
    sizeBytes: saved.sizeBytes,
    relativePath: saved.relativePath,
  });
  await repos.fetchAttempt.create({
    taskRunId,
    crawlIntentId: null,
    fetchMode: "HTTP",
    url: "",
    canonicalKey: saved.contentHash,
    httpStatus,
    status: httpStatus >= 200 && httpStatus < 300 ? "SUCCESS" : "ERROR",
    resolvedIp: null,
    durationMs: 0,
    redirectedUrl: null,
    documentSnapshotId: null,
    errorMessage: null,
  });
}

function mapPageTypeZh(pageType: string): string {
  const map: Record<string, string> = {
    OFFICIAL_BIOGRAPHY: "个人简介页",
    OFFICIAL_PROFILE_CARD: "个人卡片页",
    LEADERSHIP_DIVISION: "领导分工页",
    CURRENT_LEADER_DETAIL: "当前领导详情页",
    CURRENT_LEADER_COLLECTION: "当前领导集合页",
  };
  return map[pageType] ?? "当前领导集合页";
}
