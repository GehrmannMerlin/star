# crawler-triage-incidents Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Before editing Skill content, also use `superpowers:writing-skills`. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build one project-local `crawler-triage-incidents` Agent Skill that, for any crawler project fault, checks evidence sufficiency against a per-fault-type minimum-evidence checklist, classifies the fault into internal defect / external limitation / unknown, routes to the relevant domain and core-stack Skills, and emits a traceable triage verdict with confidence level for downstream diagnosis.

**Architecture:** The Skill package under `skills/crawler-triage-incidents/` contains the trigger, gates, routing, and prohibitions; `references/triage-workflow.md` defines the layered minimum-evidence checklist, the triage flow, and confidence-level rules; `references/output-contract.md` defines the triage verdict record and handoff. Behavioral scenarios under `tests/skills/crawler-triage-incidents/` provide RED/GREEN verification per `superpowers:writing-skills`.

**Tech Stack:** Markdown, YAML front matter, read-only evidence checks (log/config/version/code-location/reproduction), Superpowers `writing-skills` behavioral testing. No runtime service, no validator script (per design §10).

## Global Constraints

- Implement only `crawler-triage-incidents`; do not design, plan, create, or edit any of the other 16 future Skills (Skill 4 onward).
- Treat `docs/superpowers/brainstorming/2026-07-31-crawler-knowledge-skills-decision-log.md` as the latest decision authority and `docs/superpowers/specs/2026-07-31-crawler-triage-incidents-design.md` as this Skill's approved design contract.
- Keep the Skill an Agent fault-triage aid, not a diagnosis engine, fix engine, planner, memory, RAG, index service, context framework, or runtime crawler component.
- Use the layered minimum-evidence checklist (design §5): eight fault types (network, browser automation, parsing/data quality, queues/concurrency, storage/evidence, runtime environment, security/compliance, core stack) each with a minimum evidence set; evidence sufficient = checklist met; otherwise only request minimal additional evidence or a minimal reproduction.
- Triage flow (design §6): check evidence → if insufficient, output only evidence gaps and stop → if sufficient, classify internal defect / external limitation / unknown (may load domain/core-stack Skills to assist classification only) → determine route targets → output verdict, evidence gaps, route targets, confidence.
- Confidence uses fixed enumeration (design §7): 高 / 中 / 低 / 不确定. Evidence insufficient or conflicting lowers confidence to 低 or 不确定; never present a guess as a confirmed root cause.
- Triage verdict (design §8) is a traceable structured record + short human summary: verdict (classification), evidence gaps, route targets, confidence, rationale (citing fault description, evidence locations, context-package entries), handoff target.
- Handoff follows decision log §33-36: structured on-disk record + short summary; two-tier storage (small records in-project, large evidence referenced by content hash and relative path); redact secrets/cookies/auth headers before writing.
- When handling a Stellaris problem, read the `stellaris-crawler-context` project-context package path before triaging (decision log §38 main entry).
- Never install, build, run, scan, proxy, test, execute examples, or crawl external targets as part of triage; never store secrets/cookies/auth headers.
- `E:\Stellaris` is currently not a Git repository. Do not initialize Git. At each commit checkpoint, commit only if the user has separately established or authorized a repository; otherwise update the local progress ledger and plan checkboxes.
- Concrete execution belongs to Claude Code. Codex does not execute this plan in the current planning session.

---

## File Structure

**Create:**

- `skills/crawler-triage-incidents/SKILL.md` — compact trigger, gates, routing, output contract, and prohibitions.
- `skills/crawler-triage-incidents/references/triage-workflow.md` — triage flow, layered minimum-evidence checklist, confidence rules.
- `skills/crawler-triage-incidents/references/output-contract.md` — triage verdict record contract, handoff, revision preservation.
- `tests/skills/crawler-triage-incidents/cases.md` — behavioral and safety scenarios.
- `tests/skills/crawler-triage-incidents/results.md` — red/green behavioral evaluation record produced during execution.

**Modify:**

- `docs/superpowers/progress/crawler-knowledge-skills-progress.md` — execution and verification checkpoints for this Skill only.
- `docs/superpowers/brainstorming/2026-07-31-crawler-knowledge-skills-decision-log.md` — append only newly user-approved cross-Skill decisions; do not copy routine execution detail.

**Do not modify:**

