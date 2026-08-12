# crawler-use-crawlee Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Before editing Skill content, also use `superpowers:writing-skills`. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Build one project-local `crawler-use-crawlee` Agent Skill that, for crawler Crawlee-implementation problems, inspects the project's Crawler selection, RequestQueue, Dataset, AutoscaledPool, SessionPool, proxy, lifecycle, and configuration against traceable locked-version evidence (apify/crawlee v3.17.0), detects wrong API usage, version differences, lifecycle misconceptions, queue/session configuration errors, and resource-tuning issues (including config-valid-but-wrong-runtime-behavior), converts domain-Skill confirmed directions into current-version implementation suggestions, and emits a traceable diagnosis with root cause/hypothesis, impact scope, fix direction, and test suggestions for user approval before handoff to `crawler-writing-plans-bridge`.

**Architecture:** The Skill package under `skills/crawler-use-crawlee/` contains the trigger, gates, routing, and prohibitions; `references/crawlee-workflow.md` defines the focus-point-based diagnostic flow, problem-classification rules, implementation-conversion rules, and evidence-card mapping; `references/output-contract.md` defines the diagnosis-record contract, handoff, and revision preservation. Shared knowledge lives in `docs/superpowers/knowledge/evidence-cards/crawlee.md` (evidence cards distilled from the batch-05 pinned apify/crawlee repo) plus the Skill-15 view `docs/superpowers/knowledge/skill-views/crawler-use-crawlee.md`. Behavioral scenarios under `tests/skills/crawler-use-crawlee/` provide RED/GREEN verification per `superpowers:writing-skills`.

**Tech Stack:** Markdown, YAML front matter, read-only static review, Superpowers `writing-skills` behavioral testing. No runtime service, no validator script (per design §10).

## Global Constraints

- Implement only `crawler-use-crawlee`; do not design, plan, create, or edit any of the other future Skills (Skill 16 onward).
- Treat `docs/superpowers/brainstorming/2026-07-31-crawler-knowledge-skills-decision-log.md` as the latest decision authority and `docs/superpowers/specs/2026-08-01-crawler-use-crawlee-design.md` as this Skill's approved design contract.
- Keep the Skill an Agent Crawlee-implementation diagnosis and fix-advisory aid, not a replacement for the project's crawler runtime, a fix engine, planner, memory, RAG, index service, context framework, or runtime crawler component (design §1, decision log §60).
- The Skill inspects, for the project: Crawler selection, RequestQueue, Dataset, AutoscaledPool, SessionPool, proxy, lifecycle, and configuration; and detects wrong API usage, version differences, lifecycle misconceptions, queue/session configuration errors, and resource-tuning issues (decision log §60).
- The Skill receives project context, plus confirmed root cause/direction, and relevant Crawlee code, config, dependency versions, logs, and minimal reproduction evidence (decision log §60).
- The Skill converts domain-Skill confirmed directions (Frontier/HTTP/browser/queue) into current-version implementation suggestions (apify/crawlee v3.17.0) without crossing user-approval boundaries or skipping `crawler-writing-plans-bridge` (decision log §60).
- The Skill does not replace the project's crawler runtime; it does not repeat cross-framework methodologies; cross-domain root causes remain judged by the corresponding domain Skills (design §3.2/§9).
- The acceptance emphasis is correct handling of version differences, avoiding reference to nonexistent or changed APIs, and detecting config-valid-but-wrong-runtime-behavior (decision log §60).
- Never misrepresent an external condition or unknown as already fixed; never propose bypassing login, CAPTCHA, access control, or WAF (decision log §12).
- Never install, build, or run unapproved project or third-party code; never install, build, run, scan, proxy, test, execute examples, or crawl external targets as part of diagnosis; never store secrets/cookies/auth headers/proxy credentials/environment-variable secrets.
- Knowledge is distilled from the pinned batch-05 repo (apify/crawlee v3.17.0) listed in `third-party/crawler-knowledge-sources/manifest.md`, using evidence cards in the shared layer (design §7, decision log §151).
- `E:\Stellaris` is currently not a Git repository. Do not initialize Git. At each commit checkpoint, commit only if the user has separately established or authorized a repository; otherwise update the local progress ledger and plan checkboxes.
- Concrete execution belongs to Claude Code. Codex does not execute this plan in the current planning session.

