# STEP 8 — Inventory Agent Foundation Implementation Plan

Phase: FAST DEVELOPMENT MODE (plan -> self-review -> self-approve -> execute).
Goal: stand up the first real business Agent — the Inventory Agent — whose only
formal output boundary is a structured `submit_inventory` tool. Region → Pi
Inventory Agent → official-biography-evidence Skill → get_region_context +
fetch/render/inspect/search → Pi semantic decisions → submit_inventory → Skill
Schema validation → in-memory Inventory Freeze → InventoryAgentResult.

```
Region (regionCode + mode) -> InventoryAgentRunner
  -> AgentSessionFactory (INVENTORY role) -> Pi AgentSession
  -> Skill loaded via ResourceLoader
  -> Role prompt (short, no SKILL.md copy)
  -> Pi calls get_region_context / search_web / fetch_page / render_page / inspect_page
  -> Pi calls submit_inventory  (the ONLY formal output)
  -> SkillSchemaRegistry canonical schema (ajv) validation
  -> InMemoryInventorySubmissionSink -> freeze (one submission per run)
  -> InventoryAgentResult
```

## Global Constraints
- Skill `official-biography-evidence` 3.1.0 is the single domain authority.
  TypeScript validates structure only; INCLUDE/EXCLUDE and institution-type
  rules live in Skill → Pi, never copied into TS.
- `submit_inventory` is the only formal inventory output; free-text JSON/markdown
  is never accepted.
