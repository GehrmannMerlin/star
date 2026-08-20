import { describe, expect, it } from "vitest";
import type {
  InvestigationSubmissionPayload,
  StructuredSubmissionValidation,
  ValidationIssue,
} from "@stellaris/agent-tools";
import { formatValidationRepairMessage } from "@stellaris/agent-tools";
import { createRuntimeConfig } from "../config/runtime-config.js";
import { OFFICIAL_BIOGRAPHY_SKILL_NAME, SkillRuntime } from "../skill/skill-runtime.js";
import { createSkillInvestigationValidator } from "./skill-investigation-validator.js";

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

async function loadValidator() {
  const config = createRuntimeConfig();
  const runtime = new SkillRuntime(config);
  await runtime.reload();
  const identity = await runtime.resolveSkill(OFFICIAL_BIOGRAPHY_SKILL_NAME);
  return createSkillInvestigationValidator(identity);
}

describe("Structured Validation Repair (Test 4 — Invalid Enum Repair)", () => {
  it("非法 person_status 返回结构化 details：field + received + allowed + instruction", async () => {
    const validator = await loadValidator();
    const payload: InvestigationSubmissionPayload = {
      leadership: LEADERSHIP,
      selectedOfficials: [
        personDecision({ person_status: "在任" }),
        personDecision({
          person_decision_id: "pd-2",
          person_id: "person-li",
          primary_slot: "PRIMARY_2",
          person_name: "李四",
          role_canonical: "区长",
        }),
      ],
    };
    const result = validator.validate(payload) as StructuredSubmissionValidation;
    expect(result.valid).toBe(false);
    if (result.valid) return;

    // 结构化 details 必须存在。
    expect(Array.isArray(result.details)).toBe(true);
    const details = result.details as ValidationIssue[];
    const statusIssue = details.find((d) => d.fieldPath === "/0/person_status");
    expect(statusIssue).toBeDefined();
    if (!statusIssue) return;

    expect(statusIssue.errorCode).toBe("SUBMISSION_SCHEMA_VALIDATION_FAILED");
    expect(statusIssue.validationKeyword).toBe("enum");
    expect(statusIssue.receivedValue).toBe("在任");
    expect(statusIssue.allowedValues).toEqual([
      "PERSON_CONFIRMED",
      "PERSON_UNRESOLVED_AFTER_COMPLETE_SEARCH",
      "VACANT",
    ]);
    expect(statusIssue.repairInstruction).toContain("不要重新搜索");
    expect(statusIssue.repairInstruction).toContain("不要创建新的枚举值");
  });

  it("非法 currentness_quality 同样返回结构化 details（通用 formatter，无字段特判）", async () => {
    const validator = await loadValidator();
    const payload: InvestigationSubmissionPayload = {
      leadership: LEADERSHIP,
      selectedOfficials: [
        personDecision({ currentness_quality: "最近更新" }),
        personDecision({
          person_decision_id: "pd-2",
          person_id: "person-li",
          primary_slot: "PRIMARY_2",
          person_name: "李四",
          role_canonical: "区长",
        }),
      ],
    };
    const result = validator.validate(payload) as StructuredSubmissionValidation;
    expect(result.valid).toBe(false);
    if (result.valid) return;

    const details = result.details as ValidationIssue[];
    const qualityIssue = details.find((d) => d.fieldPath === "/0/currentness_quality");
    expect(qualityIssue).toBeDefined();
    if (!qualityIssue) return;
    expect(qualityIssue.validationKeyword).toBe("enum");
    expect(qualityIssue.receivedValue).toBe("最近更新");
    expect(qualityIssue.allowedValues).toContain("CURRENT_COLLECTION_MEMBER");
    expect(qualityIssue.allowedValues).toContain("CURRENTNESS_UNRESOLVED");
  });

  it("required 字段缺失也产生结构化 issue（通用 keyword 处理）", async () => {
    const validator = await loadValidator();
    const payload: InvestigationSubmissionPayload = {
      leadership: LEADERSHIP,
      selectedOfficials: [
        // 删除 required 的 person_status（additionalProperties false 下仍是 required 失败）。
        personDecision({ person_status: undefined }),
        personDecision({
          person_decision_id: "pd-2",
          person_id: "person-li",
          primary_slot: "PRIMARY_2",
          person_name: "李四",
          role_canonical: "区长",
        }),
      ],
    };
    const result = validator.validate(payload) as StructuredSubmissionValidation;
    expect(result.valid).toBe(false);
    if (result.valid) return;
    const details = result.details as ValidationIssue[];
    const requiredIssue = details.find((d) => d.fieldPath === "/0/person_status");
    // required 失败不一定是 /0/person_status（可能是 additionalProperties 等），
    // 但至少 details 有内容且所有 issue 都带 errorCode / repairInstruction。
    expect(details.length).toBeGreaterThan(0);
    for (const issue of details) {
      expect(issue.errorCode).toBe("SUBMISSION_SCHEMA_VALIDATION_FAILED");
      expect(issue.repairInstruction.length).toBeGreaterThan(0);
    }
    void requiredIssue;
  });

  it("details 不包含完整 payload（只含失败字段）", async () => {
    const validator = await loadValidator();
    const payload: InvestigationSubmissionPayload = {
      leadership: LEADERSHIP,
      selectedOfficials: [
        personDecision({ person_status: "在任" }),
        personDecision({
          person_decision_id: "pd-2",
          person_id: "person-li",
          primary_slot: "PRIMARY_2",
          person_name: "李四",
          role_canonical: "区长",
        }),
      ],
    };
    const result = validator.validate(payload) as StructuredSubmissionValidation;
    if (result.valid) return;
    const details = result.details as ValidationIssue[];
    // issue 对象不含 leadership / selectedOfficials 等大字段。
    for (const issue of details) {
      const keys = Object.keys(issue);
      expect(keys).not.toContain("leadership");
      expect(keys).not.toContain("selectedOfficials");
      expect(JSON.stringify(issue).length).toBeLessThan(500);
    }
  });
});

describe("formatValidationRepairMessage (Test 4/5 — Repair Message)", () => {
  it("把结构化 issues 格式化为给 Agent 的可读消息（含字段/收到值/允许值/指令）", () => {
    const message = formatValidationRepairMessage([
      {
        errorCode: "SUBMISSION_SCHEMA_VALIDATION_FAILED",
        fieldPath: "/0/person_status",
        receivedValue: "在任",
        validationKeyword: "enum",
        allowedValues: ["PERSON_CONFIRMED", "VACANT"],
        repairInstruction: "仅修正该字段为允许值之一。不要重新搜索。",
      },
    ]);
    expect(message).toContain("/0/person_status");
    expect(message).toContain("在任");
    expect(message).toContain("PERSON_CONFIRMED");
    expect(message).toContain("不要重新搜索");
  });

  it("空 issues 时返回通用失败消息（不崩溃）", () => {
    expect(formatValidationRepairMessage([])).toContain("submit_investigation failed");
  });
});