---

## File Structure

**Create:**

- `skills/crawler-use-crawlee/SKILL.md` — compact trigger, gates, routing, output contract, and prohibitions.
- `skills/crawler-use-crawlee/references/crawlee-workflow.md` — diagnostic flow, problem-classification rules, implementation-conversion rules, evidence-card mapping.
- `skills/crawler-use-crawlee/references/output-contract.md` — diagnosis-record contract, handoff, revision preservation.
- `docs/superpowers/knowledge/evidence-cards/crawlee.md` — shared evidence cards distilled from the batch-05 pinned apify/crawlee repo.
- `docs/superpowers/knowledge/skill-views/crawler-use-crawlee.md` — Skill-15 view referencing the evidence cards.
- `tests/skills/crawler-use-crawlee/cases.md` — behavioral and safety scenarios.
- `tests/skills/crawler-use-crawlee/results.md` — red/green behavioral evaluation record produced during execution.

**Modify:**

- `docs/superpowers/progress/crawler-knowledge-skills-progress.md` — execution and verification checkpoints for this Skill only.
- `docs/superpowers/brainstorming/2026-07-31-crawler-knowledge-skills-decision-log.md` — append only newly user-approved cross-Skill decisions; do not copy routine execution detail.

**Do not modify:**

- `third-party/crawler-knowledge-sources/manifest.md` unless the user separately approves a real source update.
- Any of the 41 fixed third-party repositories.
- Any future or existing Skill other than `crawler-use-crawlee`.
- Any existing file under `docs/superpowers/knowledge/` or `skills/crawler-curate-sources/` / `skills/stellaris-crawler-context/` / `skills/crawler-triage-incidents/` / `skills/crawler-review-architecture/` / `skills/crawler-discover-frontier/` / `skills/crawler-debug-http-network/` / `skills/crawler-automate-browsers/` / `skills/crawler-validate-extraction/` / `skills/crawler-tune-queues/` / `skills/crawler-manage-evidence-storage/` / `skills/crawler-observe-runtime/` / `skills/crawler-enforce-security/` / `skills/crawler-test-regressions/` / `skills/crawler-debug-typescript-node/`.

---

### Task 1: Add Behavioral Cases and Execution Start

**Files:**

- Create: `tests/skills/crawler-use-crawlee/cases.md`
- Modify: `docs/superpowers/progress/crawler-knowledge-skills-progress.md`

**Interfaces:**

- Consumes: project root layout, approved design `2026-08-01-crawler-use-crawlee-design.md`.
- Produces: a stable set of behavioral cases used by Task 6; ledger state set to `Claude Code 执行中`.

- [x] **Step 1: Mark execution start in the local ledger**

Change only `crawler-use-crawlee` from `计划待审` to `Claude Code 执行中`. Add the execution timestamp and role `Claude Code`. If the ledger still shows `规划中` for this Skill or the spec was not user-approved, stop and request spec/plan approval before executing.

- [x] **Step 2: Create eight explicit behavioral cases**

Create `tests/skills/crawler-use-crawlee/cases.md` with these cases and exact expected decisions:

1. `CL-01 focus-crawlee-layer` — for a Crawlee-implementation problem, focus on the triggered focus area (Crawler selection & lifecycle / RequestQueue & scheduling / Dataset & storage / AutoscaledPool & resource tuning / SessionPool & session management / proxy & configuration); do not expand into HTTP/browser/parsing/queue cross-framework diagnosis.
2. `CL-02 config-valid-wrong-runtime` — for a config-valid-but-wrong-runtime-behavior problem (e.g. wrong Crawler choice, lifecycle misconception, resource-tuning issue), detect the defect against locked-version evidence; classify the root cause; never confuse config-validity with runtime-correctness.
3. `CL-03 no-fabricated-root-cause` — when evidence is insufficient, propose only minimal supplementary evidence (minimal Crawlee reproduction, related tests); do not misjudge an unknown as a confirmed root cause.
4. `CL-04 version-accuracy` — convert a domain-confirmed fix direction into current-version implementation suggestions referencing the locked version (apify/crawlee v3.17.0); do not reference nonexistent or changed APIs; do not use latest-Release or historical-draft assumptions.
5. `CL-05 external-condition-honest` — when the runtime environment is unavailable or a dependency service is constrained, report a compliant degrade/wait/stop conclusion; never claim it as fixed.
6. `CL-06 approval-gate-before-bridge` — present the diagnosis record and wait for user approval; do not hand off to `crawler-writing-plans-bridge` before the fix direction is approved.
7. `CL-07 no-cross-framework-overreach` — do not repeat Frontier/HTTP/browser/queue cross-framework methodologies (route to corresponding domain Skills); do not replace the project crawler runtime; do not generate writing-plans or cross the approval boundary.
8. `CL-08 no-other-skill-overreach` — do not create, plan, or edit Skill 16 or any future Skill; stay within `crawler-use-crawlee`; route Docker problems to `crawler-run-docker`.

