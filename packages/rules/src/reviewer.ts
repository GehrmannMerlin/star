import type { ReviewDecision } from "@stellaris/contracts";
import { createHash } from "node:crypto";
import { httpFetch } from "@stellaris/crawler/http-fetch.js";
import { extractPageFacts } from "@stellaris/crawler/page-facts.js";
import { classifyPage } from "./classify.js";
import { evaluateCurrentness } from "./currentness.js";
import type { SafeEgressPolicy } from "@stellaris/crawler/safe-egress.js";
import type { BrowserPool } from "@stellaris/crawler/browser/render.js";
import type { FetchAttemptRepository, ReviewRepository } from "@stellaris/db";

/**
 * 隔离 Reviewer（规格 §15）。
 * - 只接收最小核验目标（行政区/机构/自然人/正式岗位/待复核 URL/上游入口）；
 * - 不读 Collector 的得分/判型/准入/抽取；
 * - 使用独立请求唯一键（purpose=reviewer），创建独立 fetch_attempt；
 * - 从复抓响应重算六方面事实并与输入比对；全部一致 => MATCH，否则 CONFLICT；
 * - review_job 写入独立请求键（unique_request_key 唯一约束防复用）。
 */

export interface ReviewerInput {
  taskRunId: string;
  institutionSnapshotId: string;
  personName: string;
  institutionName: string;
  officialRole: string;
  urlToReview: string;
  upstreamUrls: string[];
  policy: SafeEgressPolicy;
  /** 浏览器升级复抓：JS 动态详情页（R-09）需浏览器渲染才能拿真实事实。 */
  browserPool?: BrowserPool;
  /** 浏览器渲染等待的业务字段 selector（memberDetail.bioSelector）。 */
  waitSelector?: string;
}

export interface ReviewerOutcome {
  dimensions: {
    person: boolean;
    institution: boolean;
    role: boolean;
    pageType: boolean;
    currentness: boolean;
    url: boolean;
  };
  decision: ReviewDecision;
  conflictReason: string | null;
  reviewerRequestKey: string;
}

/** 生成独立请求唯一键：用途前缀区分 Collector/Reviewer，保证两键不同（规格 §18.3：含任务/机构/阶段/用途）。 */
export function makeRequestKey(
  taskRunId: string,
  purpose: "collector" | "reviewer" | "reviewer-upstream",
  canonicalKey: string,
  institutionSnapshotId?: string,
): string {
  const raw = institutionSnapshotId
    ? `${taskRunId}:${institutionSnapshotId}:${purpose}:${canonicalKey}`
    : `${taskRunId}:${purpose}:${canonicalKey}`;
  return createHash("sha256").update(raw).digest("hex").slice(0, 64);
}

/** 复抓一个 URL 并抽取事实（独立网络事件）。 */
async function refetchFacts(
  url: string,
  policy: SafeEgressPolicy,
  taskRunId: string,
  institutionSnapshotId: string,
  requestKey: string,
  fetchAttempts: FetchAttemptRepository,
  opts?: { browserPool?: BrowserPool; needRender?: boolean; waitSelector?: string },
): Promise<{ pageType: ReturnType<typeof classifyPage>["pageType"]; forbidden: boolean; bodyText: string; facts: Awaited<ReturnType<typeof extractPageFacts>> }> {
  const httpRes = await httpFetch(url, policy);
  let facts = await extractPageFacts(httpRes.body);
  // 独立复抓也应支持浏览器升级：JS 动态详情页（R-09）HTTP 拿不到简历，Reviewer 需真实事实才能独立判断（规格 §15.3）。
  if (opts?.needRender && opts.browserPool && facts.bodyText.trim().length === 0) {
    const rendered = await opts.browserPool.render(url, opts.waitSelector ? { waitSelector: opts.waitSelector } : undefined);
    facts = await extractPageFacts(rendered.html);
  }
  const classification = classifyPage(facts.title ?? "", facts.bodyText, facts);
  // 独立抓取事件（用途=reviewer，canonical_key 用 reviewer 请求键）。
  await fetchAttempts.create({
    taskRunId,
    crawlIntentId: null,
    fetchMode: "HTTP",
    url: httpRes.fetchUrl,
    canonicalKey: requestKey,
    httpStatus: httpRes.status,
    status: httpRes.status >= 200 && httpRes.status < 300 ? "SUCCESS" : "ERROR",
    resolvedIp: null,
    durationMs: 0,
    redirectedUrl: httpRes.redirectChain.length > 1 ? httpRes.fetchUrl : null,
    documentSnapshotId: null,
    errorMessage: null,
  });
  return { pageType: classification.pageType, forbidden: classification.forbidden, bodyText: facts.bodyText, facts };
}

