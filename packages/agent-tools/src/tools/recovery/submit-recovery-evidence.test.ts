import { describe, expect, it } from "vitest";
import { ToolFailureCode } from "../../contracts/tool-failure-codes.js";
import { MemoryToolEventSink } from "../../telemetry/tool-event-sink.js";
import type {
  EvidencePrimaryDecision,
  InvestigatorEvidenceSubmissionValidator,
  UrlCandidatePoolRow,
} from "../evidence/investigator-evidence-submission.js";
import {
  createSubmitRecoveryEvidenceTool,
  type SubmitRecoveryEvidenceToolDeps,
} from "./submit-recovery-evidence.js";
import { InMemoryRecoverySink } from "./test-support.js";

const TARGET_1 = "glq-target-primary1";
const TARGET_2 = "glq-target-primary2";

const PRIMARY_1: EvidencePrimaryDecision = {
  targetId: TARGET_1,
  personId: "person-dong",
  personName: "董涵",
  primarySlot: "PRIMARY_1",
};
const PRIMARY_2: EvidencePrimaryDecision = {
  targetId: TARGET_2,
  personId: "person-shi",
  personName: "石磊",
  primarySlot: "PRIMARY_2",
};

const ORIGINAL_URL_1 = "http://www.njgl.gov.cn/xxgk/qczc/dh/";
const ORIGINAL_URL_2 = "http://www.njgl.gov.cn/xxgk/qczc/sl/";
const NEW_URL = "http://www.njgl.gov.cn/xxgk/qczc/sl/detail.html";

const stubValidator: InvestigatorEvidenceSubmissionValidator = {
  validate: () => ({ valid: true }),
};

