import { describe, expect, it } from "vitest";
import { CrawlerPageInspectionAdapter } from "./crawler-page-inspection-adapter.js";
import { INSPECT_PAGE_TEXT_PREVIEW_LIMIT } from "./page-inspection.js";

const GOVERNMENT_HTML = `<!doctype html>
<html><head><title>安徽省政府信息公开</title>
<meta property="article:published_time" content="2026-08-01T10:00:00+08:00">
</head><body>
<table>
  <tr><th>姓名</th><th>职务</th></tr>
  <tr><td><a href="/ld/1.html">李某某</a></td><td>副省长、党组成员</td></tr>
</table>
<a href="https://www.gov.cn/">中国政府网</a>
<p>本页面更新于2026年8月1日。</p>
</body></html>`;

describe("CrawlerPageInspectionAdapter", () => {
  const adapter = new CrawlerPageInspectionAdapter();

  it("maps real extractPageFacts output into observations", async () => {
    const result = await adapter.inspectPage({
      url: "https://www.ah.gov.cn/",
      content: GOVERNMENT_HTML,
    });
    expect(result.url).toBe("https://www.ah.gov.cn/");
    expect(result.title).toContain("安徽");
    expect(result.textPreview.length).toBeGreaterThan(0);
    expect(result.textTruncated).toBe(false);
    expect(result.links).toContainEqual({ text: "中国政府网", url: "https://www.gov.cn/" });
    expect(result.leadershipMembers.length).toBeGreaterThan(0);
    expect(result.pageDate).toBe("2026-08-01");
    expect(result.headings).toBeNull();
    expect(result.breadcrumb).toBeNull();
    expect(result.tables).toBeNull();
  });

  it("returns INVALID_INPUT for empty or whitespace-only content", async () => {
    await expect(
      adapter.inspectPage({ url: "https://www.ah.gov.cn/", content: "   \n\t " }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });

  it("rejects non-http(s) source urls via the reused guard", async () => {
    await expect(
      adapter.inspectPage({ url: "ftp://example.com/a", content: "<p>x</p>" }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });

  it("caps text preview and reports truncation", async () => {
    const big = `<!doctype html><body><p>${"a".repeat(20_000)}</p></body></html>`;
    const result = await adapter.inspectPage({ url: "https://example.com/", content: big });
    expect(result.textLength).toBeGreaterThan(INSPECT_PAGE_TEXT_PREVIEW_LIMIT);
    expect(result.textTruncated).toBe(true);
    expect(result.textPreview.length).toBeLessThanOrEqual(INSPECT_PAGE_TEXT_PREVIEW_LIMIT);
  });
});
