import { describe, expect, it } from "vitest";
import { evaluateEvidenceProvenance } from "../evidence/evidence-provenance.js";
import { PostgresToolEventJournal } from "./postgres-tool-event-journal.js";
import { candidateRow, FakeToolEventRepo } from "./persistence-test-support.js";

const URL_A = "https://www.njgl.gov.cn/zfxxgk/ldzc/1.html";
const URL_B = "https://www.njgl.gov.cn/zfxxgk/ldzc/2.html";

function context() {
  return {
    taskRunId: "task-1",
    agentSessionId: "session-1",
    agentRole: "INVESTIGATOR" as const,
    packetId: "packet-1",
    signal: new AbortController().signal,
  };
}

async function appendEvidenceEvents(journal: PostgresToolEventJournal): Promise<void> {
  const ctx = context();
  const calls = [
    { callId: "call-fetch-a", toolName: "fetch_page", data: { requestedUrl: URL_A, finalUrl: URL_A, statusCode: 200 } },
    { callId: "call-inspect-a", toolName: "inspect_page", data: { url: URL_A } },
    { callId: "call-fetch-b", toolName: "fetch_page", data: { requestedUrl: URL_B, finalUrl: URL_B, statusCode: 200 } },
    { callId: "call-inspect-b", toolName: "inspect_page", data: { url: URL_B } },
  ];
  for (const call of calls) {
    await journal.onStart({ callId: call.callId, toolName: call.toolName, context: ctx, startedAt: "2026-08-14T00:00:00.000Z" });
    await journal.onSuccess({
      callId: call.callId,
      toolName: call.toolName,
      status: "SUCCESS",
      data: call.data,
      startedAt: "2026-08-14T00:00:00.000Z",
      finishedAt: "2026-08-14T00:00:00.100Z",
    });
  }
}

describe("provenance rehydration (new reader over persisted events)", () => {
  it("persist → NEW journal instance → load → existing gate PASS", async () => {
    // 持久化层：一个共享内存仓储（等价于 PostgreSQL 中的表）。
    const repo = new FakeToolEventRepo();
    const writer = new PostgresToolEventJournal(repo);
    await appendEvidenceEvents(writer);

    // "进程重启"：全新 journal 实例（空 contextsByCallId），从仓储重新读取。
    const reader = new PostgresToolEventJournal(repo);
    const successes = await reader.listSuccesses();
    expect(successes).toHaveLength(4);

    // 复用现有 Candidate Provenance Gate（未改动判断规则）。
    const gate = evaluateEvidenceProvenance(successes, [
      candidateRow("glq-target-primary1", URL_A),
      candidateRow("glq-target-primary2", URL_B),
    ]);
    expect(gate.passed).toBe(true);
    expect(gate.candidates).toHaveLength(2);
    expect(gate.candidates[0]?.opened).toBe(true);
    expect(gate.candidates[0]?.inspected).toBe(true);
    expect(gate.candidates[1]?.opened).toBe(true);
    expect(gate.candidates[1]?.inspected).toBe(true);
  });

  it("a candidate opened but never inspected fails the reloaded gate", async () => {
    const repo = new FakeToolEventRepo();
    const writer = new PostgresToolEventJournal(repo);
    await appendEvidenceEvents(writer);

    // 额外添加第三个只打开未检查的候选，证明 gate 仍按原有规则判断。
    const reader = new PostgresToolEventJournal(repo);
    const successes = await reader.listSuccesses();
    const gate = evaluateEvidenceProvenance(successes, [
      candidateRow("glq-target-primary1", URL_A),
      candidateRow("glq-target-primary2", URL_B),
      candidateRow("glq-target-primary3", "https://www.njgl.gov.cn/zfxxgk/ldzc/3.html"),
    ]);
    expect(gate.passed).toBe(false);
  });
});
