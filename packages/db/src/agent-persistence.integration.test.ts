import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createDb } from "./client.js";
import { migrateToLatest } from "./migrate.js";
import { startPostgres, type StartedPostgres } from "./testing/pg.js";
import { ToolEventRepository } from "./repos/tool-event.js";
import { InvestigatorEvidenceSubmissionRepository } from "./repos/investigator-evidence.js";

let pg: StartedPostgres;

beforeAll(async () => {
  pg = await startPostgres();
}, 120_000);

afterAll(async () => {
  await pg.stop();
});

describe("agent persistence 集成（真实 PostgreSQL 18）", () => {
  it("迁移 004 执行且幂等，新表存在", async () => {
    const db = createDb(pg.config);
    const r1 = await migrateToLatest(db);
    expect(r1.ok).toBe(true);
    expect(r1.all).toContain("2026-08-14-agent-persistence");

    const r2 = await migrateToLatest(db);
    expect(r2.ok).toBe(true);
    expect(r2.executed).toEqual([]); // 幂等

    const tables = await db.introspection.getTables();
    const names = tables.map((t) => t.name);
    expect(names).toContain("tool_event");
    expect(names).toContain("investigator_evidence_submission");
    await db.destroy();
  });

  it("tool_event 追加 + 按 seq 确定顺序读取 + 会话过滤", async () => {
    const db = createDb(pg.config);
    await migrateToLatest(db);
    const repo = new ToolEventRepository(db);

    const started = await repo.insertEvent({
      call_id: "call-1",
      tool_name: "fetch_page",
      status: "STARTED",
      agent_session_id: "session-a",
      packet_id: "packet-1",
      agent_role: "INVESTIGATOR",
      task_run_id: "task-1",
      started_at: "2026-08-14T00:00:00.000Z",
      finished_at: null,
      failure_code: null,
      failure_message: null,
      failure_retryable: null,
      url_metadata: null,
      search_metadata: null,
      submission_metadata: null,
    });
    expect(started.id).toBeDefined();

    // 终态事件（投影 URL 元数据）。
    await repo.insertEvent({
      call_id: "call-1",
      tool_name: "fetch_page",
      status: "SUCCESS",
      agent_session_id: "session-a",
      packet_id: "packet-1",
      agent_role: "INVESTIGATOR",
      task_run_id: "task-1",
      started_at: "2026-08-14T00:00:00.000Z",
      finished_at: "2026-08-14T00:00:00.100Z",
      failure_code: null,
      failure_message: null,
      failure_retryable: null,
      url_metadata: { requestedUrl: "https://a.example/1", finalUrl: "https://a.example/1", statusCode: 200 },
      search_metadata: null,
      submission_metadata: null,
    });
    await repo.insertEvent({
      call_id: "call-2",
      tool_name: "inspect_page",
      status: "SUCCESS",
      agent_session_id: "session-a",
      packet_id: "packet-1",
      agent_role: "INVESTIGATOR",
      task_run_id: "task-1",
      started_at: "2026-08-14T00:00:01.000Z",
      finished_at: "2026-08-14T00:00:01.100Z",
      failure_code: null,
      failure_message: null,
      failure_retryable: null,
      url_metadata: { url: "https://a.example/1" },
      search_metadata: null,
      submission_metadata: null,
    });

    const successes = await repo.listSuccessEvents({ agentSessionId: "session-a" });
    expect(successes).toHaveLength(2);
    expect(successes[0]?.tool_name).toBe("fetch_page");
    expect(successes[1]?.tool_name).toBe("inspect_page");
    // jsonb 往返：读取为解析后的对象。
    const urlMeta = successes[0]?.url_metadata as { requestedUrl?: string } | null;
    expect(urlMeta?.requestedUrl).toBe("https://a.example/1");
    expect(successes[1]?.url_metadata).toEqual({ url: "https://a.example/1" });

    const other = await repo.listSuccessEvents({ agentSessionId: "session-zzz" });
    expect(other).toHaveLength(0);

    await db.destroy();
  });

  it("investigator_evidence_submission 插入/读取/冻结 + 唯一约束拒绝重复", async () => {
    const db = createDb(pg.config);
    await migrateToLatest(db);
    const repo = new InvestigatorEvidenceSubmissionRepository(db);

    const payload = {
      candidates: [
        {
          candidate_id: "cand-p1-1",
          target_id: "glq-target-primary1",
          evidence_id: "evt-1",
          url: "https://www.njgl.gov.cn/zfxxgk/ldzc/1.html",
          source_domain_class: "OFFICIAL_GOV_DOMAIN",
          page_shape_class: "OFFICIAL_PERSON_PROFILE",
          supports_person: true,
          supports_institution: true,
          supports_role: true,
          supports_currentness: true,
          candidate_status: "ACCEPTED_AS_FINAL",
          accept_or_reject_reason: "official person profile",
          superseded_by_candidate_id: null,
        },
      ],
    };

    const frozen = await repo.insertSubmission({
      packet_id: "packet-x",
      agent_session_id: "session-x",
      agent_role: "INVESTIGATOR",
      skill_name: "official-biography-evidence",
      skill_version: "3.1.0",
      canonical_schema: "url-candidate-pool.schema.json",
      payload,
      payload_hash: "abc123",
      frozen_at: "2026-08-14T00:00:00.000Z",
    });
    expect(frozen.id).toBeDefined();
    expect(await repo.isFrozen("packet-x")).toBe(true);
    expect(await repo.isFrozen("packet-nope")).toBe(false);

    const read = await repo.getSubmissionByPacketId("packet-x");
    expect(read?.payload_hash).toBe("abc123");
    expect(read?.payload).toEqual(payload);

    // 重复冻结：数据库唯一约束必须拒绝。
    await expect(
      repo.insertSubmission({
        packet_id: "packet-x",
        agent_session_id: "session-x",
        agent_role: "INVESTIGATOR",
        skill_name: "official-biography-evidence",
        skill_version: "3.1.0",
        canonical_schema: "url-candidate-pool.schema.json",
        payload,
        payload_hash: "abc123",
        frozen_at: "2026-08-14T00:00:00.000Z",
      }),
    ).rejects.toMatchObject({ code: "23505" });

    await db.destroy();
  });
});
