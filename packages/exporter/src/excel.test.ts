import { describe, it, expect, beforeAll } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ExcelJS from "exceljs";
import { exportResultRows } from "./excel.js";
import type { ResultRowView } from "@stellaris/contracts";

describe("exporter 单 Sheet Excel", () => {
  let exportDir: string;
  const base = {
    taskRunId: "t1",
    regionCode: "110000",
    institutionName: "某某区人民政府",
    positionDisplay: "某某区人民政府 区长",
    currentStatusZh: "正式在任",
    resultZh: "已找到并复核",
    collectedAt: new Date().toISOString(),
  };
  const rowP1: ResultRowView = {
    ...base,
    id: "r1",
    institutionSnapshotId: "i1",
    slot: "PRIMARY_1",
    personName: "张三",
    positionUrl: "https://x/ldr/zhang-san.html",
    pageTypeZh: "个人简介页",
  };
  const rowP2: ResultRowView = {
    ...base,
    id: "r2",
    institutionSnapshotId: "i1",
    slot: "PRIMARY_2",
    positionDisplay: "某某区人民政府 常务副区长",
    personName: "李四",
    positionUrl: "https://x/ldr/li-si.html",
    pageTypeZh: "个人简介页",
  };

  beforeAll(async () => {
    exportDir = await mkdtemp(join(tmpdir(), "stellaris-xlsx-"));
  });

  it("导出严格一个 Sheet，名称为岗位信息采集结果，13 列", async () => {
    const out = await exportResultRows({ taskRunId: "t1", rows: [rowP1, rowP2], exportDir });
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(out.filePath);
    expect(wb.worksheets).toHaveLength(1);
    const sheet = wb.worksheets[0]!;
    expect(sheet.name).toBe("岗位信息采集结果");
    expect(sheet.getRow(1).cellCount).toBe(13);
    expect(out.rowCount).toBe(2);
    expect(out.contentHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("URL 单元格为超链接，空 URL 单元格留空", async () => {
    const blankRow: ResultRowView = {
      ...base,
      id: "r3",
      institutionSnapshotId: "i1",
      slot: "PRIMARY_2",
      positionDisplay: "某某区人民政府 副区长",
      resultZh: "完整搜索后无合格URL",
    };
    const out = await exportResultRows({ taskRunId: "t1", rows: [rowP1, blankRow], exportDir });
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(out.filePath);
    const sheet = wb.worksheets[0]!;
    const cell = sheet.getRow(2).getCell(10);
    expect(cell.value).toEqual({ text: rowP1.positionUrl!, hyperlink: rowP1.positionUrl! });
    const blank = sheet.getRow(3).getCell(10);
    expect(blank.value).toBeNull();
  });

  it("一个机构两名主要自然人各一行", async () => {
    const out = await exportResultRows({ taskRunId: "t1", rows: [rowP1, rowP2], exportDir });
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(out.filePath);
    const sheet = wb.worksheets[0]!;
    // 数据行从第 2 行开始（第 1 行表头）。
    const row2Person = sheet.getRow(2).getCell(8).value; // 现任人员
    const row3Person = sheet.getRow(3).getCell(8).value;
    expect(row2Person).toBe("张三");
    expect(row3Person).toBe("李四");
    await rm(exportDir, { recursive: true, force: true });
  });
});
