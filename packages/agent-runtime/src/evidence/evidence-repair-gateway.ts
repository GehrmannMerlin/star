import {
  ToolFailureCode,
  ToolGateway,
  type ToolEventSink,
  type ToolFailure,
  type ToolInvocationContext,
  type ToolRegistry,
  type ToolResult,
} from "@stellaris/agent-tools";

/**
 * STEP 20.1 — Evidence Submission Repair Mode Tool Policy。
 *
 * 包装底层 ToolGateway：当 Evidence Agent 进入 Submission Repair 阶段后，
 * 研究工具（search_web / fetch_page / render_page / inspect_page /
 * get_region_context）被拒绝并返回 RESEARCH_TOOL_NOT_ALLOWED_DURING_SUBMISSION_REPAIR；
 * submit_investigator_evidence 始终放行。
 */
export class EvidenceRepairGateway extends ToolGateway {
  private repairMode = false;
  private readonly repairEventSink: ToolEventSink;

  constructor(registry: ToolRegistry, eventSink: ToolEventSink) {
    super(registry, eventSink);
    this.repairEventSink = eventSink;
  }

  setRepairMode(on: boolean): void {
    this.repairMode = on;
  }

  isRepairMode(): boolean {
    return this.repairMode;
  }

  override async execute(
    toolName: string,
    input: unknown,
    context: ToolInvocationContext,
  ): Promise<ToolResult> {
    if (this.repairMode && toolName !== "submit_investigator_evidence") {
      const startedAt = new Date().toISOString();
      const callId = `evidence-repair-blocked-${Date.now()}-${context.agentSessionId}`;
      const failure: ToolFailure = {
        code: ToolFailureCode.RESEARCH_TOOL_NOT_ALLOWED_DURING_SUBMISSION_REPAIR,
        message:
          "证据采集已进入提交修复阶段：禁止调用 search_web / fetch_page / render_page / inspect_page / get_region_context。请直接调用 submit_investigator_evidence 提交（修正）候选池。",
        retryable: false,
      };
      await this.repairEventSink.onStart({ callId, toolName, context, startedAt });
      await this.repairEventSink.onFailure({
        callId,
        toolName,
        status: "FAILED",
        failure,
        startedAt,
        finishedAt: new Date().toISOString(),
      });
      return {
        callId,
        toolName,
        status: "FAILED",
        failure,
        startedAt,
        finishedAt: new Date().toISOString(),
      };
    }
    return super.execute(toolName, input, context);
  }
}
