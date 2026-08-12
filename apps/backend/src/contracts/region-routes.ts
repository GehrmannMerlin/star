import type { FastifyInstance } from "fastify";
import { listRegions, listProvinces, regionsByProvince, childrenOf, expandRegions } from "@stellaris/contracts";

/**
 * 行政区查询 API（规格 §8.1，R-24 全国数据）。
 * - GET /api/regions/provinces : 全部省级行政区
 * - GET /api/regions/tree?level=county|town&province=340000 : 行政区树（全国，可按省份+层级筛选）
 * - GET /api/regions/children?parent=340000 : 下级行政区
 * - POST /api/regions/validate : 校验行政区代码清单
 * - POST /api/regions/expand : 展开行政区至目标层级
 */
export async function registerRegionRoutes(app: FastifyInstance): Promise<void> {
  // 全部省级行政区。
  app.get("/api/regions/provinces", async () => {
    return listProvinces().map((r) => ({ code: r.code, name: r.name, level: r.level, parentCode: r.parentCode }));
  });

  // 行政区树（全国全量，可按省份+目标层级过滤）。
  app.get<{ Querystring: { level?: string; province?: string } }>("/api/regions/tree", async (req) => {
    const level = req.query.level;
    // 省份筛选：province 参数（代码前 2 位匹配）；缺省全国。
    const all = req.query.province ? regionsByProvince(req.query.province) : listRegions();
    if (level === "county") {
      return all.filter((r) => r.level === "province" || r.level === "city" || r.level === "county");
    }
    if (level === "town") {
      return all;
    }
    return all.filter((r) => r.level === "province" || r.level === "city");
  });

  // 下级行政区。
  app.get<{ Querystring: { parent?: string } }>("/api/regions/children", async (req) => {
    const parent = req.query.parent;
    if (!parent) {
      return { error: "缺少 parent 参数" };
    }
    return childrenOf(parent);
  });

  // 校验行政区代码清单（返回无效代码）。
  app.post<{ Body: { codes: string[] } }>("/api/regions/validate", async (req) => {
    const codes = req.body?.codes ?? [];
    const all = listRegions();
    const validSet = new Set(all.map((r) => r.code));
    const invalid = codes.filter((c) => !validSet.has(c));
    return { valid: invalid.length === 0, invalid };
  });

  // 展开行政区至目标层级（返回展开后的代码列表）。
  app.post<{ Body: { codes: string[]; level?: "COUNTY" | "TOWN_STREET" } }>("/api/regions/expand", async (req) => {
    const codes = req.body?.codes ?? [];
    const level = req.body?.level ?? "COUNTY";
    const expanded = expandRegions(codes, level);
    return expanded.map((r) => ({ code: r.code, name: r.name, level: r.level, parentCode: r.parentCode }));
  });
}
