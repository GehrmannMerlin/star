import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { App, type AppDeps, type ApiClient } from "./app.js";
import type {
  CreateTaskResponse,
  TaskDetail,
  ResultRowView,
  EvidenceDetail,
} from "@stellaris/contracts";

const user = userEvent.setup();

const taskSummary = {
  id: "t1",
  status: "COMPLETED" as const,
  statusZh: "已完成",
  mode: "TARGETED" as const,
  expandLevel: "COUNTY" as const,
  ruleVersion: "v1",
  totalInstitutions: 1,
  processedInstitutions: 1,
  reviewedSlots: 2,
  recoveryCount: 0,
  blockedCount: 0,
  requestedAt: new Date().toISOString(),
  controlable: false,
};

const resultRows: ResultRowView[] = [
  {
    id: "r1",
    taskRunId: "t1",
    institutionSnapshotId: "i1",
    slot: "PRIMARY_1",
    regionCode: "110000",
    institutionName: "某某区人民政府",
    positionDisplay: "某某区人民政府 区长",
    personName: "张三",
    currentStatusZh: "正式在任",
    positionUrl: "https://x/ldr/leader-detail-1.html",
    pageTypeZh: "个人简介页",
    resultZh: "已找到并复核",
    collectedAt: new Date().toISOString(),
  },
  {
    id: "r2",
    taskRunId: "t1",
    institutionSnapshotId: "i1",
    slot: "PRIMARY_2",
    regionCode: "110000",
    institutionName: "某某区人民政府",
    positionDisplay: "某某区人民政府 常务副区长",
    personName: "李四",
    currentStatusZh: "正式在任",
    positionUrl: "https://x/ldr/leader-detail-2.html",
    pageTypeZh: "个人简介页",
    resultZh: "已找到并复核",
    collectedAt: new Date().toISOString(),
  },
];

const mockApi: ApiClient = {
  createTask: vi.fn(async () => ({ task: taskSummary, idempotencyResult: "created" }) satisfies CreateTaskResponse),
  getTask: vi.fn(async () => ({
    task: taskSummary,
    scopes: [],
    institution: {
      id: "i1",
      taskRunId: "t1",
      regionCode: "110000",
      officialName: "某某区人民政府",
      institutionType: "government",
      discoverySource: "user_specified",
      selectTwoPrimary: true,
      frozenAt: new Date().toISOString(),
      status: "ACTIVE",
    },
  }) satisfies TaskDetail),
  getResults: vi.fn(async () => resultRows),
  getEvidence: vi.fn(async () => ({
    summary: {
      supportingSnippets: ["张三 区长"],
      officialSourceUrls: ["https://x/ldr/leader-detail-1.html"],
    },
  }) satisfies EvidenceDetail),
  downloadExport: vi.fn(async () => {}),
  openEvents: vi.fn(),
  listTasks: vi.fn(async () => ({ tasks: [], total: 0 })),
  controlTask: vi.fn(async () => taskSummary),
  listProvinces: vi.fn(async () => [{ code: "340000", name: "安徽省", level: "province" as const, parentCode: null }]),
  listChildren: vi.fn(async () => [{ code: "340100", name: "合肥市", level: "city" as const, parentCode: "340000" }]),
  validateRegions: vi.fn(async () => ({ valid: true, invalid: [] })),
  expandRegions: vi.fn(async (codes: string[]) => codes.map((c) => ({ code: c, name: c, level: "county" as const, parentCode: null }))),
};
const deps: AppDeps = { api: mockApi };

// 每个测试独立 mock 状态，避免跨测试调用记录污染（FULL_INSTITUTION/TARGETED 断言）。
beforeEach(() => {
  vi.clearAllMocks();
});

/** 切换到「指定机构」模式并填写 TARGETED 表单。 */
async function switchToTargeted(): Promise<void> {
  await user.click(screen.getByLabelText("指定机构"));
  await user.type(screen.getByLabelText("行政区划代码"), "110000");
  await user.type(screen.getByLabelText("行政区名称"), "北京市");
  await user.type(screen.getByLabelText("机构名称"), "某某区人民政府");
}

