# crawler-writing-plans-bridge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Before editing Skill content, also use `superpowers:writing-skills`. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build one project-local `crawler-writing-plans-bridge` Agent Skill that, as the planning bridge for the crawler knowledge base, receives only root causes with sufficient evidence and user-approved treatment directions, verifies root cause / approval status / required evidence completeness (refusing to enter planning when incomplete), organizes impact scope / technical constraints / prohibitions / verification criteria / rollback requirements, outputs a planning-input package for Superpowers `writing-plans`, and completes handoff only after the user again explicitly authorizes entering `writing-plans` — without re-diagnosing, choosing a fix direction, writing an implementation plan, or modifying code, and following the direct interface contract of Superpowers v6.2.0 (obra/superpowers Commit `3dcbd5c4…`).

**Architecture:** The Skill package under `skills/crawler-writing-plans-bridge/` contains the trigger, gates, routing, and prohibitions; `references/bridge-workflow.md` defines the verification flow, planning-input-package contract, Superpowers interface contract, and evidence-card mapping; `references/output-contract.md` defines the planning-input-package record contract, handoff, and revision preservation. Shared knowledge lives in `docs/superpowers/knowledge/evidence-cards/writing-plans-bridge.md` (evidence cards distilled from the batch-02 pinned obra/superpowers v6.2.0 repo) plus the Skill-19 view `docs/superpowers/knowledge/skill-views/crawler-writing-plans-bridge.md`. Behavioral scenarios under `tests/skills/crawler-writing-plans-bridge/` provide RED/GREEN verification per `superpowers:writing-skills`.

**Tech Stack:** Markdown, YAML front matter, read-only static review, Superpowers `writing-skills` behavioral testing. No runtime service, no validator script (per design §10).

## Global Constraints

- Implement only `crawler-writing-plans-bridge`; it is the 19th and final Skill, so there is no future Skill to design, plan, create, or edit.
- Treat `docs/superpowers/brainstorming/2026-07-31-crawler-knowledge-skills-decision-log.md` as the latest decision authority and `docs/superpowers/specs/2026-08-03-crawler-writing-plans-bridge-design.md` as this Skill's approved design contract.
- Keep the Skill a planning bridge: it receives only root causes with sufficient evidence and user-approved treatment directions (decision log §47).
- The Skill verifies root cause / approval status / required evidence completeness; refuses to enter planning when incomplete; organizes impact scope / technical constraints / prohibitions / verification criteria / rollback requirements; outputs a planning-input package for Superpowers `writing-plans`; completes handoff only after the user again explicitly authorizes entering `writing-plans` (decision log §47).
- Never re-diagnose, choose a fix direction, write an implementation plan, or modify code (decision log §47).
- The direct interface contract is Superpowers v6.2.0 (obra/superpowers Commit `3dcbd5c4b48e02263fbf4a3c01e3fe4f81d584d9`); other planning frameworks must not override that contract or the user-approval gate (decision log §68).
- The acceptance emphasis is intercepting unconfirmed guesses and completely preserving root-cause evidence, user-approval boundaries, verification requirements, and rollback requirements (decision log §47).
- Never misrepresent an external condition or unknown as already fixed; never propose bypassing login, CAPTCHA, access control, or WAF (decision log §12).
- Never install, build, or run unapproved project or third-party code; never store secrets/cookies/auth headers/proxy credentials/environment-variable secrets/database connection-string credentials.
- Knowledge is distilled from the pinned batch-02 repo (obra/superpowers v6.2.0) listed in `third-party/crawler-knowledge-sources/manifest.md`, using evidence cards in the shared layer (design §7, decision log §77).
- `E:\Stellaris` is currently not a Git repository. Do not initialize Git. At each commit checkpoint, commit only if the user has separately established or authorized a repository; otherwise update the local progress ledger and plan checkboxes.
- Concrete execution belongs to Claude Code. Codex does not execute this plan in the current planning session.

---

## File Structure

**Create:**

