import { describe, expect, it } from "vitest";
import { ToolFailureCode, ToolFailureError } from "../../contracts/tool-failure-codes.js";
import { createSubmitInvestigatorEvidenceTool } from "./submit-investigator-evidence.js";
import type {
  EvidencePrimaryDecision,
  InvestigatorEvidenceSubmissionPayload,
  InvestigatorEvidenceSubmissionSink,
  InvestigatorEvidenceSubmissionValidator,
  InvestigatorEvidenceSubmitResult,
} from "./investigator-evidence-submission.js";

const PRIMARY_1_TARGET = "glq-target-primary1";
const PRIMARY_2_TARGET = "glq-target-primary2";

const PRIMARY_DECISIONS: EvidencePrimaryDecision[] = [
  { targetId: PRIMARY_1_TARGET, personId: "person-wang", personName: "王安伟", primarySlot: "PRIMARY_1" },
  { targetId: PRIMARY_2_TARGET, personId: "person-dong", personName: "董涵", primarySlot: "PRIMARY_2" },
];

const stubValidator: InvestigatorEvidenceSubmissionValidator = {
  validate: () => ({ valid: true }),
};

class Sink implements InvestigatorEvidenceSubmissionSink {
  private stored: InvestigatorEvidenceSubmissionPayload | null = null;
  async submit(
    payload: InvestigatorEvidenceSubmissionPayload,
  ): Promise<InvestigatorEvidenceSubmitResult> {
    if (this.stored) return { status: "ALREADY_SUBMITTED", payloadHash: "h" };
    this.stored = payload;
    return { status: "ACCEPTED", payloadHash: "h" };
  }
  async getSubmission() {
    return this.stored;
  }
  async isFrozen() {
    return this.stored !== null;
  }
}

function candidate(targetId: string, url: string) {
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

function validPayload() {
  return {
    candidates: [
      candidate(PRIMARY_1_TARGET, "https://www.njgl.gov.cn/zfxxgk/ldzc/1.html"),
      candidate(PRIMARY_2_TARGET, "https://www.njgl.gov.cn/zfxxgk/ldzc/2.html"),
    ],
  };
}

async function runTool(
  input: unknown,
  deps?: Partial<{
    validator: InvestigatorEvidenceSubmissionValidator;
    sink: Sink;
    primaryDecisions: EvidencePrimaryDecision[];
  }>,
) {
  const tool = createSubmitInvestigatorEvidenceTool({
    validator: deps?.validator ?? stubValidator,
    sink: deps?.sink ?? new Sink(),
    primaryDecisions: deps?.primaryDecisions ?? PRIMARY_DECISIONS,
  });
  return tool.execute(
    {
      taskRunId: "t",
      agentSessionId: "s",
      agentRole: "INVESTIGATOR",
      signal: new AbortController().signal,
    },
    input as never,
  );
}

describe("createSubmitInvestigatorEvidenceTool", () => {
  it("accepts a valid canonical submission covering both PRIMARYs", async () => {
    const result = await runTool(validPayload());
    expect(result.status).toBe("ACCEPTED");
    expect(result.frozen).toBe(true);
    expect(result.candidateCount).toBe(2);
    expect(result.primary1CandidateCount).toBe(1);
    expect(result.primary2CandidateCount).toBe(1);
    expect(result.primary1TargetId).toBe(PRIMARY_1_TARGET);
    expect(result.primary2TargetId).toBe(PRIMARY_2_TARGET);
  });

  it("rejects a payload that fails Skill schema validation", async () => {
    const invalid: InvestigatorEvidenceSubmissionValidator = {
      validate: () => ({ valid: false, errors: ["candidates[0]: missing required property 'url'"] }),
    };
    await expect(runTool(validPayload(), { validator: invalid })).rejects.toThrow(ToolFailureError);
    await expect(runTool(validPayload(), { validator: invalid })).rejects.toMatchObject({
      code: ToolFailureCode.EVIDENCE_SCHEMA_VALIDATION_FAILED,
    });
  });

  it("rejects a second submission after the first is frozen", async () => {
    const sink = new Sink();
    await runTool(validPayload(), { sink });
    await expect(runTool(validPayload(), { sink })).rejects.toMatchObject({
      code: ToolFailureCode.INVESTIGATOR_EVIDENCE_ALREADY_SUBMITTED,
    });
  });

  it("rejects a candidate belonging to an unknown third person target", async () => {
    const payload = {
      candidates: [
        candidate("third-party-target", "https://example.com/x"),
        candidate(PRIMARY_2_TARGET, "https://www.njgl.gov.cn/zfxxgk/ldzc/2.html"),
      ],
    };
    await expect(runTool(payload)).rejects.toMatchObject({
      code: ToolFailureCode.POSITION_CANDIDATE_UNKNOWN_PRIMARY,
    });
  });

  it("rejects a submission that leaves a PRIMARY uncovered", async () => {
    const payload = {
      candidates: [candidate(PRIMARY_1_TARGET, "https://www.njgl.gov.cn/zfxxgk/ldzc/1.html")],
    };
    await expect(runTool(payload)).rejects.toMatchObject({
      code: ToolFailureCode.POSITION_CANDIDATE_COVERAGE_REQUIRED,
    });
  });


  it("carries structured repair details when the validator reports enum issues", async () => {
    const validator: InvestigatorEvidenceSubmissionValidator = {
      validate: () => ({
        valid: false,
        errors: ["candidates[0]: /candidate_status must be equal to one of the allowed values"],
        details: [
          {
            errorCode: "SUBMISSION_SCHEMA_VALIDATION_FAILED",
            fieldPath: "/candidates/0/candidate_status",
            receivedValue: "DEFINITELY_ACCEPTED",
            validationKeyword: "enum",
            allowedValues: ["ACCEPTED_AS_FINAL", "REJECTED_NON_OFFICIAL_SOURCE"],
            repairInstruction: "仅修正该字段为允许值之一。不要重新搜索。",
          },
        ],
      }),
    };
    await expect(runTool(validPayload(), { validator })).rejects.toMatchObject({
      code: ToolFailureCode.EVIDENCE_SCHEMA_VALIDATION_FAILED,
      message: expect.stringContaining("允许值"),
      details: expect.any(Array),
    });
  });
});
