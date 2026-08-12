/**
 * HTTP 内存 LRU 缓存（规格 §11.3 缓存）。
 * - 按 canonicalKey 缓存响应正文；
 * - LRU 淘汰 + TTL 过期；
 * - Reviewer 复验调用方传 bypass 绕过（§5.3：正式网络复验不被缓存绕过）。
 * 单进程实现；不引入跨进程共享缓存。
 */

export interface HttpCacheOptions {
  maxEntries?: number; // 默认 500
  ttlMs?: number;      // 默认 300_000（5 分钟）
}

interface CacheEntry {
  body: Uint8Array;
  expiresAt: number;
  lastUsed: number;
}

export class HttpCache {
  private readonly maxEntries: number;
  private readonly ttlMs: number;
  private readonly map = new Map<string, CacheEntry>();

  constructor(opts: HttpCacheOptions = {}) {
    this.maxEntries = opts.maxEntries ?? 500;
    this.ttlMs = opts.ttlMs ?? 300_000;
  }

  /** 取缓存；命中更新 lastUsed（LRU）。 */
  get(key: string): Uint8Array | undefined {
    const entry = this.map.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.map.delete(key);
      return undefined;
    }
    entry.lastUsed = Date.now();
    // 移到末尾（LRU：末尾为最近使用）。
    this.map.delete(key);
    this.map.set(key, entry);
    return entry.body;
  }

  /** 写入缓存。 */
  set(key: string, body: Uint8Array): void {
    this.map.delete(key);
    this.map.set(key, { body, expiresAt: Date.now() + this.ttlMs, lastUsed: Date.now() });
    // LRU 淘汰：超出上限移除最久未用（头部）。
    while (this.map.size > this.maxEntries) {
      const oldest = this.map.keys().next().value;
      if (oldest === undefined) break;
      this.map.delete(oldest);
    }
  }

  /** 清空缓存。 */
  clear(): void {
    this.map.clear();
  }

  /** 当前条目数。 */
  get size(): number {
    return this.map.size;
  }
}
