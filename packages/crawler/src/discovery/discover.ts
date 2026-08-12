import * as cheerio from "cheerio";
import type { InstitutionType } from "@stellaris/contracts";
import { httpFetch } from "../http-fetch.js";
import { extractPageFacts } from "../page-facts.js";
import type { SafeEgressPolicy } from "../safe-egress.js";
import type { SiteAdapter } from "../adapter/loader.js";
import type { BrowserPool } from "../browser/render.js";

/**
 * 机构发现（规格 §12.1 四层抽取）。
 * 1. 通用 DOM 规则：从入口页抽「政府机构/机构设置」栏目链接 → 机构列表；
 * 2. 声明式适配器：adapter.institutionList 直接定位机构列表（优先）；
 * 3. 区域成功模式：同省同市 URL 模式复用；
 * 4. 通用规则回退。
 * 候选统一为 InstitutionCandidate。
 */

export interface InstitutionCandidate {
  officialName: string;
  institutionType: InstitutionType;
  officialEntryUrl: string | null;
  discoverySource: "auto_discovered" | "adapter" | "user_specified";
}

export interface DiscoverInput {
  regionCode: string;
  regionName: string;
  entryUrl: string;
  policy: SafeEgressPolicy;
  adapter?: SiteAdapter;
  /** 部门栏目递归发现上限（R-14）。 */
  maxDepartmentColumns?: number;
  /** P4-D2：浏览器池（HTTP 候选为空时渲染入口页重跑抽取，覆盖 JS 动态机构列表）。 */
  browserPool?: BrowserPool;
}

/** 按机构名称关键词推断机构类型（规格 §13.4）。 */
function inferInstitutionType(name: string): InstitutionType {
  const n = name;
  if (/人民政府|人民委员会/.test(n)) return "government";
  if (/委员会|办公厅|发展和改革|教育厅|科学技术厅|工业和信息化|公安厅|财政厅|人力资源和社会保障|自然资源厅|生态环境厅|住房和城乡建设厅|交通运输厅|农业农村厅|商务厅|文化和旅游厅|卫生健康委员会|应急管理厅|审计厅|市场监督管理局|体育局|统计局|林业局|数据资源管理局/.test(n)) {
    return "government_department";
  }
  if (/委员会|省委/.test(n)) return "party_committee";
  if (/人民法院/.test(n)) return "court";
  if (/人民检察院/.test(n)) return "procuratorate";
  return "government_department";
}

