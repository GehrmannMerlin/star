import { Type, type Static } from '@sinclair/typebox';
import { ToolFailureCode, ToolFailureError } from '../../contracts/tool-failure-codes.js';
import type { AgentToolDefinition } from '../../contracts/tool-types.js';
import type { ToolSuccessResult } from '../../contracts/tool-types.js';
import type { MemoryToolEventSink } from '../../telemetry/tool-event-sink.js';
import {
  normalizeUrlForJoin,
  type EvidencePrimaryDecision,
  type InvestigatorEvidenceSubmissionValidator,
  type UrlCandidatePoolRow,
} from '../evidence/investigator-evidence-submission.js';
import type {
  RecoverySubmissionPayload,
  RecoverySubmissionSink,
  RecoverySubmitSuccess,
} from './recovery-submission.js';

const supplementSchema = Type.Object(
  {
    target_id: Type.String({ minLength: 1 }),
    outcome: Type.Union([
      Type.Literal('RECOVERED_QUALIFIED_URL'),
      Type.Literal('NO_QUALIFIED_URL_AFTER_COMPLETE_SEARCH'),
      Type.Literal('PERSON_OR_ROLE_NEEDS_RECHECK'),
    ]),
    candidate_id: Type.Union([Type.String({ minLength: 1 }), Type.Null()]),
    failure_codes: Type.Array(Type.String()),
    leader_section_checked: Type.Boolean(),
    personal_entry_checked: Type.Boolean(),
    currentness_conflict_resolved: Type.Boolean(),
    remaining_empty_reason: Type.Union([Type.String(), Type.Null()]),
  },
  { additionalProperties: false },
);

const candidateArtifact = Type.Object({}, { additionalProperties: true });

export const SubmitRecoveryEvidenceInput = Type.Object(
  {
    candidates: Type.Array(candidateArtifact),
    supplements: Type.Array(supplementSchema, { minItems: 1 }),
  },
  { additionalProperties: false },
);

export type SubmitRecoveryEvidenceInput = Static<typeof SubmitRecoveryEvidenceInput>;

export type SubmitRecoveryEvidenceToolDeps = {
  sink: RecoverySubmissionSink;
  /** Validates the NEW candidates against url-candidate-pool.schema.json. */
  validator: InvestigatorEvidenceSubmissionValidator;
  /** Frozen PRIMARY person decisions (deterministic target join). */
  primaryDecisions: EvidencePrimaryDecision[];
  /** Frozen ORIGINAL Candidate Pool (duplicate gate). */
  originalCandidatePool: UrlCandidatePoolRow[];
  /** Shared session event sink (provenance gate reads THIS session's events). */
  eventSink: MemoryToolEventSink;
};

const RECOVERED = 'RECOVERED_QUALIFIED_URL' as const;

function matchesUrl(data: unknown, normUrl: string): boolean {
  const record = (data ?? {}) as Record<string, unknown> | undefined;
  for (const key of ['requestedUrl', 'finalUrl', 'url'] as const) {
    const value = record?.[key];
    if (typeof value === 'string' && value.length > 0 && normalizeUrlForJoin(value) === normUrl) {
      return true;
    }
  }
  return false;
}

/** True when the candidate URL was really opened (fetch/render) AND inspected in this session. */
function candidateOpenedAndInspected(
  successes: readonly ToolSuccessResult<unknown>[],
  url: string,
): boolean {
  const norm = normalizeUrlForJoin(url);
  const opened = successes.some(
    (event) =>
      (event.toolName === 'fetch_page' || event.toolName === 'render_page') &&
      matchesUrl(event.data, norm),
  );
  const inspected = successes.some(
    (event) => event.toolName === 'inspect_page' && matchesUrl(event.data, norm),
  );
  return opened && inspected;
}

/**
 * Recovery output boundary tool.
 *
 * The Recovery Agent knows only `submit_recovery_evidence`. The tool enforces
 * the deterministic runtime gates — canonical candidate schema, PRIMARY join,
 * duplicate-vs-original-pool, session provenance (real open + inspect), outcome
 * consistency, freeze — but performs NO semantic ranking and NO source/page
 * re-classification. Judgment is Pi + Skill; TypeScript validates, joins, gates
 * and freezes only. The full canonical Recovery Record (recovery-record.schema.json)
 * is built and validated by the runner.
 */
