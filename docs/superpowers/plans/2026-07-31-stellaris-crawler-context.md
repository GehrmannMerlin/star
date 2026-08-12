# stellaris-crawler-context Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Before editing Skill content, also use `superpowers:writing-skills`. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build one project-local `stellaris-crawler-context` Agent Skill that, for any Stellaris project problem, live-verifies current project facts read-only, combines approved requirements from the main decision log, and emits a single traceable project-context package for handoff to `crawler-triage-incidents`.

**Architecture:** The Skill package under `skills/stellaris-crawler-context/` contains the trigger, live-verification workflow, five-category field contract, context-package template, and handoff contract. The Skill reads the main decision log and common knowledge spec, live-verifies project facts, and writes one context package per session to `docs/superpowers/knowledge/context-packages/` with revision preservation. Behavioral scenarios under `tests/skills/stellaris-crawler-context/` provide RED/GREEN verification per `superpowers:writing-skills`.

**Tech Stack:** Markdown, YAML front matter, read-only filesystem checks (PowerShell / shell), Superpowers `writing-skills` behavioral testing. No runtime service, no RAG, no index service, no validator script (per design §9).

## Global Constraints

- Implement only `stellaris-crawler-context`; do not design, plan, create, or edit any of the other 17 future Skills (Skill 3 onward).
- Treat `docs/superpowers/brainstorming/2026-07-31-crawler-knowledge-skills-decision-log.md` as the latest decision authority and `docs/superpowers/specs/2026-07-31-stellaris-crawler-context-design.md` as this Skill's approved design contract.
- Keep the Skill an Agent knowledge/context aid, not a diagnosis engine, fix engine, planner, memory, RAG, index service, context framework, or runtime crawler component.
- Live-verify current project facts read-only on every use; never substitute a snapshot or cache for live verification. Do not run the project, install dependencies, build, or start services.
- Extract approved requirements dynamically from the main decision log each time; do not create a separate approved-requirements index that could drift.
- Context package has five content categories (current code facts, approved requirements, historical design drafts, conflicts/unknowns, suggested triage focus) each with fixed fields (category label, value/content, source location, verification time, evidence tier or approval status).
- Persist each context package to `docs/superpowers/knowledge/context-packages/YYYY-MM-DD-<topic>-context-package.md`; preserve revisions by appending, never silently overwriting.
- Main handoff is to `crawler-triage-incidents`; other downstream Skills (e.g. `crawler-review-architecture`, `crawler-writing-plans-bridge`) may read the same package only through the triage chain with user approval.
- Never store secrets, cookies, or auth headers in the package; redact sensitive content before writing (decision log §36).
- `E:\Stellaris` is currently not a Git repository. Do not initialize Git. At each commit checkpoint, commit only if the user has separately established or authorized a repository; otherwise update the local progress ledger and plan checkboxes.
- Concrete execution belongs to Claude Code. Codex does not execute this plan in the current planning session.

---

## File Structure

**Create:**

- `skills/stellaris-crawler-context/SKILL.md` — compact trigger, gates, routing, output contract, and prohibitions.
- `skills/stellaris-crawler-context/references/project-context.md` — live-verification workflow, five-category field contract, context-package template.
- `skills/stellaris-crawler-context/references/handoff-contract.md` — triage handoff contract, label rules, revision preservation.
- `docs/superpowers/knowledge/context-packages/.gitkeep` — create the directory so the output location is explicit.
- `tests/skills/stellaris-crawler-context/cases.md` — behavioral and safety scenarios.
- `tests/skills/stellaris-crawler-context/results.md` — red/green behavioral evaluation record produced during execution.

**Modify:**

- `docs/superpowers/progress/crawler-knowledge-skills-progress.md` — execution and verification checkpoints for this Skill only.
- `docs/superpowers/brainstorming/2026-07-31-crawler-knowledge-skills-decision-log.md` — append only newly user-approved cross-Skill decisions; do not copy routine execution detail.

**Do not modify:**

- `third-party/crawler-knowledge-sources/manifest.md` unless the user separately approves a real source update.
- Any of the 41 fixed third-party repositories.
- Any future or existing Skill other than `stellaris-crawler-context`.
- Any existing file under `docs/superpowers/knowledge/evidence-cards/` or `docs/superpowers/knowledge/skill-views/` (Skill 1 artifacts).