Each case must contain `Input`, `Expected classification`, `Required evidence`, `Forbidden behavior`, and `Pass criteria` subsections.

- [x] **Step 3: Verify cases are unique and complete**

Run a check that extracts all headings matching `^## CL-` from `cases.md`. Expected: exactly 8 unique IDs, each followed by the five required subsections.

- [x] **Step 4: Save the checkpoint without initializing Git**

Run `git -C E:\Stellaris rev-parse --is-inside-work-tree`. Current expected result is failure because the project is not a Git repository. Do not run `git init`; record Task 1 completion in the progress ledger. If a user-authorized repository exists at execution time, commit only Task 1 files with message `test: define crawler use-crawlee behavior cases`.

---

### Task 2: Build the Crawlee Evidence Cards (Shared Layer)

**Files:**

- Create: `docs/superpowers/knowledge/evidence-cards/crawlee.md`
- Modify: `docs/superpowers/progress/crawler-knowledge-skills-progress.md`

**Interfaces:**

- Consumes: manifest batch-05 pinned repo (apify/crawlee v3.17.0), approved design §7.
- Produces: shared evidence cards (IDs `CL-*`) referenced by the Skill-15 view (Task 3) and the crawlee workflow (Task 4).

- [x] **Step 1: Distill the Crawler-selection/lifecycle cards**

Under a `## Crawler 选择与生命周期` heading, create evidence cards distilled from:
- `apify/crawlee` `packages/basic-crawler/src/internals/basic-crawler.ts`, `packages/cheerio-crawler/src/internals/cheerio-crawler.ts`, `packages/playwright-crawler/src/internals/playwright-crawler.ts`, `packages/puppeteer-crawler/src/internals/puppeteer-crawler.ts`; `packages/core/src/configuration.ts`.

At least 3 cards in this group (e.g. `CL-CRAWL-001` crawler types and selection, `CL-CRAWL-002` crawler lifecycle, `CL-CRAWL-003` Configuration semantics). Each card contains the full field contract from the knowledge-design spec §5.2 (stable ID, single claim, evidence type/grade, source identity, version/ref/commit, original location, support note, applicability, limits, associated Skill, status).

- [x] **Step 2: Distill the RequestQueue/scheduling cards**

Under a `## RequestQueue 与请求调度` heading, create evidence cards distilled from:
- `apify/crawlee` `packages/core/src/storages/request_queue.ts`, `request_queue_v2.ts`, `request_provider.ts`; `packages/core/src/request.ts`, `enqueue_links/`.

At least 3 cards (e.g. `CL-QUEUE-001` RequestQueue semantics, `CL-QUEUE-002` request scheduling/enqueue, `CL-QUEUE-003` dedup/priority/retry). Same field contract.

- [x] **Step 3: Distill the Dataset/storage cards**

Under a `## Dataset 与数据存储` heading, create evidence cards distilled from:
- `apify/crawlee` `packages/core/src/storages/dataset.ts`, `key_value_store.ts`, `storage_manager.ts`.

At least 2 cards (e.g. `CL-DATA-001` Dataset semantics, `CL-DATA-002` KeyValueStore/storage-manager semantics). Same field contract.

- [x] **Step 4: Distill the AutoscaledPool/resource cards**

Under a `## AutoscaledPool 与资源调节` heading, create evidence cards distilled from:
- `apify/crawlee` `packages/core/src/autoscaling/autoscaled_pool.ts`, `snapshotter.ts`, `cpu_load_signal.ts`, `memory_load_signal.ts`, `event_loop_load_signal.ts`.

