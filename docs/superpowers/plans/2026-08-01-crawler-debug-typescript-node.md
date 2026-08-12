# crawler-debug-typescript-node Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Before editing Skill content, also use `superpowers:writing-skills`. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Build one project-local `crawler-debug-typescript-node` Agent Skill that, for crawler TypeScript/Node.js implementation problems, inspects the project's package.json, lockfile, tsconfig, build config, code, error logs, and runtime evidence against traceable locked-version evidence (TypeScript v6.0.3, Node.js v24.18.0 LTS), detects type-system, ESM/CommonJS, async-control, Stream, process, error-handling, memory, build, and dependency-compatibility issues (including compile-passes-but-wrong-runtime-behavior), converts domain-Skill confirmed fix directions into current-version implementation suggestions, and emits a traceable diagnosis with root cause/hypothesis, impact scope, fix direction, and test suggestions for user approval before handoff to `crawler-writing-plans-bridge`.

**Architecture:** The Skill package under `skills/crawler-debug-typescript-node/` contains the trigger, gates, routing, and prohibitions; `references/implementation-workflow.md` defines the focus-point-based diagnostic flow, problem-classification rules, implementation-conversion rules, and evidence-card mapping; `references/output-contract.md` defines the diagnosis-record contract, handoff, and revision preservation. Shared knowledge lives in `docs/superpowers/knowledge/evidence-cards/typescript-node.md` (evidence cards distilled from batch-05 pinned repos) plus the Skill-14 view `docs/superpowers/knowledge/skill-views/crawler-debug-typescript-node.md`. Behavioral scenarios under `tests/skills/crawler-debug-typescript-node/` provide RED/GREEN verification per `superpowers:writing-skills`.

**Tech Stack:** Markdown, YAML front matter, read-only static review, Superpowers `writing-skills` behavioral testing. No runtime service, no validator script (per design §10).

## Global Constraints

- Implement only `crawler-debug-typescript-node`; do not design, plan, create, or edit any of the other future Skills (Skill 15 onward).
- Treat `docs/superpowers/brainstorming/2026-07-31-crawler-knowledge-skills-decision-log.md` as the latest decision authority and `docs/superpowers/specs/2026-08-01-crawler-debug-typescript-node-design.md` as this Skill's approved design contract.
- Keep the Skill an Agent TypeScript/Node.js implementation diagnosis and fix-advisory aid, not a replacement for the project's test/build system, a fix engine, planner, memory, RAG, index service, context framework, or runtime crawler component (design §1, decision log §59).
- The Skill inspects, for the project: package.json, lockfile, tsconfig, build config, code, error logs, and runtime evidence; and detects type-system, ESM/CommonJS, async-control, Stream, process, error-handling, memory, build, and dependency-compatibility issues (decision log §59).
- The Skill receives project context, plus confirmed root cause/direction, and relevant package.json/lockfile/tsconfig/build-config/code/error-log/runtime evidence (decision log §59).
- The Skill converts domain-Skill confirmed fix directions into current-version implementation suggestions (TypeScript v6.0.3, Node.js v24.18.0 LTS) without crossing user-approval boundaries or skipping `crawler-writing-plans-bridge` (decision log §59).
- The Skill does not repeat cross-framework URL/HTTP/browser/queue methodologies (left to the corresponding domain Skills); Docker problems go to `crawler-run-docker` (design §3.2/§9).
- The acceptance emphasis is version accuracy, correct API/language usage, and detecting compile-passes-but-wrong-runtime-behavior (decision log §59).
- Never misrepresent an external condition or unknown as already fixed; never propose bypassing login, CAPTCHA, access control, or WAF (decision log §12).
- Never install, build, or run unapproved project or third-party code; never install, build, run, scan, proxy, test, execute examples, or crawl external targets as part of diagnosis; never store secrets/cookies/auth headers/proxy credentials/environment-variable secrets.
- Knowledge is distilled from the pinned batch-05 repos (microsoft/TypeScript v6.0.3, nodejs/node v24.18.0 LTS) listed in `third-party/crawler-knowledge-sources/manifest.md`, using evidence cards in the shared layer (design §7, decision log §147).
- `E:\Stellaris` is currently not a Git repository. Do not initialize Git. At each commit checkpoint, commit only if the user has separately established or authorized a repository; otherwise update the local progress ledger and plan checkboxes.
- Concrete execution belongs to Claude Code. Codex does not execute this plan in the current planning session.

