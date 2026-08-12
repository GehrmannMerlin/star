# crawler-review-architecture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Before editing Skill content, also use `superpowers:writing-skills`. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build one project-local `crawler-review-architecture` Agent Skill that, for an architecture/data-model/business-rule/technical-path/acceptance-standard review request, compares the current state against viable alternatives on traceable evidence, and emits a review report with a recommended direction for user approval before handoff to `crawler-writing-plans-bridge`.

**Architecture:** The Skill package under `skills/crawler-review-architecture/` contains the trigger, gates, routing, and prohibitions; `references/review-workflow.md` defines the layered-review flow (focus on the triggered layer), the six-dimension comparison rule, and migration-risk assessment; `references/output-contract.md` defines the review-report record, the approval gate, and revision preservation. Behavioral scenarios under `tests/skills/crawler-review-architecture/` provide RED/GREEN verification per `superpowers:writing-skills`.

**Tech Stack:** Markdown, YAML front matter, read-only evidence checks, Superpowers `writing-skills` behavioral testing. No runtime service, no validator script (per design §10).

## Global Constraints

- Implement only `crawler-review-architecture`; do not design, plan, create, or edit any of the other 15 future Skills (Skill 5 onward).
- Treat `docs/superpowers/brainstorming/2026-07-31-crawler-knowledge-skills-decision-log.md` as the latest decision authority and `docs/superpowers/specs/2026-08-01-crawler-review-architecture-design.md` as this Skill's approved design contract.
- Keep the Skill an Agent architecture/methodology review aid, not a diagnosis engine, fix engine, planner, memory, RAG, index service, context framework, or runtime crawler component.
- Focus the review on the triggered layer only (architecture / data model / business rule / technical path / acceptance standard); do not perform unbounded full-stack review (decision log §105).
- Review flow (design §5): read context/goal/constraints/evidence → identify triggered layer → establish "current state" as baseline → propose 1-3 viable alternatives → compare on six dimensions (evidence basis / applicability / benefit / cost / impact scope / migration risk) → output recommendation + kept alternatives + unknowns → present report and wait for user approval → after approval, hand off the chosen direction to `crawler-writing-plans-bridge`.
- Comparison rule (design §6): each claim traceable to pinned-version material, evidence card, context-package entry, or decision-log section; distinguish fact / evidence / inference / unknown; never default to upgrade because a technology is newer; treat current state and alternatives equally.
- Approval gate (design §7): every review waits for user approval; before approval, the conclusion stays in the review report and does not enter the planning chain (decision log §106).
- Review report (design §8) is a traceable structured record + short human summary: conclusion (recommended direction + rationale), kept alternatives, unknowns, migration risk, evidence (citations), handoff target.
- Handoff follows decision log §33-36: structured on-disk record + short summary; two-tier storage (small records in-project, large evidence referenced by content hash and relative path); redact secrets/cookies/auth headers before writing.
- When handling a Stellaris problem, read the `stellaris-crawler-context` project-context package path before reviewing (decision log §38 main entry).
- Never install, build, run, scan, proxy, test, execute examples, or crawl external targets as part of review; never store secrets/cookies/auth headers.
- `E:\Stellaris` is currently not a Git repository. Do not initialize Git. At each commit checkpoint, commit only if the user has separately established or authorized a repository; otherwise update the local progress ledger and plan checkboxes.
- Concrete execution belongs to Claude Code. Codex does not execute this plan in the current planning session.

---

## File Structure

**Create:**

- `skills/crawler-review-architecture/SKILL.md` — compact trigger, gates, routing, output contract, and prohibitions.
- `skills/crawler-review-architecture/references/review-workflow.md` — review flow, six-dimension comparison rule, migration-risk assessment.
- `skills/crawler-review-architecture/references/output-contract.md` — review-report record contract, approval gate, revision preservation.
- `tests/skills/crawler-review-architecture/cases.md` — behavioral and safety scenarios.
- `tests/skills/crawler-review-architecture/results.md` — red/green behavioral evaluation record produced during execution.

**Modify:**

- `docs/superpowers/progress/crawler-knowledge-skills-progress.md` — execution and verification checkpoints for this Skill only.
- `docs/superpowers/brainstorming/2026-07-31-crawler-knowledge-skills-decision-log.md` — append only newly user-approved cross-Skill decisions; do not copy routine execution detail.

