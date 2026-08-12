import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App, type ApiClient } from "./app.js";
import { apiUrl } from "./api-url.js";
import { downloadAuthenticatedBlob, fetchAuthenticated, openAuthenticatedEvents } from "./auth-http.js";
import type { CreateTaskRequest, TaskRunSummary, TaskDetail, ResultRowView, EvidenceDetail, RegionNode } from "@stellaris/contracts";

/** 生产 API 客户端：fetch + 原生 EventSource（规格 §6.2.1）。 */
const realApi: ApiClient = {
  async createTask(req: CreateTaskRequest) {
    const res = await fetchAuthenticated(apiUrl("tasks"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
    });
    return (await res.json()) as { task: TaskRunSummary; idempotencyResult: "created" | "replayed" };
  },
  async getTask(id: string) {
    const res = await fetchAuthenticated(apiUrl(`tasks/${id}`));
    return (await res.json()) as TaskDetail;
  },
  async getResults(id: string) {
    const res = await fetchAuthenticated(apiUrl(`tasks/${id}/results`));
    return (await res.json()) as ResultRowView[];
  },
  async getEvidence(id: string, resultRowId: string) {
    const res = await fetchAuthenticated(apiUrl(`tasks/${id}/evidence/${resultRowId}`));
    return (await res.json()) as EvidenceDetail;
  },
  async downloadExport(id: string) {
    await downloadAuthenticatedBlob(apiUrl(`tasks/${id}/export`));
  },
  openEvents(id: string) {
    return openAuthenticatedEvents(apiUrl(`tasks/${id}/events`));
  },
  async listTasks(params) {
    const qs = new URLSearchParams();
    if (params.limit !== undefined) qs.set("limit", String(params.limit));
    if (params.offset !== undefined) qs.set("offset", String(params.offset));
    if (params.status) qs.set("status", params.status);
    if (params.mode) qs.set("mode", params.mode);
    const res = await fetchAuthenticated(apiUrl(`tasks?${qs.toString()}`));
    return (await res.json()) as { tasks: TaskRunSummary[]; total: number };
  },
  async controlTask(id: string, action: "pause" | "resume" | "cancel") {
    const res = await fetchAuthenticated(apiUrl(`tasks/${id}/${action}`), { method: "POST" });
    const body = (await res.json()) as { ok: boolean; task?: TaskRunSummary; error?: string };
    if (!body.ok) throw new Error(body.error ?? "任务控制失败");
    if (!body.task) throw new Error("任务控制响应缺少任务");
    return body.task;
  },
  async listProvinces() {
    const res = await fetchAuthenticated(apiUrl("regions/provinces"));
    return (await res.json()) as RegionNode[];
  },
  async listChildren(parent: string) {
    const res = await fetchAuthenticated(apiUrl(`regions/children?parent=${encodeURIComponent(parent)}`));
    return (await res.json()) as RegionNode[];
  },
  async validateRegions(codes: string[]) {
    const res = await fetchAuthenticated(apiUrl("regions/validate"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ codes }),
    });
    return (await res.json()) as { valid: boolean; invalid: string[] };
  },
  async expandRegions(codes: string[], level: "COUNTY" | "TOWN_STREET") {
    const res = await fetchAuthenticated(apiUrl("regions/expand"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ codes, level }),
    });
    return (await res.json()) as RegionNode[];
  },
};

const rootEl = document.getElementById("root");
if (!rootEl) {
  throw new Error("missing #root element");
}

createRoot(rootEl).render(
  <StrictMode>
    <App deps={{ api: realApi }} />
  </StrictMode>,
);
