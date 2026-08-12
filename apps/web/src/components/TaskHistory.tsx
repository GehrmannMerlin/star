import { useState } from "react";
import type { TaskRunSummary } from "@stellaris/contracts";
import type { ApiClient } from "../app.js";

/** 任务列表分页参数。 */
export interface TaskListParams {
  status?: string;
  mode?: string;
}

/**
 * 任务历史列表（规格 §19.1「查询任务与结果」；§20.1 低强调任务记录）。
 * 分页 + 状态/模式筛选；点行回调打开任务详情。
 */
export function TaskHistory({
  api,
  onOpen,
}: {
  api: ApiClient;
  onOpen: (taskId: string) => void;
}): React.ReactElement {
  const PAGE_SIZE = 20;
  const [tasks, setTasks] = useState<TaskRunSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [status, setStatus] = useState("");
  const [mode, setMode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async (nextOffset: number, nextStatus: string, nextMode: string): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.listTasks({
        limit: PAGE_SIZE,
        offset: nextOffset,
        ...(nextStatus ? { status: nextStatus } : {}),
        ...(nextMode ? { mode: nextMode } : {}),
      });
      setTasks(res.tasks);
      setTotal(res.total);
      setOffset(nextOffset);
    } catch (e) {
      setError(e instanceof Error ? e.message : "任务列表加载失败");
    } finally {
      setLoading(false);
    }
  };

  // 首次渲染加载。
  if (tasks.length === 0 && !loading && offset === 0 && !error) {
    void load(0, "", "");
  }

  const pageCount = Math.ceil(total / PAGE_SIZE);
  const page = Math.floor(offset / PAGE_SIZE) + 1;

  return (
    <section className="task-history" aria-label="任务记录">
      <h3>任务记录</h3>
      <div className="th-filters">
        <select
          aria-label="状态筛选"
          value={status}
          onChange={(e) => {
            const v = e.target.value;
            setStatus(v);
            void load(0, v, mode);
          }}
        >
          <option value="">全部状态</option>
          <option value="PENDING">待开始</option>
          <option value="CRAWLING">正在抓取</option>
          <option value="PAUSED">已暂停</option>
          <option value="COMPLETED">已完成</option>
          <option value="FAILED">失败</option>
          <option value="CANCELLED">已取消</option>
        </select>
        <select
          aria-label="模式筛选"
          value={mode}
          onChange={(e) => {
            const v = e.target.value;
            setMode(v);
            void load(0, status, v);
          }}
        >
          <option value="">全部模式</option>
          <option value="FULL_INSTITUTION">完整机构</option>
          <option value="TARGETED">定向</option>
        </select>
      </div>

      {error && <p className="error">{error}</p>}
      {loading && <p className="rp-hint">加载中…</p>}

      {tasks.length === 0 && !loading && !error && <p className="rp-hint">暂无任务记录</p>}

      {tasks.length > 0 && (
        <>
          <div className="history-table-card">
            <div className="table-scroll">
              <table className="results-table" aria-label="任务列表">
                <thead>
                  <tr>
                    <th>状态</th>
                    <th>模式</th>
                    <th>已处理机构</th>
                    <th>已复核岗位</th>
                    <th>请求时间</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.map((t) => (
                    <tr key={t.id} className="th-row" onClick={() => onOpen(t.id)}>
                      <td>{t.statusZh}</td>
                      <td>{t.mode === "FULL_INSTITUTION" ? "完整机构" : "定向"}</td>
                      <td>
                        {t.processedInstitutions}/{t.totalInstitutions}
                      </td>
                      <td>{t.reviewedSlots}</td>
                      <td>{new Date(t.requestedAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="th-pager">
            <button
              type="button"
              disabled={page <= 1 || loading}
              onClick={() => void load(offset - PAGE_SIZE, status, mode)}
            >
              上一页
            </button>
            <span className="rp-hint">
              {page}/{Math.max(pageCount, 1)}
            </span>
            <button
              type="button"
              disabled={page >= pageCount || loading}
              onClick={() => void load(offset + PAGE_SIZE, status, mode)}
            >
              下一页
            </button>
          </div>
        </>
      )}
    </section>
  );
}
