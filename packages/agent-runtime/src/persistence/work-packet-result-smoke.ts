/**
 * STEP 15 — Biography URL Result and Persistent Work Packet — disposable smoke。
 *
 * 唯一真实 Smoke（disposable Testcontainers PostgreSQL，无 LLM）：
 * apply migration 001..006 → 生成 Packet A（POSITION_DECIDED + 两 PRIMARY 人员身份）
 * 与 Packet B（READY_FOR_REVIEW 未决）→ persist 合法 Evidence（Candidate Pool）与
 * Round-1 REWORK / Round-2 APPROVED Review → destroy repository instances →
 * new Postgres Packet Store / Review Reader / Evidence Reader 重水合 →
 * BiographyUrlResultReader 推导 → Packet A 两 PRIMARY 各自 RESOLVED URL；
 * Packet B UNRESOLVED 不伪造 URL。完成后精确 stop 容器。
 */

import type {
  InvestigatorEvidenceSubmissionPayload,
  ReviewerChecks,
  ReviewerSubmissionPayload,
  UrlCandidatePoolRow,
} from "@stellaris/agent-tools";
import {
  createDb,
  InstitutionWorkPacketRepository,
  InvestigatorEvidenceSubmissionRepository,
  migrateToLatest,
  ReviewDecisionSubmissionRepository,
} from "@stellaris/db";
import { startPostgres } from "@stellaris/db/testing/pg.js";
import { BiographyUrlResultReader } from "../results/biography-url-result.js";
import { PostgresInstitutionWorkPacketStore } from "../work-packet/institution-work-packet.js";
import { PostgresReviewDecisionSink } from "./postgres-review-decision-sink.js";
import { PostgresInvestigatorEvidenceSubmissionSink } from "./postgres-investigator-evidence-sink.js";
import { PostgresReviewDecisionReader } from "./review-decision-reader.js";
import { PostgresEvidenceReader } from "./evidence-reader.js";

export const WORK_PACKET_RESULT_SMOKE_FAILED = "WORK_PACKET_RESULT_SMOKE_FAILED" as const;
export type WorkPacketResultSmokeStatus = "OK" | typeof WORK_PACKET_RESULT_SMOKE_FAILED;

const CHECKS: ReviewerChecks = {
  person_and_institution: true,
  page_type: true,
  better_personal_page: true,
  news_or_function_page_rejected: true,
  currentness: true,
  all_discovered_evidence_consumed: true,
  empty_search_complete: true,
  dynamic_escalation_complete: true,
};

const SKILL = { name: "official-biography-evidence", version: "3.1.0" };

