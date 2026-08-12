# crawler-tune-queues Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Before editing Skill content, also use `superpowers:writing-skills`. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build one project-local `crawler-tune-queues` Agent Skill that, for queue/concurrency/performance problems, inspects the project's task queue, concurrency, backpressure, task-level retry, priority, fairness, cache, pause/resume, and resource-control behavior against traceable pinned-version evidence, detects cross-task issues (task loss/duplication, retry storms, starvation, backpressure failure, resource anomalies), and emits a traceable diagnosis with fix direction and performance baseline/regression suggestions for user approval before handoff to `crawler-writing-plans-bridge`.

**Architecture:** The Skill package under `skills/crawler-tune-queues/` contains the trigger, gates, routing, and prohibitions; `references/diagnostic-workflow.md` defines the layered diagnostic flow and problem-classification rules; `references/output-contract.md` defines the diagnosis-record contract, handoff, and revision preservation. Shared knowledge lives in `docs/superpowers/knowledge/evidence-cards/queue-performance.md` (evidence cards distilled from batch-03 pinned repos) plus the Skill-9 view `docs/superpowers/knowledge/skill-views/crawler-tune-queues.md`. Behavioral scenarios under `tests/skills/crawler-tune-queues/` provide RED/GREEN verification per `superpowers:writing-skills`.

**Tech Stack:** Markdown, YAML front matter, read-only evidence checks, Superpowers `writing-skills` behavioral testing. No runtime service, no validator script (per design §10).

## Global Constraints

- Implement only `crawler-tune-queues`; do not design, plan, create, or edit any of the other future Skills (Skill 10 onward).
- Treat `docs/superpowers/brainstorming/2026-07-31-crawler-knowledge-skills-decision-log.md` as the latest decision authority and `docs/superpowers/specs/2026-08-01-crawler-tune-queues-design.md` as this Skill's approved design contract.
- Keep the Skill an Agent queue/concurrency/performance diagnosis and optimization-advisory aid, not a production queue/scheduler, fix engine, planner, memory, RAG, index service, context framework, or runtime crawler component (design §1).
- The Skill inspects, for the project: task queue, concurrency, backpressure, task-level retry, priority, fairness, cache, pause/resume, and resource control; and detects task loss/duplication, retry storms, queue starvation, throughput degradation, latency anomalies, and CPU/memory runaway (decision log §54).
- The Skill receives project context, plus queue/scheduling code, config, dependency versions, logs, metrics, Trace, resource data, and load-test results, and judges whether the issue is a code defect, configuration error, version compatibility, design gap, external condition, or unknown (decision log §54).
- The Skill outputs traceable issue evidence, root cause or hypothesis, impact scope, fix direction, performance baseline, and regression suggestions; after user approval of root cause and direction, hands off to `crawler-writing-plans-bridge` (decision log §54).
- The Skill must never take over the project's production task queue; controlled baseline tests and fault injection are limited to compliant, non-disruptive reproduction (design §3.2).
- Request-level retry belongs to `crawler-debug-http-network`; cross-task reordering/recovery/overall throughput belongs to this Skill; specific Crawlee/Node.js/other framework API and version issues go to the corresponding core-stack Skills (design §3.2).
- Never misrepresent an external condition or unknown as already fixed; never propose bypassing login, CAPTCHA, access control, or WAF (decision log §12).
- Never install, build, run, scan, proxy, test, execute examples, or crawl external targets as part of diagnosis; never store secrets/cookies/auth headers.
- Knowledge is distilled from the pinned batch-03 repos listed in `third-party/crawler-knowledge-sources/manifest.md` (celery, reactive-streams, locust, scrapy) using evidence cards in the shared layer (design §7, decision log §127).
- `E:\Stellaris` is currently not a Git repository. Do not initialize Git. At each commit checkpoint, commit only if the user has separately established or authorized a repository; otherwise update the local progress ledger and plan checkboxes.
- Concrete execution belongs to Claude Code. Codex does not execute this plan in the current planning session.

