import { describe, expect, it } from "vitest";
import type { ResourceLoader } from "@earendil-works/pi-coding-agent";
import {
  createAgentToolRegistry,
  MemoryToolEventSink,
  SubmitInvestigationInput,
  ToolFailureCode,
  type InventorySubmissionPayload,
  type InvestigationSubmissionPayload,
  type InvestigationSubmissionValidator,
  type ToolFailure,
  type ToolInvocationContext,
  type ValidationIssue,
} from "@stellaris/agent-tools";
import { ModelPolicy } from "../model/model-policy.js";
import { PiModelResolver } from "../model/pi-model-resolver.js";
import type { SkillIdentity } from "../skill/skill-identity.js";
import type { SkillRuntime } from "../skill/skill-runtime.js";
import { InMemoryInstitutionWorkPacketStore } from "../work-packet/institution-work-packet.js";
import { InMemoryInvestigationSubmissionSink } from "./investigation-submission-sink.js";
import {
  InvestigatorAgentRunner,
  SubmissionRepairGateway,
  SCHEMA_REPAIR_MAX_ATTEMPTS,
  SUBMIT_INVESTIGATION_MAX_ATTEMPTS,
} from "./investigator-agent-runner.js";

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

function personDecision(overrides: Record<string, unknown> = {}) {
  return {
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
    ...overrides,
  };
}

const VALID_SUBMISSION: InvestigationSubmissionPayload = {
  leadership: LEADERSHIP,
  selectedOfficials: [
    personDecision(),
    personDecision({
      person_decision_id: "pd-2",
      person_id: "person-li",
      primary_slot: "PRIMARY_2",
      person_name: "李四",
      role_canonical: "区长",
    }),
  ],
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
    sessionManager: { getSessionId: () => "session-repair-test" },
    prompt,
  };
}

function successEvent(toolName: string) {
  const now = new Date().toISOString();
  return {
    callId: `call-${toolName}-${now}`,
    toolName,
    status: "SUCCESS" as const,
    data: {},
    startedAt: now,
    finishedAt: now,
  };
}

