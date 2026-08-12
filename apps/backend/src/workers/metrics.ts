/**
 * 进程内指标计数器（规格 §25.2 指标）。
 * 轻量实现：内存计数，重启清零；`GET /api/metrics` 即时查看（P6-D2，无新依赖）。
 */

export interface MetricsSnapshot {
  /** HTTP 请求总数。 */
  httpRequests: number;
  httpSuccess: number;
  http429: number;
  http403: number;
  http5xx: number;
  /** 浏览器升级渲染次数。 */
  browserUpgrades: number;
  /** Reviewer 分歧（CONFLICT）次数。 */
  reviewerDivergence: number;
  /** Recovery 成功次数。 */
  recoverySuccess: number;
  /** 合格（非空 URL）结果数。 */
  qualifiedUrls: number;
  /** 空 URL 结果数。 */
  emptyUrls: number;
  /** 禁止页面拦截数。 */
  blockedPages: number;
  /** 首个已复核结果耗时（ms）。 */
  firstResultMs: number | null;
  /** 已完成批次（任务）数。 */
  batchCompleted: number;
}

const ZERO: MetricsSnapshot = {
  httpRequests: 0,
  httpSuccess: 0,
  http429: 0,
  http403: 0,
  http5xx: 0,
  browserUpgrades: 0,
  reviewerDivergence: 0,
  recoverySuccess: 0,
  qualifiedUrls: 0,
  emptyUrls: 0,
  blockedPages: 0,
  firstResultMs: null,
  batchCompleted: 0,
};

export type MetricKey = Exclude<keyof MetricsSnapshot, "firstResultMs">;

/** 进程内指标计数器。 */
export class Metrics {
  private readonly counts: Record<MetricKey, number> = { ...ZERO };
  private firstResult: number | null = null;
  private batchCount = 0;

  increment(key: MetricKey): void {
    this.counts[key] += 1;
  }

  recordFirstResult(ms: number): void {
    if (this.firstResult === null) {
      this.firstResult = ms;
    }
  }

  recordBatchCompleted(): void {
    this.batchCount += 1;
  }

  snapshot(): MetricsSnapshot {
    return { ...this.counts, firstResultMs: this.firstResult, batchCompleted: this.batchCount };
  }
}

/** 全局指标实例（进程内单例）。 */
export const metrics = new Metrics();
