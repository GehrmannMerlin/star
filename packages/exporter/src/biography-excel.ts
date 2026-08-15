import ExcelJS from "exceljs";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * Biography BIOGRAPHY_URL_ONLY 单 Sheet Excel 导出（STEP 18）。
 *
 * 只读取已经通过 BiographyUrlResultReader（LATEST_FROZEN_APPROVED_REVIEW 唯一 SSoT）
 * 确定性重建的 BiographyUrlResult 投影，不做任何业务语义判断：
 * - 严格一个 Sheet，名称「岗位信息采集结果」，5 个固定中文列（Web 规格 §21.2 的
 *   BIOGRAPHY_URL_ONLY 子集，只保留 BiographyUrlResult 能真实生产的字段）；
 * - 一个机构的 PRIMARY_1、PRIMARY_2 各一行；不显示内部 PRIMARY 标识；
 * - URL 单元格为超链接；UNRESOLVED 的 URL 单元格留空（不伪造、不复制、不填占位符）；
 * - 不输出内部 ID/英文枚举/分数/分析字段；
 * - 不输出超出 Skill Scope 的任前公示/代理任命/选举任命/离任等其它证据类型列。
 */

export const BIOGRAPHY_EXCEL_SHEET_NAME = "岗位信息采集结果";

export const BIOGRAPHY_EXCEL_COLUMNS = [
  "行政区划代码",
  "机构",
  "现任人员",
  "岗位信息URL",
  "采集结果",
] as const;

/** RESOLVED 的采集结果中文（规格 §21.2 示例）。 */
export const BIOGRAPHY_RESOLVED_RESULT_ZH = "已找到并复核";

/** UNRESOLVED 的采集结果中文（Skill TERMINAL_REASONS NO_QUALIFIED_URL）。 */
export const BIOGRAPHY_UNRESOLVED_RESULT_ZH = "完整搜索后无合格URL";

/** 单个 PRIMARY 槽位的结构化输入（与 BiographyUrlSlotResult 结构兼容）。 */
export interface BiographyExcelSlot {
  personName: string | null;
  biographyUrl: string | null;
  decisionStatus: "RESOLVED" | "UNRESOLVED";
}

/** 一个机构的两槽位结果（与 BiographyUrlResult 结构兼容，避免 exporter 依赖 agent-runtime）。 */
export interface BiographyExcelResult {
  regionCode: string | null;
  institutionName: string;
  primary1: BiographyExcelSlot;
  primary2: BiographyExcelSlot;
}

/** 投影后的单行（每 PRIMARY 槽位一行）。 */
export interface BiographyExcelRow {
  regionCode: string;
  institutionName: string;
  personName: string;
  /** UNRESOLVED = null（不伪造 URL）。 */
  biographyUrl: string | null;
  resultZh: string;
}

export interface RenderBiographyExcelInput {
  taskRunId: string;
  rows: BiographyExcelRow[];
  exportDir: string;
}

export interface RenderBiographyExcelOutput {
  filename: string;
  filePath: string;
  rowCount: number;
  contentHash: string;
  generatedAt: string;
}

/** 最小公式注入防护：仅前缀 = + - @ 或制表/换行的文本加前导单引号。 */
function neutralizeCellText(text: string): string {
  if (text.length > 0 && /^[=+\-@\t\r]/.test(text)) {
    return "'" + text;
  }
  return text;
}

/**
 * 纯确定性投影（无 IO、无 Agent）：BiographyUrlResult[] → 行。
 * - 严格保持输入顺序（= frozen inventory 顺序），不做任何排序；
 * - 每机构先 PRIMARY_1 后 PRIMARY_2 各一行，UNRESOLVED 槽位不 drop；
 * - 只做字段取值与 decisionStatus → 中文采集结果的机械映射，不做业务判断。
 */
export function projectBiographyResultRows(
  results: BiographyExcelResult[],
): BiographyExcelRow[] {
  const rows: BiographyExcelRow[] = [];
  for (const result of results) {
    for (const slot of [result.primary1, result.primary2]) {
      const resolved = slot.decisionStatus === "RESOLVED";
      rows.push({
        regionCode: result.regionCode ?? "",
        institutionName: result.institutionName,
        personName: slot.personName ?? "",
        biographyUrl: resolved ? slot.biographyUrl : null,
        resultZh: resolved
          ? BIOGRAPHY_RESOLVED_RESULT_ZH
          : BIOGRAPHY_UNRESOLVED_RESULT_ZH,
      });
    }
  }
  return rows;
}

/** 单 Sheet Workbook 渲染 + 落盘（复用 exceljs，与 §21.2 既有渲染同构）。 */
export async function renderBiographyResultRows(
  input: RenderBiographyExcelInput,
): Promise<RenderBiographyExcelOutput> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(BIOGRAPHY_EXCEL_SHEET_NAME);

  // 表头（5 个固定列）。
  sheet.addRow([...BIOGRAPHY_EXCEL_COLUMNS]);

  // 数据行：每名主要自然人一行。
  for (const row of input.rows) {
    const excelRow: unknown[] = [
      row.regionCode,
      neutralizeCellText(row.institutionName),
      neutralizeCellText(row.personName),
      // 岗位信息URL：空 URL 留空；有 URL 写入可点击超链接。
      row.biographyUrl == null || row.biographyUrl === ""
        ? undefined
        : { text: row.biographyUrl, hyperlink: row.biographyUrl },
      row.resultZh,
    ];
    sheet.addRow(excelRow);
  }

  await mkdir(input.exportDir, { recursive: true });
  const generatedAt = new Date().toISOString();
  const filename = `${input.taskRunId}-岗位信息采集结果-${generatedAt.slice(0, 10)}.xlsx`;
  const filePath = join(input.exportDir, filename);

  const buffer = await workbook.xlsx.writeBuffer();
  const bytes = Buffer.isBuffer(buffer)
    ? buffer
    : Buffer.from(new Uint8Array(buffer as ArrayBuffer));
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
