import type { Kysely } from "kysely";
import type { Database } from "../schema.js";
import type { PageFactRow } from "../types.js";

/**
 * page_fact 仓储（规格 §16.3 事实层）。
 * 只消费已保存的文档快照，不依赖瞬时页面对象（规格 §7.6）。
 */
export class PageFactRepository {
  constructor(private readonly db: Kysely<Database>) {}

  /** 保存页面事实。 */
  async saveFacts(input: {
    documentSnapshotId: string;
    title: string | null;
    bodyText: string | null;
    publishedAt: string | null;
    domFacts: unknown | null;
    signals: unknown | null;
  }): Promise<PageFactRow> {
    return this.db
      .insertInto("page_fact")
      .values({
        document_snapshot_id: input.documentSnapshotId,
        title: input.title,
        body_text: input.bodyText,
        published_at: input.publishedAt,
        dom_facts: input.domFacts === null ? null : JSON.stringify(input.domFacts),
        signals: input.signals === null ? null : JSON.stringify(input.signals),
      })
      .returningAll()
      .executeTakeFirstOrThrow();
  }
}
