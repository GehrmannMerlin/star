import { describe, expect, it } from "vitest";
import type { ResourceLoader } from "@earendil-works/pi-coding-agent";
import {
  MemoryToolEventSink,
  ToolGateway,
  createAgentToolRegistry,
  createSubmitInvestigatorEvidenceTool,
  type InvestigationSubmissionPayload,
  type InvestigationSubmissionValidator,
  type InventorySubmissionPayload,
  type InvestigatorEvidenceSubmissionPayload,
  type InvestigatorEvidenceSubmissionValidator,
} from "@stellaris/agent-tools";
import { ModelPolicy } from "../model/model-policy.js";
import { PiModelResolver } from "../model/pi-model-resolver.js";
import type { SkillIdentity } from "../skill/skill-identity.js";
import type { SkillRuntime } from "../skill/skill-runtime.js";
import { InMemoryInstitutionWorkPacketStore } from "../work-packet/institution-work-packet.js";
import { InMemoryInvestigatorEvidenceSubmissionSink } from "./investigator-evidence-submission-sink.js";
import { InvestigatorEvidenceRunner } from "./investigator-evidence-runner.js";

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

const stubEvidenceValidator: InvestigatorEvidenceSubmissionValidator = {
  validate: () => ({ valid: true }),
};
const stubInvestigationValidator: InvestigationSubmissionValidator = {
  validate: () => ({ valid: true }),
};

const LEADERSHIP = {
  structure_id: "ldr-gulou",
  institution_id: "glq-people-gov",
  all_visible_leaders: [
    { person_name: "王安伟", visible_roles: ["区委书记"] },
    { person_name: "董涵", visible_roles: ["区委副书记", "区长"] },
  ],
  official_order: ["王安伟", "董涵"],
  party_head: "王安伟",
  administrative_head: "董涵",
  party_deputy_secretaries: ["董涵"],
  executive_deputies: ["董涵"],
  other_deputies: [],
  vacancy_information: [],
  supporting_evidence_ids: ["evt-1"],
  structure_complete: true,
  investigator_agent_id: "agent-1",
  investigator_context_id: "ctx-1",
  decided_at: "2026-08-14T00:00:00.000Z",
};

const PRIMARY_1 = {
  person_decision_id: "pd-1",
  person_id: "person-wang",
  target_id: "glq-target-primary1",
  institution_id: "glq-people-gov",
  primary_slot: "PRIMARY_1",
  leadership_structure_id: "ldr-gulou",
  person_status: "PERSON_CONFIRMED",
  person_name: "王安伟",
  role_canonical: "区委书记",
  selection_basis: "official order head",
  rank_information: null,
  responsibility_description: null,
  currentness_quality: "CURRENT_COLLECTION_MEMBER",
  supporting_evidence_ids: ["evt-1"],
  investigator_agent_id: "agent-1",
  investigator_context_id: "ctx-1",
  decided_at: "2026-08-14T00:00:01.000Z",
};

const PRIMARY_2 = {
  ...PRIMARY_1,
  person_decision_id: "pd-2",
  person_id: "person-dong",
  target_id: "glq-target-primary2",
  primary_slot: "PRIMARY_2",
  person_name: "董涵",
  role_canonical: "区委副书记、区长",
};

const FROZEN_INPUT: InvestigationSubmissionPayload = {
  leadership: LEADERSHIP,
  selectedOfficials: [PRIMARY_1, PRIMARY_2],
};

const PRIMARY_1_URL = "https://www.njgl.gov.cn/zfxxgk/ldzc/1.html";
const PRIMARY_2_URL = "https://www.njgl.gov.cn/zfxxgk/ldzc/2.html";

function candidateRow(targetId: string, url: string) {
  return {
    candidate_id: `cand-${targetId}`,
    target_id: targetId,
    evidence_id: `evt-${targetId}-1`,
    url,
    source_domain_class: "OFFICIAL_GOV_DOMAIN",
    page_shape_class: "OFFICIAL_PERSON_PROFILE",
    supports_person: true,
    supports_institution: true,
    supports_role: true,
    supports_currentness: true,
    candidate_status: "ACCEPTED_AS_FINAL",
    accept_or_reject_reason: "official person profile for the frozen PRIMARY",
    superseded_by_candidate_id: null,
  };
}

