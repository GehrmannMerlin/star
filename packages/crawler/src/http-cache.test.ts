import { describe, it, expect } from "vitest";
import { HttpCache } from "./http-cache.js";

describe("HTTP 内存 LRU 缓存", () => {
  it("set/get 命中；TTL 过期失效", async () => {
    const cache = new HttpCache({ maxEntries: 10, ttlMs: 100 });
    cache.set("k1", new Uint8Array([1, 2, 3]));
    expect(cache.get("k1")).toEqual(new Uint8Array([1, 2, 3]));
    await new Promise((r) => setTimeout(r, 150));
    expect(cache.get("k1")).toBeUndefined(); // TTL 过期
  });

  it("maxEntries 淘汰最久未用（LRU）", async () => {
    const cache = new HttpCache({ maxEntries: 2, ttlMs: 60_000 });
    cache.set("a", new Uint8Array([1]));
    cache.set("b", new Uint8Array([2]));
    cache.get("a"); // a 最近使用
    cache.set("c", new Uint8Array([3])); // 淘汰 b（最久未用）
    expect(cache.get("b")).toBeUndefined();
    expect(cache.get("a")).toEqual(new Uint8Array([1]));
    expect(cache.get("c")).toEqual(new Uint8Array([3]));
  });

  it("clear 清空缓存", async () => {
    const cache = new HttpCache({ maxEntries: 10 });
    cache.set("k", new Uint8Array([9]));
    cache.clear();
    expect(cache.get("k")).toBeUndefined();
  });
});
