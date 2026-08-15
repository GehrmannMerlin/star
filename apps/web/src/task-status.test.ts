import { describe, expect, it } from "vitest";
import { isTerminalStatus, isExportableStatus, TERMINAL_STATUSES, EXPORTABLE_STATUSES } from "./task-status.js";

describe("task-status", () => {
  it("终态集合包含四个终态", () => {
    expect(TERMINAL_STATUSES).toEqual(new Set(["COMPLETED", "PARTIAL_COMPLETED", "FAILED", "CANCELLED"]));
  });

  it("可导出集合仅含 COMPLETED 与 PARTIAL_COMPLETED", () => {
    expect(EXPORTABLE_STATUSES).toEqual(new Set(["COMPLETED", "PARTIAL_COMPLETED"]));
  });

  it("isTerminalStatus 正确判定终态与运行态", () => {
    expect(isTerminalStatus("COMPLETED")).toBe(true);
    expect(isTerminalStatus("PARTIAL_COMPLETED")).toBe(true);
    expect(isTerminalStatus("FAILED")).toBe(true);
    expect(isTerminalStatus("CANCELLED")).toBe(true);
    expect(isTerminalStatus("CRAWLING")).toBe(false);
    expect(isTerminalStatus("PENDING")).toBe(false);
  });

  it("isExportableStatus 区分可导出与不可导出", () => {
    expect(isExportableStatus("COMPLETED")).toBe(true);
    expect(isExportableStatus("PARTIAL_COMPLETED")).toBe(true);
    expect(isExportableStatus("FAILED")).toBe(false);
    expect(isExportableStatus("CRAWLING")).toBe(false);
    expect(isExportableStatus("CANCELLED")).toBe(false);
  });

  it("未知状态安全 fallback 为 false", () => {
    expect(isTerminalStatus("UNKNOWN")).toBe(false);
    expect(isExportableStatus("UNKNOWN")).toBe(false);
  });
});
