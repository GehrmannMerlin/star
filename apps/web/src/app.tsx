import { useEffect, useRef, useState } from "react";
import { TaskForm, type TaskFormValues } from "./components/TaskForm.js";
import { TaskDetail as TaskDetailView } from "./components/TaskDetail.js";
import { TaskControlButtons } from "./components/TaskControlButtons.js";
import { TaskHistory } from "./components/TaskHistory.js";
import { ResultsTable } from "./components/ResultsTable.js";
import type { CreateTaskRequest, TaskRunSummary, ResultRowView, EvidenceDetail, TaskDetail, RegionNode } from "@stellaris/contracts";
import { isTerminalStatus } from "./task-status.js";
import "./app.css";

/** API 客户端接口（生产用 fetch/EventSource 实现，测试注入 mock）。 */
export interface ApiClient {
  createTask(req: CreateTaskRequest): Promise<{ task: TaskRunSummary; idempotencyResult: "created" | "replayed" }>;
  getTask(id: string): Promise<TaskDetail>;
  getResults(id: string): Promise<ResultRowView[]>;
  getEvidence(id: string, resultRowId: string): Promise<EvidenceDetail>;
  downloadExport(id: string): Promise<void>;
  openEvents(id: string): EventSource;
  listTasks(params: { limit?: number; offset?: number; status?: string; mode?: string }): Promise<{ tasks: TaskRunSummary[]; total: number }>;
  controlTask(id: string, action: "pause" | "resume" | "cancel"): Promise<TaskRunSummary>;
  listProvinces(): Promise<RegionNode[]>;
  listChildren(parent: string): Promise<RegionNode[]>;
  validateRegions(codes: string[]): Promise<{ valid: boolean; invalid: string[] }>;
  expandRegions(codes: string[], level: "COUNTY" | "TOWN_STREET"): Promise<RegionNode[]>;
}

export interface AppDeps {
  api: ApiClient;
}

type View = { name: "workspace" } | { name: "history" } | { name: "detail"; taskId: string };

/**
 * 范围驱动任务台（规格 §20 视觉方向）。
 * 两视图：任务台（创建+运行+结果）/ 历史（任务列表回看）。
 * 用户可见位置只显示中文状态与结论。
 */
export function App({ deps }: { deps: AppDeps }): React.ReactElement {
  const [view, setView] = useState<View>({ name: "workspace" });

  const navigate = (v: View): void => {
    setView(v);
  };

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-header-inner">
          <div className="brand-lockup">
            <span className="app-mark" aria-hidden="true" />
            <span className="brand">政务简历采集</span>
            <span className="runtime-status">在线服务</span>
          </div>
          <nav className="app-nav" aria-label="主要导航">
            <button
              type="button"
              className={view.name === "workspace" ? "nav-active" : ""}
              onClick={() => navigate({ name: "workspace" })}
            >
              <span className="ui-icon icon-task" aria-hidden="true" />
              任务台
            </button>
            <button
              type="button"
              className={view.name === "history" ? "nav-active" : ""}
              onClick={() => navigate({ name: "history" })}
            >
              <span className="ui-icon icon-history" aria-hidden="true" />
              历史记录
            </button>
          </nav>
        </div>
      </header>
      <main className={`app-main app-main--${view.name}`}>
        {view.name === "workspace" && <WorkspaceView api={deps.api} />}
        {view.name === "history" && <TaskHistory api={deps.api} onOpen={(taskId) => navigate({ name: "detail", taskId })} />}
        {view.name === "detail" && <DetailView api={deps.api} taskId={view.taskId} onBack={() => navigate({ name: "history" })} />}
      </main>
    </div>
  );
}

/** 活跃任务 ID 持久化 key（只存 ID；后端 DB 是任务状态 SSoT）。 */
const ACTIVE_TASK_KEY = "stellaris.activeTaskId";

function readActiveTaskId(): string | null {
  try {
    return typeof window !== "undefined" ? window.localStorage.getItem(ACTIVE_TASK_KEY) : null;
  } catch {
    return null;
  }
}

function writeActiveTaskId(id: string): void {
  try {
    if (typeof window !== "undefined") window.localStorage.setItem(ACTIVE_TASK_KEY, id);
  } catch {
    // 本地存储不可用时静默跳过（不影响任务本身）。
  }
}

function clearActiveTaskId(): void {
  try {
    if (typeof window !== "undefined") window.localStorage.removeItem(ACTIVE_TASK_KEY);
  } catch {
    // 本地存储不可用时静默跳过。
  }
}

