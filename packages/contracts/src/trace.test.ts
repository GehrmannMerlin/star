import { describe, it, expect } from "vitest";
import { newTraceId } from "./trace.js";

describe("P6-T1 Trace 基线", () => {
  it("newTraceId 生成带前缀的唯一 id", () => {
    const a = newTraceId();
    const b = newTraceId();
    expect(a).toMatch(/^tr_/);
    expect(a).not.toBe(b);
  });

  it("批量生成 id 不重复", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 1000; i++) {
      const id = newTraceId();
      expect(seen.has(id)).toBe(false);
      seen.add(id);
    }
  });
});
