import { Type, type Static } from "@sinclair/typebox";
import { ToolFailureCode, ToolFailureError } from "../../contracts/tool-failure-codes.js";
import type { AgentToolDefinition } from "../../contracts/tool-types.js";
import {
  ADMINISTRATIVE_LEVELS,
  INSTITUTION_DECISIONS,
  type InventorySubmissionPayload,
  type InventorySubmissionSink,
  type InventorySubmissionValidator,
  type SubmitInventorySuccess,
} from "./inventory-submission.js";

const record = Type.Object(
  {
    institution_id: Type.String({ minLength: 1 }),
    standard_name: Type.String({ minLength: 1 }),
    administrative_level: Type.Union(
      ADMINISTRATIVE_LEVELS.map((level) => Type.Literal(level)),
    ),
    core_institution_type: Type.Optional(Type.String()),
    decision: Type.Union(INSTITUTION_DECISIONS.map((decision) => Type.Literal(decision))),
    source_url: Type.Optional(Type.String()),
    lineage: Type.Optional(Type.Array(Type.String())),
  },
  { additionalProperties: true },
);

export const SubmitInventoryInput = Type.Object(
  { inventory: Type.Array(record, { minItems: 1 }) },
  { additionalProperties: false },
);

export type SubmitInventoryInput = Static<typeof SubmitInventoryInput>;

export type SubmitInventoryToolDeps = {
  /** Validates the payload against the canonical Skill inventory schema. */
  validator: InventorySubmissionValidator;
  /** Stores the first accepted submission (one freeze per run). */
  sink: InventorySubmissionSink;
};

/**
 * Inventory output boundary tool.
 *
 * Pi knows only `submit_inventory`; the concrete Skill-schema validator and the
 * in-memory sink are wired server-side by the InventoryAgentRunner. The tool
 * validates against the canonical Skill schema, accepts exactly one submission,
 * and rejects any later override.
 */
export function createSubmitInventoryTool(
  deps: SubmitInventoryToolDeps,
): AgentToolDefinition<typeof SubmitInventoryInput, SubmitInventorySuccess> {
  return {
    name: "submit_inventory",
    description:
      "Submit the final institution inventory for this run. The payload must follow the official-biography-evidence institution-inventory schema. Exactly one submission is accepted per run; a later submission is rejected.",
    inputSchema: SubmitInventoryInput,
    async execute(_context, input) {
      const payload: InventorySubmissionPayload = { inventory: input.inventory };
      const validation = deps.validator.validate(payload);
      if (!validation.valid) {
        throw new ToolFailureError({
          code: ToolFailureCode.SCHEMA_VALIDATION_FAILED,
          message: `submit_inventory failed Skill schema validation: ${validation.errors.join("; ")}`,
          retryable: false,
        });
      }
      const result = await deps.sink.submit(payload);
      if (result.status === "ALREADY_SUBMITTED") {
        throw new ToolFailureError({
          code: ToolFailureCode.INVENTORY_ALREADY_SUBMITTED,
          message: "Inventory already submitted and frozen for this run",
          retryable: false,
        });
      }
      return {
        status: "ACCEPTED",
        frozen: true,
        itemCount: payload.inventory.length,
        payloadHash: result.payloadHash,
      };
    },
  };
}
