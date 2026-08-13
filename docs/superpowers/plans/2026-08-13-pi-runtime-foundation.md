# Pi Runtime Foundation Plan

Phase 2A of the Stellaris Pi Agent refactor: establish a model-neutral Pi runtime
foundation on the isolated server development worktree. No real LLM, no Search
API, no real Agent workflow.

## Task 1 — Verify server dev baseline

SSH to the Tencent server, re-verify OS/Node/pnpm/Python/Docker, resolve
toolchain drift (Node defaults to v20; use nvm 24.19.0; pnpm via Corepack),
and locate the Step 1 development worktree on `refactor/pi-agent-runtime-server-20260813`.

## Task 2 — Add Pi SDK dependency and agent-runtime package

Pin `@earendil-works/pi-coding-agent@0.84.1` (not `latest`) and create
`packages/agent-runtime` following the workspace package style.

## Task 3 — Implement model-neutral ModelPolicy

Define `AgentRole` (INVENTORY/INVESTIGATOR/RECOVERY/REVIEWER) and a
vendor-neutral, fail-closed `ModelPolicy.resolve(role)` returning
`MODEL_NOT_CONFIGURED` when no server-side model is configured.

## Task 4 — Implement SkillRuntime

Wrap Pi `DefaultResourceLoader`, discover the pinned skill via `.pi/settings.json`,
validate `skill.yaml` and `SKILL.md` identity, and return `SkillIdentity`.

## Task 5 — Implement SkillSchemaRegistry

Load and index `schemas/*.json` read-only, with duplicate-name and invalid-JSON
detection. Do not rewrite or redefine upstream schemas.

## Task 6 — Implement AgentSessionFactory boundary and tool policy

`createAgentSession(role)` fails closed with `MODEL_NOT_CONFIGURED`. Lock the
production tool policy to `tools: []` so Pi default coding tools never enter a
production session.

## Task 7 — Implement Runtime Doctor

Add `pnpm agent:runtime:doctor` reporting Pi SDK, Skill identity, schema registry,
model presence (NOT_CONFIGURED accepted) and coding-tool policy.

## Task 8 — Full verification and documentation

Run agent-runtime tests, `pnpm -r typecheck`, `pnpm build`, the doctor, and the
safe baseline checks. Write this plan and `docs/agent-runtime/pi-runtime-foundation.md`.
Verify the production worktree/containers are unchanged.