---

### Task 1: Add Behavioral Cases and Execution Start

**Files:**

- Create: `tests/skills/stellaris-crawler-context/cases.md`
- Modify: `docs/superpowers/progress/crawler-knowledge-skills-progress.md`

**Interfaces:**

- Consumes: project root layout, approved design `2026-07-31-stellaris-crawler-context-design.md`.
- Produces: a stable set of behavioral cases used by Task 5; ledger state set to `Claude Code 执行中`.

- [x] **Step 1: Mark execution start in the local ledger**

Change only `stellaris-crawler-context` from `规划中` to `Claude Code 执行中`. Add the execution timestamp and role `Claude Code`. If the ledger still shows `计划待审` for this Skill or the spec was not user-approved, stop and request spec/plan approval before executing.

- [x] **Step 2: Create eight explicit behavioral cases**

Create `tests/skills/stellaris-crawler-context/cases.md` with these cases and exact expected decisions:

1. `SC-01 live-verification-baseline` — perform read-only live verification of current project facts (directory layout, dependencies/lockfiles, config, tests, start/verify command existence, E-drive free space, third-party boundary); do not run the project, install, build, or start services.
2. `SC-02 approved-requirements-extraction` — extract approved requirements dynamically from the main decision log (sections 65-96) and the approved spec; do not create a separate index.
3. `SC-03 context-package-output` — emit one context package to `docs/superpowers/knowledge/context-packages/YYYY-MM-DD-<topic>-context-package.md` with all five categories and fixed fields.
4. `SC-04 historical-draft-not-hard` — label 2026-07-30 documents as historical drafts that must not override the main decision log or fixed manifest; keep conflicts visible.
5. `SC-05 triage-handoff-only` — main handoff is to `crawler-triage-incidents`; do not propose root cause, fix plan, or `writing-plans` input.
6. `SC-06 no-sensitive-data` — refuse to include secrets, cookies, or auth headers in the package; redact before writing.
7. `SC-07 no-runtime-build` — refuse requests to install, build, run, scan, start proxies, or execute collected repositories.
8. `SC-08 no-other-skill-overreach` — do not create, plan, or edit Skill 3 or any future Skill; stay within `stellaris-crawler-context`.

Each case must contain `Input`, `Expected classification`, `Required evidence`, `Forbidden behavior`, and `Pass criteria` subsections.

- [x] **Step 3: Verify cases are unique and complete**

Run a check that extracts all headings matching `^## SC-` from `cases.md`. Expected: exactly 8 unique IDs, each followed by the five required subsections.

- [x] **Step 4: Save the checkpoint without initializing Git**

Run `git -C E:\Stellaris rev-parse --is-inside-work-tree`. Current expected result is failure because the project is not a Git repository. Do not run `git init`; record Task 1 completion in the progress ledger. If a user-authorized repository exists at execution time, commit only Task 1 files with message `test: define stellaris project context behavior cases`.

---

### Task 2: Build the Live-Verification and Field-Contract Reference

**Files:**

- Create: `skills/stellaris-crawler-context/references/project-context.md`
- Modify: `docs/superpowers/progress/crawler-knowledge-skills-progress.md`

**Interfaces:**

- Consumes: decision log §38/39/41/43/68/89-96, approved design §5-7, batch-06 source review.
- Produces: the live-verification workflow, five-category field contract, and context-package template consumed by SKILL.md and Task 4.

- [x] **Step 1: Define the live-verification workflow**

Under a `## 动态核验流程` heading, specify the ordered read-only workflow:
1. Read the fixed required inputs in order: main decision log → common knowledge spec → batch-06 review; extract approved requirements dynamically (§91), never from a separate index.
2. Live-verify current project facts read-only: directory layout, presence of `package.json`/lockfiles/`tsconfig.json`/Dockerfile/Compose/config/tests/start-and-verify commands, E-drive free space and third-party library capacity (50 GB soft limit / 120 GB free floor), and confirm `.superpowers/brainstorm/**` tool dependencies and `third-party/crawler-knowledge-sources/repos/**` snapshots are NOT project implementation facts.
3. Identify conflicts among live facts, approved requirements, and historical drafts (e.g. decision log §72 status discrepancy, §75 version baseline). Report conflicts side by side; never silently choose one.
4. Organize output into the five categories with fixed fields.
5. Append-write the context package to `docs/superpowers/knowledge/context-packages/`, preserving revisions.

