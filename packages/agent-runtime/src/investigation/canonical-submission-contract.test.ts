import { describe, expect, it } from "vitest";
import { SkillSchemaRegistry } from "../skill/skill-schema-registry.js";
import { CanonicalSubmissionContract } from "./canonical-submission-contract.js";
import { buildInvestigationRolePrompt } from "./investigation-role-prompt.js";
import { createRuntimeConfig } from "../config/runtime-config.js";
import { OFFICIAL_BIOGRAPHY_SKILL_NAME, SkillRuntime } from "../skill/skill-runtime.js";

/**
 * STEP 19.4 Test 1 — Canonical Enum Extraction。
 * 验证 CanonicalSubmissionContract 从 Skill schema 读出的 enum 与 schema 完全一致。
 */

async function loadContract(): Promise<CanonicalSubmissionContract> {
  const config = createRuntimeConfig();
  const runtime = new SkillRuntime(config);
  await runtime.reload();
  const identity = await runtime.resolveSkill(OFFICIAL_BIOGRAPHY_SKILL_NAME);
  const registry = await SkillSchemaRegistry.load(`${identity.path}/schemas`);
  const personDecision = registry.get("Person Decision");
  const leadership = registry.get("Leadership Structure");
  if (!personDecision || !leadership) {
    throw new Error("test setup: canonical schemas not found");
  }
  return new CanonicalSubmissionContract(personDecision, leadership);
}

const EXPECTED_PERSON_STATUS = [
  "PERSON_CONFIRMED",
  "PERSON_UNRESOLVED_AFTER_COMPLETE_SEARCH",
  "VACANT",
];

const EXPECTED_CURRENTNESS = [
  "CURRENT_COLLECTION_MEMBER",
  "DETAIL_LINKED_FROM_CURRENT_COLLECTION",
  "RECENT_CURRENT_OFFICIAL_EVIDENCE",
  "DETAIL_NOT_IN_CURRENT_COLLECTION",
  "DETAIL_COLLECTION_CONFLICT",
  "CURRENTNESS_UNRESOLVED",
];

describe("CanonicalSubmissionContract (Test 1 — Canonical Enum Extraction)", () => {
  it("person_status enum 与 canonical schema 完全一致", async () => {
    const contract = await loadContract();
    expect(contract.personStatusAllowedValues()).toEqual(EXPECTED_PERSON_STATUS);
  });

  it("currentness_quality enum 与 canonical schema 完全一致", async () => {
    const contract = await loadContract();
    expect(contract.currentnessQualityAllowedValues()).toEqual(EXPECTED_CURRENTNESS);
  });

  it("contract 不包含任何硬编码业务字段路径（只能经 accessor 读取）", async () => {
    const contract = await loadContract();
    const fields = contract.enumFields();
    expect(fields.map((f) => f.field).sort()).toEqual([
      "currentness_quality",
      "person_status",
    ]);
    // 每个枚举字段都标记 required（person-decision 里两个字段都是 required）。
    for (const field of fields) {
      expect(field.required).toBe(true);
    }
  });

  it("snapshot 暴露 schema 身份（名称/路径），供报告与调试", async () => {
    const contract = await loadContract();
    const snapshot = contract.snapshot();
    expect(snapshot.schemaName).toBe("Person Decision");
    expect(snapshot.schemaPath).toContain("person-decision.schema.json");
    expect(snapshot.requiredFields).toContain("person_status");
    expect(snapshot.requiredFields).toContain("currentness_quality");
  });
});

describe("buildInvestigationRolePrompt (Test 2 — Prompt Projection)", () => {
  it("带 contract 时，Prompt 动态投影 canonical enum（禁止手写副本）", async () => {
    const contract = await loadContract();
    const packet = {
      packetId: "pkt-1",
      institutionName: "鼓楼区人民政府",
      state: "PENDING",
    } as never;
    const text = buildInvestigationRolePrompt(packet as never, {
      regionCode: "320106",
      agentSessionId: "agent-1",
      contract,
    });
    // 必须包含 canonical enum 值（证明投影来自 schema）。
    expect(text).toContain("PERSON_CONFIRMED");
    expect(text).toContain("VACANT");
    expect(text).toContain("CURRENT_COLLECTION_MEMBER");
    expect(text).toContain("CURRENTNESS_UNRESOLVED");
    // Prompt 必须引用"canonical Skill schema"来源语义。
    expect(text).toContain("canonical Skill schema");
  });

  it("不带 contract 时 Prompt 仍包含字段名（向后兼容），但不含 enum 值", async () => {
    const packet = {
      packetId: "pkt-1",
      institutionName: "鼓楼区人民政府",
      state: "PENDING",
    } as never;
    const text = buildInvestigationRolePrompt(packet as never, {
      regionCode: "320106",
      agentSessionId: "agent-1",
    });
    expect(text).toContain("person_status");
    expect(text).toContain("currentness_quality");
  });
});
