/**
 * Provider-neutral web search contracts.
 *
 * A SearchResult is a navigation candidate only: its URL still needs to be
 * fetched and snapshotted before it can become formal Evidence. Nothing in
 * this module knows a concrete provider.
 */

export type SearchFreshness = "noLimit" | "oneDay" | "oneWeek" | "oneMonth" | "oneYear";

export const SEARCH_FRESHNESS_VALUES = [
  "noLimit",
  "oneDay",
  "oneWeek",
  "oneMonth",
  "oneYear",
] as const satisfies readonly SearchFreshness[];

export type SearchRequest = {
  query: string;
  limit?: number;
  freshness?: SearchFreshness;
};

/**
 * A normalized web search result. It only identifies a candidate URL for a
 * later fetch/snapshot step; it is NOT formal Evidence.
 */
export type SearchResult = {
  title: string;
  url: string;
  snippet: string;
  domain: string;
  rank: number;
  siteName?: string;
  publishedAt?: string;
};

/** A provider that can search the public web. */
export interface SearchProvider {
  readonly name: string;
  /** True when the provider has enough runtime config to perform a search. */
  readonly isConfigured: boolean;
  search(request: SearchRequest, signal: AbortSignal): Promise<SearchResult[]>;
}