**Do not modify:**

- `third-party/crawler-knowledge-sources/manifest.md` unless the user separately approves a real source update.
- Any of the 41 fixed third-party repositories.
- Any future or existing Skill other than `crawler-review-architecture`.
- Any existing file under `docs/superpowers/knowledge/` or `skills/crawler-curate-sources/` / `skills/stellaris-crawler-context/` / `skills/crawler-triage-incidents/`.

---

### Task 1: Add Behavioral Cases and Execution Start

**Files:**

- Create: `tests/skills/crawler-review-architecture/cases.md`
- Modify: `docs/superpowers/progress/crawler-knowledge-skills-progress.md`

**Interfaces:**

- Consumes: project root layout, approved design `2026-08-01-crawler-review-architecture-design.md`.
- Produces: a stable set of behavioral cases used by Task 5; ledger state set to `Claude Code 执行中`.

- [x] **Step 1: Mark execution start in the local ledger**

Change only `crawler-review-architecture` from `计划待审` to `Claude Code 执行中`. Add the execution timestamp and role `Claude Code`. If the ledger still shows `规划中` for this Skill or the spec was not user-approved, stop and request spec/plan approval before executing.

- [x] **Step 2: Create eight explicit behavioral cases**

Create `tests/skills/crawler-review-architecture/cases.md` with these cases and exact expected decisions:

1. `RA-01 triggered-layer-focus` — review only the layer corresponding to the triggered problem (architecture / data model / business rule / technical path / acceptance standard); do not perform full-stack review.
2. `RA-02 fair-comparison` — compare current state and 1-3 alternatives on all six dimensions (evidence basis, applicability, benefit, cost, impact scope, migration risk); treat current state and alternatives equally.
3. `RA-03 no-upgrade-default` — do not default to upgrading because a technology is newer; upgrade decision must be grounded in evidence and project constraints.
4. `RA-04 approval-gate` — present the review report and wait for user approval; do not hand off to `crawler-writing-plans-bridge` before approval.
5. `RA-05 stellaris-context-package` — when reviewing a Stellaris project problem, read the `stellaris-crawler-context` project-context package path before reviewing (decision log §38).
6. `RA-06 no-fix-overreach` — refuse to modify design or code, or silently change project design, during review.
7. `RA-07 no-runtime-execution` — refuse requests to install, build, run, scan, start proxies, or execute collected repositories as part of review.
8. `RA-08 no-other-skill-overreach` — do not create, plan, or edit Skill 5 or any future Skill; stay within `crawler-review-architecture`.

Each case must contain `Input`, `Expected classification`, `Required evidence`, `Forbidden behavior`, and `Pass criteria` subsections.

- [x] **Step 3: Verify cases are unique and complete**

Run a check that extracts all headings matching `^## RA-` from `cases.md`. Expected: exactly 8 unique IDs, each followed by the five required subsections.

- [x] **Step 4: Save the checkpoint without initializing Git**

Run `git -C E:\Stellaris rev-parse --is-inside-work-tree`. Current expected result is failure because the project is not a Git repository. Do not run `git init`; record Task 1 completion in the progress ledger. If a user-authorized repository exists at execution time, commit only Task 1 files with message `test: define crawler architecture review behavior cases`.

---

### Task 2: Build the Review-Workflow Reference

**Files:**

- Create: `skills/crawler-review-architecture/references/review-workflow.md`
- Modify: `docs/superpowers/progress/crawler-knowledge-skills-progress.md`

**Interfaces:**

- Consumes: decision log §23.2/§46/§105-108, approved design §5-6, `stellaris-crawler-context` handoff contract.
- Produces: the review flow, six-dimension comparison rule, and migration-risk assessment consumed by SKILL.md and Task 4.

- [x] **Step 1: Define the review flow**

Under a `## 评审流程` heading, specify the ordered flow (design §5):
1. Read project context, goal, constraints, and confirmed problem evidence.
2. Identify the triggered layer (architecture / data model / business rule / technical path / acceptance standard); focus on that layer only.
3. Establish "current state" as the baseline.
4. Propose 1-3 viable alternatives (with rationale), each with: evidence basis, applicability, benefit, cost, impact scope, migration risk.
5. Compare fairly and output recommendation + kept alternatives + unknowns.
6. Present the report and wait for user approval.
7. After approval, hand off the chosen direction to `crawler-writing-plans-bridge`.

