import { createHash } from "node:crypto";
import {
  MemoryToolEventSink,
  ToolFailureCode,
  type ValidationIssue,
} from "@stellaris/agent-tools";
import type { SkillIdentity } from "../skill/skill-identity.js";
import type { EvidenceRepairReport } from "./evidence-types.js";

/** STEP 20.1 硬约束：总提交次数 / 修复次数上限（不可通过配置扩大）。 */
export const SUBMIT_EVIDENCE_MAX_ATTEMPTS = 3;
export const EVIDENCE_SCHEMA_REPAIR_MAX_ATTEMPTS = 2;

/**
 * 观测 submit_investigator_evidence 的 schema 失败并生成 repair 反馈。
 *
 * 数据来源：ToolEventSink 的 failure 事件（ToolGateway 记录 ToolFailedResult，
 * 其 failure.details 携带结构化 ValidationIssue[]，由 validator 解析生成，
 * 零正则）。fingerprint = hash(tool + instancePath + keyword + received +
 * schema identity)，用于连续相同错误熔断。
 */
export class EvidenceSubmissionPhaseTracker {
  private breakerTriggered = false;

  constructor(
    private readonly eventSink: MemoryToolEventSink,
    private readonly identity: SkillIdentity,
  ) {}

  /** 从 eventSink 提取 submit_investigator_evidence 的 schema 失败 issue（结构化）。 */
  schemaFailures(): ValidationIssue[] {
    const failures = this.eventSink.failures.filter(
      (event) =>
        event.toolName === "submit_investigator_evidence" &&
        (event.failure.code === ToolFailureCode.EVIDENCE_SCHEMA_VALIDATION_FAILED ||
          event.failure.code === ToolFailureCode.SCHEMA_VALIDATION_FAILED),
    );
    const issues: ValidationIssue[] = [];
    for (const failure of failures) {
      if (Array.isArray(failure.failure.details)) {
        issues.push(...(failure.failure.details as ValidationIssue[]));
      }
    }
    return issues;
  }

  /** 最近一次 schema 失败的 fingerprint（用于熔断判断）。 */
  fingerprint(): string | undefined {
    const issues = this.schemaFailures();
    const last = issues[issues.length - 1];
    if (!last) return undefined;
    return createHash("sha256")
      .update(
        JSON.stringify({
          tool: "submit_investigator_evidence",
          instancePath: last.fieldPath,
          keyword: last.validationKeyword,
          receivedValue: last.receivedValue,
          schema: this.identity.name,
        }),
      )
      .digest("hex")
      .slice(0, 16);
  }

  markBreakerTriggered(): void {
    this.breakerTriggered = true;
  }

  /** 修复指标（Completion Gate 观测）。 */
  report(): EvidenceRepairReport {
    const issues = this.schemaFailures();
    const submitStarts = this.eventSink.starts.filter(
      (event) => event.toolName === "submit_investigator_evidence",
    ).length;
    return {
      submitAttempts: submitStarts,
      schemaValidationFailures: issues.length,
      repairAttempts: Math.min(issues.length, EVIDENCE_SCHEMA_REPAIR_MAX_ATTEMPTS),
      repeatedErrorBreakerTriggered: this.breakerTriggered,
      researchToolCallsAfterFirstSubmitFailure: this.countResearchCallsAfterFirstFailure(),
    };
  }

  private countResearchCallsAfterFirstFailure(): number {
    const submitFailures = this.eventSink.failures.filter(
      (event) => event.toolName === "submit_investigator_evidence",
    );
    if (submitFailures.length === 0) return 0;
    const firstFailure = submitFailures[0];
    if (!firstFailure) return 0;
    const firstFailureStart = firstFailure.startedAt;
    return this.eventSink.starts.filter(
      (event) =>
        event.toolName !== "submit_investigator_evidence" &&
        event.startedAt > firstFailureStart,
    ).length;
  }
}
