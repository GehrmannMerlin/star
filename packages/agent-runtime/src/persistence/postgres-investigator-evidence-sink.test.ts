import { describe, expect, it } from "vitest";
import { PostgresInvestigatorEvidenceSubmissionSink } from "./postgres-investigator-evidence-sink.js";
import { candidateRow, FakeEvidenceRepo } from "./persistence-test-support.js";

const IDENTITY = {
  packetId: "packet-1",
  agentSessionId: "session-1",
  agentRole: "INVESTIGATOR" as const,
  skill: { name: "official-biography-evidence", version: "3.1.0" },
};

function payload() {
  return {
    candidates: [
      candidateRow("glq-target-primary1", "https://www.njgl.gov.cn/zfxxgk/ldzc/1.html"),
      candidateRow("glq-target-primary2", "https://www.njgl.gov.cn/zfxxgk/ldzc/2.html"),
    ],
  };
}

describe("PostgresInvestigatorEvidenceSubmissionSink (over fake repo)", () => {
  it("accepts and freezes a valid canonical submission", async () => {
    const repo = new FakeEvidenceRepo();
    const sink = new PostgresInvestigatorEvidenceSubmissionSink(repo, IDENTITY);

    const result = await sink.submit(payload());
    expect(result.status).toBe("ACCEPTED");
    if (result.status === "ACCEPTED") {
      expect(result.payloadHash).toMatch(/^[0-9a-f]{64}$/);
    }
    expect(await sink.isFrozen()).toBe(true);
    const read = await sink.getSubmission();
    expect(read).toEqual(payload());
  });

  it("rejects a duplicate submit for the same packet (pre-check path)", async () => {
    const repo = new FakeEvidenceRepo();
    const sink = new PostgresInvestigatorEvidenceSubmissionSink(repo, IDENTITY);

    const first = await sink.submit(payload());
    expect(first.status).toBe("ACCEPTED");

    const second = await sink.submit(payload());
    expect(second.status).toBe("ALREADY_SUBMITTED");
    if (first.status === "ACCEPTED" && second.status === "ALREADY_SUBMITTED") {
      expect(second.payloadHash).toBe(first.payloadHash); // 返回已冻结提交的哈希
    }
    // 冻结持续，即使再次提交。
    expect(await sink.isFrozen()).toBe(true);
  });

  it("maps a concurrent unique-violation (23505) to ALREADY_SUBMITTED", async () => {
    const repo = new FakeEvidenceRepo();
    // 竞态：预检首次返回 null，但库里实际已有同一 packet 的提交，INSERT 抛 23505。
    repo.rows.push(
      await repo.insertSubmission({
        packet_id: "packet-1",
        agent_session_id: "session-1",
        agent_role: "INVESTIGATOR",
        skill_name: "official-biography-evidence",
        skill_version: "3.1.0",
        canonical_schema: "url-candidate-pool.schema.json",
        payload: payload(),
        payload_hash: "abcdef".repeat(10).slice(0, 64),
        frozen_at: "2026-08-14T00:00:00.000Z",
      }),
    );
    repo.raceMode = true;

    const sink = new PostgresInvestigatorEvidenceSubmissionSink(repo, IDENTITY);
    const result = await sink.submit(payload());
    expect(result.status).toBe("ALREADY_SUBMITTED");
  });

  it("stores skill identity and canonical schema", async () => {
    const repo = new FakeEvidenceRepo();
    const sink = new PostgresInvestigatorEvidenceSubmissionSink(repo, IDENTITY);
    await sink.submit(payload());

    expect(repo.rows[0]?.skill_name).toBe("official-biography-evidence");
    expect(repo.rows[0]?.skill_version).toBe("3.1.0");
    expect(repo.rows[0]?.canonical_schema).toBe("url-candidate-pool.schema.json");
    expect(repo.rows[0]?.packet_id).toBe("packet-1");
  });

  it("returns null when nothing is frozen", async () => {
    const sink = new PostgresInvestigatorEvidenceSubmissionSink(new FakeEvidenceRepo(), IDENTITY);
    expect(await sink.getSubmission()).toBeNull();
    expect(await sink.isFrozen()).toBe(false);
  });
});