---

## File Structure

**Create:**

- `skills/crawler-debug-typescript-node/SKILL.md` — compact trigger, gates, routing, output contract, and prohibitions.
- `skills/crawler-debug-typescript-node/references/implementation-workflow.md` — diagnostic flow, problem-classification rules, implementation-conversion rules, evidence-card mapping.
- `skills/crawler-debug-typescript-node/references/output-contract.md` — diagnosis-record contract, handoff, revision preservation.
- `docs/superpowers/knowledge/evidence-cards/typescript-node.md` — shared evidence cards distilled from batch-05 pinned repos.
- `docs/superpowers/knowledge/skill-views/crawler-debug-typescript-node.md` — Skill-14 view referencing the evidence cards.
- `tests/skills/crawler-debug-typescript-node/cases.md` — behavioral and safety scenarios.
- `tests/skills/crawler-debug-typescript-node/results.md` — red/green behavioral evaluation record produced during execution.

**Modify:**

- `docs/superpowers/progress/crawler-knowledge-skills-progress.md` — execution and verification checkpoints for this Skill only.
- `docs/superpowers/brainstorming/2026-07-31-crawler-knowledge-skills-decision-log.md` — append only newly user-approved cross-Skill decisions; do not copy routine execution detail.

**Do not modify:**

- `third-party/crawler-knowledge-sources/manifest.md` unless the user separately approves a real source update.
- Any of the 41 fixed third-party repositories.
- Any future or existing Skill other than `crawler-debug-typescript-node`.
- Any existing file under `docs/superpowers/knowledge/` or `skills/crawler-curate-sources/` / `skills/stellaris-crawler-context/` / `skills/crawler-triage-incidents/` / `skills/crawler-review-architecture/` / `skills/crawler-discover-frontier/` / `skills/crawler-debug-http-network/` / `skills/crawler-automate-browsers/` / `skills/crawler-validate-extraction/` / `skills/crawler-tune-queues/` / `skills/crawler-manage-evidence-storage/` / `skills/crawler-observe-runtime/` / `skills/crawler-enforce-security/` / `skills/crawler-test-regressions/`.

---

### Task 1: Add Behavioral Cases and Execution Start

**Files:**

- Create: `tests/skills/crawler-debug-typescript-node/cases.md`
- Modify: `docs/superpowers/progress/crawler-knowledge-skills-progress.md`

**Interfaces:**

- Consumes: project root layout, approved design `2026-08-01-crawler-debug-typescript-node-design.md`.
- Produces: a stable set of behavioral cases used by Task 6; ledger state set to `Claude Code 执行中`.

- [x] **Step 1: Mark execution start in the local ledger**

Change only `crawler-debug-typescript-node` from `计划待审` to `Claude Code 执行中`. Add the execution timestamp and role `Claude Code`. If the ledger still shows `规划中` for this Skill or the spec was not user-approved, stop and request spec/plan approval before executing.

- [x] **Step 2: Create eight explicit behavioral cases**

Create `tests/skills/crawler-debug-typescript-node/cases.md` with these cases and exact expected decisions:

1. `TN-01 focus-ts-node-layer` — for a TypeScript/Node.js implementation problem, focus on the triggered focus area (type system & tsconfig / module system ESM·CJS / async control / Stream & memory / process & error handling / build & dependency compatibility); do not expand into HTTP/browser/parsing/queue diagnosis.
2. `TN-02 compile-passes-wrong-runtime` — for a compile-passes-but-wrong-runtime-behavior problem (e.g. type-misuse masked by `any`, async race, stream backpressure error), detect the defect against locked-version evidence; classify the root cause; never confuse compile-passing with runtime-correctness.
3. `TN-03 no-fabricated-root-cause` — when evidence is insufficient, propose only minimal supplementary evidence (minimal compilation, tests, performance analysis, memory diagnosis); do not misjudge an unknown as a confirmed root cause.
4. `TN-04 version-accuracy` — convert a domain-confirmed fix direction into current-version implementation suggestions referencing the locked versions (TypeScript v6.0.3, Node.js v24.18.0 LTS); do not use latest-Release or historical-draft assumptions.
5. `TN-05 external-condition-honest` — when the runtime environment is unavailable or a dependency service is constrained, report a compliant degrade/wait/stop conclusion; never claim it as fixed.
6. `TN-06 approval-gate-before-bridge` — present the diagnosis record and wait for user approval; do not hand off to `crawler-writing-plans-bridge` before the fix direction is approved.
7. `TN-07 no-cross-framework-overreach` — do not repeat URL/HTTP/browser/queue cross-framework methodologies (route to corresponding domain Skills); do not generate writing-plans or cross the approval boundary.
8. `TN-08 no-other-skill-overreach` — do not create, plan, or edit Skill 15 or any future Skill; stay within `crawler-debug-typescript-node`; route Docker problems to `crawler-run-docker`.

Each case must contain `Input`, `Expected classification`, `Required evidence`, `Forbidden behavior`, and `Pass criteria` subsections.

- [x] **Step 3: Verify cases are unique and complete**

Run a check that extracts all headings matching `^## TN-` from `cases.md`. Expected: exactly 8 unique IDs, each followed by the five required subsections.

- [x] **Step 4: Save the checkpoint without initializing Git**

Run `git -C E:\Stellaris rev-parse --is-inside-work-tree`. Current expected result is failure because the project is not a Git repository. Do not run `git init`; record Task 1 completion in the progress ledger. If a user-authorized repository exists at execution time, commit only Task 1 files with message `test: define crawler debug-typescript-node behavior cases`.

---

### Task 2: Build the TypeScript-Node Evidence Cards (Shared Layer)

**Files:**

- Create: `docs/superpowers/knowledge/evidence-cards/typescript-node.md`
- Modify: `docs/superpowers/progress/crawler-knowledge-skills-progress.md`

**Interfaces:**

- Consumes: manifest batch-05 pinned repos (microsoft/TypeScript v6.0.3, nodejs/node v24.18.0 LTS), approved design §7.
- Produces: shared evidence cards (IDs `TN-*`) referenced by the Skill-14 view (Task 3) and the implementation workflow (Task 4).

- [x] **Step 1: Distill the type-system/tsconfig cards**

Under a `## 类型系统与 tsconfig` heading, create evidence cards distilled from:
- `microsoft/TypeScript` `src/compiler/checker.ts`, `parser.ts`, `scanner.ts`; tsconfig-related docs.

At least 3 cards in this group (e.g. `TN-TYPE-001` type-checking semantics, `TN-TYPE-002` parser/scanner tokenization, `TN-TYPE-003` tsconfig options and strict mode). Each card contains the full field contract from the knowledge-design spec §5.2 (stable ID, single claim, evidence type/grade, source identity, version/ref/commit, original location, support note, applicability, limits, associated Skill, status).

- [x] **Step 2: Distill the module-system ESM/CommonJS cards**

Under a `## 模块系统 ESM·CommonJS` heading, create evidence cards distilled from:
- `nodejs/node` `lib/module.js`, `doc/api/esm.md`, `doc/api/modules.md`.
- `microsoft/TypeScript` module resolution.

At least 3 cards (e.g. `TN-MOD-001` ESM semantics, `TN-MOD-002` CommonJS semantics, `TN-MOD-003` module resolution). Same field contract.

- [x] **Step 3: Distill the async-control cards**

Under a `## 异步控制` heading, create evidence cards distilled from:
- `nodejs/node` `lib/events.js`, `doc/api/events.md`, event-loop docs.

At least 2 cards (e.g. `TN-ASYNC-001` event-emitter semantics, `TN-ASYNC-002` async/event-loop ordering). Same field contract.

- [x] **Step 4: Distill the Stream/memory cards**

Under a `## Stream 与内存` heading, create evidence cards distilled from:
- `nodejs/node` `lib/_stream_readable.js`, `_stream_writable.js`, `doc/api/stream.md`, `doc/api/buffer.md`.

At least 3 cards (e.g. `TN-STREAM-001` readable-stream semantics, `TN-STREAM-002` writable-stream/backpressure, `TN-STREAM-003` buffer/memory handling). Same field contract.