- `skills/crawler-writing-plans-bridge/SKILL.md` — compact trigger, gates, routing, output contract, and prohibitions.
- `skills/crawler-writing-plans-bridge/references/bridge-workflow.md` — verification flow, planning-input-package contract, Superpowers interface contract, evidence-card mapping.
- `skills/crawler-writing-plans-bridge/references/output-contract.md` — planning-input-package record contract, handoff, revision preservation.
- `docs/superpowers/knowledge/evidence-cards/writing-plans-bridge.md` — shared evidence cards distilled from the batch-02 pinned obra/superpowers repo.
- `docs/superpowers/knowledge/skill-views/crawler-writing-plans-bridge.md` — Skill-19 view referencing the evidence cards.
- `tests/skills/crawler-writing-plans-bridge/cases.md` — behavioral and safety scenarios.
- `tests/skills/crawler-writing-plans-bridge/results.md` — red/green behavioral evaluation record produced during execution.

**Modify:**

- `docs/superpowers/progress/crawler-knowledge-skills-progress.md` — execution and verification checkpoints for this Skill only.
- `docs/superpowers/brainstorming/2026-07-31-crawler-knowledge-skills-decision-log.md` — append only newly user-approved cross-Skill decisions; do not copy routine execution detail.

**Do not modify:**

- `third-party/crawler-knowledge-sources/manifest.md` unless the user separately approves a real source update.
- Any of the 41 fixed third-party repositories.
- Any existing file under `docs/superpowers/knowledge/` or `skills/crawler-curate-sources/` / `skills/stellaris-crawler-context/` / `skills/crawler-triage-incidents/` / `skills/crawler-review-architecture/` / `skills/crawler-discover-frontier/` / `skills/crawler-debug-http-network/` / `skills/crawler-automate-browsers/` / `skills/crawler-validate-extraction/` / `skills/crawler-tune-queues/` / `skills/crawler-manage-evidence-storage/` / `skills/crawler-observe-runtime/` / `skills/crawler-enforce-security/` / `skills/crawler-test-regressions/` / `skills/crawler-debug-typescript-node/` / `skills/crawler-use-crawlee/` / `skills/crawler-use-playwright/` / `skills/crawler-run-docker/` / `skills/crawler-use-postgresql/`.

---

### Task 1: Add Behavioral Cases and Execution Start

**Files:**

- Create: `tests/skills/crawler-writing-plans-bridge/cases.md`
- Modify: `docs/superpowers/progress/crawler-knowledge-skills-progress.md`

**Interfaces:**

- Consumes: project root layout, approved design `2026-08-03-crawler-writing-plans-bridge-design.md`.
- Produces: a stable set of behavioral cases used by Task 6; ledger state set to `Claude Code 执行中`.

- [x] **Step 1: Mark execution start in the local ledger**

Change only `crawler-writing-plans-bridge` from `计划待审` to `Claude Code 执行中`. Add the execution timestamp and role `Claude Code`. If the ledger still shows `规划中` for this Skill or the spec was not user-approved, stop and request spec/plan approval before executing.

- [x] **Step 2: Create eight explicit behavioral cases**

Create `tests/skills/crawler-writing-plans-bridge/cases.md` with these cases and exact expected decisions:

1. `WB-01 verified-input-only` — receive only root causes with sufficient evidence and user-approved treatment directions; refuse unconfirmed guesses; never accept a root cause that lacks sufficient evidence or approval.
2. `WB-02 refuse-incomplete` — when root cause / approval status / required evidence is incomplete, refuse to enter planning and list the missing items; do not proceed to the planning-input package.
3. `WB-03 intercept-unconfirmed-guess` — intercept unconfirmed guesses; never let them enter the planning-input package.
4. `WB-04 planning-package-contract` — organize impact scope / technical constraints / prohibitions / verification criteria / rollback requirements / root-cause evidence / approval boundary into the planning-input package; keep every item traceable.
5. `WB-05 superpowers-contract` — follow the Superpowers v6.2.0 writing-plans interface contract (Plan Document Header, No Placeholders, Task Right-Sizing, Execution Handoff, REQUIRED SUB-SKILL); do not use other planning frameworks or latest/historical-draft assumptions.
6. `WB-06 approval-gate-before-handoff` — complete handoff only after the user again explicitly authorizes entering `writing-plans`; before authorization, the conclusion stays at the planning-input package.
7. `WB-07 no-re-diagnosis` — never re-diagnose, choose a fix direction, write an implementation plan, or modify code; route root-cause analysis back to the diagnosing Skill.
8. `WB-08 no-destructive-operation` — never perform destructive operations (data modification, Schema changes, fix migrations) without separate explicit approval; never start a PostgreSQL service or run data modification as part of the bridge.