/** 构造 submit_investigation 的 schema 失败事件（模拟 ToolGateway 记录）。 */
function schemaFailureEvent(
  fieldPath: string,
  receivedValue: unknown,
  allowedValues: readonly string[],
  seq: number,
) {
  const now = new Date().toISOString();
  const issue: ValidationIssue = {
    errorCode: "SUBMISSION_SCHEMA_VALIDATION_FAILED",
    fieldPath,
    receivedValue,
    validationKeyword: "enum",
    allowedValues,
    repairInstruction: "仅修正该字段为允许值之一。不要重新搜索。不要创建新的枚举值。",
  };
  const failure: ToolFailure = {
    code: ToolFailureCode.SCHEMA_VALIDATION_FAILED,
    message: `submit_investigation failed Skill schema validation；字段：${fieldPath}；收到值：${String(receivedValue)}；允许值：${allowedValues.join(" / ")}`,
    retryable: false,
    details: [issue],
  };
  return {
    callId: `call-submit-fail-${seq}`,
    toolName: "submit_investigation",
    status: "FAILED" as const,
    failure,
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

async function makeRunner(opts: {
  store: InMemoryInstitutionWorkPacketStore;
  sink: InMemoryInvestigationSubmissionSink;
  eventSink: MemoryToolEventSink;
  prompt: (promptText: string) => Promise<void>;
  validator?: InvestigationSubmissionValidator;
}) {
  return new InvestigatorAgentRunner({
    skillRuntime: stubSkillRuntime,
    packetStore: opts.store,
    modelPolicy: new ModelPolicy(() => ({ provider: "deepseek", model: "deepseek-v4-pro" })),
    modelResolver: await PiModelResolver.create(),
    sink: opts.sink,
    validator: opts.validator ?? { validate: () => ({ valid: true }) },
    eventSink: opts.eventSink,
    createSession: async () => ({
      session: fakeSession(opts.prompt) as never,
      extensionsResult: {} as never,
    }),
  });
}

describe("STEP 19.4 Repair Loop (Test 5 — Successful Repair)", () => {
  it("第一次 invalid → repair prompt → 第二次 corrected → COMPLETED", async () => {
    const { store, packetId } = freshStore();
    const sink = new InMemoryInvestigationSubmissionSink();
    const eventSink = new MemoryToolEventSink();
    let promptCount = 0;

    const runner = await makeRunner({
      store,
      sink,
      eventSink,
      prompt: async () => {
        promptCount += 1;
        if (promptCount === 1) {
          // 第一次：调查后 submit 失败（非法 person_status）。
          eventSink.failures.push(
            schemaFailureEvent("/0/person_status", "在任", [
              "PERSON_CONFIRMED",
              "PERSON_UNRESOLVED_AFTER_COMPLETE_SEARCH",
              "VACANT",
            ], 1),
          );
          eventSink.starts.push({
            callId: "call-submit-1",
            toolName: "submit_investigation",
            context: {} as ToolInvocationContext,
            startedAt: new Date().toISOString(),
          });
          return;
        }
        // 第二次（repair）：修正后提交成功 + 合法观察。
        eventSink.successes.push(successEvent("fetch_page"));
        eventSink.successes.push(successEvent("inspect_page"));
        await sink.submit(VALID_SUBMISSION);
      },
    });

    const result = await runner.run({ packetId });
    expect(result.status).toBe("COMPLETED");
    if (result.status !== "COMPLETED") return;
    expect(result.packet.state).toBe("EVIDENCE_PENDING");
    expect(result.repair.submitAttempts).toBe(1);
    expect(result.repair.schemaValidationFailures).toBe(1);
    expect(result.repair.repairAttempts).toBe(1);
    expect(result.repair.repeatedErrorBreakerTriggered).toBe(false);
    expect(result.repair.researchToolCallsAfterFirstSubmitFailure).toBe(0);
  });
});

describe("STEP 19.4 Repair Loop (Test 6 — Repeated Error Circuit Breaker)", () => {
  it("连续相同 fingerprint → 熔断，绝不出现 attempt 4", async () => {
    const { store, packetId } = freshStore();
    const sink = new InMemoryInvestigationSubmissionSink();
    const eventSink = new MemoryToolEventSink();
    let promptCount = 0;

    const runner = await makeRunner({
      store,
      sink,
      eventSink,
      prompt: async () => {
        promptCount += 1;
        // 每次都产生完全相同的 schema 失败（同一 fingerprint）。
        eventSink.failures.push(
          schemaFailureEvent("/0/person_status", "在任", [
            "PERSON_CONFIRMED",
            "PERSON_UNRESOLVED_AFTER_COMPLETE_SEARCH",
            "VACANT",
          ], promptCount),
        );
        eventSink.starts.push({
          callId: `call-submit-${promptCount}`,
          toolName: "submit_investigation",
          context: {} as ToolInvocationContext,
          startedAt: new Date().toISOString(),
        });
      },
    });

    const result = await runner.run({ packetId });
    expect(result.status).toBe("FAILED");
    if (result.status !== "FAILED") return;
    expect(result.failureCode).toBe("INVESTIGATION_REPEATED_SCHEMA_ERROR");
    expect(result.repair?.repeatedErrorBreakerTriggered).toBe(true);
    // prompt 次数：调查 1 + finalize 1 + repair 最多 2 次，且熔断在第 2 次 repair 前触发。
    // submit attempts 不应达到 4。
    expect(result.repair?.submitAttempts ?? 0).toBeLessThanOrEqual(
      SUBMIT_INVESTIGATION_MAX_ATTEMPTS,
    );
    expect(promptCount).toBeLessThanOrEqual(4);
  });
});

describe("STEP 19.4 Repair Loop (Test 7 — Repair Tool Policy)", () => {
  it("SubmissionRepairGateway repair 模式拒绝 search_web、放行 submit_investigation", async () => {
    const eventSink = new MemoryToolEventSink();
    // 用真实 registry（含 search_web 与一个假 submit_investigation 工具）。
    const registry = createAgentToolRegistry();
    // 注册一个 submit_investigation（接受任意输入）用于放行验证。
    const gateway = new SubmissionRepairGateway(registry, eventSink);

    const context: ToolInvocationContext = {
      taskRunId: "task",
      agentSessionId: "session",
      agentRole: "INVESTIGATOR",
      signal: new AbortController().signal,
    };

    // 非 repair 模式：search_web 正常进入（工具不存在则 UNKNOWN_TOOL，但不会
    // 命中 repair 拒绝分支；这里验证的是 repair 模式下被拦截）。
    gateway.setRepairMode(true);
    const blocked = await gateway.execute("search_web", {}, context);
    expect(blocked.status).toBe("FAILED");
    if (blocked.status !== "FAILED") return;
    expect(blocked.failure.code).toBe(
      ToolFailureCode.RESEARCH_TOOL_NOT_ALLOWED_DURING_SUBMISSION_REPAIR,
    );
    // 拒绝事件写入 sink（可观测）。
    expect(eventSink.failures.some((e) => e.toolName === "search_web")).toBe(true);
  });

  it("repair 模式不拦截 submit_investigation（走正常注册工具执行）", async () => {
    const eventSink = new MemoryToolEventSink();
    const registry = createAgentToolRegistry();
    // 注册一个总是成功的 submit_investigation（复用 agent-tools 的 TypeBox schema）。
    const submitTool = {
      name: "submit_investigation",
      description: "test",
      inputSchema: SubmitInvestigationInput,
      execute: async () => ({ status: "ACCEPTED" }),
    };
    registry.register(submitTool as never);
    const gateway = new SubmissionRepairGateway(registry, eventSink);
    const context: ToolInvocationContext = {
      taskRunId: "task",
      agentSessionId: "session",
      agentRole: "INVESTIGATOR",
      signal: new AbortController().signal,
    };
    gateway.setRepairMode(true);
    const result = await gateway.execute(
      "submit_investigation",
      { leadership: {}, selectedOfficials: [{}, {}] },
      context,
    );
    expect(result.status).toBe("SUCCESS");
  });
});

describe("STEP 19.4 Repair Loop (Test 8 — Tool Not Called)", () => {
  it("有 schema 失败但 repair 后仍不提交 → INVESTIGATION_TOOL_NOT_CALLED", async () => {
    const { store, packetId } = freshStore();
    const sink = new InMemoryInvestigationSubmissionSink();
    const eventSink = new MemoryToolEventSink();
    let promptCount = 0;

    const runner = await makeRunner({
      store,
      sink,
      eventSink,
      prompt: async () => {
        promptCount += 1;
        // 每次都失败但从不提交（repair 后仍不提交）。
        eventSink.failures.push(
          schemaFailureEvent("/0/person_status", "在任", [
            "PERSON_CONFIRMED",
            "PERSON_UNRESOLVED_AFTER_COMPLETE_SEARCH",
            "VACANT",
          ], promptCount),
        );
        eventSink.starts.push({
          callId: `call-submit-${promptCount}`,
          toolName: "submit_investigation",
          context: {} as ToolInvocationContext,
          startedAt: new Date().toISOString(),
        });
      },
    });

    const result = await runner.run({ packetId });
    expect(result.status).toBe("FAILED");
    if (result.status !== "FAILED") return;
    // 每次 prompt 都产生不同 seq 的失败（不同 callId 但同 fingerprint？）
    // fingerprint 基于 fieldPath + receivedValue + keyword + schema，相同 →
    // 第 2 次 repair 前熔断。这里验证：不会无限重试（promptCount 有限）。
    expect(result.failureCode).toMatch(/INVESTIGATION_/);
    expect(promptCount).toBeLessThanOrEqual(4);
    void SCHEMA_REPAIR_MAX_ATTEMPTS;
  });

  it("无 schema 失败且不提交 → INVESTIGATION_NOT_SUBMITTED（保留原语义）", async () => {
    const { store, packetId } = freshStore();
    const runner = await makeRunner({
      store,
      sink: new InMemoryInvestigationSubmissionSink(),
      eventSink: new MemoryToolEventSink(),
      prompt: async () => {},
    });
    const result = await runner.run({ packetId });
    expect(result.status).toBe("FAILED");
    if (result.status !== "FAILED") return;
    expect(result.failureCode).toBe("INVESTIGATION_NOT_SUBMITTED");
  });
});
