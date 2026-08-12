import { describe, it, expect } from "vitest";
import { Metrics } from "./metrics.js";

describe("P6-T2 指标计数器", () => {
  it("increment 累加计数", () => {
    const m = new Metrics();
    m.increment("httpRequests");
    m.increment("httpRequests");
    m.increment("http429");
    const s = m.snapshot();
    expect(s.httpRequests).toBe(2);
    expect(s.http429).toBe(1);
  });

  it("recordFirstResult 只记录首个", () => {
    const m = new Metrics();
    expect(m.snapshot().firstResultMs).toBeNull();
    m.recordFirstResult(120);
    m.recordFirstResult(80);
    expect(m.snapshot().firstResultMs).toBe(120);
  });

  it("recordBatchCompleted 累加批次", () => {
    const m = new Metrics();
    m.recordBatchCompleted();
    m.recordBatchCompleted();
    expect(m.snapshot().batchCompleted).toBe(2);
  });

  it("新实例从零开始", () => {
    const m = new Metrics();
    const s = m.snapshot();
    expect(s.httpRequests).toBe(0);
    expect(s.qualifiedUrls).toBe(0);
    expect(s.emptyUrls).toBe(0);
    expect(s.batchCompleted).toBe(0);
  });
});
