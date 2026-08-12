import { describe, it, expect } from "vitest";
import { sanitizeUrlForDisplay, sanitizeHeaderNameForLog, sanitizeTextForEvidence } from "./sanitize.js";

describe("sanitize 统一脱敏", () => {
  it("URL userinfo 与追踪参数值被脱敏，业务参数键保留", () => {
    expect(sanitizeUrlForDisplay("https://user:pass@x.gov.cn/a?token=abc&id=1")).toBe(
      "https://x.gov.cn/a?token=***&id=1",
    );
  });

  it("Cookie/Authorization 值从证据文本移除", () => {
    const out = sanitizeTextForEvidence("Cookie: abc=1; Authorization: Bearer secret");
    expect(out).not.toMatch(/Bearer secret/);
    expect(out).not.toMatch(/abc=1/);
  });

  it("SSE 载荷白名单外头名一律 REDACTED", () => {
    expect(sanitizeHeaderNameForLog("content-type")).toBe("content-type");
    expect(sanitizeHeaderNameForLog("x-session-token")).toBe("REDACTED");
  });
});
