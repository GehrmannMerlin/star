import type { SseEvent } from "@stellaris/contracts";
import type { Repositories, ResultRowRow } from "@stellaris/db";
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
import { discoverInstitutions } from "@stellaris/crawler/discovery/discover.js";
import type { SiteAdapter } from "@stellaris/crawler/adapter/loader.js";
import type { BrowserPool } from "@stellaris/crawler/browser/render.js";
import type { PolitenessGate, HttpCache } from "@stellaris/crawler";
import type { SearchProvider } from "@stellaris/crawler/search/provider.js";
import { runRecovery } from "@stellaris/rules/recovery-executor.js";
import { getTaskSignal } from "./task-signal.js";

/**
 * 多机构编排驱动（规格 §8.2 完整机构模式）。
 * 流程：机构发现 → 机构清单冻结 → 多机构调度（小并发）→ 每机构纵向链路 → 任务完成。
 * 每机构复用单机构纵向链路逻辑（processSingleInstitution，从 replay-driver 抽出的共享函数）。
 */

export interface MultiInstitutionPipelineInput {
  taskRunId: string;
  repos: Repositories;
  evidenceStore: EvidenceStore;
  policy: SafeEgressPolicy;
  fixtureUrl?: string;
  adapter?: SiteAdapter;
  /** 进程内浏览器池（memberDetail.render=playwright 时升级渲染，规格 §10.2）。 */
  browserPool?: BrowserPool;
  concurrency?: number;
  emit: (e: SseEvent) => void;
  evidenceRoot: string;
  /** 行政区覆盖（多行政区驱动为每个行政区指定，否则用任务范围第一行）。 */
  regionCode?: string;
  regionName?: string;
  /** 是否在管道末尾 complete 任务（多行政区驱动为 false，由外层统一 complete）。 */
  completeTask?: boolean;
  /** 协作式取消信号（暂停/取消时在检查点中止，冻结 §5.3）。 */
  signal?: AbortSignal;
  /** 礼貌并发闸（P1：站点+全局并发、429 退避，规格 §11）。 */
  politeness?: PolitenessGate;
  /** HTTP 内存缓存（P1：Reviewer 复验绕过，规格 §11.3）。 */
  httpCache?: HttpCache;
  /** 搜索提供器（P2：Recovery 搜索候选；缺省 Fixture）。 */
  searchProvider?: SearchProvider;
}

export interface RunMultiInstitutionPipeline {
  (input: MultiInstitutionPipelineInput): Promise<void>;
}