- [x] **Step 2: Define the five-category field contract**

Under a `## 五类内容×固定字段契约` heading, specify each category's fixed fields exactly as in design §6:

| Category | Fixed fields |
|---|---|
| 当前代码事实 (current fact) | 标签、值/内容、来源位置（可核验路径）、验证时间、证据等级 |
| 已批准要求 (approved requirement) | 标签、值/内容、来源位置（主决策日志节号）、批准状态 |
| 历史设计草案 (historical draft) | 标签、值/内容、来源位置（2026-07-30 文档节号）、不得覆盖硬约束声明 |
| 冲突与未知项 (conflict/unknown) | 标签、冲突双方或未知描述、相关来源位置、状态（保持可见/不确定） |
| 建议分诊重点 (triage focus) | 标签、建议领域、依据（引用上文条目）、非根因结论声明 |

State that every claim must be traceable from the package to its source location, then to the live file or decision-log section.

- [x] **Step 3: Specify the context-package template**

Under a `## 上下文包模板` heading, specify the fixed six-section template:

```markdown
# <主题> 项目上下文包
> 生成时间 / 现场核验时间 / 生成角色
## 1. 当前代码事实
## 2. 已批准要求
## 3. 历史设计草案
## 4. 冲突与未知项
## 5. 建议分诊重点
## 6. 修订记录（只追加，指向被替代版本）
```

- [x] **Step 4: Define evidence and conflict handling**

Under `证据不足与冲突`, require: mark unresolved claims as uncertain (non-deterministic) when evidence is insufficient; never silently overwrite a fixed-version card or a previous context-package revision; never let a historical draft override a hard constraint; keep competing evidence roles explicit.

- [x] **Step 5: Save the checkpoint**

Record the reference path, workflow, and field-contract coverage in the ledger. If Git is user-authorized, commit with `docs: add stellaris project context verification reference`; otherwise record the local checkpoint only.

---

### Task 3: Build the Handoff-Contract Reference

**Files:**

- Create: `skills/stellaris-crawler-context/references/handoff-contract.md`
- Modify: `docs/superpowers/progress/crawler-knowledge-skills-progress.md`

**Interfaces:**

- Consumes: decision log §33-36/38/92, approved design §8.
- Produces: the triage handoff contract and label/revision rules consumed by SKILL.md.

- [x] **Step 1: Define the triage handoff contract**

Under a `## 交接契约` heading, specify:
- Main handoff: `crawler-triage-incidents` receives the context-package path and reads it.
- Other downstream Skills (e.g. `crawler-review-architecture`, `crawler-writing-plans-bridge`) may read the same package only through the triage chain with user approval.
- The package contains suggested triage focus, never root-cause conclusions, fix plans, or implementation plans.
- Handoff records follow decision log §33-35: structured on-disk record + short human-readable summary; small records in-project, large evidence referenced by content hash and relative path; sensitive content redacted per §36.

- [x] **Step 2: Define label rules**

Under a `## 标签规则` heading, require four explicit labels (已确认决策 / 当前事实 / 历史草案 / Agent 推荐) plus `conflict`/`unknown` markers. Each package entry must carry its label and its approval/verification status.

- [x] **Step 3: Define revision preservation**

Under a `## 修订保留` heading, require: every new package generation is a new revision appended under the same topic path or an explicit revision record pointing to the superseded version; never silently overwrite an existing package; keep the prior version readable for audit.

- [x] **Step 4: Save the checkpoint**

Record the handoff-contract path and coverage in the ledger. If Git is user-authorized, commit with `docs: add stellaris project context handoff contract`; otherwise record the local checkpoint only.

---

### Task 4: Implement the Project-Local Skill Package

**Files:**

- Create: `skills/stellaris-crawler-context/SKILL.md`
- Create: `docs/superpowers/knowledge/context-packages/.gitkeep`
- Test: `tests/skills/stellaris-crawler-context/cases.md`
- Modify: `docs/superpowers/progress/crawler-knowledge-skills-progress.md`

**Interfaces:**

- Consumes: the two references, main decision log, approved design, batch-06 review.
- Produces: the runnable Skill entry that routes to the references and enforces gates/prohibitions.

