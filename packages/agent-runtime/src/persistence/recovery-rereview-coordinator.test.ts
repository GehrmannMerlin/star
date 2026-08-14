import { describe, expect, it, vi } from "vitest";
import type { ReviewerDecisionSink, ReviewerSubmissionPayload } from "@stellaris/agent-tools";
import type { CompositeRehydrationInput } from "./composite-candidate-rehydration.js";
import type { CompositeCandidateViewRehydrator } from "./composite-candidate-rehydration.js";
import type { PostgresReviewSinkIdentity } from "./postgres-review-decision-sink.js";
import {
  RecoveryRereviewCoordinator,
  type RoundTwoReviewerRun,
  type RoundTwoSinkFactory,
} from "./recovery-rereview-coordinator.js";

const PACKET = "packet-rereview-1";

const LEADERSHIP = { structure_id: "ldr-gulou", institution_id: "glq-people-gov" };
const SELECTED = [
  { person_decision_id: "pd-1", target_id: "glq-target-primary1", primary_slot: "PRIMARY_1" },
  { person_decision_id: "pd-2", target_id: "glq-target-primary2", primary_slot: "PRIMARY_2" },
];

const CAND_P1 = {
  candidate_id: "cand-p1-dh",
  target_id: "glq-target-primary1",
  evidence_id: "evt-1",
  url: "http://www.njgl.gov.cn/xxgk/qczc/dh/",
  source_domain_class: "OFFICIAL_GOV_DOMAIN",
  page_shape_class: "OFFICIAL_CURRENT_LEADER_DETAIL",
  supports_person: true,
  supports_institution: true,
  supports_role: true,
  supports_currentness: true,
  candidate_status: "ACCEPTED_AS_FINAL",
  accept_or_reject_reason: "official leader profile",
  superseded_by_candidate_id: null,
};
const CAND_P2 = {
  candidate_id: "cand-p2-recovery",
  target_id: "glq-target-primary2",
  evidence_id: "evt-recovery-1",
  url: "http://www.njgl.gov.cn/xxgk/qczc/sl/",
  source_domain_class: "OFFICIAL_GOV_DOMAIN",
  page_shape_class: "OFFICIAL_CURRENT_LEADER_DETAIL",
  supports_person: true,
  supports_institution: true,
  supports_role: true,
  supports_currentness: true,
  candidate_status: "ACCEPTED_AS_FINAL",
  accept_or_reject_reason: "recovered official leader profile",
  superseded_by_candidate_id: null,
};

const REHYDRATION: CompositeRehydrationInput = {
  originalCandidatePool: [CAND_P1, CAND_P2],
  recoverySupplement: [CAND_P2],
  compositeCandidateView: [CAND_P1, CAND_P2],
  reviewHistory: [],
};

const COMPLETED_REVIEWER_RESULT = {
  status: "COMPLETED",
  packetId: PACKET,
  packetFinalState: "POSITION_DECIDED",
  frozen: true,
  agentSessionId: "round2-session",
  skill: { name: "official-biography-evidence", version: "3.1.0" },
  model: { provider: "deepseek", model: "deepseek-v4-flash" },
  toolCalls: [],
  receipt: {},
  reviews: [],
  finalDecisions: [],
  packet: { state: "POSITION_DECIDED" },
} as never;

const REWORK_REVIEWER_RESULT = {
  status: "RECOVERY_REQUIRED",
  packetId: PACKET,
  packetFinalState: "RECOVERY_REQUIRED",
  frozen: true,
  agentSessionId: "round2-session",
  skill: { name: "official-biography-evidence", version: "3.1.0" },
  model: { provider: "deepseek", model: "deepseek-v4-flash" },
  toolCalls: [],
  receipt: {},
  reviews: [],
  finalDecisions: [],
  packet: { state: "RECOVERY_REQUIRED" },
} as never;