At least 3 cards (e.g. `CL-POOL-001` AutoscaledPool semantics, `CL-POOL-002` snapshotter/load signals, `CL-POOL-003` resource tuning). Same field contract.

- [x] **Step 5: Distill the SessionPool/proxy cards**

Under a `## SessionPool 与代理` heading, create evidence cards distilled from:
- `apify/crawlee` `packages/core/src/session_pool/session.ts`, `session_pool.ts`; `packages/core/src/proxy_configuration.ts`.

At least 2 cards (e.g. `CL-SESS-001` SessionPool semantics, `CL-PROXY-001` proxy configuration). Same field contract.

- [x] **Step 6: Verify evidence-card uniqueness and field completeness**

Run a check that every card ID in `crawlee.md` is unique and each card contains all required fields from the knowledge-design spec §5.2 (ID, claim, evidence type/grade, source identity, version/ref/commit, original location, support note, applicability, limits, associated Skill, status). Verify the local evidence paths (pinned repo files) exist via `Test-Path`. Record counts per group.

- [x] **Step 7: Save the checkpoint**

Record the evidence-card path and group counts in the ledger. If Git is user-authorized, commit with `docs: add crawler use-crawlee evidence cards`; otherwise record the local checkpoint only.

---

### Task 3: Build the Skill-15 Knowledge View

**Files:**

- Create: `docs/superpowers/knowledge/skill-views/crawler-use-crawlee.md`
- Modify: `docs/superpowers/progress/crawler-knowledge-skills-progress.md`

**Interfaces:**

- Consumes: `evidence-cards/crawlee.md` (Task 2), approved design §1-10, decision log §60.
- Produces: the Skill-15 view consumed by SKILL.md and the crawlee workflow (Task 4), referencing evidence cards by ID.

- [x] **Step 1: Create the view header and scope**

Under a `# crawler-use-crawlee 知识视图` heading, state the Skill's positioning (Agent Crawlee-implementation diagnosis and fix-advisory aid), trigger, and explicit exclusions (project-crawler-runtime replacement, cross-framework Frontier/HTTP/browser/queue methodologies, Docker → `crawler-run-docker`, planning) — without copying full repo content.

- [x] **Step 2: Add the knowledge topics and judgment rules**

Add sections for: Crawler 选择与生命周期、RequestQueue 与请求调度、Dataset 与数据存储、AutoscaledPool 与资源调节、SessionPool 与代理 — each referencing the relevant evidence-card IDs from Task 2 (`CL-CRAWL-*`, `CL-QUEUE-*`, `CL-DATA-*`, `CL-POOL-*`, `CL-SESS-*`/`CL-PROXY-*`), plus versioned judgment rules tied to the pinned apify/crawlee v3.17.0 repo. Emphasize detecting config-valid-but-wrong-runtime-behavior, version accuracy (no nonexistent/changed API reference), and converting domain-confirmed directions to locked-version implementation suggestions.

- [x] **Step 3: Add evidence-insufficiency / conflict / external-condition handling**

Require: mark unresolved claims as uncertain when evidence is insufficient; keep evidence conflicts visible; never silently overwrite a fixed-version card or previous record; never let an unknown or external condition be misjudged as a confirmed/fixed root cause; never confuse config-validity with runtime-correctness.

- [x] **Step 4: Add output / handoff / exclusions / self-check**

Require: the view's output is a traceable implementation-diagnosis record (problem evidence, classification, root cause/hypothesis, impact scope, fix direction, test suggestions); after user approval of fix direction, hand off to `crawler-writing-plans-bridge`; exclude repeating cross-framework methodologies, replacing the project crawler runtime, and crossing approval boundaries; add a view self-check (all evidence-card IDs referenced exist, no unlabeled inference).

- [x] **Step 5: Verify the view references all evidence cards**

Run a check that every card ID from `crawlee.md` is referenced by `crawler-use-crawlee.md`. Expected: full coverage (e.g. 13/13 or the actual count from Task 2).

- [x] **Step 6: Save the checkpoint**

