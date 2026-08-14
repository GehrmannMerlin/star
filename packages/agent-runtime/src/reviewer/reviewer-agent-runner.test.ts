import { describe, expect, it } from "vitest";
import type { ResourceLoader } from "@earendil-works/pi-coding-agent";
import {
  MemoryToolEventSink,
  type InvestigationSubmissionValidator,
  type InvestigatorEvidenceSubmissionValidator,
  type ReviewerSubmissionPayload,
  type ReviewerSubmissionValidator,
} from "@stellaris/agent-tools";
import { ModelPolicy } from "../model/model-policy.js";
import { PiModelResolver } from "../model/pi-model-resolver.js";
import type { SkillIdentity } from "../skill/skill-identity.js";
import type { SkillRuntime } from "../skill/skill-runtime.js";
import { InMemoryInstitutionWorkPacketStore } from "../work-packet/institution-work-packet.js";
import { InMemoryReviewDecisionSink } from "./review-decision-sink.js";
import { ReviewerAgentRunner } from "./reviewer-agent-runner.js";

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

const stubReviewValidator: ReviewerSubmissionValidator = {
  validate: () => ({ valid: true }),
};
const stubInvestigationValidator: InvestigationSubmissionValidator = {
  validate: () => ({ valid: true }),
};
const stubEvidenceValidator: InvestigatorEvidenceSubmissionValidator = {
  validate: () => ({ valid: true }),
};

const URL_A = "http://www.njgl.gov.cn/xxgk/qczc/dh/";
const URL_B = "http://www.njgl.gov.cn/xxgk/qczc/sl/";

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
const PRIMARY_2 = { ...PRIMARY_1, person_decision_id: "pd-2", person_id: "person-shi", target_id: "glq-target-primary2", primary_slot: "PRIMARY_2", person_name: "石磊", role_canonical: "副区长" };

const FROZEN_INPUT = {
  leadership: LEADERSHIP,
  selectedOfficials: [PRIMARY_1, PRIMARY_2],
  candidatePool: [
    { candidate_id: "cand-p1", target_id: "glq-target-primary1", evidence_id: "evt-1", url: URL_A, source_domain_class: "OFFICIAL_GOV_DOMAIN", page_shape_class: "OFFICIAL_CURRENT_LEADER_DETAIL", supports_person: true, supports_institution: true, supports_role: true, supports_currentness: true, candidate_status: "ACCEPTED_AS_FINAL", accept_or_reject_reason: "official leader profile", superseded_by_candidate_id: null },
    { candidate_id: "cand-p2", target_id: "glq-target-primary2", evidence_id: "evt-1", url: URL_B, source_domain_class: "OFFICIAL_GOV_DOMAIN", page_shape_class: "OFFICIAL_CURRENT_LEADER_DETAIL", supports_person: true, supports_institution: true, supports_role: true, supports_currentness: true, candidate_status: "ACCEPTED_AS_FINAL", accept_or_reject_reason: "official leader profile", superseded_by_candidate_id: null },
  ],
};

