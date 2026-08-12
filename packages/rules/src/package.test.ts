import { describe, it, expect } from "vitest";
import { RULES_PACKAGE_NAME } from "./index.js";

describe("rules package baseline", () => {
  it("包名常量为 @stellaris/rules", () => {
    expect(RULES_PACKAGE_NAME).toBe("@stellaris/rules");
  });
});
