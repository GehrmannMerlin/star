# Generic Agent Tool Gateway Foundation

## Scope

Step 3A establishes the only supported path for production Agent tool calls:

```text
Pi Agent
  -> Pi Tool Adapter (@stellaris/agent-runtime)
  -> Generic Agent Tool Gateway (@stellaris/agent-tools)
  -> read-only domain or crawler capability
```

This phase does not create an Agent session, select a model or provider, call an
LLM, use Web Search, request a government site, launch a browser, change
Graphile workers, change crawler behavior, or add database persistence.

## Dependency Direction

```text
@stellaris/contracts
        ^
@stellaris/agent-tools
        ^
@stellaris/agent-runtime
```

`@stellaris/agent-tools` is Pi-agnostic and never imports
`@stellaris/agent-runtime` or `@earendil-works/pi-coding-agent`.
`AgentRole` is a safe internal domain type in `@stellaris/contracts`; model
configuration remains private to the runtime. The existing `RegionNode` and
nationwide tree in `@stellaris/contracts` remain the only region source.

## Generic Tool Contract

`AgentToolDefinition` contains a stable name, description, TypeBox input
schema, and execute function. It receives a `ToolInvocationContext`:

```ts
type ToolInvocationContext = {
  taskRunId: string;
  agentSessionId: string;
  agentRole: AgentRole;
  packetId?: string;
  targetRegionCode?: string;
  signal: AbortSignal;
};
```

The context contains correlation and cancellation data only. It never contains
a model, provider, API key, or search-provider configuration.

## Result And Failure Contracts

Every Gateway result contains `callId`, `toolName`, `status`,
`startedAt`, and `finishedAt`. `SUCCESS` carries `data`; `FAILED` and
`CANCELLED` carry `failure: { code, message, retryable }`.

`ToolFailureCode` reserves:

- Local/runtime: `INVALID_INPUT`, `UNKNOWN_TOOL`, `ABORTED`, `TIMEOUT`,
  `INTERNAL_ERROR`, and `REGION_NOT_FOUND`.
- Future network tools: `DNS_ERROR`, `TLS_ERROR`, `HTTP_403`, `HTTP_412`,
  `WAF_BLOCKED`, `ACCESS_DENIED`, `STATIC_CONTENT_EMPTY`, and
  `DYNAMIC_RENDER_REQUIRED`.

No network failure is simulated in Step 3A.

## Registry And Gateway

`ToolRegistry` supports `register`, `get`, `getOrThrow`, `has`, and
deterministic `list`. Duplicate stable names fail closed and are never
overwritten. Unknown required lookups use `UNKNOWN_TOOL`.

`ToolGateway.execute(toolName, input, context)` is the execution boundary. It:

1. creates a unique call ID and emits start;
2. honors pre-existing cancellation;
3. resolves the registry entry;
4. validates input with TypeBox before executing;
5. passes the same `AbortSignal` to the tool;
6. normalizes success, expected tool failures, cancellation, and unexpected
   exceptions;
7. emits exactly one terminal success, failure, or cancellation event.

Unknown tools and invalid input still receive a call ID and complete event
pair. Both pre-execution and in-flight aborts return `CANCELLED/ABORTED`.

## Tool Event Sink

`ToolEventSink` defines `onStart`, `onSuccess`, `onFailure`, and
`onCancelled`. `NoopToolEventSink` is the first production implementation;
`MemoryToolEventSink` provides deterministic test assertions. Event handlers
may be asynchronous so a later PostgreSQL sink can be added without changing
the Gateway contract. Step 3A adds no table or migration.

## get_region_context

`get_region_context` accepts one fact:

```json
{ "regionCode": "340102" }
```

The six-digit code is resolved from the existing nationwide region tree. The
result contains the code, name, current `province | city | county` level,
direct parent, and root-to-parent ancestors. Unknown codes produce
`REGION_NOT_FOUND`. Town/street support, downloaded data, copied fixtures,
municipality-specific branches, and region-specific logic are intentionally
absent.

## Pi Adapter And Security Boundary

`@stellaris/agent-runtime` converts registered generic definitions to Pi
`ToolDefinition` values. The name and TypeBox schema are preserved, and
execution is always forwarded through `ToolGateway`. Production custom-tool
assembly registers only `get_region_context`.

Pi default coding tools remain disabled. The production coding-tool list is
still empty and custom assembly is tested to exclude `read`, `bash`,
`edit`, and `write`. No real model session is created and `prompt()` is
never called.

## Future Tools

Later phases may add `search_web`, `fetch_page`, `render_page`,
`inspect_page`, `get_site_profile`, and `get_existing_evidence` behind
the same Gateway. They are names only in this document and are not implemented
in Step 3A.
