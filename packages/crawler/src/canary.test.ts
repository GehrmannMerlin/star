import { describe, it, expect } from "vitest";
import { httpFetch } from "./http-fetch.js";
import { extractPageFacts } from "./page-facts.js";
import { createSafeEgressPolicy } from "./safe-egress.js";
import { loadRobots } from "./robots.js";

const CANARY_URL = "https://www.ah.gov.cn/";
const prod = createSafeEgressPolicy({ mode: "production", maxTimeoutMs: 20_000 });

describe("Canary: 安徽省人民政府官网（只读）", () => {
  it("robots 检查：站点无 robots.txt（404）→ 默认允许，仍守礼貌", async () => {
    const robots = await loadRobots(CANARY_URL, prod);
    // 无 robots 文件：loadRobots 返回 null（降级），调用方按允许处理。
    expect(robots).toBeNull();
  });

  it("入口页抓取：DNS-pinned SSRF 通过，返回 200 且可抽取事实", async () => {
    const res = await httpFetch(CANARY_URL, prod);
    expect(res.status).toBe(200);
    expect(res.originalUrl).toBe(CANARY_URL);
    expect(res.fetchUrl).toMatch(/^https:\/\/www\.ah\.gov\.cn/);
    const facts = await extractPageFacts(res.body);
    expect(facts.title).toBeTruthy();
    expect(facts.bodyText.length).toBeGreaterThan(100);
    process.stdout.write(`\n[CANARY] 入口页 title=${facts.title}\n`);
    process.stdout.write(`[CANARY] 链接数=${facts.links.length} 正文长度=${facts.bodyText.length}\n`);
  }, 30_000);
});