Each case must contain `Input`, `Expected classification`, `Required evidence`, `Forbidden behavior`, and `Pass criteria` subsections.

- [x] **Step 3: Verify cases are unique and complete**

Run a check that extracts all headings matching `^## WB-` from `cases.md`. Expected: exactly 8 unique IDs, each followed by the five required subsections.

- [x] **Step 4: Save the checkpoint without initializing Git**

Run `git -C E:\Stellaris rev-parse --is-inside-work-tree`. Current expected result is failure because the project is not a Git repository. Do not run `git init`; record Task 1 completion in the progress ledger. If a user-authorized repository exists at execution time, commit only Task 1 files with message `test: define crawler writing-plans-bridge behavior cases`.

---

### Task 2: Build the Writing-Plans-Bridge Evidence Cards (Shared Layer)

**Files:**

- Create: `docs/superpowers/knowledge/evidence-cards/writing-plans-bridge.md`
- Modify: `docs/superpowers/progress/crawler-knowledge-skills-progress.md`

**Interfaces:**

- Consumes: manifest batch-02 pinned repo (obra/superpowers v6.2.0), approved design §7.
- Produces: shared evidence cards (IDs `WB-*`) referenced by the Skill-19 view (Task 3) and the bridge workflow (Task 4).

- [x] **Step 1: Distill the handoff-admission/approval-gate cards**

Under a `## 交接准入与批准门` heading, create evidence cards distilled from:
- `obra/superpowers` v6.2.0 `skills/writing-plans/SKILL.md` (Scope Check, Self-Review); decision log §47/§68.

At least 3 cards (e.g. `WB-ADMIT-001` verified-input-only, `WB-ADMIT-002` refuse-incomplete, `WB-ADMIT-003` intercept-unconfirmed-guess). Each card contains the full field contract from the knowledge-design spec §5.2 (stable ID, single claim, evidence type/grade, source identity, version/ref/commit, original location, support note, applicability, limits, associated Skill, status).

- [x] **Step 2: Distill the planning-input-package cards**

Under a `## 规划输入包内容` heading, create evidence cards distilled from:
- `obra/superpowers` v6.2.0 `skills/writing-plans/SKILL.md` (Plan Document Header, Global Constraints, Task Structure); decision log §47.

At least 3 cards (e.g. `WB-PKG-001` impact-scope/constraints, `WB-PKG-002` prohibitions/verification/rollback, `WB-PKG-003` root-cause-evidence/approval-boundary). Same field contract.

- [x] **Step 3: Distill the Superpowers-interface-contract cards**

Under a `## Superpowers writing-plans 接口契约` heading, create evidence cards distilled from:
- `obra/superpowers` v6.2.0 `skills/writing-plans/SKILL.md` (Plan Document Header, No Placeholders, Task Right-Sizing, Execution Handoff, REQUIRED SUB-SKILL).

At least 2 cards (e.g. `WB-IF-001` plan-document-header/no-placeholders, `WB-IF-002` task-right-sizing/execution-handoff). Same field contract.

- [x] **Step 4: Distill the acceptance/anti-guess cards**

Under a `## 验收与防猜测` heading, create evidence cards distilled from:
- `obra/superpowers` v6.2.0 `skills/writing-plans/plan-document-reviewer-prompt.md` (Completeness/Spec Alignment/Task Decomposition/Buildability); decision log §47 acceptance emphasis.

