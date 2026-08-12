import { describe, it, expect } from "vitest";
import { FixtureSearchProvider } from "./fixture-provider.js";

describe("FixtureSearchProvider", () => {
  it("返回金标结果，按 rank 排序", async () => {
    const provider = new FixtureSearchProvider();
    const res = await provider.search("安徽省 王清宪 省长");
    expect(res.results.length).toBeGreaterThan(0);
    // rank 升序。
    const ranks = res.results.map((r) => r.rank);
    expect([...ranks].sort((a, b) => a - b)).toEqual(ranks);
    // 含官方域结果。
    expect(res.results.some((r) => r.url.includes("ah.gov.cn"))).toBe(true);
  });

  it("domain 过滤只返回限定域结果", async () => {
    const provider = new FixtureSearchProvider();
    const res = await provider.search("王清宪", { domain: "ah.gov.cn" });
    expect(res.results.length).toBeGreaterThan(0);
    for (const r of res.results) {
      expect(new URL(r.url).hostname).toMatch(/ah\.gov\.cn$/);
    }
  });

  it("未知 query 返回空结果（不抛错）", async () => {
    const provider = new FixtureSearchProvider();
    const res = await provider.search("不存在的查询词xyzabc");
    expect(res.results).toEqual([]);
  });
});