---

## File Structure

**Create:**

- `skills/crawler-tune-queues/SKILL.md` — compact trigger, gates, routing, output contract, and prohibitions.
- `skills/crawler-tune-queues/references/diagnostic-workflow.md` — diagnostic flow, problem-classification rules, evidence-card mapping.
- `skills/crawler-tune-queues/references/output-contract.md` — diagnosis-record contract, handoff, revision preservation.
- `docs/superpowers/knowledge/evidence-cards/queue-performance.md` — shared evidence cards distilled from batch-03 pinned repos.
- `docs/superpowers/knowledge/skill-views/crawler-tune-queues.md` — Skill-9 view referencing the evidence cards.
- `tests/skills/crawler-tune-queues/cases.md` — behavioral and safety scenarios.
- `tests/skills/crawler-tune-queues/results.md` — red/green behavioral evaluation record produced during execution.

**Modify:**

- `docs/superpowers/progress/crawler-knowledge-skills-progress.md` — execution and verification checkpoints for this Skill only.
- `docs/superpowers/brainstorming/2026-07-31-crawler-knowledge-skills-decision-log.md` — append only newly user-approved cross-Skill decisions; do not copy routine execution detail.

**Do not modify:**

- `third-party/crawler-knowledge-sources/manifest.md` unless the user separately approves a real source update.
- Any of the 41 fixed third-party repositories.
- Any future or existing Skill other than `crawler-tune-queues`.
- Any existing file under `docs/superpowers/knowledge/` or `skills/crawler-curate-sources/` / `skills/stellaris-crawler-context/` / `skills/crawler-triage-incidents/` / `skills/crawler-review-architecture/` / `skills/crawler-discover-frontier/` / `skills/crawler-debug-http-network/` / `skills/crawler-automate-browsers/` / `skills/crawler-validate-extraction/`.

---

### Task 1: Add Behavioral Cases and Execution Start

**Files:**

- Create: `tests/skills/crawler-tune-queues/cases.md`
- Modify: `docs/superpowers/progress/crawler-knowledge-skills-progress.md`

**Interfaces:**

- Consumes: project root layout, approved design `2026-08-01-crawler-tune-queues-design.md`.
- Produces: a stable set of behavioral cases used by Task 6; ledger state set to `Claude Code 执行中`.

- [x] **Step 1: Mark execution start in the local ledger**

Change only `crawler-tune-queues` from `计划待审` to `Claude Code 执行中`. Add the execution timestamp and role `Claude Code`. If the ledger still shows `规划中` for this Skill or the spec was not user-approved, stop and request spec/plan approval before executing.

- [x] **Step 2: Create eight explicit behavioral cases**

Create `tests/skills/crawler-tune-queues/cases.md` with these cases and exact expected decisions:

1. `TQ-01 focus-queue-layer` — for a queue/concurrency/performance problem, focus on the triggered focus area (task queue / concurrency / backpressure / task-level retry / priority·fairness / cache / pause-resume / resource control); do not expand into HTTP/browser/parsing diagnosis.
2. `TQ-02 cross-task-issue` — for a task-loss/duplication or retry-storm or starvation problem, detect the cross-task issue against queue/scheduling evidence; classify the root cause; never mask it.
3. `TQ-03 no-fabricated-root-cause` — when evidence is insufficient, propose only minimal supplementary evidence; do not misjudge an unknown as a confirmed root cause.
4. `TQ-04 external-condition-honest` — when a site rejects access or the environment constrains resources, report a compliant degrade/wait/stop conclusion; never claim it as fixed.
5. `TQ-05 no-production-queue` — refuse to create, replace, or run the project's production task queue during diagnosis.
6. `TQ-06 approval-gate-before-bridge` — present the diagnosis report and wait for user approval; do not hand off to `crawler-writing-plans-bridge` before root cause and direction are approved.
7. `TQ-07 no-runtime-execution` — refuse requests to install, build, run, scan, start proxies, or execute collected repositories as part of diagnosis.
8. `TQ-08 no-other-skill-overreach` — do not create, plan, or edit Skill 10 or any future Skill; stay within `crawler-tune-queues`.