At least 2 cards (e.g. `WB-ACC-001` four-dimension review, `WB-ACC-002` intercept-unconfirmed-guess). Same field contract.

- [x] **Step 5: Verify evidence-card uniqueness and field completeness**

Run a check that every card ID in `writing-plans-bridge.md` is unique and each card contains all required fields from the knowledge-design spec §5.2 (ID, claim, evidence type/grade, source identity, version/ref/commit, original location, support note, applicability, limits, associated Skill, status). Verify the local evidence paths (pinned repo files) exist via `Test-Path`. Record counts per group.

- [x] **Step 6: Save the checkpoint**

Record the evidence-card path and group counts in the ledger. If Git is user-authorized, commit with `docs: add crawler writing-plans-bridge evidence cards`; otherwise record the local checkpoint only.

---

### Task 3: Build the Skill-19 Knowledge View

**Files:**

- Create: `docs/superpowers/knowledge/skill-views/crawler-writing-plans-bridge.md`
- Modify: `docs/superpowers/progress/crawler-knowledge-skills-progress.md`

**Interfaces:**

- Consumes: `evidence-cards/writing-plans-bridge.md` (Task 2), approved design §1-10, decision log §47/§68.
- Produces: the Skill-19 view consumed by SKILL.md and the bridge workflow (Task 4), referencing evidence cards by ID.

- [x] **Step 1: Create the view header and scope**

Under a `# crawler-writing-plans-bridge 知识视图` heading, state the Skill's positioning (planning bridge receiving only verified, user-approved directions), trigger, and explicit exclusions (re-diagnosis, fix-direction choice, implementation-plan writing, code modification) — without copying full repo content.

- [x] **Step 2: Add the knowledge topics and judgment rules**

Add sections for: 交接准入与批准门、规划输入包内容、Superpowers writing-plans 接口契约、验收与防猜测 — each referencing the relevant evidence-card IDs from Task 2 (`WB-ADMIT-*`, `WB-PKG-*`, `WB-IF-*`, `WB-ACC-*`), plus versioned judgment rules tied to the pinned batch-02 obra/superpowers v6.2.0 repo. Emphasize intercepting unconfirmed guesses and completely preserving root-cause evidence, approval boundaries, verification requirements, and rollback requirements.

- [x] **Step 3: Add evidence-insufficiency / conflict / external-condition handling**

Require: mark unresolved claims as uncertain when evidence is insufficient; keep evidence conflicts visible; never silently overwrite a fixed-version card or previous record; never let an unknown or unconfirmed guess be misjudged as a confirmed/fixed root cause; never let an external condition be misjudged as fixed.

- [x] **Step 4: Add output / handoff / exclusions / self-check**

Require: the view's output is a traceable planning-input package (impact scope, technical constraints, prohibitions, verification criteria, rollback requirements, root-cause evidence, approval boundary); after the user again explicitly authorizes entering `writing-plans`, complete handoff to Superpowers `writing-plans`; exclude re-diagnosis, fix-direction choice, implementation-plan writing, and code modification; add a view self-check (all evidence-card IDs referenced exist, no unlabeled inference).

- [x] **Step 5: Verify the view references all evidence cards**

Run a check that every card ID from `writing-plans-bridge.md` is referenced by `crawler-writing-plans-bridge.md`. Expected: full coverage (e.g. 10/10 or the actual count from Task 2).

- [x] **Step 6: Save the checkpoint**

Record the view path and coverage count in the ledger. If Git is user-authorized, commit with `docs: add crawler writing-plans-bridge knowledge view`; otherwise record the local checkpoint only.

---

### Task 4: Build the Bridge-Workflow Reference

**Files:**

- Create: `skills/crawler-writing-plans-bridge/references/bridge-workflow.md`
- Modify: `docs/superpowers/progress/crawler-knowledge-skills-progress.md`

**Interfaces:**

