import { describe, expect, it } from "vitest";
import type { ResourceLoader } from "@earendil-works/pi-coding-agent";
import type {
  InventorySubmissionPayload,
  InventorySubmissionSink,
  InventorySubmissionValidator,
} from "@stellaris/agent-tools";
import { ModelPolicy } from "../model/model-policy.js";
import { PiModelResolver } from "../model/pi-model-resolver.js";
import type { SkillIdentity } from "../skill/skill-identity.js";
import type { SkillRuntime } from "../skill/skill-runtime.js";
import { InMemoryInventorySubmissionSink } from "./inventory-submission-sink.js";
import { InventoryAgentRunner } from "./inventory-agent-runner.js";

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

const stubValidator: InventorySubmissionValidator = { validate: () => ({ valid: true }) };

const VALID_INVENTORY: InventorySubmissionPayload = {
  inventory: [
    {
      institution_id: "sh-people-gov",
      standard_name: "上海市人民政府",
      administrative_level: "PROVINCIAL",
      decision: "INCLUDE",
      source_url: "https://www.sh.gov.cn/",
    },
  ],
};

const REQUEST = {
  regionCode: "310000",
  mode: "TARGETED" as const,
  specifiedInstitutions: ["上海市人民政府"],
};

function fakeSession(prompt: (promptText: string) => Promise<void>) {
  return {
    sessionManager: { getSessionId: () => "session-inventory-test" },
    prompt,
  };
}

describe("InventoryAgentRunner", () => {
  it("fails with INVENTORY_NOT_SUBMITTED when the session never calls submit_inventory", async () => {
    const runner = new InventoryAgentRunner({
      skillRuntime: stubSkillRuntime,
      modelPolicy: new ModelPolicy(() => ({ provider: "deepseek", model: "deepseek-v4-pro" })),
      modelResolver: await PiModelResolver.create(),
      sink: new InMemoryInventorySubmissionSink(),
      validator: stubValidator,
      createSession: async () => ({
        session: fakeSession(async () => {}) as never,
        extensionsResult: {} as never,
      }),
    });
    const result = await runner.run(REQUEST);
    expect(result.status).toBe("INVENTORY_NOT_SUBMITTED");
    if (result.status === "INVENTORY_NOT_SUBMITTED") {
      expect(result.toolCalls.some((tool) => tool.toolName === "submit_inventory")).toBe(true);
    }
  });

  it("returns a frozen COMPLETED result when the session submits a valid inventory", async () => {
    const sink = new InMemoryInventorySubmissionSink();
    const runner = new InventoryAgentRunner({
      skillRuntime: stubSkillRuntime,
      modelPolicy: new ModelPolicy(() => ({ provider: "deepseek", model: "deepseek-v4-pro" })),
      modelResolver: await PiModelResolver.create(),
      sink,
      validator: stubValidator,
      createSession: async () => ({
        session: fakeSession(async () => {
          await sink.submit(VALID_INVENTORY);
        }) as never,
        extensionsResult: {} as never,
      }),
    });
    const result = await runner.run(REQUEST);
    expect(result.status).toBe("COMPLETED");
    if (result.status !== "COMPLETED") return;
    expect(result.regionCode).toBe("310000");
    expect(result.mode).toBe("TARGETED");
    expect(result.frozen).toBe(true);
    expect(result.inventory).toHaveLength(1);
    expect(result.receipt.itemCount).toBe(1);
    expect(result.receipt.payloadHash.length).toBeGreaterThan(0);
    expect(result.skill).toEqual({ name: "official-biography-evidence", version: "3.1.0" });
    expect(result.model.provider).toBe("deepseek");
    const submit = result.toolCalls.find((tool) => tool.toolName === "submit_inventory");
    expect(submit?.called).toBe(true);
  });

  it("rejects an invalid request without creating a session", async () => {
    const runner = new InventoryAgentRunner({
      skillRuntime: stubSkillRuntime,
      modelPolicy: new ModelPolicy(() => ({ provider: "deepseek", model: "deepseek-v4-pro" })),
      modelResolver: await PiModelResolver.create(),
      sink: new InMemoryInventorySubmissionSink(),
      validator: stubValidator,
    });
    const result = await runner.run({ regionCode: "310000", mode: "TARGETED", specifiedInstitutions: [] });
    expect(result.status).toBe("INVALID_REQUEST");
  });

  it("returns INVALID_REQUEST for an unknown region code", async () => {
    const runner = new InventoryAgentRunner({
      skillRuntime: stubSkillRuntime,
      modelPolicy: new ModelPolicy(() => ({ provider: "deepseek", model: "deepseek-v4-pro" })),
      modelResolver: await PiModelResolver.create(),
      sink: new InMemoryInventorySubmissionSink(),
      validator: stubValidator,
    });
    const result = await runner.run({ regionCode: "999999", mode: "TARGETED", specifiedInstitutions: ["x"] });
    expect(result.status).toBe("INVALID_REQUEST");
  });

  it("runs a FULL request (regionCode only) and freezes a submitted inventory", async () => {
    const sink = new InMemoryInventorySubmissionSink();
    const runner = new InventoryAgentRunner({
      skillRuntime: stubSkillRuntime,
      modelPolicy: new ModelPolicy(() => ({ provider: "deepseek", model: "deepseek-v4-pro" })),
      modelResolver: await PiModelResolver.create(),
      sink,
      validator: stubValidator,
      createSession: async () => ({
        session: fakeSession(async () => {
          await sink.submit(VALID_INVENTORY);
        }) as never,
        extensionsResult: {} as never,
      }),
    });
    const result = await runner.run({ regionCode: "320106", mode: "FULL" });
    expect(result.status).toBe("COMPLETED");
    if (result.status !== "COMPLETED") return;
    expect(result.mode).toBe("FULL");
    expect(result.regionCode).toBe("320106");
    expect(result.frozen).toBe(true);
    expect(result.inventory).toHaveLength(1);
    expect(result.receipt.itemCount).toBe(1);
  });

  it("returns INVENTORY_NOT_SUBMITTED for a FULL request when the session never submits", async () => {
    const runner = new InventoryAgentRunner({
      skillRuntime: stubSkillRuntime,
      modelPolicy: new ModelPolicy(() => ({ provider: "deepseek", model: "deepseek-v4-pro" })),
      modelResolver: await PiModelResolver.create(),
      sink: new InMemoryInventorySubmissionSink(),
      validator: stubValidator,
      createSession: async () => ({
        session: fakeSession(async () => {}) as never,
        extensionsResult: {} as never,
      }),
    });
    const result = await runner.run({ regionCode: "320106", mode: "FULL" });
    expect(result.status).toBe("INVENTORY_NOT_SUBMITTED");
  });
});
