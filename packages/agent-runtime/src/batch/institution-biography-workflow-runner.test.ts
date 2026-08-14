import { describe, expect, it } from "vitest";
import type {
  RecoverySubmissionPayload,
  ReviewerSubmissionPayload,
  UrlCandidatePoolRow,
} from "@stellaris/agent-tools";
import type { InvestigatorEvidenceResult } from "../evidence/evidence-types.js";
import type { InvestigationAgentResult } from "../investigation/investigation-types.js";
import { PostgresEvidenceReader } from "../persistence/evidence-reader.js";
import { PostgresInvestigatorEvidenceSubmissionSink } from "../persistence/postgres-investigator-evidence-sink.js";
import { PostgresRecoverySubmissionSink } from "../persistence/postgres-recovery-submission-sink.js";
import { PostgresReviewDecisionSink } from "../persistence/postgres-review-decision-sink.js";
import {
  FakeEvidenceRepo,
  FakePacketRepo,
  FakeRecoveryRepo,
  FakeReviewDecisionRepo,
} from "../persistence/persistence-test-support.js";
import { PostgresReviewDecisionReader } from "../persistence/review-decision-reader.js";
import { BiographyUrlResultReader } from "../results/biography-url-result.js";
import type { RecoveryResult } from "../recovery/recovery-types.js";
import type { ReviewerResult } from "../reviewer/reviewer-types.js";
import type { SkillRuntime } from "../skill/skill-runtime.js";
import {
  PostgresInstitutionWorkPacketStore,
  type InstitutionWorkPacket,
} from "../work-packet/institution-work-packet.js";
import {
  InstitutionBiographyWorkflowRunner,
  type InstitutionBiographyWorkflowPersistence,
  type InstitutionBiographyWorkflowRunnerDeps,
  type WorkflowStageRunners,
} from "./institution-biography-workflow-runner.js";

const SKILL = { name: "official-biography-evidence", version: "3.1.0" };

const P1_TARGET = "glq-target-primary1";
const P2_TARGET = "glq-target-primary2";
const P1_URL = "http://www.njgl.gov.cn/xxgk/qczc/dh/";
const P2_URL = "http://www.njgl.gov.cn/xxgk/qczc/sl/";
const P1_SUPPLEMENT_URL = "http://www.njgl.gov.cn/xxgk/qczc/dh-2/";

const SELECTED_OFFICIALS = [
  { target_id: P1_TARGET, person_id: "person-1", person_name: "张三", primary_slot: "PRIMARY_1" },
  { target_id: P2_TARGET, person_id: "person-2", person_name: "李四", primary_slot: "PRIMARY_2" },
];

const CHECKS = {
  person_and_institution: true,
  page_type: true,
  better_personal_page: true,
  news_or_function_page_rejected: true,
  currentness: true,
  all_discovered_evidence_consumed: true,
  empty_search_complete: true,
  dynamic_escalation_complete: true,
};

function poolRow(candidateId: string, targetId: string, url: string): UrlCandidatePoolRow {
  return {
    candidate_id: candidateId,
    target_id: targetId,
    evidence_id: `evt-${candidateId}`,
    url,
    source_domain_class: "OFFICIAL_GOV_DOMAIN",
    page_shape_class: "OFFICIAL_PERSON_PROFILE",
    supports_person: true,
    supports_institution: true,
    supports_role: true,
    supports_currentness: true,
    candidate_status: "ACCEPTED_AS_FINAL",
    accept_or_reject_reason: "official person profile",
    superseded_by_candidate_id: null,
  };
}

const ORIGINAL_POOL = [
  poolRow("cand-p1", P1_TARGET, P1_URL),
  poolRow("cand-p2", P2_TARGET, P2_URL),
];

