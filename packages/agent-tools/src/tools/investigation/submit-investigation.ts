import { Type, type Static } from "@sinclair/typebox";
import { ToolFailureCode, ToolFailureError } from "../../contracts/tool-failure-codes.js";
import type { AgentToolDefinition } from "../../contracts/tool-types.js";
import type {
  InvestigationSubmissionPayload,
  InvestigationSubmissionSink,
  InvestigationSubmissionValidator,
  LeadershipStructureArtifact,
  PersonDecisionArtifact,
  StructuredSubmissionValidation,
  SubmitInvestigationSuccess,
} from "./investigation-submission.js";
import { formatValidationRepairMessage } from "./investigation-submission.js";

/** Opaque canonical artifacts; the full shape is enforced by the Skill schemas. */
const leadershipArtifact = Type.Object({}, { additionalProperties: true });
const personDecisionArtifact = Type.Object({}, { additionalProperties: true });

export const SubmitInvestigationInput = Type.Object(
  {
    leadership: leadershipArtifact,
    selectedOfficials: Type.Array(personDecisionArtifact, { minItems: 2, maxItems: 2 }),
  },
  { additionalProperties: false },
);

export type SubmitInvestigationInput = Static<typeof SubmitInvestigationInput>;

export type SubmitInvestigationToolDeps = {
  /** Validates the envelope parts against the canonical Skill schemas. */
  validator: InvestigationSubmissionValidator;
  /** Stores the first accepted submission (one freeze per packet). */
  sink: InvestigationSubmissionSink;
};

/**
 * Investigation output boundary tool.
 *
 * Pi knows only `submit_investigation`; the concrete Skill-schema validator
 * and the in-memory sink are wired server-side by the InvestigatorAgentRunner.
 * The tool validates both canonical artifacts, enforces the mechanical
 * distinct-person gate (PRIMARY_1 != PRIMARY_2), accepts exactly one
 * submission per packet, and rejects any later override.
 *
 * STEP 19.4：schema 失败时，若 validator 返回结构化 details（含 fieldPath /
 * receivedValue / allowedValues / repairInstruction），错误消息使用精确
 * repair 反馈，而不是只有泛化的 allowed-values 提示。
 */
export function createSubmitInvestigationTool(
  deps: SubmitInvestigationToolDeps,
): AgentToolDefinition<typeof SubmitInvestigationInput, SubmitInvestigationSuccess> {
  return {
    name: "submit_investigation",
    description:
      "Submit the complete leadership structure and the selected PRIMARY_1/PRIMARY_2 person decisions for the current institution. The payload must follow the official-biography-evidence leadership-structure and person-decision schemas. Exactly one submission is accepted per packet; a later submission is rejected.",
    inputSchema: SubmitInvestigationInput,
    async execute(_context, input) {
      const leadership = input.leadership as LeadershipStructureArtifact;
      const selectedOfficials = input.selectedOfficials as PersonDecisionArtifact[];
      const payload: InvestigationSubmissionPayload = { leadership, selectedOfficials };
      const validation = deps.validator.validate(payload) as StructuredSubmissionValidation;
      if (!validation.valid) {
        const issues = validation.details ?? [];
        const message = issues.length > 0
          ? formatValidationRepairMessage(issues)
          : `submit_investigation failed Skill schema validation: ${validation.errors.join("; ")}`;
        throw new ToolFailureError({
          // 兼容既有 ToolFailureCode.SCHEMA_VALIDATION_FAILED 契约；具体错误
          // 类型由 details[].errorCode = SUBMISSION_SCHEMA_VALIDATION_FAILED 区分。
          code: ToolFailureCode.SCHEMA_VALIDATION_FAILED,
          message,
          retryable: false,
          ...(issues.length > 0 ? { details: issues } : {}),
        });
      }

      const primary1 = selectedOfficials[0];
      const primary2 = selectedOfficials[1];
      if (!primary1 || !primary2) {
        throw new ToolFailureError({
          code: ToolFailureCode.INVALID_INPUT,
          message: "submit_investigation requires exactly two selected officials",
          retryable: false,
        });
      }
      // Deterministic uniqueness check only — PRIMARY ranking is Skill -> Pi.
      if (samePerson(personIdentity(primary1), personIdentity(primary2))) {
        throw new ToolFailureError({
          code: ToolFailureCode.PRIMARY_PEOPLE_NOT_DISTINCT,
          message: "PRIMARY_1 and PRIMARY_2 must be two distinct natural persons",
          retryable: false,
        });
      }

      const result = await deps.sink.submit(payload);
      if (result.status === "ALREADY_SUBMITTED") {
        throw new ToolFailureError({
          code: ToolFailureCode.INVESTIGATION_ALREADY_SUBMITTED,
          message: "Investigation already submitted and frozen for this packet",
          retryable: false,
        });
      }

      const name1 = personName(selectedOfficials, "PRIMARY_1");
      const name2 = personName(selectedOfficials, "PRIMARY_2");
      return {
        status: "ACCEPTED",
        frozen: true,
        leadershipValidated: true,
        selectedOfficialsValidated: true,
        primary1: name1,
        primary2: name2,
        primaryPeopleDistinct: true,
        payloadHash: result.payloadHash,
      };
    },
  };
}

/** Read only the identity fields needed for the deterministic distinctness gate. */
function personIdentity(
  record: PersonDecisionArtifact,
): { id: string | undefined; name: string | undefined } {
  const id = typeof record.person_id === "string" ? record.person_id : undefined;
  const name = typeof record.person_name === "string" ? record.person_name : undefined;
  return { id, name };
}

/** Same person when both ids are present and equal, else both names equal. */
function samePerson(
  a: { id: string | undefined; name: string | undefined },
  b: { id: string | undefined; name: string | undefined },
): boolean {
  if (a.id && b.id) return a.id === b.id;
  if (a.name && b.name) return a.name === b.name;
  return false;
}

function personName(officials: PersonDecisionArtifact[], slot: string): string | null {
  const found = officials.find((record) => record.primary_slot === slot);
  return found && typeof found.person_name === "string" ? found.person_name : null;
}