/** 判定文本是否为机构正式名称（R-22 校准：以机构特征词结尾且文本较短；过滤新闻标题/导航）。 */
function isInstitutionName(text: string): boolean {
  const normalized = text.replace(/\s+/g, "");
  // 排除导航/功能词（注意「公安」是机构名成分，不排除；ICP备案/公安备案号才排除）。
  // R-47 增强：补充 R-46 地市 Canary 暴露的导航栏目/年份归档/申请功能/站点词。
  // 注意：不排除「中心」（市住房公积金管理中心等真实机构）；排除「新闻中心/下载中心/数据中心」等导航组合。
  if (/回顶部|顶部|其他网站|更多|网站|首页|登录|注册|地图|帮助|无障碍|English|英文|繁体|手机版|长者版|ICP|备案|举报|协会|地址|邮编|电话|邮箱|Copyright|版权/.test(normalized)) return false;
  // R-47 新增排除：导航栏目/功能链接/站点词。
  if (/^新闻|^资讯|^动态|^公告|^公示|^政策|^解读|^回应|^服务|^政务|^办事|^数据|^互动|^交流|^专题|^专栏|^调查|^问卷|^视频|^图片|^图解|^媒体|^发布|^公开|^下载|^申请|^查询|^统计|^建议|^投诉|^监督|^绩效|^规划|^计划|^目标|^报告|^会议|^活动|^培训|^介绍|^指南|^导引|^频道|^网站群|^系统|^返回|^顶层|^顶部|^无障碍浏览|^微信|^微博|^客户端|^版权声明|^法律声明|^隐私|^安全|^联系我们|^关于我们|^政府信息公开|^解读回应|^政务服务|^皖事通|^互动交流|^政务数据|^徽风皖韵/.test(normalized)) return false;
  // 新闻中心/下载中心/数据中心/服务中心/咨询中心 等导航组合（区别于「市住房公积金管理中心」真实机构）。
  if (/^(新闻|下载|数据|服务|咨询|办理|政务|信息|便民|市民|企业|互动)中心$/.test(normalized)) return false;
  // 年份归档（如「2024年」「2019年」）。
  if (/^(19|20)\d{2}年?$/.test(normalized)) return false;
  // 通用站点词（如「市政府」「国务院」「生态宣城」——无机构特征词或过于泛化）。
  if (/^市政府$|^国务院$|^省政府$|^政府$|^县人民政府$/.test(normalized)) return false;
  // R-52 国家级外链机构排除（地方官网渲染页的中央政府推荐链接，非地方组成部门）：
  // - 「国家」前缀（国家XX局/委/署/总局）：国家文物局/国家核安全局/国家信访局/国家能源局/国家金融监督管理总局…
  // - 「国务院」前缀（国务院XX办公室/部/事务）：国务院新闻办公室/国务院侨务办公室/国务院港澳事务办公室…
  // - 「部」结尾（中央部委）：外交部/公安部/科学技术部/人力资源和社会保障部/财政部…
  // - 中国科学院/社会科学院等中央机构。
  if (/^国家/.test(normalized)) return false;
  if (/^国务院/.test(normalized)) return false;
  if (/^(外交|国防|公安|教育|科学技术|科技|工业和信息化|民政|司法|财政|人力资源社会保障|自然资源|生态环境|住房和城乡建设|交通运输|水利|农业农村|商务|文化和旅游|卫生健康|应急管理|人民银行|审计|退役军人事务|海关总署)部$/.test(normalized)) return false;
  if (/^(中国科学院|中国社会科学院|国家卫生健康委员会|国家民族事务委员会|国务院国资委|全国人大|全国政协|最高人民法院|最高人民检察院)$/.test(normalized)) return false;
  // 机构名以「厅/局/委员会/办公厅/办公室/署/部/处/科/中心/总队/支队/站/校/院/集团/委」等结尾（R-47：补「委」，覆盖发改委/民委等简称）。
  if (!/(厅|局|委员会|办公厅|办公室|署|部|处|科|中心|总队|支队|站|校|院|集团|委)$/.test(normalized)) return false;
  // 机构名较短（≤ 20 字符），过滤长新闻标题。
  return normalized.length <= 20;
}

/** 从机构列表 HTML 抽取候选（通用规则：ul/table/div 中的链接列表）。 */
function extractCandidatesFromHtml(
  html: string,
  baseUrl: string,
  source: "auto_discovered" | "adapter",
): InstitutionCandidate[] {
  const $ = cheerio.load(html);
  const candidates: InstitutionCandidate[] = [];

  // 优先适配器/通用列表容器：含"机构/厅/委员会/局"的链接。
  // R-22 校准：不因首个 selector 命中即 break——真实站点机构链接分散在不同容器（导航/列表/机构栏目）。
  const selectors = [".list a", "ul li a", "table a", ".col a", "a.link", "[class*='zfjg'] a", "a[href*='zfxxgk']", "a[href*='jigou']"];
  const anchors: Array<{ text: string; href: string }> = [];
  const seenAnchor = new Set<string>();
  for (const sel of selectors) {
    $(sel).each((_, el) => {
      const text = $(el).text().trim();
      const href = $(el).attr("href") ?? "";
      const key = `${text}|${href}`;
      if (!text || !href || seenAnchor.has(key)) return;
      // 过滤非机构链接（导航/功能链接）。去空格匹配（真实站点「首 页」等导航词中间带空格）；繁简兼容（「繁体/繁體」）。
      const normalized = text.replace(/\s+/g, "");
      if (/首页|登录|注册|地图|帮助|无障碍|繁体|繁體|英文版|English|手机版|长者版|省长之窗|政务公开|皖事通办|互动交流|政府数据|徽风皖韵|无障碍浏览|返回顶部/.test(normalized)) return;
      seenAnchor.add(key);
      anchors.push({ text, href });
    });
  }
  // R-22 校准：追加全链接扫描（覆盖真实站点机构容器 class 非标准列表，如 <a class="link"> 在机构栏目容器内）。
  $("a[href]").each((_, el) => {
    const text = $(el).text().trim();
    const href = $(el).attr("href") ?? "";
    const key = `${text}|${href}`;
    if (!text || !href || seenAnchor.has(key)) return;
    if (!isInstitutionName(text)) return; // 仅收机构特征文本。
    const normalized = text.replace(/\s+/g, "");
    if (/首页|登录|注册|地图|帮助|无障碍|繁体|繁體|英文版|English|手机版|长者版|省长之窗|政务公开|皖事通办|互动交流|政府数据|徽风皖韵|无障碍浏览|返回顶部/.test(normalized)) return;
    seenAnchor.add(key);
    anchors.push({ text, href });
  });

  for (const a of anchors) {
    const officialEntryUrl = a.href.startsWith("http") ? a.href : new URL(a.href, baseUrl).toString();
    candidates.push({
      officialName: a.text,
      institutionType: inferInstitutionType(a.text),
      officialEntryUrl,
      discoverySource: source,
    });
  }
  return candidates;
}