export function createSubmitRecoveryEvidenceTool(
  deps: SubmitRecoveryEvidenceToolDeps,
): AgentToolDefinition<typeof SubmitRecoveryEvidenceInput, RecoverySubmitSuccess> {
  return {
    name: 'submit_recovery_evidence',
    description:
      'Submit the Recovery Supplement for the reviewer-identified gap of the current institution. The payload carries NEW Position URL Candidate Pool rows (url-candidate-pool schema) plus one recovery supplement per recovered PRIMARY target. Every new candidate URL must have been really opened (fetch_page/render_page) and really inspected (inspect_page) in this session, must belong to a frozen PRIMARY, and must NOT already exist in the frozen original candidate pool. Recovery never modifies or deletes original candidates, never changes PRIMARY, and never selects a final position URL. Exactly one submission is accepted per packet.',
    inputSchema: SubmitRecoveryEvidenceInput,
    async execute(_context, input) {
      const payload: RecoverySubmissionPayload = {
        candidates: input.candidates as Record<string, unknown>[],
        supplements: input.supplements as RecoverySubmissionPayload['supplements'],
      };

      // Canonical candidate schema validation (url-candidate-pool.schema.json).
      const validation = deps.validator.validate({ candidates: payload.candidates });
      if (!validation.valid) {
        throw new ToolFailureError({
          code: ToolFailureCode.SCHEMA_VALIDATION_FAILED,
          message: `submit_recovery_evidence candidates failed url-candidate-pool schema validation: ${validation.errors.join('; ')}`,
          retryable: false,
        });
      }

      const primary1 = deps.primaryDecisions.find((d) => d.primarySlot === 'PRIMARY_1');
      const primary2 = deps.primaryDecisions.find((d) => d.primarySlot === 'PRIMARY_2');
      if (!primary1 || !primary2) {
        throw new ToolFailureError({
          code: ToolFailureCode.INVALID_INPUT,
          message: 'submit_recovery_evidence requires both frozen PRIMARY decisions',
          retryable: false,
        });
      }
      const frozenTargetIds = new Set(deps.primaryDecisions.map((d) => d.targetId));

      // PRIMARY join gate: every candidate/supplement target is a frozen PRIMARY.
      for (const candidate of payload.candidates) {
        const targetId = typeof candidate.target_id === 'string' ? candidate.target_id : '';
        if (!frozenTargetIds.has(targetId)) {
          throw new ToolFailureError({
            code: ToolFailureCode.POSITION_CANDIDATE_UNKNOWN_PRIMARY,
            message: `recovery candidate target_id ${targetId} does not belong to a frozen PRIMARY`,
            retryable: false,
          });
        }
      }
      for (const supplement of payload.supplements) {
        if (!frozenTargetIds.has(supplement.target_id)) {
          throw new ToolFailureError({
            code: ToolFailureCode.POSITION_CANDIDATE_UNKNOWN_PRIMARY,
            message: `recovery supplement target_id ${supplement.target_id} does not belong to a frozen PRIMARY`,
            retryable: false,
          });
        }
      }

      // Duplicate gate: new candidates must not repeat the original pool or each other.
      const seen = new Set<string>();
      for (const candidate of payload.candidates) {
        const url = typeof candidate.url === 'string' ? candidate.url : '';
        if (url.length === 0) {
          throw new ToolFailureError({
            code: ToolFailureCode.INVALID_INPUT,
            message: 'recovery candidate must carry a url',
            retryable: false,
          });
        }
        const norm = normalizeUrlForJoin(url);
        if (seen.has(norm)) {
          throw new ToolFailureError({
            code: ToolFailureCode.RECOVERY_CANDIDATE_DUPLICATE,
            message: `recovery candidate url ${url} is duplicated within the supplement`,
            retryable: false,
          });
        }
        seen.add(norm);
      }
      for (const original of deps.originalCandidatePool) {
        const url = typeof original.url === 'string' ? original.url : '';
        if (url.length > 0 && seen.has(normalizeUrlForJoin(url))) {
          throw new ToolFailureError({
            code: ToolFailureCode.RECOVERY_CANDIDATE_DUPLICATE,
            message: `recovery candidate url ${url} already exists in the frozen original candidate pool`,
            retryable: false,
          });
        }
      }

      // Session provenance gate: every new candidate really opened + inspected THIS session.
      for (const candidate of payload.candidates) {
        const url = typeof candidate.url === 'string' ? candidate.url : '';
        if (!candidateOpenedAndInspected(deps.eventSink.successes, url)) {
          throw new ToolFailureError({
            code: ToolFailureCode.RECOVERY_OBSERVATION_REQUIRED,
            message: `recovery candidate ${url} was never really opened (fetch_page/render_page) and inspected (inspect_page) in this session`,
            retryable: false,
          });
        }
      }

      // Outcome consistency: RECOVERED_QUALIFIED_URL requires a new candidate; others none.
      const newCandidateIds = new Set(
        payload.candidates
          .map((candidate) => (typeof candidate.candidate_id === 'string' ? candidate.candidate_id : ''))
          .filter((id) => id.length > 0),
      );
      let recoveredCount = 0;
      for (const supplement of payload.supplements) {
        if (supplement.outcome === RECOVERED) {
          if (supplement.candidate_id === null || !newCandidateIds.has(supplement.candidate_id)) {
            throw new ToolFailureError({
              code: ToolFailureCode.REVIEW_OUTCOME_INCONSISTENT,
              message: `RECOVERED_QUALIFIED_URL supplement for ${supplement.target_id} must select a new candidate`,
              retryable: false,
            });
          }
          const candidate = payload.candidates.find(
            (candidate) => candidate.candidate_id === supplement.candidate_id,
          );
          if (candidate && candidate.target_id !== supplement.target_id) {
            throw new ToolFailureError({
              code: ToolFailureCode.REVIEW_OUTCOME_INCONSISTENT,
              message: `recovered candidate ${supplement.candidate_id} does not belong to supplement target ${supplement.target_id}`,
              retryable: false,
            });
          }
          recoveredCount += 1;
        } else if (supplement.candidate_id !== null) {
          throw new ToolFailureError({
            code: ToolFailureCode.REVIEW_OUTCOME_INCONSISTENT,
            message: `non-recovered supplement for ${supplement.target_id} must not select a candidate`,
            retryable: false,
          });
        }
      }

      const result = await deps.sink.submit(payload);
      if (result.status === 'ALREADY_SUBMITTED') {
        throw new ToolFailureError({
          code: ToolFailureCode.RECOVERY_ALREADY_SUBMITTED,
          message: 'Recovery supplement already submitted and frozen for this packet',
          retryable: false,
        });
      }

      return {
        status: 'ACCEPTED',
        frozen: true,
        candidateCount: payload.candidates.length,
        supplementCount: payload.supplements.length,
        recoveredCount,
        payloadHash: result.payloadHash,
      };
    },
  };
}
