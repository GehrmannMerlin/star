import { describe, expect, it } from "vitest";
import { inventorySmokePassed, parseInventorySmokeArgs } from "./inventory-smoke.js";

describe("parseInventorySmokeArgs", () => {
  it("parses targeted args (default mode)", () => {
    const args = parseInventorySmokeArgs([
      "--region-code",
      "310000",
      "--institution",
      "上海市人民政府",
      "--seed-url",
      "https://www.sh.gov.cn/",
    ]);
    expect(args).toEqual({
      regionCode: "310000",
      institution: "上海市人民政府",
      seedUrl: "https://www.sh.gov.cn/",
      mode: "targeted",
      budgetMs: undefined,
    });
  });

  it("parses FULL smoke args without an institution and with a budget", () => {
    const args = parseInventorySmokeArgs([
      "--mode",
      "full",
      "--region-code",
      "320106",
      "--budget-ms",
      "360000",
    ]);
    expect(args).toEqual({
      regionCode: "320106",
      institution: undefined,
      seedUrl: undefined,
      mode: "full",
      budgetMs: 360000,
    });
  });
});

describe("inventorySmokePassed", () => {
  const fullReport: Record<string, unknown> = {
    inventory_frozen: true,
    get_region_context_called: true,
    search_web_called: true,
    fetch_page_called: true,
    inspect_page_called: true,
    submit_inventory_called: true,
    schema_valid: true,
    item_count: 3,
  };

  it("passes a FULL report with search + inspect + more than one item", () => {
    expect(inventorySmokePassed("full", fullReport)).toBe(true);
  });

  it("fails a FULL report that never called search_web", () => {
    expect(inventorySmokePassed("full", { ...fullReport, search_web_called: false })).toBe(false);
  });

  it("fails a FULL report with only a single item", () => {
    expect(inventorySmokePassed("full", { ...fullReport, item_count: 1 })).toBe(false);
  });

  it("passes a targeted report without search and without item_count", () => {
    const targeted: Record<string, unknown> = {
      inventory_frozen: true,
      get_region_context_called: true,
      render_page_called: true,
      inspect_page_called: true,
      submit_inventory_called: true,
      schema_valid: true,
    };
    expect(inventorySmokePassed("targeted", targeted)).toBe(true);
  });

  it("fails a targeted report that never fetched or rendered a page", () => {
    const targeted: Record<string, unknown> = {
      inventory_frozen: true,
      get_region_context_called: true,
      inspect_page_called: true,
      submit_inventory_called: true,
      schema_valid: true,
    };
    expect(inventorySmokePassed("targeted", targeted)).toBe(false);
  });
});