describe("网页工作台", () => {
  it("指定机构模式提交后显示任务状态与两行结果", async () => {
    render(<App deps={deps} />);
    await switchToTargeted();
    await user.click(screen.getByRole("button", { name: "开始采集" }));
    expect(await screen.findByText(/已完成/)).toBeInTheDocument();
    expect(await screen.findByText("张三")).toBeInTheDocument();
    expect(await screen.findByText("李四")).toBeInTheDocument();
  });

  it("结果表不显示 PRIMARY_1 内部槽位", async () => {
    render(<App deps={deps} />);
    await switchToTargeted();
    await user.click(screen.getByRole("button", { name: "开始采集" }));
    expect(await screen.findByText("张三")).toBeInTheDocument();
    expect(screen.queryByText("PRIMARY_1")).not.toBeInTheDocument();
  });

  it("点击查看证据打开抽屉", async () => {
    render(<App deps={deps} />);
    await switchToTargeted();
    await user.click(screen.getByRole("button", { name: "开始采集" }));
    expect(await screen.findByText("张三")).toBeInTheDocument();
    await user.click(screen.getAllByRole("button", { name: "查看证据" })[0]!);
    expect(await screen.findByText("张三 区长")).toBeInTheDocument();
  });

  it("默认完整机构模式：选择行政区后 createTask 传 regionCodes + FULL_INSTITUTION", async () => {
    render(<App deps={deps} />);
    // 默认 FULL_INSTITUTION 模式，RegionPicker 已渲染。
    expect(screen.getByText("采集范围")).toBeInTheDocument();
    // mock 省份加载 → 选省 → 选地市 → 展开。
    await user.click(screen.getByLabelText("省份"));
    await user.selectOptions(screen.getByLabelText("省份"), "340000");
    await waitFor(() => expect(screen.getByLabelText("地市（可多选）").children.length).toBe(1));
    await user.selectOptions(screen.getByLabelText("地市（可多选）"), "340100");
    await waitFor(() => expect(mockApi.expandRegions).toHaveBeenCalled());
    await user.click(screen.getByRole("button", { name: "开始采集" }));
    await waitFor(() => expect(mockApi.createTask).toHaveBeenCalled());
    const req = (mockApi.createTask as ReturnType<typeof vi.fn>).mock.calls[0]![0] as {
      mode: string;
      regionCodes: string[];
    };
    expect(req.mode).toBe("FULL_INSTITUTION");
    expect(req.regionCodes).toContain("340100");
  });

  it("两视图切换：点击历史记录显示历史视图", async () => {
    render(<App deps={deps} />);
    await user.click(screen.getByRole("button", { name: "历史记录" }));
    expect(screen.getByText("任务记录")).toBeInTheDocument();
  });

  it("共享 Header 使用装饰图标并保持导航 active 切换", async () => {
    render(<App deps={deps} />);

    const workspace = screen.getByRole("button", { name: "任务台" });
    const history = screen.getByRole("button", { name: "历史记录" });
    expect(workspace).toHaveClass("nav-active");
    expect(workspace.querySelector(".icon-task")).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByText("政务简历采集").closest("header")?.querySelector(".app-mark"))
      .toHaveAttribute("aria-hidden", "true");

    await user.click(history);
    expect(history).toHaveClass("nav-active");
    expect(workspace).not.toHaveClass("nav-active");
  });

  it("开始采集按钮保留 submit 和 disabled 语义并带装饰图标", () => {
    render(<App deps={deps} />);
    const submit = screen.getByRole("button", { name: "开始采集" });
    expect(submit).toHaveAttribute("type", "submit");
    expect(submit).toBeDisabled();
    expect(submit.querySelector(".icon-play")).toHaveAttribute("aria-hidden", "true");
  });
});
