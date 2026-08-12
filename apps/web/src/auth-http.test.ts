import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchAuthenticated,
  openAuthenticatedEvents,
  redirectToPortalLogin,
} from "./auth-http.js";

class FakeEventSource extends EventTarget {
  static latest: FakeEventSource | undefined;

  constructor(readonly url: string) {
    super();
    FakeEventSource.latest = this;
  }

  close(): void {}
}

afterEach(() => {
  vi.unstubAllGlobals();
  FakeEventSource.latest = undefined;
});

describe("authenticated HTTP", () => {
  it("redirects 401, reports 503, and redirects SSE only after a 401 session check", async () => {
    const redirects: string[] = [];
    const redirect = (): void => {
      redirects.push("redirected");
    };
    const location = { assign: vi.fn() } as unknown as Location;

    redirectToPortalLogin(location);
    expect(location.assign).toHaveBeenCalledWith("/?redirect=%2Fzhengwujianli%2F&reauth=1");

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 401 })));
    const unauthorized = await fetchAuthenticated("/api/tasks", { onUnauthorized: redirect });
    expect(unauthorized.status).toBe(401);
    expect(redirects).toEqual(["redirected"]);

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 503 })));
    await expect(fetchAuthenticated("/api/tasks")).rejects.toThrow("服务暂不可用");

    vi.stubGlobal("EventSource", FakeEventSource);
    const sessionFetch = vi.fn().mockResolvedValueOnce(new Response(null, { status: 503 })).mockResolvedValueOnce(new Response(null, { status: 401 }));
    vi.stubGlobal("fetch", sessionFetch);
    const events = openAuthenticatedEvents("/api/tasks/t1/events", { onUnauthorized: redirect });
    events.dispatchEvent(new Event("error"));
    await vi.waitFor(() => expect(sessionFetch).toHaveBeenCalledTimes(1));
    expect(redirects).toEqual(["redirected"]);

    events.dispatchEvent(new Event("error"));
    await vi.waitFor(() => expect(redirects).toEqual(["redirected", "redirected"]));
  });
});
