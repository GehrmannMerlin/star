import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { RegionPicker, type RegionSelection } from "./RegionPicker.js";
import type { ApiClient } from "../app.js";

const provinces = [
  { code: "340000", name: "安徽省", level: "province" as const, parentCode: null },
  { code: "330000", name: "浙江省", level: "province" as const, parentCode: null },
];
const cities = {
  "340000": [
    { code: "340100", name: "合肥市", level: "city" as const, parentCode: "340000" },
    { code: "340200", name: "芜湖市", level: "city" as const, parentCode: "340000" },
  ],
  "330000": [{ code: "330100", name: "杭州市", level: "city" as const, parentCode: "330000" }],
};
const counties = {
  "340100": [{ code: "340101", name: "瑶海区", level: "county" as const, parentCode: "340100" }],
  "340200": [{ code: "340201", name: "镜湖区", level: "county" as const, parentCode: "340200" }],
  "330100": [{ code: "330102", name: "上城区", level: "county" as const, parentCode: "330100" }],
};

function makeApi(overrides: Partial<ApiClient> = {}): ApiClient {
  return {
    createTask: vi.fn(), getTask: vi.fn(), getResults: vi.fn(), getEvidence: vi.fn(),
    downloadExport: vi.fn(), openEvents: vi.fn(), listTasks: vi.fn(async () => ({ tasks: [], total: 0 })),
    controlTask: vi.fn(), listProvinces: vi.fn(async () => provinces),
    listChildren: vi.fn(async (parent) => cities[parent as keyof typeof cities] ?? counties[parent as keyof typeof counties] ?? []),
    validateRegions: vi.fn(), expandRegions: vi.fn(), ...overrides,
  };
}

function renderPicker(api = makeApi(), onChange: (selection: RegionSelection) => void = vi.fn()) {
  render(<RegionPicker api={api} value={{ province: null, city: null, county: null, finalRegion: null, level: null, codes: [], names: [] }} onChange={onChange} />);
  return { api, onChange };
}

describe("RegionPicker", () => {
  it("初始只有省份可用", async () => {
    renderPicker();
    expect(screen.getByLabelText("省份")).toBeEnabled();
    expect(screen.getByLabelText("地市")).toBeDisabled();
    expect(screen.getByLabelText("区县")).toBeDisabled();
    await waitFor(() => expect(screen.getByLabelText("省份")).toHaveTextContent("安徽省"));
  });

  it("级联加载并在父级变化时清空子级", async () => {
    const user = userEvent.setup();
    renderPicker();
    await waitFor(() => expect(screen.getByLabelText("省份")).toHaveTextContent("安徽省"));
    await user.selectOptions(screen.getByLabelText("省份"), "340000");
    await waitFor(() => expect(screen.getByLabelText("地市")).toBeEnabled());
    await user.selectOptions(screen.getByLabelText("地市"), "340100");
    await waitFor(() => expect(screen.getByLabelText("区县")).toBeEnabled());
    await user.selectOptions(screen.getByLabelText("区县"), "340101");
    await user.selectOptions(screen.getByLabelText("省份"), "330000");
    expect(screen.getByLabelText("地市")).toHaveValue("");
    expect(screen.getByLabelText("区县")).toHaveValue("");
    await user.selectOptions(screen.getByLabelText("地市"), "330100");
    await user.selectOptions(screen.getByLabelText("区县"), "330102");
    await user.selectOptions(screen.getByLabelText("地市"), "");
    expect(screen.getByLabelText("区县")).toHaveValue("");
  });

  it("切换地市会清空旧区县", async () => {
    const user = userEvent.setup();
    renderPicker();
    await waitFor(() => expect(screen.getByLabelText("省份")).toHaveTextContent("安徽省"));
    await user.selectOptions(screen.getByLabelText("省份"), "340000");
    await user.selectOptions(screen.getByLabelText("地市"), "340100");
    await user.selectOptions(screen.getByLabelText("区县"), "340101");
    await user.selectOptions(screen.getByLabelText("地市"), "340200");
    expect(screen.getByLabelText("区县")).toHaveValue("");
  });

  it("不再渲染旧的批量和展开控件", () => {
    renderPicker();
    expect(screen.queryByText("展开层级")).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "校验并添加" })).not.toBeInTheDocument();
  });

  it("派生省级、地市级、区县级和最终 code", async () => {
    const user = userEvent.setup();
    let selection: RegionSelection | undefined;
    renderPicker(makeApi(), (next) => { selection = next; });
    await waitFor(() => expect(screen.getByLabelText("省份")).toHaveTextContent("安徽省"));
    await user.selectOptions(screen.getByLabelText("省份"), "340000");
    await waitFor(() => expect(selection?.level).toBe("PROVINCE"));
    expect(screen.getByText("任务层级：省级")).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("地市"), "340100");
    await waitFor(() => expect(selection?.level).toBe("PREFECTURE"));
    expect(screen.getByText("任务层级：地市级")).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("区县"), "340101");
    await waitFor(() => expect(selection?.level).toBe("COUNTY"));
    expect(selection?.finalRegion?.code).toBe("340101");
    expect(screen.getByText("当前采集范围：安徽省 / 合肥市 / 瑶海区")).toBeInTheDocument();
  });

  it("加载失败时禁用对应层级并清空选择", async () => {
    const user = userEvent.setup();
    const api = makeApi({ listChildren: vi.fn(async (parent) => {
      if (parent === "340000") throw new Error("city unavailable");
      return [];
    }) });
    renderPicker(api);
    await waitFor(() => expect(screen.getByLabelText("省份")).toHaveTextContent("安徽省"));
    await user.selectOptions(screen.getByLabelText("省份"), "340000");
    await waitFor(() => expect(screen.getByLabelText("地市")).toBeDisabled());
    expect(screen.getByText("city unavailable")).toBeInTheDocument();
  });
});