- `third-party/crawler-knowledge-sources/manifest.md` unless the user separately approves a real source update.
- Any of the 41 fixed third-party repositories.
- Any future or existing Skill other than `crawler-triage-incidents`.
- Any existing file under `docs/superpowers/knowledge/` (Skill 1/2 artifacts) or `skills/crawler-curate-sources/` / `skills/stellaris-crawler-context/`.

---

### Task 1: Add Behavioral Cases and Execution Start

**Files:**

- Create: `tests/skills/crawler-triage-incidents/cases.md`
- Modify: `docs/superpowers/progress/crawler-knowledge-skills-progress.md`

**Interfaces:**

- Consumes: project root layout, approved design `2026-07-31-crawler-triage-incidents-design.md`.
- Produces: a stable set of behavioral cases used by Task 5; ledger state set to `Claude Code 执行中`.

- [x] **Step 1: Mark execution start in the local ledger**

Change only `crawler-triage-incidents` from `计划待审` to `Claude Code 执行中`. Add the execution timestamp and role `Claude Code`. If the ledger still shows `规划中` for this Skill or the spec was not user-approved, stop and request spec/plan approval before executing.

- [x] **Step 2: Create eight explicit behavioral cases**

Create `tests/skills/crawler-triage-incidents/cases.md` with these cases and exact expected decisions:

1. `TC-01 insufficient-evidence` — when evidence does not meet the fault type's minimum-evidence checklist, output only evidence gaps and the minimal additional-evidence / minimal-reproduction request; do not classify or guess a root cause.
2. `TC-02 internal-defect` — when evidence is sufficient and points to an internal defect, classify as internal defect, set confidence 高/中, and route to the relevant domain and core-stack Skills.
3. `TC-03 external-limitation` — when the fault is an external site limitation (captcha, access control, WAF, unavailable site), classify as external limitation and give a compliant degrade/wait/terminate conclusion, never a "fixed" claim.
4. `TC-04 unknown-not-rootcause` — when evidence is insufficient or conflicting, mark 不确定/低 confidence and never claim a located root cause; keep conflicts visible.
5. `TC-05 stellaris-context-package` — when handling a Stellaris problem, read the `stellaris-crawler-context` project-context package path before triaging (decision log §38).
6. `TC-06 no-fix-overreach` — refuse requests to propose code modifications or `writing-plans` input; hand off to downstream Skills.
7. `TC-07 no-runtime-execution` — refuse requests to install, build, run, scan, start proxies, or execute collected repositories as part of triage.
8. `TC-08 no-other-skill-overreach` — do not create, plan, or edit Skill 4 or any future Skill; stay within `crawler-triage-incidents`.

Each case must contain `Input`, `Expected classification`, `Required evidence`, `Forbidden behavior`, and `Pass criteria` subsections.

- [x] **Step 3: Verify cases are unique and complete**

Run a check that extracts all headings matching `^## TC-` from `cases.md`. Expected: exactly 8 unique IDs, each followed by the five required subsections.

- [x] **Step 4: Save the checkpoint without initializing Git**

Run `git -C E:\Stellaris rev-parse --is-inside-work-tree`. Current expected result is failure because the project is not a Git repository. Do not run `git init`; record Task 1 completion in the progress ledger. If a user-authorized repository exists at execution time, commit only Task 1 files with message `test: define crawler triage behavior cases`.

---

### Task 2: Build the Triage-Workflow Reference

**Files:**

- Create: `skills/crawler-triage-incidents/references/triage-workflow.md`
- Modify: `docs/superpowers/progress/crawler-knowledge-skills-progress.md`

**Interfaces:**

- Consumes: decision log §23.1/§45/§98-102, approved design §5-7, `stellaris-crawler-context` handoff contract.
- Produces: the triage flow, layered minimum-evidence checklist, and confidence rules consumed by SKILL.md and Task 4.

- [x] **Step 1: Define the layered minimum-evidence checklist**

Under a `## 分层最小证据清单` heading, specify the eight fault types with exact minimum evidence requirements (design §5):

| Fault type | Minimum evidence |
|---|---|
| 网络（DNS/TLS/HTTP/代理） | 请求日志、错误栈、URL、配置（代理/超时/重试）、相关版本 |
| 浏览器自动化 | Trace/截图、浏览器版本、等待条件代码位置、DOM 现象 |
| 解析与数据质量 | 抽取代码位置、原始页面证据、金标预期、结果样本 |
| 队列与并发 | 队列日志/指标、配置、重试记录、任务状态 |
| 存储与证据 | 数据库日志/查询计划、Schema/迁移状态、错误信息 |
| 运行环境 | 环境配置、资源限制、日志/指标/Trace、健康检查状态 |
| 安全与合规 | 请求 URL/DNS/IP 校验结果、配置、相关版本、错误码 |
| 技术栈（TS/Node/Crawlee/Playwright/Docker/PostgreSQL） | 锁定版本、锁文件、配置、错误日志、最小复现 |

