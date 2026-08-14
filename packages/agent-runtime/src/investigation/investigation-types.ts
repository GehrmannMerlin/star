import type {
  LeadershipStructureArtifact,
  PersonDecisionArtifact,
} from "@stellaris/agent-tools";
import type { InstitutionWorkPacket } from "../work-packet/institution-work-packet.js";

export const INVESTIGATION_NOT_SUBMITTED = "INVESTIGATION_NOT_SUBMITTED" as const;
export const INVESTIGATION_OBSERVATION_REQUIRED =
  "INVESTIGATION_OBSERVATION_REQUIRED" as const;

export type InvestigationFailureCode =
  | typeof INVESTIGATION_NOT_SUBMITTED
  | typeof INVESTIGATION_OBSERVATION_REQUIRED;

export type InvestigationToolCallSummary = {
  toolName: string;
  called: boolean;
  succeeded: boolean;
};

export type InvestigationObservationGate = {
  fetchOrRenderSucceeded: boolean;
  inspectSucceeded: boolean;
  passed: boolean;
};

/** Business request: investigate exactly one frozen-inventory work packet. */
export type InvestigationAgentRequest = {
  packetId: string;
};

export type InvestigationFreezeReceipt = {
  frozen: true;
  leadershipValidated: true;
  selectedOfficialsValidated: true;
  primary1: string | null;
  primary2: string | null;
  primaryPeopleDistinct: boolean;
  payloadHash: string;
};

export type InvestigationCompletedResult = {
  status: "COMPLETED";
  packetId: string;
  packet: InstitutionWorkPacket;
  leadership: LeadershipStructureArtifact;
  selectedOfficials: PersonDecisionArtifact[];
  frozen: true;
  agentSessionId: string;
  skill: { name: string; version: string };
  model: { provider: string; model: string };
  toolCalls: InvestigationToolCallSummary[];
  observationGate: InvestigationObservationGate;
  receipt: InvestigationFreezeReceipt;
};

export type InvestigationFailedResult = {
  status: "FAILED";
  packetId: string;
  packet: InstitutionWorkPacket;
  failureCode: InvestigationFailureCode;
  agentSessionId: string;
  toolCalls: InvestigationToolCallSummary[];
};

export type InvestigationAgentResult =
  | InvestigationCompletedResult
  | InvestigationFailedResult
  | { status: "INVALID_REQUEST"; reason: string }
  | { status: "PACKET_NOT_FOUND"; packetId: string }
  | { status: "PACKET_ALREADY_STARTED"; packetId: string }
  | { status: "MODEL_NOT_CONFIGURED" }
  | { status: "MODEL_NOT_FOUND"; provider: string; model: string };

export class InvestigationRuntimeError extends Error {}
