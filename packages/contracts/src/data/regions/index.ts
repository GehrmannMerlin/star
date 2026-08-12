import type { RegionNode } from "../../region.js";
import { REGIONS_NORTH } from "./regions-north.js";
import { REGIONS_NORTHEAST } from "./regions-northeast.js";
import { REGIONS_EAST } from "./regions-east.js";
import { ANHUI_REGIONS } from "../regions-anhui.js";
import { REGIONS_CENTRAL } from "./regions-central.js";
import { REGIONS_SOUTH } from "./regions-south.js";
import { REGIONS_NORTHWEST } from "./regions-northwest.js";

/**
 * 全国行政区数据聚合（GB/T 2260 快照，生成于 2026-08-08，R-24 方案 A1）。
 * 覆盖：34 省级（含港澳台）→ 333 地市 → 3000+ 区县（乡镇/街道后续按需扩展）。
 * 说明：数据为快照，部分 2023-2025 新设/调整区划可能与我知识截止不一致；真实抓取校准（方案 B）留待后续。
 * 安徽使用既有 regions-anhui.ts（含乡镇/街道代表性子集）。
 */
export const ALL_REGIONS: RegionNode[] = [
  ...REGIONS_NORTH,
  ...REGIONS_NORTHEAST,
  ...REGIONS_EAST,
  ...ANHUI_REGIONS,
  ...REGIONS_CENTRAL,
  ...REGIONS_SOUTH,
  ...REGIONS_NORTHWEST,
];