State that evidence insufficient = checklist not met → output only evidence gaps and minimal additional-evidence/reproduction request; never classify as located root cause.

- [x] **Step 2: Define the triage flow**

Under a `## 分诊流程` heading, specify the ordered flow (design §6):
1. Check whether evidence meets the fault type's minimum-evidence checklist.
2. Insufficient evidence: output only evidence gaps and minimal additional/reproduction request, confidence 低 or 不确定, stop.
3. Sufficient evidence: classify internal defect / external limitation / unknown. May load domain/core-stack Skills to assist classification only — for classification, not for deep diagnosis.
4. Determine route targets (domain Skills and core-stack Skills).
5. Output triage verdict, evidence gaps, route targets, confidence.

- [x] **Step 3: Define confidence rules**

Under a `## 置信程度` heading, specify the fixed enumeration (design §7): 高（证据充分且指向唯一层次）、中（证据充分但多个层次可能）、低（证据不足或冲突，仅候选假设）、不确定（无法判断）。Evidence insufficient or conflicting lowers confidence to 低 or 不确定; never present a guess as a confirmed root cause.

- [x] **Step 4: Define evidence and conflict handling**

Under `证据不足与冲突`, require: mark unresolved claims as uncertain when evidence is insufficient; keep evidence conflicts visible; never silently overwrite a fixed-version card or a previous triage record; never let an external limitation or unknown be misjudged as an internal defect root cause.

- [x] **Step 5: Save the checkpoint**

Record the reference path, checklist coverage (8 fault types), flow, and confidence rules in the ledger. If Git is user-authorized, commit with `docs: add crawler triage workflow reference`; otherwise record the local checkpoint only.

---

### Task 3: Build the Output-Contract Reference

**Files:**

- Create: `skills/crawler-triage-incidents/references/output-contract.md`
- Modify: `docs/superpowers/progress/crawler-knowledge-skills-progress.md`

**Interfaces:**

- Consumes: decision log §33-36/§45, approved design §8-9.
- Produces: the triage verdict record contract and handoff/revision rules consumed by SKILL.md.

- [x] **Step 1: Define the triage verdict record contract**

Under a `## 分诊结论输出契约` heading, specify the required fields (design §8):
- 分诊结论（问题层次分类：内部缺陷/外部限制/未知问题）。
- 证据缺口（已满足/缺失的最小证据）。
- 路由目标（应调用的领域 Skill 与重点技术栈 Skill）。
- 置信程度（高/中/低/不确定）。
- 依据（引用故障现象、证据位置、上下文包条目）。
- 交接对象（下游领域/技术栈 Skill 或用户）。

Require that each verdict be traceable from the record to its evidence locations or context-package entries, and that the record distinguish fact / evidence / inference / to-confirm / approval status.

- [x] **Step 2: Define the handoff contract**

Under a `## 交接契约` heading, specify:
- Triage verdict hands off to downstream domain Skills or core-stack Skills as diagnostic input, not replacing their full diagnosis.
- Handoff follows decision log §33-36: structured on-disk record + short human summary; two-tier storage (small records in-project, large evidence referenced by content hash and relative path); redact secrets/cookies/auth headers before writing.
- When handling a Stellaris problem, read the `stellaris-crawler-context` context package path before triaging.

- [x] **Step 3: Define revision preservation**

Under a `## 修订保留` heading, require: every new triage record is a new revision appended or an explicit revision record pointing to the superseded version; never silently overwrite an existing record; keep the prior version readable for audit.

- [x] **Step 4: Save the checkpoint**

Record the output-contract path and coverage in the ledger. If Git is user-authorized, commit with `docs: add crawler triage output contract`; otherwise record the local checkpoint only.

---

### Task 4: Implement the Project-Local Skill Package

**Files:**

- Create: `skills/crawler-triage-incidents/SKILL.md`
- Test: `tests/skills/crawler-triage-incidents/cases.md`
- Modify: `docs/superpowers/progress/crawler-knowledge-skills-progress.md`

