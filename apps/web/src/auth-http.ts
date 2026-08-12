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

export async function downloadAuthenticatedBlob(url: string): Promise<void> {
  const response = await fetchAuthenticated(url);
  const blob = await response.blob();
  const temporaryUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = temporaryUrl;
  link.download = "";
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
