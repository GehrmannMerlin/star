import type {
  InvestigationSubmissionPayload,
  TargetClaimRow,
  UrlCandidatePoolRow,
} from "@stellaris/agent-tools";
import type { InstitutionWorkPacket } from "../work-packet/institution-work-packet.js";

export const EVIDENCE_NOT_SUBMITTED = "EVIDENCE_NOT_SUBMITTED" as const;
export const POSITION_CANDIDATE_OBSERVATION_REQUIRED =
  "POSITION_CANDIDATE_OBSERVATION_REQUIRED" as const;

export type EvidenceFailureCode =
  | typeof EVIDENCE_NOT_SUBMITTED
  | typeof POSITION_CANDIDATE_OBSERVATION_REQUIRED;

export type EvidenceToolCallSummary = {
  toolName: string;
  called: boolean;
  succeeded: boolean;
};

export type CandidateProvenance = {
  url: string;
  targetId: string;
  opened: boolean;
  inspected: boolean;
};

export type EvidenceProvenanceGate = {
  candidates: CandidateProvenance[];
  passed: boolean;
};

/** Business request: gather Position URL candidates for a packet whose STEP 9
 *  Investigation is frozen (state EVIDENCE_PENDING). */
export type InvestigatorEvidenceRequest = {
  packetId: string;
  /** Frozen STEP 9 canonical output: leadership + exactly two person decisions. */
  frozenInput: InvestigationSubmissionPayload;
};

export type InvestigatorEvidenceFreezeReceipt = {
  frozen: true;
  candidatesValidated: true;
  claimsValidated: boolean;
  primary1TargetId: string | null;
  primary2TargetId: string | null;
  primary1CandidateCount: number;
  primary2CandidateCount: number;
  allCandidatesOpened: boolean;
  allCandidatesInspected: boolean;
  payloadHash: string;
};

export type InvestigatorEvidenceCompletedResult = {
  status: "COMPLETED";
  packetId: string;
  packet: InstitutionWorkPacket;
  candidates: UrlCandidatePoolRow[];
  claims: TargetClaimRow[];
  frozen: true;
  agentSessionId: string;
  skill: { name: string; version: string };
  model: { provider: string; model: string };
  toolCalls: EvidenceToolCallSummary[];
  provenance: EvidenceProvenanceGate;
  receipt: InvestigatorEvidenceFreezeReceipt;
};

export type InvestigatorEvidenceFailedResult = {
  status: "FAILED";
  packetId: string;
  packet: InstitutionWorkPacket;
  failureCode: EvidenceFailureCode;
  agentSessionId: string;
  toolCalls: EvidenceToolCallSummary[];
};

export type InvestigatorEvidenceResult =
  | InvestigatorEvidenceCompletedResult
  | InvestigatorEvidenceFailedResult
  | { status: "INVALID_REQUEST"; reason: string }
  | { status: "PACKET_NOT_FOUND"; packetId: string }
  | { status: "PACKET_NOT_ELIGIBLE"; packetId: string; reason: string }
  | { status: "MODEL_NOT_CONFIGURED" }
  | { status: "MODEL_NOT_FOUND"; provider: string; model: string };

export class InvestigatorEvidenceRuntimeError extends Error {}
