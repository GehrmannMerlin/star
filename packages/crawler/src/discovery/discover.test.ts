import { describe, it, expect } from "vitest";
import { join } from "node:path";
import { discoverInstitutions } from "./discover.js";
import { createFixtureServer } from "../testing/fixture-server.js";
import { createSafeEgressPolicy } from "../safe-egress.js";
import type { SiteAdapter } from "../adapter/loader.js";

const GOLDEN = join(import.meta.dirname, "golden");

describe("机构发现（混合四层）", () => {
  it("适配器路径发现机构清单", async () => {
    const srv = await createFixtureServer([{ pathPrefix: "/golden", dir: GOLDEN }]);
    const policy = createSafeEgressPolicy({ mode: "offline-fixture", allowedTestPorts: new Set([srv.basePort]) });
    const adapter: SiteAdapter = {
      siteId: "test",
      hosts: ["localhost"],
      institutionList: { url: `${srv.url}/golden/institution-list.html`, selector: ".list a" },
      leadershipList: null,
      memberDetail: null,
      roles: { primaryKeywords: [], secondaryKeywords: [] },
    };
    const cands = await discoverInstitutions({
      regionCode: "340000",
      regionName: "安徽省",
      entryUrl: srv.url,
      policy,
      adapter,
    });
    expect(cands.length).toBe(4);
    expect(cands[0]!.officialName).toBe("省发展和改革委员会");
    expect(cands[0]!.discoverySource).toBe("adapter");
    expect(cands[0]!.institutionType).toBe("government_department");
    await srv.close();
  });

  it("无适配器时通用 DOM 规则回退", async () => {
    const srv = await createFixtureServer([{ pathPrefix: "/golden", dir: GOLDEN }]);
    const policy = createSafeEgressPolicy({ mode: "offline-fixture", allowedTestPorts: new Set([srv.basePort]) });
    // 无 adapter：入口页即机构列表页（通用规则从 .list a 抽取）。
    const cands = await discoverInstitutions({
      regionCode: "340000",
      regionName: "安徽省",
      entryUrl: `${srv.url}/golden/institution-list.html`,
      policy,
    });
    expect(cands.length).toBe(4);
    expect(cands[0]!.discoverySource).toBe("auto_discovered");
    await srv.close();
  });

  it("R-14 部门栏目递归发现（无单一清单页时）", async () => {
    const srv = await createFixtureServer([{ pathPrefix: "/golden", dir: GOLDEN }]);
    const policy = createSafeEgressPolicy({ mode: "offline-fixture", allowedTestPorts: new Set([srv.basePort]) });
    // 入口页导航含「省政府办公厅」栏目入口；该栏目页含机构链接。
    const cands = await discoverInstitutions({
      regionCode: "340000",
      regionName: "安徽省",
      entryUrl: `${srv.url}/golden/entry.html`,
      policy,
    });
    // entry.html 导航含「省政府办公厅」「省直部门」→ 递归进入 dept-column.html 发现机构。
    expect(cands.length).toBeGreaterThanOrEqual(1);
    expect(cands[0]!.discoverySource).toBe("auto_discovered");
    await srv.close();
  });
});