export async function runMultiInstitutionPipeline(input: MultiInstitutionPipelineInput): Promise<void> {
  const { taskRunId, repos, evidenceStore, policy, fixtureUrl, adapter, browserPool, concurrency = 3, emit, evidenceRoot, regionCode, regionName, completeTask = true, signal, politeness, httpCache, searchProvider } = input;
  // 协作式取消：优先显式传入的信号；否则回退到进程内注册表（供 API 暂停/取消按任务中止）。
  const effectiveSignal = signal ?? getTaskSignal(taskRunId);
  const checkAbort = (): void => {
    effectiveSignal?.throwIfAborted();
  };

  const task = await repos.taskRun.findById(taskRunId);
  if (!task) throw new Error(`任务不存在: ${taskRunId}`);
  // 行政区：优先覆盖参数（多行政区驱动），否则取任务范围第一行。
  const regionCode_ = regionCode ?? (await repos.targetScope.listByTask(taskRunId))[0]?.region_code;
  const regionName_ = regionName ?? (await repos.targetScope.listByTask(taskRunId))[0]?.region_name;
  if (!regionCode_ || !regionName_) throw new Error(`任务无行政区范围: ${taskRunId}`);
  checkAbort();

  emit({ type: "task.state_changed", taskRunId, status: "PREPARING", statusZh: "正在准备", seq: 1 });
  // 持久化运行态（规格 §18.1）：DB 状态反映真实阶段，供任务控制/崩溃恢复读取。
  await repos.taskRun.markStarted(taskRunId);

  // 1. 机构发现（四层抽取）。真实网络时用行政区真实入口（适配器 regionEntries 或行政区代码）；离线时用 fixture。
  const regionEntryUrl = adapter?.regionEntries?.[regionCode_] ?? regionCode_;
  const discovered = await discoverInstitutions({
    regionCode: regionCode_,
    regionName: regionName_,
    entryUrl: fixtureUrl ? `${fixtureUrl}/golden/institution-list.html` : regionEntryUrl,
    policy,
    ...(adapter ? { adapter } : {}),
    ...(browserPool ? { browserPool } : {}),
  });

  // 2. 机构清单冻结（discovery_source=adapter/auto_discovered）。
  if (discovered.length > 0) {
    await repos.institutionSnapshot.addMany(
      taskRunId,
      discovered.map((c) => ({
        regionCode: regionCode_,
        officialName: c.officialName,
        commonName: null,
        institutionType: c.institutionType,
        officialEntryUrl: c.officialEntryUrl,
        discoverySource: c.discoverySource,
        selectTwoPrimary: true,
      })),
    );
  }
  const institutions = await repos.institutionSnapshot.listByTask(taskRunId);
  const total = institutions.length;
  emit({ type: "task.progress_changed", taskRunId, processedInstitutions: 0, totalInstitutions: total, seq: 2 });

  // 3. 多机构调度（小并发：同时处理 ≤ concurrency 个，每个串行走纵向链路）。
  let processed = 0;
  const runner = async (institutionId: string): Promise<void> => {
    checkAbort();
    await processSingleInstitution({
      taskRunId,
      institutionId,
      repos,
      evidenceStore,
      policy,
      ...(fixtureUrl ? { fixtureUrl } : {}),
      ...(regionCode ? { regionCode } : {}),
      ...(adapter ? { adapter } : {}),
      ...(browserPool ? { browserPool } : {}),
      ...(politeness ? { politeness } : {}),
      ...(httpCache ? { httpCache } : {}),
      ...(searchProvider ? { searchProvider } : {}),
      emit,
      evidenceRoot,
      ...(signal ? { signal } : {}),
    });
    processed += 1;
    emit({ type: "task.progress_changed", taskRunId, processedInstitutions: processed, totalInstitutions: total, seq: 3 + processed });
  };

  const queue = [...institutions];
  const workers: Promise<void>[] = [];
  for (let i = 0; i < Math.min(concurrency, queue.length); i++) {
    workers.push(runWorker(queue, runner));
  }
  await Promise.all(workers);

  // 4. 任务完成（多行政区驱动由外层统一 complete）。
  if (completeTask) {
    await repos.taskRun.complete(taskRunId, "COMPLETED");
    emit({ type: "task.completed", taskRunId, statusZh: "已完成", seq: 100 + total });
  }
}

/** 并发消费队列的工作线程。 */
async function runWorker(
  queue: { id: string }[],
  runner: (id: string) => Promise<void>,
): Promise<void> {
  for (;;) {
    const item = queue.shift();
    if (!item) break;
    await runner(item.id);
  }
}

