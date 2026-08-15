import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchAuthenticated,
  openAuthenticatedEvents,
  redirectToPortalLogin,
  filenameFromContentDisposition,
  downloadAuthenticatedBlob,
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
  vi.restoreAllMocks();
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

describe("filenameFromContentDisposition", () => {
  it("解析 RFC 5987 filename* 并做 percent 解码", () => {
    const header = "attachment; filename*=UTF-8''%E5%B2%97%E4%BD%8D.xlsx";
    expect(filenameFromContentDisposition(header)).toBe("岗位.xlsx");
  });

  it("回退到 filename= 引号与裸形式", () => {
    expect(filenameFromContentDisposition('attachment; filename="result.xlsx"')).toBe("result.xlsx");
    expect(filenameFromContentDisposition("attachment; filename=result.xlsx")).toBe("result.xlsx");
  });

  it("缺失 header 或无可解析文件名时返回 null", () => {
    expect(filenameFromContentDisposition(null)).toBeNull();
    expect(filenameFromContentDisposition("attachment")).toBeNull();
  });
});

describe("downloadAuthenticatedBlob", () => {
  it("非 OK 导出（409 未完成）抛映射后的中文错误", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: "TASK_NOT_READY" }), {
          status: 409,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );
    await expect(downloadAuthenticatedBlob("/api/tasks/t1/export")).rejects.toThrow("任务尚未完成，无法导出");
  });

  it("非 OK 导出（409 无可导出）抛映射后的中文错误", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: "TASK_NOT_EXPORTABLE" }), {
          status: 409,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );
    await expect(downloadAuthenticatedBlob("/api/tasks/t1/export")).rejects.toThrow("任务无可导出结果");
  });

  it("成功下载时把 Content-Disposition 文件名赋给 link.download", async () => {
    const blob = new Blob(["x"], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(blob, {
          status: 200,
          headers: { "Content-Disposition": "attachment; filename*=UTF-8''biography.xlsx" },
        }),
      ),
    );
    const link = { href: "", download: "", click: vi.fn(), remove: vi.fn() };
    vi.spyOn(document, "createElement").mockReturnValue(link as unknown as HTMLAnchorElement);
    vi.spyOn(document.body, "append").mockImplementation(() => {});
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn(() => "blob:fake"),
      revokeObjectURL: vi.fn(),
    });

    await downloadAuthenticatedBlob("/api/tasks/t1/export");

    expect(link.download).toBe("biography.xlsx");
    expect(link.href).toBe("blob:fake");
    expect(link.click).toHaveBeenCalledTimes(1);
  });
});