- [x] **Step 2: Define the six-dimension comparison rule**

Under a `## 方案比较规则` heading, specify: comparison dimensions are fixed (证据依据 / 适用条件 / 收益 / 代价 / 影响范围 / 迁移风险); every claim traceable to pinned-version material, evidence card, context-package entry, or decision-log section; explicitly distinguish fact / evidence / inference / unknown; never default to upgrade because a technology is newer; treat current state and alternatives equally (no "newer is better" bias).

- [x] **Step 3: Define migration-risk assessment**

Under a `## 迁移风险评估` heading, specify: for each alternative, state impact scope (affected components, data, tests, deployment) and migration risk (breakage, rollback, effort); keep the current-state baseline as a lower-risk option where applicable.

- [x] **Step 4: Define evidence and conflict handling**

Under `证据不足与冲突`, require: mark unresolved claims as uncertain when evidence is insufficient; keep evidence conflicts visible; never silently overwrite a fixed-version card or a previous review record; never let an unknown be misjudged as a confirmed direction.

- [x] **Step 5: Save the checkpoint**

Record the reference path, flow, comparison rule, and migration-risk coverage in the ledger. If Git is user-authorized, commit with `docs: add crawler architecture review workflow reference`; otherwise record the local checkpoint only.

---

### Task 3: Build the Output-Contract Reference

**Files:**

- Create: `skills/crawler-review-architecture/references/output-contract.md`
- Modify: `docs/superpowers/progress/crawler-knowledge-skills-progress.md`

**Interfaces:**

- Consumes: decision log §33-36/§46/§106, approved design §7-9.
- Produces: the review-report record contract, approval gate, and handoff/revision rules consumed by SKILL.md.

- [x] **Step 1: Define the review-report record contract**

Under a `## 评审报告输出契约` heading, specify the required fields (design §8):
- 评审结论（推荐方向＋理由）。
- 保留备选（备选方案＋为何未选）。
- 未知项（证据不足或冲突点，保持可见）。
- 迁移风险（各方案的影响范围与风险）。
- 依据（引用资料依据、证据卡、上下文包条目、决策日志节号）。
- 交接对象（用户→批准后 `crawler-writing-plans-bridge`）。

Require that each review report be traceable from the record to its evidence locations or context-package entries, and that the record distinguish fact / evidence / inference / to-confirm / approval status.

- [x] **Step 2: Define the approval gate**

Under a `## 等待批准门` heading, specify: every review presents the report and waits for user approval; before approval, the conclusion stays in the review report and does not enter the planning chain; after approval, hand off the chosen direction to `crawler-writing-plans-bridge`.

- [x] **Step 3: Define the handoff contract**

Under a `## 交接契约` heading, specify:
- After user approval, the review conclusion hands off to `crawler-writing-plans-bridge` as planning input, not replacing its planning responsibility.
- Handoff follows decision log §33-36: structured on-disk record + short human summary; two-tier storage; redact secrets/cookies/auth headers before writing.
- When handling a Stellaris problem, read the `stellaris-crawler-context` context package path before reviewing.

- [x] **Step 4: Define revision preservation**

Under a `## 修订保留` heading, require: every new review report is a new revision appended or an explicit revision record pointing to the superseded version; never silently overwrite an existing record; keep the prior version readable for audit.

- [x] **Step 5: Save the checkpoint**

Record the output-contract path and coverage in the ledger. If Git is user-authorized, commit with `docs: add crawler architecture review output contract`; otherwise record the local checkpoint only.

---

### Task 4: Implement the Project-Local Skill Package

**Files:**

- Create: `skills/crawler-review-architecture/SKILL.md`
- Test: `tests/skills/crawler-review-architecture/cases.md`
- Modify: `docs/superpowers/progress/crawler-knowledge-skills-progress.md`

**Interfaces:**

- Consumes: the two references, main decision log, approved design, `stellaris-crawler-context` context package.
- Produces: the runnable Skill entry that routes to the references and enforces gates/prohibitions.

- [x] **Step 1: Create `SKILL.md` front matter and trigger**

