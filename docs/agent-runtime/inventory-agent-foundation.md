# Step 8 — Inventory Agent Foundation

Phase: Step 8 of the Stellaris Pi Agent refactor. First real business Agent —
the Inventory Agent — whose only formal output boundary is a structured
`submit_inventory` tool backed by Skill schema validation and an in-memory
Inventory Freeze.

## Purpose

Turn a Region + mode into a frozen institution inventory through Pi + the
`official-biography-evidence` Skill. TypeScript only verifies structure and
controls the workflow boundary; INCLUDE / EXCLUDE and institution-type rules
stay in Skill -> Pi.

## Architecture

```
Region (regionCode + mode) -> InventoryAgentRunner
  -> SkillSchemaRegistry validator + InMemoryInventorySubmissionSink
  -> inventory registry (base tools + submit_inventory) -> ToolGateway
  -> AgentSessionFactory (INVENTORY role) -> Pi session
  -> Role prompt (short, no SKILL.md copy)
  -> Pi: get_region_context / search_web / fetch_page / render_page / inspect_page
  -> Pi: submit_inventory (the ONLY formal output)
  -> Skill schema validation -> in-memory freeze -> InventoryAgentResult
```

## InventoryAgentRequest

`{ regionCode: string; mode: "FULL" | "TARGETED"; specifiedInstitutions?: string[] }`

- `FULL` — the Agent discovers the region inventory per the Skill.
- `TARGETED` — the Agent verifies and normalizes the specified institutions
  (still through the Skill; never trusted verbatim).
- No seed URL / search query is a business field. `--seed-url` exists only as a
  dev-smoke hint (`InventoryAgentRunnerDeps.devHints`).

## InventoryAgentRunner

`InventoryAgentRunner` owns the full wiring: it resolves the Skill, builds the
Skill-schema validator + in-memory sink, composes the inventory registry
(base 5 tools + `submit_inventory`), creates the INVENTORY Pi session via
`AgentSessionFactory`, runs the role prompt, and returns a result. Provider-
neutral: no DeepSeek import, no API key read, no model id written. A session
that never calls `submit_inventory` fails with `INVENTORY_NOT_SUBMITTED`.

## Inventory Role Tool Policy

`roleToolsFor("INVENTORY")` = the six tools only:

```
get_region_context search_web fetch_page render_page inspect_page submit_inventory
```

`read`/`bash`/`edit`/`write` stay disabled. `submit_inventory` is not granted
to any other role. The session allowlist is `roleToolsFor(role)` intersected
with the registry.

## submit_inventory

The output boundary tool (Pi-agnostic, in `agent-tools`). Input is an array of
records mirroring the canonical Skill schema (`institution-inventory.schema.json`,
title "Frozen Institution Inventory Record"). It validates against the Skill
schema (via `SkillSchemaRegistry` + ajv 2020), then stores the payload in the
sink. Exactly one submission per run: a second call fails with
`INVENTORY_ALREADY_SUBMITTED`.

## Skill Schema Validation

The canonical schema comes from the existing `SkillSchemaRegistry` (no second
loader). ajv (`ajv/dist/2020.js`) is only the validation engine. Failure codes:
`SCHEMA_VALIDATION_FAILED`, `INVENTORY_ALREADY_SUBMITTED`.

## InMemoryInventorySubmissionSink

`submit(payload)` / `getSubmission()` / `isFrozen()` only. The first accepted
submission is frozen; later submissions are rejected. This is a runtime freeze
boundary, not persistence.

## Runtime Freeze

`InventoryAgentResult` (COMPLETED) carries the frozen inventory, a
`InventoryFreezeReceipt` (`frozen`, `itemCount`, `payloadHash` — sha256 via
node:crypto), skill identity and model metadata, plus a per-tool call summary.

## Smoke Strategy

`agent:smoke:inventory --region-code <code> --institution <name> [--seed-url <url>]`
runs one real Pi + Skill TARGETED pass through the runner. A non-Anhui region is
used to prove independence from the old Anhui adapter.

FULL_DISCOVERY_REAL_SMOKE_DEFERRED — a real FULL regional inventory smoke is
deferred because the Bocha credential is currently pending (`BOCHA_API_KEY`).
`seed-url` is dev-smoke-only.

## Deferred

- real FULL inventory discovery smoke (needs Bocha credential)
- persistent inventory / Page Snapshot / DB
- institution work packets + Investigator Agent
- Leadership / PRIMARY / Reviewer logic
