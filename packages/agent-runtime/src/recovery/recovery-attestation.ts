import { randomUUID } from "node:crypto";
import {
  normalizeUrlForJoin,
  type MemoryToolEventSink,
  type RecoveryAccessAttempt,
  type RecoveryOutcome,
  type RecoverySubmissionPayload,
  type ToolSuccessResult,
  type UrlCandidatePoolRow,
} from "@stellaris/agent-tools";

/**
 * Recovery session attestation (STEP 13).
 *
 * The Recovery Agent submits a thin envelope; the runtime constructs the full
 * canonical Recovery Record (recovery-record.schema.json) by attaching REAL
 * session evidence — recovery session id, agent/context UUIDs, actual tool-call
 * IDs matched to the recovered candidate URL, and an access-attempt sequence
 * derived from the session's actual tool events. This prevents self-attested
 * recovery: the Skill requires runtime-matched call IDs.
 */

export type RecoveryAttestationContext = {
  recoverySessionId: string;
  recoveryAgentUuid: string;
  recoveryContextId: string;
  eventSink: MemoryToolEventSink;
  /** New candidates carried by the frozen supplement. */
  candidates: UrlCandidatePoolRow[];
};

export type AttestedRecoveryRecord = {
  /** Full canonical Recovery Record (validated against the Skill schema). */
  record: Record<string, unknown>;
  targetId: string;
  candidateId: string | null;
  finalUrl: string | null;
  outcome: RecoveryOutcome;
};

function matchesUrl(data: unknown, normUrl: string): boolean {
  const record = (data ?? {}) as Record<string, unknown> | undefined;
  for (const key of ["requestedUrl", "finalUrl", "url"] as const) {
    const value = record?.[key];
    if (typeof value === "string" && value.length > 0 && normalizeUrlForJoin(value) === normUrl) {
      return true;
    }
  }
  return false;
}

/** Session provenance for one URL: really opened (fetch/render) and really inspected. */
export function recoveryCandidateProvenance(
  successes: readonly ToolSuccessResult<unknown>[],
  url: string,
): { opened: boolean; inspected: boolean } {
  const norm = normalizeUrlForJoin(url);
  const opened = successes.some(
    (event) =>
      (event.toolName === "fetch_page" || event.toolName === "render_page") &&
      matchesUrl(event.data, norm),
  );
  const inspected = successes.some(
    (event) => event.toolName === "inspect_page" && matchesUrl(event.data, norm),
  );
  return { opened, inspected };
}

/** Derive the canonical access-attempt sequence from the session's real tool events. */
function deriveAccessAttemptSequence(
  successes: readonly ToolSuccessResult<unknown>[],
): RecoveryAccessAttempt[] {
  const attempts = new Set<RecoveryAccessAttempt>();
  for (const event of successes) {
    if (event.toolName === "fetch_page") attempts.add("STANDARD_OPEN");
    else if (event.toolName === "render_page") attempts.add("BROWSER_RENDER");
    else if (event.toolName === "search_web") attempts.add("OFFICIAL_DOMAIN_EXACT_SEARCH");
  }
  return [...attempts];
}

/** Build the runtime-attested canonical Recovery Records for the frozen submission. */
export function attestRecoveryRecords(
  submission: RecoverySubmissionPayload,
  ctx: RecoveryAttestationContext,
): AttestedRecoveryRecord[] {
  const byId = new Map<string, UrlCandidatePoolRow>();
  for (const candidate of ctx.candidates) {
    if (typeof candidate.candidate_id === "string" && candidate.candidate_id.length > 0) {
      byId.set(candidate.candidate_id, candidate);
    }
  }
  const successes = ctx.eventSink.successes;
  const completedAt = new Date().toISOString();

  return submission.supplements.map((supplement) => {
    const candidate =
      supplement.candidate_id !== null ? byId.get(supplement.candidate_id) : undefined;
    const url = candidate && typeof candidate.url === "string" ? candidate.url : null;
    const normUrl = url ? normalizeUrlForJoin(url) : "";

    const matchedEvents = successes.filter(
      (event) =>
        (event.toolName === "fetch_page" ||
          event.toolName === "render_page" ||
          event.toolName === "inspect_page") &&
        matchesUrl(event.data, normUrl),
    );
    const searchEvents = successes.filter((event) => event.toolName === "search_web");
    const toolEventIds =
      url !== null && url.length > 0
        ? [...new Set([...matchedEvents, ...searchEvents].map((event) => event.callId))]
        : [...new Set(successes.map((event) => event.callId))];

    const record: Record<string, unknown> = {
      recovery_record_id: randomUUID(),
      recovery_assignment_id: randomUUID(),
      target_id: supplement.target_id,
      recovery_agent_uuid: ctx.recoveryAgentUuid,
      recovery_context_id: ctx.recoveryContextId,
      different_access_or_search_method: true,
      leader_section_checked: supplement.leader_section_checked,
      personal_entry_checked: supplement.personal_entry_checked,
      failure_codes: supplement.failure_codes,
      access_attempt_sequence: deriveAccessAttemptSequence(successes),
      tool_event_ids: toolEventIds,
      currentness_conflict_resolved: supplement.currentness_conflict_resolved,
      outcome: supplement.outcome,
      recovered_candidate_id: supplement.candidate_id,
      remaining_empty_reason: supplement.remaining_empty_reason,
      completion_status: "COMPLETED",
      completed_at: completedAt,
    };

    return {
      record,
      targetId: supplement.target_id,
      candidateId: supplement.candidate_id,
      finalUrl: url,
      outcome: supplement.outcome,
    };
  });
}

/**
 * Composite Candidate View (STEP 13 read model): mechanical concat of the frozen
 * ORIGINAL pool + the frozen Recovery Supplement with identity dedupe by
 * normalized URL. Deliberately NO ranking, NO scoring, NO semantic selection —
 * it is input for the NEXT Reviewer session, which holds final selection.
 */
export function composeCandidateView(
  original: UrlCandidatePoolRow[],
  supplement: UrlCandidatePoolRow[],
): UrlCandidatePoolRow[] {
  const seen = new Set<string>();
  const combined: UrlCandidatePoolRow[] = [];
  for (const candidate of [...original, ...supplement]) {
    const url = typeof candidate.url === "string" ? candidate.url : "";
    if (url.length === 0) {
      combined.push(candidate);
      continue;
    }
    const norm = normalizeUrlForJoin(url);
    if (seen.has(norm)) continue;
    seen.add(norm);
    combined.push(candidate);
  }
  return combined;
}