function stubRehydrator(overrides: Partial<CompositeRehydrationInput> = {}): CompositeCandidateViewRehydrator {
  return {
    rehydrate: async () => ({ ...REHYDRATION, ...overrides }),
  } as unknown as CompositeCandidateViewRehydrator;
}

describe("RecoveryRereviewCoordinator (STEP 14)", () => {
  it("rehydrates the composite view and runs Round-2 with a round-2 sink + composite pool", async () => {
    let capturedSinkIdentity: PostgresReviewSinkIdentity | undefined;
    let capturedFrozenInput: unknown;
    let capturedSink: ReviewerDecisionSink | undefined;
    const createRoundTwoSink: RoundTwoSinkFactory = (identity) => {
      capturedSinkIdentity = identity;
      return { submit: vi.fn(), getSubmission: vi.fn(), isFrozen: vi.fn() } as never;
    };
    const runReviewer: RoundTwoReviewerRun = vi.fn(async ({ frozenInput, sink }) => {
      capturedFrozenInput = frozenInput;
      capturedSink = sink;
      return COMPLETED_REVIEWER_RESULT;
    }) as never;

    const coordinator = new RecoveryRereviewCoordinator({
      rehydrator: stubRehydrator(),
      frozenLeadership: LEADERSHIP,
      frozenSelectedOfficials: SELECTED,
      createRoundTwoSink,
      runReviewer,
    });

    const result = await coordinator.run(PACKET, {
      agentRole: "REVIEWER",
      skill: { name: "official-biography-evidence", version: "3.1.0" },
    });

    expect(capturedSinkIdentity).toEqual({
      packetId: PACKET,
      reviewRound: 2,
      agentRole: "REVIEWER",
      skill: { name: "official-biography-evidence", version: "3.1.0" },
    });
    expect(capturedSink).toBeDefined();
    const frozen = capturedFrozenInput as { candidatePool: unknown[]; leadership: unknown; selectedOfficials: unknown };
    expect(frozen.leadership).toEqual(LEADERSHIP);
    expect(frozen.selectedOfficials).toEqual(SELECTED);
    expect(frozen.candidatePool.map((c) => (c as { candidate_id: string }).candidate_id)).toEqual([
      "cand-p1-dh",
      "cand-p2-recovery",
    ]);
    expect(result.reviewerResult.status).toBe("COMPLETED");
    expect(result.rehydration.compositeCandidateView.map((c) => c.candidate_id)).toEqual([
      "cand-p1-dh",
      "cand-p2-recovery",
    ]);
  });

  it("returns a Round-2 REWORK_REQUIRED result and does not auto-start another recovery", async () => {
    const runReviewer = vi.fn(async () => REWORK_REVIEWER_RESULT) as never;
    const coordinator = new RecoveryRereviewCoordinator({
      rehydrator: stubRehydrator(),
      frozenLeadership: LEADERSHIP,
      frozenSelectedOfficials: SELECTED,
      createRoundTwoSink: (identity) => ({ identity } as never),
      runReviewer,
    });
    const result = await coordinator.run(PACKET, {
      agentRole: "REVIEWER",
      skill: { name: "official-biography-evidence", version: "3.1.0" },
    });
    expect(result.reviewerResult.status).toBe("RECOVERY_REQUIRED");
    // 恰好一次 Round-2 Reviewer 运行；无自动 Recovery Round 2。
    expect(runReviewer).toHaveBeenCalledTimes(1);
  });

  it("throws when runReviewer is missing wiring", async () => {
    const coordinator = new RecoveryRereviewCoordinator({
      rehydrator: stubRehydrator(),
      frozenLeadership: LEADERSHIP,
      frozenSelectedOfficials: SELECTED,
      createRoundTwoSink: (identity) => ({ identity } as never),
      runReviewer: undefined as never,
    });
    await expect(
      coordinator.run(PACKET, { agentRole: "REVIEWER", skill: { name: "x", version: "1" } }),
    ).rejects.toThrow();
  });
});