function newCandidate(targetId: string, url: string): UrlCandidatePoolRow {
  return {
    candidate_id: "cand-new-1",
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

function supplement(targetId: string, candidateId: string | null) {
  return {
    target_id: targetId,
    outcome:
      candidateId === null ? "NO_QUALIFIED_URL_AFTER_COMPLETE_SEARCH" : "RECOVERED_QUALIFIED_URL",
    candidate_id: candidateId,
    failure_codes: [],
    leader_section_checked: true,
    personal_entry_checked: true,
    currentness_conflict_resolved: true,
    remaining_empty_reason: candidateId === null ? "官网未见该人员合格当前页" : null,
  };
}

function originalPool(): UrlCandidatePoolRow[] {
  return [
    {
      ...newCandidate(TARGET_1, ORIGINAL_URL_1),
      candidate_id: "cand-orig-1",
      accept_or_reject_reason: "original official leader profile",
    },
    {
      ...newCandidate(TARGET_2, ORIGINAL_URL_2),
      candidate_id: "cand-orig-2",
      accept_or_reject_reason: "original official leader profile",
    },
  ];
}

function deps(
  overrides: Partial<SubmitRecoveryEvidenceToolDeps> & { eventSink: MemoryToolEventSink },
): SubmitRecoveryEvidenceToolDeps {
  return {
    sink: new InMemoryRecoverySink(),
    validator: stubValidator,
    primaryDecisions: [PRIMARY_1, PRIMARY_2],
    originalCandidatePool: originalPool(),
    ...overrides,
  };
}

function openAndInspect(eventSink: MemoryToolEventSink, url: string): void {
  const t = new Date().toISOString();
  eventSink.successes.push({
    callId: `call-fetch-${url}`,
    toolName: "fetch_page",
    status: "SUCCESS",
    data: { requestedUrl: url, finalUrl: url, statusCode: 200 },
    startedAt: t,
    finishedAt: t,
  });
  eventSink.successes.push({
    callId: `call-inspect-${url}`,
    toolName: "inspect_page",
    status: "SUCCESS",
    data: { url, title: "副区长 石磊", leadershipMembers: [] },
    startedAt: t,
    finishedAt: t,
  });
}

async function runTool(
  input: unknown,
  tool: ReturnType<typeof createSubmitRecoveryEvidenceTool>,
) {
  return tool.execute(
    {
      taskRunId: "t",
      agentSessionId: "session-recovery-test",
      agentRole: "RECOVERY",
      signal: new AbortController().signal,
    },
    input as never,
  );
}

describe("createSubmitRecoveryEvidenceTool", () => {
  it("accepts a valid recovery supplement and freezes it", async () => {
    const eventSink = new MemoryToolEventSink();
    openAndInspect(eventSink, NEW_URL);
    const tool = createSubmitRecoveryEvidenceTool(deps({ eventSink }));
    const result = await runTool(
      {
        candidates: [newCandidate(TARGET_2, NEW_URL)],
        supplements: [supplement(TARGET_2, "cand-new-1")],
      },
      tool,
    );
    expect(result).toMatchObject({
      status: "ACCEPTED",
      frozen: true,
      candidateCount: 1,
      supplementCount: 1,
      recoveredCount: 1,
    });
  });

  it("rejects a second submission for the same packet (frozen)", async () => {
    const eventSink = new MemoryToolEventSink();
    openAndInspect(eventSink, NEW_URL);
    const tool = createSubmitRecoveryEvidenceTool(deps({ eventSink }));
    const payload = {
      candidates: [newCandidate(TARGET_2, NEW_URL)],
      supplements: [supplement(TARGET_2, "cand-new-1")],
    };
    await runTool(payload, tool);
    await expect(runTool(payload, tool)).rejects.toMatchObject({
      code: ToolFailureCode.RECOVERY_ALREADY_SUBMITTED,
    });
  });

  it("rejects a candidate that does not belong to a frozen PRIMARY", async () => {
    const eventSink = new MemoryToolEventSink();
    openAndInspect(eventSink, NEW_URL);
    const tool = createSubmitRecoveryEvidenceTool(deps({ eventSink }));
    await expect(
      runTool(
        {
          candidates: [{ ...newCandidate(TARGET_2, NEW_URL), target_id: "unknown-target" }],
          supplements: [supplement(TARGET_2, "cand-new-1")],
        },
        tool,
      ),
    ).rejects.toMatchObject({
      code: ToolFailureCode.POSITION_CANDIDATE_UNKNOWN_PRIMARY,
    });
  });

  it("rejects a candidate that duplicates the frozen original candidate pool", async () => {
    const eventSink = new MemoryToolEventSink();
    openAndInspect(eventSink, ORIGINAL_URL_2);
    const tool = createSubmitRecoveryEvidenceTool(deps({ eventSink }));
    await expect(
      runTool(
        {
          candidates: [newCandidate(TARGET_2, ORIGINAL_URL_2)],
          supplements: [supplement(TARGET_2, "cand-new-1")],
        },
        tool,
      ),
    ).rejects.toMatchObject({
      code: ToolFailureCode.RECOVERY_CANDIDATE_DUPLICATE,
    });
  });

  it("rejects a candidate that was never really opened (search-only provenance)", async () => {
    const eventSink = new MemoryToolEventSink();
    // Only a search_web success; no fetch/render and no inspect for NEW_URL.
    const t = new Date().toISOString();
    eventSink.successes.push({
      callId: "call-search",
      toolName: "search_web",
      status: "SUCCESS",
      data: { provider: "bocha", results: [{ url: NEW_URL }] },
      startedAt: t,
      finishedAt: t,
    });
    const tool = createSubmitRecoveryEvidenceTool(deps({ eventSink }));
    await expect(
      runTool(
        {
          candidates: [newCandidate(TARGET_2, NEW_URL)],
          supplements: [supplement(TARGET_2, "cand-new-1")],
        },
        tool,
      ),
    ).rejects.toMatchObject({
      code: ToolFailureCode.RECOVERY_OBSERVATION_REQUIRED,
    });
  });

  it("accepts a candidate opened via render_page + inspect (provenance satisfied)", async () => {
    const eventSink = new MemoryToolEventSink();
    const t = new Date().toISOString();
    eventSink.successes.push({
      callId: "call-render",
      toolName: "render_page",
      status: "SUCCESS",
      data: { requestedUrl: NEW_URL, finalUrl: NEW_URL },
      startedAt: t,
      finishedAt: t,
    });
    eventSink.successes.push({
      callId: "call-inspect-2",
      toolName: "inspect_page",
      status: "SUCCESS",
      data: { url: NEW_URL, title: "副区长 石磊" },
      startedAt: t,
      finishedAt: t,
    });
    const tool = createSubmitRecoveryEvidenceTool(deps({ eventSink }));
    const result = await runTool(
      {
        candidates: [newCandidate(TARGET_2, NEW_URL)],
        supplements: [supplement(TARGET_2, "cand-new-1")],
      },
      tool,
    );
    expect(result.status).toBe("ACCEPTED");
  });
});
