import { describe, expect, it } from "vitest";
import {
  MemoryToolEventSink,
  normalizeUrlForJoin,
  type RecoverySubmissionPayload,
  type UrlCandidatePoolRow,
} from "@stellaris/agent-tools";
import {
  attestRecoveryRecords,
  composeCandidateView,
  recoveryCandidateProvenance,
  type RecoveryAttestationContext,
} from "./recovery-attestation.js";

const NEW_URL = "http://www.njgl.gov.cn/xxgk/qczc/sl/detail.html";
const ORIGINAL_URL_2 = "http://www.njgl.gov.cn/xxgk/qczc/sl/";

function candidate(id: string, targetId: string, url: string): UrlCandidatePoolRow {
  return {
    candidate_id: id,
    target_id: targetId,
    evidence_id: "evt-recovery-1",
    url,
    source_domain_class: "OFFICIAL_GOV_DOMAIN",
    page_shape_class: "OFFICIAL_CURRENT_LEADER_DETAIL",
    supports_person: true,
    supports_institution: true,
    supports_role: true,
    supports_currentness: true,
    candidate_status: "ACCEPTED_AS_FINAL",
    accept_or_reject_reason: "recovered official leader profile",
    superseded_by_candidate_id: null,
  };
}

const NEW_CANDIDATES = [
  candidate("cand-recovery-p2", "glq-target-primary2", NEW_URL),
];

function recoveredSubmission(): RecoverySubmissionPayload {
  return {
    candidates: NEW_CANDIDATES,
    supplements: [
      {
        target_id: "glq-target-primary2",
        outcome: "RECOVERED_QUALIFIED_URL",
        candidate_id: "cand-recovery-p2",
        failure_codes: [],
        leader_section_checked: true,
        personal_entry_checked: true,
        currentness_conflict_resolved: true,
        remaining_empty_reason: null,
      },
    ],
  };
}

function context(eventSink: MemoryToolEventSink): RecoveryAttestationContext {
  return {
    recoverySessionId: "session-recovery-1",
    recoveryAgentUuid: "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
    recoveryContextId: "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e",
    eventSink,
    candidates: NEW_CANDIDATES,
  };
}

function now(ms = 0): string {
  return new Date(Date.parse("2026-08-14T00:00:00.000Z") + ms).toISOString();
}

describe("recovery attestation", () => {
  it("builds a canonical Recovery Record with real session event IDs", async () => {
    const eventSink = new MemoryToolEventSink();
    await eventSink.onStart({
      callId: "call-fetch-new",
      toolName: "fetch_page",
      context: {
        taskRunId: "t",
        agentSessionId: "session-recovery-1",
        agentRole: "RECOVERY",
        packetId: "p",
        signal: new AbortController().signal,
      },
      startedAt: now(100),
    });
    await eventSink.onSuccess({
      callId: "call-fetch-new",
      toolName: "fetch_page",
      status: "SUCCESS",
      data: { requestedUrl: NEW_URL, finalUrl: NEW_URL, statusCode: 200 },
      startedAt: now(100),
      finishedAt: now(150),
    });
    await eventSink.onSuccess({
      callId: "call-inspect-new",
      toolName: "inspect_page",
      status: "SUCCESS",
      data: { url: NEW_URL, title: "副区长 石磊", leadershipMembers: [] },
      startedAt: now(150),
      finishedAt: now(200),
    });
    await eventSink.onSuccess({
      callId: "call-search",
      toolName: "search_web",
      status: "SUCCESS",
      data: { provider: "bocha", results: [] },
      startedAt: now(200),
      finishedAt: now(250),
    });

    const attested = attestRecoveryRecords(recoveredSubmission(), context(eventSink));
    expect(attested).toHaveLength(1);
    const record = attested[0]?.record;
    expect(record?.recovery_agent_uuid).toBe(context(eventSink).recoveryAgentUuid);
    expect(record?.target_id).toBe("glq-target-primary2");
    expect(record?.different_access_or_search_method).toBe(true);
    expect(record?.outcome).toBe("RECOVERED_QUALIFIED_URL");
    expect(record?.recovered_candidate_id).toBe("cand-recovery-p2");
    expect(record?.completion_status).toBe("COMPLETED");
    expect(record?.access_attempt_sequence).toEqual(
      expect.arrayContaining(["STANDARD_OPEN", "OFFICIAL_DOMAIN_EXACT_SEARCH"]),
    );
    expect(record?.tool_event_ids).toEqual(
      expect.arrayContaining(["call-fetch-new", "call-inspect-new", "call-search"]),
    );
    expect(attested[0]?.finalUrl).toBe(NEW_URL);
  });

  it("reports session provenance truthfully (opened + inspected)", () => {
    const eventSink = new MemoryToolEventSink();
    expect(recoveryCandidateProvenance(eventSink.successes, NEW_URL)).toEqual({
      opened: false,
      inspected: false,
    });
    eventSink.successes.push({
      callId: "call-render",
      toolName: "render_page",
      status: "SUCCESS",
      data: { requestedUrl: NEW_URL, finalUrl: NEW_URL },
      startedAt: now(),
      finishedAt: now(),
    });
    expect(recoveryCandidateProvenance(eventSink.successes, NEW_URL)).toEqual({
      opened: true,
      inspected: false,
    });
    eventSink.successes.push({
      callId: "call-inspect-2",
      toolName: "inspect_page",
      status: "SUCCESS",
      data: { url: NEW_URL, title: "副区长 石磊" },
      startedAt: now(),
      finishedAt: now(),
    });
    expect(recoveryCandidateProvenance(eventSink.successes, NEW_URL)).toEqual({
      opened: true,
      inspected: true,
    });
  });
});

describe("composite candidate view", () => {
  it("merges original + supplement without mutating the original pool", () => {
    const original = [
      candidate("cand-orig-1", "glq-target-primary1", "http://www.njgl.gov.cn/xxgk/qczc/dh/"),
      candidate("cand-orig-2", "glq-target-primary2", ORIGINAL_URL_2),
    ];
    const before = JSON.stringify(original);

    const composite = composeCandidateView(original, NEW_CANDIDATES);
    expect(composite).toHaveLength(3);
    expect(composite.some((candidate) => candidate.candidate_id === "cand-recovery-p2")).toBe(true);
    expect(composite.some((candidate) => candidate.candidate_id === "cand-orig-1")).toBe(true);
    expect(JSON.stringify(original)).toBe(before);
  });

  it("identity-dedupes by normalized URL (original URL repeated in supplement is dropped)", () => {
    const original = [candidate("cand-orig-2", "glq-target-primary2", ORIGINAL_URL_2)];
    const duplicate = [candidate("cand-dup", "glq-target-primary2", `${ORIGINAL_URL_2}`)];
    const composite = composeCandidateView(original, duplicate);
    expect(composite).toHaveLength(1);
    expect(composite[0]?.candidate_id).toBe("cand-orig-2");
  });

  it("normalizes URL variants when deduping", () => {
    expect(normalizeUrlForJoin("https://www.njgl.gov.cn/xxgk/qczc/sl/")).toBe(
      "https://www.njgl.gov.cn/xxgk/qczc/sl",
    );
    expect(normalizeUrlForJoin("HTTP://WWW.NJGL.GOV.CN:80/xxgk/qczc/sl/")).toBe(
      "http://www.njgl.gov.cn/xxgk/qczc/sl",
    );
  });
});
