import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import type { TaskRunSummary } from "@stellaris/contracts";
import type { ApiClient } from "../app.js";
import { TaskHistory } from "./TaskHistory.js";

const taskSummary: TaskRunSummary = {
  id: "history-task",
  status: "COMPLETED",
  statusZh: "已完成",
  mode: "FULL_INSTITUTION",
  expandLevel: "COUNTY",
  ruleVersion: "v1",
  totalInstitutions: 3,
  processedInstitutions: 2,
  reviewedSlots: 4,
  recoveryCount: 0,
  blockedCount: 0,
  requestedAt: new Date(0).toISOString(),
  stage: "COMPLETED",
  controlable: false,
};

function makeApi(overrides: Partial<ApiClient> = {}): ApiClient {
  return {
    createTask: vi.fn(),
    getTask: vi.fn(),
    getResults: vi.fn(),
    getEvidence: vi.fn(),
    downloadExport: vi.fn(),
    openEvents: vi.fn(),
    listTasks: vi.fn(async () => ({ tasks: [taskSummary], total: 1 })),
    controlTask: vi.fn(async () => taskSummary),
    listProvinces: vi.fn(async () => []),
    listChildren: vi.fn(async () => []),
    validateRegions: vi.fn(async () => ({ valid: true, invalid: [] })),
    expandRegions: vi.fn(async () => []),
    ...overrides,
  };
}

describe("TaskHistory", () => {
  it("loads an empty history once and shows the empty state", async () => {
    const listTasks = vi.fn(async () => ({ tasks: [], total: 0 }));
    const api = makeApi({ listTasks });

    render(<TaskHistory api={api} onOpen={vi.fn()} />);

    expect(await screen.findByText("暂无任务记录")).toBeInTheDocument();
    await waitFor(() => expect(listTasks).toHaveBeenCalledTimes(1));
  });

  it("使用 API 返回任务渲染 table card 并保持筛选逻辑", async () => {
    const user = userEvent.setup();
    const api = makeApi();
    render(<TaskHistory api={api} onOpen={vi.fn()} />);

    expect(await screen.findByText(taskSummary.statusZh)).toBeInTheDocument();
    const table = screen.getByRole("table", { name: "任务列表" });
    expect(table.closest(".table-scroll")).toBeInTheDocument();
    expect(table.closest(".history-table-card")).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("状态筛选"), "COMPLETED");
    await waitFor(() => expect(api.listTasks).toHaveBeenLastCalledWith({
      limit: 20,
      offset: 0,
      status: "COMPLETED",
    }));
  });
});