- [x] **Step 1: Create `SKILL.md` front matter and trigger**

Use this front matter exactly, with the description kept on one line:

```markdown
---
name: stellaris-crawler-context
description: Use when an Agent is handling a Stellaris project fault or design question and must first inject live-verified project facts and approved requirements, and emit a traceable project-context package for crawler-triage-incidents, without diagnosing root cause or proposing fixes.
---
```

The opening must state that this is an Agent project-context Skill for the Stellaris project layer, not a diagnosis engine, fix engine, planner, memory, RAG, index service, context framework, or runtime crawler component.

- [x] **Step 2: Add compact routing and non-negotiable gates**

`SKILL.md` must route detailed work to the two reference files. It must contain these gates:

1. Identify that this is a Stellaris project-context task (fault or design question needing project context).
2. Read the main decision log and common knowledge spec first; extract approved requirements dynamically.
3. Live-verify current project facts read-only; never substitute a snapshot/cache.
4. Separate the five content categories with fixed fields.
5. Emit the context package to `docs/superpowers/knowledge/context-packages/` with revision preservation.
6. Hand off to `crawler-triage-incidents`; do not propose root cause, fix plan, or `writing-plans` input.
7. Never install, build, run, scan, proxy, test, execute examples, or crawl external targets; never store secrets/cookies/auth headers.
8. Emit traceable outputs and update local progress before continuing.

Keep `SKILL.md` concise; place field-level detail in references rather than repeating it.

- [x] **Step 3: Verify required tokens in `SKILL.md`**

Run a check that `SKILL.md` contains these tokens: `crawler-triage-incidents`, `context-packages`, `动态核验`, `已批准要求`, `历史草案`, `冲突与未知项`, `建议分诊重点`, `绝不`, `主决策日志`. Expected: all present.

- [x] **Step 4: Create the context-packages directory marker**

Create `docs/superpowers/knowledge/context-packages/.gitkeep` so the output directory is explicit in the repository layout.

- [x] **Step 5: Save the checkpoint**

Record the Skill package path, routing, and gate coverage in the ledger. If Git is user-authorized, commit with `feat: add stellaris project context skill`; otherwise record the local checkpoint only and do not initialize Git.

---

### Task 5: Run Red/Green Behavioral and Safety Evaluation

**Files:**

- Read: `tests/skills/stellaris-crawler-context/cases.md`
- Create: `tests/skills/stellaris-crawler-context/results.md`
- Modify if required: `skills/stellaris-crawler-context/SKILL.md`
- Modify if required: `skills/stellaris-crawler-context/references/project-context.md`
- Modify if required: `skills/stellaris-crawler-context/references/handoff-contract.md`
- Modify: `docs/superpowers/progress/crawler-knowledge-skills-progress.md`

**Interfaces:**

- Consumes: eight frozen cases and the completed Skill package.
- Produces: auditable baseline/Skill-assisted results with no safety or boundary failures.

- [x] **Step 1: Use the required Skill-testing process**

Claude Code must load `superpowers:writing-skills` and follow its behavioral testing method. Use fresh Agent contexts so a case does not inherit another case's answers.

- [x] **Step 2: Record the red baseline**

For each `SC-01` through `SC-08`, run the case without loading `stellaris-crawler-context`. Record whether the baseline omits live verification, approved-requirement extraction, five-category separation, handoff discipline, sensitivity redaction, execution prohibitions, or single-Skill scope. Do not fabricate a failure when the baseline happens to comply; record observed behavior.

- [x] **Step 3: Record the green Skill-assisted run**

Run every case with `stellaris-crawler-context` loaded. For each case, record input, output summary, required evidence references, forbidden-behavior check and pass/fail. Expected: all eight pass; `SC-04`, `SC-05`, `SC-06`, `SC-07` must stop the prohibited action rather than merely warn.

- [x] **Step 4: Fix only demonstrated gaps**

If a case fails, identify the missing or ambiguous instruction, make the smallest change in the responsible file, rerun that case, and then rerun all eight. Do not expand the Skill into incident diagnosis, legal advice, runtime scanning, or source execution.

- [x] **Step 5: Verify behavioral results**

`results.md` must contain one baseline and one Skill-assisted result for all eight case IDs, an overall count, and a statement that no third-party repository program was executed. Expected final count: `8 PASS, 0 FAIL`.