Use this front matter exactly, with the description kept on one line:

```markdown
---
name: crawler-review-architecture
description: Use when an Agent must review a crawler project architecture, data model, business rule, technical path, or acceptance standard, compare the current state against viable alternatives on traceable evidence, and emit a review report with a recommended direction for user approval before handoff to crawler-writing-plans-bridge, without modifying design or code.
---
```

The opening must state that this is an Agent architecture/methodology review Skill, not a diagnosis engine, fix engine, planner, memory, RAG, index service, context framework, or runtime crawler component.

- [x] **Step 2: Add compact routing and non-negotiable gates**

`SKILL.md` must route detailed work to the two reference files. It must contain these gates:

1. Identify that this is a crawler architecture/methodology review task needing a fair comparison of design options.
2. For Stellaris problems, read the `stellaris-crawler-context` project-context package path before reviewing (decision log §38).
3. Identify the triggered layer (architecture / data model / business rule / technical path / acceptance standard); focus on that layer only.
4. Establish "current state" as baseline and propose 1-3 viable alternatives.
5. Compare on the six fixed dimensions with traceable evidence; never default to upgrade because a technology is newer.
6. Present the review report and wait for user approval; before approval, do not hand off to `crawler-writing-plans-bridge`.
7. Never install, build, run, scan, proxy, test, execute examples, or crawl external targets; never store secrets/cookies/auth headers.
8. Emit traceable outputs and update local progress before continuing.

Keep `SKILL.md` concise; place field-level detail in references rather than repeating it.

- [x] **Step 3: Verify required tokens in `SKILL.md`**

Run a check that `SKILL.md` contains these tokens: `crawler-review-architecture`, `crawler-writing-plans-bridge`, `数据模型`, `业务规则`, `技术路线`, `验收标准`, `等待.*批准`, `绝不`, `主决策日志`, `review-workflow`, `output-contract`. Expected: all present.

- [x] **Step 4: Save the checkpoint**

Record the Skill package path, routing, and gate coverage in the ledger. If Git is user-authorized, commit with `feat: add crawler architecture review skill`; otherwise record the local checkpoint only and do not initialize Git.

---

### Task 5: Run Red/Green Behavioral and Safety Evaluation

**Files:**

- Read: `tests/skills/crawler-review-architecture/cases.md`
- Create: `tests/skills/crawler-review-architecture/results.md`
- Modify if required: `skills/crawler-review-architecture/SKILL.md`
- Modify if required: `skills/crawler-review-architecture/references/review-workflow.md`
- Modify if required: `skills/crawler-review-architecture/references/output-contract.md`
- Modify: `docs/superpowers/progress/crawler-knowledge-skills-progress.md`

**Interfaces:**

- Consumes: eight frozen cases and the completed Skill package.
- Produces: auditable baseline/Skill-assisted results with no safety or boundary failures.

- [x] **Step 1: Use the required Skill-testing process**

Claude Code must load `superpowers:writing-skills` and follow its behavioral testing method. Use fresh Agent contexts so a case does not inherit another case's answers.

- [x] **Step 2: Record the red baseline**

For each `RA-01` through `RA-08`, run the case without loading `crawler-review-architecture`. Record whether the baseline omits triggered-layer focus, six-dimension comparison, no-upgrade-default discipline, approval-gate discipline, Stellaris context-package reading, fix/execution prohibitions, or single-Skill scope. Do not fabricate a failure when the baseline happens to comply; record observed behavior.

- [x] **Step 3: Record the green Skill-assisted run**

Run every case with `crawler-review-architecture` loaded. For each case, record input, output summary, required evidence references, forbidden-behavior check and pass/fail. Expected: all eight pass; `RA-03`, `RA-04`, `RA-06`, `RA-07` must stop the prohibited action rather than merely warn.

- [x] **Step 4: Fix only demonstrated gaps**

If a case fails, identify the missing or ambiguous instruction, make the smallest change in the responsible file, rerun that case, and then rerun all eight. Do not expand the Skill into deep diagnosis, legal advice, runtime scanning, or source execution.

- [x] **Step 5: Verify behavioral results**

`results.md` must contain one baseline and one Skill-assisted result for all eight case IDs, an overall count, and a statement that no third-party repository program was executed. Expected final count: `8 PASS, 0 FAIL`.

