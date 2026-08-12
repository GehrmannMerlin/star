import { describe, it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { extractPageFacts } from "./page-facts.js";

describe("page-facts 页面事实抽取", () => {
  it("从金标集合页抽取完整领导结构与姓名链接", async () => {
    const html = await readFile(join(import.meta.dirname, "golden", "collection.html"));
    const facts = await extractPageFacts(new Uint8Array(html));
    expect(facts.title).toContain("领导信息");
    expect(facts.leadershipMembers.map((m) => m.name)).toEqual(["张三", "李四", "王五"]);
    expect(facts.leadershipMembers[0]!.href).toContain("leader-detail-1.html");
    expect(facts.leadershipMembers[0]!.roles).toContain("区长");
    expect(facts.bodyText).toContain("主持区政府全面工作");
  });

  it("从领导人详情页抽取人员与岗位", async () => {
    const html = await readFile(join(import.meta.dirname, "golden", "leader-detail-1.html"));
    const facts = await extractPageFacts(new Uint8Array(html));
    expect(facts.title).toContain("张三");
    expect(facts.bodyText).toContain("区长");
    expect(facts.pageDate).toBe("2026-06-01");
  });

  it("从新闻页抽取并识别链接", async () => {
    const html = await readFile(join(import.meta.dirname, "golden", "forbidden-news.html"));
    const facts = await extractPageFacts(new Uint8Array(html));
    expect(facts.links.length).toBeGreaterThan(0);
    expect(facts.bodyText).toContain("工作动态");
  });
});
