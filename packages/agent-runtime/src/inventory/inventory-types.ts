import type { InstitutionInventoryRecord } from "@stellaris/agent-tools";

export type InventoryMode = "FULL" | "TARGETED";

/** Business request. No seed URL / search query — the product is URL-free. */
export type InventoryAgentRequest = {
  regionCode: string;
  mode: InventoryMode;
  specifiedInstitutions?: string[];
};

export type InventoryFreezeReceipt = {
  frozen: true;
  itemCount: number;
  payloadHash: string;
};

export type InventoryToolCallSummary = {
  toolName: string;
  called: boolean;
  succeeded: boolean;
};

export type InventoryCompletedResult = {
  status: "COMPLETED";
  regionCode: string;
  mode: InventoryMode;
  inventory: InstitutionInventoryRecord[];
  frozen: true;
  agentSessionId: string;
  skill: { name: string; version: string };
  model: { provider: string; model: string };
  toolCalls: InventoryToolCallSummary[];
  receipt: InventoryFreezeReceipt;
};

export type InventoryAgentResult =
  | InventoryCompletedResult
  | { status: "INVALID_REQUEST"; reason: string }
  | { status: "MODEL_NOT_CONFIGURED" }
  | { status: "MODEL_NOT_FOUND"; provider: string; model: string }
  | {
      status: "INVENTORY_NOT_SUBMITTED";
      agentSessionId: string;
      toolCalls: InventoryToolCallSummary[];
    };

export class InventoryRuntimeError extends Error {}