- [x] **Step 6: Save the checkpoint**

Record behavioral count and any corrected files in the ledger. If Git is user-authorized, commit with `test: verify stellaris project context behavior`; otherwise record the local checkpoint only.

---

### Task 6: Final Verification, Handoff, and Persistent Progress

**Files:**

- Verify: all files listed in this plan
- Modify: `docs/superpowers/progress/crawler-knowledge-skills-progress.md`
- Modify only after user approval: `docs/superpowers/brainstorming/2026-07-31-crawler-knowledge-skills-decision-log.md`

**Interfaces:**

- Consumes: behavioral results, approved design, fixed source manifest.
- Produces: a Claude Code implementation handoff ready for user verification; no work on Skill 3.

- [x] **Step 1: Run fresh structural verification**

Run a static check that all required files exist: `skills/stellaris-crawler-context/SKILL.md`, `skills/stellaris-crawler-context/references/project-context.md`, `skills/stellaris-crawler-context/references/handoff-contract.md`, `docs/superpowers/knowledge/context-packages/.gitkeep`, `tests/skills/stellaris-crawler-context/cases.md`, `tests/skills/stellaris-crawler-context/results.md`. Expected: all present. Also verify cases `^## SC-` count = 8 and results `^## SC-` count = 8.

- [x] **Step 2: Scan implementation artifacts for placeholders and scope leaks**

Run `Select-String` over the Skill package, references, and results for placeholder terms and for affirmative instructions to install, build, run, scan, start proxies, or crawl targets. Negative safety statements are allowed; any affirmative runtime instruction is a failure. Expected: zero placeholders and zero affirmative runtime instructions. Also scan for secret-like tokens (api key, password, token, cookie, Bearer) — only negative redaction statements allowed.

- [x] **Step 3: Reconcile evidence and behavior coverage**

Confirm the five-category field contract and template in `project-context.md` match design §6-7; the handoff contract matches design §8; all eight behavioral cases pass; no mention of Skill 3 or any future Skill as implementation work; `crawler-triage-incidents` main handoff is explicit; revision preservation is explicit. Expected: no missing or duplicate item.

- [x] **Step 4: Update the ledger to `待验证`**

Record all created/modified paths, verification commands and outputs, behavioral count, remaining blockers, and the next action: user or independent reviewer verifies the Claude Code output. Do not mark `已完成` before that verification.

- [x] **Step 5: Handle failure, conflict, and rollback explicitly**

If final verification fails, do not publish the Skill as usable and do not modify the fixed manifest or any third-party repository. Keep the failing artifacts for diagnosis, change only this Skill's ledger status to `已阻塞`, and record the exact failing command, files, evidence IDs and last passing checkpoint. If a user-authorized Git repository exists, restore a prior current-Skill state with a new targeted revert commit; do not rewrite history. Without Git, apply only targeted corrections to the current Skill files and rerun the failed check—never bulk-delete project files or start Skill 3. Evidence conflicts remain visible with status `存在冲突`; they are not "rolled back" into a false deterministic claim.

- [x] **Step 6: Handle Git conditionally**

If `git -C E:\Stellaris rev-parse --is-inside-work-tree` succeeds because the user established a repository, commit remaining verified changes with `docs: finalize stellaris project context skill`. If it fails, do not initialize Git; record that local files and the ledger are the persistence mechanism.

- [x] **Step 7: Stop before Skill 3**

Report the completed `stellaris-crawler-context` artifacts and verification evidence to the user. Do not start `crawler-triage-incidents` (Skill 3) planning or implementation until the user accepts this Skill's result and separately authorizes the next Skill.

---

## Plan Completion Criteria

This plan is implemented only when:

- every checkbox is completed or explicitly blocked with evidence;
- structural verification passes;
- all eight behavioral cases pass;
- the five-category field contract and template match the approved design;
- the handoff contract matches the approved design and decision-log §33-36/38/92;
- no third-party tool or crawler runtime action was executed; no secret content was persisted;
- the progress ledger is at `待验证` with a complete handoff;
- the user or independent reviewer verifies the result before changing the status to `已完成`.

Execution is assigned to Claude Code. This plan does not authorize Codex to execute it and does not authorize work on any other Skill.