- Consumes: decision log §47/§68/§51/§77, approved design §5-7, evidence cards `writing-plans-bridge.md`, Skill-19 view.
- Produces: the verification flow, planning-input-package contract, Superpowers interface contract, and evidence-card mapping consumed by SKILL.md and Task 5.

- [x] **Step 1: Define the verification flow**

Under a `## 核验流程` heading, specify the ordered flow (design §5):
1. Read project context, goal, constraints, and confirmed root cause.
2. Verify root cause, approval status, and required evidence completeness (root cause with sufficient evidence; user explicit approval of root cause and direction; required evidence traceable to pinned-version materials, evidence cards, context-package entries, or decision-log sections).
3. When incomplete, refuse to enter planning and list missing items; the conclusion stays at the verification record.
4. When complete, organize impact scope, technical constraints, prohibitions, verification criteria, and rollback requirements.
5. Output a planning-input package for Superpowers `writing-plans` (following the Superpowers v6.2.0 writing-plans contract).
6. Present the planning-input package and wait for the user to again explicitly authorize entering `writing-plans`; complete handoff only after authorization.

- [x] **Step 2: Define the planning-input-package contract**

Under a `## 规划输入包契约` heading, specify the seven fields (design §6): impact scope, technical constraints, prohibitions, verification criteria, rollback requirements, root-cause evidence, approval boundary. Require every conclusion to distinguish fact / evidence / inference / to-confirm, and require unconfirmed guesses to be intercepted.

- [x] **Step 3: Define the Superpowers interface contract**

Under a `## Superpowers 接口契约` heading, require: follow Superpowers v6.2.0 writing-plans (Plan Document Header, Global Constraints, Task Structure, No Placeholders, Task Right-Sizing, Self-Review, Execution Handoff, REQUIRED SUB-SKILL); never use other planning frameworks or latest/historical-draft assumptions; the planning-input package is input to `writing-plans`, not a substitute for its planning responsibility.

- [x] **Step 4: Define the evidence-card mapping**

Under a `## 证据卡映射` heading, map each verification focus to the relevant card groups from Task 2 (`WB-ADMIT-*` for handoff admission/approval gate, `WB-PKG-*` for planning-input-package content, `WB-IF-*` for Superpowers interface contract, `WB-ACC-*` for acceptance/anti-guess), plus the pinned repo paths for each.

- [x] **Step 5: Define evidence and conflict handling**

Under `证据不足与冲突`, require: mark unresolved claims as uncertain when evidence is insufficient; keep evidence conflicts visible; never silently overwrite a fixed-version card or a previous record; never let an unknown or unconfirmed guess be misjudged as a confirmed root cause; never let an external condition be misjudged as fixed.

- [x] **Step 6: Save the checkpoint**

Record the reference path, workflow, planning-input-package contract, Superpowers interface contract, and evidence-card mapping in the ledger. If Git is user-authorized, commit with `docs: add crawler writing-plans-bridge workflow reference`; otherwise record the local checkpoint only.

---

### Task 5: Build the Output-Contract Reference

**Files:**

- Create: `skills/crawler-writing-plans-bridge/references/output-contract.md`
- Modify: `docs/superpowers/progress/crawler-knowledge-skills-progress.md`

**Interfaces:**

- Consumes: decision log §33-36/§47/§68, approved design §8-9.
- Produces: the planning-input-package record contract, handoff, and revision rules consumed by SKILL.md.

- [x] **Step 1: Define the planning-input-package record contract**

Under a `## 规划输入包输出契约` heading, specify the required fields (design §8):
- 影响范围。
- 技术约束。
- 禁止事项。
- 验证标准。
- 回滚要求。
- 根因依据（证据卡 ID、固定资料路径、上下文包条目、决策日志节号）。
- 批准边界（根因和方向的用户批准记录；进入 `writing-plans` 的用户再次明确授权状态）。

Require that each record be traceable from the record to its evidence locations or context-package entries, and that the record distinguish fact / evidence / inference / to-confirm / approval status.

