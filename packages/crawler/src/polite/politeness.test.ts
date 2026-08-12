import { describe, it, expect } from "vitest";
import { PolitenessGate } from "./politeness.js";

describe("礼貌并发闸", () => {
  it("站点并发超上限时排队，释放后可复用", async () => {
    const gate = new PolitenessGate({ globalMaxConcurrency: 8, siteMaxConcurrency: 2 });
    const release1 = await gate.acquire("a.example");
    const release2 = await gate.acquire("a.example");
    // 第 3 个并发应排队（不立即返回）。
    let acquired3 = false;
    const p3 = gate.acquire("a.example").then((r) => {
      acquired3 = true;
      return r;
    });
    await new Promise((r) => setTimeout(r, 50));
    expect(acquired3).toBe(false); // 站点并发 2 已满，第 3 个排队
    // 释放 1 个槽 → 站点并发 1 < 2，第 3 个被唤醒获得。
    release2();
    const r3 = await p3;
    expect(acquired3).toBe(true);
    // 释放全部后槽位清零。
    release1();
    r3();
    const r4 = await gate.acquire("a.example");
    r4(); // 重新可获取
  });

  it("不同站点并发互不影响", async () => {
    const gate = new PolitenessGate({ globalMaxConcurrency: 8, siteMaxConcurrency: 2 });
    const r1 = await gate.acquire("a.example");
    const r2 = await gate.acquire("a.example");
    const r3 = await gate.acquire("b.example"); // 不同站点，立即获得
    r1(); r2(); r3();
  });

  it("全局并发上限生效", async () => {
    const gate = new PolitenessGate({ globalMaxConcurrency: 2, siteMaxConcurrency: 4 });
    const r1 = await gate.acquire("a.example");
    const r2 = await gate.acquire("b.example");
    let acquired3 = false;
    void gate.acquire("c.example").then((r) => { acquired3 = true; return r; });
    await new Promise((r) => setTimeout(r, 30));
    expect(acquired3).toBe(false); // 全局已满 2
    r1(); r2();
  });

  it("429 后 retryAfter 退避，期间 acquire 等待", async () => {
    const gate = new PolitenessGate({ globalMaxConcurrency: 8, siteMaxConcurrency: 2 });
    gate.recordError("slow.example", 429, 200);
    let acquired = false;
    let firstRelease: (() => void) | undefined;
    void gate.acquire("slow.example").then((r) => { acquired = true; firstRelease = r; });
    await new Promise((r) => setTimeout(r, 30));
    expect(acquired).toBe(false); // 退避中，未获得
    await new Promise((r) => setTimeout(r, 300)); // 退避结束，获得
    expect(acquired).toBe(true);
    firstRelease?.();
    const release = await gate.acquire("slow.example"); // 槽位已释放，可再次获取
    release();
  });
});