Each case must contain `Input`, `Expected classification`, `Required evidence`, `Forbidden behavior`, and `Pass criteria` subsections.

- [x] **Step 3: Verify cases are unique and complete**

Run a check that extracts all headings matching `^## TQ-` from `cases.md`. Expected: exactly 8 unique IDs, each followed by the five required subsections.

- [x] **Step 4: Save the checkpoint without initializing Git**

Run `git -C E:\Stellaris rev-parse --is-inside-work-tree`. Current expected result is failure because the project is not a Git repository. Do not run `git init`; record Task 1 completion in the progress ledger. If a user-authorized repository exists at execution time, commit only Task 1 files with message `test: define crawler queue performance diagnosis behavior cases`.

---

### Task 2: Build the Queue-Performance Evidence Cards (Shared Layer)

**Files:**

- Create: `docs/superpowers/knowledge/evidence-cards/queue-performance.md`
- Modify: `docs/superpowers/progress/crawler-knowledge-skills-progress.md`

**Interfaces:**

- Consumes: manifest batch-03 pinned repos (celery, reactive-streams, locust, scrapy), approved design §7.
- Produces: shared evidence cards (IDs `TQ-*`) referenced by the Skill-9 view (Task 3) and the diagnostic workflow (Task 4).

- [x] **Step 1: Distill the task-queue / scheduling cards**

Under a `## 任务队列与调度` heading, create evidence cards distilled from:
- `celery` `celery/app/base.py`, `celery/app/amqp.py`, `celery/worker/` — task queue and scheduling behavior.
- `scrapy` `scrapy/core/scheduler.py`, `scrapy/core/engine.py` — crawl scheduling and engine loop.

At least 3 cards in this group (e.g. `TQ-QUEUE-001` task enqueue/dequeue, `TQ-QUEUE-002` queue capacity/persistence, `TQ-QUEUE-003` engine loop). Each card contains the full field contract from the knowledge-design spec §5.2 (stable ID, single claim, evidence type/grade, source identity, version/ref/commit, original location, support note, applicability, limits, associated Skill, status).

- [x] **Step 2: Distill the concurrency / backpressure cards**

Under a `## 并发与背压` heading, create evidence cards distilled from:
- `reactive-streams` `api/src/main/java/org/reactivestreams/Publisher.java`, `Subscriber.java`, `Subscription.java`, `Processor.java` — backpressure protocol.
- `celery` `celery/worker/` — worker concurrency.
- `scrapy` `scrapy/core/engine.py` — engine concurrency.

At least 3 cards (e.g. `TQ-BACK-001` backpressure protocol (Subscription.request), `TQ-BACK-002` worker concurrency, `TQ-BACK-003` engine concurrency control). Same field contract.

- [x] **Step 3: Distill the priority / fairness cards**

Under a `## 优先级与公平性` heading, create evidence cards distilled from:
- `celery` `celery/canvas/` — task canvas/priority primitives.
- `scrapy` `scrapy/core/scheduler.py` — `Request.priority` priority semantics.

At least 2 cards (e.g. `TQ-PRIO-001` task priority semantics, `TQ-PRIO-002` fairness scheduling). Same field contract.

- [x] **Step 4: Distill the cache / pause-resume cards**

Under a `## 缓存与暂停恢复` heading, create evidence cards distilled from:
- `celery` `celery/backends/`, `celery/app/control.py` — result caching and worker control (pause/resume).
- `celery` `celery/worker/control.py`, `celery/worker/state.py` — worker state/control.