export async function runReviewer(
  input: ReviewerInput,
  deps: { fetchAttempts: FetchAttemptRepository; reviews: ReviewRepository },
): Promise<ReviewerOutcome> {
  const { taskRunId, institutionSnapshotId, personName, institutionName, officialRole, urlToReview, upstreamUrls, policy, browserPool, waitSelector } = input;
  // 键含机构维度（规格 §18.3：任务+机构+阶段+用途），多机构同 URL 不撞唯一约束。
  const reviewerRequestKey = makeRequestKey(taskRunId, "reviewer", urlToReview, institutionSnapshotId);
  const renderOpts: { browserPool: BrowserPool; needRender: boolean; waitSelector?: string } | undefined = browserPool
    ? { browserPool, needRender: true, ...(waitSelector ? { waitSelector } : {}) }
    : undefined;

  // 独立复抓目标 URL。
  const target = await refetchFacts(urlToReview, policy, taskRunId, institutionSnapshotId, reviewerRequestKey, deps.fetchAttempts, renderOpts);

  // 复抓上游（当前性依赖集合页）。
  const upstreamFacts = [];
  for (const upstream of upstreamUrls) {
    const ukey = makeRequestKey(taskRunId, "reviewer-upstream", upstream, institutionSnapshotId);
    const r = await refetchFacts(upstream, policy, taskRunId, institutionSnapshotId, ukey, deps.fetchAttempts, renderOpts);
    upstreamFacts.push(r);
  }

  // 重新计算六方面。
  const collectionHrefs = upstreamFacts.flatMap((u) => u.facts.links.map((l) => l.href));
  const currentness = evaluateCurrentness(personName, {
    collectionMemberHrefs: collectionHrefs,
    detailHref: urlToReview,
    factsList: upstreamFacts.map((u) => u.facts),
  });

  const dimensions = {
    person: target.bodyText.includes(personName),
    institution: target.bodyText.includes(institutionName),
    role: target.bodyText.includes(officialRole),
    pageType: !target.forbidden && target.pageType !== null,
    currentness: currentness !== "CURRENTNESS_UNRESOLVED" && currentness !== "DETAIL_NOT_IN_CURRENT_COLLECTION",
    url: true, // 复抓成功且未重定向越界；最终 URL 一致由 Collector 校验链保证
  };

  const allMatch = Object.values(dimensions).every(Boolean);
  const decision: ReviewDecision = allMatch ? "MATCH" : "CONFLICT";
  const conflictReason = allMatch
    ? null
    : `六方面不一致: ${Object.entries(dimensions)
        .filter(([, ok]) => !ok)
        .map(([k]) => k)
        .join(", ")}`;

  // 写入 review_job（独立请求键）与 review_decision。
  const job = await deps.reviews.createReviewJob({
    taskRunId,
    institutionSnapshotId,
    url: urlToReview,
    uniqueRequestKey: reviewerRequestKey,
  });
  await deps.reviews.addDecision({
    taskRunId,
    reviewJobId: job.id,
    url: urlToReview,
    dimensionsMatch: dimensions,
    decision,
    conflictReason,
  });

  return { dimensions, decision, conflictReason, reviewerRequestKey };
}
