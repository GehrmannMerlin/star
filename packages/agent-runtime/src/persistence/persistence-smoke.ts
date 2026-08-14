/**
 * Disposable PostgreSQL 持久化 Smoke（STEP 11）。
 *
 * 唯一真实 Smoke：迁移 → 写入 Tool Events + Evidence → 销毁实例 → 新实例重读 →
 * 复用现有 Candidate Provenance Gate → PASS → 重复提交 REJECTED。
 * 全程使用 Testcontainers postgres:18（项目既有 helper），仅本机随机端口，
 * 结束后精确 stop，不做任何 prune，不触碰生产 DB。
 */

import { fileURLToPath } from "node:url";
import path from "node:path";
import { createDb, InvestigatorEvidenceSubmissionRepository, migrateToLatest, ToolEventRepository } from "@stellaris/db";
import { startPostgres } from "@stellaris/db/testing/pg.js";
import { evaluateEvidenceProvenance } from "../evidence/evidence-provenance.js";
import { PostgresInvestigatorEvidenceSubmissionSink } from "./postgres-investigator-evidence-sink.js";
import { PostgresToolEventJournal } from "./postgres-tool-event-journal.js";

export const SMOKE_PACKET_ID = "smoke-packet-1";
export const SMOKE_SESSION_ID = "smoke-session-1";

export const URL_A = "https://www.njgl.gov.cn/zfxxgk/ldzc/1.html";
export const URL_B = "https://www.njgl.gov.cn/zfxxgk/ldzc/2.html";

export function smokeEvidencePayload() {
  return {
    candidates: [
      {
        candidate_id: "cand-p1-1",
        target_id: "glq-target-primary1",
        evidence_id: "evt-p1-1",
        url: URL_A,
        source_domain_class: "OFFICIAL_GOV_DOMAIN",
        page_shape_class: "OFFICIAL_PERSON_PROFILE",
        supports_person: true,
        supports_institution: true,
        supports_role: true,
        supports_currentness: true,
        candidate_status: "ACCEPTED_AS_FINAL",
        accept_or_reject_reason: "official person profile for PRIMARY_1",
        superseded_by_candidate_id: null,
      },
      {
        candidate_id: "cand-p2-1",
        target_id: "glq-target-primary2",
        evidence_id: "evt-p2-1",
        url: URL_B,
        source_domain_class: "OFFICIAL_GOV_DOMAIN",
        page_shape_class: "OFFICIAL_PERSON_PROFILE",
        supports_person: true,
        supports_institution: true,
        supports_role: true,
        supports_currentness: true,
        candidate_status: "ACCEPTED_AS_FINAL",
        accept_or_reject_reason: "official person profile for PRIMARY_2",
        superseded_by_candidate_id: null,
      },
    ],
  };
}

export type PersistenceSmokeReport = {
  migration: "PASS";
  eventsInserted: number;
  evidenceInserted: boolean;
  payloadHashMatch: boolean;
  evidenceFrozen: boolean;
  eventsReloaded: number;
  evidenceReloaded: boolean;
  provenanceAfterReload: "PASS" | "FAIL";
  duplicateSubmit: "REJECTED" | "ACCEPTED";
  rawHtmlPersisted: boolean;
  secretLikePersisted: boolean;
};

function now(offsetMs = 0): string {
  return new Date(Date.parse("2026-08-14T00:00:00.000Z") + offsetMs).toISOString();
}

/** 追加代表事件集（search + fetch/inspect A/B + submit）。返回写入的事件行数。 */
async function appendRepresentativeEvents(journal: PostgresToolEventJournal): Promise<number> {
  const context = {
    taskRunId: "smoke-task",
    agentSessionId: SMOKE_SESSION_ID,
    agentRole: "INVESTIGATOR" as const,
    packetId: SMOKE_PACKET_ID,
    signal: new AbortController().signal,
  };
  const t = (ms: number) => now(ms);
  const events: Array<{ callId: string; toolName: string; data: unknown; ms: number }> = [
    {
      callId: "call-search",
      toolName: "search_web",
      data: {
        provider: "bocha",
        results: [
          { url: URL_A, snippet: "区长页面 snippet" },
          { url: URL_B, snippet: "区委书记页面 snippet" },
          { url: "https://other.example/", snippet: "无关" },
        ],
      },
      ms: 0,
    },
    {
      callId: "call-fetch-a",
      toolName: "fetch_page",
      data: {
        requestedUrl: URL_A,
        finalUrl: URL_A,
        statusCode: 200,
        contentType: "text/html",
        content: "<html><body>区长简历 secret-token-aaa</body></html>",
        bytes: 12345,
      },
      ms: 100,
    },
    {
      callId: "call-inspect-a",
      toolName: "inspect_page",
      data: { url: URL_A, title: "区长 王安伟", links: ["/1.html"], personLikeMembers: ["王安伟"], date: "2026-08-01" },
      ms: 200,
    },
    {
      callId: "call-fetch-b",
      toolName: "fetch_page",
      data: {
        requestedUrl: URL_B,
        finalUrl: URL_B,
        statusCode: 200,
        contentType: "text/html",
        content: "<html><body>区委书记简历 secret-token-bbb</body></html>",
        bytes: 23456,
      },
      ms: 300,
    },
    {
      callId: "call-inspect-b",
      toolName: "inspect_page",
      data: { url: URL_B, title: "区委书记 董涵", links: ["/2.html"], personLikeMembers: ["董涵"], date: "2026-08-01" },
      ms: 400,
    },
    {
      callId: "call-submit",
      toolName: "submit_investigator_evidence",
      data: { payloadHash: "smoke-hash", candidateCount: 2 },
      ms: 500,
    },
  ];

  for (const event of events) {
    await journal.onStart({
      callId: event.callId,
      toolName: event.toolName,
      context,
      startedAt: t(event.ms),
    });
    await journal.onSuccess({
      callId: event.callId,
      toolName: event.toolName,
      status: "SUCCESS",
      data: event.data,
      startedAt: t(event.ms),
      finishedAt: t(event.ms + 50),
    });
  }
  return events.length * 2; // STARTED + SUCCESS
}