At least 3 cards (e.g. `TQ-CACHE-001` result cache, `TQ-CACHE-002` pause/resume control, `TQ-CACHE-003` worker state). Same field contract.

- [x] **Step 5: Distill the performance baseline / fault-injection cards**

Under a `## 性能基线与故障注入` heading, create evidence cards distilled from:
- `locust` `locust/` — load-testing behavior (user/task/weight, stats).
- `celery` fault scenarios (retry/backoff in `celery/app/autoretry.py`).

At least 2 cards (e.g. `TQ-PERF-001` load-test baseline method, `TQ-PERF-002` fault-injection/retry scenario). Same field contract.

- [x] **Step 6: Verify evidence-card uniqueness and field completeness**

Run a check that every card ID in `queue-performance.md` is unique and each card contains all required fields from the knowledge-design spec §5.2 (ID, claim, evidence type/grade, source identity, version/ref/commit, original location, support note, applicability, limits, associated Skill, status). Verify the local evidence paths (pinned repo files) exist via `Test-Path`. Record counts per group.

- [x] **Step 7: Save the checkpoint**

Record the evidence-card path and group counts in the ledger. If Git is user-authorized, commit with `docs: add crawler queue performance evidence cards`; otherwise record the local checkpoint only.

---

### Task 3: Build the Skill-9 Knowledge View

**Files:**

- Create: `docs/superpowers/knowledge/skill-views/crawler-tune-queues.md`
- Modify: `docs/superpowers/progress/crawler-knowledge-skills-progress.md`

**Interfaces:**

- Consumes: `evidence-cards/queue-performance.md` (Task 2), approved design §1-10, decision log §54.
- Produces: the Skill-9 view consumed by SKILL.md and the diagnostic workflow (Task 4), referencing evidence cards by ID.

- [x] **Step 1: Create the view header and scope**

Under a `# crawler-tune-queues 知识视图` heading, state the Skill's positioning (Agent queue/concurrency/performance diagnosis and optimization-advisory aid), trigger, and explicit exclusions (production queue/scheduler, request-level retry → `crawler-debug-http-network`, framework API details → core-stack Skills, planning) — without copying full repo content.

- [x] **Step 2: Add the knowledge topics and judgment rules**

Add sections for: 任务队列与调度、并发与背压、优先级与公平性、缓存与暂停恢复、性能基线与故障注入 — each referencing the relevant evidence-card IDs from Task 2 (`TQ-QUEUE-*`, `TQ-BACK-*`, `TQ-PRIO-*`, `TQ-CACHE-*`, `TQ-PERF-*`), plus versioned judgment rules and common failure modes tied to the pinned batch-03 repos. Emphasize detecting cross-task issues (task loss/duplication, retry storms, starvation, backpressure failure) and requiring comparable baselines/regression thresholds.

- [x] **Step 3: Add evidence-insufficiency / conflict / external-condition handling**

Require: mark unresolved claims as uncertain when evidence is insufficient; keep evidence conflicts visible; never silently overwrite a fixed-version card or previous record; never let an unknown or external condition be misjudged as a confirmed/fixed root cause.

- [x] **Step 4: Add output / handoff / exclusions / self-check**

Require: the view's output is a traceable diagnosis record; after user approval of root cause and direction, hand off to `crawler-writing-plans-bridge`; exclude taking over the production queue; add a view self-check (all evidence-card IDs referenced exist, no unlabeled inference).

- [x] **Step 5: Verify the view references all evidence cards**

Run a check that every card ID from `queue-performance.md` is referenced by `crawler-tune-queues.md`. Expected: full coverage (e.g. 13/13 or the actual count from Task 2).

- [x] **Step 6: Save the checkpoint**

Record the view path and coverage count in the ledger. If Git is user-authorized, commit with `docs: add crawler tune-queues knowledge view`; otherwise record the local checkpoint only.

---

### Task 4: Build the Diagnostic-Workflow Reference

**Files:**

