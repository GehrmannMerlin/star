import { describe, it, expect } from "vitest";
import { CRAWLER_PACKAGE_NAME } from "./index.js";

describe("crawler package baseline", () => {
  it("包名常量为 @stellaris/crawler", () => {
    expect(CRAWLER_PACKAGE_NAME).toBe("@stellaris/crawler");
  });
});
