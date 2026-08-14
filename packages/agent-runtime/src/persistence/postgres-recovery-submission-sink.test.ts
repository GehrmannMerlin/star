import { describe, expect, it } from "vitest";
import type { RecoverySubmissionPayload } from "@stellaris/agent-tools";
import { FakeRecoveryRepo } from "./persistence-test-support.js";
import {
  PostgresRecoverySubmissionSink,
  recoveryRoundOutcome,
  type PostgresRecoverySinkIdentity,
} from "./postgres-recovery-submission-sink.js";
import { PostgresRecoveryReader } from "./recovery-reader.js";

const PACKET = "packet-rereview-1";
const IDENTITY: PostgresRecoverySinkIdentity = {
  packetId: PACKET,
  recoveryRound: 1,
  agentRole: "RECOVERY",
  skill: { name: "official-biography-evidence", version: "3.1.0" },
};

function recoveredPayload(): RecoverySubmissionPayload {
  return {
    candidates: [
      {
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
        accept_or_reject_reason: "recovered official district leader profile for PRIMARY_2",
        superseded_by_candidate_id: null,
      },
    ],
    supplements: [
      {
        target_id: "glq-target-primary2",
        outcome: "RECOVERED_QUALIFIED_URL",
        candidate_id: "cand-p2-recovery",
        failure_codes: [],
        leader_section_checked: true,
        personal_entry_checked: true,
        currentness_conflict_resolved: true,
        remaining_empty_reason: null,
      },
    ],
  };
}

function notRecoveredPayload(): RecoverySubmissionPayload {
  return {
    candidates: [],
    supplements: [
      {
        target_id: "glq-target-primary2",
        outcome: "NO_QUALIFIED_URL_AFTER_COMPLETE_SEARCH",
        candidate_id: null,
        failure_codes: ["WAF_BLOCKED"],
        leader_section_checked: true,
        personal_entry_checked: true,
        currentness_conflict_resolved: false,
        remaining_empty_reason: "官方当前个人页未公开，受 WAF 限制",
      },
    ],
  };
}

describe("PostgresRecoverySubmissionSink (STEP 14)", () => {
  it("accepts a round-1 supplement and persists a RECOVERED round outcome", async () => {
    const repo = new FakeRecoveryRepo();
    const sink = new PostgresRecoverySubmissionSink(repo, IDENTITY);
    const result = await sink.submit(recoveredPayload());
    expect(result.status).toBe("ACCEPTED");
    expect(repo.rows).toHaveLength(1);
    expect(repo.rows[0]?.round_outcome).toBe("RECOVERED");
    expect(await sink.isFrozen()).toBe(true);
    const submission = await sink.getSubmission();
    expect(submission?.candidates).toHaveLength(1);
  });

  it("rejects a duplicate submit for the same packet + same recovery round", async () => {
    const repo = new FakeRecoveryRepo();
    const sink = new PostgresRecoverySubmissionSink(repo, IDENTITY);
    await sink.submit(recoveredPayload());
    const duplicate = await sink.submit(recoveredPayload());
    expect(duplicate.status).toBe("ALREADY_SUBMITTED");
    expect(repo.rows).toHaveLength(1);
  });

  it("keeps recovery round 1 immutable when a round 2 is appended", async () => {
    const repo = new FakeRecoveryRepo();
    await new PostgresRecoverySubmissionSink(repo, { ...IDENTITY, recoveryRound: 1 }).submit(
      recoveredPayload(),
    );
    await new PostgresRecoverySubmissionSink(repo, { ...IDENTITY, recoveryRound: 2 }).submit(
      notRecoveredPayload(),
    );
    expect(repo.rows).toHaveLength(2);
    const round1 = new PostgresRecoverySubmissionSink(repo, { ...IDENTITY, recoveryRound: 1 });
    expect((await round1.getSubmission())?.candidates).toHaveLength(1);
  });

  it("derives recovery round outcomes deterministically", () => {
    expect(recoveryRoundOutcome(recoveredPayload())).toBe("RECOVERED");
    expect(recoveryRoundOutcome(notRecoveredPayload())).toBe("NO_QUALIFIED_URL");
    expect(
      recoveryRoundOutcome({
        candidates: [],
        supplements: [
          {
            target_id: "glq-target-primary2",
            outcome: "PERSON_OR_ROLE_NEEDS_RECHECK",
            candidate_id: null,
            failure_codes: [],
            leader_section_checked: true,
            personal_entry_checked: true,
            currentness_conflict_resolved: false,
            remaining_empty_reason: null,
          },
        ],
      }),
    ).toBe("NEEDS_RECHECK");
  });
});

describe("PostgresRecoveryReader (STEP 14)", () => {
  it("reads the latest supplement candidates for rehydration", async () => {
    const repo = new FakeRecoveryRepo();
    await new PostgresRecoverySubmissionSink(repo, { ...IDENTITY, recoveryRound: 1 }).submit(
      recoveredPayload(),
    );
    const reader = new PostgresRecoveryReader(repo);
    const candidates = await reader.latestSupplementCandidates(PACKET);
    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.url).toBe("http://www.njgl.gov.cn/xxgk/qczc/sl/");
    const history = await reader.listByPacket(PACKET);
    expect(history).toHaveLength(1);
    expect(history[0]?.recoveryRound).toBe(1);
  });
});
