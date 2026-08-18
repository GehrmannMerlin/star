import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { App, type AppDeps, type ApiClient } from "./app.js";
import type {
  CreateTaskResponse,
  TaskDetail,
  ResultRowView,
  EvidenceDetail,
  TaskRunSummary,
} from "@stellaris/contracts";

const user = userEvent.setup();

class FakeEventSource extends EventTarget {
  closed = false;

  constructor(readonly url: string) {
    super();
  }

  close(): void {
    this.closed = true;
  }

  emit(type: string, data: unknown): void {
    const event = new Event(type);
    Object.assign(event, { data: JSON.stringify(data) });
    this.dispatchEvent(event);
  }
}

let lastEvents: FakeEventSource | null = null;

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
  stage: "COMPLETED" as const,
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
  createTask: vi.fn(async () => ({ task: taskSummary, idempotencyResult: "created" as const }) satisfies CreateTaskResponse),
  getTask: vi.fn(async () => ({
    task: taskSummary,
    scopes: [],
    institution: {
      id: "i1",
      taskRunId: "t1",
      regionCode: "110000",
      officialName: "某某区人民政府",
      institutionType: "government" as const,
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
  openEvents: vi.fn(() => new FakeEventSource("events") as unknown as EventSource),
  listTasks: vi.fn(async () => ({ tasks: [], total: 0 })),
  controlTask: vi.fn(async () => taskSummary),
  listProvinces: vi.fn(async () => [{ code: "340000", name: "安徽省", level: "province" as const, parentCode: null }]),
  listChildren: vi.fn(async () => [{ code: "340100", name: "合肥市", level: "city" as const, parentCode: "340000" }]),
  validateRegions: vi.fn(async () => ({ valid: true, invalid: [] })),
  expandRegions: vi.fn(async (codes: string[]) => codes.map((c) => ({ code: c, name: c, level: "county" as const, parentCode: null }))),
};
const deps: AppDeps = { api: mockApi };

// 运行中任务 fixture（SSE 进度 / 重灌测试用）。
const runningTask: TaskRunSummary = {
  ...taskSummary,
  id: "t2",
  status: "CRAWLING",
  statusZh: "正在抓取",
  processedInstitutions: 0,
  totalInstitutions: 3,
  stage: "INVESTIGATING",
  controlable: true,
};

/** 构造可覆盖的 ApiClient（默认返回运行中任务）。 */
function makeApi(overrides: Partial<ApiClient> = {}): ApiClient {
  const institution = {
    id: "i1",
    taskRunId: "t2",
    regionCode: "340000",
    officialName: "某某区人民政府",
    institutionType: "government" as const,
    discoverySource: "user_specified",
    selectTwoPrimary: true,
    frozenAt: new Date().toISOString(),
    status: "ACTIVE",
  };
  return {
    createTask: vi.fn(async () => ({ task: runningTask, idempotencyResult: "created" as const })),
    getTask: vi.fn(async () => ({ task: runningTask, scopes: [], institution })),
    getResults: vi.fn(async () => []),
    getEvidence: vi.fn(async () => ({ summary: { supportingSnippets: [], officialSourceUrls: [] } })),
    downloadExport: vi.fn(async () => {}),
    openEvents: vi.fn(() => {
      lastEvents = new FakeEventSource("events");
      return lastEvents as unknown as EventSource;
    }),
    listTasks: vi.fn(async () => ({ tasks: [], total: 0 })),
    controlTask: vi.fn(async () => runningTask),
    listProvinces: vi.fn(async () => [{ code: "340000", name: "安徽省", level: "province" as const, parentCode: null }]),
    listChildren: vi.fn(async () => [{ code: "340100", name: "合肥市", level: "city" as const, parentCode: "340000" }]),
    validateRegions: vi.fn(async () => ({ valid: true, invalid: [] })),
    expandRegions: vi.fn(async (codes: string[]) => codes.map((c) => ({ code: c, name: c, level: "county" as const, parentCode: null }))),
    ...overrides,
  };
}

// 每个测试独立 mock 状态，避免跨测试调用记录污染（FULL_INSTITUTION/TARGETED 断言）。
beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  lastEvents = null;
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

  it("STEP 19.3：默认完整机构模式：选择行政区后 createTask 传 regionCode（不再传 regionCodes）", async () => {
    render(<App deps={deps} />);
    // 默认 FULL_INSTITUTION 模式，RegionPicker 已渲染。
    expect(screen.getByText("采集范围")).toBeInTheDocument();
    // mock 省份加载 → 选省 → 选地市。
    await waitFor(() => expect(screen.getByLabelText("省份")).toHaveTextContent("安徽省"));
    await user.selectOptions(screen.getByLabelText("省份"), "340000");
    await waitFor(() => expect(screen.getByLabelText("地市")).toBeEnabled());
    await user.selectOptions(screen.getByLabelText("地市"), "340100");
    await user.click(screen.getByRole("button", { name: "开始采集" }));
    await waitFor(() => expect(mockApi.createTask).toHaveBeenCalled());
    const req = (mockApi.createTask as ReturnType<typeof vi.fn>).mock.calls[0]![0] as {
      mode: string;
      regionCode: string;
      regionCodes?: string[];
    };
    expect(req.mode).toBe("FULL_INSTITUTION");
    // STEP 19.3：单选行政区树不再编码成 regionCodes（避免后端 expandRegions 误走 legacy multi-region）。
    expect(req.regionCodes).toBeUndefined();
    expect(req.regionCode).toBe("340100");
  });

  it("仅选择省份时允许省级提交并使用省级 code", async () => {
    render(<App deps={deps} />);
    await waitFor(() => expect(screen.getByLabelText("省份")).toHaveTextContent("安徽省"));
    await user.selectOptions(screen.getByLabelText("省份"), "340000");
    await waitFor(() => expect(screen.getByText("任务层级：省级")).toBeInTheDocument());
    const submit = screen.getByRole("button", { name: "开始采集" });
    expect(submit).toBeEnabled();
    await user.click(submit);
    await waitFor(() => expect(mockApi.createTask).toHaveBeenCalled());
    const req = (mockApi.createTask as ReturnType<typeof vi.fn>).mock.calls[0]![0] as { regionCode: string };
    expect(req.regionCode).toBe("340000");
  });

  it("完整机构模式不显示旧的展开层级和批量代码控件", () => {
    render(<App deps={deps} />);
    expect(screen.queryByText("展开层级")).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "校验并添加" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("完整机构模式")).toBeInTheDocument();
    expect(screen.getByLabelText("指定机构")).toBeInTheDocument();
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

describe("任务进度 SSE 绑定", () => {
  it("创建运行中任务后订阅 SSE 并更新进度", async () => {
    const api = makeApi();
    render(<App deps={{ api }} />);
    await switchToTargeted();
    await user.click(screen.getByRole("button", { name: "开始采集" }));

    await waitFor(() => expect(api.openEvents).toHaveBeenCalledTimes(1));
    expect(lastEvents).not.toBeNull();
    lastEvents!.emit("task.progress_changed", { processedInstitutions: 2, totalInstitutions: 3 });
    await waitFor(() => expect(screen.getByText("机构进度：2/3")).toBeInTheDocument());
  });

  it("STEP 19.3：POST 后任务极快 COMPLETED（SSE 前 terminal）→ 直接显示已完成且不订阅 SSE", async () => {
    const completed: TaskRunSummary = { ...runningTask, status: "COMPLETED", statusZh: "已完成", stage: "COMPLETED", controlable: false };
    const api = makeApi({
      getTask: vi.fn(async () => ({
        task: completed,
        scopes: [],
        institution: {
          id: "i1",
          taskRunId: "t2",
          regionCode: "340000",
          officialName: "某某区人民政府",
          institutionType: "government" as const,
          discoverySource: "user_specified",
          selectTwoPrimary: true,
          frozenAt: new Date().toISOString(),
          status: "ACTIVE",
        },
      })),
    });
    render(<App deps={{ api }} />);
    await switchToTargeted();
    await user.click(screen.getByRole("button", { name: "开始采集" }));

    // 快照是 SSoT：任务已完成则直接恢复终态，SSE 未建立也不丢。
    await waitFor(() => expect(screen.getByText(/已完成/)).toBeInTheDocument());
    expect(api.openEvents).not.toHaveBeenCalled();
  });

  it("STEP 19.3：SSE 终态事件 → snapshot reconciliation → 关闭 SSE 并停止 polling", async () => {
    const completed: TaskRunSummary = { ...runningTask, status: "COMPLETED", statusZh: "已完成", stage: "COMPLETED", controlable: false };
    let getTaskCalls = 0;
    const api = makeApi({
      getTask: vi.fn(async () => ({
        task: getTaskCalls++ === 0 ? runningTask : completed,
        scopes: [],
        institution: {
          id: "i1",
          taskRunId: "t2",
          regionCode: "340000",
          officialName: "某某区人民政府",
          institutionType: "government" as const,
          discoverySource: "user_specified",
          selectTwoPrimary: true,
          frozenAt: new Date().toISOString(),
          status: "ACTIVE",
        },
      })),
    });
    render(<App deps={{ api }} />);
    await switchToTargeted();
    await user.click(screen.getByRole("button", { name: "开始采集" }));

    await waitFor(() => expect(api.openEvents).toHaveBeenCalledTimes(1));
    const es = lastEvents!;
    es.emit("task.completed", { statusZh: "已完成" });

    await waitFor(() => expect(screen.getByText(/已完成/)).toBeInTheDocument());
    expect(es.closed).toBe(true);
    expect(api.getResults).toHaveBeenCalled();
  });

  it("终态任务不订阅 SSE", async () => {
    render(<App deps={deps} />);
    await switchToTargeted();
    await user.click(screen.getByRole("button", { name: "开始采集" }));
    await waitFor(() => expect(screen.getByText(/已完成/)).toBeInTheDocument());
    expect(mockApi.openEvents).not.toHaveBeenCalled();
  });
});

describe("刷新重灌", () => {
  it("localStorage 存在 activeTaskId 时挂载即恢复任务", async () => {
    window.localStorage.setItem("stellaris.activeTaskId", "t2");
    const api = makeApi();
    render(<App deps={{ api }} />);

    await waitFor(() => expect(api.getTask).toHaveBeenCalledWith("t2"));
    expect(await screen.findByText(/正在抓取/)).toBeInTheDocument();
  });

  it("重灌时后端报错则清除 activeTaskId", async () => {
    window.localStorage.setItem("stellaris.activeTaskId", "ghost");
    const api = makeApi({
      getTask: vi.fn(async () => {
        throw new Error("404");
      }),
    });
    render(<App deps={{ api }} />);

    await waitFor(() => expect(window.localStorage.getItem("stellaris.activeTaskId")).toBeNull());
  });
});

describe("导出按钮 gating", () => {
  it("非终态任务导出按钮禁用", async () => {
    const api = makeApi();
    render(<App deps={{ api }} />);
    await switchToTargeted();
    await user.click(screen.getByRole("button", { name: "开始采集" }));
    await waitFor(() => expect(screen.getByText(/正在抓取/)).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "导出 Excel" })).toBeDisabled();
  });

  it("COMPLETED 任务导出按钮可用", async () => {
    render(<App deps={deps} />);
    await switchToTargeted();
    await user.click(screen.getByRole("button", { name: "开始采集" }));
    await waitFor(() => expect(screen.getByText(/已完成/)).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "导出 Excel" })).toBeEnabled();
  });

  it("PARTIAL_COMPLETED 任务导出按钮可用且不当失败展示", async () => {
    const partial: TaskRunSummary = { ...taskSummary, status: "PARTIAL_COMPLETED", statusZh: "部分完成", stage: "PARTIAL_COMPLETED", controlable: false };
    const api = makeApi({
      createTask: vi.fn(async () => ({ task: partial, idempotencyResult: "created" as const })),
      getTask: vi.fn(async () => ({ task: partial, scopes: [], institution: { id: "i1", taskRunId: "t1", regionCode: "340000", officialName: "某某区人民政府", institutionType: "government" as const, discoverySource: "user_specified", selectTwoPrimary: true, frozenAt: new Date().toISOString(), status: "ACTIVE" } })),
    });
    render(<App deps={{ api }} />);
    await switchToTargeted();
    await user.click(screen.getByRole("button", { name: "开始采集" }));
    await waitFor(() => expect(screen.getByText(/部分完成/)).toBeInTheDocument());
    expect(screen.queryByText(/失败/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "导出 Excel" })).toBeEnabled();
  });
});
