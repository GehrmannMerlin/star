import * as cheerio from "cheerio";
import { createHash } from "node:crypto";

/**
 * 页面事实抽取（规格 §12.2 通用 DOM 事实）。
 * 只消费已保存的文档快照/原始 HTML，不依赖瞬时页面对象。
 * 保留表格、列表、卡片、姓名链接、官方顺序与上下文标题。
 */

export interface LeadershipMemberFact {
  name: string;
  roles: string[];
  sortOrder: number;
  href: string | null;
}

export interface LinkFact {
  href: string;
  anchor: string;
}

export interface PageFacts {
  documentHash: string;
  title: string | null;
  bodyText: string;
  leadershipMembers: LeadershipMemberFact[];
  links: LinkFact[];
  pageDate: string | null;
}

const DATE_PATTERN = /(\d{4})[年/-](\d{1,2})[月/-](\d{1,2})日?/;

function normalizeDate(raw: string | undefined): string | null {
  if (!raw) return null;
  const m = raw.match(DATE_PATTERN);
  if (!m || !m[1] || !m[2] || !m[3]) return null;
  return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
}

/**
 * 从原始 HTML 抽取页面事实。
 * - leadershipMembers：解析表格/列表中的领导行（姓名、岗位、链接、官方顺序）；
 * - links：全部 a[href] 链接；
 * - pageDate：页面日期（列表/详情常见格式）。
 */
export async function extractPageFacts(html: Uint8Array): Promise<PageFacts> {
  const documentHash = createHash("sha256").update(html).digest("hex");
  const text = new TextDecoder("utf-8").decode(html);
  const $ = cheerio.load(text);

  const title = $("title").first().text().trim() || null;
  const bodyText = $("body").text().replace(/\s+/g, " ").trim();

  const leadershipMembers: LeadershipMemberFact[] = [];
  const seenNames = new Set<string>();

  // 表格中的领导行（#leaderTable 或含"职务/分工"表头的表格）。
  $("table").each((_, table) => {
    $(table)
      .find("tr")
      .each((trIdx, tr) => {
        if (trIdx === 0) return; // 跳过表头
        const cells = $(tr).find("td");
        if (cells.length < 2) return;
        const nameCell = cells.eq(0);
        const roleCell = cells.eq(1);
        const name = nameCell.text().trim();
        if (!name || seenNames.has(name)) return;
        const href = nameCell.find("a").attr("href") ?? null;
        seenNames.add(name);
        leadershipMembers.push({
          name,
          roles: roleCell.text().split(/[、，,]/).map((s) => s.trim()).filter(Boolean),
          sortOrder: leadershipMembers.length + 1,
          href,
        });
      });
  });

  // 列表/卡片结构领导成员（R-23 校准）：真实官网（如安徽 /szf/index.html）领导以「角色分组 + liId 链接」呈现，
  // 岗位是分组的标题（如 <span role="heading">省&emsp;长</span> 后的成员列表），非链接容器文本。
  $("a[href*='liId='], a[href*='liId']").each((_, a) => {
    const href = $(a).attr("href") ?? "";
    const name = $(a).text().trim();
    if (!name || seenNames.has(name)) return;
    if (name.length < 2 || name.length > 4) return; // 领导名为 2-4 字，过滤栏目/功能链接文本。
    if (/省长|主席|主任|书记|厅长|市长|区长|县长|首页|更多|地图|帮助|链接/.test(name)) return; // 过滤岗位词/导航词。
    seenNames.add(name);
    // 岗位：向上找最近含标题语义（role="heading"/h3/h4）的祖先，取标题文本；否则链接容器文本。
    let roles: string[] = [];
    const headingAncestor = $(a).parents().filter((_, p) => $(p).find('[role="heading"], h3, h4, .title').length > 0).first();
    if (headingAncestor.length > 0) {
      const heading = headingAncestor.find('[role="heading"], h3, h4, .title').first().text().replace(/\s+/g, "").trim();
      if (heading) roles = [heading];
    }
    if (roles.length === 0) {
      const containerText = $(a).closest("li, td, .member, .item").first().text().replace(/\s+/g, " ").trim();
      const after = containerText.split(name).pop() ?? "";
      roles = after.split(/[、，,|]/).map((s) => s.trim()).filter((s) => s.length > 0 && s.length <= 12);
    }
    leadershipMembers.push({
      name,
      roles,
      sortOrder: leadershipMembers.length + 1,
      href,
    });
  });

  // 链接清单。
  const links: LinkFact[] = [];
  $("a[href]").each((_, a) => {
    const href = $(a).attr("href") ?? "";
    if (!href || href.startsWith("#") || href.startsWith("javascript:")) return;
    links.push({ href, anchor: $(a).text().trim() });
  });

  // 页面日期（从页面文本找日期；优先 meta/发布时间）。
  const metaDate = $('meta[property="article:published_time"]').attr("content");
  const pageDate = normalizeDate(metaDate) ?? normalizeDate(bodyText) ?? null;

  return { documentHash, title, bodyText, leadershipMembers, links, pageDate };
}
