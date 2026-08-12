import type { Kysely } from "kysely";
import type { Database } from "../schema.js";
import type { SiteProfileRow } from "../types.js";
import type { FetchMode } from "@stellaris/contracts";

/**
 * site_profile 仓储（规格 §10.3 站点画像）。
 * 画像记录每主机的推荐抓取方式、DOM 指纹、成功率和最近失败信号；
 * 驱动抓取前查询决定 HTTP/浏览器路由与限速；抓取后更新。
 */

export class SiteProfileRepository {
  constructor(private readonly db: Kysely<Database>) {}

  /** 按主机 upsert 画像（host 唯一；已存在则更新非空字段）。 */
  async upsert(input: {
    host: string;
    fetchMode: FetchMode;
    domFingerprint?: string | null;
    waitCondition?: string | null;
    currentLeaderEntry?: string | null;
    avgDurationMs?: number | null;
    successRate?: number | null;
    lastVerifiedAt?: string | null;
    failureSignals?: Record<string, unknown> | null;
  }): Promise<SiteProfileRow> {
    const values = {
      host: input.host,
      fetch_mode: input.fetchMode,
      dom_fingerprint: input.domFingerprint ?? null,
      wait_condition: input.waitCondition ?? null,
      current_leader_entry: input.currentLeaderEntry ?? null,
      avg_duration_ms: input.avgDurationMs ?? null,
      success_rate: input.successRate ?? null,
      last_verified_at: input.lastVerifiedAt ?? null,
      failure_signals: input.failureSignals ?? null,
    };
    return this.db
      .insertInto("site_profile")
      .values(values)
      .onConflict((oc) =>
        oc.column("host").doUpdateSet({
          ...(input.domFingerprint !== undefined ? { dom_fingerprint: input.domFingerprint } : {}),
          ...(input.waitCondition !== undefined ? { wait_condition: input.waitCondition } : {}),
          ...(input.currentLeaderEntry !== undefined ? { current_leader_entry: input.currentLeaderEntry } : {}),
          ...(input.avgDurationMs !== undefined ? { avg_duration_ms: input.avgDurationMs } : {}),
          ...(input.successRate !== undefined ? { success_rate: input.successRate } : {}),
          ...(input.lastVerifiedAt !== undefined ? { last_verified_at: input.lastVerifiedAt } : {}),
          ...(input.failureSignals !== undefined ? { failure_signals: input.failureSignals } : {}),
          fetch_mode: input.fetchMode,
        }),
      )
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  /** 按主机查画像。 */
  async findByHost(host: string): Promise<SiteProfileRow | undefined> {
    return this.db
      .selectFrom("site_profile")
      .selectAll()
      .where("host", "=", host)
      .executeTakeFirst();
  }

  /**
   * 记录一次抓取结果并更新画像指标。
   * - avg_duration_ms：滚动平均（已有则与新值平均）；
   * - success_rate：滚动平均（成功率）；
   * - last_verified_at：本次时间；
   * - failure_signals：失败时记录状态码 + retry_after（429/5xx）。
   */
  async recordFetch(
    host: string,
    input: { ok: boolean; durationMs: number; fetchMode: FetchMode; retryAfterMs?: number },
  ): Promise<void> {
    const existing = await this.findByHost(host);
    const prevAvg = existing?.avg_duration_ms;
    // numeric 列返回 string，统一转 number。
    const prevRate = existing?.success_rate != null ? Number(existing.success_rate) : null;
    const newAvg = prevAvg != null ? Math.round((prevAvg + input.durationMs) / 2) : input.durationMs;
    const newRate = prevRate != null ? Number(((prevRate + (input.ok ? 1 : 0)) / 2).toFixed(2)) : input.ok ? 1 : 0;
    const failureSignals = !input.ok
      ? {
          status: input.retryAfterMs ? 429 : 500,
          retry_after_ms: input.retryAfterMs ?? null,
          at: new Date().toISOString(),
        }
      : existing?.failure_signals ?? null;
    await this.upsert({
      host,
      fetchMode: input.fetchMode,
      avgDurationMs: newAvg,
      successRate: newRate,
      lastVerifiedAt: new Date().toISOString(),
      ...(input.ok ? { failureSignals: null } : { failureSignals }),
    });
  }
}