/** 单机构纵向链路（从 replay-driver 抽取的共享函数）。 */
async function processSingleInstitution(input: {
  taskRunId: string;
  institutionId: string;
  repos: Repositories;
  evidenceStore: EvidenceStore;
  policy: SafeEgressPolicy;
  fixtureUrl?: string;
  emit: (e: SseEvent) => void;
  evidenceRoot: string;
  /** 行政区覆盖（多行政区驱动为每个行政区指定，否则用任务范围第一行）。 */
  regionCode?: string;
  /** 协作式取消信号（暂停/取消时在检查点中止，冻结 §5.3）。 */
  signal?: AbortSignal;
  /** 声明式适配器（浏览器升级/领导列表/详情渲染用，规格 §12.3）。 */
  adapter?: SiteAdapter;
  /** 进程内浏览器池（memberDetail.render=playwright 时升级渲染，规格 §10.2）。 */
  browserPool?: BrowserPool;
  /** 礼貌并发闸（P1）。 */
  politeness?: PolitenessGate;
  /** HTTP 内存缓存（P1；Reviewer 复验绕过，§5.3）。 */
  httpCache?: HttpCache;
  /** 搜索提供器（P2；Recovery 搜索候选）。 */
  searchProvider?: SearchProvider;
}): Promise<void> {
  const { taskRunId, institutionId, repos, evidenceStore, policy, fixtureUrl, adapter, browserPool, emit, evidenceRoot, regionCode, signal, politeness, httpCache, searchProvider } = input;
  // 协作式取消：优先显式传入的信号；否则回退到进程内注册表（供 API 暂停/取消按任务中止）。
  const effectiveSignal = signal ?? getTaskSignal(taskRunId);
  const checkAbort = (): void => {
    effectiveSignal?.throwIfAborted();
  };
  const institution = await repos.institutionSnapshot.listByTask(taskRunId);
  // 按行政区过滤（多行政区复用）：只处理该行政区的机构；不匹配则跳过（非抛错）。
  const inst = institution.find((i) => i.id === institutionId && (!regionCode || i.region_code === regionCode));
  if (!inst) return;
  checkAbort();

  // 入口抓取（fixture 模式用金标机构列表页；真实模式用机构入口 URL）。
  const entryUrl = inst.official_entry_url ?? (fixtureUrl ? `${fixtureUrl}/golden/institution-list.html` : "/");
  if (!entryUrl || entryUrl === "/") {
    await repos.institutionSnapshot.markTerminal(inst.id, "BLOCKED", "官网访问受限");
    return;
  }
  let entryFacts;
  let entryRes;
  try {
    entryRes = await httpFetch(entryUrl, policy, fetchCtx(politeness, httpCache, repos));
    entryFacts = await extractPageFacts(entryRes.body);
  } catch {
    // 入口失败 → 机构终态（BLOCKED + 中文原因），不阻塞其他机构。
    await repos.institutionSnapshot.markTerminal(inst.id, "BLOCKED", "官网访问受限");
    emit({ type: "result.terminal_blank", taskRunId, institutionSnapshotId: inst.id, slot: "PRIMARY_1", terminalReasonZh: "官网访问受限", seq: 5 });
    return;
  }
  checkAbort();

  // 领导集合页（R-23/R-27：按机构映射解析；无映射机构如实标记「无领导信息」）。
  // 1) 适配器 leadershipByInstitution[机构名]；2) 声明机构 leadershipUrl；3) 适配器 leadershipList（站点级，仅自动发现模式）；
  // 4) fixture 集合页；5) 回退机构入口本身（保守）。
  const mappedLeadershipUrl = adapter?.leadershipByInstitution?.[inst.official_name]
    ?? adapter?.declaredInstitutions?.find((d) => d.officialName === inst.official_name)?.leadershipUrl;
  // 声明式模式（有 declaredInstitutions）：机构须有显式领导映射，否则该机构无领导信息（如实终态）。
  // 自动发现模式（无 declaredInstitutions）：无映射时回退站点级 leadershipList。
  const hasDeclared = adapter?.declaredInstitutions && adapter.declaredInstitutions.length > 0;
  if (adapter && !mappedLeadershipUrl && (hasDeclared || !adapter.leadershipList)) {
    // 该机构无领导集合页映射（声明式无映射，或自动发现无站点级领导列表）→ 该机构无领导信息。
    for (const slot of ["PRIMARY_1", "PRIMARY_2"] as const) {
      await repos.resultRow.upsertCurrentResult({
        taskRunId,
        institutionSnapshotId: inst.id,
        slot,
        regionCode: inst.region_code,
        institutionName: inst.official_name,
        positionDisplay: `${inst.official_name} ${slot === "PRIMARY_1" ? "主要负责人" : "常务副职"}`,
        personName: null,
        currentStatusZh: "暂未确认",
        positionUrl: null,
        pageTypeZh: null,
        resultZh: "该机构无领导信息",
        collectedAt: new Date().toISOString(),
      });
    }
    emit({ type: "institution.completed", taskRunId, institutionSnapshotId: inst.id, statusZh: "已完成", seq: 8 });
    return;
  }
  const collectionUrl =
    mappedLeadershipUrl ??
    adapter?.leadershipList?.url ??
    (fixtureUrl ? `${fixtureUrl}/golden/collection.html` : entryUrl);

  let collectionFacts;
  let collectionFetchUrl = entryRes.fetchUrl;
  try {
    if (collectionUrl === entryUrl) {
      collectionFacts = entryFacts;
    } else {
      const collRes = await httpFetch(collectionUrl, policy, fetchCtx(politeness, httpCache, repos));
      collectionFacts = await extractPageFacts(collRes.body);
      collectionFetchUrl = collRes.fetchUrl;
    }
  } catch {
    // 集合页失败 → 回退机构入口事实（保守）。
    collectionFacts = entryFacts;
  }
  checkAbort();

  // 事实抽取 + 完整领导结构 + 两名主要自然人。
  const structure = assembleLeadership(inst.id, [collectionFacts], new Map());
  const [slot1, slot2] = selectTwoPrimary(inst.institution_type, structure);
  await repos.slotDecision.upsertSlot({ taskRunId, institutionSnapshotId: inst.id, slot: slot1.slot, personName: slot1.personName, status: slot1.status });
  await repos.slotDecision.upsertSlot({ taskRunId, institutionSnapshotId: inst.id, slot: slot2.slot, personName: slot2.personName, status: slot2.status });

  // 每槽位：抓详情页（HTTP 优先，memberDetail.render=playwright 且 HTTP 不足时浏览器升级）
  // → 硬门槛 → Reviewer → result_row（非空 URL 仅 Reviewer MATCH + 硬门槛过）。
  const slots = [slot1, slot2];
  for (const slot of slots) {
    checkAbort();
    if (slot.personName == null) {
      // 空缺/未确认：写空 URL + 中文终态原因。
      const reasonZh = slot.status === "VACANT" ? "岗位空缺" : "当前人员未确认";
      await repos.resultRow.upsertCurrentResult({
        taskRunId,
        institutionSnapshotId: inst.id,
        slot: slot.slot,
        regionCode: inst.region_code,
        institutionName: inst.official_name,
        positionDisplay: `${inst.official_name} ${slot.slot === "PRIMARY_1" ? "主要负责人" : "常务副职"}`,
        personName: slot.personName,
        currentStatusZh: slot.status === "VACANT" ? "空缺" : "暂未确认",
        positionUrl: null,
        pageTypeZh: null,
        resultZh: reasonZh,
        collectedAt: new Date().toISOString(),
      });
      emit({ type: "result.terminal_blank", taskRunId, institutionSnapshotId: inst.id, slot: slot.slot, terminalReasonZh: reasonZh, seq: 5 });
      continue;
    }

    // 详情页 URL：集合页该人员链接（相对路径拼接）。
    const member = collectionFacts.leadershipMembers.find((m) => m.name === slot.personName);
    const detailUrl = member?.href ? new URL(member.href, collectionFacts.documentHash ? entryUrl : entryRes.fetchUrl).toString() : null;
    const resolvedDetailUrl = detailUrl ?? null;
    if (!resolvedDetailUrl) {
      await repos.resultRow.upsertCurrentResult({
        taskRunId,
        institutionSnapshotId: inst.id,
        slot: slot.slot,
        regionCode: inst.region_code,
        institutionName: inst.official_name,
        positionDisplay: `${inst.official_name} ${slot.personName}`,
        personName: slot.personName,
        currentStatusZh: "暂未确认",
        positionUrl: null,
        pageTypeZh: null,
        resultZh: "完整搜索后无合格URL",
        collectedAt: new Date().toISOString(),
      });
      emit({ type: "result.terminal_blank", taskRunId, institutionSnapshotId: inst.id, slot: slot.slot, terminalReasonZh: "完整搜索后无合格URL", seq: 5 });
      continue;
    }

    // 抓详情页：HTTP 优先；memberDetail.render=playwright 且 HTTP facts 不足 → 浏览器升级。
    let detailFacts;
    let detailPageType;
    let detailForbidden = false;
    const needRender = adapter?.memberDetail?.render === "playwright";
    try {
      const httpRes = await httpFetch(resolvedDetailUrl, policy, fetchCtx(politeness, httpCache, repos));
      const httpFacts = await extractPageFacts(httpRes.body);
      const httpUsable = httpFacts.bodyText.trim().length > 0 && !needRender;
      if (httpUsable || !needRender) {
        detailFacts = httpFacts;
        detailPageType = classifyPage(httpFacts.title ?? "", httpFacts.bodyText, httpFacts);
        detailForbidden = detailPageType.forbidden;
      } else if (browserPool) {
        // HTTP 不足 + 需渲染：浏览器升级（JS 动态简历，R-09）。
        const rendered = await browserPool.render(resolvedDetailUrl, adapter?.memberDetail?.bioSelector ? { waitSelector: adapter.memberDetail.bioSelector, ...(politeness ? { politeness } : {}) } : { ...(politeness ? { politeness } : {}) });
        detailFacts = await extractPageFacts(rendered.html);
        detailPageType = classifyPage(rendered.title ?? "", detailFacts.bodyText, detailFacts);
        detailForbidden = detailPageType.forbidden;
      } else {
        // 需渲染但无浏览器池：退回 HTTP facts（可能为空 → 硬门槛失败 → 空 URL）。
        detailFacts = httpFacts;
        detailPageType = classifyPage(httpFacts.title ?? "", httpFacts.bodyText, httpFacts);
        detailForbidden = detailPageType.forbidden;
      }
    } catch {
      await repos.resultRow.upsertCurrentResult({
        taskRunId,
        institutionSnapshotId: inst.id,
        slot: slot.slot,
        regionCode: inst.region_code,
        institutionName: inst.official_name,
        positionDisplay: `${inst.official_name} ${slot.personName}`,
        personName: slot.personName,
        currentStatusZh: "暂未确认",
        positionUrl: null,
        pageTypeZh: null,
        resultZh: "官网访问受限",
        collectedAt: new Date().toISOString(),
      });
      emit({ type: "result.terminal_blank", taskRunId, institutionSnapshotId: inst.id, slot: slot.slot, terminalReasonZh: "官网访问受限", seq: 5 });
      continue;
    }
    checkAbort();

    // Reviewer 独立复抓（六方面一致后再检查硬门槛，规格 §15.3）。
    let reviewerOk = false;
    if (!detailForbidden && detailPageType.pageType != null) {
      const review = await runReviewer(
        {
          taskRunId,
          institutionSnapshotId: inst.id,
          personName: slot.personName,
          institutionName: inst.official_name,
          officialRole: member?.roles[0] ?? "",
          urlToReview: resolvedDetailUrl,
          upstreamUrls: [collectionFetchUrl],
          policy,
          ...(browserPool ? { browserPool } : {}),
          ...(adapter?.memberDetail?.bioSelector ? { waitSelector: adapter.memberDetail.bioSelector } : {}),
        },
        { fetchAttempts: repos.fetchAttempt, reviews: repos.review },
      );
      reviewerOk = review.decision === "MATCH";
      emit({ type: "result.reviewed", taskRunId, institutionSnapshotId: inst.id, slot: slot.slot, reviewed: reviewerOk, seq: 6 });
    }

    // 9 项硬门槛。
    const gates = checkHardGates({
      url: resolvedDetailUrl,
      pageType: detailPageType.pageType ?? "CURRENT_LEADER_COLLECTION",
      forbidden: detailForbidden,
      personName: slot.personName,
      institutionName: inst.official_name,
      officialRole: member?.roles[0] ?? "",
      currentness: evaluateCurrentness(slot.personName, {
        collectionMemberHrefs: collectionFacts.links.map((l) => l.href),
        detailHref: resolvedDetailUrl,
        factsList: [collectionFacts, detailFacts],
      }),
      priorityEntryChecked: true,
      reviewerConsistent: reviewerOk,
      officialDomains: [new URL(entryRes.fetchUrl).hostname],
      forbiddenSignals: [],
    });
    await repos.urlCandidate.addCandidate({
      taskRunId,
      institutionSnapshotId: inst.id,
      url: resolvedDetailUrl,
      discoveryScore: 0,
      hardGate: { passed: gates.passed, failures: gates.failures },
    });

    // 写 result_row：非空 URL 仅当 Reviewer MATCH 且硬门槛通过。
    let finalUrl = reviewerOk && gates.passed ? resolvedDetailUrl : null;
    // P2：候选失败（finalUrl 为空）且有人选 → 触发 Recovery 搜索候选（§14.3），命中则 Reviewer 复核。
    if (!finalUrl && slot.personName) {
      const rec = await runRecovery({
        taskRunId,
        institutionSnapshotId: inst.id,
        personName: slot.personName,
        institutionName: inst.official_name,
        repos,
        policy,
        ...(searchProvider ? { searchProvider } : {}),
        emit,
      });
      if (rec.candidateUrl) {
        // Recovery 候选须走 Reviewer 复核（§15），通过才采纳。
        try {
          const recRes = await httpFetch(rec.candidateUrl, policy, fetchCtx(politeness, httpCache, repos));
          const recFacts = await extractPageFacts(recRes.body);
          const recClass = classifyPage(recFacts.title ?? "", recFacts.bodyText, recFacts);
          if (!recClass.forbidden && recClass.pageType != null) {
            const review = await runReviewer(
              {
                taskRunId,
                institutionSnapshotId: inst.id,
                personName: slot.personName,
                institutionName: inst.official_name,
                officialRole: member?.roles[0] ?? "",
                urlToReview: rec.candidateUrl,
                upstreamUrls: [entryRes.fetchUrl],
                policy,
                ...(browserPool ? { browserPool } : {}),
              },
              { fetchAttempts: repos.fetchAttempt, reviews: repos.review },
            );
            if (review.decision === "MATCH") {
              finalUrl = rec.candidateUrl;
            }
          }
        } catch {
          // Recovery 候选抓取失败 → 保持空 URL。
        }
      }
    }
    const resultZh = finalUrl ? "已找到并复核" : reviewerOk && !gates.passed ? "页面结构无法确认" : "完整搜索后无合格URL";
    const row = await repos.resultRow.upsertCurrentResult({
      taskRunId,
      institutionSnapshotId: inst.id,
      slot: slot.slot,
      regionCode: inst.region_code,
      institutionName: inst.official_name,
      positionDisplay: `${inst.official_name} ${member?.roles[0] ?? ""}`.trim(),
      personName: slot.personName,
      currentStatusZh: "正式在任",
      positionUrl: finalUrl,
      pageTypeZh: finalUrl && detailPageType.pageType ? mapPageTypeZh(detailPageType.pageType) : null,
      resultZh,
      collectedAt: new Date().toISOString(),
    });
    emit({ type: "result.upserted", taskRunId, result: mapResultRowToView(row), seq: 7 });
  }

  // 机构完成。
  emit({ type: "institution.completed", taskRunId, institutionSnapshotId: inst.id, statusZh: "已完成", seq: 8 });
}

/** 页面类型 → 中文（规格 §21.2）。 */
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

/** 构造 httpFetch 的 FetchContext（P1：politeness + 缓存 + 画像更新回调）。 */
function fetchCtx(
  politeness: PolitenessGate | undefined,
  httpCache: HttpCache | undefined,
  repos: Repositories,
): import("@stellaris/crawler/http-fetch.js").FetchContext | undefined {
  if (!politeness && !httpCache) return undefined;
  return {
    ...(politeness ? { politeness } : {}),
    ...(httpCache ? { cache: httpCache } : {}),
    onFetch: (info) => {
      // 画像更新（P1，规格 §10.3）：成功/失败、时长、429 退避。
      void repos.siteProfile.recordFetch(info.host, {
        ok: info.ok,
        durationMs: info.durationMs,
        fetchMode: "HTTP",
        ...(info.retryAfterMs !== undefined ? { retryAfterMs: info.retryAfterMs } : {}),
      });
    },
  };
}