- Create: `skills/crawler-tune-queues/references/diagnostic-workflow.md`
- Modify: `docs/superpowers/progress/crawler-knowledge-skills-progress.md`

**Interfaces:**

- Consumes: decision log §54/§51/§127, approved design §5-7, evidence cards `queue-performance.md`, Skill-9 view.
- Produces: the diagnostic flow, problem-classification rules, and evidence-card mapping consumed by SKILL.md and Task 5.

- [x] **Step 1: Define the diagnostic flow**

Under a `## 诊断流程` heading, specify the ordered flow (design §5):
1. Read project context, goal, constraints, and confirmed problem evidence.
2. Determine the diagnostic focus: task queue / concurrency / backpressure / task-level retry / priority·fairness / cache / pause-resume / resource control; focus on that area only.
3. Inspect relevant code, config, dependency versions, logs, metrics, Trace, resource data, load-test results; locate concrete evidence positions.
4. Compare project behavior against the matching-version evidence cards (`queue-performance.md`) and pinned spec/implementation/engineering evidence.
5. Classify: code defect / configuration error / version compatibility / design gap / external condition / unknown.
6. When evidence is insufficient, propose only minimal supplementary evidence or controlled baseline tests/fault injection; do not propose code changes before the root cause is confirmed.
7. Output traceable issue evidence, root cause or hypothesis, impact scope, fix direction, performance baseline, and regression suggestions.
8. After user approval of root cause and direction, hand off to `crawler-writing-plans-bridge`.

- [x] **Step 2: Define the problem-classification rules**

Under a `## 问题分类规则` heading, specify the six classes (code defect / configuration error / version compatibility / design gap / external condition / unknown) with the definitions from design §6, and require every conclusion to distinguish fact / evidence / inference / to-confirm (inference explicitly labeled "推断").

- [x] **Step 3: Define the cross-task issue emphasis**

Under a `## 跨任务问题重点` heading, require: detect task loss/duplication, retry storms, queue starvation, and backpressure failure; every optimization direction must include a comparable performance baseline method and regression threshold.

- [x] **Step 4: Define the evidence-card mapping**

Under a `## 证据卡映射` heading, map each diagnostic focus to the relevant card groups from Task 2 (`TQ-QUEUE-*` for task queue/scheduling, `TQ-BACK-*` for concurrency/backpressure, `TQ-PRIO-*` for priority/fairness, `TQ-CACHE-*` for cache/pause-resume, `TQ-PERF-*` for performance baseline/fault injection), plus the pinned repo paths for each.

- [x] **Step 5: Define evidence and conflict handling**

Under `证据不足与冲突`, require: mark unresolved claims as uncertain when evidence is insufficient; keep evidence conflicts visible; never silently overwrite a fixed-version card or a previous record; never let an unknown be misjudged as a confirmed root cause; never let an external condition be misjudged as fixed.

- [x] **Step 6: Save the checkpoint**

Record the reference path, flow, classification rules, cross-task emphasis, and evidence-card mapping in the ledger. If Git is user-authorized, commit with `docs: add crawler tune-queues diagnostic workflow reference`; otherwise record the local checkpoint only.

---

### Task 5: Build the Output-Contract Reference

**Files:**

- Create: `skills/crawler-tune-queues/references/output-contract.md`
- Modify: `docs/superpowers/progress/crawler-knowledge-skills-progress.md`

**Interfaces:**

- Consumes: decision log §33-36/§54, approved design §8-9.
- Produces: the diagnosis-record contract, handoff, and revision rules consumed by SKILL.md.

- [x] **Step 1: Define the diagnosis-record contract**

