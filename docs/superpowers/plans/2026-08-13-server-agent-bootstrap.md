# Server Agent Bootstrap Implementation Plan

**Goal:** Establish a clean, isolated, server-native development baseline for the Stellaris Pi Agent refactor and pin the official-biography-evidence Skill without changing production business behavior.

## Task 1: Server environment and production baseline verification

Audit OS, resources, toolchain, production Git state, Tencent Compose/Nginx files and current containers. Require a clean production worktree and latest frontend source.

## Task 2: Isolated server Git worktree

Detect existing Git isolation, compare the existing refactor branch with production HEAD, and create `/opt/Stellaris-PiAgent-Dev` on `refactor/pi-agent-runtime-server-20260813` without resetting history.

## Task 3: Skill submodule integration

Confirm the existing submodule URL and gitlink, initialize it at audited commit `40993e24109d26cb576b532223956053fcc4672f`, and verify all required Skill paths.

## Task 4: Pi Skill discovery configuration

Verify `.pi/settings.json` references only the canonical submodule Skill path and preserves any existing settings.

## Task 5: Repository architecture constraints

Preserve existing `AGENTS.md` content and append the approved Official Biography Agent Architecture constraints.

## Task 6: Static Skill verification

Require Skill name `official-biography-evidence`, version `3.1.0`, audited gitlink/checkout equality, required files/directories and a clean submodule. Expose it as `pnpm verify:official-skill`.

## Task 7: Baseline test verification

Use Node 24 and Corepack, install with `pnpm install --frozen-lockfile`, verify lockfile stability, run `pnpm verify:official-skill`, `pnpm -r typecheck`, pure package unit tests and build when safe. Do not run network canaries or production DB tests.

## Task 8: Bootstrap report and final review

Record the non-sensitive server baseline, review diffs for prohibited scope, commit Task-by-Task changes, rerun all completion commands, and confirm production Git/runtime identities are unchanged from the approved baseline.
