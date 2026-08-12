import { describe, it, expect } from "vitest";
import { httpFetch } from "./http-fetch.js";
import { extractPageFacts } from "./page-facts.js";
import { createSafeEgressPolicy } from "./safe-egress.js";

const prod = createSafeEgressPolicy({ mode: "production", maxTimeoutMs: 20_000 });

describe("R-13 Canary: 安徽省机构列表校准（真实官网，只读）", () => {
  it("机构列表页 /site/tpl/2121 仅含单个机构链接（非完整清单）", async () => {
    const res = await httpFetch("https://www.ah.gov.cn/site/tpl/2121", prod);
    expect(res.status).toBe(200);
    const facts = await extractPageFacts(res.body);
    // 机构相关链接（排除导航）应只含省政府办公厅等少量。
    const instLinks = facts.links.filter((l) => /省政府办公厅|省.*(厅|委员会|局|办)/.test(l.anchor));
    process.stdout.write(`[CANARY] 机构列表页 title=${facts.title} 机构链接数=${instLinks.length}\n`);
    for (const l of instLinks) process.stdout.write(`[CANARY-INST] ${l.anchor} -> ${l.href}\n`);
    // 记录校准事实：该页非完整机构清单。
    expect(instLinks.length).toBeLessThanOrEqual(5);
  }, 30_000);

  it("领导列表页 /szf/index.html 可发现领导成员链接", async () => {
    const res = await httpFetch("https://www.ah.gov.cn/szf/index.html", prod);
    expect(res.status).toBe(200);
    const facts = await extractPageFacts(res.body);
    const memberLinks = facts.links.filter((l) => /liId=/.test(l.href));
    process.stdout.write(`[CANARY] 领导列表页 title=${facts.title} 成员链接数=${memberLinks.length}\n`);
    for (const l of memberLinks.slice(0, 10)) process.stdout.write(`[CANARY-MEMBER] ${l.anchor} -> ${l.href}\n`);
    expect(memberLinks.length).toBeGreaterThan(0);
  }, 30_000);
});