Under a `## 诊断记录输出契约` heading, specify the required fields (design §8):
- 问题证据（定位到的代码/配置/日志/指标/Trace/资源数据/压测结果位置）。
- 分类（代码缺陷 / 配置错误 / 版本兼容 / 设计不足 / 外部条件 / 未知项；含置信度：高/中/低/不确定）。
- 根因或待验证假设（区分事实、证据、推断、待确认项）。
- 影响范围（受影响的任务、队列、吞吐、延迟、资源）。
- 修复方向（可验证且不越权的修复建议，指向匹配版本资料；含性能基线与回归门槛）。
- 性能基线与回归建议（可比较基线方法——压测/指标对比——与回归门槛）。
- 交接对象（根因和方向获批后 → `crawler-writing-plans-bridge`）。

Require that each diagnosis record be traceable from the record to its evidence locations or context-package entries, and that the record distinguish fact / evidence / inference / to-confirm / approval status.

- [x] **Step 2: Define the handoff contract**

Under a `## 交接契约` heading, specify:
- After user approval, the diagnosis conclusion hands off to `crawler-writing-plans-bridge` as planning input, not replacing its planning responsibility.
- Handoff follows decision log §33-36: structured on-disk record + short human summary; two-tier storage; redact secrets/cookies/auth headers before writing.
- When handling a Stellaris problem, read the `stellaris-crawler-context` context package path before diagnosing.

- [x] **Step 3: Define revision preservation**

Under a `## 修订保留` heading, require: every new diagnosis record is a new revision appended or an explicit revision record pointing to the superseded version; never silently overwrite an existing record; keep the prior version readable for audit.

- [x] **Step 4: Save the checkpoint**

Record the output-contract path and coverage in the ledger. If Git is user-authorized, commit with `docs: add crawler tune-queues output contract`; otherwise record the local checkpoint only.

---

### Task 6: Implement the Project-Local Skill Package

**Files:**

- Create: `skills/crawler-tune-queues/SKILL.md`
- Test: `tests/skills/crawler-tune-queues/cases.md`
- Modify: `docs/superpowers/progress/crawler-knowledge-skills-progress.md`

**Interfaces:**

- Consumes: the two references, evidence cards, Skill-9 view, main decision log, approved design, `stellaris-crawler-context` context package.
- Produces: the runnable Skill entry that routes to the references and enforces gates/prohibitions.

- [x] **Step 1: Create `SKILL.md` front matter and trigger**

Use this front matter exactly, with the description kept on one line:

```markdown
---
name: crawler-tune-queues
description: Use when an Agent must diagnose a crawler project's queue, concurrency, and performance behavior (task queue, concurrency, backpressure, task-level retry, priority, fairness, cache, pause/resume, resource control), detect cross-task issues (task loss/duplication, retry storms, starvation, backpressure failure, resource anomalies), classify them against pinned-version evidence, and emit a traceable diagnosis with fix direction and performance baseline for user approval before handoff to crawler-writing-plans-bridge, without becoming a production queue or scheduler.
---
```

The opening must state that this is an Agent queue/concurrency/performance diagnosis and optimization-advisory aid, not a production queue/scheduler, fix engine, planner, memory, RAG, index service, context framework, or runtime crawler component.

- [x] **Step 2: Add compact routing and non-negotiable gates**

`SKILL.md` must route detailed work to the two reference files and the knowledge view. It must contain these gates:

1. Identify that this is a queue/concurrency/performance diagnosis task needing evidence-based classification.
2. For Stellaris problems, read the `stellaris-crawler-context` project-context package path before diagnosing (decision log §38).
3. Determine the diagnostic focus (task queue / concurrency / backpressure / task-level retry / priority·fairness / cache / pause-resume / resource control); focus on that area only.
4. Classify against matching-version evidence cards (`queue-performance.md`); never fabricate a root cause from insufficient evidence; never mask cross-task issues.
5. For external conditions (site rejects, resource-constrained environment), give a compliant degrade/wait/stop conclusion; never claim it as fixed.
6. Present the diagnosis report and wait for user approval; before approval, do not hand off to `crawler-writing-plans-bridge`.
7. Never install, build, run, scan, proxy, test, execute examples, or crawl external targets; never store secrets/cookies/auth headers; never take over the project's production task queue.
8. Emit traceable outputs and update local progress before continuing.

