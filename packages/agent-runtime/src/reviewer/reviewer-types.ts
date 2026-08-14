import type {
  EvidencePrimaryDecision,
  ReviewerTargetReviewInput,
  UrlCandidatePoolRow,
} from "@stellaris/agent-tools";
import type { InstitutionWorkPacket } from "../work-packet/institution-work-packet.js";

export const REVIEW_NOT_SUBMITTED = "REVIEW_NOT_SUBMITTED" as const;
export const REVIEW_SCHEMA_INVALID = "REVIEW_SCHEMA_INVALID" as const;
export const REVIEW_OBSERVATION_REQUIRED = "REVIEW_OBSERVATION_REQUIRED" as const;

export type ReviewerFailureCode =
  | typeof REVIEW_NOT_SUBMITTED
  | typeof REVIEW_SCHEMA_INVALID
  | typeof REVIEW_OBSERVATION_REQUIRED;

export type ReviewerToolCallSummary = {
  toolName: string;
  called: boolean;
  succeeded: boolean;
};

/** Structured, frozen reviewer input (never Investigator reasoning/chat). */
export type ReviewerFrozenInput = {
  /** Canonical leadership-structure artifact (frozen). */
  leadership: Record<string, unknown>;
  /** Frozen person decisions (PRIMARY_1 + PRIMARY_2), canonical. */
  selectedOfficials: Array<Record<string, unknown>>;
  /** Frozen Position URL Candidate Pool (url-candidate-pool.schema.json). */
  candidatePool: UrlCandidatePoolRow[];
};

/** Business request: independently review the frozen candidates for a packet
 *  whose STEP 10 Evidence is frozen (state READY_FOR_REVIEW). */
export type ReviewerRequest = {
  packetId: string;
  frozenInput: ReviewerFrozenInput;
};

export type ReviewerFinalDecision = {
  targetId: string;
  primarySlot: "PRIMARY_1" | "PRIMARY_2";
  selectedCandidateId: string | null;
  finalUrl: string | null;
  reviewResult: ReviewerTargetReviewInput["review_result"];
};

export type ReviewerFreezeReceipt = {
  frozen: true;
  reviewsValidated: boolean;
  reviewCount: number;
  approvedCount: number;
  reworkCount: number;
  primary1Outcome: ReviewerTargetReviewInput["review_result"];
  primary2Outcome: ReviewerTargetReviewInput["review_result"];
  primary1FinalUrl: string | null;
  primary2FinalUrl: string | null;
  observationGate: "PASS" | "FAIL";
  independentSearch: boolean;
  payloadHash: string;
};

export type ReviewerCompletedResult = {
  status: "COMPLETED";
  packetId: string;
  packet: InstitutionWorkPacket;
  packetFinalState: "POSITION_DECIDED";
  /** Runtime-attested canonical Independent Review Records. */
  reviews: Array<Record<string, unknown>>;
  finalDecisions: ReviewerFinalDecision[];
  frozen: true;
  agentSessionId: string;
  skill: { name: string; version: string };
  model: { provider: string; model: string };
  toolCalls: ReviewerToolCallSummary[];
  receipt: ReviewerFreezeReceipt;
};

export type ReviewerRecoveryRequiredResult = {
  status: "RECOVERY_REQUIRED";
  packetId: string;
  packet: InstitutionWorkPacket;
  packetFinalState: "RECOVERY_REQUIRED";
  reviews: Array<Record<string, unknown>>;
  finalDecisions: ReviewerFinalDecision[];
  frozen: true;
  agentSessionId: string;
  skill: { name: string; version: string };
  model: { provider: string; model: string };
  toolCalls: ReviewerToolCallSummary[];
  receipt: ReviewerFreezeReceipt;
};

export type ReviewerFailedResult = {
  status: "FAILED";
  packetId: string;
  packet: InstitutionWorkPacket;
  packetFinalState: "FAILED";
  failureCode: ReviewerFailureCode;
  agentSessionId: string;
  toolCalls: ReviewerToolCallSummary[];
  failureDetail?: string;
};

export type ReviewerResult =
  | ReviewerCompletedResult
  | ReviewerRecoveryRequiredResult
  | ReviewerFailedResult
  | { status: "INVALID_REQUEST"; reason: string }
  | { status: "PACKET_NOT_FOUND"; packetId: string }
  | { status: "PACKET_NOT_ELIGIBLE"; packetId: string; reason: string }
  | { status: "MODEL_NOT_CONFIGURED" }
  | { status: "MODEL_NOT_FOUND"; provider: string; model: string };

export class ReviewerRuntimeError extends Error {}

/** Extract frozen PRIMARY decisions from canonical person decisions. */
export function extractReviewerPrimaryDecisions(
  selectedOfficials: Array<Record<string, unknown>>,
): { primary1: EvidencePrimaryDecision; primary2: EvidencePrimaryDecision } | null {
  let primary1: EvidencePrimaryDecision | undefined;
  let primary2: EvidencePrimaryDecision | undefined;
  for (const record of selectedOfficials) {
    const targetId = typeof record.target_id === "string" ? record.target_id : "";
    if (!targetId) return null;
    const decision: EvidencePrimaryDecision = {
      targetId,
      personId: typeof record.person_id === "string" ? record.person_id : null,
      personName: typeof record.person_name === "string" ? record.person_name : null,
      primarySlot: record.primary_slot === "PRIMARY_2" ? "PRIMARY_2" : "PRIMARY_1",
    };
    if (record.primary_slot === "PRIMARY_2") primary2 = decision;
    else primary1 = decision;
  }
  if (!primary1 || !primary2) return null;
  return { primary1, primary2 };
}
