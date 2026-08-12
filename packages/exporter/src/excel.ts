import ExcelJS from "exceljs";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { ResultRowView } from "@stellaris/contracts";

/**
 * 单 Sheet Excel 导出（规格 §21.2）。
 * - 只读取已复核 result_row（ResultRowView 投影），不做语义判断；
 * - 严格一个 Sheet，名称"岗位信息采集结果"，13 个固定中文列；
 * - 一个机构的两名主要自然人各一行；不显示 PRIMARY_1/PRIMARY_2；
 * - URL 单元格为超链接；空 URL 单元格留空；
 * - 不输出内部 ID/英文枚举/分数/分析字段。
 */

export const EXCEL_SHEET_NAME = "岗位信息采集结果";

export const EXCEL_COLUMNS = [
  "行政区划代码",
  "省",
  "地市",
  "区县/县级市",
  "乡镇/街道",
  "机构",
  "岗位",
  "现任人员",
  "当前状态",
  "岗位信息URL",
  "页面类型",
  "采集结果",
  "采集时间",
] as const;

export interface ExportExcelInput {
  taskRunId: string;
  rows: ResultRowView[];
  exportDir: string;
}

export interface ExportExcelOutput {
  filename: string;
  filePath: string;
  rowCount: number;
  contentHash: string;
  generatedAt: string;
}

export async function exportResultRows(input: ExportExcelInput): Promise<ExportExcelOutput> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(EXCEL_SHEET_NAME);

  // 表头（13 个固定列）。
  sheet.addRow([...EXCEL_COLUMNS]);

  // 数据行：每名主要自然人一行。
  for (const row of input.rows) {
    const excelRow: unknown[] = [
      row.regionCode,
      row.province ?? "",
      row.city ?? "",
      row.county ?? "",
      row.town ?? "",
      row.institutionName,
      row.positionDisplay,
      row.personName ?? "",
      row.currentStatusZh,
      // 岗位信息URL：空 URL 时单元格留空（不写入值）；有 URL 时写入可点击超链接。
      row.positionUrl == null || row.positionUrl === ""
        ? undefined
        : { text: row.positionUrl, hyperlink: row.positionUrl },
      row.pageTypeZh ?? "",
      row.resultZh,
      row.collectedAt,
    ];
    sheet.addRow(excelRow);
  }

  // 写入目录与文件。
  await mkdir(input.exportDir, { recursive: true });
  const generatedAt = new Date().toISOString();
  const filename = `${input.taskRunId}-岗位信息采集结果-${generatedAt.slice(0, 10)}.xlsx`;
  const filePath = join(input.exportDir, filename);

  const buffer = await workbook.xlsx.writeBuffer();
  const bytes = Buffer.isBuffer(buffer) ? buffer : Buffer.from(new Uint8Array(buffer as ArrayBuffer));
  const contentHash = createHash("sha256").update(bytes).digest("hex");
  await writeFile(filePath, bytes);

  return {
    filename,
    filePath,
    rowCount: input.rows.length,
    contentHash,
    generatedAt,
  };
}