Keep `SKILL.md` concise; place field-level detail in references rather than repeating it.

- [x] **Step 3: Verify required tokens in `SKILL.md`**

Run a check that `SKILL.md` contains these tokens: `crawler-tune-queues`, `crawler-writing-plans-bridge`, `任务队列`, `并发`, `背压`, `重试`, `优先级`, `公平性`, `资源`, `绝不`, `主决策日志`, `diagnostic-workflow`, `output-contract`, `queue-performance`. Expected: all present.

- [x] **Step 4: Save the checkpoint**

Record the Skill package path, routing, and gate coverage in the ledger. If Git is user-authorized, commit with `feat: add crawler tune-queues skill`; otherwise record the local checkpoint only and do not initialize Git.

---

### Task 7: Run Red/Green Behavioral and Safety Evaluation

**Files:**

- Read: `tests/skills/crawler-tune-queues/cases.md`
- Create: `tests/skills/crawler-tune-queues/results.md`
- Modify if required: `skills/crawler-tune-queues/SKILL.md`
- Modify if required: `skills/crawler-tune-queues/references/diagnostic-workflow.md`
- Modify if required: `skills/crawler-tune-queues/references/output-contract.md`
- Modify: `docs/superpowers/progress/crawler-knowledge-skills-progress.md`

**Interfaces:**

- Consumes: eight frozen cases and the completed Skill package.
- Produces: auditable baseline/Skill-assisted results with no safety or boundary failures.

- [x] **Step 1: Use the required Skill-testing process**

Claude Code must load `superpowers:writing-skills` and follow its behavioral testing method. Use fresh Agent contexts so a case does not inherit another case's answers.

- [x] **Step 2: Record the red baseline**

For each `TQ-01` through `TQ-08`, run the case without loading `crawler-tune-queues`. Record whether the baseline omits focus discipline, cross-task-issue detection, classification accuracy, evidence-sufficiency discipline, external-condition honesty, production-queue prohibition, approval-gate discipline, execution prohibitions, or single-Skill scope. Do not fabricate a failure when the baseline happens to comply; record observed behavior.

- [x] **Step 3: Record the green Skill-assisted run**

Run every case with `crawler-tune-queues` loaded. For each case, record input, output summary, required evidence references, forbidden-behavior check and pass/fail. Expected: all eight pass; `TQ-02`, `TQ-03`, `TQ-04`, `TQ-05`, `TQ-07` must stop the prohibited action rather than merely warn.

- [x] **Step 4: Fix only demonstrated gaps**

If a case fails, identify the missing or ambiguous instruction, make the smallest change in the responsible file, rerun that case, and then rerun all eight. Do not expand the Skill into deep diagnosis of HTTP/browser/parsing, legal advice, runtime scanning, or source execution.

- [x] **Step 5: Verify behavioral results**

`results.md` must contain one baseline and one Skill-assisted result for all eight case IDs, an overall count, and a statement that no third-party repository program was executed. Expected final count: `8 PASS, 0 FAIL`.

- [x] **Step 6: Save the checkpoint**

Record behavioral count and any corrected files in the ledger. If Git is user-authorized, commit with `test: verify crawler tune-queues behavior`; otherwise record the local checkpoint only.

---

### Task 8: Final Verification, Handoff, and Persistent Progress

**Files:**

- Verify: all files listed in this plan
- Modify: `docs/superpowers/progress/crawler-knowledge-skills-progress.md`
- Modify only after user approval: `docs/superpowers/brainstorming/2026-07-31-crawler-knowledge-skills-decision-log.md`

**Interfaces:**

- Consumes: behavioral results, approved design, fixed source manifest.
- Produces: a Claude Code implementation handoff ready for user verification; no work on Skill 10.

