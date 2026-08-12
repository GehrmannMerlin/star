import { describe, it, expect } from "vitest";
import { loadAdapter, loadAllAdapters, validateAdapter } from "./loader.js";
import { join } from "node:path";

const ADAPTER_DIR = join(import.meta.dirname, "../../../../config/site-adapters");

describe("声明式适配器加载", () => {
  it("加载安徽适配器并校验必填字段", () => {
    const a = loadAdapter("anhui-provincial-government", ADAPTER_DIR);
    expect(a.siteId).toBe("anhui-provincial-government");
    expect(a.hosts).toContain("www.ah.gov.cn");
    // R-14 重校准：无单一机构清单页（Canary 校准），走部门栏目发现。
    expect(a.institutionList).toBeNull();
    expect(a.leadershipList?.url).toContain("/szf/index.html");
    expect(a.memberDetail?.render).toBe("playwright");
    expect(a.roles.primaryKeywords).toContain("省长");
    // R-20：行政区→真实入口映射（省本级 340000 已验证入口）。
    expect(a.regionEntries?.["340000"]).toBe("https://www.ah.gov.cn/");
  });

  it("P4-T1：regionEntries 覆盖省本级 + 全部 16 地市", () => {
    const a = loadAdapter("anhui-provincial-government", ADAPTER_DIR);
    const entries = a.regionEntries ?? {};
    // 16 地市代码（GB/T 2260）。
    const cityCodes = [
      "340100", "340200", "340300", "340400", "340500", "340600",
      "340700", "340800", "341000", "341100", "341200", "341300",
      "341500", "341600", "341700", "341800",
    ];
    expect(entries["340000"]).toBe("https://www.ah.gov.cn/");
    for (const code of cityCodes) {
      const url = entries[code];
      expect(url, `地市 ${code} 应有真实入口`).toBeDefined();
      expect(url).toBeDefined();
      expect(new URL(url!).protocol).toMatch(/^https?:$/);
    }
  });

  it("加载全部适配器", () => {
    const all = loadAllAdapters(ADAPTER_DIR);
    expect(all.size).toBeGreaterThanOrEqual(1);
  });

  it("校验非法适配器缺字段抛错", () => {
    expect(() => validateAdapter({ siteId: "x" })).toThrow();
  });
});
