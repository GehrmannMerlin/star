import { Type, type Static } from "@sinclair/typebox";

/**
 * Excel 导出状态合同（规格 §21.2 / §16.4 export_artifact）。
 */

export const ExportStatus = Type.Object({
  taskRunId: Type.String(),
  filename: Type.String(),
  rowCount: Type.Number(),
  contentHash: Type.String(),
  generatedAt: Type.String(),
  downloadUrl: Type.String(),
});
export type ExportStatus = Static<typeof ExportStatus>;
