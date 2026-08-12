import type { Kysely } from "kysely";
import type { Database } from "../schema.js";
import type { ExportArtifactRow } from "../types.js";

/**
 * export_artifact 仓储（规格 §16.4 输出层）。
 * 记录导出文件哈希、行数与生成时间；导出行与 result_row 一一映射（规格 §16.6）。
 */
export class ExportArtifactRepository {
  constructor(private readonly db: Kysely<Database>) {}

  /** 保存导出记录（同任务重复导出返回既有记录）。 */
  async save(input: {
    taskRunId: string;
    filename: string;
    rowCount: number;
    contentHash: string;
    generatedAt: string;
  }): Promise<ExportArtifactRow> {
    const inserted = await this.db
      .insertInto("export_artifact")
      .values({
        task_run_id: input.taskRunId,
        filename: input.filename,
        row_count: input.rowCount,
        content_hash: input.contentHash,
        generated_at: input.generatedAt,
      })
      .onConflict((oc) =>
        oc.columns(["task_run_id", "filename"]).doNothing(),
      )
      .returningAll()
      .executeTakeFirst();

    if (inserted) {
      return inserted;
    }
    const existing = await this.db
      .selectFrom("export_artifact")
      .selectAll()
      .where("task_run_id", "=", input.taskRunId)
      .where("filename", "=", input.filename)
      .executeTakeFirstOrThrow();
    return existing;
  }

  /** 按任务查询最近导出记录。 */
  async findLatestByTask(taskRunId: string): Promise<ExportArtifactRow | undefined> {
    return this.db
      .selectFrom("export_artifact")
      .selectAll()
      .where("task_run_id", "=", taskRunId)
      .orderBy("generated_at", "desc")
      .executeTakeFirst();
  }
}
