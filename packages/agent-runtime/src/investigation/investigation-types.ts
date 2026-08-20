import type {
  LeadershipStructureArtifact,
  PersonDecisionArtifact,
} from "@stellaris/agent-tools";
import type { InstitutionWorkPacket } from "../work-packet/institution-work-packet.js";

export const INVESTIGATION_NOT_SUBMITTED = "INVESTIGATION_NOT_SUBMITTED" as const;
export const INVESTIGATION_OBSERVATION_REQUIRED =
  "INVESTIGATION_OBSERVATION_REQUIRED" as const;

/** STEP 19.4：契约修复链失败码。 */
export const INVESTIGATION_SCHEMA_REPAIR_EXHAUSTED =
  "INVESTIGATION_SCHEMA_REPAIR_EXHAUSTED" as const;
export const INVESTIGATION_REPEATED_SCHEMA_ERROR =
  "INVESTIGATION_REPEATED_SCHEMA_ERROR" as const;
export const INVESTIGATION_TOOL_NOT_CALLED = "INVESTIGATION_TOOL_NOT_CALLED" as const;

export type InvestigationFailureCode =
  | typeof INVESTIGATION_NOT_SUBMITTED
  | typeof INVESTIGATION_OBSERVATION_REQUIRED
  | typeof INVESTIGATION_SCHEMA_REPAIR_EXHAUSTED
  | typeof INVESTIGATION_REPEATED_SCHEMA_ERROR
  | typeof INVESTIGATION_TOOL_NOT_CALLED;

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

/** STEP 19.4：修复指标（Completion Gate 观测）。 */
export type InvestigationRepairReport = {
  submitAttempts: number;
  schemaValidationFailures: number;
  repairAttempts: number;
  repeatedErrorBreakerTriggered: boolean;
  researchToolCallsAfterFirstSubmitFailure: number;
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
  repair: InvestigationRepairReport;
  receipt: InvestigationFreezeReceipt;
};

export type InvestigationFailedResult = {
  status: "FAILED";
  packetId: string;
  packet: InstitutionWorkPacket;
  failureCode: InvestigationFailureCode;
  agentSessionId: string;
  toolCalls: InvestigationToolCallSummary[];
  /** STEP 19.4：失败时也携带修复指标（熔断/耗尽诊断）。 */
  repair?: InvestigationRepairReport;
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
