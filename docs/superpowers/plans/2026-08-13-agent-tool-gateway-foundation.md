# Agent Tool Gateway Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Pi-agnostic generic Agent Tool Gateway with provenance events and the read-only `get_region_context` tool, then expose it to Pi through a runtime-only adapter while keeping coding tools disabled.

**Architecture:** `@stellaris/contracts` owns the shared `AgentRole` domain type and existing `RegionNode` tree. `@stellaris/agent-tools` owns generic tool contracts, failure normalization, registry, gateway, event sink abstractions, and `get_region_context`; it never imports Pi or agent-runtime. `@stellaris/agent-runtime` owns the Pi custom-tool conversion and allowlisted assembly, and the runtime doctor reports the gateway state.

**Tech Stack:** TypeScript 6, NodeNext, TypeBox 0.34.52, Vitest 4, Pi coding-agent 0.84.1.
## Global Constraints

- All development occurs in the isolated server worktree `/opt/Stellaris-PiAgent-Dev` on branch `refactor/pi-agent-runtime-server-20260813`.
- Use Node `v24.19.0` through NVM and pnpm `10.34.5` through `corepack pnpm`.
- Follow RED, GREEN, REFACTOR, and fresh verification; run Vitest with low concurrency and never launch Chromium.
- `@stellaris/agent-tools` must remain Pi-agnostic and must not import `@stellaris/agent-runtime`.
- Keep Pi default coding tools `read`, `bash`, `edit`, and `write` disabled; expose only registry-allowlisted custom tools.
- Do not select a provider or model, call an LLM, add Web Search, request government sites, or launch a browser.
- Do not modify the Task HTTP API, Graphile pipeline, crawler behavior, database schema, production environment, containers, database, or volumes.
- Reuse the existing nationwide `RegionNode` tree; do not copy region data or add region-specific branches.
- Do not implement future tools or persistent tool events in Step 3A.

---

### Task 1: Verify Step 2A and dependency boundaries

**Files:**
- Read-only: `/opt/Stellaris-PiAgent-Dev/AGENTS.md`, `packages/contracts/src/region.ts`, `packages/agent-runtime/src/model/model-types.ts`, `packages/agent-runtime/src/session/tool-policy.ts`, `packages/agent-runtime/src/doctor/runtime-doctor.ts`.

- [ ] **Step 1: Run the server gate**

Run `source ~/.nvm/nvm.sh && nvm use 24.19.0 && node --version && corepack pnpm --version`; expect `v24.19.0` and `10.34.5`.

- [ ] **Step 2: Verify clean development state**

Run `git status --short`, `git branch --show-current`, and `git rev-parse HEAD` in `/opt/Stellaris-PiAgent-Dev`; expect clean status, `refactor/pi-agent-runtime-server-20260813`, and `f242de8d45981c1b837a1db81a19a5a413f1f986` or its descendant.

- [ ] **Step 3: Verify Step 2A doctor**

Run `corepack pnpm agent:runtime:doctor`; expect Pi `0.84.1`, skill `3.1.0`, schema count `34`, model `NOT_CONFIGURED`, coding tools `[]`, and `FOUNDATION_READY`.

### Task 2: Create agent-tools package and shared contracts

**Files:**
- Create: `packages/agent-tools/package.json`, `packages/agent-tools/tsconfig.json`, `packages/agent-tools/vitest.config.ts`.
- Create: `packages/agent-tools/src/contracts/tool-types.ts`, `packages/agent-tools/src/contracts/tool-failure-codes.ts`, `packages/agent-tools/src/telemetry/tool-event-sink.ts`, `packages/agent-tools/src/index.ts`.
- Create: `packages/contracts/src/agent-role.ts`; modify `packages/contracts/src/index.ts`, `packages/agent-runtime/src/model/model-types.ts`, and `packages/agent-runtime/package.json`.
- Test: `packages/agent-tools/src/contracts/tool-types.test.ts`.

- [ ] **Step 1: Write the failing contract test**

Define a test that imports `AgentRole`, `ToolFailureCode`, `ToolResult`, and `MemoryToolEventSink`, asserts the four roles, stable failure literals, and event arrays. Run `corepack pnpm --filter @stellaris/agent-tools test`; expect module-not-found failures before implementation.

- [ ] **Step 2: Implement minimal shared contracts**

Move/re-export `AGENT_ROLES`, `AgentRole`, and `isAgentRole` from contracts while retaining the runtime import path. Define TypeBox-backed `AgentToolDefinition`, `ToolInvocationContext`, `ToolResult`, `ToolFailure`, `ToolStatus`, and all required failure codes. Define `ToolEventSink`, `NoopToolEventSink`, and `MemoryToolEventSink`; events carry callId, toolName, context, timestamps and terminal payload.

- [ ] **Step 3: Run the contract test**

Run the focused Vitest file and expect PASS, then run `corepack pnpm --filter @stellaris/agent-tools typecheck`.

### Task 3: Implement ToolRegistry

**Files:**
- Create: `packages/agent-tools/src/registry/tool-registry.ts`, `packages/agent-tools/src/registry/tool-registry.test.ts`.

- [ ] **Step 1: Write and run RED tests**

Cover unique registration, duplicate-name failure, existing lookup, canonical unknown-tool failure, and deterministic sorted `list()`. Run the focused file and verify failure due to missing registry.

- [ ] **Step 2: Implement minimal registry**

