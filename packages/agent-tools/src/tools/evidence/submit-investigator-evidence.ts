import { Type, type Static } from "@sinclair/typebox";
import { ToolFailureCode, ToolFailureError } from "../../contracts/tool-failure-codes.js";
import type { AgentToolDefinition } from "../../contracts/tool-types.js";
import type {
  EvidencePrimaryDecision,
  InvestigatorEvidenceSubmissionPayload,
  InvestigatorEvidenceSubmissionSink,
  InvestigatorEvidenceSubmissionValidator,
  StructuredEvidenceSubmissionValidation,
  SubmitInvestigatorEvidenceSuccess,
} from "./investigator-evidence-submission.js";
import { formatEvidenceValidationRepairMessage } from "./investigator-evidence-submission.js";

const candidateArtifact = Type.Object({}, { additionalProperties: true });
const claimArtifact = Type.Object({}, { additionalProperties: true });

export const SubmitInvestigatorEvidenceInput = Type.Object(
  {
    candidates: Type.Array(candidateArtifact, { minItems: 1 }),
    claims: Type.Optional(Type.Array(claimArtifact)),
  },
  { additionalProperties: false },
);

export type SubmitInvestigatorEvidenceInput = Static<typeof SubmitInvestigatorEvidenceInput>;

export type SubmitInvestigatorEvidenceToolDeps = {
  validator: InvestigatorEvidenceSubmissionValidator;
  sink: InvestigatorEvidenceSubmissionSink;
  /** Frozen PRIMARY person decisions (deterministic target join). */
  primaryDecisions: EvidencePrimaryDecision[];
};

/**
 * Evidence output boundary tool.
 *
 * Pi knows only `submit_investigator_evidence`. The tool validates the
 * canonical url-candidate-pool / target-claim schemas, enforces the
 * deterministic PRIMARY join (every candidate/claim target must belong to a
 * frozen PRIMARY), requires both PRIMARYs to be covered, and accepts exactly
 * one submission per packet. No final-URL selection is performed here.
 */
export function createSubmitInvestigatorEvidenceTool(
  deps: SubmitInvestigatorEvidenceToolDeps,
): AgentToolDefinition<typeof SubmitInvestigatorEvidenceInput, SubmitInvestigatorEvidenceSuccess> {
  return {
    name: "submit_investigator_evidence",
    description:
      "Submit the Position URL Candidate Pool for the frozen PRIMARY_1/PRIMARY_2 of the current institution. The payload must follow the official-biography-evidence url-candidate-pool and target-claim schemas; every candidate target must belong to a frozen PRIMARY and both PRIMARYs must be covered. Exactly one submission is accepted per packet.",
    inputSchema: SubmitInvestigatorEvidenceInput,
    async execute(_context, input) {
      const payload: InvestigatorEvidenceSubmissionPayload = {
        candidates: input.candidates as Record<string, unknown>[],
        ...(input.claims ? { claims: input.claims as Record<string, unknown>[] } : {}),
      };
      const validation = deps.validator.validate(payload) as StructuredEvidenceSubmissionValidation;
      if (!validation.valid) {
        const issues = validation.details ?? [];
        const message = issues.length > 0
          ? formatEvidenceValidationRepairMessage(issues)
          : `submit_investigator_evidence failed Skill schema validation: ${validation.errors.join("; ")}`;
        throw new ToolFailureError({
          code: ToolFailureCode.EVIDENCE_SCHEMA_VALIDATION_FAILED,
          message,
          retryable: false,
          ...(issues.length > 0 ? { details: issues } : {}),
        });
      }

      const primary1 = deps.primaryDecisions.find((d) => d.primarySlot === "PRIMARY_1");
      const primary2 = deps.primaryDecisions.find((d) => d.primarySlot === "PRIMARY_2");
      if (!primary1 || !primary2) {
        throw new ToolFailureError({
          code: ToolFailureCode.INVALID_INPUT,
          message: "submit_investigator_evidence requires both frozen PRIMARY decisions",
          retryable: false,
        });
      }

      // Deterministic PRIMARY join: every candidate target must be a frozen PRIMARY.
      for (const candidate of payload.candidates) {
        const targetId = typeof candidate.target_id === "string" ? candidate.target_id : "";
        if (targetId !== primary1.targetId && targetId !== primary2.targetId) {
          throw new ToolFailureError({
            code: ToolFailureCode.POSITION_CANDIDATE_UNKNOWN_PRIMARY,
            message: `candidate target_id ${targetId} does not belong to a frozen PRIMARY`,
            retryable: false,
          });
        }
      }
      // Claims join on target AND (when the frozen person is known) person.
      for (const claim of payload.claims ?? []) {
        const targetId = typeof claim.target_id === "string" ? claim.target_id : "";
        const personId = typeof claim.person_id === "string" ? claim.person_id : null;
        const decision = [primary1, primary2].find((d) => d.targetId === targetId);
        if (!decision) {
          throw new ToolFailureError({
            code: ToolFailureCode.POSITION_CANDIDATE_UNKNOWN_PRIMARY,
            message: `claim target_id ${targetId} does not belong to a frozen PRIMARY`,
            retryable: false,
          });
        }
        if (decision.personId !== null && personId !== decision.personId) {
          throw new ToolFailureError({
            code: ToolFailureCode.POSITION_CANDIDATE_UNKNOWN_PRIMARY,
            message: `claim person_id ${personId} does not match frozen PRIMARY ${decision.primarySlot}`,
            retryable: false,
          });
        }
      }

      // Coverage: both PRIMARYs must be covered by at least one candidate.
      const primary1CandidateCount = payload.candidates.filter(
        (candidate) => candidate.target_id === primary1.targetId,
      ).length;
      const primary2CandidateCount = payload.candidates.filter(
        (candidate) => candidate.target_id === primary2.targetId,
      ).length;
      if (primary1CandidateCount < 1 || primary2CandidateCount < 1) {
        throw new ToolFailureError({
          code: ToolFailureCode.POSITION_CANDIDATE_COVERAGE_REQUIRED,
          message: `PRIMARY_1 candidates=${primary1CandidateCount}, PRIMARY_2 candidates=${primary2CandidateCount}; both PRIMARYs must be covered`,
          retryable: false,
        });
      }

      const result = await deps.sink.submit(payload);
      if (result.status === "ALREADY_SUBMITTED") {
        throw new ToolFailureError({
          code: ToolFailureCode.INVESTIGATOR_EVIDENCE_ALREADY_SUBMITTED,
          message: "Investigator evidence already submitted and frozen for this packet",
          retryable: false,
        });
      }

      return {
        status: "ACCEPTED",
        frozen: true,
        candidatesValidated: true,
        claimsValidated: payload.claims !== undefined,
        candidateCount: payload.candidates.length,
        primary1TargetId: primary1.targetId,
        primary2TargetId: primary2.targetId,
        primary1CandidateCount,
        primary2CandidateCount,
        payloadHash: result.payloadHash,
      };
    },
  };
}
