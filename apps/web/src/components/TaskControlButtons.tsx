import { useState } from "react";
import type { TaskRunSummary } from "@stellaris/contracts";
import type { ApiClient } from "../app.js";

/**
 * 任务控制按钮（规格 §20.2 运行区暂停/取消；§5.3 暂停和继续 / §5.4 取消）。
 * 按 task.controlable 显隐；cancel 为危险操作需二次确认。
 */
export function TaskControlButtons({
  task,
  api,
  onChanged,
}: {
  task: TaskRunSummary;
  api: ApiClient;
  onChanged: (updated: TaskRunSummary) => void;
}): React.ReactElement {
  const [busy, setBusy] = useState(false);

  if (!task.controlable) return <></>;

  const run = async (action: "pause" | "resume" | "cancel"): Promise<void> => {
    setBusy(true);
    try {
      const updated = await api.controlTask(task.id, action);
      onChanged(updated);
    } finally {
      setBusy(false);
    }
  };

  const isPaused = task.status === "PAUSED";

  return (
    <span className="task-controls">
      {isPaused ? (
        <button type="button" disabled={busy} onClick={() => void run("resume")}>
          继续
        </button>
      ) : (
        <button type="button" disabled={busy} onClick={() => void run("pause")}>
          暂停
        </button>
      )}
      <button
        type="button"
        disabled={busy}
        className="danger"
        onClick={() => {
          if (window.confirm("确定取消该任务？已抓取证据将保留。")) {
            void run("cancel");
          }
        }}
      >
        取消
      </button>
    </span>
  );
}
