import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

interface GoldenPrimary {
  personName: string;
  url: string | null;
}
interface GoldenInstitution {
  officialName: string;
  entryUrl: string;
  primary: GoldenPrimary[];
}
interface GoldenFile {
  version: string;
  regions: Record<string, { institutions: GoldenInstitution[] }>;
}

const goldenPath = join(import.meta.dirname, "golden.json");
const golden = JSON.parse(readFileSync(goldenPath, "utf-8")) as GoldenFile;

describe("P4-T2 金标 golden.json 结构校验", () => {
  it("JSON 有效且含 version/regions", () => {
    expect(typeof golden.version).toBe("string");
    expect(golden.regions).toBeDefined();
  });

  it("每机构含 officialName/entryUrl/两名 primary（personName + url）", () => {
    for (const [regionCode, region] of Object.entries(golden.regions)) {
      expect(regionCode.length).toBeGreaterThanOrEqual(6);
      for (const inst of region.institutions) {
        expect(typeof inst.officialName).toBe("string");
        expect(typeof inst.entryUrl).toBe("string");
        expect(new URL(inst.entryUrl).protocol).toMatch(/^https?:$/);
        expect(inst.primary.length).toBeGreaterThanOrEqual(1);
        for (const p of inst.primary) {
          expect(typeof p.personName).toBe("string");
          if (p.url != null) expect(new URL(p.url).protocol).toMatch(/^https?:$/);
        }
      }
    }
  });

  it("安徽种子：安徽省人民政府两名主要自然人为王清宪/王东伟（R-21/R-37 已验证）", () => {
    const ah = golden.regions["340000"];
    expect(ah).toBeDefined();
    const gov = ah!.institutions.find((i) => i.officialName === "安徽省人民政府");
    expect(gov).toBeDefined();
    const names = gov!.primary.map((p) => p.personName);
    expect(names).toContain("王清宪");
    expect(names).toContain("王东伟");
    expect(gov!.primary.every((p) => p.url != null)).toBe(true);
  });
});
