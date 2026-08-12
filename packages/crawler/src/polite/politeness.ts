/**
 * 礼貌并发闸（规格 §11 并发/礼貌性/缓存）。
 * - 全局并发上限 + 站点级并发上限（信号量）；
 * - 429/503 按服务端 Retry-After 退避（§14.1）；
 * - 连续错误自适应降低站点并发。
 * 单进程实现；不引入跨进程共享。
 */

export interface PolitenessOptions {
  globalMaxConcurrency?: number; // 默认 8
  siteMaxConcurrency?: number;   // 默认 2（保守礼貌）
  retryAfterCapMs?: number;      // 默认 30_000
}

interface SiteState {
  concurrency: number;
  effectiveMax: number;
  retryUntil: number;
  consecutiveErrors: number;
}

export class PolitenessGate {
  private readonly globalMax: number;
  private readonly siteDefaultMax: number;
  private readonly retryAfterCap: number;
  private globalCount = 0;
  private readonly sites = new Map<string, SiteState>();
  private readonly waiters: Array<() => void> = [];

  constructor(opts: PolitenessOptions = {}) {
    this.globalMax = opts.globalMaxConcurrency ?? 8;
    this.siteDefaultMax = opts.siteMaxConcurrency ?? 2;
    this.retryAfterCap = opts.retryAfterCapMs ?? 30_000;
  }

  /** 站点当前建议并发（画像查询用）。 */
  getSiteConcurrency(host: string): number {
    return this.sites.get(host)?.effectiveMax ?? this.siteDefaultMax;
  }

  /**
   * 获取并发槽（全局 + 站点）。返回释放函数。
   * 站点处于退避期或并发满时排队。
   */
  async acquire(host: string): Promise<() => void> {
    for (;;) {
      const state = this.ensureState(host);
      const now = Date.now();
      if (now < state.retryUntil) {
        // 退避中：等待剩余时间后重试。
        await sleep(state.retryUntil - now);
        continue;
      }
      if (state.concurrency < state.effectiveMax && this.globalCount < this.globalMax) {
        state.concurrency += 1;
        this.globalCount += 1;
        let released = false;
        return () => {
          if (released) return;
          released = true;
          state.concurrency -= 1;
          this.globalCount -= 1;
          this.wake();
        };
      }
      await waitForWake(this.waiters);
    }
  }

  /**
   * 记录站点请求结果。
   * - 429/503：按 Retry-After 退避（有则用，无则默认），降低站点并发；
   * - 其他错误：累计连续错误，连续 ≥3 次降并发；
   * - 成功：重置连续错误，逐步恢复并发。
   */
  recordError(host: string, status: number, retryAfterMs?: number): void {
    const state = this.ensureState(host);
    if (status === 429 || status === 503) {
      state.retryUntil = Date.now() + Math.min(retryAfterMs ?? 5_000, this.retryAfterCap);
      state.effectiveMax = Math.max(1, state.effectiveMax - 1);
      state.consecutiveErrors = 0; // 429 退避本身已足够
      return;
    }
    if (status >= 500 || status === 0) {
      state.consecutiveErrors += 1;
      if (state.consecutiveErrors >= 3) {
        state.effectiveMax = Math.max(1, state.effectiveMax - 1);
        state.consecutiveErrors = 0;
      }
      return;
    }
    // 成功/4xx：重置连续错误，恢复并发。
    state.consecutiveErrors = 0;
    if (state.effectiveMax < this.siteDefaultMax) {
      state.effectiveMax = this.siteDefaultMax;
    }
  }

  private ensureState(host: string): SiteState {
    let s = this.sites.get(host);
    if (!s) {
      s = { concurrency: 0, effectiveMax: this.siteDefaultMax, retryUntil: 0, consecutiveErrors: 0 };
      this.sites.set(host, s);
    }
    return s;
  }

  private wake(): void {
    const w = this.waiters.shift();
    w?.();
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function waitForWake(waiters: Array<() => void>): Promise<void> {
  return new Promise((resolve) => {
    waiters.push(resolve);
  });
}
