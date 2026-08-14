import { describe, expect, it } from "vitest";
import { MemoryToolEventSink } from "@stellaris/agent-tools";
import { evaluateEvidenceProvenance } from "./evidence-provenance.js";

const URL = "https://www.njgl.gov.cn/zfxxgk/ldzc/1.html";
const TARGET = "glq-target-primary1";

function candidateRow(targetId: string, url: string) {
  return {
    candidate_id: `cand-${targetId}`,
    target_id: targetId,
    evidence_id: `evt-${targetId}-1`,
    url,
    source_domain_class: "OFFICIAL_GOV_DOMAIN",
    page_shape_class: "OFFICIAL_PERSON_PROFILE",
    supports_person: true,
    supports_institution: true,
    supports_role: true,
    supports_currentness: true,
    candidate_status: "ACCEPTED_AS_FINAL",
    accept_or_reject_reason: "official person profile",
    superseded_by_candidate_id: null,
  };
}

function successEvent(toolName: string, data: Record<string, unknown> = {}) {
  const now = new Date().toISOString();
  return {
    callId: `call-${toolName}-${String(data.url ?? "x")}`,
    toolName,
    status: "SUCCESS" as const,
    data,
    startedAt: now,
    finishedAt: now,
  };
}

describe("evaluateEvidenceProvenance", () => {
  it("rejects a candidate that only ever appeared in a search result (no open, no inspect)", () => {
    const sink = new MemoryToolEventSink();
    sink.successes.push(successEvent("search_web", { provider: "bocha" }));
    const gate = evaluateEvidenceProvenance(sink, [candidateRow(TARGET, URL)]);
    expect(gate.passed).toBe(false);
    expect(gate.candidates[0]?.opened).toBe(false);
    expect(gate.candidates[0]?.inspected).toBe(false);
  });

  it("accepts a candidate whose URL was opened (finalUrl) and inspected in-session", () => {
    const sink = new MemoryToolEventSink();
    sink.successes.push(successEvent("fetch_page", { requestedUrl: URL, finalUrl: URL }));
    sink.successes.push(successEvent("inspect_page", { url: URL }));
    const gate = evaluateEvidenceProvenance(sink, [candidateRow(TARGET, URL)]);
    expect(gate.passed).toBe(true);
    expect(gate.candidates[0]?.opened).toBe(true);
    expect(gate.candidates[0]?.inspected).toBe(true);
  });

  it("matches a candidate whose requestedUrl redirected to the finalUrl", () => {
    const sink = new MemoryToolEventSink();
    const OLD_URL = "https://www.njgl.gov.cn/old/1.html";
    sink.successes.push(successEvent("fetch_page", { requestedUrl: OLD_URL, finalUrl: URL }));
    sink.successes.push(successEvent("inspect_page", { url: URL }));
    const gate = evaluateEvidenceProvenance(sink, [candidateRow(TARGET, URL)]);
    expect(gate.passed).toBe(true);
  });

  it("rejects when one candidate in the pool is opened but not inspected", () => {
    const sink = new MemoryToolEventSink();
    sink.successes.push(successEvent("fetch_page", { requestedUrl: URL, finalUrl: URL }));
    // inspect for the second candidate only
    sink.successes.push(successEvent("inspect_page", { url: "https://www.njgl.gov.cn/zfxxgk/ldzc/2.html" }));
    const gate = evaluateEvidenceProvenance(sink, [
      candidateRow(TARGET, URL),
      candidateRow("glq-target-primary2", "https://www.njgl.gov.cn/zfxxgk/ldzc/2.html"),
    ]);
    expect(gate.passed).toBe(false);
  });
});
