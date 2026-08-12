import { describe, it, expect } from "vitest";
import { mapResultRowToView, TERMINAL_REASONS, resolveTerminalReason } from "./result-projection.js";
import type { ResultRowRow } from "./types.js";

const makeRow = (overrides: Partial<ResultRowRow> = {}): ResultRowRow => ({
  id: "r1",
  task_run_id: "t1",
  institution_snapshot_id: "i1",
  slot: "PRIMARY_1",
  region_code: "110000",
  province: null,
  city: null,
  county: null,
  town: null,
  institution_name: "某某区人民政府",
  position_display: "某某区人民政府 区长",
  person_name: "张三",
  current_status_zh: "正式在任",
  position_url: null,
  page_type_zh: null,
  result_zh: "完整搜索后无合格URL",
  collected_at: "2026-08-03T00:00:00.000Z",
  created_at: "2026-08-03T00:00:00.000Z",
  ...overrides,
});

describe("result_row 投影", () => {
  it("空 URL 行投影保留中文终态原因且 positionUrl 为空", () => {
    const view = mapResultRowToView(
      makeRow({ position_url: null, result_zh: TERMINAL_REASONS.NO_QUALIFIED_URL ?? "完整搜索后无合格URL" }),
    );
    expect(view.positionUrl).toBeUndefined();
    expect(view.resultZh).toBe("完整搜索后无合格URL");
  });

  it("已复核 URL 行投影 positionUrl 与 pageTypeZh 齐备", () => {
    const view = mapResultRowToView(
      makeRow({ position_url: "https://x/", result_zh: "已找到并复核", page_type_zh: "个人简介页" }),
    );
    expect(view.positionUrl).toBe("https://x/");
    expect(view.pageTypeZh).toBe("个人简介页");
  });

  it("resolveTerminalReason 未知 code 返回中文兜底", () => {
    expect(resolveTerminalReason("NO_QUALIFIED_URL")).toBe("完整搜索后无合格URL");
    expect(resolveTerminalReason("UNKNOWN_CODE")).toBe("内部证据完整性错误");
  });

  it("投影只暴露合同字段，不暴露 DB 内部列", () => {
    const view = mapResultRowToView(makeRow());
    // ResultRowView 合同含 slot（API 标识用）；显示层不渲染（网页/Excel 过滤）。
    expect(view.slot).toBe("PRIMARY_1");
    expect(Object.keys(view)).not.toContain("created_at");
    expect(Object.keys(view)).not.toContain("task_run_id");
  });
});
