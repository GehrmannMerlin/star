/**
 * Tool Event 数据最小化投影（STEP 11）。
 *
 * 只从工具输出中提取 Provenance / 审计必需的少量元数据，绝不保留：
 * - 原始 HTML / 渲染 DOM / inspect 观察文本
 * - 检索 snippets / 整段搜索结果
 * - Authorization Header / API Key / cookie 等 secret-like 字段
 *
 * 未来 Persistent Page Snapshot 阶段会单独处理原始内容，不在此处扩大。
 */

export type ToolEventUrlMetadata = {
  requestedUrl?: string;
  finalUrl?: string;
  url?: string;
  statusCode?: number;
  bytes?: number;
};

export type ToolEventSearchMetadata = {
  provider?: string;
  resultCount?: number;
};

export type ToolEventSubmissionMetadata = {
  payloadHash?: string;
  candidateCount?: number;
};

/** 投影后的三个元数据组；按工具类型最多命中一组。 */
export type ToolEventProjection = {
  url: ToolEventUrlMetadata | null;
  search: ToolEventSearchMetadata | null;
  submission: ToolEventSubmissionMetadata | null;
};

const EMPTY_PROJECTION: ToolEventProjection = { url: null, search: null, submission: null };

function asRecord(data: unknown): Record<string, unknown> {
  return (data ?? {}) as Record<string, unknown>;
}

/**
 * 把某工具的成功输出投影为最小元数据。
 * fetch_page / render_page / inspect_page → URL 组；search_web → search 组；
 * submit_investigator_evidence → submission 组；其余工具返回空投影。
 */
export function projectToolEventData(toolName: string, data: unknown): ToolEventProjection {
  const record = asRecord(data);

  if (toolName === "fetch_page" || toolName === "render_page") {
    const url: Record<string, unknown> = {};
    for (const key of ["requestedUrl", "finalUrl", "url"] as const) {
      if (typeof record[key] === "string") url[key] = record[key];
    }
    if (typeof record.statusCode === "number") url.statusCode = record.statusCode;
    if (typeof record.bytes === "number") url.bytes = record.bytes;
    return Object.keys(url).length > 0
      ? { url: url as unknown as ToolEventUrlMetadata, search: null, submission: null }
      : EMPTY_PROJECTION;
  }

  if (toolName === "inspect_page") {
    const url: Record<string, unknown> = {};
    if (typeof record.url === "string") url.url = record.url;
    if (typeof record.statusCode === "number") url.statusCode = record.statusCode;
    return Object.keys(url).length > 0
      ? { url: url as unknown as ToolEventUrlMetadata, search: null, submission: null }
      : EMPTY_PROJECTION;
  }

  if (toolName === "search_web") {
    const results = Array.isArray(record.results) ? record.results.length : 0;
    return {
      url: null,
      search: {
        ...(typeof record.provider === "string" ? { provider: record.provider } : {}),
        resultCount: results,
      },
      submission: null,
    };
  }

  if (toolName === "submit_investigator_evidence") {
    const submission: Record<string, unknown> = {};
    if (typeof record.payloadHash === "string") submission.payloadHash = record.payloadHash;
    if (typeof record.candidateCount === "number") submission.candidateCount = record.candidateCount;
    return Object.keys(submission).length > 0
      ? { url: null, search: null, submission: submission as unknown as ToolEventSubmissionMetadata }
      : EMPTY_PROJECTION;
  }

  return EMPTY_PROJECTION;
}

/**
 * 从投影重构 ToolSuccessResult.data（读取侧）。
 * Candidate Provenance Gate 只消费 requestedUrl/finalUrl/url，这里给出等价视图。
 */
export function toolEventDataFromProjection(projection: ToolEventProjection): Record<string, unknown> {
  if (projection.url) return { ...projection.url };
  if (projection.search) return { ...projection.search };
  if (projection.submission) return { ...projection.submission };
  return {};
}