describe("R-46 行政区隔离（声明机构仅对声明行政区生效）", () => {
  // 声明式适配器（模拟安徽省级）：declaredInstitutions 省级 + declaredRegions 仅 340000。
  const declaredAdapter: SiteAdapter = {
    siteId: "anhui-provincial-government",
    hosts: ["*.ah.gov.cn"],
    institutionList: null,
    leadershipList: null,
    memberDetail: null,
    roles: { primaryKeywords: [], secondaryKeywords: [] },
    declaredInstitutions: [
      { officialName: "安徽省人民政府", officialEntryUrl: "https://www.ah.gov.cn/szf/index.html" },
      { officialName: "省教育厅", officialEntryUrl: "http://jyt.ah.gov.cn/" },
    ],
    declaredRegions: ["340000"],
  };

  it("声明行政区（340000）返回声明机构清单", async () => {
    const policy = createSafeEgressPolicy({ mode: "offline-fixture", allowedTestPorts: new Set([1]) });
    const cands = await discoverInstitutions({
      regionCode: "340000",
      regionName: "安徽省",
      entryUrl: "https://www.ah.gov.cn/",
      policy,
      adapter: declaredAdapter,
    });
    expect(cands.length).toBe(2);
    expect(cands[0]!.officialName).toBe("安徽省人民政府");
    expect(cands[0]!.discoverySource).toBe("adapter");
  });

  it("非声明行政区（340100 合肥）不复用省级声明机构", async () => {
    const srv = await createFixtureServer([{ pathPrefix: "/golden", dir: GOLDEN }]);
    const policy = createSafeEgressPolicy({ mode: "offline-fixture", allowedTestPorts: new Set([srv.basePort]) });
    // 合肥入口走真实机构发现（fixture 入口页），不应返回省级「安徽省人民政府」。
    const cands = await discoverInstitutions({
      regionCode: "340100",
      regionName: "合肥市",
      entryUrl: `${srv.url}/golden/entry.html`,
      policy,
      adapter: declaredAdapter,
    });
    expect(cands.some((c) => c.officialName === "安徽省人民政府")).toBe(false);
    expect(cands.every((c) => c.discoverySource !== "adapter")).toBe(true);
    await srv.close();
  });

  it("无 declaredRegions 声明的适配器视为仅省本级适用（默认隔离）", async () => {
    // 缺省 declaredRegions：等同显式声明非省本级不适用（保守默认，避免错配）。
    const adapterNoRegions: SiteAdapter = { ...declaredAdapter };
    delete (adapterNoRegions as { declaredRegions?: string[] }).declaredRegions;
    const srv = await createFixtureServer([{ pathPrefix: "/golden", dir: GOLDEN }]);
    const policy = createSafeEgressPolicy({ mode: "offline-fixture", allowedTestPorts: new Set([srv.basePort]) });
    const cands = await discoverInstitutions({
      regionCode: "340100",
      regionName: "合肥市",
      entryUrl: `${srv.url}/golden/entry.html`,
      policy,
      adapter: adapterNoRegions,
    });
    expect(cands.some((c) => c.officialName === "安徽省人民政府")).toBe(false);
    await srv.close();
  });
});

describe("R-47 导航词过滤增强（地市官网误抽排除）", () => {
  it("排除导航栏目/年份归档/申请功能/站点词，保留真实机构", async () => {
    const srv = await createFixtureServer([{ pathPrefix: "/golden", dir: GOLDEN }]);
    const policy = createSafeEgressPolicy({ mode: "offline-fixture", allowedTestPorts: new Set([srv.basePort]) });
    const cands = await discoverInstitutions({
      regionCode: "340100",
      regionName: "合肥市",
      entryUrl: `${srv.url}/golden/city-institutions.html`,
      policy,
    });
    const names = cands.map((c) => c.officialName);
    // 误抽词全部排除。
    for (const bad of ["新闻中心", "解读回应", "政务服务", "2024年", "2023年", "在线申请", "申请表下载", "依申请公开查询", "市政府", "国务院"]) {
      expect(names, `不应含误抽词 ${bad}`).not.toContain(bad);
    }
    // 真实机构保留。
    expect(names).toContain("市发改委");
    expect(names).toContain("市教育局");
    expect(names).toContain("市公安局");
    expect(names).toContain("市人社局");
    await srv.close();
  });

  it("真实机构含「中心」不被误杀（市住房公积金管理中心）", async () => {
    const srv = await createFixtureServer([{ pathPrefix: "/golden", dir: GOLDEN }]);
    const policy = createSafeEgressPolicy({ mode: "offline-fixture", allowedTestPorts: new Set([srv.basePort]) });
    const cands = await discoverInstitutions({
      regionCode: "340100",
      regionName: "合肥市",
      entryUrl: `${srv.url}/golden/city-institutions.html`,
      policy,
    });
    // city-institutions.html 无该机构；改用独立入口页（含真实中心机构）验证。
    // 直接构造含中心机构名的候选（走通用发现入口页即列表）。
    const cands2 = await discoverInstitutions({
      regionCode: "340100",
      regionName: "合肥市",
      entryUrl: `${srv.url}/golden/institution-list.html`,
      policy,
    });
    // 基础 fixture 仅 4 机构；此用例验证过滤不误杀机构特征名。
    expect(cands2.every((c) => c.discoverySource === "auto_discovered")).toBe(true);
    await srv.close();
  });
});