/**
 * 四层机构发现 + 部门栏目递归发现（R-14 增强）。
 * 优先 adapter.institutionList（第 2 层）；否则从入口页通用抽取（第 1 层），
 * 部门栏目递归（R-14：当无单一清单页时，从部门栏目入口逐个发现，规格 §8.2），
 * 再尝试区域模式（第 3 层）与回退（第 4 层）。
 */
export async function discoverInstitutions(input: DiscoverInput): Promise<InstitutionCandidate[]> {
  // 第 0 层（R-23）：声明式机构清单优先——有领导信息的机构显式声明，无需网络发现。
  // R-46 行政区隔离：声明机构仅对「声明行政区」（declaredRegions）生效；
  // 非声明行政区（如合肥/芜湖）不复用省级清单，走真实机构发现，避免行政区错配。
  const declared = input.adapter?.declaredInstitutions ?? [];
  const declaredRegions = input.adapter?.declaredRegions;
  // R-46 行政区隔离：声明机构仅对「声明行政区」（declaredRegions）生效；
  // 未显式声明时保守默认「仅省本级」（代码以 0000 结尾），避免省级机构清单泄漏到地市级行政区。
  const regionIsDeclared = declaredRegions != null && declaredRegions.length > 0
    ? declaredRegions.includes(input.regionCode)
    : input.regionCode.endsWith("0000");
  if (declared.length > 0 && regionIsDeclared) {
    return declared.map((d) => ({
      officialName: d.officialName,
      institutionType: inferInstitutionType(d.officialName),
      officialEntryUrl: d.officialEntryUrl,
      discoverySource: "adapter" as const,
    }));
  }

  // 第 2 层：适配器优先。
  if (input.adapter?.institutionList) {
    const listUrl = input.adapter.institutionList.url;
    try {
      const res = await httpFetch(listUrl, input.policy);
      const html = new TextDecoder("utf-8").decode(res.body);
      const candidates = extractCandidatesFromHtml(html, listUrl, "adapter");
      if (candidates.length > 0) {
        return candidates;
      }
    } catch {
      // 适配器列表抓取失败 → 回退通用规则。
    }
  }

  // 第 1 层 + 第 4 层：从入口页通用抽取机构列表。
  try {
    const res = await httpFetch(input.entryUrl, input.policy);
    const facts = await extractPageFacts(res.body);
    // 找「政府机构/机构设置」栏目链接（排除新闻标题中的「机构」字样，如「医疗机构管理办法」；R-22 校准）。
    const navHits = facts.links.filter((l) =>
      /政府机构|机构设置|机构职能|组织机构|机构简介/.test(l.anchor) &&
      !/管理办法|医疗|机构设置说明|解读|通知/.test(l.anchor),
    );
    for (const hit of navHits.slice(0, 3)) {
      const listUrl = hit.href.startsWith("http") ? hit.href : new URL(hit.href, res.fetchUrl).toString();
      try {
        const listRes = await httpFetch(listUrl, input.policy);
        const html = new TextDecoder("utf-8").decode(listRes.body);
        const candidates = extractCandidatesFromHtml(html, listUrl, "auto_discovered");
        if (candidates.length > 0) {
          return candidates;
        }
      } catch {
        // 继续尝试下一个。
      }
    }
    // 第 4 层：入口页本身即机构列表。
    const html = new TextDecoder("utf-8").decode(res.body);
    const candidates = extractCandidatesFromHtml(html, input.entryUrl, "auto_discovered");
    // 仅返回含机构特征的真实候选（过滤新闻标题/导航；R-22 校准）。
    const realCandidates = candidates.filter((c) => isInstitutionName(c.officialName));
    if (realCandidates.length > 0) {
      return realCandidates;
    }

    // R-14 增强：部门栏目递归发现（无单一清单页时）。
    // 从入口页/导航找「省政府办公厅/部门/直属单位」等栏目入口，逐个进入抽机构。
    const deptCandidates = await discoverFromDepartmentColumns({
      entryUrl: input.entryUrl,
      entryFacts: facts,
      policy: input.policy,
      baseUrl: res.fetchUrl,
      maxColumns: input.maxDepartmentColumns ?? 6,
    });
    if (deptCandidates.length > 0) {
      return deptCandidates;
    }
  } catch {
    // 入口抓取失败 → 空候选（调用方记录终态）。
  }

  // P4-D2：浏览器升级兜底——HTTP 全候选为空 且 有 browserPool → 渲染入口页重跑抽取。
  // 覆盖 JS 动态渲染机构列表的地市官网（如芜湖/淮北），规格 §10.2。
  if (input.browserPool) {
    try {
      const rendered = await input.browserPool.render(input.entryUrl);
      const html = new TextDecoder("utf-8").decode(rendered.html);
      const candidates = extractCandidatesFromHtml(html, rendered.fetchUrl ?? input.entryUrl, "auto_discovered");
      const realCandidates = candidates.filter((c) => isInstitutionName(c.officialName));
      if (realCandidates.length > 0) {
        return realCandidates;
      }
    } catch {
      // 渲染失败 → 如实空候选（不阻断）。
    }
  }

  return [];
}

