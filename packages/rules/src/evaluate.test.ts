import { describe, it, expect } from "vitest";
import { evaluateAccuracy, type GoldenFile } from "./evaluate.js";

const golden: GoldenFile = {
  version: "1",
  regions: {
    "340000": {
      institutions: [
        {
          officialName: "安徽省人民政府",
          entryUrl: "https://www.ah.gov.cn/szf/index.html",
          primary: [
            { personName: "王清宪", url: "https://www.ah.gov.cn/content/column/6784021?liId=711" },
            { personName: "王东伟", url: "https://www.ah.gov.cn/content/column/6784021?liId=1201" },
          ],
        },
      ],
    },
  },
};

// 预测输入：部分命中（含 1 个错误人选 + 1 个空 URL）。
const predicted = [
  { institutionName: "安徽省人民政府", slot: "PRIMARY_1", personName: "王清宪", positionUrl: "https://www.ah.gov.cn/content/column/6784021?liId=711" },
  { institutionName: "安徽省人民政府", slot: "PRIMARY_2", personName: "王东伟", positionUrl: null },
];

describe("P4-T3 准确率评估器", () => {
  it("计算两名主要自然人选择准确率（人名命中/总槽位）", () => {
    const report = evaluateAccuracy(golden, predicted);
    // PRIMARY_1 命中，PRIMARY_2 人名命中（URL 空不影响人名准确率）。
    expect(report.twoPrimaryAccuracy).toBe(1.0);
  });

  it("映射准确率要求人+URL 全命中", () => {
    const report = evaluateAccuracy(golden, predicted);
    // PRIMARY_1 全命中；PRIMARY_2 URL 空 → 不命中。1/2 = 0.5。
    expect(report.mappingAccuracy).toBe(0.5);
  });

  it("召回 = 命中金标 URL / 金标 URL 总数；precision/F1", () => {
    const report = evaluateAccuracy(golden, predicted);
    // 金标 2 个 URL，命中 1 → recall 0.5；预测非空 1，命中 1 → precision 1.0；F1 = 2*1*0.5/(1+0.5) ≈ 0.6667。
    expect(report.recall).toBeCloseTo(0.5, 3);
    expect(report.precision).toBe(1.0);
    expect(report.f1).toBeCloseTo(2 * 1 * 0.5 / 1.5, 3);
  });

  it("机构名不匹配时不计入（配对缺失）", () => {
    const report = evaluateAccuracy(golden, [
      { institutionName: "无关机构", slot: "PRIMARY_1", personName: "张三", positionUrl: "https://x/1" },
    ]);
    expect(report.rows.length).toBe(2); // 金标 2 槽位，预测未配对 → 视为未命中。
    expect(report.twoPrimaryAccuracy).toBe(0);
    expect(report.recall).toBe(0);
  });

  it("完全命中时准确率 100%", () => {
    const report = evaluateAccuracy(golden, [
      { institutionName: "安徽省人民政府", slot: "PRIMARY_1", personName: "王清宪", positionUrl: "https://www.ah.gov.cn/content/column/6784021?liId=711" },
      { institutionName: "安徽省人民政府", slot: "PRIMARY_2", personName: "王东伟", positionUrl: "https://www.ah.gov.cn/content/column/6784021?liId=1201" },
    ]);
    expect(report.twoPrimaryAccuracy).toBe(1.0);
    expect(report.mappingAccuracy).toBe(1.0);
    expect(report.recall).toBe(1.0);
  });
});
