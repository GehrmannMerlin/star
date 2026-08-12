import type { Kysely } from "kysely";
import type { Database } from "../schema.js";
import type { UrlCandidateRow } from "../types.js";

/**
 * url_candidate 仓储（规格 §16.4 业务层）。
 * 候选 URL 与硬门槛结果；发现分数只决定抓取优先级，不抵硬门槛失败（规格 §13.1）。
 */
export class UrlCandidateRepository {
  constructor(private readonly db: Kysely<Database>) {}

  /** 添加候选。 */
  async addCandidate(input: {
    taskRunId: string;
    institutionSnapshotId: string | null;
    url: string;
    discoveryScore: number;
    hardGate: unknown | null;
  }): Promise<UrlCandidateRow> {
    return this.db
      .insertInto("url_candidate")
      .values({
        task_run_id: input.taskRunId,
        institution_snapshot_id: input.institutionSnapshotId,
        url: input.url,
        discovery_score: input.discoveryScore,
        hard_gate: input.hardGate === null ? null : JSON.stringify(input.hardGate),
      })
      .returningAll()
      .executeTakeFirstOrThrow();
  }
}
