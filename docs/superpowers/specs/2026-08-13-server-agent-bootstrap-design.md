# Server Agent Bootstrap Design

## Goal

Establish a clean, isolated, server-native development baseline for the Stellaris Pi Agent refactor and pin the `official-biography-evidence` Skill without changing production business behavior.

## Server-first Development

All refactor development, dependency installation and verification run on the Tencent server in the dedicated development worktree.

## Production Isolation

The production repository remains the deployment baseline. Runtime containers, databases, volumes, Nginx and Compose configuration are read-only during this step.

## Worktree Strategy

Use sibling worktree `/opt/Stellaris-PiAgent-Dev`. Because the earlier `refactor/pi-agent-runtime` branch predates the latest production baseline, use `refactor/pi-agent-runtime-server-20260813` starting from the latest production Git baseline without resetting existing history.

## Skill Source

The sole source is the Git submodule `third-party/china-official-url-evidence-suite`, pinned to audited commit `40993e24109d26cb576b532223956053fcc4672f`.

## Skill Ownership

The submodule is read-only in this repository. `.pi/settings.json` references the canonical Skill path; no copied Skill is allowed.

## Server Environment Compatibility

Use the existing Node 24 NVM installation and project-managed pnpm through Corepack. Install with the frozen lockfile and do not upgrade Node, pnpm major, or the lockfile.

## Security Boundary

Do not persist SSH credentials or application secrets. Do not mutate production runtime state. Do not add model, provider, search, Pi SDK, Agent runtime, database, crawler or business workflow implementation.

## Baseline Verification

Verify the Skill identity and pin, run repository typecheck and pure unit tests, and confirm production Git and container identities remain unchanged throughout development work.

## Non-goals

Pi SDK, LLM configuration, Web Search, Agent runtime/controllers, Agent roles, Tool Gateway, crawler behavior, database migrations and production deployment are outside this step.

## Acceptance Criteria

The server Worktree is isolated and clean after commits; the canonical Skill is pinned and statically verified; Pi discovery and architecture constraints are present; baseline checks pass; production containers, database and volumes are unchanged.
