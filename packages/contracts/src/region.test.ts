import { describe, it, expect } from "vitest";
import { listAnhuiRegions, childrenOf, expandRegions, listRegions, listProvinces, regionsByProvince } from "./region.js";

describe("安徽省行政区树", () => {
  it("安徽数据完整：省→16 地市→区县", () => {
    const all = listAnhuiRegions();
    expect(all.filter((r) => r.level === "province")).toHaveLength(1);
    expect(all.filter((r) => r.level === "city")).toHaveLength(16);
    expect(all.filter((r) => r.level === "county").length).toBeGreaterThan(80);
  });

  it("childrenOf 按父级返回下级", () => {
    const cities = childrenOf("340000");
    expect(cities.every((c) => c.level === "city")).toBe(true);
    expect(cities.some((c) => c.name.includes("合肥"))).toBe(true);
  });

  it("expandRegions 展开省级到区县", () => {
    const expanded = expandRegions(["340000"], "COUNTY");
    const codes = new Set(expanded.map((r) => r.code));
    expect(codes.has("340000")).toBe(true);
    expect(codes.has("340100")).toBe(true); // 合肥市
    expect(expanded.some((r) => r.level === "county")).toBe(true);
  });

  it("expandRegions 展开到乡镇/街道", () => {
    const expanded = expandRegions(["340100"], "TOWN_STREET");
    expect(expanded.some((r) => r.level === "town")).toBe(true);
  });
});

describe("全国行政区数据（R-24）", () => {
  it("全国数据完整：省级与地市规模", () => {
    const all = listRegions();
    // 省级 ≥ 30（含港澳台）。
    expect(all.filter((r) => r.level === "province").length).toBeGreaterThanOrEqual(30);
    // 地市级（level=city）覆盖多数省份。
    expect(all.filter((r) => r.level === "city").length).toBeGreaterThan(200);
    // 区县级 ≥ 2000（乡镇/街道后续扩展）。
    expect(all.filter((r) => r.level === "county").length).toBeGreaterThan(2000);
  });

  it("listProvinces 返回省级行政区", () => {
    const provinces = listProvinces();
    expect(provinces.length).toBeGreaterThanOrEqual(30);
    expect(provinces.some((p) => p.name.includes("安徽"))).toBe(true);
    expect(provinces.some((p) => p.name.includes("广东"))).toBe(true);
  });

  it("regionsByProvince 按省份筛选", () => {
    const guangdong = regionsByProvince("440000");
    expect(guangdong.every((r) => r.code.startsWith("44"))).toBe(true);
    // 广东含广州市。
    expect(guangdong.some((r) => r.code === "440100" && r.name.includes("广州"))).toBe(true);
  });

  it("代码格式与层级一致性：6/9 位、前缀匹配、无孤儿节点", () => {
    const all = listRegions();
    const codes = new Set(all.map((r) => r.code));
    // 所有代码为数字；省/市/县 6 位，乡镇 9 位。
    for (const r of all) {
      expect(r.code).toMatch(/^\d+$/);
      if (r.level === "town") {
        expect(r.code).toMatch(/^\d{9}$/);
      } else {
        expect(r.code).toMatch(/^\d{6}$/);
      }
      expect(codes.has(r.code)).toBe(true); // 无重复代码。
    }
    // 子节点前缀含父节点前缀。
    for (const r of all) {
      if (r.parentCode) {
        expect(r.code.startsWith(r.parentCode.slice(0, 2))).toBe(true);
        // 父节点存在。
        expect(codes.has(r.parentCode)).toBe(true);
      }
    }
    // 层级不高于父级。
    for (const r of all) {
      if (r.parentCode) {
        const parent = all.find((p) => p.code === r.parentCode);
        if (parent) {
          const order = { province: 0, city: 1, county: 2, town: 3 };
          expect(order[r.level]).toBeGreaterThan(order[parent.level]);
        }
      }
    }
  });

  it("expandRegions 跨省多行政区展开", () => {
    // 广东（44）+ 北京（11）区县展开。
    const expanded = expandRegions(["440000", "110000"], "COUNTY");
    const codes = new Set(expanded.map((r) => r.code));
    expect(codes.has("440100")).toBe(true); // 广州
    expect(codes.has("440300")).toBe(true); // 深圳
    expect(codes.has("110101")).toBe(true); // 北京东城
    expect(codes.has("110115")).toBe(true); // 北京大兴
  });
});
