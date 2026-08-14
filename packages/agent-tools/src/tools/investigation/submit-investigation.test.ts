import { describe, expect, it } from "vitest";
import { Value } from "@sinclair/typebox/value";
import { ToolFailureCode } from "../../contracts/tool-failure-codes.js";
import type { SubmissionValidation } from "../inventory/inventory-submission.js";
import type {
  InvestigationSubmissionPayload,
  InvestigationSubmissionSink,
  InvestigationSubmissionValidator,
  SubmitInvestigationSuccess,
} from "./investigation-submission.js";
import { createSubmitInvestigationTool, SubmitInvestigationInput } from "./submit-investigation.js";

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

const VALID = { leadership: LEADERSHIP, selectedOfficials: [PRIMARY_1, PRIMARY_2] };

const context = () => ({
  taskRunId: "task-1",
  agentSessionId: "session-1",
  agentRole: "INVESTIGATOR" as const,
  signal: new AbortController().signal,
});

class RecordingSink implements InvestigationSubmissionSink {
  submission: InvestigationSubmissionPayload | null = null;
  private payloadHash = "";
  async submit(payload: InvestigationSubmissionPayload) {
    if (this.submission) {
      return { status: "ALREADY_SUBMITTED" as const, payloadHash: this.payloadHash };
    }
    this.submission = payload;
    this.payloadHash = "hash-1";
    return { status: "ACCEPTED" as const, payloadHash: this.payloadHash };
  }
  async getSubmission() {
    return this.submission;
  }
  async isFrozen() {
    return this.submission !== null;
  }
}

function validator(
  overrides?: { valid?: boolean; errors?: string[] },
): InvestigationSubmissionValidator {
  const result: SubmissionValidation =
    overrides?.valid === false
      ? { valid: false, errors: overrides.errors ?? ["bad artifact"] }
      : { valid: true };
  return { validate: () => result };
}

describe("submit_investigation tool", () => {
  it("accepts a valid canonical submission and freezes it", async () => {
    const sink = new RecordingSink();
    const tool = createSubmitInvestigationTool({ validator: validator(), sink });
    const result = await tool.execute(context(), VALID);
    expect(result.status).toBe("ACCEPTED");
    const success = result as SubmitInvestigationSuccess;
    expect(success.frozen).toBe(true);
    expect(success.leadershipValidated).toBe(true);
    expect(success.selectedOfficialsValidated).toBe(true);
    expect(success.primary1).toBe("张三");
    expect(success.primary2).toBe("李四");
    expect(success.primaryPeopleDistinct).toBe(true);
    expect(await sink.isFrozen()).toBe(true);
  });

  it("rejects a submission that fails Skill schema validation", async () => {
    const tool = createSubmitInvestigationTool({
      validator: validator({
        valid: false,
        errors: ["leadership.structure_complete: must be true"],
      }),
      sink: new RecordingSink(),
    });
    await expect(tool.execute(context(), VALID)).rejects.toMatchObject({
      code: ToolFailureCode.SCHEMA_VALIDATION_FAILED,
    });
  });

  it("rejects a second submission once the investigation is frozen", async () => {
    const sink = new RecordingSink();
    const tool = createSubmitInvestigationTool({ validator: validator(), sink });
    await tool.execute(context(), VALID);
    await expect(tool.execute(context(), VALID)).rejects.toMatchObject({
      code: ToolFailureCode.INVESTIGATION_ALREADY_SUBMITTED,
    });
  });

  it("rejects PRIMARY_1 and PRIMARY_2 for the same person", async () => {
    const tool = createSubmitInvestigationTool({ validator: validator(), sink: new RecordingSink() });
    const same = {
      leadership: LEADERSHIP,
      selectedOfficials: [
        PRIMARY_1,
        { ...PRIMARY_2, person_id: "person-zhang", person_name: "张三" },
      ],
    };
    await expect(tool.execute(context(), same)).rejects.toMatchObject({
      code: ToolFailureCode.PRIMARY_PEOPLE_NOT_DISTINCT,
    });
  });

  it("rejects more than two selected officials at the input boundary", () => {
    const three = { leadership: LEADERSHIP, selectedOfficials: [PRIMARY_1, PRIMARY_2, PRIMARY_2] };
    expect(Value.Check(SubmitInvestigationInput, three)).toBe(false);
    expect(Value.Check(SubmitInvestigationInput, VALID)).toBe(true);
  });
});
