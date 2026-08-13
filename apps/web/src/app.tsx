import { useState } from "react";
import { TaskForm, type TaskFormValues } from "./components/TaskForm.js";
import { TaskDetail as TaskDetailView } from "./components/TaskDetail.js";
import { TaskControlButtons } from "./components/TaskControlButtons.js";
import { TaskHistory } from "./components/TaskHistory.js";
import { ResultsTable } from "./components/ResultsTable.js";
import type { CreateTaskRequest, TaskRunSummary, ResultRowView, EvidenceDetail, TaskDetail, RegionNode } from "@stellaris/contracts";
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
            <span className="runtime-status">本机运行</span>
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

/** 任务台视图：创建任务 → 运行区 → 结果表。 */
function WorkspaceView({ api }: { api: ApiClient }): React.ReactElement {
  const [task, setTask] = useState<TaskRunSummary | null>(null);
  const [results, setResults] = useState<ResultRowView[]>([]);
  const [loading, setLoading] = useState(false);
  const [evidence, setEvidence] = useState<EvidenceDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (values: TaskFormValues): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const req = buildCreateRequest(values);
      const resp = await api.createTask(req);
      setTask(resp.task);
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
    await api.downloadExport(task.id);
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
    await api.downloadExport(taskId);
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
      regionCodes: [target.code],
      // Legacy backend compatibility only.
      // The frontend task level is now derived from the selected target region.
      // Remove when the Agent workflow backend contract replaces expandLevel.
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