- Canonical submission schema comes from the existing SkillSchemaRegistry
  (`institution-inventory.schema.json`, title "Frozen Institution Inventory
  Record"). No second schema loader; ajv is only the validation engine.
- Runner is provider-neutral: goes through ModelPolicy + AgentSessionFactory,
  never imports DeepSeek, never reads an API key, never writes a model id.
- No region-specific code. The smoke region is a runtime argument.
- Existing 5 tools preserved; `read/bash/edit/write` stay disabled.
- submit_inventory is exposed only to the INVENTORY role (role tool policy).
- No Skill / Graphile / DB / migration / production changes.
- Targeted tests only (~8 new cases + 2 required existing-test fixes).
- Single final commit. No push.

## Task 1 — Inventory submission domain contract + submit_inventory tool

Files:
- Create: `packages/agent-tools/src/tools/inventory/inventory-submission.ts`
- Create: `packages/agent-tools/src/tools/inventory/submit-inventory.ts`
- Test: `packages/agent-tools/src/tools/inventory/submit-inventory.test.ts`
- Modify: `packages/agent-tools/src/contracts/tool-failure-codes.ts`
- Modify: `packages/agent-tools/src/registry/default-tool-registry.ts`
- Modify: `packages/agent-tools/src/registry/default-tool-registry.test.ts`
- Modify: `packages/agent-tools/src/index.ts`

Step 1 — Add two failure codes to `contracts/tool-failure-codes.ts` (append to
the const object; the type is derived):

```ts
  SCHEMA_VALIDATION_FAILED: "SCHEMA_VALIDATION_FAILED",
  INVENTORY_ALREADY_SUBMITTED: "INVENTORY_ALREADY_SUBMITTED",
```

Step 2 — Write `tools/inventory/inventory-submission.ts` (provider-neutral
contracts; the Skill schema record mirrors `institution-inventory.schema.json`):

```ts
/** Provider-neutral inventory submission contracts.
 *  The record shape mirrors the canonical Skill schema
 *  (schemas/institution-inventory.schema.json, title "Frozen Institution
 *  Inventory Record"). Only structural validation happens in TypeScript —
 *  INCLUDE/EXCLUDE semantics stay in Skill -> Pi. */

export const ADMINISTRATIVE_LEVELS = ["PROVINCIAL", "PREFECTURE", "COUNTY"] as const;
export type AdministrativeLevel = (typeof ADMINISTRATIVE_LEVELS)[number];

export const INSTITUTION_DECISIONS = [
  "INCLUDE",
  "EXCLUDE_OUT_OF_SCOPE",
  "EXCLUDE_INTERNAL_DEPARTMENT",
  "EXCLUDE_SUBORDINATE_UNIT",
  "EXCLUDE_NON_INSTITUTION",
  "DUPLICATE_ENTRY",
  "MERGE_ALIAS",
] as const;
export type InstitutionDecision = (typeof INSTITUTION_DECISIONS)[number];

export type InstitutionInventoryRecord = {
  institution_id: string;
  standard_name: string;
  administrative_level: AdministrativeLevel;
  core_institution_type?: string;
  decision: InstitutionDecision;
  source_url?: string;
  lineage?: string[];
  /** The canonical Skill schema allows additional properties. */
  [key: string]: unknown;
};

export type InventorySubmissionPayload = {
  inventory: InstitutionInventoryRecord[];
};

export type SubmissionValidation =
  | { valid: true }
  | { valid: false; errors: string[] };

export interface InventorySubmissionValidator {
  validate(payload: InventorySubmissionPayload): SubmissionValidation;
}

export type InventorySubmitResult =
  | { status: "ACCEPTED"; payloadHash: string }
  | { status: "ALREADY_SUBMITTED"; payloadHash: string };

export interface InventorySubmissionSink {
  submit(payload: InventorySubmissionPayload): Promise<InventorySubmitResult>;
  getSubmission(): Promise<InventorySubmissionPayload | null>;
  isFrozen(): Promise<boolean>;
}

export type SubmitInventorySuccess = {
  status: "ACCEPTED";
  frozen: true;
  itemCount: number;
  payloadHash: string;
};
```

Step 3 — Write `tools/inventory/submit-inventory.ts`:

```ts
import { Type, type Static } from "@sinclair/typebox";
import { ToolFailureCode, ToolFailureError } from "../../contracts/tool-failure-codes.js";
import type { AgentToolDefinition } from "../../contracts/tool-types.js";
import {
  ADMINISTRATIVE_LEVELS,
  INSTITUTION_DECISIONS,
  type InventorySubmissionPayload,
  type InventorySubmissionSink,
  type InventorySubmissionValidator,
  type SubmitInventorySuccess,
} from "./inventory-submission.js";

const record = Type.Object(
  {
    institution_id: Type.String({ minLength: 1 }),
    standard_name: Type.String({ minLength: 1 }),
    administrative_level: Type.Union(
      ADMINISTRATIVE_LEVELS.map((level) => Type.Literal(level)),
    ),
    core_institution_type: Type.Optional(Type.String()),
    decision: Type.Union(INSTITUTION_DECISIONS.map((decision) => Type.Literal(decision))),
    source_url: Type.Optional(Type.String()),
    lineage: Type.Optional(Type.Array(Type.String())),
  },
  { additionalProperties: true },
);

export const SubmitInventoryInput = Type.Object(
  { inventory: Type.Array(record, { minItems: 1 }) },
  { additionalProperties: false },
);

export type SubmitInventoryInput = Static<typeof SubmitInventoryInput>;

export type SubmitInventoryToolDeps = {
  /** Validates the payload against the canonical Skill inventory schema. */
  validator: InventorySubmissionValidator;
  /** Stores the first accepted submission (one freeze per run). */
  sink: InventorySubmissionSink;
};

/**
 * Inventory output boundary tool.
 *
 * Pi knows only `submit_inventory`; the concrete Skill-schema validator and the
 * in-memory sink are wired server-side by the InventoryAgentRunner. The tool
 * validates against the canonical Skill schema, accepts exactly one submission,
 * and rejects any later override.
 */
export function createSubmitInventoryTool(
  deps: SubmitInventoryToolDeps,
): AgentToolDefinition<typeof SubmitInventoryInput, SubmitInventorySuccess> {
  return {
    name: "submit_inventory",
    description:
      "Submit the final institution inventory for this run. The payload must follow the official-biography-evidence institution-inventory schema. Exactly one submission is accepted per run; a later submission is rejected.",
    inputSchema: SubmitInventoryInput,
    async execute(_context, input) {
      const payload: InventorySubmissionPayload = { inventory: input.inventory };
      const validation = deps.validator.validate(payload);
      if (!validation.valid) {
        throw new ToolFailureError({
          code: ToolFailureCode.SCHEMA_VALIDATION_FAILED,
          message: `submit_inventory failed Skill schema validation: ${validation.errors.join("; ")}`,
          retryable: false,
        });
      }
      const result = await deps.sink.submit(payload);
      if (result.status === "ALREADY_SUBMITTED") {
        throw new ToolFailureError({
          code: ToolFailureCode.INVENTORY_ALREADY_SUBMITTED,
          message: "Inventory already submitted and frozen for this run",
          retryable: false,
        });
      }
      return {
        status: "ACCEPTED",
        frozen: true,
        itemCount: payload.inventory.length,
        payloadHash: result.payloadHash,
      };
    },
  };
}
```

Step 4 — Write `tools/inventory/submit-inventory.test.ts` (4 tests; a tiny local
recording sink stands in for the in-memory sink; a stub validator drives the
schema path):

```ts
import { describe, expect, it } from "vitest";
import { ToolFailureCode } from "../../contracts/tool-failure-codes.js";
import type {
  InventorySubmissionPayload,
  InventorySubmissionSink,
  InventorySubmissionValidator,
  SubmitInventorySuccess,
  SubmissionValidation,
} from "./inventory-submission.js";
import { createSubmitInventoryTool } from "./submit-inventory.js";

const VALID_RECORD = {
  institution_id: "sh-people-gov",
  standard_name: "上海市人民政府",
  administrative_level: "PROVINCIAL",
  decision: "INCLUDE",
  source_url: "https://www.sh.gov.cn/",
};

const context = () => ({
  taskRunId: "task-1",
  agentSessionId: "session-1",
  agentRole: "INVENTORY" as const,
  signal: new AbortController().signal,
});

class RecordingSink implements InventorySubmissionSink {
  submission: InventorySubmissionPayload | null = null;
  private payloadHash = "";
  async submit(payload: InventorySubmissionPayload) {
    if (this.submission) return { status: "ALREADY_SUBMITTED" as const, payloadHash: this.payloadHash };
    this.submission = payload;
    this.payloadHash = "hash-1";
    return { status: "ACCEPTED" as const, payloadHash: this.payloadHash };
  }
  async getSubmission() { return this.submission; }
  async isFrozen() { return this.submission !== null; }
}

function validator(overrides?: { valid?: boolean; errors?: string[] }): InventorySubmissionValidator {
  const result: SubmissionValidation =
    overrides?.valid === false ? { valid: false, errors: overrides.errors ?? ["bad record"] } : { valid: true };
  return { validate: () => result };
}

describe("submit_inventory tool", () => {
  it("accepts a valid canonical payload and freezes it", async () => {
    const sink = new RecordingSink();
    const tool = createSubmitInventoryTool({ validator: validator(), sink });
    const result = await tool.execute(context(), { inventory: [VALID_RECORD] });
    expect(result.status).toBe("ACCEPTED");
    expect((result as SubmitInventorySuccess).frozen).toBe(true);
    expect((result as SubmitInventorySuccess).itemCount).toBe(1);
    expect((result as SubmitInventorySuccess).payloadHash).toBe("hash-1");
    expect(await sink.isFrozen()).toBe(true);
  });

  it("rejects a payload that fails Skill schema validation", async () => {
    const tool = createSubmitInventoryTool({
      validator: validator({ valid: false, errors: ["inventory[0].decision: must be enum"] }),
      sink: new RecordingSink(),
    });
    await expect(tool.execute(context(), { inventory: [VALID_RECORD] })).rejects.toMatchObject({
      code: ToolFailureCode.SCHEMA_VALIDATION_FAILED,
    });
  });

  it("rejects a second submission once the inventory is frozen", async () => {
    const sink = new RecordingSink();
    const tool = createSubmitInventoryTool({ validator: validator(), sink });
    await tool.execute(context(), { inventory: [VALID_RECORD] });
    await expect(tool.execute(context(), { inventory: [VALID_RECORD] })).rejects.toMatchObject({
      code: ToolFailureCode.INVENTORY_ALREADY_SUBMITTED,
    });
  });

  it("accepts multiple valid records in one submission", async () => {
    const sink = new RecordingSink();
    const tool = createSubmitInventoryTool({ validator: validator(), sink });
    const result = await tool.execute(context(), {
      inventory: [VALID_RECORD, { ...VALID_RECORD, institution_id: "sh-2", standard_name: "上海市发展和改革委员会" }],
    });
    expect(result.status).toBe("ACCEPTED");
    if (result.status === "ACCEPTED") expect(result.itemCount).toBe(2);
  });
});
```

Step 5 — Modify `registry/default-tool-registry.ts`: add `submitInventoryTool?:
AgentToolDefinition` to the options, and register it only when provided (the
concrete validator/sink are wired by the InventoryAgentRunner):

```ts
  /** Adds the submit_inventory tool (Inventory Agent only; wired by the runner). */
  submitInventoryTool?: AgentToolDefinition;
...
  const inspectPage = options.inspectPageTool ?? createInspectPageTool();
  const tools: AgentToolDefinition[] = [getRegionContextTool, searchWeb, fetchPage, renderPage, inspectPage];
  if (options.submitInventoryTool) tools.push(options.submitInventoryTool);
  return new ToolRegistry(tools);
```

Step 6 — Extend `registry/default-tool-registry.test.ts` with a second test:

```ts
it("adds submit_inventory only when provided (6 tools, no coding tools)", () => {
  const registry = createAgentToolRegistry({
    submitInventoryTool: {
      name: "submit_inventory",
      description: "stub",
      inputSchema: Type.Object({}, { additionalProperties: false }),
      async execute() {
        return { status: "ACCEPTED", frozen: true, itemCount: 0, payloadHash: "h" };
      },
    },
  });
  const names = registry.list().map((tool) => tool.name);
  expect(names).toEqual([
    "fetch_page",
    "get_region_context",
    "inspect_page",
    "render_page",
    "search_web",
    "submit_inventory",
  ]);
  for (const forbidden of ["read", "bash", "edit", "write"]) {
    expect(registry.has(forbidden)).toBe(false);
  }
});
```

(`Type` must be imported in the test file.)

Step 7 — Append to `packages/agent-tools/src/index.ts`:

```ts
export * from "./tools/inventory/inventory-submission.js";
export * from "./tools/inventory/submit-inventory.js";
```

Step 8 — Run the new + registry tests:

```
cd /opt/Stellaris-PiAgent-Dev
corepack pnpm --filter @stellaris/agent-tools exec vitest run src/tools/inventory/submit-inventory.test.ts src/registry/default-tool-registry.test.ts
```
Expected: PASS.

## Task 2 — In-memory submission sink + Skill schema validator

Files:
- Create: `packages/agent-runtime/src/inventory/inventory-submission-sink.ts`
- Create: `packages/agent-runtime/src/inventory/skill-inventory-validator.ts`
- Test: `packages/agent-runtime/src/inventory/skill-inventory-validator.test.ts`
- Modify: `packages/agent-runtime/package.json` (add `ajv` dependency)

Step 1 — Add `"ajv": "8.20.0"` to `packages/agent-runtime/package.json`
dependencies, then `corepack pnpm install`.

Step 2 — Write `inventory/inventory-submission-sink.ts`:

```ts
import { createHash } from "node:crypto";
import type {
  InventorySubmissionPayload,
  InventorySubmissionSink,
  InventorySubmitResult,
} from "@stellaris/agent-tools";

/** Runtime freeze boundary (NOT persistence): exactly one accepted submission. */
export class InMemoryInventorySubmissionSink implements InventorySubmissionSink {
  private submission: InventorySubmissionPayload | null = null;
  private payloadHash = "";

  async submit(payload: InventorySubmissionPayload): Promise<InventorySubmitResult> {
    if (this.submission) {
      return { status: "ALREADY_SUBMITTED", payloadHash: this.payloadHash };
    }
    this.submission = payload;
    this.payloadHash = createHash("sha256").update(JSON.stringify(payload)).digest("hex");
    return { status: "ACCEPTED", payloadHash: this.payloadHash };
  }

  async getSubmission(): Promise<InventorySubmissionPayload | null> {
    return this.submission;
  }

  async isFrozen(): Promise<boolean> {
    return this.submission !== null;
  }
}
```

Step 3 — Write `inventory/skill-inventory-validator.ts` (ajv over the canonical
schema from the existing SkillSchemaRegistry):

```ts
import path from "node:path";
import { Ajv2020 } from "ajv/dist/2020.js";
import type {
  InventorySubmissionPayload,
  InventorySubmissionValidator,
  SubmissionValidation,
} from "@stellaris/agent-tools";
import { SkillSchemaRegistry, type RegisteredSchema } from "../skill/skill-schema-registry.js";
import type { SkillIdentity } from "../skill/skill-identity.js";
import { InventoryRuntimeError } from "./inventory-types.js";

export const INSTITUTION_INVENTORY_SCHEMA_TITLE = "Frozen Institution Inventory Record";

export function findInstitutionInventorySchema(
  registry: SkillSchemaRegistry,
): RegisteredSchema {
  const byTitle = registry.get(INSTITUTION_INVENTORY_SCHEMA_TITLE);
  if (byTitle) return byTitle;
  const byPath = registry
    .list()
    .map((name) => registry.get(name))
    .find((schema) => schema?.filePath.endsWith("institution-inventory.schema.json"));
  if (!byPath) {
    throw new InventoryRuntimeError(
      "Institution inventory schema not found in SkillSchemaRegistry",
    );
  }
  return byPath;
}

/** Build an InventorySubmissionValidator over the pinned Skill's canonical
 *  institution-inventory schema (loaded through the existing registry). */
export async function createSkillInventoryValidator(
  identity: SkillIdentity,
): Promise<InventorySubmissionValidator> {
  const registry = await SkillSchemaRegistry.load(path.join(identity.path, "schemas"));
  const schema = findInstitutionInventorySchema(registry);
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  const validateRecord = ajv.compile(schema.schema);
  return {
    validate(payload: InventorySubmissionPayload): SubmissionValidation {
      const errors: string[] = [];
      payload.inventory.forEach((record, index) => {
        const ok = validateRecord(record);
        if (!ok) {
          const detail = (validateRecord.errors ?? [])
            .map((error) => `${error.instancePath || "#"} ${error.message ?? ""}`.trim())
            .join("; ");
          errors.push(`inventory[${index}]: ${detail}`);
        }
      });
      return errors.length > 0 ? { valid: false, errors } : { valid: true };
    },
  };
}
```

Step 4 — Write `inventory/skill-inventory-validator.test.ts` (real Skill schema
via `createRuntimeConfig().projectRoot`; valid record passes, invalid fails):

```ts
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createRuntimeConfig } from "../config/runtime-config.js";
import { OFFICIAL_BIOGRAPHY_SKILL_NAME, SkillRuntime } from "../skill/skill-runtime.js";
import { createSkillInventoryValidator } from "./skill-inventory-validator.js";

describe("createSkillInventoryValidator", () => {
  it("validates against the pinned official-biography-evidence inventory schema", async () => {
    const config = createRuntimeConfig();
    const runtime = new SkillRuntime(config);
    await runtime.reload();
    const identity = await runtime.resolveSkill(OFFICIAL_BIOGRAPHY_SKILL_NAME);
    expect(identity.version).toBe("3.1.0");
    const validator = await createSkillInventoryValidator(identity);

    const valid = validator.validate({
      inventory: [
        {
          institution_id: "sh-people-gov",
          standard_name: "上海市人民政府",
          administrative_level: "PROVINCIAL",
          decision: "INCLUDE",
          source_url: "https://www.sh.gov.cn/",
        },
      ],
    });
    expect(valid.valid).toBe(true);

    const invalid = validator.validate({
      inventory: [
        {
          institution_id: "bad",
          standard_name: "错误机构",
          administrative_level: "GALAXY",
          decision: "MAYBE",
        },
      ],
    });
    expect(invalid.valid).toBe(false);
    if (!invalid.valid) expect(invalid.errors.length).toBeGreaterThan(0);
  });
});
```

Step 5 — Run the validator test:

```
cd /opt/Stellaris-PiAgent-Dev
corepack pnpm --filter @stellaris/agent-runtime exec vitest run src/inventory/skill-inventory-validator.test.ts
```
Expected: PASS (ajv resolves via the new dependency).

## Task 3 — Inventory role tool policy + session allowlist filtering

Files:
- Create: `packages/agent-runtime/src/session/role-tool-policy.ts`
- Test: `packages/agent-runtime/src/session/role-tool-policy.test.ts`
- Modify: `packages/agent-runtime/src/session/session-factory.ts`
- Modify: `packages/agent-runtime/src/session/session-factory.test.ts`
- Modify: `packages/agent-runtime/src/session/pi-tool-adapter.test.ts`

Step 1 — Write `session/role-tool-policy.ts`:

```ts
import type { AgentRole } from "@stellaris/contracts";

/** Tools the Inventory Agent may call (submit_inventory is the output boundary). */
export const INVENTORY_ROLE_TOOLS = [
  "get_region_context",
  "search_web",
  "fetch_page",
  "render_page",
  "inspect_page",
  "submit_inventory",
] as const;

/** Base tools shared by the other agent roles (future roles get their own policy). */
export const BASE_AGENT_TOOLS = [
  "get_region_context",
  "search_web",
  "fetch_page",
  "render_page",
  "inspect_page",
] as const;

export type RoleToolPolicy = Record<AgentRole, readonly string[]>;

export const ROLE_TOOL_POLICY: RoleToolPolicy = {
  INVENTORY: INVENTORY_ROLE_TOOLS,
  INVESTIGATOR: BASE_AGENT_TOOLS,
  RECOVERY: BASE_AGENT_TOOLS,
  REVIEWER: BASE_AGENT_TOOLS,
};

/** Allowed tool names for a role (the Pi session allowlist source). */
export function roleToolsFor(role: AgentRole): readonly string[] {
  return ROLE_TOOL_POLICY[role];
}
```

Step 2 — Write `session/role-tool-policy.test.ts` (one security test per section 50):

```ts
import { describe, expect, it } from "vitest";
import { PI_DEFAULT_CODING_TOOLS } from "./tool-policy.js";
import { roleToolsFor } from "./role-tool-policy.js";

describe("role tool policy", () => {
  it("grants the Inventory role exactly the six business tools and no coding tools", () => {
    const inventoryTools = roleToolsFor("INVENTORY");
    expect([...inventoryTools]).toEqual([
      "get_region_context",
      "search_web",
      "fetch_page",
      "render_page",
      "inspect_page",
      "submit_inventory",
    ]);
    for (const forbidden of PI_DEFAULT_CODING_TOOLS) {
      expect(inventoryTools).not.toContain(forbidden);
    }
    // submit_inventory is Inventory-only.
    expect(roleToolsFor("INVESTIGATOR")).not.toContain("submit_inventory");
  });
});
```

Step 3 — Modify `session/session-factory.ts`: replace the allowlist derivation
(around the `allowedToolNames` line) with the role policy:

```ts
import { roleToolsFor } from "./role-tool-policy.js";
...
    const allowedToolNames = roleToolsFor(role).filter((name) => this.registry.has(name));
```

Step 4 — Modify `session/session-factory.test.ts`:
- Change `const ALLOWLIST = ["fetch_page", "get_region_context", "render_page", "search_web"]`
  to the 5-tool base list (add `inspect_page` between `get_region_context` and
  `render_page`) — the Step 7 consequence.
- Add a test asserting an INVENTORY session (with a registry that includes
  submit_inventory) gets the 6-tool allowlist and no coding tools.

```ts
const ALLOWLIST = ["fetch_page", "get_region_context", "inspect_page", "render_page", "search_web"];
...
  it("gives the INVENTORY role the six-tool allowlist when submit_inventory is registered", async () => {
    let captured: CreateAgentSessionOptions | undefined;
    const registry = createAgentToolRegistry({
      submitInventoryTool: {
        name: "submit_inventory",
        description: "stub",
        inputSchema: Type.Object({}, { additionalProperties: false }),
        async execute() {
          return { status: "ACCEPTED", frozen: true, itemCount: 0, payloadHash: "h" };
        },
      },
    });
    const factory = new AgentSessionFactory({
      modelPolicy: new ModelPolicy(() => ({ provider: "deepseek", model: "deepseek-v4-pro" })),
      modelResolver: await PiModelResolver.create(),
      resourceLoader: stubLoader,
      gateway: new ToolGateway(registry),
      registry,
      createSession: async (options) => {
        captured = options;
        return { session: fakeSession as never, extensionsResult: {} as never };
      },
    });
    const result = await factory.createAgentSession("INVENTORY");
    expect(result.status).toBe("READY");
    if (result.status !== "READY") return;
    expect(captured?.tools).toEqual([
      "fetch_page",
      "get_region_context",
      "inspect_page",
      "render_page",
      "search_web",
      "submit_inventory",
    ]);
    for (const forbidden of PI_DEFAULT_CODING_TOOLS) {
      expect(captured?.tools).not.toContain(forbidden);
    }
  });
```

(`Type` must be imported in the test file.)

Step 5 — Modify `session/pi-tool-adapter.test.ts`: update the expected custom-tool
list to the 5-tool base (add `inspect_page` between `get_region_context` and
`render_page`) — the Step 7 consequence:

```ts
    expect(customTools.map((tool) => tool.name)).toEqual([
      "fetch_page",
      "get_region_context",
      "inspect_page",
      "render_page",
      "search_web",
    ]);
```

Step 6 — Run the session + policy tests:

```
cd /opt/Stellaris-PiAgent-Dev
corepack pnpm --filter @stellaris/agent-runtime exec vitest run src/session/
```
Expected: PASS.

## Task 4 — InventoryAgentRunner + role prompt

Files:
- Create: `packages/agent-runtime/src/inventory/inventory-types.ts`
- Create: `packages/agent-runtime/src/inventory/inventory-role-prompt.ts`
- Create: `packages/agent-runtime/src/inventory/inventory-agent-runner.ts`
- Test: `packages/agent-runtime/src/inventory/inventory-agent-runner.test.ts`

Step 1 — Write `inventory/inventory-types.ts`:

```ts
import type { InstitutionInventoryRecord } from "@stellaris/agent-tools";

export type InventoryMode = "FULL" | "TARGETED";

/** Business request. No seed URL / search query — the product is URL-free. */
export type InventoryAgentRequest = {
  regionCode: string;
  mode: InventoryMode;
  specifiedInstitutions?: string[];
};

export type InventoryFreezeReceipt = {
  frozen: true;
  itemCount: number;
  payloadHash: string;
};

export type InventoryToolCallSummary = {
  toolName: string;
  called: boolean;
  succeeded: boolean;
};

export type InventoryCompletedResult = {
  status: "COMPLETED";
  regionCode: string;
  mode: InventoryMode;
  inventory: InstitutionInventoryRecord[];
  frozen: true;
  agentSessionId: string;
  skill: { name: string; version: string };
  model: { provider: string; model: string };
  toolCalls: InventoryToolCallSummary[];
  receipt: InventoryFreezeReceipt;
};

export type InventoryAgentResult =
  | InventoryCompletedResult
  | { status: "INVALID_REQUEST"; reason: string }
  | { status: "MODEL_NOT_CONFIGURED" }
  | { status: "MODEL_NOT_FOUND"; provider: string; model: string }
  | { status: "INVENTORY_NOT_SUBMITTED"; agentSessionId: string; toolCalls: InventoryToolCallSummary[] };

export class InventoryRuntimeError extends Error {}
```

Step 2 — Write `inventory/inventory-role-prompt.ts` (short; never copies the Skill):

```ts
import type { SkillIdentity } from "../skill/skill-identity.js";
import type { InventoryAgentRequest } from "./inventory-types.js";

export type InventoryPromptDevHints = { seedUrl?: string };

/** Build the short Inventory role prompt. The Skill is loaded via
 *  ResourceLoader; this prompt never copies SKILL.md. */
export function buildInventoryRolePrompt(
  request: InventoryAgentRequest,
  regionName: string,
  devHints?: InventoryPromptDevHints,
): string {
  const lines = [
    "你正在执行 Stellaris 政务简历采集的 Inventory Agent 任务。",
    "你的角色：INVENTORY。",
    "",
    `目标行政区：${regionName}（代码 ${request.regionCode}）。`,
    `模式：${request.mode}（${request.mode === "TARGETED" ? "仅验证并规范指定机构" : "按 Skill 主动发现机构清单"}）。`,
  ];
  if (request.mode === "TARGETED" && request.specifiedInstitutions && request.specifiedInstitutions.length > 0) {
    lines.push("指定机构：");
    for (const institution of request.specifiedInstitutions) lines.push(`- ${institution}`);
  }
  lines.push(
    "",
    "必须严格遵循已加载的 official-biography-evidence Skill 工作流判断机构归属。",
    "先调用 get_region_context 确认行政区。",
    "通过 fetch_page / render_page 获取官方页面，用 inspect_page 解析为结构化观察。",
    "依据 Skill 判断每个机构应 INCLUDE 还是 EXCLUDE；TypeScript 不替你判断。",
    "最终必须调用 submit_inventory 提交结构化 Inventory，禁止用聊天文本代替正式提交。",
    "每次 run 只能成功提交一次 Inventory；不得覆盖已提交结果。",
  );
  if (devHints?.seedUrl) {
    lines.push("", "开发提示（仅本次 smoke）：", `优先从官方入口开始验证：${devHints.seedUrl}`);
  }
  lines.push(
    "",
    "Skill 已通过 ResourceLoader 加载，不要复制 Skill 内容到本提示。",
    "不要读取文件，不要执行 shell，不要使用自由文本提交 Inventory。",
  );
  return lines.join("\n");
}
```

Step 3 — Write `inventory/inventory-agent-runner.ts`:

```ts
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
  type ToolEventSink,
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
  /** Override for tests/observability: tool event sink. */
  eventSink?: ToolEventSink;
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
      createSession: this.deps.createSession,
    });
    const created = await factory.createAgentSession("INVENTORY", {
      taskRunId: `inventory-${request.regionCode}-${Date.now()}`,
    });
    if (created.status !== "READY") {
      return { status: "MODEL_NOT_CONFIGURED" };
    }
    const { session, agentSessionId } = created;

    await session.prompt(
      buildInventoryRolePrompt(request, region.name, this.deps.devHints),
    );

    const toolCalls = summarizeToolCalls(eventSink);
    if (!(await sink.isFrozen())) {
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
    if (request.mode === "TARGETED" && (!request.specifiedInstitutions || request.specifiedInstitutions.length === 0)) {
      return "TARGETED mode requires at least one specifiedInstitution";
    }
    return null;
  }
}

function summarizeToolCalls(eventSink: ToolEventSink): InventoryToolCallSummary[] {
  return INVENTORY_TOOL_NAMES.map((toolName) => ({
    toolName,
    called: eventSink.starts.some((event) => event.toolName === toolName),
    succeeded: eventSink.successes.some((event) => event.toolName === toolName),
  }));
}
```

Step 4 — Write `inventory/inventory-agent-runner.test.ts` (mock Pi session; no LLM):

```ts
import { describe, expect, it } from "vitest";
import type { ResourceLoader } from "@earendil-works/pi-coding-agent";
import type {
  InventorySubmissionPayload,
  InventorySubmissionSink,
  InventorySubmissionValidator,
} from "@stellaris/agent-tools";
import { ModelPolicy } from "../model/model-policy.js";
import { PiModelResolver } from "../model/pi-model-resolver.js";
import type { SkillIdentity } from "../skill/skill-identity.js";
import type { SkillRuntime } from "../skill/skill-runtime.js";
import { InMemoryInventorySubmissionSink } from "./inventory-submission-sink.js";
import { InventoryAgentRunner } from "./inventory-agent-runner.js";

const stubLoader = {
  reload: async () => {},
  getSkills: () => ({ skills: [], diagnostics: [] }),
  getExtensions: () => ({ extensions: [] }),
  getPrompts: () => ({ prompts: [], diagnostics: [] }),
  getThemes: () => ({ themes: [], diagnostics: [] }),
  getAgentsFiles: () => ({ agentsFiles: [] }),
  getSystemPrompt: () => undefined,
  getSystemPromptSource: () => undefined,
  getAppendSystemPrompt: () => [],
  getAppendSystemPromptSources: () => [],
  extendResources: () => {},
} as unknown as ResourceLoader;

const identity: SkillIdentity = {
  name: "official-biography-evidence",
  id: "official-biography-evidence",
  version: "3.1.0",
  path: "/skills/official-biography-evidence",
  skmdPath: "/skills/official-biography-evidence/SKILL.md",
  yamlPath: "/skills/official-biography-evidence/skill.yaml",
};

const stubSkillRuntime = {
  reload: async () => {},
  resolveSkill: async () => identity,
  getResourceLoader: () => stubLoader,
} as unknown as SkillRuntime;

const stubValidator: InventorySubmissionValidator = { validate: () => ({ valid: true }) };

const VALID_INVENTORY: InventorySubmissionPayload = {
  inventory: [
    {
      institution_id: "sh-people-gov",
      standard_name: "上海市人民政府",
      administrative_level: "PROVINCIAL",
      decision: "INCLUDE",
      source_url: "https://www.sh.gov.cn/",
    },
  ],
};

const REQUEST = {
  regionCode: "310000",
  mode: "TARGETED" as const,
  specifiedInstitutions: ["上海市人民政府"],
};

describe("InventoryAgentRunner", () => {
  it("fails with INVENTORY_NOT_SUBMITTED when the session never calls submit_inventory", async () => {
    const runner = new InventoryAgentRunner({
      skillRuntime: stubSkillRuntime,
      modelPolicy: new ModelPolicy(() => ({ provider: "deepseek", model: "deepseek-v4-pro" })),
      modelResolver: await PiModelResolver.create(),
      sink: new InMemoryInventorySubmissionSink(),
      validator: stubValidator,
      createSession: async () => ({ session: fakeSession(async () => {}), extensionsResult: {} as never }),
    });
    const result = await runner.run(REQUEST);
    expect(result.status).toBe("INVENTORY_NOT_SUBMITTED");
  });

  it("returns a frozen COMPLETED result when the session submits a valid inventory", async () => {
    const sink = new InMemoryInventorySubmissionSink();
    const runner = new InventoryAgentRunner({
      skillRuntime: stubSkillRuntime,
      modelPolicy: new ModelPolicy(() => ({ provider: "deepseek", model: "deepseek-v4-pro" })),
      modelResolver: await PiModelResolver.create(),
      sink,
      validator: stubValidator,
      createSession: async () =>
        ({
          session: fakeSession(async () => {
            await sink.submit(VALID_INVENTORY);
          }),
          extensionsResult: {} as never,
        }),
    });
    const result = await runner.run(REQUEST);
    expect(result.status).toBe("COMPLETED");
    if (result.status !== "COMPLETED") return;
    expect(result.regionCode).toBe("310000");
    expect(result.mode).toBe("TARGETED");
    expect(result.frozen).toBe(true);
    expect(result.inventory).toHaveLength(1);
    expect(result.receipt.itemCount).toBe(1);
    expect(result.receipt.payloadHash.length).toBeGreaterThan(0);
    expect(result.skill).toEqual({ name: "official-biography-evidence", version: "3.1.0" });
    expect(result.model.provider).toBe("deepseek");
    const submit = result.toolCalls.find((tool) => tool.toolName === "submit_inventory");
    expect(submit).toBeDefined();
  });

  it("rejects an invalid request without creating a session", async () => {
    const runner = new InventoryAgentRunner({
      skillRuntime: stubSkillRuntime,
      modelPolicy: new ModelPolicy(() => ({ provider: "deepseek", model: "deepseek-v4-pro" })),
      modelResolver: await PiModelResolver.create(),
      sink: new InMemoryInventorySubmissionSink(),
      validator: stubValidator,
    });
    const result = await runner.run({ regionCode: "310000", mode: "TARGETED", specifiedInstitutions: [] });
    expect(result.status).toBe("INVALID_REQUEST");
  });
});

function fakeSession(prompt: (promptText: string) => Promise<void>) {
  return {
    sessionManager: { getSessionId: () => "session-inventory-test" },
    prompt,
  };
}
```

Step 5 — Run the runner + validator tests:

```
cd /opt/Stellaris-PiAgent-Dev
corepack pnpm --filter @stellaris/agent-runtime exec vitest run src/inventory/
```
Expected: PASS.

## Task 5 — Smoke, docs, verification, commit

Files:
- Create: `packages/agent-runtime/src/smoke/inventory-smoke.ts`
- Modify: `packages/agent-runtime/package.json` (`smoke:inventory` script)
- Modify: `package.json` (root `agent:smoke:inventory` script)
- Create: `docs/agent-runtime/inventory-agent-foundation.md`

Step 1 — Write `smoke/inventory-smoke.ts` (modeled on deepseek-smoke.ts; real Pi
+ Skill + tools via InventoryAgentRunner, TARGETED mode):

```ts
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRuntimeConfig } from "../config/runtime-config.js";
import { ModelPolicy } from "../model/model-policy.js";
import { PiModelResolver } from "../model/pi-model-resolver.js";
import { OFFICIAL_BIOGRAPHY_SKILL_NAME, SkillRuntime } from "../skill/skill-runtime.js";
import { InventoryAgentRunner } from "../inventory/inventory-agent-runner.js";
import type { InventoryAgentResult } from "../inventory/inventory-types.js";

export const INVENTORY_ARGS_REQUIRED = "INVENTORY_ARGS_REQUIRED" as const;
export const INVENTORY_SMOKE_FAILED = "INVENTORY_SMOKE_FAILED" as const;
export const MODEL_NOT_CONFIGURED = "MODEL_NOT_CONFIGURED" as const;
export const MODEL_NOT_FOUND = "MODEL_NOT_FOUND" as const;

export type InventorySmokeStatus =
  | "OK"
  | typeof INVENTORY_ARGS_REQUIRED
  | typeof MODEL_NOT_CONFIGURED
  | typeof MODEL_NOT_FOUND
  | typeof INVENTORY_SMOKE_FAILED;

export type InventorySmokeArgs = { regionCode?: string; institution?: string; seedUrl?: string };

export function parseInventorySmokeArgs(argv: string[]): InventorySmokeArgs {
  const read = (name: string): string | undefined => {
    const eq = argv.find((arg) => arg.startsWith(`--${name}=`));
    if (eq) {
      const value = eq.slice(`--${name}=`.length);
      if (value) return value;
    }
    const index = argv.indexOf(`--${name}`);
    const value = index !== -1 ? argv[index + 1] : undefined;
    return value || undefined;
  };
  return { regionCode: read("region-code"), institution: read("institution"), seedUrl: read("seed-url") };
}

export async function runInventorySmoke(
  args: InventorySmokeArgs,
): Promise<{ status: InventorySmokeStatus; report: Record<string, unknown> }> {
  const { regionCode, institution, seedUrl } = args;
  if (!regionCode || !institution) {
    return { status: INVENTORY_ARGS_REQUIRED, report: { detail: "--region-code and --institution are required" } };
  }
  const config = createRuntimeConfig();
  const skillRuntime = new SkillRuntime(config);
  await skillRuntime.reload();
  const skill = await skillRuntime.resolveSkill(OFFICIAL_BIOGRAPHY_SKILL_NAME);

  const runner = new InventoryAgentRunner({
    skillRuntime,
    modelPolicy: new ModelPolicy(),
    modelResolver: await PiModelResolver.create(),
    devHints: seedUrl ? { seedUrl } : undefined,
  });
  const result: InventoryAgentResult = await runner.run({
    regionCode,
    mode: "TARGETED",
    specifiedInstitutions: [institution],
  });

  const tools = new Map(
    (result.status === "COMPLETED" || result.status === "INVENTORY_NOT_SUBMITTED"
      ? result.toolCalls
      : []
    ).map((tool) => [tool.toolName, tool]),
  );
  const called = (name: string) => tools.get(name)?.called ?? false;
  const succeeded = (name: string) => tools.get(name)?.succeeded ?? false;

  if (result.status === "MODEL_NOT_CONFIGURED") {
    return { status: MODEL_NOT_CONFIGURED, report: { skill_loaded: true, detail: "AGENT_MODEL_PROVIDER/AGENT_MODEL_ID not configured" } };
  }
  if (result.status === "MODEL_NOT_FOUND") {
    return { status: MODEL_NOT_FOUND, report: { skill_loaded: true, detail: `${result.provider}/${result.model} not found` } };
  }
  if (result.status === "INVALID_REQUEST") {
    return { status: INVENTORY_SMOKE_FAILED, report: { skill_loaded: true, detail: result.reason } };
  }

  const report: Record<string, unknown> = {
    skill_loaded: true,
    skill_name: skill.name,
    skill_version: skill.version,
    agent_role: "INVENTORY",
    session_created: result.agentSessionId.length > 0,
    region_code: regionCode,
    institution,
    get_region_context_called: called("get_region_context"),
    search_web_called: called("search_web"),
    fetch_page_called: called("fetch_page"),
    render_page_called: called("render_page"),
    inspect_page_called: called("inspect_page"),
    submit_inventory_called: called("submit_inventory"),
    schema_valid: succeeded("submit_inventory"),
    inventory_frozen: result.status === "COMPLETED",
    agent_completed: result.status === "COMPLETED",
    model_provider: result.status === "COMPLETED" ? result.model.provider : undefined,
    item_count: result.status === "COMPLETED" ? result.receipt.itemCount : undefined,
    payload_hash: result.status === "COMPLETED" ? result.receipt.payloadHash : undefined,
  };

  const ok =
    result.status === "COMPLETED" &&
    called("get_region_context") &&
    (called("fetch_page") || called("render_page")) &&
    called("inspect_page") &&
    called("submit_inventory") &&
    succeeded("submit_inventory");
  return { status: ok ? "OK" : INVENTORY_SMOKE_FAILED, report };
}

export function formatInventorySmokeResult(
  status: InventorySmokeStatus,
  report: Record<string, unknown>,
): string {
  const lines = ["INVENTORY_SMOKE", `status: ${status}`];
  for (const [key, value] of Object.entries(report)) {
    if (value === undefined) continue;
    lines.push(`${key}: ${value === true ? "YES" : value === false ? "NO" : String(value)}`);
  }
  return lines.join("\n");
}

async function main(): Promise<void> {
  const args = parseInventorySmokeArgs(process.argv.slice(2));
  const { status, report } = await runInventorySmoke(args);
  process.stdout.write(formatInventorySmokeResult(status, report) + "\n");
  process.exitCode = status === "OK" ? 0 : 1;
}

const entryArg = process.argv[1];
const isEntryPoint = entryArg !== undefined && path.resolve(entryArg) === fileURLToPath(import.meta.url);

if (isEntryPoint) {
  void main();
}
```

Step 2 — Add scripts:
- `packages/agent-runtime/package.json` scripts: `"smoke:inventory": "tsx src/smoke/inventory-smoke.ts"`
- root `package.json` scripts: `"agent:smoke:inventory": "pnpm --filter @stellaris/agent-runtime smoke:inventory"`

Step 3 — Write `docs/agent-runtime/inventory-agent-foundation.md` (short; Purpose,
InventoryAgentRequest, FULL/TARGETED, InventoryAgentRunner, Inventory Role Tool
Policy, submit_inventory, Skill Schema Validation, InMemoryInventorySubmissionSink,
Runtime Freeze, Smoke Strategy; note FULL_DISCOVERY_REAL_SMOKE_DEFERRED because
Bocha credential is pending; note seedUrl is dev-smoke-only).

Step 4 — Build agent-tools + agent-runtime, then targeted verification (no full
workspace, no crawler/backend/playwright suites, no deepseek/bocha old smoke):

```
cd /opt/Stellaris-PiAgent-Dev
corepack pnpm --filter @stellaris/agent-tools build
corepack pnpm --filter @stellaris/agent-runtime build
corepack pnpm -r typecheck
corepack pnpm --filter @stellaris/agent-tools exec vitest run src/tools/inventory/ src/registry/
corepack pnpm --filter @stellaris/agent-runtime exec vitest run src/inventory/ src/session/
```

Step 5 — Run the real TARGETED inventory smoke (region 上海市 310000, institution
上海市人民政府, seed-url https://www.sh.gov.cn/). Before running, verify the seed
URL is fetchable and check model/key availability. If the server shell lacks
AGENT_MODEL_PROVIDER / AGENT_MODEL_ID / DEEPSEEK_API_KEY, run with the previously
verified mode-600 temporary-secret method; if no key is available, stop and report
DEEPSEEK_API_KEY_REQUIRED_FOR_INVENTORY_SMOKE (do not revert, do not re-run other
tests).

```
cd /opt/Stellaris-PiAgent-Dev
corepack pnpm agent:smoke:inventory -- --region-code 310000 --institution 上海市人民政府 --seed-url https://www.sh.gov.cn/
```
Expected: status OK; session_created YES; skill_loaded YES; get_region_context
CALLED; fetch_page or render_page CALLED; inspect_page CALLED; submit_inventory
CALLED + schema_valid YES; inventory_frozen YES; agent_completed YES.

Step 6 — Architecture self-review (checklist below), then ONE commit:

```
git add packages/agent-tools packages/agent-runtime package.json docs/agent-runtime docs/superpowers/plans
git commit -m "feat(agent): add inventory agent foundation"
```
No push, no production changes.

## Plan Architecture Self Review
- [x] Skill remains the institution domain rule source (no TS INCLUDE/EXCLUDE logic)
- [x] No hardcoded institution-type / region rules in TS
- [x] No DeepSeek inside InventoryAgentRunner (provider-neutral via ModelPolicy)
- [x] Model comes through ModelPolicy / AgentSessionFactory; no user model choice
- [x] No SearchProvider configuration required from the user
- [x] agent-tools stays Pi-agnostic
- [x] All formal tool calls route through ToolGateway
- [x] All five existing tools preserved
- [x] read/bash/edit/write stay disabled
- [x] Skill 3.1.0 unchanged
- [x] Graphile / POST /api/tasks unchanged
- [x] No DB migration
- [x] No Investigator / Leadership / PRIMARY / Reviewer logic
- [x] No full workspace tests
- [x] One submission per run (freeze, no override)

SELF_REVIEW: PASS
ARCHITECTURE_CONFLICT: NONE
EXECUTION_PREAUTHORIZED_BY_USER: YES
EXECUTION_MODE: INLINE_FAST
TEST_POLICY: TARGETED_ONLY