- [x] **Step 5: Distill the process/error-handling/build cards**

Under a `## 进程/错误处理/构建` heading, create evidence cards distilled from:
- `nodejs/node` `lib/child_process.js`, `doc/api/process.md`, `doc/api/errors.md`.
- `microsoft/TypeScript` `src/compiler/emitter.ts`, `program.ts`.

At least 2 cards (e.g. `TN-PROC-001` process/child-process semantics, `TN-BUILD-001` build/emitter semantics). Same field contract.

- [x] **Step 6: Verify evidence-card uniqueness and field completeness**

Run a check that every card ID in `typescript-node.md` is unique and each card contains all required fields from the knowledge-design spec §5.2 (ID, claim, evidence type/grade, source identity, version/ref/commit, original location, support note, applicability, limits, associated Skill, status). Verify the local evidence paths (pinned repo files) exist via `Test-Path`. Record counts per group.

- [x] **Step 7: Save the checkpoint**

Record the evidence-card path and group counts in the ledger. If Git is user-authorized, commit with `docs: add crawler typescript-node evidence cards`; otherwise record the local checkpoint only.

---

### Task 3: Build the Skill-14 Knowledge View

**Files:**

- Create: `docs/superpowers/knowledge/skill-views/crawler-debug-typescript-node.md`
- Modify: `docs/superpowers/progress/crawler-knowledge-skills-progress.md`

**Interfaces:**

- Consumes: `evidence-cards/typescript-node.md` (Task 2), approved design §1-10, decision log §59.
- Produces: the Skill-14 view consumed by SKILL.md and the implementation workflow (Task 4), referencing evidence cards by ID.

- [x] **Step 1: Create the view header and scope**

Under a `# crawler-debug-typescript-node 知识视图` heading, state the Skill's positioning (Agent TypeScript/Node.js implementation diagnosis and fix-advisory aid), trigger, and explicit exclusions (test/build-system replacement, cross-framework URL/HTTP/browser/queue methodologies, Docker → `crawler-run-docker`, planning) — without copying full repo content.

- [x] **Step 2: Add the knowledge topics and judgment rules**

Add sections for: 类型系统与 tsconfig、模块系统 ESM·CommonJS、异步控制、Stream 与内存、进程/错误处理/构建 — each referencing the relevant evidence-card IDs from Task 2 (`TN-TYPE-*`, `TN-MOD-*`, `TN-ASYNC-*`, `TN-STREAM-*`, `TN-PROC-*`/`TN-BUILD-*`), plus versioned judgment rules tied to the pinned batch-05 repos. Emphasize detecting compile-passes-but-wrong-runtime-behavior, version accuracy, and converting domain-confirmed directions to locked-version implementation suggestions.

- [x] **Step 3: Add evidence-insufficiency / conflict / external-condition handling**

Require: mark unresolved claims as uncertain when evidence is insufficient; keep evidence conflicts visible; never silently overwrite a fixed-version card or previous record; never let an unknown or external condition be misjudged as a confirmed/fixed root cause; never confuse compile-passing with runtime-correctness.

- [x] **Step 4: Add output / handoff / exclusions / self-check**

Require: the view's output is a traceable implementation-diagnosis record (problem evidence, classification, root cause/hypothesis, impact scope, fix direction, test suggestions); after user approval of fix direction, hand off to `crawler-writing-plans-bridge`; exclude repeating cross-framework methodologies and crossing approval boundaries; add a view self-check (all evidence-card IDs referenced exist, no unlabeled inference).

- [x] **Step 5: Verify the view references all evidence cards**

Run a check that every card ID from `typescript-node.md` is referenced by `crawler-debug-typescript-node.md`. Expected: full coverage (e.g. 13/13 or the actual count from Task 2).

- [x] **Step 6: Save the checkpoint**

Record the view path and coverage count in the ledger. If Git is user-authorized, commit with `docs: add crawler debug-typescript-node knowledge view`; otherwise record the local checkpoint only.

---

### Task 4: Build the Implementation-Workflow Reference

**Files:**

- Create: `skills/crawler-debug-typescript-node/references/implementation-workflow.md`
- Modify: `docs/superpowers/progress/crawler-knowledge-skills-progress.md`