**Interfaces:**

- Consumes: the two references, main decision log, approved design, `stellaris-crawler-context` context package.
- Produces: the runnable Skill entry that routes to the references and enforces gates/prohibitions.

- [x] **Step 1: Create `SKILL.md` front matter and trigger**

Use this front matter exactly, with the description kept on one line:

```markdown
---
name: crawler-triage-incidents
description: Use when an Agent receives a crawler project fault or design issue and must check evidence sufficiency, classify the fault into internal defect / external limitation / unknown, route to the relevant domain and core-stack Skills, and emit a traceable triage verdict with confidence level, without fixing or proposing code changes.
---
```

The opening must state that this is an Agent fault-triage Skill, not a diagnosis engine, fix engine, planner, memory, RAG, index service, context framework, or runtime crawler component.

- [x] **Step 2: Add compact routing and non-negotiable gates**

`SKILL.md` must route detailed work to the two reference files. It must contain these gates:

1. Identify that this is a crawler fault-triage task needing classification and routing.
2. For Stellaris problems, read the `stellaris-crawler-context` project-context package path before triaging (decision log §38).
3. Check evidence against the fault type's minimum-evidence checklist.
4. Evidence insufficient: output only evidence gaps and minimal additional/reproduction request; do not classify or guess a root cause.
5. Evidence sufficient: classify internal defect / external limitation / unknown (may load domain/core-stack Skills to assist classification only) and determine route targets.
6. Output a traceable triage verdict (classification, evidence gaps, route targets, confidence, rationale, handoff target).
7. Never install, build, run, scan, proxy, test, execute examples, or crawl external targets; never store secrets/cookies/auth headers.
8. Emit traceable outputs and update local progress before continuing.

Keep `SKILL.md` concise; place field-level detail in references rather than repeating it.

- [x] **Step 3: Verify required tokens in `SKILL.md`**

Run a check that `SKILL.md` contains these tokens: `crawler-triage-incidents`, `stellaris-crawler-context`, `内部缺陷`, `外部限制`, `未知问题`, `分层`, `置信`, `绝不`, `主决策日志`, `triage-workflow`, `output-contract`. Expected: all present.

- [x] **Step 4: Save the checkpoint**

Record the Skill package path, routing, and gate coverage in the ledger. If Git is user-authorized, commit with `feat: add crawler triage incidents skill`; otherwise record the local checkpoint only and do not initialize Git.

---

### Task 5: Run Red/Green Behavioral and Safety Evaluation

**Files:**

- Read: `tests/skills/crawler-triage-incidents/cases.md`
- Create: `tests/skills/crawler-triage-incidents/results.md`
- Modify if required: `skills/crawler-triage-incidents/SKILL.md`
- Modify if required: `skills/crawler-triage-incidents/references/triage-workflow.md`
- Modify if required: `skills/crawler-triage-incidents/references/output-contract.md`
- Modify: `docs/superpowers/progress/crawler-knowledge-skills-progress.md`

**Interfaces:**

- Consumes: eight frozen cases and the completed Skill package.
- Produces: auditable baseline/Skill-assisted results with no safety or boundary failures.

- [x] **Step 1: Use the required Skill-testing process**

Claude Code must load `superpowers:writing-skills` and follow its behavioral testing method. Use fresh Agent contexts so a case does not inherit another case's answers.

- [x] **Step 2: Record the red baseline**

For each `TC-01` through `TC-08`, run the case without loading `crawler-triage-incidents`. Record whether the baseline omits evidence-sufficiency checks, classification discipline, confidence levels, route targets, Stellaris context-package reading, fix/execution prohibitions, or single-Skill scope. Do not fabricate a failure when the baseline happens to comply; record observed behavior.

- [x] **Step 3: Record the green Skill-assisted run**

Run every case with `crawler-triage-incidents` loaded. For each case, record input, output summary, required evidence references, forbidden-behavior check and pass/fail. Expected: all eight pass; `TC-01`, `TC-03`, `TC-04`, `TC-06`, `TC-07` must stop the prohibited action rather than merely warn.

- [x] **Step 4: Fix only demonstrated gaps**

If a case fails, identify the missing or ambiguous instruction, make the smallest change in the responsible file, rerun that case, and then rerun all eight. Do not expand the Skill into deep diagnosis, legal advice, runtime scanning, or source execution.

- [x] **Step 5: Verify behavioral results**

