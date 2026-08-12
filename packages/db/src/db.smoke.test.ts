import { describe, it, expect } from "vitest";
import { TABLE_NAMES } from "./schema.js";

describe("db schema baseline", () => {
  it("25 张表清单齐全", () => {
    expect(TABLE_NAMES).toHaveLength(25);
    expect(TABLE_NAMES).toContain("task_run");
    expect(TABLE_NAMES).toContain("result_row");
  });
});