- [x] **Step 2: Define the handoff contract**

Under a `## 交接契约` heading, specify:
- Only after the user again explicitly authorizes entering `writing-plans`, complete the handoff (decision log §47).
- The planning-input package goes to Superpowers `writing-plans` as input, not replacing its planning responsibility; never write an implementation-plan document.
- Never re-diagnose, choose a fix direction, or modify code (decision log §47).
- Completely preserve root-cause evidence, user-approval boundaries, verification requirements, and rollback requirements (decision log §47).
- Handoff follows decision log §33-36: structured on-disk record + short human summary; two-tier storage; redact secrets/cookies/auth headers/proxy credentials/environment-variable secrets/database connection-string credentials before writing.
- When handling a Stellaris problem, read the `stellaris-crawler-context` context package path before processing.

- [x] **Step 3: Define revision preservation**

Under a `## 修订保留` heading, require: every new planning-input-package record is a new revision appended or an explicit revision record pointing to the superseded version; never silently overwrite an existing record; keep the prior version readable for audit.

- [x] **Step 4: Save the checkpoint**

Record the output-contract path and coverage in the ledger. If Git is user-authorized, commit with `docs: add crawler writing-plans-bridge output contract`; otherwise record the local checkpoint only.

---

### Task 6: Implement the Project-Local Skill Package

**Files:**

- Create: `skills/crawler-writing-plans-bridge/SKILL.md`
- Test: `tests/skills/crawler-writing-plans-bridge/cases.md`
- Modify: `docs/superpowers/progress/crawler-knowledge-skills-progress.md`

**Interfaces:**

- Consumes: the two references, evidence cards, Skill-19 view, main decision log, approved design, `stellaris-crawler-context` context package.
- Produces: the runnable Skill entry that routes to the references and enforces gates/prohibitions.

- [x] **Step 1: Create `SKILL.md` front matter and trigger**

Use this front matter exactly, with the description kept on one line:

```markdown
---
name: crawler-writing-plans-bridge
description: Use when an Agent must bridge a crawler project's approved fix direction into Superpowers writing-plans planning — verifying root cause, approval status, and required evidence completeness (refusing to enter planning when incomplete), organizing impact scope / technical constraints / prohibitions / verification criteria / rollback requirements, and outputting a planning-input package for Superpowers writing-plans (v6.2.0 contract, obra/superpowers 3dcbd5c4) — completing handoff only after the user again explicitly authorizes entering writing-plans, without re-diagnosing, choosing a fix direction, writing an implementation plan, or modifying code.
---
```

The opening must state that this is a planning bridge, not a diagnosing Skill, a fix-direction chooser, a plan writer, a memory, a RAG, an index service, a context framework, or a runtime crawler component.

- [x] **Step 2: Add compact routing and non-negotiable gates**

`SKILL.md` must route detailed work to the two reference files and the knowledge view. It must contain these gates:

1. Identify that this is a planning-bridge task needing root-cause/approval/evidence verification.
2. For Stellaris problems, read the `stellaris-crawler-context` project-context package path before processing (decision log §38).
3. Verify root cause, approval status, and required evidence completeness; when incomplete, refuse to enter planning and list the missing items.
4. Classify against matching-version evidence cards (`writing-plans-bridge.md`) and the Superpowers v6.2.0 contract (obra/superpowers Commit `3dcbd5c4…`); never fabricate a root cause from insufficient evidence; intercept unconfirmed guesses.
5. For external conditions (database service unavailable, constrained dependency service), give a compliant degrade/wait/stop conclusion; never claim it as fixed.
6. Present the planning-input package and wait for the user to again explicitly authorize entering `writing-plans`; before authorization, do not complete the handoff.
7. Never re-diagnose, choose a fix direction, write an implementation plan, or modify code; never perform destructive operations (data modification, Schema changes, fix migrations) without separate explicit approval; never start a PostgreSQL service or run data modification; never store secrets/cookies/auth headers/proxy credentials/database connection-string credentials.
8. Emit traceable outputs and update local progress before continuing.