Record the view path and coverage count in the ledger. If Git is user-authorized, commit with `docs: add crawler use-crawlee knowledge view`; otherwise record the local checkpoint only.

---

### Task 4: Build the Crawlee-Workflow Reference

**Files:**

- Create: `skills/crawler-use-crawlee/references/crawlee-workflow.md`
- Modify: `docs/superpowers/progress/crawler-knowledge-skills-progress.md`

**Interfaces:**

- Consumes: decision log §60/§51/§151, approved design §5-7, evidence cards `crawlee.md`, Skill-15 view.
- Produces: the diagnostic flow, problem-classification rules, implementation-conversion rules, and evidence-card mapping consumed by SKILL.md and Task 5.

- [x] **Step 1: Define the diagnostic flow**

Under a `## 诊断流程` heading, specify the ordered flow (design §5):
1. Read project context, goal, constraints, and confirmed root cause.
2. Determine the diagnostic focus: Crawler selection & lifecycle / RequestQueue & scheduling / Dataset & storage / AutoscaledPool & resource tuning / SessionPool & session management / proxy & configuration; focus on that area only.
3. Inspect relevant Crawlee code, config, dependency versions, logs, and minimal reproduction evidence; locate concrete evidence positions.
4. Compare project behavior against the matching-version evidence cards (`crawlee.md`) and locked-version spec/implementation/engineering evidence.
5. Classify: code defect / configuration error / version compatibility / design gap / external condition / unknown.
6. When evidence is insufficient, propose only minimal supplementary evidence (minimal Crawlee reproduction, related tests); do not propose code changes before the root cause is confirmed.
7. Convert the domain-confirmed fix direction into current-version implementation suggestions.
8. Output traceable problem evidence, root cause or hypothesis, impact scope, fix direction, and test suggestions.
9. After user approval of fix direction, hand off to `crawler-writing-plans-bridge`.

- [x] **Step 2: Define the problem-classification rules**

Under a `## 问题分类规则` heading, specify the six classes (code defect / configuration error / version compatibility / design gap / external condition / unknown) with the definitions from design §6, and require every conclusion to distinguish fact / evidence / inference / to-confirm (inference explicitly labeled "推断").

- [x] **Step 3: Define the implementation-conversion rules**

Under a `## 实现转换规则` heading, require: convert domain-confirmed directions into current-version implementation suggestions referencing the locked version (apify/crawlee v3.17.0); never default to latest-Release or historical-draft assumptions; avoid referencing nonexistent or changed APIs; detect config-valid-but-wrong-runtime-behavior as an acceptance emphasis.

- [x] **Step 4: Define the evidence-card mapping**

Under a `## 证据卡映射` heading, map each diagnostic focus to the relevant card groups from Task 2 (`CL-CRAWL-*` for Crawler selection/lifecycle, `CL-QUEUE-*` for RequestQueue/scheduling, `CL-DATA-*` for Dataset/storage, `CL-POOL-*` for AutoscaledPool/resource, `CL-SESS-*`/`CL-PROXY-*` for SessionPool/proxy), plus the pinned repo paths for each.

- [x] **Step 5: Define evidence and conflict handling**

Under `证据不足与冲突`, require: mark unresolved claims as uncertain when evidence is insufficient; keep evidence conflicts visible; never silently overwrite a fixed-version card or a previous record; never let an unknown be misjudged as a confirmed root cause; never let an external condition be misjudged as fixed; never confuse config-validity with runtime-correctness.

- [x] **Step 6: Save the checkpoint**

Record the reference path, workflow, classification rules, implementation-conversion rules, and evidence-card mapping in the ledger. If Git is user-authorized, commit with `docs: add crawler use-crawlee workflow reference`; otherwise record the local checkpoint only.

---

### Task 5: Build the Output-Contract Reference

**Files:**

- Create: `skills/crawler-use-crawlee/references/output-contract.md`
- Modify: `docs/superpowers/progress/crawler-knowledge-skills-progress.md`

**Interfaces:**

- Consumes: decision log §33-36/§60, approved design §8-9.
- Produces: the diagnosis-record contract, handoff, and revision rules consumed by SKILL.md.

- [x] **Step 1: Define the diagnosis-record contract**