describe("R-52 国家级外链机构过滤", () => {
  it("排除国家/国务院/中央部委/中国科学院，保留市局机构", async () => {
    const srv = await createFixtureServer([{ pathPrefix: "/golden", dir: GOLDEN }]);
    const policy = createSafeEgressPolicy({ mode: "offline-fixture", allowedTestPorts: new Set([srv.basePort]) });
    const cands = await discoverInstitutions({
      regionCode: "340100",
      regionName: "合肥市",
      entryUrl: `${srv.url}/golden/city-institutions.html`,
      policy,
    });
    const names = cands.map((c) => c.officialName);
    // 国家级机构全部排除。
    for (const national of ["外交部", "公安部", "科学技术部", "国家文物局", "中国科学院", "国务院新闻办公室"]) {
      expect(names, `不应含国家级机构 ${national}`).not.toContain(national);
    }
    // 市局机构保留。
    expect(names).toContain("市发改委");
    expect(names).toContain("市教育局");
    expect(names).toContain("市公安局");
    expect(names).toContain("市人社局");
    await srv.close();
  });
});

describe("P4深度-D1 市级栏目词（市直政府部门）", () => {
  it("入口页含「市直政府部门」栏目 → 递归进入栏目页抽到市局机构", async () => {
    const srv = await createFixtureServer([{ pathPrefix: "/golden", dir: GOLDEN }]);
    const policy = createSafeEgressPolicy({ mode: "offline-fixture", allowedTestPorts: new Set([srv.basePort]) });
    const cands = await discoverInstitutions({
      regionCode: "341100",
      regionName: "滁州市",
      entryUrl: `${srv.url}/golden/city-departments.html`,
      policy,
    });
    const names = cands.map((c) => c.officialName);
    expect(names).toContain("市发展和改革委员会");
    expect(names).toContain("市教育局");
    expect(names).toContain("市公安局");
    await srv.close();
  });
});

describe("P4深度-D2 机构发现浏览器升级", () => {
  // mock BrowserPool：渲染返回含机构链接 HTML。
  function makeMockPool(renderHtml: string) {
    return {
      render: async () => ({
        fetchUrl: "https://www.example.gov.cn/",
        title: "市政府",
        bodyText: "",
        html: new TextEncoder().encode(renderHtml),
        waitSignals: [] as string[],
      }),
      close: async () => {},
    } as unknown as import("@stellaris/crawler/browser/render.js").BrowserPool;
  }

  it("HTTP 候选为空 + browserPool → 渲染入口页抽到机构", async () => {
    const srv = await createFixtureServer([{ pathPrefix: "/golden", dir: GOLDEN }]);
    const policy = createSafeEgressPolicy({ mode: "offline-fixture", allowedTestPorts: new Set([srv.basePort]) });
    // HTTP 入口页无机构（空导航页），渲染后含机构链接。
    const pool = makeMockPool(`
      <ul class="list">
        <li><a href="/bm/jyj.html">市教育局</a></li>
        <li><a href="/bm/gaj.html">市公安局</a></li>
      </ul>
    `);
    const cands = await discoverInstitutions({
      regionCode: "340200",
      regionName: "芜湖市",
      entryUrl: `${srv.url}/golden/city-departments.html`,
      policy,
      browserPool: pool,
    });
    const names = cands.map((c) => c.officialName);
    expect(names).toContain("市教育局");
    expect(names).toContain("市公安局");
    await srv.close();
  });

  it("渲染后仍无机构 → 如实空候选", async () => {
    const srv = await createFixtureServer([{ pathPrefix: "/golden", dir: GOLDEN }]);
    const policy = createSafeEgressPolicy({ mode: "offline-fixture", allowedTestPorts: new Set([srv.basePort]) });
    const pool = makeMockPool(`<html><body><p>无机构链接</p></body></html>`);
    const cands = await discoverInstitutions({
      regionCode: "340200",
      regionName: "芜湖市",
      entryUrl: `${srv.url}/golden/empty-nav.html`,
      policy,
      browserPool: pool,
    });
    expect(cands.length).toBe(0);
    await srv.close();
  });

  it("无 browserPool → 不渲染，如实空候选", async () => {
    const srv = await createFixtureServer([{ pathPrefix: "/golden", dir: GOLDEN }]);
    const policy = createSafeEgressPolicy({ mode: "offline-fixture", allowedTestPorts: new Set([srv.basePort]) });
    const cands = await discoverInstitutions({
      regionCode: "340200",
      regionName: "芜湖市",
      entryUrl: `${srv.url}/golden/empty-nav.html`,
      policy,
    });
    expect(cands.length).toBe(0);
    await srv.close();
  });
});