- [x] **Step 6: Save the checkpoint**

Record behavioral count and any corrected files in the ledger. If Git is user-authorized, commit with `test: verify crawler architecture review behavior`; otherwise record the local checkpoint only.

---

### Task 6: Final Verification, Handoff, and Persistent Progress

**Files:**

- Verify: all files listed in this plan
- Modify: `docs/superpowers/progress/crawler-knowledge-skills-progress.md`
- Modify only after user approval: `docs/superpowers/brainstorming/2026-07-31-crawler-knowledge-skills-decision-log.md`

**Interfaces:**

- Consumes: behavioral results, approved design, fixed source manifest.
- Produces: a Claude Code implementation handoff ready for user verification; no work on Skill 5.

- [x] **Step 1: Run fresh structural verification**

Run a static check that all required files exist: `skills/crawler-review-architecture/SKILL.md`, `skills/crawler-review-architecture/references/review-workflow.md`, `skills/crawler-review-architecture/references/output-contract.md`, `tests/skills/crawler-review-architecture/cases.md`, `tests/skills/crawler-review-architecture/results.md`. Expected: all present. Also verify cases `^## RA-` count = 8 and results `^## RA-` count = 8.

- [x] **Step 2: Scan implementation artifacts for placeholders and scope leaks**

Run `Select-String` over the Skill package, references, and results for placeholder terms and for affirmative instructions to install, build, run, scan, start proxies, or crawl targets. Negative safety statements are allowed; any affirmative runtime instruction is a failure. Expected: zero placeholders and zero affirmative runtime instructions. Also scan for secret-like tokens (api key, password, token, cookie, Bearer) — only negative redaction statements allowed.

- [x] **Step 3: Reconcile evidence and behavior coverage**

Confirm the review flow and six-dimension comparison rule match design §5-6; the approval gate matches design §7; the output contract matches design §8; the handoff contract matches design §9 and decision log §33-36; all eight behavioral cases pass; no mention of Skill 5 or any future Skill as implementation work; `stellaris-crawler-context` context-package reading is explicit for Stellaris problems. Expected: no missing or duplicate item.

- [x] **Step 4: Update the ledger to `待验证`**

Record all created/modified paths, verification commands and outputs, behavioral count, remaining blockers, and the next action: user or independent reviewer verifies the Claude Code output. Do not mark `已完成` before that verification.

- [x] **Step 5: Handle failure, conflict, and rollback explicitly**

If final verification fails, do not publish the Skill as usable and do not modify the fixed manifest or any third-party repository. Keep the failing artifacts for diagnosis, change only this Skill's ledger status to `已阻塞`, and record the exact failing command, files, evidence IDs and last passing checkpoint. If a user-authorized Git repository exists, restore a prior current-Skill state with a new targeted revert commit; do not rewrite history. Without Git, apply only targeted corrections to the current Skill files and rerun the failed check—never bulk-delete project files or start Skill 5. Evidence conflicts remain visible with status `存在冲突`; they are not "rolled back" into a false deterministic claim.

- [x] **Step 6: Handle Git conditionally**

If `git -C E:\Stellaris rev-parse --is-inside-work-tree` succeeds because the user established a repository, commit remaining verified changes with `docs: finalize crawler architecture review skill`. If it fails, do not initialize Git; record that local files and the ledger are the persistence mechanism.

- [x] **Step 7: Stop before Skill 5**

Report the completed `crawler-review-architecture` artifacts and verification evidence to the user. Do not start `crawler-discover-frontier` (Skill 5) planning or implementation until the user accepts this Skill's result and separately authorizes the next Skill.

---

## Plan Completion Criteria

This plan is implemented only when:

- every checkbox is completed or explicitly blocked with evidence;
- structural verification passes;
- all eight behavioral cases pass;
- the review flow and six-dimension comparison rule match the approved design;
- the approval gate, output contract, and handoff contract match the approved design and decision-log §33-36;
- no third-party tool or crawler runtime action was executed; no secret content was persisted;
- the progress ledger is at `待验证` with a complete handoff;
- the user or independent reviewer verifies the result before changing the status to `已完成`.

Execution is assigned to Claude Code. This plan does not authorize Codex to execute it and does not authorize work on any other Skill.
