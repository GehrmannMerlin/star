import type { ReactElement } from "react";
import type { TaskRunSummary } from "@stellaris/contracts";
import { isExportableStatus } from "../task-status.js";

export interface TaskDetailView {
  task: TaskRunSummary;
}

/** 是否处于活动运行态（用于细进度线动画，§20.2 只表达活动状态）。 */
const ACTIVE_STATUSES = new Set(["PENDING", "PREPARING", "CRAWLING", "RECOVERING", "REVIEWING", "GENERATING"]);

/**
 * 真实任务阶段/计数/失败状态（规格 §20.2 运行区）。
 * 只显示真实计数，不展示虚假线性百分比；细进度线只表达活动状态。
 */
export function TaskDetail({
  task,
  onExport,
  controlButtons,
}: {
  task: TaskRunSummary;
  onExport: () => Promise<void>;
  controlButtons?: ReactElement;
}): React.ReactElement {
  const active = ACTIVE_STATUSES.has(task.status);
  const exportable = isExportableStatus(task.status);
  return (
    <section className="task-detail" aria-label="任务状态">
      <div className="stat-row">
        <span>状态：{task.statusZh}</span>
        <span>已处理机构：{task.processedInstitutions}/{task.totalInstitutions}</span>
        <span>已复核岗位：{task.reviewedSlots}</span>
        <span>Recovery：{task.recoveryCount}</span>
        <span>官网受限：{task.blockedCount}</span>
      </div>
      {/* 细进度线：只表达活动状态，不暗示完成比例（§20.2 禁止虚假百分比）。 */}
      {active && <div className="activity-line" aria-hidden="true" />}
      {controlButtons}
      <button type="button" disabled={!exportable} onClick={() => void onExport()}>
        导出 Excel
      </button>
    </section>
  );
}