**Interfaces:**

- Consumes: decision log §59/§51/§147, approved design §5-7, evidence cards `typescript-node.md`, Skill-14 view.
- Produces: the diagnostic flow, problem-classification rules, implementation-conversion rules, and evidence-card mapping consumed by SKILL.md and Task 5.

- [x] **Step 1: Define the diagnostic flow**

Under a `## 诊断流程` heading, specify the ordered flow (design §5):
1. Read project context, goal, constraints, and confirmed root cause.
2. Determine the diagnostic focus: type system & tsconfig / module system ESM·CJS / async control / Stream & memory / process & error handling / build & dependency compatibility; focus on that area only.
3. Inspect relevant package.json, lockfile, tsconfig, build config, code, error logs, and runtime evidence; locate concrete evidence positions.
4. Compare project behavior against the matching-version evidence cards (`typescript-node.md`) and locked-version spec/implementation/engineering evidence.
5. Classify: code defect / configuration error / version compatibility / design gap / external condition / unknown.
6. When evidence is insufficient, propose only minimal supplementary evidence (minimal compilation, tests, performance analysis, memory diagnosis); do not propose code changes before the root cause is confirmed.
7. Convert the domain-confirmed fix direction into current-version implementation suggestions.
8. Output traceable problem evidence, root cause or hypothesis, impact scope, fix direction, and test suggestions.
9. After user approval of fix direction, hand off to `crawler-writing-plans-bridge`.

- [x] **Step 2: Define the problem-classification rules**

Under a `## 问题分类规则` heading, specify the six classes (code defect / configuration error / version compatibility / design gap / external condition / unknown) with the definitions from design §6, and require every conclusion to distinguish fact / evidence / inference / to-confirm (inference explicitly labeled "推断").

- [x] **Step 3: Define the implementation-conversion rules**

Under a `## 实现转换规则` heading, require: convert domain-confirmed directions into current-version implementation suggestions referencing the locked versions (TypeScript v6.0.3, Node.js v24.18.0 LTS); never default to latest-Release or historical-draft assumptions; detect compile-passes-but-wrong-runtime-behavior as an acceptance emphasis.

- [x] **Step 4: Define the evidence-card mapping**

Under a `## 证据卡映射` heading, map each diagnostic focus to the relevant card groups from Task 2 (`TN-TYPE-*` for type system/tsconfig, `TN-MOD-*` for module system, `TN-ASYNC-*` for async control, `TN-STREAM-*` for stream/memory, `TN-PROC-*`/`TN-BUILD-*` for process/error/build), plus the pinned repo paths for each.

- [x] **Step 5: Define evidence and conflict handling**

Under `证据不足与冲突`, require: mark unresolved claims as uncertain when evidence is insufficient; keep evidence conflicts visible; never silently overwrite a fixed-version card or a previous record; never let an unknown be misjudged as a confirmed root cause; never let an external condition be misjudged as fixed; never confuse compile-passing with runtime-correctness.

- [x] **Step 6: Save the checkpoint**

Record the reference path, workflow, classification rules, implementation-conversion rules, and evidence-card mapping in the ledger. If Git is user-authorized, commit with `docs: add crawler debug-typescript-node implementation workflow reference`; otherwise record the local checkpoint only.

---

### Task 5: Build the Output-Contract Reference

**Files:**

- Create: `skills/crawler-debug-typescript-node/references/output-contract.md`
- Modify: `docs/superpowers/progress/crawler-knowledge-skills-progress.md`

**Interfaces:**

- Consumes: decision log §33-36/§59, approved design §8-9.
- Produces: the diagnosis-record contract, handoff, and revision rules consumed by SKILL.md.

- [x] **Step 1: Define the diagnosis-record contract**