Keep `SKILL.md` concise; place field-level detail in references rather than repeating it.

- [x] **Step 3: Verify required tokens in `SKILL.md`**

Run a check that `SKILL.md` contains these tokens: `crawler-writing-plans-bridge`, `Superpowers`, `writing-plans`, `v6.2.0`, `核验`, `批准`, `根因`, `影响范围`, `验证`, `回滚`, `绝不`, `主决策日志`, `bridge-workflow`, `output-contract`, `writing-plans-bridge`. Expected: all present.

- [x] **Step 4: Save the checkpoint**

Record the Skill package path, routing, and gate coverage in the ledger. If Git is user-authorized, commit with `feat: add crawler writing-plans-bridge skill`; otherwise record the local checkpoint only and do not initialize Git.

---

### Task 7: Run Red/Green Behavioral and Safety Evaluation

**Files:**

- Read: `tests/skills/crawler-writing-plans-bridge/cases.md`
- Create: `tests/skills/crawler-writing-plans-bridge/results.md`
- Modify if required: `skills/crawler-writing-plans-bridge/SKILL.md`
- Modify if required: `skills/crawler-writing-plans-bridge/references/bridge-workflow.md`
- Modify if required: `skills/crawler-writing-plans-bridge/references/output-contract.md`
- Modify: `docs/superpowers/progress/crawler-knowledge-skills-progress.md`

**Interfaces:**

- Consumes: eight frozen cases and the completed Skill package.
- Produces: auditable baseline/Skill-assisted results with no safety or boundary failures.

- [x] **Step 1: Use the required Skill-testing process**

Claude Code must load `superpowers:writing-skills` and follow its behavioral testing method. Use fresh Agent contexts so a case does not inherit another case's answers.

- [x] **Step 2: Record the red baseline**

For each `WB-01` through `WB-08`, run the case without loading `crawler-writing-plans-bridge`. Record whether the baseline omits verified-input-only discipline, refuse-incomplete discipline, intercept-unconfirmed-guess discipline, planning-package contract discipline, Superpowers-contract discipline, approval-gate discipline, no-re-diagnosis discipline, or no-destructive-operation discipline. Do not fabricate a failure when the baseline happens to comply; record observed behavior.

- [x] **Step 3: Record the green Skill-assisted run**

Run every case with `crawler-writing-plans-bridge` loaded. For each case, record input, output summary, required evidence references, forbidden-behavior check and pass/fail. Expected: all eight pass; `WB-01`, `WB-02`, `WB-03`, `WB-06`, `WB-07` must stop the prohibited action rather than merely warn.

- [x] **Step 4: Fix only demonstrated gaps**

If a case fails, identify the missing or ambiguous instruction, make the smallest change in the responsible file, rerun that case, and then rerun all eight. Do not expand the Skill into deep diagnosis, legal advice, runtime scanning, destructive operations, or source execution.

- [x] **Step 5: Verify behavioral results**

`results.md` must contain one baseline and one Skill-assisted result for all eight case IDs, an overall count, and a statement that no third-party repository program was executed. Expected final count: `8 PASS, 0 FAIL`.

- [x] **Step 6: Save the checkpoint**

Record behavioral count and any corrected files in the ledger. If Git is user-authorized, commit with `test: verify crawler writing-plans-bridge behavior`; otherwise record the local checkpoint only.

---

### Task 8: Final Verification, Handoff, and Persistent Progress

**Files:**

- Verify: all files listed in this plan
- Modify: `docs/superpowers/progress/crawler-knowledge-skills-progress.md`
- Modify only after user approval: `docs/superpowers/brainstorming/2026-07-31-crawler-knowledge-skills-decision-log.md`

**Interfaces:**

- Consumes: behavioral results, approved design, fixed source manifest.
- Produces: a Claude Code implementation handoff ready for user verification. This is the 19th and final Skill; no work on any future Skill.

- [x] **Step 1: Run fresh structural verification**

