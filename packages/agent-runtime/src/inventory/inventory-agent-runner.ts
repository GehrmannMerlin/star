import { createHash } from "node:crypto";
import { createAgentSession } from "@earendil-works/pi-coding-agent";
import { listRegions } from "@stellaris/contracts";
import {
  createAgentToolRegistry,
  createSubmitInventoryTool,
  MemoryToolEventSink,
  ToolGateway,
  type InventorySubmissionSink,
  type InventorySubmissionValidator,
} from "@stellaris/agent-tools";
import { ModelPolicy } from "../model/model-policy.js";
import { PiModelResolver } from "../model/pi-model-resolver.js";
import { AgentSessionFactory } from "../session/session-factory.js";
import { OFFICIAL_BIOGRAPHY_SKILL_NAME, SkillRuntime } from "../skill/skill-runtime.js";
import type { SkillIdentity } from "../skill/skill-identity.js";
import { InMemoryInventorySubmissionSink } from "./inventory-submission-sink.js";
import { createSkillInventoryValidator } from "./skill-inventory-validator.js";
import { buildInventoryRolePrompt, type InventoryPromptDevHints } from "./inventory-role-prompt.js";
import type {
  InventoryAgentRequest,
  InventoryAgentResult,
  InventoryToolCallSummary,
} from "./inventory-types.js";
import { InventoryRuntimeError } from "./inventory-types.js";

const INVENTORY_TOOL_NAMES = [
  "get_region_context",
  "search_web",
  "fetch_page",
  "render_page",
  "inspect_page",
  "submit_inventory",
];

export type InventoryAgentRunnerDeps = {
  skillRuntime: SkillRuntime;
  /** Provider-neutral model wiring. Defaults are server-configured. */
  modelPolicy?: ModelPolicy;
  modelResolver?: PiModelResolver;
  /** Override for tests: intercept the options passed to Pi. */
  createSession?: typeof createAgentSession;
  /** Override for tests: pre-built sink (in-memory default). */
  sink?: InventorySubmissionSink;
  /** Override for tests: pre-built validator (Skill-schema default). */
  validator?: InventorySubmissionValidator;
  /** Override for tests/observability: tool event sink (in-memory default). */
  eventSink?: MemoryToolEventSink;
  /** Dev-smoke-only hints (seed URL). NEVER part of the business request. */
  devHints?: InventoryPromptDevHints;
};

/**
 * Runs one Inventory Agent pass for a region.
 *
 * The runner owns the wiring: SkillSchemaRegistry validator + in-memory sink ->
 * inventory registry (base tools + submit_inventory) -> ToolGateway ->
 * AgentSessionFactory (INVENTORY role) -> Pi session.prompt -> freeze check.
 * No provider, no API key, no model id is hardcoded here.
 */
export class InventoryAgentRunner {
  constructor(private readonly deps: InventoryAgentRunnerDeps) {}

  async run(request: InventoryAgentRequest): Promise<InventoryAgentResult> {
    const invalid = this.validateRequest(request);
    if (invalid) return { status: "INVALID_REQUEST", reason: invalid };
    const region = listRegions().find((item) => item.code === request.regionCode);
    if (!region) {
      return { status: "INVALID_REQUEST", reason: `Unknown region code: ${request.regionCode}` };
    }

    await this.deps.skillRuntime.reload();
    let identity: SkillIdentity;
    try {
      identity = await this.deps.skillRuntime.resolveSkill(OFFICIAL_BIOGRAPHY_SKILL_NAME);
    } catch (error) {
      throw new InventoryRuntimeError(
        `Inventory skill unavailable: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    const validator = this.deps.validator ?? (await createSkillInventoryValidator(identity));
    const sink = this.deps.sink ?? new InMemoryInventorySubmissionSink();
    const eventSink = this.deps.eventSink ?? new MemoryToolEventSink();
    const registry = createAgentToolRegistry({
      submitInventoryTool: createSubmitInventoryTool({ validator, sink }),
    });
    const gateway = new ToolGateway(registry, eventSink);

    const modelPolicy = this.deps.modelPolicy ?? new ModelPolicy();
    const resolved = modelPolicy.resolve("INVENTORY");
    if (!resolved.ok) return { status: "MODEL_NOT_CONFIGURED" };

    const modelResolver = this.deps.modelResolver ?? (await PiModelResolver.create());
    const model = modelResolver.resolveConfiguredModel(resolved.provider, resolved.model);
    if (!model.ok) {
      return { status: "MODEL_NOT_FOUND", provider: model.provider, model: model.modelId };
    }

    const factory = new AgentSessionFactory({
      modelPolicy,
      modelResolver,
      resourceLoader: this.deps.skillRuntime.getResourceLoader(),
      gateway,
      eventSink,
      registry,
      ...(this.deps.createSession ? { createSession: this.deps.createSession } : {}),
    });
    const created = await factory.createAgentSession("INVENTORY", {
      taskRunId: `inventory-${request.regionCode}-${Date.now()}`,
    });
    if (created.status !== "READY") {
      return { status: "MODEL_NOT_CONFIGURED" };
    }
    const { session, agentSessionId } = created;

    await session.prompt(buildInventoryRolePrompt(request, region.name, this.deps.devHints));

    const inventoryFrozen = await sink.isFrozen();
    const toolCalls = summarizeToolCalls(eventSink, inventoryFrozen);
    if (!inventoryFrozen) {
      return { status: "INVENTORY_NOT_SUBMITTED", agentSessionId, toolCalls };
    }
    const submission = await sink.getSubmission();
    if (!submission) {
      return { status: "INVENTORY_NOT_SUBMITTED", agentSessionId, toolCalls };
    }

    return {
      status: "COMPLETED",
      regionCode: request.regionCode,
      mode: request.mode,
      inventory: submission.inventory,
      frozen: true,
      agentSessionId,
      skill: { name: identity.name, version: identity.version },
      model: { provider: resolved.provider, model: resolved.model },
      toolCalls,
      receipt: {
        frozen: true,
        itemCount: submission.inventory.length,
        payloadHash: createHash("sha256").update(JSON.stringify(submission)).digest("hex"),
      },
    };
  }

  private validateRequest(request: InventoryAgentRequest): string | null {
    if (!/^[0-9]{6}$/.test(request.regionCode)) {
      return "regionCode must be a 6-digit administrative code";
    }
    if (request.mode !== "FULL" && request.mode !== "TARGETED") {
      return "mode must be FULL or TARGETED";
    }
    if (
      request.mode === "TARGETED" &&
      (!request.specifiedInstitutions || request.specifiedInstitutions.length === 0)
    ) {
      return "TARGETED mode requires at least one specifiedInstitution";
    }
    return null;
  }
}

function summarizeToolCalls(
  eventSink: MemoryToolEventSink,
  inventoryFrozen: boolean,
): InventoryToolCallSummary[] {
  return INVENTORY_TOOL_NAMES.map((toolName) => {
    // The sink is only reachable through the submit_inventory tool, so a frozen
    // inventory implies the tool was called and succeeded (true for the real
    // Pi flow, and when a test populates the sink directly).
    if (toolName === "submit_inventory" && inventoryFrozen) {
      return { toolName, called: true, succeeded: true };
    }
    return {
      toolName,
      called: eventSink.starts.some((event) => event.toolName === toolName),
      succeeded: eventSink.successes.some((event) => event.toolName === toolName),
    };
  });
}
