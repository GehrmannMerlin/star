import type { Kysely } from "kysely";
import type { Database } from "../schema.js";
import type { SearchResultCacheRow } from "../types.js";

/**
 * search_result_cache 仓储（规格 §22 搜索提供器）。
 * 搜索结果缓存：query+provider 唯一；结果只作 URL 发现线索，不成为最终 URL/当前性证据。
 */

export class SearchCacheRepository {
  constructor(private readonly db: Kysely<Database>) {}

  /** 按 query+provider upsert 搜索缓存。 */
  async upsert(input: {
    query: string;
    provider: string;
    paginationToken?: string | null;
    results: unknown | null;
    cachedAt: string;
  }): Promise<SearchResultCacheRow> {
    // jsonb 列：pg 驱动需字符串形式，读取时自动解析为对象。
    const resultsJson = input.results === null ? null : JSON.stringify(input.results);
    const values = {
      query: input.query,
      provider: input.provider,
      pagination_token: input.paginationToken ?? null,
      results: resultsJson,
      cached_at: input.cachedAt,
    };
    return this.db
      .insertInto("search_result_cache")
      .values(values)
      .onConflict((oc) =>
        oc.columns(["query", "provider"]).doUpdateSet({
          ...(input.paginationToken !== undefined ? { pagination_token: input.paginationToken } : {}),
          results: resultsJson,
          cached_at: input.cachedAt,
        }),
      )
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  /** 按 query+provider 查缓存。 */
  async findByQuery(query: string, provider: string): Promise<SearchResultCacheRow | undefined> {
    return this.db
      .selectFrom("search_result_cache")
      .selectAll()
      .where("query", "=", query)
      .where("provider", "=", provider)
      .executeTakeFirst();
  }
}
