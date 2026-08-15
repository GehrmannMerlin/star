import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ExcelJS from "exceljs";
import {
  BIOGRAPHY_EXCEL_COLUMNS,
  BIOGRAPHY_EXCEL_SHEET_NAME,
  BIOGRAPHY_RESOLVED_RESULT_ZH,
  BIOGRAPHY_UNRESOLVED_RESULT_ZH,
  projectBiographyResultRows,
  renderBiographyResultRows,
  type BiographyExcelResult,
} from "./biography-excel.js";

/** 构造机构结果（regionCode/institutionName + 两槽位）。 */
function result(
  institutionName: string,
  primary1: BiographyExcelResult["primary1"],
  primary2: BiographyExcelResult["primary2"],
  regionCode = "320106",
): BiographyExcelResult {
  return { regionCode, institutionName, primary1, primary2 };
}

const RESOLVED = {
  personName: "张三",
  biographyUrl: "https://example.gov.cn/ldr/zhang-san.html",
  decisionStatus: "RESOLVED" as const,
};
const UNRESOLVED = {
  personName: "李四",
  biographyUrl: null,
  decisionStatus: "UNRESOLVED" as const,
};

describe("Biography Excel Row Projector", () => {
  it("resolved 槽位 → 正确行（URL、人员、已找到并复核）", () => {
    const rows = projectBiographyResultRows([result("鼓楼区人民政府", RESOLVED, UNRESOLVED)]);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({
      regionCode: "320106",
      institutionName: "鼓楼区人民政府",
      personName: "张三",
      biographyUrl: "https://example.gov.cn/ldr/zhang-san.html",
      resultZh: BIOGRAPHY_RESOLVED_RESULT_ZH,
    });
    expect(rows[1]!.biographyUrl).toBeNull();
    expect(rows[1]!.resultZh).toBe(BIOGRAPHY_UNRESOLVED_RESULT_ZH);
  });

  it("UNRESOLVED 槽位保留行且不伪造 URL（空 URL + 完整搜索后无合格URL）", () => {
    const rows = projectBiographyResultRows([result("鼓楼区人民政府", UNRESOLVED, UNRESOLVED)]);
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(row.biographyUrl).toBeNull();
      expect(row.resultZh).toBe(BIOGRAPHY_UNRESOLVED_RESULT_ZH);
    }
  });

  it("PRIMARY 顺序稳定（PRIMARY_1 在 PRIMARY_2 前）", () => {
    const rows = projectBiographyResultRows([result("A", RESOLVED, UNRESOLVED)]);
    expect(rows[0]!.personName).toBe("张三"); // PRIMARY_1
    expect(rows[1]!.personName).toBe("李四"); // PRIMARY_2
  });

  it("机构顺序 = 输入顺序（不受 agent 完成顺序影响）", () => {
    // 输入顺序 A, B（模拟 inventory 顺序）；即使 B 的完成顺序在前，投影仍按输入顺序。
    const rows = projectBiographyResultRows([
      result("机构A", RESOLVED, UNRESOLVED),
      result("机构B", RESOLVED, UNRESOLVED),
    ]);
    expect(rows.map((r) => r.institutionName)).toEqual([
      "机构A",
      "机构A",
      "机构B",
      "机构B",
    ]);
  });
});

describe("Biography Workbook Renderer", () => {
  let exportDir: string;

  beforeAll(async () => {
    exportDir = await mkdtemp(join(tmpdir(), "stellaris-bio-xlsx-"));
  });
  afterAll(async () => {
    await rm(exportDir, { recursive: true, force: true });
  });

  it("严格一个 Sheet，名「岗位信息采集结果」，5 列表头，行数正确", async () => {
    const rows = projectBiographyResultRows([result("鼓楼区人民政府", RESOLVED, UNRESOLVED)]);
    const out = await renderBiographyResultRows({ taskRunId: "t1", rows, exportDir });
    expect(out.rowCount).toBe(2);
    expect(out.contentHash).toMatch(/^[0-9a-f]{64}$/);

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(out.filePath);
    expect(wb.worksheets).toHaveLength(1);
    const sheet = wb.worksheets[0]!;
    expect(sheet.name).toBe(BIOGRAPHY_EXCEL_SHEET_NAME);
    const headers = sheet.getRow(1).values as unknown[];
    expect(headers.slice(1)).toEqual([...BIOGRAPHY_EXCEL_COLUMNS]);
    expect(sheet.rowCount).toBe(3); // 表头 + 2 数据行
  });

  it("URL 单元格为超链接；空 URL 单元格留空", async () => {
    const rows = projectBiographyResultRows([result("鼓楼区人民政府", RESOLVED, UNRESOLVED)]);
    const out = await renderBiographyResultRows({ taskRunId: "t1", rows, exportDir });
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(out.filePath);
    const sheet = wb.worksheets[0]!;
    // 第 4 列为岗位信息URL。
    expect(sheet.getRow(2).getCell(4).value).toEqual({
      text: "https://example.gov.cn/ldr/zhang-san.html",
      hyperlink: "https://example.gov.cn/ldr/zhang-san.html",
    });
    expect(sheet.getRow(3).getCell(4).value).toBeNull();
  });
});