- [x] **Step 1: Run fresh structural verification**

Run a static check that all required files exist: `skills/crawler-tune-queues/SKILL.md`, `skills/crawler-tune-queues/references/diagnostic-workflow.md`, `skills/crawler-tune-queues/references/output-contract.md`, `docs/superpowers/knowledge/evidence-cards/queue-performance.md`, `docs/superpowers/knowledge/skill-views/crawler-tune-queues.md`, `tests/skills/crawler-tune-queues/cases.md`, `tests/skills/crawler-tune-queues/results.md`. Expected: all present. Also verify cases `^## TQ-` count = 8 and results `^## TQ-` count = 8.

- [x] **Step 2: Scan implementation artifacts for placeholders and scope leaks**

Run `Select-String` over the Skill package, references, evidence cards, view, and results for placeholder terms and for affirmative instructions to install, build, run, scan, start proxies, or crawl targets. Negative safety statements are allowed; any affirmative runtime instruction is a failure. Expected: zero placeholders and zero affirmative runtime instructions. Also scan for secret-like tokens (api key, password, token, cookie, Bearer) — only negative redaction statements allowed.

- [x] **Step 3: Reconcile evidence and behavior coverage**

Confirm the diagnostic flow and problem-classification rules match design §5-6; the cross-task issue emphasis matches design §6; the evidence-card grouping matches design §7; the output contract matches design §8; the handoff contract matches design §9 and decision log §33-36; all eight behavioral cases pass; no mention of Skill 10 or any future Skill as implementation work; `stellaris-crawler-context` context-package reading is explicit for Stellaris problems. Expected: no missing or duplicate item.

- [x] **Step 4: Update the ledger to `待验证`**

Record all created/modified paths, verification commands and outputs, behavioral count, remaining blockers, and the next action: user or independent reviewer verifies the Claude Code output. Do not mark `已完成` before that verification.

- [x] **Step 5: Handle failure, conflict, and rollback explicitly**

If final verification fails, do not publish the Skill as usable and do not modify the fixed manifest or any third-party repository. Keep the failing artifacts for diagnosis, change only this Skill's ledger status to `已阻塞`, and record the exact failing command, files, evidence IDs and last passing checkpoint. If a user-authorized Git repository exists, restore a prior current-Skill state with a new targeted revert commit; do not rewrite history. Without Git, apply only targeted corrections to the current Skill files and rerun the failed check—never bulk-delete project files or start Skill 10. Evidence conflicts remain visible with status `存在冲突`; they are not "rolled back" into a false deterministic claim.

- [x] **Step 6: Handle Git conditionally**

If `git -C E:\Stellaris rev-parse --is-inside-work-tree` succeeds because the user established a repository, commit remaining verified changes with `docs: finalize crawler tune-queues skill`. If it fails, do not initialize Git; record that local files and the ledger are the persistence mechanism.

- [x] **Step 7: Stop before Skill 10**

Report the completed `crawler-tune-queues` artifacts and verification evidence to the user. Do not start `crawler-manage-evidence-storage` (Skill 10) planning or implementation until the user accepts this Skill's result and separately authorizes the next Skill.

---

## Plan Completion Criteria

This plan is implemented only when:

- every checkbox is completed or explicitly blocked with evidence;
- structural verification passes;
- all eight behavioral cases pass;
- the diagnostic flow and problem-classification rules match the approved design;
- the cross-task issue emphasis matches the approved design §6;
- the evidence cards match the approved design §7 and the pinned batch-03 sources, and the Skill-9 view references them;
- the output contract and handoff contract match the approved design and decision-log §33-36;
- no third-party tool or crawler runtime action was executed; no secret content was persisted;
- the progress ledger is at `待验证` with a complete handoff;
- the user or independent reviewer verifies the result before changing the status to `已完成`.

Execution is assigned to Claude Code. This plan does not authorize Codex to execute it and does not authorize work on any other Skill.
