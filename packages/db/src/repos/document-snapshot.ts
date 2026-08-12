import type { Kysely } from "kysely";
import type { Database } from "../schema.js";
import type { DocumentSnapshotRow } from "../types.js";

/**
 * document_snapshot 仓储（规格 §16.2 / §17.2）。
 * 相同内容哈希只保存一份；多个抓取事件可引用同一快照。
 */
export class DocumentSnapshotRepository {
  constructor(private readonly db: Kysely<Database>) {}

  /** 按内容哈希幂等写入快照；已存在则返回既有行。 */
  async upsertByHash(input: {
    contentHash: string;
    mimeType: string;
    charset: string | null;
    sizeBytes: number;
    relativePath: string;
  }): Promise<DocumentSnapshotRow> {
    const inserted = await this.db
      .insertInto("document_snapshot")
      .values({
        content_hash: input.contentHash,
        mime_type: input.mimeType,
        charset: input.charset,
        size_bytes: input.sizeBytes,
        relative_path: input.relativePath,
      })
      .onConflict((oc) => oc.column("content_hash").doNothing())
      .returningAll()
      .executeTakeFirst();

    if (inserted) {
      return inserted;
    }
    const existing = await this.db
      .selectFrom("document_snapshot")
      .selectAll()
      .where("content_hash", "=", input.contentHash)
      .executeTakeFirstOrThrow();
    return existing;
  }

  /** 按内容哈希查询。 */
  async findByHash(contentHash: string): Promise<DocumentSnapshotRow | undefined> {
    return this.db
      .selectFrom("document_snapshot")
      .selectAll()
      .where("content_hash", "=", contentHash)
      .executeTakeFirst();
  }
}