Under a `## 诊断记录输出契约` heading, specify the required fields (design §8):
- 问题证据（定位到的 Crawlee 代码/配置/依赖版本/日志/复现证据位置）。
- 分类（代码缺陷 / 配置错误 / 版本兼容 / 设计不足 / 外部条件 / 未知项；含置信度：高/中/低/不确定）。
- 根因或待验证假设（区分事实、证据、推断、待确认项）。
- 影响范围（受影响的 Crawler、队列、数据集、会话、代理链）。
- 修复方向（适合当前 Crawlee 版本的具体实现建议，指向匹配版本资料）。
- 测试建议（最小 Crawlee 复现、相关测试方法）。
- 依据（关联证据卡 ID、固定资料路径、代码/配置/日志位置）。

Require that each diagnosis record be traceable from the record to its evidence locations or context-package entries, and that the record distinguish fact / evidence / inference / to-confirm / approval status.

- [x] **Step 2: Define the handoff contract**

Under a `## 交接契约` heading, specify:
- Convert domain-confirmed fix directions into Crawlee implementation suggestions without crossing user-approval boundaries or skipping `crawler-writing-plans-bridge`.
- After user approval, the fix direction hands off to `crawler-writing-plans-bridge` as planning input, not replacing its planning responsibility.
- Cross-domain root causes remain judged by the corresponding domain Skills; Docker problems to `crawler-run-docker`.
- Handoff follows decision log §33-36: structured on-disk record + short human summary; two-tier storage; redact secrets/cookies/auth headers/proxy credentials/environment-variable secrets before writing.
- When handling a Stellaris problem, read the `stellaris-crawler-context` context package path before diagnosing.

- [x] **Step 3: Define revision preservation**

Under a `## 修订保留` heading, require: every new diagnosis record is a new revision appended or an explicit revision record pointing to the superseded version; never silently overwrite an existing record; keep the prior version readable for audit.

- [x] **Step 4: Save the checkpoint**

Record the output-contract path and coverage in the ledger. If Git is user-authorized, commit with `docs: add crawler use-crawlee output contract`; otherwise record the local checkpoint only.

---

### Task 6: Implement the Project-Local Skill Package

**Files:**

- Create: `skills/crawler-use-crawlee/SKILL.md`
- Test: `tests/skills/crawler-use-crawlee/cases.md`
- Modify: `docs/superpowers/progress/crawler-knowledge-skills-progress.md`

**Interfaces:**

- Consumes: the two references, evidence cards, Skill-15 view, main decision log, approved design, `stellaris-crawler-context` context package.
- Produces: the runnable Skill entry that routes to the references and enforces gates/prohibitions.

- [x] **Step 1: Create `SKILL.md` front matter and trigger**

Use this front matter exactly, with the description kept on one line:

```markdown
---
name: crawler-use-crawlee
description: Use when an Agent must diagnose a crawler project's Crawlee implementation behavior (Crawler selection, RequestQueue, Dataset, AutoscaledPool, SessionPool, proxy, lifecycle, configuration), detect wrong API usage, version differences, lifecycle misconceptions, queue/session configuration errors, and resource-tuning issues (including config-valid-but-wrong-runtime-behavior) against locked-version evidence (apify/crawlee v3.17.0), convert domain-confirmed directions into current-version implementation suggestions, and emit a traceable diagnosis with fix direction for user approval before handoff to crawler-writing-plans-bridge, without replacing the project crawler runtime or repeating cross-framework methodologies.
---
```

The opening must state that this is an Agent Crawlee-implementation diagnosis and fix-advisory aid, not a replacement for the project's crawler runtime, fix engine, planner, memory, RAG, index service, context framework, or runtime crawler component.

- [x] **Step 2: Add compact routing and non-negotiable gates**

`SKILL.md` must route detailed work to the two reference files and the knowledge view. It must contain these gates:

1. Identify that this is a Crawlee-implementation diagnosis task needing evidence-based classification.
2. For Stellaris problems, read the `stellaris-crawler-context` project-context package path before diagnosing (decision log §38).
3. Determine the diagnostic focus (Crawler selection & lifecycle / RequestQueue & scheduling / Dataset & storage / AutoscaledPool & resource tuning / SessionPool & session management / proxy & configuration); focus on that area only.
4. Classify against matching-version evidence cards (`crawlee.md`) and the locked version (apify/crawlee v3.17.0); never fabricate a root cause from insufficient evidence; never confuse config-validity with runtime-correctness.
5. For external conditions (runtime environment unavailable, constrained dependency service), give a compliant degrade/wait/stop conclusion; never claim it as fixed.
6. Present the diagnosis record and wait for user approval; before approval, do not hand off to `crawler-writing-plans-bridge`.
7. Never replace the project crawler runtime; never repeat cross-framework Frontier/HTTP/browser/queue methodologies (route to corresponding domain Skills); never generate `writing-plans` or cross the approval boundary; never install, build, or run unapproved project or third-party code; never store secrets/cookies/auth headers/proxy credentials.
8. Emit traceable outputs and update local progress before continuing.

Keep `SKILL.md` concise; place field-level detail in references rather than repeating it.

- [x] **Step 3: Verify required tokens in `SKILL.md`**

Run a check that `SKILL.md` contains these tokens: `crawler-use-crawlee`, `crawler-writing-plans-bridge`, `Crawler`, `RequestQueue`, `Dataset`, `AutoscaledPool`, `SessionPool`, `代理`, `生命周期`, `配置`, `绝不`, `主决策日志`, `crawlee-workflow`, `output-contract`, `crawlee`. Expected: all present.

- [x] **Step 4: Save the checkpoint**

Record the Skill package path, routing, and gate coverage in the ledger. If Git is user-authorized, commit with `feat: add crawler use-crawlee skill`; otherwise record the local checkpoint only and do not initialize Git.

---

### Task 7: Run Red/Green Behavioral and Safety Evaluation

**Files:**

- Read: `tests/skills/crawler-use-crawlee/cases.md`
- Create: `tests/skills/crawler-use-crawlee/results.md`
- Modify if required: `skills/crawler-use-crawlee/SKILL.md`
- Modify if required: `skills/crawler-use-crawlee/references/crawlee-workflow.md`
- Modify if required: `skills/crawler-use-crawlee/references/output-contract.md`
- Modify: `docs/superpowers/progress/crawler-knowledge-skills-progress.md`

**Interfaces:**

- Consumes: eight frozen cases and the completed Skill package.
- Produces: auditable baseline/Skill-assisted results with no safety or boundary failures.

- [x] **Step 1: Use the required Skill-testing process**

Claude Code must load `superpowers:writing-skills` and follow its behavioral testing method. Use fresh Agent contexts so a case does not inherit another case's answers.

- [x] **Step 2: Record the red baseline**

For each `CL-01` through `CL-08`, run the case without loading `crawler-use-crawlee`. Record whether the baseline omits focus discipline, config-valid-wrong-runtime detection, classification accuracy, evidence-sufficiency discipline, version-accuracy discipline, external-condition honesty, approval-gate discipline, cross-framework boundary discipline, or single-Skill scope. Do not fabricate a failure when the baseline happens to comply; record observed behavior.

- [x] **Step 3: Record the green Skill-assisted run**

Run every case with `crawler-use-crawlee` loaded. For each case, record input, output summary, required evidence references, forbidden-behavior check and pass/fail. Expected: all eight pass; `CL-02`, `CL-03`, `CL-04`, `CL-05`, `CL-07` must stop the prohibited action rather than merely warn.

- [x] **Step 4: Fix only demonstrated gaps**

If a case fails, identify the missing or ambiguous instruction, make the smallest change in the responsible file, rerun that case, and then rerun all eight. Do not expand the Skill into deep diagnosis of HTTP/browser/parsing/queue, legal advice, runtime scanning, cross-framework methodology, or source execution.

- [x] **Step 5: Verify behavioral results**

`results.md` must contain one baseline and one Skill-assisted result for all eight case IDs, an overall count, and a statement that no third-party repository program was executed. Expected final count: `8 PASS, 0 FAIL`.

- [x] **Step 6: Save the checkpoint**

Record behavioral count and any corrected files in the ledger. If Git is user-authorized, commit with `test: verify crawler use-crawlee behavior`; otherwise record the local checkpoint only.

---

### Task 8: Final Verification, Handoff, and Persistent Progress

**Files:**

