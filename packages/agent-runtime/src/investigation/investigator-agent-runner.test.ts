import { describe, expect, it } from "vitest";
import type { ResourceLoader } from "@earendil-works/pi-coding-agent";
import {
  MemoryToolEventSink,
  type InventorySubmissionPayload,
  type InvestigationSubmissionPayload,
  type InvestigationSubmissionValidator,
} from "@stellaris/agent-tools";
import { ModelPolicy } from "../model/model-policy.js";
import { PiModelResolver } from "../model/pi-model-resolver.js";
import type { SkillIdentity } from "../skill/skill-identity.js";
import type { SkillRuntime } from "../skill/skill-runtime.js";
import { InMemoryInstitutionWorkPacketStore } from "../work-packet/institution-work-packet.js";
import { InMemoryInvestigationSubmissionSink } from "./investigation-submission-sink.js";
import { InvestigatorAgentRunner } from "./investigator-agent-runner.js";

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

const stubValidator: InvestigationSubmissionValidator = { validate: () => ({ valid: true }) };

const LEADERSHIP = {
  structure_id: "ldr-1",
  institution_id: "inst-1",
  all_visible_leaders: [{ person_name: "张三", visible_roles: ["区委书记"] }],
  official_order: ["张三"],
  party_head: "张三",
  administrative_head: null,
  party_deputy_secretaries: [],
  executive_deputies: [],
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
  person_id: "person-zhang",
  target_id: "t-1",
  institution_id: "inst-1",
  primary_slot: "PRIMARY_1",
  leadership_structure_id: "ldr-1",
  person_status: "PERSON_CONFIRMED",
  person_name: "张三",
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
  person_id: "person-li",
  primary_slot: "PRIMARY_2",
  person_name: "李四",
  role_canonical: "区长",
};

const VALID_SUBMISSION: InvestigationSubmissionPayload = {
  leadership: LEADERSHIP,
  selectedOfficials: [PRIMARY_1, PRIMARY_2],
};

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
    sessionManager: { getSessionId: () => "session-investigator-test" },
    prompt,
  };
}

function successEvent(toolName: string) {
  const now = new Date().toISOString();
  return {
    callId: `call-${toolName}`,
    toolName,
    status: "SUCCESS" as const,
    data: {},
    startedAt: now,
    finishedAt: now,
  };
}

function freshStore() {
  const store = new InMemoryInstitutionWorkPacketStore();
  const packets = store.createFromFrozenInventory(FROZEN_INVENTORY, { regionCode: "320106" });
  const packet = packets[0];
  if (!packet) throw new Error("test setup: expected an INCLUDE packet");
  return { store, packetId: packet.packetId };
}