Under a `## 诊断记录输出契约` heading, specify the required fields (design §8):
- 问题证据（定位到的 `package.json`/锁文件/`tsconfig`/构建配置/代码/错误日志/运行时证据位置）。
- 分类（代码缺陷 / 配置错误 / 版本兼容 / 设计不足 / 外部条件 / 未知项；含置信度：高/中/低/不确定）。
- 根因或待验证假设（区分事实、证据、推断、待确认项）。
- 影响范围（受影响的模块、功能面、依赖链、构建产物）。
- 修复方向（适合当前 TS/Node 版本的具体实现建议，指向匹配版本资料）。
- 测试建议（最小编译、测试、性能分析、内存诊断方法）。
- 依据（关联证据卡 ID、固定资料路径、代码/配置/日志位置）。

Require that each diagnosis record be traceable from the record to its evidence locations or context-package entries, and that the record distinguish fact / evidence / inference / to-confirm / approval status.

- [x] **Step 2: Define the handoff contract**

Under a `## 交接契约` heading, specify:
- Convert domain-confirmed fix directions into TS/Node implementation suggestions without crossing user-approval boundaries or skipping `crawler-writing-plans-bridge`.
- After user approval, the fix direction hands off to `crawler-writing-plans-bridge` as planning input, not replacing its planning responsibility.
- Docker problems to `crawler-run-docker`; cross-framework URL/HTTP/browser/queue methodologies to the corresponding domain Skills.
- Handoff follows decision log §33-36: structured on-disk record + short human summary; two-tier storage; redact secrets/cookies/auth headers/proxy credentials/environment-variable secrets before writing.
- When handling a Stellaris problem, read the `stellaris-crawler-context` context package path before diagnosing.

- [x] **Step 3: Define revision preservation**

Under a `## 修订保留` heading, require: every new diagnosis record is a new revision appended or an explicit revision record pointing to the superseded version; never silently overwrite an existing record; keep the prior version readable for audit.

- [x] **Step 4: Save the checkpoint**

Record the output-contract path and coverage in the ledger. If Git is user-authorized, commit with `docs: add crawler debug-typescript-node output contract`; otherwise record the local checkpoint only.

---

### Task 6: Implement the Project-Local Skill Package

**Files:**

- Create: `skills/crawler-debug-typescript-node/SKILL.md`
- Test: `tests/skills/crawler-debug-typescript-node/cases.md`
- Modify: `docs/superpowers/progress/crawler-knowledge-skills-progress.md`

**Interfaces:**

- Consumes: the two references, evidence cards, Skill-14 view, main decision log, approved design, `stellaris-crawler-context` context package.
- Produces: the runnable Skill entry that routes to the references and enforces gates/prohibitions.

- [x] **Step 1: Create `SKILL.md` front matter and trigger**

Use this front matter exactly, with the description kept on one line:

```markdown
---
name: crawler-debug-typescript-node
description: Use when an Agent must diagnose a crawler project's TypeScript and Node.js implementation behavior (type system, tsconfig, ESM/CommonJS module system, async control, Stream, process, error handling, memory, build, dependency compatibility), detect type misuse, module-loading errors, async races, stream backpressure errors, process/error-handling defects, and compile-passes-but-wrong-runtime-behavior against locked-version evidence (TypeScript v6.0.3, Node.js v24.18.0 LTS), convert domain-confirmed fix directions into current-version implementation suggestions, and emit a traceable diagnosis with fix direction for user approval before handoff to crawler-writing-plans-bridge, without repeating cross-framework methodologies or crossing approval boundaries.
---
```

The opening must state that this is an Agent TypeScript/Node.js implementation diagnosis and fix-advisory aid, not a replacement for the project's test/build system, fix engine, planner, memory, RAG, index service, context framework, or runtime crawler component.

- [x] **Step 2: Add compact routing and non-negotiable gates**

`SKILL.md` must route detailed work to the two reference files and the knowledge view. It must contain these gates:

1. Identify that this is a TypeScript/Node.js implementation-diagnosis task needing evidence-based classification.
2. For Stellaris problems, read the `stellaris-crawler-context` project-context package path before diagnosing (decision log §38).
3. Determine the diagnostic focus (type system & tsconfig / module system ESM·CJS / async control / Stream & memory / process & error handling / build & dependency compatibility); focus on that area only.
4. Classify against matching-version evidence cards (`typescript-node.md`) and the locked versions (TypeScript v6.0.3, Node.js v24.18.0 LTS); never fabricate a root cause from insufficient evidence; never confuse compile-passing with runtime-correctness.
5. For external conditions (runtime environment unavailable, constrained dependency service), give a compliant degrade/wait/stop conclusion; never claim it as fixed.
6. Present the diagnosis record and wait for user approval; before approval, do not hand off to `crawler-writing-plans-bridge`.
7. Never repeat cross-framework URL/HTTP/browser/queue methodologies (route to corresponding domain Skills); never generate `writing-plans` or cross the approval boundary; never install, build, or run unapproved project or third-party code; never store secrets/cookies/auth headers/proxy credentials.
8. Emit traceable outputs and update local progress before continuing.

