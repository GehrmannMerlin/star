import { describe, expect, it } from "vitest";
import { PostgresToolEventJournal } from "./postgres-tool-event-journal.js";
import { FakeToolEventRepo } from "./persistence-test-support.js";

function context(overrides: Partial<{ agentSessionId: string; packetId: string }> = {}) {
  return {
    taskRunId: "task-1",
    agentSessionId: overrides.agentSessionId ?? "session-1",
    agentRole: "INVESTIGATOR" as const,
    packetId: overrides.packetId ?? "packet-1",
    signal: new AbortController().signal,
  };
}

describe("PostgresToolEventJournal (over fake repo)", () => {
  it("appends STARTED + projected SUCCESS rows and reconstructs gate-usable success events", async () => {
    const repo = new FakeToolEventRepo();
    const journal = new PostgresToolEventJournal(repo);

    const ctx = context();
    await journal.onStart({ callId: "call-fetch", toolName: "fetch_page", context: ctx, startedAt: "2026-08-14T00:00:00.000Z" });
    await journal.onSuccess({
      callId: "call-fetch",
      toolName: "fetch_page",
      status: "SUCCESS",
      data: {
        requestedUrl: "https://a.example/1",
        finalUrl: "https://a.example/1",
        statusCode: 200,
        content: "<html>secret</html>",
      },
      startedAt: "2026-08-14T00:00:00.000Z",
      finishedAt: "2026-08-14T00:00:00.100Z",
    });
    await journal.onStart({ callId: "call-inspect", toolName: "inspect_page", context: ctx, startedAt: "2026-08-14T00:00:01.000Z" });
    await journal.onSuccess({
      callId: "call-inspect",
      toolName: "inspect_page",
      status: "SUCCESS",
      data: { url: "https://a.example/1", title: "区长 王安伟" },
      startedAt: "2026-08-14T00:00:01.000Z",
      finishedAt: "2026-08-14T00:00:01.100Z",
    });

    // 写入侧：2 STARTED + 2 SUCCESS，且投影已剥离原始内容。
    expect(repo.rows).toHaveLength(4);
    const serialized = JSON.stringify(repo.rows);
    expect(serialized).not.toContain("<html");
    expect(serialized).not.toContain("secret");

    // 读取侧：仅 SUCCESS，按 seq 顺序。
    const successes = await journal.listSuccesses();
    expect(successes).toHaveLength(2);
    expect(successes[0]?.toolName).toBe("fetch_page");
    expect(successes[0]?.data).toEqual({
      requestedUrl: "https://a.example/1",
      finalUrl: "https://a.example/1",
      statusCode: 200,
    });
    expect(successes[1]?.toolName).toBe("inspect_page");
    expect(successes[1]?.data).toEqual({ url: "https://a.example/1" });
  });

  it("persists failure code/message/retryable for failed events", async () => {
    const repo = new FakeToolEventRepo();
    const journal = new PostgresToolEventJournal(repo);
    const ctx = context();
    await journal.onStart({ callId: "call-fail", toolName: "search_web", context: ctx, startedAt: "2026-08-14T00:00:00.000Z" });
    await journal.onFailure({
      callId: "call-fail",
      toolName: "search_web",
      status: "FAILED",
      failure: { code: "SEARCH_PROVIDER_NOT_CONFIGURED", message: "no provider", retryable: true },
      startedAt: "2026-08-14T00:00:00.000Z",
      finishedAt: "2026-08-14T00:00:00.100Z",
    });

    expect(repo.rows).toHaveLength(2);
    const failed = repo.rows.find((row) => row.status === "FAILED");
    expect(failed?.failure_code).toBe("SEARCH_PROVIDER_NOT_CONFIGURED");
    expect(failed?.failure_message).toBe("no provider");
    expect(failed?.failure_retryable).toBe(true);

    // 失败事件不进入成功列表（Provenance 只看真实 SUCCESS）。
    const successes = await journal.listSuccesses();
    expect(successes).toHaveLength(0);
  });

  it("writes without a start context by falling back to empty identity (no throw)", async () => {
    const repo = new FakeToolEventRepo();
    const journal = new PostgresToolEventJournal(repo);
    await journal.onSuccess({
      callId: "orphan",
      toolName: "get_region_context",
      status: "SUCCESS",
      data: { regionCode: "320106" },
      startedAt: "2026-08-14T00:00:00.000Z",
      finishedAt: "2026-08-14T00:00:00.050Z",
    });
    expect(repo.rows).toHaveLength(1);
    expect(repo.rows[0]?.agent_session_id).toBe("");
  });
});