describe("InvestigatorAgentRunner", () => {
  it("fails with INVESTIGATION_NOT_SUBMITTED when the session never submits", async () => {
    const { store, packetId } = freshStore();
    const runner = new InvestigatorAgentRunner({
      skillRuntime: stubSkillRuntime,
      packetStore: store,
      modelPolicy: new ModelPolicy(() => ({ provider: "deepseek", model: "deepseek-v4-pro" })),
      modelResolver: await PiModelResolver.create(),
      sink: new InMemoryInvestigationSubmissionSink(),
      validator: stubValidator,
      createSession: async () => ({
        session: fakeSession(async () => {}) as never,
        extensionsResult: {} as never,
      }),
    });
    const result = await runner.run({ packetId });
    expect(result.status).toBe("FAILED");
    if (result.status !== "FAILED") return;
    expect(result.failureCode).toBe("INVESTIGATION_NOT_SUBMITTED");
    expect(result.packet.state).toBe("FAILED");
    expect(result.packet.failureCode).toBe("INVESTIGATION_NOT_SUBMITTED");
    expect(store.get(packetId)?.state).toBe("FAILED");
  });

  it("fails with INVESTIGATION_OBSERVATION_REQUIRED when submit happens without fetch/render + inspect success", async () => {
    const { store, packetId } = freshStore();
    const sink = new InMemoryInvestigationSubmissionSink();
    const runner = new InvestigatorAgentRunner({
      skillRuntime: stubSkillRuntime,
      packetStore: store,
      modelPolicy: new ModelPolicy(() => ({ provider: "deepseek", model: "deepseek-v4-pro" })),
      modelResolver: await PiModelResolver.create(),
      sink,
      validator: stubValidator,
      createSession: async () => ({
        session: fakeSession(async () => {
          await sink.submit(VALID_SUBMISSION);
        }) as never,
        extensionsResult: {} as never,
      }),
    });
    const result = await runner.run({ packetId });
    expect(result.status).toBe("FAILED");
    if (result.status !== "FAILED") return;
    expect(result.failureCode).toBe("INVESTIGATION_OBSERVATION_REQUIRED");
    expect(result.packet.state).toBe("FAILED");
  });

  it("returns a frozen COMPLETED result and READY_FOR_REVIEW after a valid inspected submission", async () => {
    const { store, packetId } = freshStore();
    const sink = new InMemoryInvestigationSubmissionSink();
    const eventSink = new MemoryToolEventSink();
    const runner = new InvestigatorAgentRunner({
      skillRuntime: stubSkillRuntime,
      packetStore: store,
      modelPolicy: new ModelPolicy(() => ({ provider: "deepseek", model: "deepseek-v4-pro" })),
      modelResolver: await PiModelResolver.create(),
      sink,
      validator: stubValidator,
      eventSink,
      createSession: async () => ({
        session: fakeSession(async () => {
          eventSink.successes.push(successEvent("fetch_page"));
          eventSink.successes.push(successEvent("inspect_page"));
          await sink.submit(VALID_SUBMISSION);
        }) as never,
        extensionsResult: {} as never,
      }),
    });
    const result = await runner.run({ packetId });
    expect(result.status).toBe("COMPLETED");
    if (result.status !== "COMPLETED") return;
    expect(result.packet.state).toBe("READY_FOR_REVIEW");
    expect(result.frozen).toBe(true);
    expect(result.observationGate.passed).toBe(true);
    expect(result.observationGate.fetchOrRenderSucceeded).toBe(true);
    expect(result.observationGate.inspectSucceeded).toBe(true);
    expect(result.receipt.primary1).toBe("张三");
    expect(result.receipt.primary2).toBe("李四");
    expect(result.receipt.primaryPeopleDistinct).toBe(true);
    expect(result.receipt.payloadHash.length).toBeGreaterThan(0);
    expect(result.skill).toEqual({ name: "official-biography-evidence", version: "3.1.0" });
    const submit = result.toolCalls.find((tool) => tool.toolName === "submit_investigation");
    expect(submit?.called).toBe(true);
  });

  it("rejects a duplicate start once the packet is already INVESTIGATING", async () => {
    const { store, packetId } = freshStore();
    store.updateState(packetId, "INVESTIGATING");
    const runner = new InvestigatorAgentRunner({
      skillRuntime: stubSkillRuntime,
      packetStore: store,
      modelPolicy: new ModelPolicy(() => ({ provider: "deepseek", model: "deepseek-v4-pro" })),
      modelResolver: await PiModelResolver.create(),
      sink: new InMemoryInvestigationSubmissionSink(),
      validator: stubValidator,
      createSession: async () => ({
        session: fakeSession(async () => {}) as never,
        extensionsResult: {} as never,
      }),
    });
    const result = await runner.run({ packetId });
    expect(result.status).toBe("PACKET_ALREADY_STARTED");
  });

  it("returns PACKET_NOT_FOUND for an unknown packet id", async () => {
    const { store } = freshStore();
    const runner = new InvestigatorAgentRunner({
      skillRuntime: stubSkillRuntime,
      packetStore: store,
      modelPolicy: new ModelPolicy(() => ({ provider: "deepseek", model: "deepseek-v4-pro" })),
      modelResolver: await PiModelResolver.create(),
      sink: new InMemoryInvestigationSubmissionSink(),
      validator: stubValidator,
    });
    const result = await runner.run({ packetId: "missing-packet" });
    expect(result.status).toBe("PACKET_NOT_FOUND");
  });
});
