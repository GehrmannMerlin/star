import { apiUrl } from "./api-url.js";

export const PORTAL_LOGIN_URL = "/?redirect=%2Fzhengwujianli%2F&reauth=1";

export type AuthenticatedRequestInit = RequestInit & {
  onUnauthorized?: () => void;
};

export function redirectToPortalLogin(location: Pick<Location, "assign"> = window.location): void {
  location.assign(PORTAL_LOGIN_URL);
}

export async function fetchAuthenticated(
  input: RequestInfo | URL,
  init: AuthenticatedRequestInit = {},
): Promise<Response> {
  const { onUnauthorized, ...requestInit } = init;
  const response = await fetch(input, { ...requestInit, credentials: "same-origin" });
  if (response.status === 401) {
    (onUnauthorized ?? redirectToPortalLogin)();
  }
  if (response.status === 503) {
    throw new Error("服务暂不可用");
  }
  return response;
}

/** 解析 Content-Disposition 文件名（RFC 5987 `filename*` 优先，退 `filename=`）。 */
export function filenameFromContentDisposition(header: string | null): string | null {
  if (!header) return null;
  const star = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (star?.[1]) {
    try {
      return decodeURIComponent(star[1]);
    } catch {
      // percent 解码失败时回退到 filename= 或 null。
    }
  }
  const plain = /filename="?([^";]+)"?/i.exec(header);
  if (plain?.[1]) return plain[1];
  return null;
}

/** 后端导出错误码 → 用户可见中文（复用现有错误展示，不 alert）。 */
async function exportErrorMessage(response: Response): Promise<string> {
  let code = "";
  try {
    const body = (await response.json()) as { error?: string };
    code = body.error ?? "";
  } catch {
    // 非 JSON 错误体：使用默认文案。
  }
  switch (code) {
    case "TASK_NOT_READY":
      return "任务尚未完成，无法导出";
    case "TASK_NOT_EXPORTABLE":
      return "任务无可导出结果";
    case "ARTIFACT_GENERATION_FAILED":
      return "导出生成失败，请重试";
    case "TASK_NOT_FOUND":
      return "任务不存在";
    default:
      return "导出失败，请重试";
  }
}

export async function downloadAuthenticatedBlob(url: string): Promise<void> {
  const response = await fetchAuthenticated(url);
  if (!response.ok) {
    throw new Error(await exportErrorMessage(response));
  }
  const blob = await response.blob();
  const filename = filenameFromContentDisposition(response.headers.get("Content-Disposition")) ?? "export.xlsx";
  const temporaryUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = temporaryUrl;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(temporaryUrl);
}

export type AuthenticatedEventsOptions = {
  sessionUrl?: string;
  onUnauthorized?: () => void;
};

export function openAuthenticatedEvents(
  url: string,
  { sessionUrl = apiUrl("session"), onUnauthorized = redirectToPortalLogin }: AuthenticatedEventsOptions = {},
): EventSource {
  const events = new EventSource(url);
  events.addEventListener("error", () => {
    void fetch(sessionUrl, { credentials: "same-origin" })
      .then((response) => {
        if (response.status === 401) onUnauthorized();
      })
      .catch(() => {
        // EventSource retains its browser-managed reconnect behavior for network failures.
      });
  });
  return events;
}
