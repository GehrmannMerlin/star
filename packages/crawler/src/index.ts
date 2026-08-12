/**
 * @stellaris/crawler —— 爬虫包。
 * Frontier、HTTP/浏览器抓取、适配器与站点画像在爬虫阶段按规格实现。
 */
export const CRAWLER_PACKAGE_NAME = "@stellaris/crawler" as const;
export { PolitenessGate } from "./polite/politeness.js";
export type { PolitenessOptions } from "./polite/politeness.js";
export { HttpCache } from "./http-cache.js";
export type { HttpCacheOptions } from "./http-cache.js";
export { FixtureSearchProvider } from "./search/fixture-provider.js";
export type { SearchProvider, SearchResult, SearchResponse } from "./search/provider.js";
