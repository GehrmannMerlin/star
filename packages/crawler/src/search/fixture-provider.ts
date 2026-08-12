import type { SearchProvider, SearchResponse, SearchResult } from "./provider.js";

/**
 * 离线金标搜索提供器（P2）。
 * 返回预置金标结果（模拟 Brave 等真实提供器的返回结构）；
 * 供测试与 Recovery 策略链校验。真实提供器（Brave/Google/SearXNG）待用户授权后接入。
 */

interface FixtureEntry {
  queryPattern: RegExp;
  results: Array<{ title: string; summary: string | null; url: string }>;
}

const FIXTURES: FixtureEntry[] = [
  {
    queryPattern: /王清宪|省长/,
    results: [
      { title: "王清宪-安徽省人民政府", summary: "王清宪，男，安徽省委副书记，省长。", url: "https://www.ah.gov.cn/szf/index.html" },
      { title: "王清宪同志简历", summary: "王清宪同志简历", url: "https://www.ah.gov.cn/content/column/6784021?liId=711" },
    ],
  },
  {
    queryPattern: /副省长|王东伟/,
    results: [
      { title: "王东伟-安徽省人民政府", summary: "王东伟，安徽省委常委，常务副省长。", url: "https://www.ah.gov.cn/szf/index.html" },
      { title: "王东伟同志简历", summary: "王东伟同志简历", url: "https://www.ah.gov.cn/content/column/6784021?liId=1201" },
    ],
  },
];

export class FixtureSearchProvider implements SearchProvider {
  async search(query: string, opts?: { domain?: string; pageToken?: string }): Promise<SearchResponse> {
    const started = Date.now();
    const match = FIXTURES.find((f) => f.queryPattern.test(query));
    let results: SearchResult[] = match
      ? match.results.map((r, i) => ({
          title: r.title,
          summary: r.summary,
          url: r.url,
          rank: i + 1,
          timestamp: new Date().toISOString(),
        }))
      : [];
    // domain 过滤（限定官网域，§14.3 第 5 步）。
    if (opts?.domain) {
      results = results.filter((r) => {
        try {
          return new URL(r.url).hostname.endsWith(opts.domain!);
        } catch {
          return false;
        }
      });
    }
    return { results, durationMs: Date.now() - started };
  }
}