Keep `SKILL.md` concise; place field-level detail in references rather than repeating it.

- [x] **Step 3: Verify required tokens in `SKILL.md`**

Run a check that `SKILL.md` contains these tokens: `crawler-debug-typescript-node`, `crawler-writing-plans-bridge`, `类型系统`, `tsconfig`, `ESM`, `CommonJS`, `异步`, `Stream`, `进程`, `错误处理`, `内存`, `构建`, `绝不`, `主决策日志`, `implementation-workflow`, `output-contract`, `typescript-node`. Expected: all present.

- [x] **Step 4: Save the checkpoint**

Record the Skill package path, routing, and gate coverage in the ledger. If Git is user-authorized, commit with `feat: add crawler debug-typescript-node skill`; otherwise record the local checkpoint only and do not initialize Git.

---

### Task 7: Run Red/Green Behavioral and Safety Evaluation

**Files:**

- Read: `tests/skills/crawler-debug-typescript-node/cases.md`
- Create: `tests/skills/crawler-debug-typescript-node/results.md`
- Modify if required: `skills/crawler-debug-typescript-node/SKILL.md`
- Modify if required: `skills/crawler-debug-typescript-node/references/implementation-workflow.md`
- Modify if required: `skills/crawler-debug-typescript-node/references/output-contract.md`
- Modify: `docs/superpowers/progress/crawler-knowledge-skills-progress.md`

**Interfaces:**

- Consumes: eight frozen cases and the completed Skill package.
- Produces: auditable baseline/Skill-assisted results with no safety or boundary failures.

- [x] **Step 1: Use the required Skill-testing process**

Claude Code must load `superpowers:writing-skills` and follow its behavioral testing method. Use fresh Agent contexts so a case does not inherit another case's answers.

- [x] **Step 2: Record the red baseline**

For each `TN-01` through `TN-08`, run the case without loading `crawler-debug-typescript-node`. Record whether the baseline omits focus discipline, compile-passes-wrong-runtime detection, classification accuracy, evidence-sufficiency discipline, version-accuracy discipline, external-condition honesty, approval-gate discipline, cross-framework boundary discipline, or single-Skill scope. Do not fabricate a failure when the baseline happens to comply; record observed behavior.

- [x] **Step 3: Record the green Skill-assisted run**

Run every case with `crawler-debug-typescript-node` loaded. For each case, record input, output summary, required evidence references, forbidden-behavior check and pass/fail. Expected: all eight pass; `TN-02`, `TN-03`, `TN-04`, `TN-05`, `TN-07` must stop the prohibited action rather than merely warn.

- [x] **Step 4: Fix only demonstrated gaps**

If a case fails, identify the missing or ambiguous instruction, make the smallest change in the responsible file, rerun that case, and then rerun all eight. Do not expand the Skill into deep diagnosis of HTTP/browser/parsing/queue, legal advice, runtime scanning, cross-framework methodology, or source execution.

- [x] **Step 5: Verify behavioral results**

`results.md` must contain one baseline and one Skill-assisted result for all eight case IDs, an overall count, and a statement that no third-party repository program was executed. Expected final count: `8 PASS, 0 FAIL`.

- [x] **Step 6: Save the checkpoint**

Record behavioral count and any corrected files in the ledger. If Git is user-authorized, commit with `test: verify crawler debug-typescript-node behavior`; otherwise record the local checkpoint only.

---

### Task 8: Final Verification, Handoff, and Persistent Progress

**Files:**

- Verify: all files listed in this plan
- Modify: `docs/superpowers/progress/crawler-knowledge-skills-progress.md`
- Modify only after user approval: `docs/superpowers/brainstorming/2026-07-31-crawler-knowledge-skills-decision-log.md`