Run a static check that all required files exist: `skills/crawler-writing-plans-bridge/SKILL.md`, `skills/crawler-writing-plans-bridge/references/bridge-workflow.md`, `skills/crawler-writing-plans-bridge/references/output-contract.md`, `docs/superpowers/knowledge/evidence-cards/writing-plans-bridge.md`, `docs/superpowers/knowledge/skill-views/crawler-writing-plans-bridge.md`, `tests/skills/crawler-writing-plans-bridge/cases.md`, `tests/skills/crawler-writing-plans-bridge/results.md`. Expected: all present. Also verify cases `^## WB-` count = 8 and results `^## WB-` count = 8.

- [x] **Step 2: Scan implementation artifacts for placeholders and scope leaks**

Run `Select-String` over the Skill package, references, evidence cards, view, and results for placeholder terms and for affirmative instructions to install, build, run, scan, start proxies, perform destructive operations, start a PostgreSQL service, or crawl targets. Negative safety statements are allowed; any affirmative runtime instruction is a failure. Expected: zero placeholders and zero affirmative runtime instructions. Also scan for secret-like tokens (api key, password, token, cookie, Bearer, database connection-string credentials, OTEL_EXPORTER_OTLP headers) — only negative redaction statements allowed.

- [x] **Step 3: Reconcile evidence and behavior coverage**

Confirm the verification flow and planning-input-package contract match design §5-6; the evidence-card grouping matches design §7; the output contract matches design §8; the handoff contract matches design §9 and decision log §33-36; all eight behavioral cases pass; no mention of any future Skill as implementation work; `stellaris-crawler-context` context-package reading is explicit for Stellaris problems. Expected: no missing or duplicate item.

- [x] **Step 4: Update the ledger to `待验证`**

Record all created/modified paths, verification commands and outputs, behavioral count, remaining blockers, and the next action: user or independent reviewer verifies the Claude Code output. Do not mark `已完成` before that verification.

- [x] **Step 5: Handle failure, conflict, and rollback explicitly**

If final verification fails, do not publish the Skill as usable and do not modify the fixed manifest or any third-party repository. Keep the failing artifacts for diagnosis, change only this Skill's ledger status to `已阻塞`, and record the exact failing command, files, evidence IDs and last passing checkpoint. If a user-authorized Git repository exists, restore a prior current-Skill state with a new targeted revert commit; do not rewrite history. Without Git, apply only targeted corrections to the current Skill files and rerun the failed check—never bulk-delete project files. Evidence conflicts remain visible with status `存在冲突`; they are not "rolled back" into a false deterministic claim.

- [x] **Step 6: Handle Git conditionally**

If `git -C E:\Stellaris rev-parse --is-inside-work-tree` succeeds because the user established a repository, commit remaining verified changes with `docs: finalize crawler writing-plans-bridge skill`. If it fails, do not initialize Git; record that local files and the ledger are the persistence mechanism.

- [x] **Step 7: Stop at Skill 19 (the final Skill)**

Report the completed `crawler-writing-plans-bridge` artifacts and verification evidence to the user. This is the 19th and final Skill in the fixed sequence; after this Skill is verified complete, all 19 Skills are complete. Do not begin any work beyond Skill 19 until the user accepts this Skill's result and separately authorizes the next action.

---

## Plan Completion Criteria

This plan is implemented only when:

- every checkbox is completed or explicitly blocked with evidence;
- structural verification passes;
- all eight behavioral cases pass;
- the verification flow and planning-input-package contract match the approved design;
- the evidence cards match the approved design §7 and the pinned batch-02 sources, and the Skill-19 view references them;
- the output contract and handoff contract match the approved design and decision-log §33-36;
- no third-party tool or crawler runtime action was executed; no secret content was persisted;
- the progress ledger is at `待验证` with a complete handoff;
- the user or independent reviewer verifies the result before changing the status to `已完成`.

Execution is assigned to Claude Code. This plan does not authorize Codex to execute it and does not authorize work on any other Skill.
