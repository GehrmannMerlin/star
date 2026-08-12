import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { TaskControlButtons } from "./TaskControlButtons.js";
import { TaskHistory } from "./TaskHistory.js";
import type { ApiClient } from "../app.js";
import type { TaskRunSummary } from "@stellaris/contracts";

const user = userEvent.setup();

const activeTask: TaskRunSummary = {
  id: "t-active",
  status: "CRAWLING",
  statusZh: "正在抓取",
  mode: "TARGETED",
  expandLevel: "COUNTY",
  ruleVersion: "v1",
  totalInstitutions: 3,
  processedInstitutions: 1,
  reviewedSlots: 1,
  recoveryCount: 0,
  blockedCount: 0,
  requestedAt: new Date().toISOString(),
  controlable: true,
};

const pausedTask: TaskRunSummary = { ...activeTask, id: "t-paused", status: "PAUSED", statusZh: "已暂停" };
const doneTask: TaskRunSummary = { ...activeTask, id: "t-done", status: "COMPLETED", statusZh: "已完成", controlable: false };

function makeApi(overrides: Partial<ApiClient> = {}): ApiClient {
  return {
    createTask: vi.fn(),
    getTask: vi.fn(),
    getResults: vi.fn(),
    getEvidence: vi.fn(),
    downloadExport: vi.fn(),
    openEvents: vi.fn(),
    listTasks: vi.fn(async () => ({ tasks: [], total: 0 })),
    controlTask: vi.fn(async () => activeTask),
    listProvinces: vi.fn(async () => []),
    listChildren: vi.fn(async () => []),
    validateRegions: vi.fn(async () => ({ valid: true, invalid: [] })),
    expandRegions: vi.fn(async (codes: string[]) => codes.map((c) => ({ code: c, name: c, level: "county" as const, parentCode: null }))),
    ...overrides,
  };
}

describe("TaskControlButtons", () => {
  it("controlable=false 时不渲染任何按钮", () => {
    render(<TaskControlButtons task={doneTask} api={makeApi()} onChanged={() => {}} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("运行中任务显示暂停/取消；点击暂停调用 controlTask(pause)", async () => {
    const api = makeApi();
    const onChanged = vi.fn();
    render(<TaskControlButtons task={activeTask} api={api} onChanged={onChanged} />);
    expect(screen.getByRole("button", { name: "暂停" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "暂停" }));
    await waitFor(() => expect(api.controlTask).toHaveBeenCalledWith("t-active", "pause"));
    expect(onChanged).toHaveBeenCalled();
  });

  it("已暂停任务显示继续；点击继续调用 controlTask(resume)", async () => {
    const api = makeApi();
    render(<TaskControlButtons task={pausedTask} api={api} onChanged={() => {}} />);
    expect(screen.getByRole("button", { name: "继续" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "继续" }));
    await waitFor(() => expect(api.controlTask).toHaveBeenCalledWith("t-paused", "resume"));
  });

  it("取消需二次确认；确认后调用 controlTask(cancel)", async () => {
    const api = makeApi();
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<TaskControlButtons task={activeTask} api={api} onChanged={() => {}} />);
    await user.click(screen.getByRole("button", { name: "取消" }));
    expect(confirmSpy).toHaveBeenCalled();
    await waitFor(() => expect(api.controlTask).toHaveBeenCalledWith("t-active", "cancel"));
  });
});

describe("TaskHistory", () => {
  const listTasks = [
    { ...activeTask, id: "h1", statusZh: "已完成", status: "COMPLETED" as const, controlable: false },
    { ...activeTask, id: "h2", statusZh: "正在抓取" },
    { ...activeTask, id: "h3", statusZh: "已取消", status: "CANCELLED" as const },
  ];

  it("加载任务列表并渲染（状态/模式/计数/时间）", async () => {
    const api = makeApi({ listTasks: vi.fn(async () => ({ tasks: listTasks, total: 3 })) });
    render(<TaskHistory api={api} onOpen={() => {}} />);
    expect(await screen.findByText("任务记录")).toBeInTheDocument();
    await waitFor(() => expect(screen.getAllByRole("row").length).toBeGreaterThanOrEqual(4));
    // 表格内渲染状态与机构计数。
    expect(screen.getAllByRole("row")[1]).toHaveTextContent("已完成");
    expect(screen.getAllByRole("row")[2]).toHaveTextContent("正在抓取");
    expect(screen.getAllByRole("row")[1]).toHaveTextContent("1/3");
    expect(api.listTasks).toHaveBeenCalledWith({ limit: 20, offset: 0 });
  });

  it("状态筛选触发重新加载", async () => {
    const api = makeApi({ listTasks: vi.fn(async () => ({ tasks: listTasks, total: 3 })) });
    render(<TaskHistory api={api} onOpen={() => {}} />);
    await screen.findByText("任务记录");
    await user.selectOptions(screen.getByLabelText("状态筛选"), "COMPLETED");
    await waitFor(() =>
      expect(api.listTasks).toHaveBeenCalledWith({ limit: 20, offset: 0, status: "COMPLETED" }),
    );
  });

  it("点击行回调 onOpen(taskId)", async () => {
    const api = makeApi({ listTasks: vi.fn(async () => ({ tasks: listTasks, total: 3 })) });
    const onOpen = vi.fn();
    render(<TaskHistory api={api} onOpen={onOpen} />);
    const rows = await screen.findAllByRole("row");
    await user.click(rows[1]!); // 跳过表头
    expect(onOpen).toHaveBeenCalledWith(listTasks[0]!.id);
  });
});
