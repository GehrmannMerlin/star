import { describe, expect, it } from "vitest";
import type { ResourceLoader } from "@earendil-works/pi-coding-agent";
import {
  MemoryToolEventSink,
  type InvestigationSubmissionValidator,
  type InvestigatorEvidenceSubmissionValidator,
  type RecoverySubmissionPayload,
  type RecoverySubmissionValidator,
  type ReviewerSubmissionValidator,
  type UrlCandidatePoolRow,
} from "@stellaris/agent-tools";
import { ModelPolicy } from "../model/model-policy.js";
import { PiModelResolver } from "../model/pi-model-resolver.js";
import type { SkillIdentity } from "../skill/skill-identity.js";
import type { SkillRuntime } from "../skill/skill-runtime.js";
import { InMemoryInstitutionWorkPacketStore } from "../work-packet/institution-work-packet.js";
import { InMemoryRecoverySubmissionSink } from "./recovery-submission-sink.js";
import { RecoveryAgentRunner } from "./recovery-agent-runner.js";

const stubLoader = {
  reload: async () => {},
  getSkills: () => ({ skills: [], diagnostics: [] }),
  getExtensions: () => ({ extensions: [] }),
  getPrompts: () => ({ prompts: [], diagnostics: [] }),
  getThemes: () => ({ themes: [], diagnostics: [] }),
  getAgentsFiles: () => ({ agentsFiles: [] }),
  getSystemPrompt: () => undefined,
  getSystemPromptSource: () => undefined,
  getAppendSystemPrompt: () => [],
  getAppendSystemPromptSources: () => [],
  extendResources: () => {},
} as unknown as ResourceLoader;

const identity: SkillIdentity = {
  name: "official-biography-evidence",
  id: "official-biography-evidence",
  version: "3.1.0",
  path: "/skills/official-biography-evidence",
  skmdPath: "/skills/official-biography-evidence/SKILL.md",
  yamlPath: "/skills/official-biography-evidence/skill.yaml",
};

const stubSkillRuntime = {
  reload: async () => {},
  resolveSkill: async () => identity,
  getResourceLoader: () => stubLoader,
} as unknown as SkillRuntime;

const stubRecoveryValidator: RecoverySubmissionValidator = {
  validate: () => ({ valid: true }),
};
const stubReviewValidator: ReviewerSubmissionValidator = {
  validate: () => ({ valid: true }),
};
const stubInvestigationValidator: InvestigationSubmissionValidator = {
  validate: () => ({ valid: true }),
};
const stubEvidenceValidator: InvestigatorEvidenceSubmissionValidator = {
  validate: () => ({ valid: true }),
};

const URL_1 = "http://www.njgl.gov.cn/xxgk/qczc/dh/";
const URL_2 = "http://www.njgl.gov.cn/xxgk/qczc/sl/";
const NEW_URL = "http://www.njgl.gov.cn/xxgk/qczc/sl/detail.html";

const LEADERSHIP = {
  structure_id: "ldr-gulou",
  institution_id: "glq-people-gov",
  all_visible_leaders: [
    { person_name: "董涵", visible_roles: ["区委副书记", "区长"] },
    { person_name: "石磊", visible_roles: ["区委常委", "副区长"] },
  ],
  official_order: ["董涵", "石磊"],
  party_head: null,
  administrative_head: "董涵",
  party_deputy_secretaries: ["董涵"],
  executive_deputies: ["董涵"],
  other_deputies: ["石磊"],
  vacancy_information: [],
  supporting_evidence_ids: ["evt-1"],
  structure_complete: true,
  investigator_agent_id: "agent-1",
  investigator_context_id: "ctx-1",
  decided_at: "2026-08-14T00:00:00.000Z",
};

const PRIMARY_1 = {
  person_decision_id: "pd-1",
  person_id: "person-dong",
  target_id: "glq-target-primary1",
  institution_id: "glq-people-gov",
  primary_slot: "PRIMARY_1",
  leadership_structure_id: "ldr-gulou",
  person_status: "PERSON_CONFIRMED",
  person_name: "董涵",
  role_canonical: "区长",
  selection_basis: "administrative head",
  rank_information: null,
  responsibility_description: null,
  currentness_quality: "CURRENT_COLLECTION_MEMBER",
  supporting_evidence_ids: ["evt-1"],
  investigator_agent_id: "agent-1",
  investigator_context_id: "ctx-1",
  decided_at: "2026-08-14T00:00:00.000Z",
};
const PRIMARY_2 = {
  ...PRIMARY_1,
  person_decision_id: "pd-2",
  person_id: "person-shi",
  target_id: "glq-target-primary2",
  primary_slot: "PRIMARY_2",
  person_name: "石磊",
  role_canonical: "副区长",
};