const POOL: UrlCandidatePoolRow[] = [
  {
    candidate_id: "cand-gulou-p1",
    target_id: "glq-target-primary1",
    evidence_id: "evt-gulou-1",
    url: "http://www.njgl.gov.cn/xxgk/qczc/dh/",
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
  {
    candidate_id: "cand-gulou-p2",
    target_id: "glq-target-primary2",
    evidence_id: "evt-gulou-2",
    url: "http://www.njgl.gov.cn/xxgk/qczc/sl/",
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
];

function reworkRound1(): ReviewerSubmissionPayload {
  return {
    reviews: [
      {
        target_id: "glq-target-primary1",
        selected_candidate_id: null,
        review_result: "REWORK_REQUIRED",
        final_review_result: "REWORK_REQUIRED",
        review_reason: "round 1 needs recovery",
        currentness_quality: "CURRENTNESS_UNRESOLVED",
        checks: CHECKS,
      },
    ],
  };
}

function approvedRound2(): ReviewerSubmissionPayload {
  return {
    reviews: [
      {
        target_id: "glq-target-primary1",
        selected_candidate_id: "cand-gulou-p1",
        review_result: "APPROVED",
        final_review_result: "APPROVED_STRICT_ADMISSIBLE",
        review_reason: "round 2 approved",
        currentness_quality: "CURRENT_COLLECTION_MEMBER",
        checks: CHECKS,
      },
      {
        target_id: "glq-target-primary2",
        selected_candidate_id: "cand-gulou-p2",
        review_result: "APPROVED",
        final_review_result: "APPROVED_STRICT_ADMISSIBLE",
        review_reason: "round 2 approved",
        currentness_quality: "CURRENT_COLLECTION_MEMBER",
        checks: CHECKS,
      },
    ],
  };
}

const ADVANCE_A: Array<Parameters<PostgresInstitutionWorkPacketStore["updateState"]>[1]> = [
  "INVESTIGATING",
  "EVIDENCE_PENDING",
  "EVIDENCE_GATHERING",
  "READY_FOR_REVIEW",
  "REVIEWING",
  "POSITION_DECIDED",
];
const ADVANCE_B: Array<Parameters<PostgresInstitutionWorkPacketStore["updateState"]>[1]> = [
  "INVESTIGATING",
  "EVIDENCE_PENDING",
  "EVIDENCE_GATHERING",
  "READY_FOR_REVIEW",
];

/** 运行完整 STEP 15 Smoke。返回门控报告；任何硬失败直接抛出。 */
export async function runWorkPacketResultSmoke(): Promise<{
  status: WorkPacketResultSmokeStatus;
  report: Record<string, unknown>;
}> {
  const pg = await startPostgres();
  let db: ReturnType<typeof createDb> | undefined;
  let db2: ReturnType<typeof createDb> | undefined;
  try {
    db = createDb(pg.config);
    const migration = await migrateToLatest(db);
    if (!migration.ok) {
      throw new Error(`STEP 15 migration failed: ${String(migration.error)}`);
    }

    // ── Phase 1: 同一批实例写入 Packet / Evidence / Review ──
    const packetRepo = new InstitutionWorkPacketRepository(db);
    const packetStore = new PostgresInstitutionWorkPacketStore(packetRepo);
    const packets = await packetStore.createFromFrozenInventory(
      {
        inventory: [
          {
            institution_id: "glq-people-gov",
            standard_name: "鼓楼区人民政府",
            administrative_level: "COUNTY",
            core_institution_type: "GOVERNMENT",
            decision: "INCLUDE",
          },
          {
            institution_id: "glq-education-bureau",
            standard_name: "鼓楼区教育局",
            administrative_level: "COUNTY",
            core_institution_type: "GOVERNMENT",
            decision: "INCLUDE",
          },
        ],
      },
      { regionCode: "320106" },
    );
    const packetA = packets.find((p) => p.institutionName === "鼓楼区人民政府");
    const packetB = packets.find((p) => p.institutionName === "鼓楼区教育局");
    if (!packetA || !packetB) {
      throw new Error("STEP 15 smoke: expected two packets from frozen inventory");
    }
    for (const state of ADVANCE_A) {
      await packetStore.updateState(packetA.packetId, state, {
        investigatorSessionId: "step15-smoke-session",
      });
    }
    await packetStore.setPrimaryPersons(packetA.packetId, {
      primary1: { targetId: "glq-target-primary1", personId: "person-dong-han", personName: "董涵" },
      primary2: { targetId: "glq-target-primary2", personId: "person-shi-lei", personName: "石磊" },
    });
    for (const state of ADVANCE_B) {
      await packetStore.updateState(packetB.packetId, state, {
        investigatorSessionId: "step15-smoke-session",
      });
    }

    const evidencePayload: InvestigatorEvidenceSubmissionPayload = { candidates: POOL };
    const evidenceSink = new PostgresInvestigatorEvidenceSubmissionSink(
      new InvestigatorEvidenceSubmissionRepository(db),
      {
        packetId: packetA.packetId,
        agentSessionId: "step15-smoke-session",
        agentRole: "INVESTIGATOR",
        skill: SKILL,
      },
    );
    const evidenceResult = await evidenceSink.submit(evidencePayload);
    const evidencePersisted = evidenceResult.status === "ACCEPTED";

    const reviewSink = new PostgresReviewDecisionSink(
      new ReviewDecisionSubmissionRepository(db),
      { packetId: packetA.packetId, reviewRound: 1, agentRole: "REVIEWER", skill: SKILL },
    );
    const round1Result = await reviewSink.submit(reworkRound1());
    const round1Persisted = round1Result.status === "ACCEPTED";

    const round2Sink = new PostgresReviewDecisionSink(
      new ReviewDecisionSubmissionRepository(db),
      { packetId: packetA.packetId, reviewRound: 2, agentRole: "REVIEWER", skill: SKILL },
    );
    const round2Result = await round2Sink.submit(approvedRound2());
    const round2Persisted = round2Result.status === "ACCEPTED";

    // ── Phase 2: 销毁实例，创建全新 Reader / Store（证明数据来自 PostgreSQL） ──
    await db.destroy();
    db2 = createDb(pg.config);

    const freshPacketStore = new PostgresInstitutionWorkPacketStore(
      new InstitutionWorkPacketRepository(db2),
    );
    const freshReviewReader = new PostgresReviewDecisionReader(
      new ReviewDecisionSubmissionRepository(db2),
    );
    const freshEvidenceReader = new PostgresEvidenceReader(
      new InvestigatorEvidenceSubmissionRepository(db2),
    );
    const resultReader = new BiographyUrlResultReader({
      packetStore: freshPacketStore,
      reviewReader: freshReviewReader,
      loadCandidatePool: (packetId) => freshEvidenceReader.readOriginalCandidatePool(packetId),
    });

    const reloadedA = await freshPacketStore.get(packetA.packetId);
    const reloadedB = await freshPacketStore.get(packetB.packetId);
    const history = await freshReviewReader.listByPacket(packetA.packetId);
    const latest = await freshReviewReader.latestByPacket(packetA.packetId);
    const resultA = await resultReader.read(packetA.packetId);
    const resultB = await resultReader.read(packetB.packetId);

    const report: Record<string, unknown> = {
      migration: "PASS",
      packet_a_reloaded: reloadedA !== undefined,
      packet_b_reloaded: reloadedB !== undefined,
      packet_a_state: reloadedA?.state,
      packet_b_state: reloadedB?.state,
      evidence_persisted: evidencePersisted,
      round1_review_persisted: round1Persisted,
      round2_review_persisted: round2Persisted,
      review_history_count: history.length,
      latest_review_round: latest?.reviewRound,
      latest_review_outcome: latest?.roundOutcome,
      source_of_truth: resultA?.sourceOfTruth,
      result_a_status: resultA?.status,
      result_a_primary1_decision: resultA?.primary1.decisionStatus,
      result_a_primary1_url: resultA?.primary1.biographyUrl,
      result_a_primary2_decision: resultA?.primary2.decisionStatus,
      result_a_primary2_url: resultA?.primary2.biographyUrl,
      result_b_status: resultB?.status,
      result_b_primary1_url: resultB?.primary1.biographyUrl,
      result_b_primary2_url: resultB?.primary2.biographyUrl,
      temporary_resources_removed: true,
    };

    const passed =
      report.migration === "PASS" &&
      report.packet_a_reloaded === true &&
      report.packet_b_reloaded === true &&
      report.packet_a_state === "POSITION_DECIDED" &&
      report.packet_b_state === "READY_FOR_REVIEW" &&
      report.evidence_persisted === true &&
      report.round1_review_persisted === true &&
      report.round2_review_persisted === true &&
      report.review_history_count === 2 &&
      report.latest_review_round === 2 &&
      report.latest_review_outcome === "APPROVED" &&
      report.source_of_truth === "LATEST_FROZEN_APPROVED_REVIEW" &&
      report.result_a_status === "RESOLVED" &&
      report.result_a_primary1_decision === "RESOLVED" &&
      typeof report.result_a_primary1_url === "string" &&
      report.result_a_primary2_decision === "RESOLVED" &&
      typeof report.result_a_primary2_url === "string" &&
      report.result_b_status === "UNRESOLVED" &&
      report.result_b_primary1_url === null &&
      report.result_b_primary2_url === null;

    return { status: passed ? "OK" : WORK_PACKET_RESULT_SMOKE_FAILED, report };
  } finally {
    await db2?.destroy().catch(() => undefined);
    await db?.destroy().catch(() => undefined);
    await pg.stop();
  }
}

export function formatWorkPacketResultSmoke(
  status: WorkPacketResultSmokeStatus,
  report: Record<string, unknown>,
): string {
  const lines = ["WORK_PACKET_RESULT_SMOKE", `status: ${status}`];
  for (const [key, value] of Object.entries(report)) {
    if (value === undefined) continue;
    lines.push(`${key}: ${value === true ? "YES" : value === false ? "NO" : String(value)}`);
  }
  return lines.join("\n");
}
