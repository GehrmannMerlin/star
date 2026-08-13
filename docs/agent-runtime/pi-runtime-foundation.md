# Pi Runtime Foundation

Phase 2A — a model-neutral Pi runtime foundation. This phase calls no real LLM,
makes no Search API calls, and runs no real Agent workflow.

## Pi SDK

- Package: `@earendil-works/pi-coding-agent`
- Version: `0.84.1` (pinned exactly; `latest` is not used)
- Node engines: `>=22.19.0` (satisfied by the selected Node 24.19.0)
- Legacy package `@mariozechner/pi-coding-agent` is not used.

## Agent Runtime package

- Package: `@stellaris/agent-runtime`
- Path: `packages/agent-runtime`
- Layout: `src/{config,model,skill,session,doctor}` with a public barrel in `src/index.ts`.

## ModelPolicy contract

- `AgentRole`: `INVENTORY`, `INVESTIGATOR`, `RECOVERY`, `REVIEWER`.
- `ModelPolicy.resolve(role)` is vendor-neutral and fail-closed.
- No model configured → `MODEL_NOT_CONFIGURED`; it never auto-selects a provider.
- Providers are server-side only. Users cannot configure `provider`, `model`,
  `apiKey`, or `thinkingLevel` (enforced by the user task contract).

## SkillRuntime

- Wraps Pi `DefaultResourceLoader`; discovery is driven by `.pi/settings.json`.
- The Skill path is repo-relative; no hardcoded absolute paths.
- Reads `skill.yaml` (`id`, `version`) and `SKILL.md` frontmatter (`name`) and
  enforces `name === id`.
- Returns a structured `SkillIdentity`.

## SkillSchemaRegistry

- Loads `schemas/*.json` read-only; indexes by `title` (fallback filename stem).
- Detects duplicate logical names and invalid JSON.
- Does not rewrite the Skill validators or redefine the upstream schemas.

## AgentSessionFactory + Production Tool Policy

- `createAgentSession(role)` fails closed with `MODEL_NOT_CONFIGURED` (no model selected).
- Pi default coding tools (`read`, `bash`, `edit`, `write`) are disabled for
  production: explicit `tools: []`.
- Custom Agent tools are deferred to Step 3.

## Runtime Doctor

- Command: `pnpm agent:runtime:doctor` (root) → `@stellaris/agent-runtime runtime:doctor`.
- Reports Pi SDK import/version, Skill identity, resource-loader discovery,
  schema registry, model presence (`NOT_CONFIGURED` is accepted), and the
  production coding-tool policy.
- Runtime status: `FOUNDATION_READY`.

## Known deferred work

- LLM provider: intentionally undecided (resolved in Step 2B after model selection).
- Search provider: intentionally deferred (Generic Agent Tool Gateway phase).
- Real Agent workflow and generic tools (`search_web`, `fetch_page`, etc.): Step 3.

## Toolchain note

The active `node` on the server defaults to v20 via nvm; repository work uses
`nvm use 24.19.0`. `pnpm` is provided through Corepack (`corepack pnpm` = 10.34.5);
there is no system `pnpm` on PATH.