function approvedReviewPayload(p1CandidateId: string, p2CandidateId: string): ReviewerSubmissionPayload {
  return {
    reviews: [
      {
        target_id: P1_TARGET,
        selected_candidate_id: p1CandidateId,
        review_result: "APPROVED",
        final_review_result: "APPROVED_STRICT_ADMISSIBLE",
        review_reason: "round approved p1",
        currentness_quality: "CURRENT_COLLECTION_MEMBER",
        checks: CHECKS,
      },
      {
        target_id: P2_TARGET,
        selected_candidate_id: p2CandidateId,
        review_result: "APPROVED",
        final_review_result: "APPROVED_STRICT_ADMISSIBLE",
        review_reason: "round approved p2",
        currentness_quality: "CURRENT_COLLECTION_MEMBER",
        checks: CHECKS,
      },
    ],
  };
}

function reworkReviewPayload(): ReviewerSubmissionPayload {
  return {
    reviews: [
      {
        target_id: P1_TARGET,
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

/** 测试持久化：真实 Postgres 语义 sink/reader 跑在 Fake repos 之上（无容器）。 */
function createTestPersistence(): {
  persistence: InstitutionBiographyWorkflowPersistence;
  packetRepo: FakePacketRepo;
  evidenceRepo: FakeEvidenceRepo;
  reviewRepo: FakeReviewDecisionRepo;
  recoveryRepo: FakeRecoveryRepo;
} {
  const packetRepo = new FakePacketRepo();
  const evidenceRepo = new FakeEvidenceRepo();
  const reviewRepo = new FakeReviewDecisionRepo();
  const recoveryRepo = new FakeRecoveryRepo();
  const persistence: InstitutionBiographyWorkflowPersistence = {
    packetStore: new PostgresInstitutionWorkPacketStore(packetRepo),
    createEvidenceSink: (identity) => new PostgresInvestigatorEvidenceSubmissionSink(evidenceRepo, identity),
    createReviewSink: (identity) => new PostgresReviewDecisionSink(reviewRepo, identity),
    createRecoverySink: (identity) => new PostgresRecoverySubmissionSink(recoveryRepo, identity),
    evidenceReader: new PostgresEvidenceReader(evidenceRepo),
    reviewReader: new PostgresReviewDecisionReader(reviewRepo),
    reviewRepo,
    recoveryRepo,
  };
  return { persistence, packetRepo, evidenceRepo, reviewRepo, recoveryRepo };
}

async function createPackets(
  packetStore: InstitutionBiographyWorkflowPersistence["packetStore"],
): Promise<InstitutionWorkPacket[]> {
  return packetStore.createFromFrozenInventory(
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
}

function makeDeps(
  persistence: InstitutionBiographyWorkflowPersistence,
  stages: WorkflowStageRunners,
): InstitutionBiographyWorkflowRunnerDeps {
  return {
    skillRuntime: {} as unknown as SkillRuntime,
    skill: SKILL,
    persistence,
    stages,
  };
}

async function completedInvestigation(input: {
  packetId: string;
  store: { get(packetId: string): InstitutionWorkPacket | undefined };
}): Promise<InvestigationAgentResult> {
  const packet = input.store.get(input.packetId)!;
  return {
    status: "COMPLETED",
    packetId: input.packetId,
    packet: { ...packet, state: "EVIDENCE_PENDING" },
    leadership: {
      structure_id: "ldr-test",
      institution_id: packet.institutionId,
      all_visible_leaders: [],
    },
    selectedOfficials: SELECTED_OFFICIALS,
    frozen: true,
    agentSessionId: `investigator-session-${input.packetId}`,
    skill: SKILL,
    model: { provider: "test", model: "test" },
    toolCalls: [],
    observationGate: { fetchOrRenderSucceeded: true, inspectSucceeded: true, passed: true },
    receipt: { frozen: true, leadershipValidated: true, selectedOfficialsValidated: true, primary1: "张三", primary2: "李四", primaryPeopleDistinct: true, payloadHash: "hash" },
  } as unknown as InvestigationAgentResult;
}

async function completedEvidence(input: {
  packetId: string;
  store: { get(packetId: string): InstitutionWorkPacket | undefined };
  sink: { submit(payload: { candidates: UrlCandidatePoolRow[] }): Promise<{ status: string }> };
}): Promise<InvestigatorEvidenceResult> {
  await input.sink.submit({ candidates: ORIGINAL_POOL });
  const packet = input.store.get(input.packetId)!;
  return {
    status: "COMPLETED",
    packetId: input.packetId,
    packet: { ...packet, state: "READY_FOR_REVIEW" },
    candidates: ORIGINAL_POOL,
    claims: [],
    frozen: true,
    agentSessionId: `evidence-session-${input.packetId}`,
    skill: SKILL,
    model: { provider: "test", model: "test" },
    toolCalls: [],
    provenance: { candidates: [], passed: true },
    receipt: {
      frozen: true,
      candidatesValidated: true,
      claimsValidated: true,
      primary1TargetId: P1_TARGET,
      primary2TargetId: P2_TARGET,
      primary1CandidateCount: 1,
      primary2CandidateCount: 1,
      allCandidatesOpened: true,
      allCandidatesInspected: true,
      payloadHash: "hash",
    },
  } as unknown as InvestigatorEvidenceResult;
}

async function completedReviewer(
  input: {
    packetId: string;
    store: { get(packetId: string): InstitutionWorkPacket | undefined };
    sink: { submit(payload: ReviewerSubmissionPayload): Promise<{ status: string }> };
  },
  payload: ReviewerSubmissionPayload,
): Promise<ReviewerResult> {
  await input.sink.submit(payload);
  const packet = input.store.get(input.packetId)!;
  return {
    status: "COMPLETED",
    packetId: input.packetId,
    packet: { ...packet, state: "POSITION_DECIDED" },
    packetFinalState: "POSITION_DECIDED",
    reviews: payload.reviews,
    finalDecisions: [],
    frozen: true,
    agentSessionId: `reviewer-session-${input.packetId}`,
    skill: SKILL,
    model: { provider: "test", model: "test" },
    toolCalls: [],
    receipt: {
      frozen: true,
      reviewsValidated: true,
      reviewCount: 2,
      approvedCount: 2,
      reworkCount: 0,
      primary1Outcome: "APPROVED",
      primary2Outcome: "APPROVED",
      primary1FinalUrl: P1_URL,
      primary2FinalUrl: P2_URL,
      observationGate: "PASS",
      independentSearch: true,
      payloadHash: "hash",
    },
  } as unknown as ReviewerResult;
}

async function reworkReviewer(input: {
  packetId: string;
  store: { get(packetId: string): InstitutionWorkPacket | undefined };
  sink: { submit(payload: ReviewerSubmissionPayload): Promise<{ status: string }> };
}): Promise<ReviewerResult> {
  const payload = reworkReviewPayload();
  await input.sink.submit(payload);
  const packet = input.store.get(input.packetId)!;
  return {
    status: "RECOVERY_REQUIRED",
    packetId: input.packetId,
    packet: { ...packet, state: "RECOVERY_REQUIRED" },
    packetFinalState: "RECOVERY_REQUIRED",
    reviews: payload.reviews,
    finalDecisions: [],
    frozen: true,
    agentSessionId: `reviewer-session-${input.packetId}`,
    skill: SKILL,
    model: { provider: "test", model: "test" },
    toolCalls: [],
    receipt: {
      frozen: true,
      reviewsValidated: true,
      reviewCount: 1,
      approvedCount: 0,
      reworkCount: 1,
      primary1Outcome: "REWORK_REQUIRED",
      primary2Outcome: "REWORK_REQUIRED",
      primary1FinalUrl: null,
      primary2FinalUrl: null,
      observationGate: "PASS",
      independentSearch: true,
      payloadHash: "hash",
    },
  } as unknown as ReviewerResult;
}

async function completedRecovery(input: {
  packetId: string;
  store: { get(packetId: string): InstitutionWorkPacket | undefined };
  sink: { submit(payload: RecoverySubmissionPayload): Promise<{ status: string }> };
}): Promise<RecoveryResult> {
  const supplement = [poolRow("cand-p1b", P1_TARGET, P1_SUPPLEMENT_URL)];
  const payload: RecoverySubmissionPayload = {
    candidates: supplement,
    supplements: [
      {
        target_id: P1_TARGET,
        outcome: "RECOVERED_QUALIFIED_URL",
        candidate_id: "cand-p1b",
        failure_codes: [],
        leader_section_checked: true,
        personal_entry_checked: true,
        currentness_conflict_resolved: true,
        remaining_empty_reason: null,
      },
    ],
  };
  await input.sink.submit(payload);
  const packet = input.store.get(input.packetId)!;
  return {
    status: "COMPLETED",
    packetId: input.packetId,
    packet: { ...packet, state: "READY_FOR_REVIEW" },
    packetFinalState: "READY_FOR_REVIEW",
    recoveryRecords: [],
    newCandidates: supplement,
    compositeCandidateView: [...ORIGINAL_POOL, ...supplement],
    originalCandidatePoolUnchanged: true,
    frozen: true,
    agentSessionId: `recovery-session-${input.packetId}`,
    skill: SKILL,
    model: { provider: "test", model: "test" },
    toolCalls: [],
    receipt: {
      frozen: true,
      supplementValidated: true,
      reviewRecordsValidated: true,
      supplementCount: 1,
      recoveredCount: 1,
      originalCandidatePoolUnchanged: true,
      compositeCandidateViewCount: 3,
      provenanceGate: "PASS",
      payloadHash: "hash",
    },
  } as unknown as RecoveryResult;
}

describe("InstitutionBiographyWorkflowRunner (real workflow composition)", () => {
  it("happy path: Investigator → Evidence → Reviewer APPROVED → RESOLVED", async () => {
    const { persistence } = createTestPersistence();
    const packets = await createPackets(persistence.packetStore);
    const stages: WorkflowStageRunners = {
      runInvestigator: completedInvestigation,
      runEvidence: completedEvidence,
      runReviewer: (input) => completedReviewer(input, approvedReviewPayload("cand-p1", "cand-p2")),
      runRecovery: completedRecovery,
    };
    const runner = new InstitutionBiographyWorkflowRunner(makeDeps(persistence, stages));

    const result = await runner.run(packets[0]!);
    expect(result.status).toBe("RESOLVED");
    expect(result.packetState).toBe("POSITION_DECIDED");
    expect(result.failure).toBeUndefined();
    expect(result.stages.investigation.status).toBe("COMPLETED");
    expect(result.stages.evidence.status).toBe("COMPLETED");
    expect(result.stages.review.status).toBe("COMPLETED");
    expect(result.stages.recovery).toBeUndefined();
    expect(result.biographyResult?.status).toBe("RESOLVED");
    expect(result.biographyResult?.primary1.biographyUrl).toBe(P1_URL);
    expect(result.biographyResult?.primary2.biographyUrl).toBe(P2_URL);
  });

  it("rework → Recovery → Re-review APPROVED → RESOLVED (round 2 source)", async () => {
    const { persistence } = createTestPersistence();
    const packets = await createPackets(persistence.packetStore);
    let reviewerCalls = 0;
    const stages: WorkflowStageRunners = {
      runInvestigator: completedInvestigation,
      runEvidence: completedEvidence,
      runReviewer: async (input) => {
        reviewerCalls += 1;
        // Round-1 → REWORK；Round-2（Recovery 后）→ APPROVED 选中 Recovery Supplement 候选。
        if (reviewerCalls === 2) {
          return completedReviewer(input, approvedReviewPayload("cand-p1b", "cand-p2"));
        }
        return reworkReviewer(input);
      },
      runRecovery: completedRecovery,
    };
    const runner = new InstitutionBiographyWorkflowRunner(makeDeps(persistence, stages));

    const result = await runner.run(packets[0]!);
    expect(result.status).toBe("RESOLVED");
    expect(result.packetState).toBe("POSITION_DECIDED");
    expect(result.stages.review.status).toBe("RECOVERY_REQUIRED");
    expect(result.stages.recovery?.status).toBe("COMPLETED");
    expect(result.stages.rereview?.status).toBe("COMPLETED");
    // Round-2 APPROVED 选中 Recovery Supplement 候选 → URL 仍从 latest APPROVED review 解析。
    expect(result.biographyResult?.status).toBe("RESOLVED");
    expect(result.biographyResult?.primary1.biographyUrl).toBe(P1_SUPPLEMENT_URL);
    expect(result.biographyResult?.primary2.biographyUrl).toBe(P2_URL);
  });

  it("investigator fails → workflow FAILED, packet not faked as resolved", async () => {
    const { persistence } = createTestPersistence();
    const packets = await createPackets(persistence.packetStore);
    const stages: WorkflowStageRunners = {
      runInvestigator: async ({ packetId, store }) => {
        const packet = store.get(packetId)!;
        return {
          status: "FAILED",
          packetId,
          packet: { ...packet, state: "FAILED" },
          failureCode: "INVESTIGATION_NOT_SUBMITTED",
          agentSessionId: "investigator-session-fail",
          toolCalls: [],
        } as unknown as InvestigationAgentResult;
      },
      runEvidence: completedEvidence,
      runReviewer: (input) => completedReviewer(input, approvedReviewPayload("cand-p1", "cand-p2")),
      runRecovery: completedRecovery,
    };
    const runner = new InstitutionBiographyWorkflowRunner(makeDeps(persistence, stages));

    const result = await runner.run(packets[0]!);
    expect(result.status).toBe("FAILED");
    expect(result.failure?.stage).toBe("investigation");
    expect(result.stages.investigation.status).toBe("FAILED");
    expect(result.stages.evidence.status).toBe("SKIPPED");
    expect(result.biographyResult).toBeNull();
    expect(await persistence.packetStore.get(packets[0]!.packetId)).toMatchObject({ state: "FAILED" });
  });

  it("two packets run in isolated sessions with isolated persisted identity", async () => {
    const { persistence } = createTestPersistence();
    const packets = await createPackets(persistence.packetStore);
    const stages: WorkflowStageRunners = {
      runInvestigator: completedInvestigation,
      runEvidence: completedEvidence,
      runReviewer: (input) => completedReviewer(input, approvedReviewPayload("cand-p1", "cand-p2")),
      runRecovery: completedRecovery,
    };
    const runner = new InstitutionBiographyWorkflowRunner(makeDeps(persistence, stages));

    const a = await runner.run(packets[0]!);
    const b = await runner.run(packets[1]!);
    expect(a.status).toBe("RESOLVED");
    expect(b.status).toBe("RESOLVED");
    expect(a.stages.investigation.agentSessionId).not.toBe(b.stages.investigation.agentSessionId);
    expect(a.stages.evidence.agentSessionId).not.toBe(b.stages.evidence.agentSessionId);
    expect(a.stages.review.agentSessionId).not.toBe(b.stages.review.agentSessionId);
  });

  it("result survives fresh Reader instances over the same persisted data", async () => {
    const { persistence, packetRepo, evidenceRepo, reviewRepo } = createTestPersistence();
    const packets = await createPackets(persistence.packetStore);
    const stages: WorkflowStageRunners = {
      runInvestigator: completedInvestigation,
      runEvidence: completedEvidence,
      runReviewer: (input) => completedReviewer(input, approvedReviewPayload("cand-p1", "cand-p2")),
      runRecovery: completedRecovery,
    };
    const runner = new InstitutionBiographyWorkflowRunner(makeDeps(persistence, stages));
    const before = await runner.run(packets[0]!);
    expect(before.status).toBe("RESOLVED");

    // 销毁 batch 实例，创建全新 Reader / Store 包装（同一底层 Fake 数据 = 同一 DB 表）。
    const freshReader = new BiographyUrlResultReader({
      packetStore: new PostgresInstitutionWorkPacketStore(packetRepo),
      reviewReader: new PostgresReviewDecisionReader(reviewRepo),
      loadCandidatePool: async (packetId) =>
        new PostgresEvidenceReader(evidenceRepo).readOriginalCandidatePool(packetId),
    });
    const after = await freshReader.read(packets[0]!.packetId);
    expect(after?.status).toBe("RESOLVED");
    expect(after?.primary1.biographyUrl).toBe(P1_URL);
    expect(after?.primary2.biographyUrl).toBe(P2_URL);
    expect(await persistence.packetStore.get(packets[0]!.packetId)).toMatchObject({
      state: "POSITION_DECIDED",
    });
  });
});