/** 任务台视图：创建任务 → 运行区 → 结果表。 */
function WorkspaceView({ api }: { api: ApiClient }): React.ReactElement {
  const [task, setTask] = useState<TaskRunSummary | null>(null);
  const [results, setResults] = useState<ResultRowView[]>([]);
  const [loading, setLoading] = useState(false);
  const [evidence, setEvidence] = useState<EvidenceDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const subscribedTaskRef = useRef<string | null>(null);

  /** 终态对齐：拉最终快照 + 结果（SSE 终态事件共用；§39 snapshot 最终对齐）。 */
  const reconcile = async (taskId: string): Promise<void> => {
    try {
      const detail = await api.getTask(taskId);
      setTask(detail.task);
      const rows = await api.getResults(taskId);
      setResults(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : "任务状态刷新失败");
    }
  };

  // 刷新 / 返回重灌：存在 activeTaskId 则读后端快照（不存在则清本地 ID）。
  useEffect(() => {
    const activeTaskId = readActiveTaskId();
    if (!activeTaskId) return;
    let cancelled = false;
    void (async () => {
      try {
        const detail = await api.getTask(activeTaskId);
        if (cancelled) return;
        setTask(detail.task);
        const rows = await api.getResults(activeTaskId);
        if (cancelled) return;
        setResults(rows);
      } catch (e) {
        if (!cancelled) clearActiveTaskId();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [api]);

  // SSE 订阅：活动任务实时进度；终态任务不订阅（§93）。
  useEffect(() => {
    if (!task || isTerminalStatus(task.status)) return;
    if (subscribedTaskRef.current === task.id) return;
    subscribedTaskRef.current = task.id;
    const es = api.openEvents(task.id);

    const onState = (event: Event): void => {
      const e = JSON.parse((event as MessageEvent).data) as { status: string; statusZh: string; stage?: string };
      setTask((prev) =>
        prev
          ? {
              ...prev,
              status: e.status as TaskRunSummary["status"],
              statusZh: e.statusZh,
              ...(e.stage ? { stage: e.stage as TaskRunSummary["stage"] } : {}),
            }
          : prev,
      );
    };
    const onProgress = (event: Event): void => {
      const e = JSON.parse((event as MessageEvent).data) as { processedInstitutions: number; totalInstitutions: number };
      setTask((prev) => (prev ? { ...prev, processedInstitutions: e.processedInstitutions, totalInstitutions: e.totalInstitutions } : prev));
    };
    const onTerminal = (): void => {
      es.close();
      subscribedTaskRef.current = null;
      void reconcile(task.id);
    };
    const onPaused = (event: Event): void => {
      const e = JSON.parse((event as MessageEvent).data) as { statusZh: string };
      setTask((prev) => (prev ? { ...prev, status: "PAUSED" as TaskRunSummary["status"], statusZh: e.statusZh } : prev));
    };
    const onResumed = (event: Event): void => {
      const e = JSON.parse((event as MessageEvent).data) as { statusZh: string };
      setTask((prev) => (prev ? { ...prev, status: "CRAWLING" as TaskRunSummary["status"], statusZh: e.statusZh } : prev));
    };

    es.addEventListener("task.state_changed", onState);
    es.addEventListener("task.progress_changed", onProgress);
    es.addEventListener("task.completed", onTerminal);
    es.addEventListener("task.failed", onTerminal);
    es.addEventListener("task.cancelled", onTerminal);
    es.addEventListener("task.paused", onPaused);
    es.addEventListener("task.resumed", onResumed);

    return () => {
      es.close();
      subscribedTaskRef.current = null;
    };
  }, [task?.id, api]);

  // STEP 19.3：轻量 snapshot polling 兜底（约 4s；仅 active 任务）。
  // 只解决 SSE 丢失 / 浏览器休眠 / Nginx 短断 / 极快 terminal 等一致性问题，不替代 SSE。
  // Terminal 后 effect 依赖 task.status 变化自动停止。
  useEffect(() => {
    if (!task || isTerminalStatus(task.status)) return;
    const timer = setInterval(() => {
      void (async () => {
        try {
          const detail = await api.getTask(task.id);
          setTask(detail.task);
        } catch {
          // polling 失败静默（SSE 仍可更新；不打断用户操作）。
        }
      })();
    }, 4000);
    return () => clearInterval(timer);
  }, [task?.id, task?.status, api]);

  const handleSubmit = async (values: TaskFormValues): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const req = buildCreateRequest(values);
      const resp = await api.createTask(req);
      writeActiveTaskId(resp.task.id);
      // STEP 19.3：POST 后立即 GET snapshot（Task Snapshot 是页面状态 SSoT；
      // 任务可能在 SSE 建立前已完成，快照保证快速终态不丢）。
      const detail = await api.getTask(resp.task.id);
      setTask(detail.task);
      const rows = await api.getResults(resp.task.id);
      setResults(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : "任务创建失败");
    } finally {
      setLoading(false);
    }
  };

  const handleTaskChanged = (updated: TaskRunSummary): void => {
    setTask(updated);
  };

  const handleViewEvidence = async (resultRowId: string): Promise<void> => {
    if (!task) return;
    const detail = await api.getEvidence(task.id, resultRowId);
    setEvidence(detail);
  };

  const handleExport = async (): Promise<void> => {
    if (!task) return;
    setError(null);
    try {
      await api.downloadExport(task.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "导出失败");
    }
  };

  return (
    <>
      <TaskForm api={api} onSubmit={handleSubmit} disabled={loading} />
      {error && <p className="error">{error}</p>}
      {task && (
        <TaskDetailView task={task} onExport={handleExport} controlButtons={<TaskControlButtons task={task} api={api} onChanged={handleTaskChanged} />} />
      )}
      {results.length > 0 && (
        <ResultsTable rows={results} onViewEvidence={handleViewEvidence} />
      )}
      {evidence && <EvidenceDrawer detail={evidence} onClose={() => setEvidence(null)} />}
    </>
  );
}

/** 详情回看视图（历史点击打开）。 */
function DetailView({
  api,
  taskId,
  onBack,
}: {
  api: ApiClient;
  taskId: string;
  onBack: () => void;
}): React.ReactElement {
  const [task, setTask] = useState<TaskRunSummary | null>(null);
  const [results, setResults] = useState<ResultRowView[]>([]);
  const [evidence, setEvidence] = useState<EvidenceDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 加载快照 + 结果。
  if (!task) {
    void (async () => {
      try {
        const detail = await api.getTask(taskId);
        setTask(detail.task);
        const rows = await api.getResults(taskId);
        setResults(rows);
      } catch (e) {
        setError(e instanceof Error ? e.message : "任务详情加载失败");
      }
    })();
  }

  const handleTaskChanged = (updated: TaskRunSummary): void => {
    setTask(updated);
  };

  const handleViewEvidence = async (resultRowId: string): Promise<void> => {
    const detail = await api.getEvidence(taskId, resultRowId);
    setEvidence(detail);
  };

  const handleExport = async (): Promise<void> => {
    setError(null);
    try {
      await api.downloadExport(taskId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "导出失败");
    }
  };

  return (
    <>
      <p className="back-link">
        <button type="button" onClick={onBack}>
          ← 返回历史
        </button>
      </p>
      {error && <p className="error">{error}</p>}
      {task && (
        <TaskDetailView
          task={task}
          onExport={handleExport}
          controlButtons={<TaskControlButtons task={task} api={api} onChanged={handleTaskChanged} />}
        />
      )}
      {results.length > 0 && (
        <ResultsTable rows={results} onViewEvidence={handleViewEvidence} />
      )}
      {evidence && <EvidenceDrawer detail={evidence} onClose={() => setEvidence(null)} />}
    </>
  );
}

/** 构造任务创建请求（§5.1 完整机构 / §5.2 定向）。 */
function buildCreateRequest(values: TaskFormValues): CreateTaskRequest {
  const base = {
    clientIdempotencyKey: `web-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    ruleVersion: "v1",
  };
  if (values.mode === "FULL_INSTITUTION" && values.regionSelection) {
    const target = values.regionSelection.finalRegion;
    if (!target) {
      throw new Error("请选择行政区");
    }
    return {
      ...base,
      mode: "FULL_INSTITUTION",
      regionCode: target.code,
      regionName: target.name,
      // STEP 19.3：单选行政区树语义 = 任务行政区（省=省级、省+市=地市级、省+市+区县=区县级）。
      // 不再传 regionCodes —— 传单个 regionCodes 会在后端被 expandRegions 展开成
      // 省+所有市+所有区县的多行 scope，从而误走 legacy multi-region 业务主流程。
      expandLevel: "COUNTY",
    };
  }
  return {
    ...base,
    mode: "TARGETED",
    regionCode: values.regionCode!,
    regionName: values.regionName!,
    institutionName: values.institutionName!,
    institutionType: values.institutionType ?? "government",
    ...(values.officialEntryUrl ? { officialEntryUrl: values.officialEntryUrl } : {}),
  };
}

function EvidenceDrawer({
  detail,
  onClose,
}: {
  detail: EvidenceDetail;
  onClose: () => void;
}): React.ReactElement {
  return (
    <div className="evidence-drawer" role="dialog" aria-label="证据详情">
      <div className="drawer-head">
        <h3>证据详情</h3>
        <button type="button" onClick={onClose}>
          关闭
        </button>
      </div>
      <dl>
        {detail.summary.pageTypeZh && (
          <>
            <dt>页面类型</dt>
            <dd>{detail.summary.pageTypeZh}</dd>
          </>
        )}
        <dt>支持片段</dt>
        <dd>
          {detail.summary.supportingSnippets.map((s) => (
            <p key={s}>{s}</p>
          ))}
        </dd>
        <dt>官方来源</dt>
        <dd>
          {detail.summary.officialSourceUrls.map((u) => (
            <a key={u} href={u} target="_blank" rel="noreferrer">
              {u}
            </a>
          ))}
        </dd>
        {detail.summary.terminalReasonZh && (
          <>
            <dt>终态原因</dt>
            <dd>{detail.summary.terminalReasonZh}</dd>
          </>
        )}
      </dl>
    </div>
  );
}
