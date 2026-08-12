import { describe, it, expect } from "vitest";
import { EVIDENCE_PACKAGE_NAME } from "./index.js";

describe("evidence package baseline", () => {
  it("包名常量为 @stellaris/evidence", () => {
    expect(EVIDENCE_PACKAGE_NAME).toBe("@stellaris/evidence");
  });
});