function candidate(id: string, targetId: string, url: string): UrlCandidatePoolRow {
  return {
    candidate_id: id,
    target_id: targetId,
    evidence_id: "evt-1",
    url,
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
}

const ORIGINAL_POOL = [
  candidate("cand-p1", "glq-target-primary1", URL_1),
  candidate("cand-p2", "glq-target-primary2", URL_2),
];

const REVIEW_RECORDS = [
  {
    review_id: "review-1",
    target_id: "glq-target-primary1",
    review_result: "APPROVED",
  },
  {
    review_id: "review-2",
    target_id: "glq-target-primary2",
    review_result: "REWORK_REQUIRED",
  },
];

const FROZEN_INPUT = {
  leadership: LEADERSHIP,
  selectedOfficials: [PRIMARY_1, PRIMARY_2],
  candidatePool: ORIGINAL_POOL,
  reviewRecords: REVIEW_RECORDS,
};

function fakeSession(prompt: (promptText: string) => Promise<void>) {
  return {
    sessionManager: { getSessionId: () => "session-recovery-test" },
    prompt,
  };
}

function successEvent(toolName: string, data: Record<string, unknown> = {}) {
  const now = new Date().toISOString();
  return {
    callId: `call-${toolName}-${String(data.url ?? "x")}`,
    toolName,
    status: "SUCCESS" as const,
    data,
    startedAt: now,
    finishedAt: now,
  };
}

function freshRecoveryPacket() {
  const store = new InMemoryInstitutionWorkPacketStore();
  const packets = store.createFromFrozenInventory(
    {
      inventory: [
        {
          institution_id: "glq-people-gov",
          standard_name: "鼓楼区人民政府",
          administrative_level: "COUNTY",
          decision: "INCLUDE",
        },
      ],
    } as never,
    { regionCode: "320106" },
  );
  const packet = packets[0];
  if (!packet) throw new Error("test setup: expected an INCLUDE packet");
  store.updateState(packet.packetId, "INVESTIGATING", { investigatorSessionId: "step9-session" });
  store.updateState(packet.packetId, "EVIDENCE_PENDING");
  store.updateState(packet.packetId, "EVIDENCE_GATHERING");
  store.updateState(packet.packetId, "READY_FOR_REVIEW");
  store.updateState(packet.packetId, "REVIEWING", { investigatorSessionId: "reviewer-session" });
  store.updateState(packet.packetId, "RECOVERY_REQUIRED");
  return { store, packetId: packet.packetId };
}

function recoveredSubmission(): RecoverySubmissionPayload {
  return {
    candidates: [candidate("cand-new-p2", "glq-target-primary2", NEW_URL)],
    supplements: [
      {
        target_id: "glq-target-primary2",
        outcome: "RECOVERED_QUALIFIED_URL",
        candidate_id: "cand-new-p2",
        failure_codes: [],
        leader_section_checked: true,
        personal_entry_checked: true,
        currentness_conflict_resolved: true,
        remaining_empty_reason: null,
      },
    ],
  };
}

function pushObservationEvents(eventSink: MemoryToolEventSink, urls: string[]): void {
  for (const url of urls) {
    eventSink.successes.push(successEvent("fetch_page", { requestedUrl: url, finalUrl: url }));
    eventSink.successes.push(successEvent("inspect_page", { url }));
  }
  eventSink.successes.push(successEvent("search_web", { provider: "bocha", results: [] }));
}

describe("RecoveryAgentRunner", () => {
  it("fails with RECOVERY_NOT_SUBMITTED when the session never submits", async () => {
    const { store, packetId } = freshRecoveryPacket();
    const runner = new RecoveryAgentRunner({
      skillRuntime: stubSkillRuntime,
      packetStore: store,
      modelPolicy: new ModelPolicy(() => ({ provider: "deepseek", model: "deepseek-v4-pro" })),
      modelResolver: await PiModelResolver.create(),
      sink: new InMemoryRecoverySubmissionSink(),
      recoveryValidator: stubRecoveryValidator,
      reviewValidator: stubReviewValidator,
      investigationValidator: stubInvestigationValidator,
      evidenceValidator: stubEvidenceValidator,
      createSession: async () => ({
        session: fakeSession(async () => {}) as never,
        extensionsResult: {} as never,
      }),
    });
    const result = await runner.run({ packetId, frozenInput: FROZEN_INPUT });
    expect(result.status).toBe("FAILED");
    if (result.status !== "FAILED") return;
    expect(result.failureCode).toBe("RECOVERY_NOT_SUBMITTED");
    expect(result.packet.state).toBe("FAILED");
    expect(store.get(packetId)?.state).toBe("FAILED");
  });

  it("completes with READY_FOR_REVIEW for a valid frozen recovery submission", async () => {
    const { store, packetId } = freshRecoveryPacket();
    const sink = new InMemoryRecoverySubmissionSink();
    const eventSink = new MemoryToolEventSink();
    const runner = new RecoveryAgentRunner({
      skillRuntime: stubSkillRuntime,
      packetStore: store,
      modelPolicy: new ModelPolicy(() => ({ provider: "deepseek", model: "deepseek-v4-pro" })),
      modelResolver: await PiModelResolver.create(),
      sink,
      recoveryValidator: stubRecoveryValidator,
      reviewValidator: stubReviewValidator,
      investigationValidator: stubInvestigationValidator,
      evidenceValidator: stubEvidenceValidator,
      eventSink,
      createSession: async () => ({
        session: fakeSession(async () => {
          pushObservationEvents(eventSink, [NEW_URL]);
          await sink.submit(recoveredSubmission());
        }) as never,
        extensionsResult: {} as never,
      }),
    });
    const result = await runner.run({ packetId, frozenInput: FROZEN_INPUT });
    expect(result.status).toBe("COMPLETED");
    if (result.status !== "COMPLETED") return;
    expect(result.packetFinalState).toBe("READY_FOR_REVIEW");
    expect(result.packet.state).toBe("READY_FOR_REVIEW");
    expect(result.frozen).toBe(true);
    expect(result.originalCandidatePoolUnchanged).toBe(true);
    expect(result.newCandidates).toHaveLength(1);
    expect(result.recoveryRecords).toHaveLength(1);
    expect(result.compositeCandidateView).toHaveLength(3);
    expect(result.compositeCandidateView.some((c) => c.candidate_id === "cand-new-p2")).toBe(true);
    expect(result.receipt.provenanceGate).toBe("PASS");
    expect(result.skill).toEqual({ name: "official-biography-evidence", version: "3.1.0" });
    expect(store.get(packetId)?.state).toBe("READY_FOR_REVIEW");
  });

  it("returns PACKET_NOT_ELIGIBLE when the packet is not RECOVERY_REQUIRED", async () => {
    const store = new InMemoryInstitutionWorkPacketStore();
    const packets = store.createFromFrozenInventory(
      {
        inventory: [
          {
            institution_id: "glq-people-gov",
            standard_name: "鼓楼区人民政府",
            administrative_level: "COUNTY",
            decision: "INCLUDE",
          },
        ],
      } as never,
      { regionCode: "320106" },
    );
    const packet = packets[0];
    if (!packet) throw new Error("test setup: expected an INCLUDE packet");
    // Leave the packet at READY_FOR_REVIEW (never reached RECOVERY_REQUIRED).
    const packetId = packet.packetId;
    store.updateState(packetId, "INVESTIGATING", { investigatorSessionId: "step9-session" });
    store.updateState(packetId, "EVIDENCE_PENDING");
    store.updateState(packetId, "EVIDENCE_GATHERING");
    store.updateState(packetId, "READY_FOR_REVIEW");
    const runner = new RecoveryAgentRunner({
      skillRuntime: stubSkillRuntime,
      packetStore: store,
      modelPolicy: new ModelPolicy(() => ({ provider: "deepseek", model: "deepseek-v4-pro" })),
      modelResolver: await PiModelResolver.create(),
      sink: new InMemoryRecoverySubmissionSink(),
      recoveryValidator: stubRecoveryValidator,
      reviewValidator: stubReviewValidator,
      investigationValidator: stubInvestigationValidator,
      evidenceValidator: stubEvidenceValidator,
    });
    const result = await runner.run({ packetId, frozenInput: FROZEN_INPUT });
    expect(result.status).toBe("PACKET_NOT_ELIGIBLE");
  });

  it("fails closed on non-canonical frozen review records", async () => {
    const { store, packetId } = freshRecoveryPacket();
    const sink = new InMemoryRecoverySubmissionSink();
    const runner = new RecoveryAgentRunner({
      skillRuntime: stubSkillRuntime,
      packetStore: store,
      modelPolicy: new ModelPolicy(() => ({ provider: "deepseek", model: "deepseek-v4-pro" })),
      modelResolver: await PiModelResolver.create(),
      sink,
      recoveryValidator: stubRecoveryValidator,
      reviewValidator: {
        validate: () => ({ valid: false, errors: ["review[0]: missing review_reason"] }),
      },
      investigationValidator: stubInvestigationValidator,
      evidenceValidator: stubEvidenceValidator,
      createSession: async () => ({
        session: fakeSession(async () => {}) as never,
        extensionsResult: {} as never,
      }),
    });
    const result = await runner.run({ packetId, frozenInput: FROZEN_INPUT });
    expect(result.status).toBe("INVALID_REQUEST");
  });
});
