/**
 * 搜索提供器统一接口（规格 §22）。
 * 结果只作 URL 发现线索；搜索页/标题/摘要不能成为最终 URL 或当前性证据（§22）。
 */

export interface SearchResult {
  title: string;
  summary: string | null;
  url: string;
  rank: number;
  timestamp?: string;
}

export interface SearchResponse {
  results: SearchResult[];
  nextToken?: string;
  providerError?: string;
  durationMs: number;
}

export interface SearchProvider {
  /**
   * 执行搜索。
   * @param query 查询词
   * @param opts.domain 域名限制（限定官网域，§14.3 第 5 步）
   * @param opts.pageToken 分页令牌
   */
  search(query: string, opts?: { domain?: string; pageToken?: string }): Promise<SearchResponse>;
}
