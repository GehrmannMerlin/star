import type { ReactElement } from "react";
import type { TaskRunSummary } from "@stellaris/contracts";
import { isExportableStatus, isTerminalStatus, stageZh } from "../task-status.js";

export interface TaskDetailView {
  task: TaskRunSummary;
}

/** 是否处于活动运行态（用于细进度线动画，§20.2 只表达活动状态）。 */
const ACTIVE_STATUSES = new Set(["PENDING", "PREPARING", "CRAWLING", "RECOVERING", "REVIEWING", "GENERATING"]);

/** 运行时间（前端由 startedAt derive；不伪造后端字段）。 */
function formatElapsed(startedAt: string): string {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const pad = (n: number): string => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

/**
 * 真实任务阶段/计数/失败状态（规格 §20.2 运行区；STEP 19.3 增加 Agent 阶段/当前机构）。
 * 只显示真实计数，不展示虚假线性百分比；细进度线只表达活动状态。
 * 保持整体卡片布局与视觉风格，不重建页面、不展示模型内部内容。
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
  const elapsed = task.startedAt ? formatElapsed(task.startedAt) : null;
  return (
    <section className="task-detail" aria-label="任务状态">
      <div className="stat-row">
        <span>状态：{task.statusZh}</span>
        {/* 运行中显示 Agent 阶段；终态由状态表达（避免「已完成」重复）。 */}
        {!isTerminalStatus(task.status) && <span>当前阶段：{stageZh(task.stage)}</span>}
        {!isTerminalStatus(task.status) && task.currentInstitution && <span>当前机构：{task.currentInstitution}</span>}
      </div>
      <div className="stat-row">
        <span>机构进度：{task.processedInstitutions}/{task.totalInstitutions}</span>
        <span>已复核岗位：{task.reviewedSlots}</span>
        <span>Recovery：{task.recoveryCount}</span>
        <span>官网受限：{task.blockedCount}</span>
        {elapsed && <span>运行时间：{elapsed}</span>}
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