**Interfaces:**

- Consumes: behavioral results, approved design, fixed source manifest.
- Produces: a Claude Code implementation handoff ready for user verification; no work on Skill 15.

- [x] **Step 1: Run fresh structural verification**

Run a static check that all required files exist: `skills/crawler-debug-typescript-node/SKILL.md`, `skills/crawler-debug-typescript-node/references/implementation-workflow.md`, `skills/crawler-debug-typescript-node/references/output-contract.md`, `docs/superpowers/knowledge/evidence-cards/typescript-node.md`, `docs/superpowers/knowledge/skill-views/crawler-debug-typescript-node.md`, `tests/skills/crawler-debug-typescript-node/cases.md`, `tests/skills/crawler-debug-typescript-node/results.md`. Expected: all present. Also verify cases `^## TN-` count = 8 and results `^## TN-` count = 8.

- [x] **Step 2: Scan implementation artifacts for placeholders and scope leaks**

Run `Select-String` over the Skill package, references, evidence cards, view, and results for placeholder terms and for affirmative instructions to install, build, run, scan, start proxies, or crawl targets. Negative safety statements are allowed; any affirmative runtime instruction is a failure. Expected: zero placeholders and zero affirmative runtime instructions. Also scan for secret-like tokens (api key, password, token, cookie, Bearer, OTEL_EXPORTER_OTLP headers) — only negative redaction statements allowed.

- [x] **Step 3: Reconcile evidence and behavior coverage**

Confirm the diagnostic flow, problem-classification rules, and implementation-conversion rules match design §5-6; the evidence-card grouping matches design §7; the output contract matches design §8; the handoff contract matches design §9 and decision log §33-36; all eight behavioral cases pass; no mention of Skill 15 or any future Skill as implementation work; `stellaris-crawler-context` context-package reading is explicit for Stellaris problems. Expected: no missing or duplicate item.

- [x] **Step 4: Update the ledger to `待验证`**

Record all created/modified paths, verification commands and outputs, behavioral count, remaining blockers, and the next action: user or independent reviewer verifies the Claude Code output. Do not mark `已完成` before that verification.

- [x] **Step 5: Handle failure, conflict, and rollback explicitly**

If final verification fails, do not publish the Skill as usable and do not modify the fixed manifest or any third-party repository. Keep the failing artifacts for diagnosis, change only this Skill's ledger status to `已阻塞`, and record the exact failing command, files, evidence IDs and last passing checkpoint. If a user-authorized Git repository exists, restore a prior current-Skill state with a new targeted revert commit; do not rewrite history. Without Git, apply only targeted corrections to the current Skill files and rerun the failed check—never bulk-delete project files or start Skill 15. Evidence conflicts remain visible with status `存在冲突`; they are not "rolled back" into a false deterministic claim.

- [x] **Step 6: Handle Git conditionally**

If `git -C E:\Stellaris rev-parse --is-inside-work-tree` succeeds because the user established a repository, commit remaining verified changes with `docs: finalize crawler debug-typescript-node skill`. If it fails, do not initialize Git; record that local files and the ledger are the persistence mechanism.

- [x] **Step 7: Stop before Skill 15**

Report the completed `crawler-debug-typescript-node` artifacts and verification evidence to the user. Do not start `crawler-use-crawlee` (Skill 15) planning or implementation until the user accepts this Skill's result and separately authorizes the next Skill.

---

## Plan Completion Criteria

This plan is implemented only when:

- every checkbox is completed or explicitly blocked with evidence;
- structural verification passes;
- all eight behavioral cases pass;
- the diagnostic flow, problem-classification rules, and implementation-conversion rules match the approved design;
- the evidence cards match the approved design §7 and the pinned batch-05 sources, and the Skill-14 view references them;
- the output contract and handoff contract match the approved design and decision-log §33-36;
- no third-party tool or crawler runtime action was executed; no secret content was persisted;
- the progress ledger is at `待验证` with a complete handoff;
- the user or independent reviewer verifies the result before changing the status to `已完成`.

Execution is assigned to Claude Code. This plan does not authorize Codex to execute it and does not authorize work on any other Skill.
