import type {
  RecoveryOutcome,
  UrlCandidatePoolRow,
} from "@stellaris/agent-tools";
import type { InstitutionWorkPacket } from "../work-packet/institution-work-packet.js";

export const RECOVERY_NOT_SUBMITTED = "RECOVERY_NOT_SUBMITTED" as const;
export const RECOVERY_SCHEMA_INVALID = "RECOVERY_SCHEMA_INVALID" as const;
export const RECOVERY_OBSERVATION_REQUIRED = "RECOVERY_OBSERVATION_REQUIRED" as const;

export type RecoveryFailureCode =
  | typeof RECOVERY_NOT_SUBMITTED
  | typeof RECOVERY_SCHEMA_INVALID
  | typeof RECOVERY_OBSERVATION_REQUIRED;

export type RecoveryToolCallSummary = {
  toolName: string;
  called: boolean;
  succeeded: boolean;
};

/** Structured, frozen Recovery input (never Investigator/Reviewer reasoning or chat). */
export type RecoveryFrozenInput = {
  /** Canonical leadership-structure artifact (frozen). */
  leadership: Record<string, unknown>;
  /** Frozen person decisions (PRIMARY_1 + PRIMARY_2), canonical. */
  selectedOfficials: Array<Record<string, unknown>>;
  /** Frozen ORIGINAL Position URL Candidate Pool (url-candidate-pool.schema.json). */
  candidatePool: UrlCandidatePoolRow[];
  /** Frozen canonical Independent Review Records (review-record.schema.json). */
  reviewRecords: Array<Record<string, unknown>>;
};

/** Business request: supplement the reviewer-identified gap of a packet in state
 *  RECOVERY_REQUIRED with new CURRENT POSITION URL candidates. */
export type RecoveryRequest = {
  packetId: string;
  frozenInput: RecoveryFrozenInput;
};

export type RecoveryFreezeReceipt = {
  frozen: true;
  supplementValidated: boolean;
  reviewRecordsValidated: boolean;
  supplementCount: number;
  recoveredCount: number;
  originalCandidatePoolUnchanged: boolean;
  compositeCandidateViewCount: number;
  provenanceGate: "PASS" | "FAIL";
  payloadHash: string;
};

export type RecoveryCompletedResult = {
  status: "COMPLETED";
  packetId: string;
  packet: InstitutionWorkPacket;
  /** Recovery has no final-URL authority: it returns the packet to Review. */
  packetFinalState: "READY_FOR_REVIEW";
  /** Runtime-attested canonical Recovery Records (recovery-record.schema.json). */
  recoveryRecords: Array<Record<string, unknown>>;
  /** New candidates frozen by the recovery submission (the Supplement). */
  newCandidates: UrlCandidatePoolRow[];
  /** Mechanical original + supplement view for the next Reviewer session. */
  compositeCandidateView: UrlCandidatePoolRow[];
  originalCandidatePoolUnchanged: true;
  frozen: true;
  agentSessionId: string;
  skill: { name: string; version: string };
  model: { provider: string; model: string };
  toolCalls: RecoveryToolCallSummary[];
  receipt: RecoveryFreezeReceipt;
};

export type RecoveryFailedResult = {
  status: "FAILED";
  packetId: string;
  packet: InstitutionWorkPacket;
  packetFinalState: "FAILED";
  failureCode: RecoveryFailureCode;
  agentSessionId: string;
  toolCalls: RecoveryToolCallSummary[];
  failureDetail?: string;
};

export type RecoveryResult =
  | RecoveryCompletedResult
  | RecoveryFailedResult
  | { status: "INVALID_REQUEST"; reason: string }
  | { status: "PACKET_NOT_FOUND"; packetId: string }
  | { status: "PACKET_NOT_ELIGIBLE"; packetId: string; reason: string }
  | { status: "MODEL_NOT_CONFIGURED" }
  | { status: "MODEL_NOT_FOUND"; provider: string; model: string };

export class RecoveryRunnerRuntimeError extends Error {}