function validEvidencePayload(): InvestigatorEvidenceSubmissionPayload {
  return {
    candidates: [
      candidateRow("glq-target-primary1", PRIMARY_1_URL),
      candidateRow("glq-target-primary2", PRIMARY_2_URL),
    ],
  };
}

const FROZEN_INVENTORY: InventorySubmissionPayload = {
  inventory: [
    {
      institution_id: "glq-people-gov",
      standard_name: "鼓楼区人民政府",
      administrative_level: "COUNTY",
      decision: "INCLUDE",
    },
  ],
};

function fakeSession(prompt: (promptText: string) => Promise<void>) {
  return {
    sessionManager: { getSessionId: () => "session-evidence-test" },
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
  const packets = store.createFromFrozenInventory(FROZEN_INVENTORY, { regionCode: "320106" });
  const packet = packets[0];
  if (!packet) throw new Error("test setup: expected an INCLUDE packet");
  store.updateState(packet.packetId, "INVESTIGATING", { investigatorSessionId: "step9-session" });
  store.updateState(packet.packetId, "EVIDENCE_PENDING");
  return { store, packetId: packet.packetId };
}

describe("InvestigatorEvidenceRunner", () => {
  it("fails with EVIDENCE_NOT_SUBMITTED when the session never submits", async () => {
    const { store, packetId } = freshPacket();
    const runner = new InvestigatorEvidenceRunner({
      skillRuntime: stubSkillRuntime,
      packetStore: store,
      modelPolicy: new ModelPolicy(() => ({ provider: "deepseek", model: "deepseek-v4-pro" })),
      modelResolver: await PiModelResolver.create(),
      sink: new InMemoryInvestigatorEvidenceSubmissionSink(),
      validator: stubEvidenceValidator,
      investigationValidator: stubInvestigationValidator,
      createSession: async () => ({
        session: fakeSession(async () => {}) as never,
        extensionsResult: {} as never,
      }),
    });
    const result = await runner.run({ packetId, frozenInput: FROZEN_INPUT });
    expect(result.status).toBe("FAILED");
    if (result.status !== "FAILED") return;
    expect(result.failureCode).toBe("EVIDENCE_NOT_SUBMITTED");
    expect(result.packet.state).toBe("FAILED");
    expect(store.get(packetId)?.state).toBe("FAILED");
  });

  it("fails with POSITION_CANDIDATE_OBSERVATION_REQUIRED when candidates are submitted without real open+inspect events", async () => {
    const { store, packetId } = freshPacket();
    const sink = new InMemoryInvestigatorEvidenceSubmissionSink();
    const runner = new InvestigatorEvidenceRunner({
      skillRuntime: stubSkillRuntime,
      packetStore: store,
      modelPolicy: new ModelPolicy(() => ({ provider: "deepseek", model: "deepseek-v4-pro" })),
      modelResolver: await PiModelResolver.create(),
      sink,
      validator: stubEvidenceValidator,
      investigationValidator: stubInvestigationValidator,
      createSession: async () => ({
        session: fakeSession(async () => {
          // Submit through the sink (as the tool would) but never open/inspect.
          await sink.submit(validEvidencePayload());
        }) as never,
        extensionsResult: {} as never,
      }),
    });
    const result = await runner.run({ packetId, frozenInput: FROZEN_INPUT });
    expect(result.status).toBe("FAILED");
    if (result.status !== "FAILED") return;
    expect(result.failureCode).toBe("POSITION_CANDIDATE_OBSERVATION_REQUIRED");
    expect(result.packet.state).toBe("FAILED");
  });

  it("returns a frozen COMPLETED result and READY_FOR_REVIEW for a fully observed candidate pool", async () => {
    const { store, packetId } = freshPacket();
    const sink = new InMemoryInvestigatorEvidenceSubmissionSink();
    const eventSink = new MemoryToolEventSink();
    const runner = new InvestigatorEvidenceRunner({
      skillRuntime: stubSkillRuntime,
      packetStore: store,
      modelPolicy: new ModelPolicy(() => ({ provider: "deepseek", model: "deepseek-v4-pro" })),
      modelResolver: await PiModelResolver.create(),
      sink,
      validator: stubEvidenceValidator,
      investigationValidator: stubInvestigationValidator,
      eventSink,
      createSession: async () => ({
        session: fakeSession(async () => {
          eventSink.successes.push(
            successEvent("fetch_page", { requestedUrl: PRIMARY_1_URL, finalUrl: PRIMARY_1_URL }),
          );
          eventSink.successes.push(successEvent("inspect_page", { url: PRIMARY_1_URL }));
          eventSink.successes.push(
            successEvent("fetch_page", { requestedUrl: PRIMARY_2_URL, finalUrl: PRIMARY_2_URL }),
          );
          eventSink.successes.push(successEvent("inspect_page", { url: PRIMARY_2_URL }));
          await sink.submit(validEvidencePayload());
        }) as never,
        extensionsResult: {} as never,
      }),
    });
    const result = await runner.run({ packetId, frozenInput: FROZEN_INPUT });
    expect(result.status).toBe("COMPLETED");
    if (result.status !== "COMPLETED") return;
    expect(result.packet.state).toBe("READY_FOR_REVIEW");
    expect(result.frozen).toBe(true);
    expect(result.provenance.passed).toBe(true);
    expect(result.receipt.primary1CandidateCount).toBe(1);
    expect(result.receipt.primary2CandidateCount).toBe(1);
    expect(result.receipt.allCandidatesOpened).toBe(true);
    expect(result.receipt.allCandidatesInspected).toBe(true);
    expect(result.skill).toEqual({ name: "official-biography-evidence", version: "3.1.0" });
    const submit = result.toolCalls.find((tool) => tool.toolName === "submit_investigator_evidence");
    expect(submit?.called).toBe(true);
  });

  it("returns PACKET_NOT_ELIGIBLE when the packet is not EVIDENCE_PENDING", async () => {
    const { store, packetId } = freshPacket();
    store.updateState(packetId, "EVIDENCE_GATHERING");
    const runner = new InvestigatorEvidenceRunner({
      skillRuntime: stubSkillRuntime,
      packetStore: store,
      modelPolicy: new ModelPolicy(() => ({ provider: "deepseek", model: "deepseek-v4-pro" })),
      modelResolver: await PiModelResolver.create(),
      sink: new InMemoryInvestigatorEvidenceSubmissionSink(),
      validator: stubEvidenceValidator,
      investigationValidator: stubInvestigationValidator,
    });
    const result = await runner.run({ packetId, frozenInput: FROZEN_INPUT });
    expect(result.status).toBe("PACKET_NOT_ELIGIBLE");
  });

  it("returns INVALID_REQUEST when frozenInput fails the Skill schemas", async () => {
    const { store, packetId } = freshPacket();
    const invalidInvestigation: InvestigationSubmissionValidator = {
      validate: () => ({ valid: false, errors: ["leadership: missing required property"] }),
    };
    const runner = new InvestigatorEvidenceRunner({
      skillRuntime: stubSkillRuntime,
      packetStore: store,
      modelPolicy: new ModelPolicy(() => ({ provider: "deepseek", model: "deepseek-v4-pro" })),
      modelResolver: await PiModelResolver.create(),
      sink: new InMemoryInvestigatorEvidenceSubmissionSink(),
      validator: stubEvidenceValidator,
      investigationValidator: invalidInvestigation,
    });
    const result = await runner.run({ packetId, frozenInput: FROZEN_INPUT });
    expect(result.status).toBe("INVALID_REQUEST");
  });
});


describe("buildEvidenceRolePrompt enum projection", () => {
  it("includes source_domain_class / page_shape_class / candidate_status enums when a contract is supplied", async () => {
    const pathMod = await import("node:path");
    const urlMod = await import("node:url");
    const SKILL_DIR = pathMod.resolve(
      pathMod.dirname(urlMod.fileURLToPath(import.meta.url)),
      "../../../../third-party/china-official-url-evidence-suite/skills/official-biography-evidence",
    );
    const { SkillSchemaRegistry } = await import("../skill/skill-schema-registry.js");
    const registry = await SkillSchemaRegistry.load(pathMod.join(SKILL_DIR, "schemas"));
    const pool = registry
      .list()
      .map((n) => registry.get(n))
      .find((s) => s?.filePath.endsWith("url-candidate-pool.schema.json"));
    const claim = registry
      .list()
      .map((n) => registry.get(n))
      .find((s) => s?.filePath.endsWith("target-claim.schema.json"));
    if (!pool || !claim) throw new Error("schemas missing");
    const { CanonicalEvidenceContract } = await import("./canonical-evidence-contract.js");
    const { buildEvidenceRolePrompt } = await import("./evidence-role-prompt.js");
    const contract = new CanonicalEvidenceContract(pool, claim);
    const text = buildEvidenceRolePrompt(
      {
        packetId: "p1",
        institutionName: "鼓楼区人民政府",
        regionCode: "320106",
        institutionId: "glq",
        administrativeLevel: "COUNTY",
        institutionType: "government",
        state: "EVIDENCE_PENDING",
        attemptNo: 1,
      } as never,
      {
        regionCode: "320106",
        agentSessionId: "s1",
        primary1: { targetId: "t1", personId: "p1", personName: "甲", primarySlot: "PRIMARY_1" },
        primary2: { targetId: "t2", personId: "p2", personName: "乙", primarySlot: "PRIMARY_2" },
        institutionId: "glq",
        contract,
      },
    );
    expect(text).toContain("OFFICIAL_GOV_DOMAIN");
    expect(text).toContain("ACCEPTED_AS_FINAL");
  });
});


describe("InvestigatorEvidenceRunner schema repair", () => {
  it("recovers from a schema failure via repair steering then freezes", async () => {
    const { store, packetId } = freshPacket();
    const sink = new InMemoryInvestigatorEvidenceSubmissionSink();
    const eventSink = new MemoryToolEventSink();
    let firstSubmit = true;
    const flakyValidator: InvestigatorEvidenceSubmissionValidator = {
      validate: (payload) => {
        if (firstSubmit) {
          firstSubmit = false;
          return {
            valid: false,
            errors: ["candidates[0]: /candidate_status must be equal to one of the allowed values"],
            details: [
              {
                errorCode: "SUBMISSION_SCHEMA_VALIDATION_FAILED",
                fieldPath: "/candidates/0/candidate_status",
                receivedValue: "BAD_VALUE",
                validationKeyword: "enum",
                allowedValues: ["ACCEPTED_AS_FINAL"],
                repairInstruction: "仅修正该字段为允许值之一。不要重新搜索。",
              },
            ],
          };
        }
        return { valid: true };
      },
    };
    const runner = new InvestigatorEvidenceRunner({
      skillRuntime: stubSkillRuntime,
      packetStore: store,
      modelPolicy: new ModelPolicy(() => ({ provider: "deepseek", model: "deepseek-v4-pro" })),
      modelResolver: await PiModelResolver.create(),
      sink,
      validator: flakyValidator,
      investigationValidator: stubInvestigationValidator,
      eventSink,
      createSession: async () => ({
        session: fakeSession(async (promptText) => {
          if (promptText.includes("submit_investigator_evidence 提交因 schema")) {
            eventSink.successes.push(
              successEvent("fetch_page", { requestedUrl: PRIMARY_1_URL, finalUrl: PRIMARY_1_URL }),
            );
            eventSink.successes.push(successEvent("inspect_page", { url: PRIMARY_1_URL }));
            eventSink.successes.push(
              successEvent("fetch_page", { requestedUrl: PRIMARY_2_URL, finalUrl: PRIMARY_2_URL }),
            );
            eventSink.successes.push(successEvent("inspect_page", { url: PRIMARY_2_URL }));
            await sink.submit(validEvidencePayload());
          } else {
            const registry = createAgentToolRegistry({
              submitInvestigatorEvidenceTool: createSubmitInvestigatorEvidenceTool({
                validator: flakyValidator,
                sink,
                primaryDecisions: [
                  { targetId: "glq-target-primary1", personId: "person-wang", personName: "王安伟", primarySlot: "PRIMARY_1" },
                  { targetId: "glq-target-primary2", personId: "person-dong", personName: "董涵", primarySlot: "PRIMARY_2" },
                ],
              }),
            });
            const gw = new ToolGateway(registry, eventSink);
            const evt = {
              taskRunId: "t",
              agentSessionId: "session-evidence-test",
              agentRole: "INVESTIGATOR",
              signal: new AbortController().signal,
            } as never;
            await gw.execute(
              "submit_investigator_evidence",
              { candidates: [{ candidate_id: "x" }] },
              evt,
            );
          }
        }) as never,
        extensionsResult: {} as never,
      }),
    });
    const result = await runner.run({ packetId, frozenInput: FROZEN_INPUT });
    expect(result.status).toBe("COMPLETED");
    if (result.status !== "COMPLETED") return;
    expect(result.repair?.submitAttempts).toBeGreaterThanOrEqual(1);
    expect(result.repair?.repeatedErrorBreakerTriggered).toBe(false);
    expect(result.repair?.researchToolCallsAfterFirstSubmitFailure).toBe(0);
  });
});
