import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { RegionPicker, type RegionSelection } from "./RegionPicker.js";
import type { ApiClient } from "../app.js";

const user = userEvent.setup();

const provinces = [
  { code: "340000", name: "安徽省", level: "province" as const, parentCode: null },
];
const hefeiCities = [
  { code: "340100", name: "合肥市", level: "city" as const, parentCode: "340000" },
  { code: "340200", name: "芜湖市", level: "city" as const, parentCode: "340000" },
];
const expandedCounties = [
  { code: "340000", name: "安徽省", level: "province" as const, parentCode: null },
  { code: "340100", name: "合肥市", level: "city" as const, parentCode: "340000" },
  { code: "340101", name: "市辖区", level: "county" as const, parentCode: "340100" },
];

function makeApi(overrides: Partial<ApiClient> = {}): ApiClient {
  return {
    createTask: vi.fn(),
    getTask: vi.fn(),
    getResults: vi.fn(),
    getEvidence: vi.fn(),
    downloadExport: vi.fn(),
    openEvents: vi.fn(),
    listTasks: vi.fn(async () => ({ tasks: [], total: 0 })),
    controlTask: vi.fn(),
    listProvinces: vi.fn(async () => provinces),
    listChildren: vi.fn(async (parent) => (parent === "340000" ? hefeiCities : [])),
    validateRegions: vi.fn(async () => ({ valid: true, invalid: [] })),
    expandRegions: vi.fn(async (codes) => expandedCounties),
    ...overrides,
  };
}

async function selectProvinceAndCities(): Promise<ApiClient> {
  const api = makeApi();
  render(
    <RegionPicker
      api={api}
      value={{ codes: [], names: [], level: "COUNTY" }}
      onChange={() => {}}
    />,
  );
  await user.click(screen.getByLabelText("省份"));
  await user.selectOptions(screen.getByLabelText("省份"), "340000");
  await waitFor(() => expect(screen.getByLabelText("地市（可多选）").children.length).toBe(2));
  return api;
}

describe("RegionPicker", () => {
  it("加载省份并选中后展示地市（级联多选）", async () => {
    await selectProvinceAndCities();
    const citySelect = screen.getByLabelText("地市（可多选）");
    expect(citySelect.querySelectorAll("option").length).toBe(2);
    expect(citySelect).toHaveTextContent("合肥市");
    expect(citySelect).toHaveTextContent("芜湖市");
  });

  it("选中地市后展开至区县并回调 onChange", async () => {
    let selection: RegionSelection = { codes: [], names: [], level: "COUNTY" };
    const api = makeApi();
    render(
      <RegionPicker
        api={api}
        value={{ codes: [], names: [], level: "COUNTY" }}
        onChange={(s) => (selection = s)}
      />,
    );
    await user.click(screen.getByLabelText("省份"));
    await user.selectOptions(screen.getByLabelText("省份"), "340000");
    await waitFor(() => expect(screen.getByLabelText("地市（可多选）").children.length).toBe(2));
    await user.selectOptions(screen.getByLabelText("地市（可多选）"), "340100");
    await waitFor(() => expect(api.expandRegions).toHaveBeenCalled());
    expect(api.expandRegions).toHaveBeenCalledWith(["340100"], "COUNTY");
    expect(selection.codes).toEqual(expandedCounties.map((r) => r.code));
  });

  it("上传有效代码 → validate 通过 → expand 展开", async () => {
    const api = makeApi();
    let selection: RegionSelection = { codes: [], names: [], level: "COUNTY" };
    render(
      <RegionPicker
        api={api}
        value={{ codes: [], names: [], level: "COUNTY" }}
        onChange={(s) => (selection = s)}
      />,
    );
    await user.type(screen.getByLabelText("上传行政区代码"), "340100, 340200");
    await user.click(screen.getByRole("button", { name: "校验并添加" }));
    await waitFor(() => expect(api.validateRegions).toHaveBeenCalledWith(["340100", "340200"]));
    expect(api.expandRegions).toHaveBeenCalled();
    expect(selection.codes.length).toBeGreaterThan(0);
  });

  it("上传无效代码 → 显示错误且不展开", async () => {
    const api = makeApi({
      validateRegions: vi.fn(async () => ({ valid: false, invalid: ["999999"] })),
    });
    render(
      <RegionPicker
        api={api}
        value={{ codes: [], names: [], level: "COUNTY" }}
        onChange={() => {}}
      />,
    );
    await user.type(screen.getByLabelText("上传行政区代码"), "999999");
    await user.click(screen.getByRole("button", { name: "校验并添加" }));
    expect(await screen.findByText(/无效代码：999999/)).toBeInTheDocument();
    expect(api.expandRegions).not.toHaveBeenCalled();
  });

  it("展开层级切换触发重新展开", async () => {
    let selection: RegionSelection = { codes: [], names: [], level: "COUNTY" };
    const api = makeApi();
    render(
      <RegionPicker
        api={api}
        value={{ codes: [], names: [], level: "COUNTY" }}
        onChange={(s) => (selection = s)}
      />,
    );
    await user.click(screen.getByLabelText("省份"));
    await user.selectOptions(screen.getByLabelText("省份"), "340000");
    await waitFor(() => expect(screen.getByLabelText("地市（可多选）").children.length).toBe(2));
    await user.selectOptions(screen.getByLabelText("地市（可多选）"), "340100");
    await waitFor(() => expect(api.expandRegions).toHaveBeenCalledWith(["340100"], "COUNTY"));
    await user.click(screen.getByLabelText("乡镇/街道"));
    await waitFor(() => expect(api.expandRegions).toHaveBeenCalledWith(["340100"], "TOWN_STREET"));
    expect(selection.level).toBe("TOWN_STREET");
  });
});