/**
 * 运行完整持久化 Smoke。返回成功标准报告；任何硬失败直接抛出。
 * Testcontainers 容器在 finally 中精确 stop。
 */
export async function runPersistenceSmoke(): Promise<PersistenceSmokeReport> {
  const pg = await startPostgres();
  try {
    const db = createDb(pg.config);
    const migration = await migrateToLatest(db);
    if (!migration.ok) {
      throw new Error(`STEP 11 migration failed: ${String(migration.error)}`);
    }

    // ── Phase 1: 写入（同一批实例） ──
    const toolEventRepo = new ToolEventRepository(db);
    const evidenceRepo = new InvestigatorEvidenceSubmissionRepository(db);
    const journal = new PostgresToolEventJournal(toolEventRepo);
    const sink = new PostgresInvestigatorEvidenceSubmissionSink(evidenceRepo, {
      packetId: SMOKE_PACKET_ID,
      agentSessionId: SMOKE_SESSION_ID,
      agentRole: "INVESTIGATOR",
      skill: { name: "official-biography-evidence", version: "3.1.0" },
    });

    const eventsInserted = await appendRepresentativeEvents(journal);
    const payload = smokeEvidencePayload();
    const submitted = await sink.submit(payload);
    const evidenceInserted = submitted.status === "ACCEPTED";

    // ── Phase 2: 销毁实例，创建全新实例（证明数据来自 PostgreSQL，而非类内存缓存） ──
    const reader = new PostgresToolEventJournal(new ToolEventRepository(db));
    const reloadedSink = new PostgresInvestigatorEvidenceSubmissionSink(
      new InvestigatorEvidenceSubmissionRepository(db),
      {
        packetId: SMOKE_PACKET_ID,
        agentSessionId: SMOKE_SESSION_ID,
        agentRole: "INVESTIGATOR",
        skill: { name: "official-biography-evidence", version: "3.1.0" },
      },
    );

    const successes = await reader.listSuccesses();
    const eventsReloaded = successes.length;
    const submission = await reloadedSink.getSubmission();
    const evidenceReloaded = submission !== null;
    const frozen = await reloadedSink.isFrozen();

    // payload hash 一致性：冻结时持久化的 payload_hash 必须等于 submit 返回的 hash。
    // （jsonb 会规范化键序，re-hash round-trip 后的 payload 并非稳定比较，因此以持久化 hash 为准。）
    const storedRow = await evidenceRepo.getSubmissionByPacketId(SMOKE_PACKET_ID);
    const payloadHashMatch =
      submitted.status === "ACCEPTED" &&
      storedRow !== null &&
      storedRow.payload_hash === submitted.payloadHash;

    // 复用现有 Candidate Provenance Gate（未改动判断规则）。
    const gate = submission
      ? evaluateEvidenceProvenance(successes, submission.candidates)
      : { passed: false, candidates: [] };
    const provenanceAfterReload: "PASS" | "FAIL" = gate.passed ? "PASS" : "FAIL";

    // 重复提交：同一 Packet 必须被拒绝。
    const duplicate = await reloadedSink.submit(payload);
    const duplicateSubmit: "REJECTED" | "ACCEPTED" =
      duplicate.status === "ALREADY_SUBMITTED" ? "REJECTED" : "ACCEPTED";

    // 数据最小化核对：任何 jsonb 投影不得含原始 HTML 或 secret-like 字段。
    const rows = await toolEventRepo.listEvents({ packetId: SMOKE_PACKET_ID });
    const serialized = JSON.stringify(
      rows.map((r) => [r.url_metadata, r.search_metadata, r.submission_metadata]),
    );
    const rawHtmlPersisted = /<html/i.test(serialized);
    const secretLikePersisted = /secret-token|authorization|api[_-]?key|bearer/i.test(serialized);

    await db.destroy();

    return {
      migration: "PASS",
      eventsInserted,
      evidenceInserted,
      payloadHashMatch,
      evidenceFrozen: frozen,
      eventsReloaded,
      evidenceReloaded,
      provenanceAfterReload,
      duplicateSubmit,
      rawHtmlPersisted,
      secretLikePersisted,
    };
  } finally {
    await pg.stop();
  }
}

async function main(): Promise<void> {
  const report = await runPersistenceSmoke();
  console.log("STEP 11 persistence smoke report:");
  console.log(JSON.stringify(report, null, 2));
  const failed =
    report.eventsReloaded === 0 ||
    !report.evidenceInserted ||
    !report.payloadHashMatch ||
    !report.evidenceFrozen ||
    !report.evidenceReloaded ||
    report.provenanceAfterReload !== "PASS" ||
    report.duplicateSubmit !== "REJECTED" ||
    report.rawHtmlPersisted ||
    report.secretLikePersisted;
  process.exit(failed ? 1 : 0);
}

// 仅当直接作为脚本入口运行（tsx src/persistence/persistence-smoke.ts）时执行 main。
// 作为模块被 vitest import 时，process.argv[1] 指向 vitest，不会进入。
if (path.resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  void main();
}
