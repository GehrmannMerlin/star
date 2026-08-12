import { describe, it, expect } from "vitest";
import { EXPORTER_PACKAGE_NAME } from "./index.js";

describe("exporter package baseline", () => {
  it("包名常量为 @stellaris/exporter", () => {
    expect(EXPORTER_PACKAGE_NAME).toBe("@stellaris/exporter");
  });
});