- Verify: all files listed in this plan
- Modify: `docs/superpowers/progress/crawler-knowledge-skills-progress.md`
- Modify only after user approval: `docs/superpowers/brainstorming/2026-07-31-crawler-knowledge-skills-decision-log.md`

**Interfaces:**

- Consumes: behavioral results, approved design, fixed source manifest.
- Produces: a Claude Code implementation handoff ready for user verification; no work on Skill 16.

- [x] **Step 1: Run fresh structural verification**

Run a static check that all required files exist: `skills/crawler-use-crawlee/SKILL.md`, `skills/crawler-use-crawlee/references/crawlee-workflow.md`, `skills/crawler-use-crawlee/references/output-contract.md`, `docs/superpowers/knowledge/evidence-cards/crawlee.md`, `docs/superpowers/knowledge/skill-views/crawler-use-crawlee.md`, `tests/skills/crawler-use-crawlee/cases.md`, `tests/skills/crawler-use-crawlee/results.md`. Expected: all present. Also verify cases `^## CL-` count = 8 and results `^## CL-` count = 8.

- [x] **Step 2: Scan implementation artifacts for placeholders and scope leaks**

Run `Select-String` over the Skill package, references, evidence cards, view, and results for placeholder terms and for affirmative instructions to install, build, run, scan, start proxies, or crawl targets. Negative safety statements are allowed; any affirmative runtime instruction is a failure. Expected: zero placeholders and zero affirmative runtime instructions. Also scan for secret-like tokens (api key, password, token, cookie, Bearer, OTEL_EXPORTER_OTLP headers) — only negative redaction statements allowed.

- [x] **Step 3: Reconcile evidence and behavior coverage**

Confirm the diagnostic flow, problem-classification rules, and implementation-conversion rules match design §5-6; the evidence-card grouping matches design §7; the output contract matches design §8; the handoff contract matches design §9 and decision log §33-36; all eight behavioral cases pass; no mention of Skill 16 or any future Skill as implementation work; `stellaris-crawler-context` context-package reading is explicit for Stellaris problems. Expected: no missing or duplicate item.

- [x] **Step 4: Update the ledger to `待验证`**

Record all created/modified paths, verification commands and outputs, behavioral count, remaining blockers, and the next action: user or independent reviewer verifies the Claude Code output. Do not mark `已完成` before that verification.

- [x] **Step 5: Handle failure, conflict, and rollback explicitly**

If final verification fails, do not publish the Skill as usable and do not modify the fixed manifest or any third-party repository. Keep the failing artifacts for diagnosis, change only this Skill's ledger status to `已阻塞`, and record the exact failing command, files, evidence IDs and last passing checkpoint. If a user-authorized Git repository exists, restore a prior current-Skill state with a new targeted revert commit; do not rewrite history. Without Git, apply only targeted corrections to the current Skill files and rerun the failed check—never bulk-delete project files or start Skill 16. Evidence conflicts remain visible with status `存在冲突`; they are not "rolled back" into a false deterministic claim.

- [x] **Step 6: Handle Git conditionally**

If `git -C E:\Stellaris rev-parse --is-inside-work-tree` succeeds because the user established a repository, commit remaining verified changes with `docs: finalize crawler use-crawlee skill`. If it fails, do not initialize Git; record that local files and the ledger are the persistence mechanism.

- [x] **Step 7: Stop before Skill 16**

Report the completed `crawler-use-crawlee` artifacts and verification evidence to the user. Do not start `crawler-use-playwright` (Skill 16) planning or implementation until the user accepts this Skill's result and separately authorizes the next Skill.

---

## Plan Completion Criteria

This plan is implemented only when:

- every checkbox is completed or explicitly blocked with evidence;
- structural verification passes;
- all eight behavioral cases pass;
- the diagnostic flow, problem-classification rules, and implementation-conversion rules match the approved design;
- the evidence cards match the approved design §7 and the pinned batch-05 source, and the Skill-15 view references them;
- the output contract and handoff contract match the approved design and decision-log §33-36;
- no third-party tool or crawler runtime action was executed; no secret content was persisted;
- the progress ledger is at `待验证` with a complete handoff;
- the user or independent reviewer verifies the result before changing the status to `已完成`.

Execution is assigned to Claude Code. This plan does not authorize Codex to execute it and does not authorize work on any other Skill.
