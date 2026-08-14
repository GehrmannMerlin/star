import { describe, expect, it } from "vitest";
import type { ResourceLoader } from "@earendil-works/pi-coding-agent";
import {
  MemoryToolEventSink,
  type InvestigationSubmissionValidator,
  type InvestigatorEvidenceSubmissionValidator,
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

const stubReviewValidator: ReviewerSubmissionValidator = { validate: () => ({ valid: true }) };
const stubInvestigationValidator: InvestigationSubmissionValidator = {
  validate: () => ({ valid: true }),
};
const stubEvidenceValidator: InvestigatorEvidenceSubmissionValidator = {
  validate: () => ({ valid: true }),
};

const URL_A = "http://www.njgl.gov.cn/xxgk/qczc/dh/";
const URL_SL = "http://www.njgl.gov.cn/xxgk/qczc/sl/";
const URL_FOREIGN = "https://other.example.com/fake.html";

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

function candidate(id: string, targetId: string, url: string) {
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

/** STEP 14: Composite Candidate View = Original Pool (P1 only) + Recovery Supplement (P2). */
const COMPOSITE_VIEW = [candidate("cand-p1-dh", "glq-target-primary1", URL_A), candidate("cand-p2-recovery", "glq-target-primary2", URL_SL)];

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

function approvedReviews(primary2CandidateId: string | null) {
  return {
    reviews: [
      {
        target_id: "glq-target-primary1",
        selected_candidate_id: "cand-p1-dh",
        review_result: "APPROVED",
        final_review_result: "APPROVED_STRICT_ADMISSIBLE",
        review_reason: "verified official page",
        currentness_quality: "CURRENT_COLLECTION_MEMBER",
        checks: CHECKS,
      },
      {
        target_id: "glq-target-primary2",
        selected_candidate_id: primary2CandidateId,
        review_result: primary2CandidateId === null ? "REWORK_REQUIRED" : "APPROVED",
        final_review_result:
          primary2CandidateId === null ? "REWORK_REQUIRED" : "APPROVED_STRICT_ADMISSIBLE",
        review_reason: "verified official page",
        currentness_quality: "CURRENT_COLLECTION_MEMBER",
        checks: CHECKS,
      },
    ],
  };
}

function fakeSession(prompt: (promptText: string) => Promise<void>) {
  return {
    sessionManager: { getSessionId: () => "session-reviewer-round2" },
    prompt,
  };
}

function successEvent(toolName: string, data: Record<string, unknown> = {}) {
  const now = new Date().toISOString();
  return { callId: `call-${toolName}-${String(data.url ?? "x")}`, toolName, status: "SUCCESS" as const, data, startedAt: now, finishedAt: now };
}

function freshRoundTwoPacket(): { store: InMemoryInstitutionWorkPacketStore; packetId: string } {
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

function pushObservationEvents(eventSink: MemoryToolEventSink, urls: string[]): void {
  for (const url of urls) {
    eventSink.successes.push(successEvent("fetch_page", { requestedUrl: url, finalUrl: url }));
    eventSink.successes.push(successEvent("inspect_page", { url }));
  }
  eventSink.successes.push(successEvent("search_web", { provider: "bocha", results: [] }));
}

describe("Round-2 Reviewer Candidate Membership Gate (STEP 14 D)", () => {
  it("accepts a Recovery candidate that entered the Composite Candidate View (Round 2)", async () => {
    const { store, packetId } = freshRoundTwoPacket();
    const sink = new InMemoryReviewDecisionSink();
    const eventSink = new MemoryToolEventSink();
    const runner = new ReviewerAgentRunner({
      skillRuntime: stubSkillRuntime,
      packetStore: store,
      modelPolicy: new ModelPolicy(() => ({ provider: "deepseek", model: "deepseek-v4-flash" })),
      modelResolver: await PiModelResolver.create(),
      sink,
      reviewValidator: stubReviewValidator,
      investigationValidator: stubInvestigationValidator,
      evidenceValidator: stubEvidenceValidator,
      eventSink,
      createSession: async () => ({
        session: fakeSession(async () => {
          pushObservationEvents(eventSink, [URL_A, URL_SL]);
          await sink.submit(approvedReviews("cand-p2-recovery") as never);
        }) as never,
        extensionsResult: {} as never,
      }),
    });
    // Round 2 frozen input: Composite Candidate View is the Reviewer's Frozen Candidate View.
    const result = await runner.run({
      packetId,
      frozenInput: { leadership: LEADERSHIP, selectedOfficials: [PRIMARY_1, PRIMARY_2], candidatePool: COMPOSITE_VIEW },
    });
    expect(result.status).toBe("COMPLETED");
    if (result.status !== "COMPLETED") return;
    const primary2 = result.finalDecisions.find((d) => d.primarySlot === "PRIMARY_2");
    expect(primary2?.selectedCandidateId).toBe("cand-p2-recovery");
    expect(primary2?.finalUrl).toBe(URL_SL);
    expect(result.packet.state).toBe("POSITION_DECIDED");
  });

  it("rejects a Recovery candidate that never entered the Composite Candidate View", async () => {
    const { store, packetId } = freshRoundTwoPacket();
    const sink = new InMemoryReviewDecisionSink();
    const eventSink = new MemoryToolEventSink();
    const runner = new ReviewerAgentRunner({
      skillRuntime: stubSkillRuntime,
      packetStore: store,
      modelPolicy: new ModelPolicy(() => ({ provider: "deepseek", model: "deepseek-v4-flash" })),
      modelResolver: await PiModelResolver.create(),
      sink,
      reviewValidator: stubReviewValidator,
      investigationValidator: stubInvestigationValidator,
      evidenceValidator: stubEvidenceValidator,
      eventSink,
      createSession: async () => ({
        session: fakeSession(async () => {
          pushObservationEvents(eventSink, [URL_A, URL_SL]);
          await sink.submit(approvedReviews("cand-p2-recovery") as never);
        }) as never,
        extensionsResult: {} as never,
      }),
    });
    // Round 2 with the ORIGINAL pool only — the Recovery candidate is NOT in the Frozen Candidate View.
    const result = await runner.run({
      packetId,
      frozenInput: {
        leadership: LEADERSHIP,
        selectedOfficials: [PRIMARY_1, PRIMARY_2],
        candidatePool: [candidate("cand-p1-dh", "glq-target-primary1", URL_A)],
      },
    });
    expect(result.status).toBe("FAILED");
    if (result.status !== "FAILED") return;
    expect(store.get(packetId)?.state).toBe("FAILED");
  });

  it("rejects a completely foreign URL that is in no frozen view", async () => {
    const { store, packetId } = freshRoundTwoPacket();
    const sink = new InMemoryReviewDecisionSink();
    const eventSink = new MemoryToolEventSink();
    const runner = new ReviewerAgentRunner({
      skillRuntime: stubSkillRuntime,
      packetStore: store,
      modelPolicy: new ModelPolicy(() => ({ provider: "deepseek", model: "deepseek-v4-flash" })),
      modelResolver: await PiModelResolver.create(),
      sink,
      reviewValidator: stubReviewValidator,
      investigationValidator: stubInvestigationValidator,
      evidenceValidator: stubEvidenceValidator,
      eventSink,
      createSession: async () => ({
        session: fakeSession(async () => {
          pushObservationEvents(eventSink, [URL_A, URL_FOREIGN]);
          await sink.submit(
            {
              reviews: [
                {
                  target_id: "glq-target-primary1",
                  selected_candidate_id: "cand-p1-dh",
                  review_result: "APPROVED",
                  final_review_result: "APPROVED_STRICT_ADMISSIBLE",
                  review_reason: "verified",
                  currentness_quality: "CURRENT_COLLECTION_MEMBER",
                  checks: CHECKS,
                },
                {
                  target_id: "glq-target-primary2",
                  selected_candidate_id: "cand-foreign",
                  review_result: "APPROVED",
                  final_review_result: "APPROVED_STRICT_ADMISSIBLE",
                  review_reason: "verified",
                  currentness_quality: "CURRENT_COLLECTION_MEMBER",
                  checks: CHECKS,
                },
              ],
            } as never,
          );
        }) as never,
        extensionsResult: {} as never,
      }),
    });
    const result = await runner.run({
      packetId,
      frozenInput: { leadership: LEADERSHIP, selectedOfficials: [PRIMARY_1, PRIMARY_2], candidatePool: COMPOSITE_VIEW },
    });
    expect(result.status).toBe("FAILED");
  });
});
