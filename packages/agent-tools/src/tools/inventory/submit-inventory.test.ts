import { describe, expect, it } from "vitest";
import { ToolFailureCode } from "../../contracts/tool-failure-codes.js";
import type {
  InventorySubmissionPayload,
  InventorySubmissionSink,
  InventorySubmissionValidator,
  SubmitInventorySuccess,
  SubmissionValidation,
} from "./inventory-submission.js";
import { createSubmitInventoryTool } from "./submit-inventory.js";

const VALID_RECORD = {
  institution_id: "sh-people-gov",
  standard_name: "上海市人民政府",
  administrative_level: "PROVINCIAL",
  decision: "INCLUDE",
  source_url: "https://www.sh.gov.cn/",
} as const;

const context = () => ({
  taskRunId: "task-1",
  agentSessionId: "session-1",
  agentRole: "INVENTORY" as const,
  signal: new AbortController().signal,
});

class RecordingSink implements InventorySubmissionSink {
  submission: InventorySubmissionPayload | null = null;
  private payloadHash = "";
  async submit(payload: InventorySubmissionPayload) {
    if (this.submission) {
      return { status: "ALREADY_SUBMITTED" as const, payloadHash: this.payloadHash };
    }
    this.submission = payload;
    this.payloadHash = "hash-1";
    return { status: "ACCEPTED" as const, payloadHash: this.payloadHash };
  }
  async getSubmission() {
    return this.submission;
  }
  async isFrozen() {
    return this.submission !== null;
  }
}

function validator(overrides?: { valid?: boolean; errors?: string[] }): InventorySubmissionValidator {
  const result: SubmissionValidation =
    overrides?.valid === false
      ? { valid: false, errors: overrides.errors ?? ["bad record"] }
      : { valid: true };
  return { validate: () => result };
}

describe("submit_inventory tool", () => {
  it("accepts a valid canonical payload and freezes it", async () => {
    const sink = new RecordingSink();
    const tool = createSubmitInventoryTool({ validator: validator(), sink });
    const result = await tool.execute(context(), { inventory: [VALID_RECORD] });
    expect(result.status).toBe("ACCEPTED");
    expect((result as SubmitInventorySuccess).frozen).toBe(true);
    expect((result as SubmitInventorySuccess).itemCount).toBe(1);
    expect((result as SubmitInventorySuccess).payloadHash).toBe("hash-1");
    expect(await sink.isFrozen()).toBe(true);
  });

  it("rejects a payload that fails Skill schema validation", async () => {
    const tool = createSubmitInventoryTool({
      validator: validator({ valid: false, errors: ["inventory[0].decision: must be enum"] }),
      sink: new RecordingSink(),
    });
    await expect(tool.execute(context(), { inventory: [VALID_RECORD] })).rejects.toMatchObject({
      code: ToolFailureCode.SCHEMA_VALIDATION_FAILED,
    });
  });

  it("rejects a second submission once the inventory is frozen", async () => {
    const sink = new RecordingSink();
    const tool = createSubmitInventoryTool({ validator: validator(), sink });
    await tool.execute(context(), { inventory: [VALID_RECORD] });
    await expect(tool.execute(context(), { inventory: [VALID_RECORD] })).rejects.toMatchObject({
      code: ToolFailureCode.INVENTORY_ALREADY_SUBMITTED,
    });
  });

  it("accepts multiple valid records in one submission", async () => {
    const sink = new RecordingSink();
    const tool = createSubmitInventoryTool({ validator: validator(), sink });
    const result = await tool.execute(context(), {
      inventory: [
        VALID_RECORD,
        { ...VALID_RECORD, institution_id: "sh-2", standard_name: "上海市发展和改革委员会" },
      ],
    });
    expect(result.status).toBe("ACCEPTED");
    if (result.status === "ACCEPTED") expect(result.itemCount).toBe(2);
  });
});