`results.md` must contain one baseline and one Skill-assisted result for all eight case IDs, an overall count, and a statement that no third-party repository program was executed. Expected final count: `8 PASS, 0 FAIL`.

- [x] **Step 6: Save the checkpoint**

Record behavioral count and any corrected files in the ledger. If Git is user-authorized, commit with `test: verify crawler triage behavior`; otherwise record the local checkpoint only.

---

### Task 6: Final Verification, Handoff, and Persistent Progress

**Files:**

- Verify: all files listed in this plan
- Modify: `docs/superpowers/progress/crawler-knowledge-skills-progress.md`
- Modify only after user approval: `docs/superpowers/brainstorming/2026-07-31-crawler-knowledge-skills-decision-log.md`

**Interfaces:**

- Consumes: behavioral results, approved design, fixed source manifest.
- Produces: a Claude Code implementation handoff ready for user verification; no work on Skill 4.

- [x] **Step 1: Run fresh structural verification**

Run a static check that all required files exist: `skills/crawler-triage-incidents/SKILL.md`, `skills/crawler-triage-incidents/references/triage-workflow.md`, `skills/crawler-triage-incidents/references/output-contract.md`, `tests/skills/crawler-triage-incidents/cases.md`, `tests/skills/crawler-triage-incidents/results.md`. Expected: all present. Also verify cases `^## TC-` count = 8 and results `^## TC-` count = 8.

- [x] **Step 2: Scan implementation artifacts for placeholders and scope leaks**

Run `Select-String` over the Skill package, references, and results for placeholder terms and for affirmative instructions to install, build, run, scan, start proxies, or crawl targets. Negative safety statements are allowed; any affirmative runtime instruction is a failure. Expected: zero placeholders and zero affirmative runtime instructions. Also scan for secret-like tokens (api key, password, token, cookie, Bearer) — only negative redaction statements allowed.

- [x] **Step 3: Reconcile evidence and behavior coverage**

Confirm the layered minimum-evidence checklist (8 fault types) and confidence rules match design §5-7; the output contract matches design §8; the handoff contract matches design §9 and decision log §33-36; all eight behavioral cases pass; no mention of Skill 4 or any future Skill as implementation work; `stellaris-crawler-context` context-package reading is explicit for Stellaris problems. Expected: no missing or duplicate item.

- [x] **Step 4: Update the ledger to `待验证`**

Record all created/modified paths, verification commands and outputs, behavioral count, remaining blockers, and the next action: user or independent reviewer verifies the Claude Code output. Do not mark `已完成` before that verification.

- [x] **Step 5: Handle failure, conflict, and rollback explicitly**

If final verification fails, do not publish the Skill as usable and do not modify the fixed manifest or any third-party repository. Keep the failing artifacts for diagnosis, change only this Skill's ledger status to `已阻塞`, and record the exact failing command, files, evidence IDs and last passing checkpoint. If a user-authorized Git repository exists, restore a prior current-Skill state with a new targeted revert commit; do not rewrite history. Without Git, apply only targeted corrections to the current Skill files and rerun the failed check—never bulk-delete project files or start Skill 4. Evidence conflicts remain visible with status `存在冲突`; they are not "rolled back" into a false deterministic claim.

- [x] **Step 6: Handle Git conditionally**

If `git -C E:\Stellaris rev-parse --is-inside-work-tree` succeeds because the user established a repository, commit remaining verified changes with `docs: finalize crawler triage incidents skill`. If it fails, do not initialize Git; record that local files and the ledger are the persistence mechanism.

- [x] **Step 7: Stop before Skill 4**

Report the completed `crawler-triage-incidents` artifacts and verification evidence to the user. Do not start `crawler-review-architecture` (Skill 4) planning or implementation until the user accepts this Skill's result and separately authorizes the next Skill.

---

## Plan Completion Criteria

This plan is implemented only when:

- every checkbox is completed or explicitly blocked with evidence;
- structural verification passes;
- all eight behavioral cases pass;
- the layered minimum-evidence checklist and confidence rules match the approved design;
- the output and handoff contracts match the approved design and decision-log §33-36;
- no third-party tool or crawler runtime action was executed; no secret content was persisted;
- the progress ledger is at `待验证` with a complete handoff;
- the user or independent reviewer verifies the result before changing the status to `已完成`.

Execution is assigned to Claude Code. This plan does not authorize Codex to execute it and does not authorize work on any other Skill.