Store definitions in a `Map`, reject duplicate names with an explicit registration error, return canonical `UNKNOWN_TOOL` for absent lookup, return sorted definitions from `list()`, and expose `get`, `has`, and `register`.

- [ ] **Step 3: Run GREEN and refactor checks**

Run the focused file and package typecheck; keep all tests green.

### Task 4: Implement ToolGateway and ToolEventSink abstraction

**Files:**
- Create: `packages/agent-tools/src/gateway/tool-gateway.ts`, `packages/agent-tools/src/gateway/tool-gateway.test.ts`.
- Modify: `packages/agent-tools/src/index.ts`.

- [ ] **Step 1: Write and run RED tests**

Use a TypeBox input schema and an in-memory tool to cover success, invalid input without execution, unknown tool, pre-aborted signal, unexpected exception, and exact start/success, start/failure, and start/cancel event counts. Verify the focused file fails before Gateway implementation.

- [ ] **Step 2: Implement the Gateway**

Generate a UUID callId, reject unknown tools as `FAILED/UNKNOWN_TOOL`, validate input before execution as `FAILED/INVALID_INPUT`, check `signal.aborted` before execution as `CANCELLED/ABORTED`, emit exactly one start and one terminal event, await execution, normalize thrown errors to `INTERNAL_ERROR`, and preserve `startedAt`/`finishedAt` in every `ToolResult`.

- [ ] **Step 3: Run GREEN and package tests**

Run the focused Gateway test, then `corepack pnpm --filter @stellaris/agent-tools test` and typecheck.

### Task 5: Implement get_region_context

**Files:**
- Create: `packages/agent-tools/src/tools/region/get-region-context.ts`, `packages/agent-tools/src/tools/region/get-region-context.test.ts`.
- Modify: `packages/agent-tools/src/index.ts`.

- [ ] **Step 1: Write and run RED region tests**

Use existing real codes from `@stellaris/contracts` to test province `340000`, city `340100`, county `340102`, parent and ancestor chains, and an unknown code. Run focused tests and verify failure before implementation.

- [ ] **Step 2: Implement the local read-only tool**

Use only `listRegions()` and `parentCode` traversal. Input is exactly `{ regionCode: string }`; output includes `regionCode`, `name`, `level`, `parent`, and ordered `ancestors`. Return `REGION_NOT_FOUND` for absent codes and never add municipality-specific branches or network calls.

- [ ] **Step 3: Register and verify**

Export `getRegionContextTool`, register it in the standard registry factory, run focused tests, package tests, and typecheck.

### Task 6: Implement Pi custom tool adapter

**Files:**
- Create: `packages/agent-runtime/src/session/pi-tool-adapter.ts`, `packages/agent-runtime/src/session/pi-tool-adapter.test.ts`.
- Modify: `packages/agent-runtime/package.json`, `packages/agent-runtime/src/session/tool-policy.ts`, `packages/agent-runtime/src/index.ts`.

- [ ] **Step 1: Write and run RED adapter/security tests**

Assert name and TypeBox parameters preservation, execution forwarding through `ToolGateway`, `resolveProductionCustomTools()` containing only `get_region_context`, and absence of `read`, `bash`, `edit`, and `write`; run focused tests and verify missing adapter failures.

- [ ] **Step 2: Implement runtime-only conversion**

Import Pi `ToolDefinition` types only in runtime. Convert generic schema to Pi `parameters`, invoke the Gateway with a supplied context factory, and return Pi-compatible text/JSON result content. Keep `resolveProductionTools()` empty and expose custom tools separately.

- [ ] **Step 3: Run GREEN and runtime tests**

Run adapter tests and the existing agent-runtime Vitest suite; verify coding tools remain disabled.

### Task 7: Extend runtime doctor

**Files:**
- Modify: `packages/agent-runtime/src/doctor/runtime-doctor.ts`, `packages/agent-runtime/src/doctor/runtime-doctor.test.ts`.

- [ ] **Step 1: Add failing doctor assertions**

Assert `tool_gateway.status === OK`, `registered_tools === 1`, `get_region_context` is present, coding tools remain disabled, and runtime remains `FOUNDATION_READY`; run the doctor test and observe failure.

- [ ] **Step 2: Implement doctor wiring and output**

Construct the standard registry, report its sorted names/count, include the tool gateway status in the ready predicate, and preserve model `NOT_CONFIGURED` acceptance and secret-free output.

- [ ] **Step 3: Run GREEN doctor tests**

Run the focused doctor test and `corepack pnpm agent:runtime:doctor`; expect the new tool block and `FOUNDATION_READY`.

### Task 8: Full regression verification and documentation

**Files:**
- Create: `docs/agent-runtime/agent-tool-gateway-foundation.md`.
- Modify: package lock and relevant package exports only as required by the implementation.

- [ ] **Step 1: Document the frozen architecture**

Record dependency direction, invocation context, result/failure envelopes, registry, gateway provenance events, region source reuse, Pi adapter/security boundary, and future-only tool names `search_web`, `fetch_page`, `render_page`, `inspect_page`, `get_site_profile`, and `get_existing_evidence`.

- [ ] **Step 2: Run fresh verification**

After re-sourcing Node 24.19.0, run `corepack pnpm --filter @stellaris/agent-tools test`, `corepack pnpm --filter @stellaris/agent-runtime test`, `corepack pnpm -r typecheck`, `corepack pnpm build`, `corepack pnpm agent:runtime:doctor`, and the Step 2A baseline tests. No network, browser, LLM, database migration, Graphile, crawler, or production deployment commands are allowed.
