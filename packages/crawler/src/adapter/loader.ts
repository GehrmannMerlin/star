import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * 声明式站点适配器加载与校验（规格 §12.3 / §12.1）。
 * 适配器为 JSON/YAML，只描述 host/path 匹配、DOM selector、渲染模式与角色关键词，
 * 不执行任意绕过脚本。
 */

export interface SiteAdapter {
  siteId: string;
  hosts: string[];
  institutionList: { url: string; selector: string } | null;
  leadershipList: { url: string; memberSelector: string } | null;
  memberDetail: { render: "http" | "playwright"; bioSelector: string | null } | null;
  roles: { primaryKeywords: string[]; secondaryKeywords: string[] };
  /** 行政区代码 → 真实入口 URL 映射（行政区发现/驱动用，规格 §8.1）。 */
  regionEntries?: Record<string, string>;
  /** 声明式机构清单（R-23）：机构名 → 官方入口 + 领导集合页；有领导信息的机构显式声明。 */
  declaredInstitutions?: Array<{ officialName: string; officialEntryUrl: string; leadershipUrl?: string }>;
  /** 声明机构适用的行政区代码集（R-46 行政区隔离）：缺省视为仅省本级适用，避免非声明行政区复用省级机构清单。 */
  declaredRegions?: string[];
  /** 机构 → 领导集合页映射（R-23：领导集合页按机构解析；无映射机构如实标记无领导信息）。 */
  leadershipByInstitution?: Record<string, string>;
}

const DEFAULT_ADAPTER_DIR = join(import.meta.dirname, "../../../../config/site-adapters");

/** 校验适配器原始对象；缺必填字段抛错。 */
export function validateAdapter(raw: unknown): SiteAdapter {
  if (typeof raw !== "object" || raw === null) {
    throw new Error("适配器必须为 JSON 对象");
  }
  const obj = raw as Record<string, unknown>;
  const siteId = obj.siteId;
  if (typeof siteId !== "string" || siteId.length === 0) {
    throw new Error("适配器缺少 siteId");
  }
  const hosts = obj.hosts;
  if (!Array.isArray(hosts) || hosts.length === 0 || hosts.some((h) => typeof h !== "string")) {
    throw new Error(`适配器 ${siteId} hosts 必须为非空字符串数组`);
  }
  const rolesRaw = obj.roles;
  if (typeof rolesRaw !== "object" || rolesRaw === null) {
    throw new Error(`适配器 ${siteId} 缺少 roles`);
  }
  const roles = rolesRaw as Record<string, unknown>;
  const primary = roles.primaryKeywords;
  const secondary = roles.secondaryKeywords;
  if (!Array.isArray(primary) || !Array.isArray(secondary)) {
    throw new Error(`适配器 ${siteId} roles.primaryKeywords/secondaryKeywords 必须为数组`);
  }

  const institutionList = obj.institutionList as Record<string, unknown> | null;
  const leadershipList = obj.leadershipList as Record<string, unknown> | null;
  const memberDetail = obj.memberDetail as Record<string, unknown> | null;

  return {
    siteId,
    hosts: hosts as string[],
    institutionList:
      institutionList && typeof institutionList.url === "string"
        ? { url: institutionList.url, selector: typeof institutionList.selector === "string" ? institutionList.selector : "" }
        : null,
    leadershipList:
      leadershipList && typeof leadershipList.url === "string"
        ? { url: leadershipList.url, memberSelector: typeof leadershipList.memberSelector === "string" ? leadershipList.memberSelector : "" }
        : null,
    memberDetail:
      memberDetail && (memberDetail.render === "http" || memberDetail.render === "playwright")
        ? { render: memberDetail.render, bioSelector: typeof memberDetail.bioSelector === "string" ? memberDetail.bioSelector : null }
        : null,
    roles: { primaryKeywords: primary as string[], secondaryKeywords: secondary as string[] },
    ...(typeof obj.regionEntries === "object" && obj.regionEntries !== null
      ? { regionEntries: obj.regionEntries as Record<string, string> }
      : {}),
    ...(Array.isArray(obj.declaredInstitutions)
      ? {
          declaredInstitutions: (obj.declaredInstitutions as Array<Record<string, unknown>>).map((d) => ({
            officialName: d.officialName as string,
            officialEntryUrl: d.officialEntryUrl as string,
            ...(typeof d.leadershipUrl === "string" ? { leadershipUrl: d.leadershipUrl } : {}),
          })),
        }
      : {}),
    ...(Array.isArray(obj.declaredRegions)
      ? { declaredRegions: (obj.declaredRegions as string[]).map((c) => String(c)) }
      : {}),
    ...(typeof obj.leadershipByInstitution === "object" && obj.leadershipByInstitution !== null
      ? { leadershipByInstitution: obj.leadershipByInstitution as Record<string, string> }
      : {}),
  };
}

/** 按 siteId 加载单个适配器。 */
export function loadAdapter(siteId: string, dir: string = DEFAULT_ADAPTER_DIR): SiteAdapter {
  const filePath = join(dir, `${siteId}.json`);
  const raw = JSON.parse(readFileSync(filePath, "utf-8")) as unknown;
  return validateAdapter(raw);
}

/** 加载目录下全部适配器（siteId → adapter）。 */
export function loadAllAdapters(dir: string = DEFAULT_ADAPTER_DIR): Map<string, SiteAdapter> {
  const map = new Map<string, SiteAdapter>();
  const files = readdirSync(dir).filter((f) => f.endsWith(".json"));
  for (const file of files) {
    const raw = JSON.parse(readFileSync(join(dir, file), "utf-8")) as unknown;
    const adapter = validateAdapter(raw);
    map.set(adapter.siteId, adapter);
  }
  return map;
}