function fakeSession(prompt: (promptText: string) => Promise<void>) {
  return {
    sessionManager: { getSessionId: () => "session-reviewer-test" },
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

function freshPacket() {
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
  return { store, packetId: packet.packetId };
}

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

function approvedReviews(): ReviewerSubmissionPayload {
  return {
    reviews: [
      { target_id: "glq-target-primary1", selected_candidate_id: "cand-p1", review_result: "APPROVED", final_review_result: "APPROVED_STRICT_ADMISSIBLE", review_reason: "verified official page", currentness_quality: "CURRENT_COLLECTION_MEMBER", checks: CHECKS },
      { target_id: "glq-target-primary2", selected_candidate_id: "cand-p2", review_result: "APPROVED", final_review_result: "APPROVED_STRICT_ADMISSIBLE", review_reason: "verified official page", currentness_quality: "CURRENT_COLLECTION_MEMBER", checks: CHECKS },
    ],
  };
}

function recoveryReviews(): ReviewerSubmissionPayload {
  return {
    reviews: [
      { target_id: "glq-target-primary1", selected_candidate_id: "cand-p1", review_result: "APPROVED", final_review_result: "APPROVED_STRICT_ADMISSIBLE", review_reason: "verified official page", currentness_quality: "CURRENT_COLLECTION_MEMBER", checks: CHECKS },
      { target_id: "glq-target-primary2", selected_candidate_id: null, review_result: "REWORK_REQUIRED", final_review_result: "REWORK_REQUIRED", review_reason: "frozen pool insufficient for PRIMARY_2", currentness_quality: "CURRENTNESS_UNRESOLVED", checks: CHECKS },
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

describe("ReviewerAgentRunner", () => {
  it("fails with REVIEW_NOT_SUBMITTED when the session never submits", async () => {
    const { store, packetId } = freshPacket();
    const runner = new ReviewerAgentRunner({
      skillRuntime: stubSkillRuntime,
      packetStore: store,
      modelPolicy: new ModelPolicy(() => ({ provider: "deepseek", model: "deepseek-v4-pro" })),
      modelResolver: await PiModelResolver.create(),
      sink: new InMemoryReviewDecisionSink(),
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
    expect(result.failureCode).toBe("REVIEW_NOT_SUBMITTED");
    expect(result.packet.state).toBe("FAILED");
    expect(store.get(packetId)?.state).toBe("FAILED");
  });

  it("fails with REVIEW_OBSERVATION_REQUIRED when approved candidates have no reviewer open+inspect events", async () => {
    const { store, packetId } = freshPacket();
    const sink = new InMemoryReviewDecisionSink();
    const eventSink = new MemoryToolEventSink();
    const runner = new ReviewerAgentRunner({
      skillRuntime: stubSkillRuntime,
      packetStore: store,
      modelPolicy: new ModelPolicy(() => ({ provider: "deepseek", model: "deepseek-v4-pro" })),
      modelResolver: await PiModelResolver.create(),
      sink,
      reviewValidator: stubReviewValidator,
      investigationValidator: stubInvestigationValidator,
      evidenceValidator: stubEvidenceValidator,
      eventSink,
      createSession: async () => ({
        session: fakeSession(async () => {
          await sink.submit(approvedReviews());
        }) as never,
        extensionsResult: {} as never,
      }),
    });
    const result = await runner.run({ packetId, frozenInput: FROZEN_INPUT });
    expect(result.status).toBe("FAILED");
    if (result.status !== "FAILED") return;
    expect(result.failureCode).toBe("REVIEW_OBSERVATION_REQUIRED");
  });

  it("completes with POSITION_DECIDED for a valid frozen review", async () => {
    const { store, packetId } = freshPacket();
    const sink = new InMemoryReviewDecisionSink();
    const eventSink = new MemoryToolEventSink();
    const runner = new ReviewerAgentRunner({
      skillRuntime: stubSkillRuntime,
      packetStore: store,
      modelPolicy: new ModelPolicy(() => ({ provider: "deepseek", model: "deepseek-v4-pro" })),
      modelResolver: await PiModelResolver.create(),
      sink,
      reviewValidator: stubReviewValidator,
      investigationValidator: stubInvestigationValidator,
      evidenceValidator: stubEvidenceValidator,
      eventSink,
      createSession: async () => ({
        session: fakeSession(async () => {
          pushObservationEvents(eventSink, [URL_A, URL_B]);
          await sink.submit(approvedReviews());
        }) as never,
        extensionsResult: {} as never,
      }),
    });
    const result = await runner.run({ packetId, frozenInput: FROZEN_INPUT });
    expect(result.status).toBe("COMPLETED");
    if (result.status !== "COMPLETED") return;
    expect(result.packet.state).toBe("POSITION_DECIDED");
    expect(result.packetFinalState).toBe("POSITION_DECIDED");
    expect(result.frozen).toBe(true);
    expect(result.finalDecisions).toHaveLength(2);
    expect(result.receipt.primary1Outcome).toBe("APPROVED");
    expect(result.receipt.primary2Outcome).toBe("APPROVED");
    expect(result.receipt.observationGate).toBe("PASS");
    expect(result.receipt.independentSearch).toBe(true);
    expect(result.skill).toEqual({ name: "official-biography-evidence", version: "3.1.0" });
    expect(store.get(packetId)?.state).toBe("POSITION_DECIDED");
  });

  it("maps a recovery submission to RECOVERY_REQUIRED", async () => {
    const { store, packetId } = freshPacket();
    const sink = new InMemoryReviewDecisionSink();
    const eventSink = new MemoryToolEventSink();
    const runner = new ReviewerAgentRunner({
      skillRuntime: stubSkillRuntime,
      packetStore: store,
      modelPolicy: new ModelPolicy(() => ({ provider: "deepseek", model: "deepseek-v4-pro" })),
      modelResolver: await PiModelResolver.create(),
      sink,
      reviewValidator: stubReviewValidator,
      investigationValidator: stubInvestigationValidator,
      evidenceValidator: stubEvidenceValidator,
      eventSink,
      createSession: async () => ({
        session: fakeSession(async () => {
          pushObservationEvents(eventSink, [URL_A]);
          await sink.submit(recoveryReviews());
        }) as never,
        extensionsResult: {} as never,
      }),
    });
    const result = await runner.run({ packetId, frozenInput: FROZEN_INPUT });
    expect(result.status).toBe("RECOVERY_REQUIRED");
    if (result.status !== "RECOVERY_REQUIRED") return;
    expect(result.packet.state).toBe("RECOVERY_REQUIRED");
    expect(result.receipt.primary1Outcome).toBe("APPROVED");
    expect(result.receipt.primary2Outcome).toBe("REWORK_REQUIRED");
    expect(store.get(packetId)?.state).toBe("RECOVERY_REQUIRED");
  });

  it("returns PACKET_NOT_ELIGIBLE when the packet is not READY_FOR_REVIEW", async () => {
    const { store, packetId } = freshPacket();
    store.updateState(packetId, "REVIEWING");
    const runner = new ReviewerAgentRunner({
      skillRuntime: stubSkillRuntime,
      packetStore: store,
      modelPolicy: new ModelPolicy(() => ({ provider: "deepseek", model: "deepseek-v4-pro" })),
      modelResolver: await PiModelResolver.create(),
      sink: new InMemoryReviewDecisionSink(),
      reviewValidator: stubReviewValidator,
      investigationValidator: stubInvestigationValidator,
      evidenceValidator: stubEvidenceValidator,
    });
    const result = await runner.run({ packetId, frozenInput: FROZEN_INPUT });
    expect(result.status).toBe("PACKET_NOT_ELIGIBLE");
  });
});