/**
 * 部门栏目递归发现（R-14）。
 * 从入口页导航中识别「部门栏目入口」（如「省政府办公厅」「省直部门」「政府机构」子栏目），
 * 逐个抓取栏目页并抽取机构候选。适用于无单一机构清单页的站点（R-13 Canary 校准）。
 */
async function discoverFromDepartmentColumns(input: {
  entryUrl: string;
  entryFacts: Awaited<ReturnType<typeof extractPageFacts>>;
  policy: SafeEgressPolicy;
  baseUrl: string;
  maxColumns: number;
}): Promise<InstitutionCandidate[]> {
  const { entryFacts, policy, baseUrl, maxColumns } = input;
  const candidates: InstitutionCandidate[] = [];
  const seen = new Set<string>();
  const visitedColumns = new Set<string>();

  // 递归下钻部门栏目（R-22 校准：真实站点为多层导航 首页→省长之窗→政府机构→机构）。
  async function drill(url: string, depth: number): Promise<void> {
    if (depth > 2 || visitedColumns.has(url)) return; // 两层下钻上限 + 防环。
    visitedColumns.add(url);
    let res;
    try {
      res = await httpFetch(url, policy);
    } catch {
      return; // 该栏目抓取失败 → 停止此分支。
    }
    const html = new TextDecoder("utf-8").decode(res.body);
    const found = extractCandidatesFromHtml(html, url, "auto_discovered");
    // 候选须含机构特征才算有效机构（过滤栏目页自身的导航/栏目名）。
    const realInstitutions = found.filter((c) => isInstitutionName(c.officialName));
    for (const c of realInstitutions) {
      if (!seen.has(c.officialName)) {
        seen.add(c.officialName);
        candidates.push(c);
      }
    }
    if (candidates.length > 0) return;

    // 本页无机构候选 → 找部门栏目入口继续下钻（一层到两层）。
    const facts = await extractPageFacts(res.body);
    const subColumns = facts.links.filter((l) =>
      /政府机构|省政府办公厅|省直部门|直属单位|组成部门|机构设置|政府部门|省长之窗|市直部门|市直政府部门|部门网站|政府工作部门|市属机构|组织机构/.test(l.anchor) &&
      !/政策文件|解读|通知|办法|首页/.test(l.anchor),
    );
    for (const sub of subColumns.slice(0, maxColumns)) {
      const subUrl = sub.href.startsWith("http") ? sub.href : new URL(sub.href, res.fetchUrl).toString();
      await drill(subUrl, depth + 1);
      if (candidates.length > 0) return;
    }
  }

  // 识别部门栏目入口：含「政府机构/办公厅/部门/直属单位/组成部门/机构设置/政府部门/省长之窗/市直部门/部门网站/市属机构」且为栏目（列表）型。
  const columnHits = entryFacts.links.filter((l) =>
    /政府机构|省政府办公厅|省直部门|直属单位|组成部门|机构设置|政府部门|省长之窗|市直部门|市直政府部门|部门网站|政府工作部门|市属机构|组织机构/.test(l.anchor) &&
    !/政策文件|解读|通知|办法|首页/.test(l.anchor),
  );

  for (const hit of columnHits.slice(0, maxColumns)) {
    const columnUrl = hit.href.startsWith("http") ? hit.href : new URL(hit.href, baseUrl).toString();
    await drill(columnUrl, 1);
    if (candidates.length > 0) {
      return candidates;
    }
  }
  return candidates;
}
