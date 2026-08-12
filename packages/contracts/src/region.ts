import { ALL_REGIONS } from "./data/regions/index.js";

/**
 * 全国行政区树（GB/T 2260 快照，规格 §8.1，R-24）。
 * 行政区划代码按文本处理保留前导零；查询与展开基于代码前缀匹配。
 * 覆盖：34 省级 → 333 地市 → 3000+ 区县（乡镇/街道后续按需扩展）。
 */

/** 行政区节点。 */
export interface RegionNode {
  code: string;
  name: string;
  level: "province" | "city" | "county" | "town";
  parentCode: string | null;
}

/** 行政区展开层级（内部枚举，对应 ExpandLevel）。 */
export type RegionExpandLevel = "COUNTY" | "TOWN_STREET";

const TARGET_LEVEL: Record<RegionExpandLevel, RegionNode["level"]> = {
  COUNTY: "county",
  TOWN_STREET: "town",
};

/** 全国全部行政区。 */
export function listRegions(): RegionNode[] {
  return ALL_REGIONS;
}

/** 全部省级行政区。 */
export function listProvinces(): RegionNode[] {
  return ALL_REGIONS.filter((r) => r.level === "province");
}

/** 按省份代码（2 位前缀）返回该省全部节点（含省自身）。 */
export function regionsByProvince(provinceCode: string): RegionNode[] {
  const prefix = provinceCode.slice(0, 2);
  return ALL_REGIONS.filter((r) => r.code.slice(0, 2) === prefix);
}

/** 安徽省全量行政区（兼容保留；含乡镇/街道代表性子集）。 */
export function listAnhuiRegions(): RegionNode[] {
  return ALL_REGIONS.filter((r) => r.code.startsWith("34"));
}

/** 按父级代码返回直接下级。 */
export function childrenOf(parentCode: string): RegionNode[] {
  return ALL_REGIONS.filter((r) => r.parentCode === parentCode);
}

/**
 * 静态展开：对每个传入代码，按「行政区划层级前缀」匹配其至目标层级的所有下级（含自身）。
 * 层级前缀：省级取前 2 位，地市级取前 4 位，区县级取前 6 位。
 * 例：expandRegions(["340000"], "COUNTY") -> 340000 + 16 地市 + 其下所有区县。
 */
export function expandRegions(codes: string[], level: RegionExpandLevel): RegionNode[] {
  const target = TARGET_LEVEL[level];
  const result: RegionNode[] = [];
  const seen = new Set<string>();

  for (const code of codes) {
    const self = ALL_REGIONS.find((r) => r.code === code);
    if (self && !seen.has(self.code)) {
      seen.add(self.code);
      result.push(self);
    }
    // 自身层级（决定前缀位数）。
    const selfLevel = self?.level ?? "province";
    const prefixLen = prefixLength(selfLevel);
    const prefix = code.slice(0, prefixLen);
    const targetIndex = levelOrder(target);
    for (const r of ALL_REGIONS) {
      if (r.code === code) continue;
      if (r.code.slice(0, prefixLen) === prefix) {
        const levelIndex = levelOrder(r.level);
        if (levelIndex <= targetIndex && !seen.has(r.code)) {
          seen.add(r.code);
          result.push(r);
        }
      }
    }
  }
  return result;
}

/** 各级行政区代码的前缀位数（省级 2 位，地市 4 位，区县 6 位，乡镇/街道更长）。 */
function prefixLength(level: RegionNode["level"]): number {
  switch (level) {
    case "province":
      return 2;
    case "city":
      return 4;
    case "county":
      return 6;
    case "town":
      return 9;
    default:
      return 6;
  }
}

function levelOrder(level: RegionNode["level"]): number {
  switch (level) {
    case "province":
      return 0;
    case "city":
      return 1;
    case "county":
      return 2;
    case "town":
      return 3;
    default:
      return 2;
  }
}
