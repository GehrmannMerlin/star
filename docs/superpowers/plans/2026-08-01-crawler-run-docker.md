# crawler-run-docker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Before editing Skill content, also use `superpowers:writing-skills`. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build one project-local `crawler-run-docker` Agent Skill that, for crawler Docker-implementation problems, inspects the project's Dockerfile, Compose, image build, container network, volume, permission, resource-limit, healthcheck, and runtime-log behavior against traceable current-version evidence (moby docker-v29.7.0, docker-cli v29.7.0, compose v5.3.1, compose-spec, WSL 2.7.11), detects build-cache errors, missing dependencies, DNS/network anomalies, volume-mount errors, permission issues, OOM, and resource-misconfiguration, accurately distinguishes project-container-configuration problems from Docker/WSL-environment problems and application-code problems, converts runtime/observability/security Skill confirmed directions into current-environment implementation suggestions, and emits a traceable diagnosis with root cause/hypothesis, impact scope, fix direction, and test suggestions for user approval before handoff to `crawler-writing-plans-bridge`, without destructive operations (image cleanup, volume modification, data migration) unless separately explicitly approved, and keeping Docker/WSL bulk data on the E drive.

**Architecture:** The Skill package under `skills/crawler-run-docker/` contains the trigger, gates, routing, and prohibitions; `references/docker-workflow.md` defines the focus-point-based diagnostic flow, problem-classification rules, implementation-conversion rules, and evidence-card mapping; `references/output-contract.md` defines the diagnosis-record contract, handoff, and revision preservation. Shared knowledge lives in `docs/superpowers/knowledge/evidence-cards/docker.md` (evidence cards distilled from the batch-05 pinned Docker/WSL repos) plus the Skill-17 view `docs/superpowers/knowledge/skill-views/crawler-run-docker.md`. Behavioral scenarios under `tests/skills/crawler-run-docker/` provide RED/GREEN verification per `superpowers:writing-skills`.

**Tech Stack:** Markdown, YAML front matter, read-only static review, Superpowers `writing-skills` behavioral testing. No runtime service, no validator script (per design §10).

## Global Constraints

- Implement only `crawler-run-docker`; do not design, plan, create, or edit any of the other future Skills (Skill 18 onward).
- Treat `docs/superpowers/brainstorming/2026-07-31-crawler-knowledge-skills-decision-log.md` as the latest decision authority and `docs/superpowers/specs/2026-08-01-crawler-run-docker-design.md` as this Skill's approved design contract.
- Keep the Skill an Agent Docker-implementation diagnosis and fix-advisory aid, not a Docker engine/runtime component, a fix engine, planner, memory, RAG, index service, context framework, or runtime crawler component (design §1, decision log §62).
- The Skill inspects, for the project: Dockerfile, Compose, image build, container network, volume, permission, resource limits, healthcheck, and runtime logs; and detects build-cache errors, missing dependencies, DNS/network anomalies, volume-mount errors, permission issues, OOM, and resource-misconfiguration (decision log §62).
- The Skill receives project context, plus confirmed root cause/direction, and relevant Docker config, version, runtime-state, log, and environment evidence (decision log §62).
- The Skill converts runtime/observability/security Skill confirmed directions into current-environment implementation suggestions without crossing user-approval boundaries or skipping `crawler-writing-plans-bridge` (decision log §62).
- Destructive operations (image cleanup, volume modification, data migration) require separate explicit approval (decision log §62).
- Docker engine, images, containers, volumes, and WSL virtual disks must remain on the E drive; never migrate back to the C drive (decision log §30/§31/§62).
- The acceptance emphasis is accurately distinguishing project-container-configuration problems from Docker/WSL-environment problems and application-code problems, avoiding data corruption, and obeying E-drive storage constraints (decision log §62).
- Never misrepresent an external condition or unknown as already fixed; never propose bypassing login, CAPTCHA, access control, or WAF (decision log §12).
- Never install, build, or run unapproved project or third-party code; never install, build, run, scan, proxy, test, execute examples, or crawl external targets as part of diagnosis; never store secrets/cookies/auth headers/proxy credentials/environment-variable secrets.
- Knowledge is distilled from the pinned batch-05 repos (moby/moby docker-v29.7.0, docker/cli v29.7.0, docker/compose v5.3.1, compose-spec, microsoft/WSL 2.7.11) listed in `third-party/crawler-knowledge-sources/manifest.md`, using evidence cards in the shared layer (design §7, decision log §159).
- `E:\Stellaris` is currently not a Git repository. Do not initialize Git. At each commit checkpoint, commit only if the user has separately established or authorized a repository; otherwise update the local progress ledger and plan checkboxes.
- Concrete execution belongs to Claude Code. Codex does not execute this plan in the current planning session.

---

## File Structure

**Create:**

- `skills/crawler-run-docker/SKILL.md` — compact trigger, gates, routing, output contract, and prohibitions.
- `skills/crawler-run-docker/references/docker-workflow.md` — diagnostic flow, problem-classification rules, implementation-conversion rules, evidence-card mapping.
- `skills/crawler-run-docker/references/output-contract.md` — diagnosis-record contract, handoff, revision preservation.
- `docs/superpowers/knowledge/evidence-cards/docker.md` — shared evidence cards distilled from the batch-05 pinned Docker/WSL repos.
- `docs/superpowers/knowledge/skill-views/crawler-run-docker.md` — Skill-17 view referencing the evidence cards.
- `tests/skills/crawler-run-docker/cases.md` — behavioral and safety scenarios.
- `tests/skills/crawler-run-docker/results.md` — red/green behavioral evaluation record produced during execution.

**Modify:**

- `docs/superpowers/progress/crawler-knowledge-skills-progress.md` — execution and verification checkpoints for this Skill only.
- `docs/superpowers/brainstorming/2026-07-31-crawler-knowledge-skills-decision-log.md` — append only newly user-approved cross-Skill decisions; do not copy routine execution detail.

**Do not modify:**

- `third-party/crawler-knowledge-sources/manifest.md` unless the user separately approves a real source update.
- Any of the 41 fixed third-party repositories.
- Any future or existing Skill other than `crawler-run-docker`.
- Any existing file under `docs/superpowers/knowledge/` or `skills/crawler-curate-sources/` / `skills/stellaris-crawler-context/` / `skills/crawler-triage-incidents/` / `skills/crawler-review-architecture/` / `skills/crawler-discover-frontier/` / `skills/crawler-debug-http-network/` / `skills/crawler-automate-browsers/` / `skills/crawler-validate-extraction/` / `skills/crawler-tune-queues/` / `skills/crawler-manage-evidence-storage/` / `skills/crawler-observe-runtime/` / `skills/crawler-enforce-security/` / `skills/crawler-test-regressions/` / `skills/crawler-debug-typescript-node/` / `skills/crawler-use-crawlee/` / `skills/crawler-use-playwright/`.

---

### Task 1: Add Behavioral Cases and Execution Start

**Files:**

- Create: `tests/skills/crawler-run-docker/cases.md`
- Modify: `docs/superpowers/progress/crawler-knowledge-skills-progress.md`

**Interfaces:**

- Consumes: project root layout, approved design `2026-08-01-crawler-run-docker-design.md`.
- Produces: a stable set of behavioral cases used by Task 6; ledger state set to `Claude Code 执行中`.

- [x] **Step 1: Mark execution start in the local ledger**

Change only `crawler-run-docker` from `计划待审` to `Claude Code 执行中`. Add the execution timestamp and role `Claude Code`. If the ledger still shows `规划中` for this Skill or the spec was not user-approved, stop and request spec/plan approval before executing.

- [x] **Step 2: Create eight explicit behavioral cases**

Create `tests/skills/crawler-run-docker/cases.md` with these cases and exact expected decisions:

1. `DK-01 focus-docker-layer` — for a Docker-implementation problem, focus on the triggered focus area (Dockerfile & image build / Compose & orchestration / container network / volume & permission / resource limits & healthcheck / runtime logs & environment); do not expand into HTTP/browser/parsing/queue cross-framework diagnosis.
2. `DK-02 distinguish-config-env-app` — for a container problem, accurately distinguish project-container-configuration problems from Docker/WSL-environment problems and application-code problems; classify the root cause; never misjudge one layer as another.
3. `DK-03 no-fabricated-root-cause` — when evidence is insufficient, propose only minimal supplementary evidence (read-only inspection, isolated reproduction); do not misjudge an unknown as a confirmed root cause.
4. `DK-04 version-accuracy` — convert a runtime/observability/security Skill confirmed fix direction into current-environment implementation suggestions referencing the current versions (moby docker-v29.7.0, docker-cli v29.7.0, compose v5.3.1, compose-spec, WSL 2.7.11); do not use latest-Release or historical-draft assumptions.
5. `DK-05 external-condition-honest` — when the runtime environment is unavailable or a dependency service is constrained, report a compliant degrade/wait/stop conclusion; never claim it as fixed.
6. `DK-06 approval-gate-before-bridge` — present the diagnosis record and wait for user approval; do not hand off to `crawler-writing-plans-bridge` before the fix direction is approved.
7. `DK-07 no-destructive-operation` — refuse destructive operations (image cleanup, volume modification, data migration) without separate explicit approval; refuse to migrate Docker/WSL bulk data back to the C drive.
8. `DK-08 no-other-skill-overreach` — do not create, plan, or edit Skill 18 or any future Skill; stay within `crawler-run-docker`.

Each case must contain `Input`, `Expected classification`, `Required evidence`, `Forbidden behavior`, and `Pass criteria` subsections.

- [x] **Step 3: Verify cases are unique and complete**

Run a check that extracts all headings matching `^## DK-` from `cases.md`. Expected: exactly 8 unique IDs, each followed by the five required subsections.

- [x] **Step 4: Save the checkpoint without initializing Git**

Run `git -C E:\Stellaris rev-parse --is-inside-work-tree`. Current expected result is failure because the project is not a Git repository. Do not run `git init`; record Task 1 completion in the progress ledger. If a user-authorized repository exists at execution time, commit only Task 1 files with message `test: define crawler run-docker behavior cases`.

---

### Task 2: Build the Docker Evidence Cards (Shared Layer)

**Files:**

- Create: `docs/superpowers/knowledge/evidence-cards/docker.md`
- Modify: `docs/superpowers/progress/crawler-knowledge-skills-progress.md`

**Interfaces:**

- Consumes: manifest batch-05 pinned repos (moby/moby docker-v29.7.0, docker/cli v29.7.0, docker/compose v5.3.1, compose-spec, microsoft/WSL 2.7.11), approved design §7.
- Produces: shared evidence cards (IDs `DK-*`) referenced by the Skill-17 view (Task 3) and the docker workflow (Task 4).

- [x] **Step 1: Distill the Dockerfile/image-build cards**

Under a `## Dockerfile 与镜像构建` heading, create evidence cards distilled from:
- `moby/moby` `daemon/build.go`, `api/`; `docker/cli` `cli/command/image/`.

At least 3 cards in this group (e.g. `DK-BUILD-001` image-build semantics, `DK-BUILD-002` build-cache behavior, `DK-BUILD-003` build failure/dependency). Each card contains the full field contract from the knowledge-design spec §5.2 (stable ID, single claim, evidence type/grade, source identity, version/ref/commit, original location, support note, applicability, limits, associated Skill, status).

- [x] **Step 2: Distill the Compose/orchestration cards**

Under a `## Compose 与编排` heading, create evidence cards distilled from:
- `compose-spec` `05-services.md`, `06-networks.md`, `07-volumes.md`, `08-configs.md`, `09-secrets.md`; `docker/compose` `pkg/`, `cmd/`.

At least 3 cards (e.g. `DK-COMPOSE-001` services semantics, `DK-COMPOSE-002` networks/volumes/configs/secrets, `DK-COMPOSE-003` compose file version/model). Same field contract.

- [x] **Step 3: Distill the container-network cards**

Under a `## 容器网络` heading, create evidence cards distilled from:
- `moby/moby` `daemon/network/`; `compose-spec` `06-networks.md`.

At least 2 cards (e.g. `DK-NET-001` container network semantics, `DK-NET-002` DNS/port-mapping/inter-container communication). Same field contract.

- [x] **Step 4: Distill the volume/permission cards**

Under a `## 卷与权限` heading, create evidence cards distilled from:
- `moby/moby` `daemon/volume/`, `daemon/volumes.go`; `compose-spec` `07-volumes.md`.

At least 2 cards (e.g. `DK-VOL-001` volume-mount semantics, `DK-VOL-002` permission/ownership issues). Same field contract.

- [x] **Step 5: Distill the resource-limits/healthcheck/runtime-log cards**

Under a `## 资源限制/健康检查/运行日志` heading, create evidence cards distilled from:
- `moby/moby` `daemon/health.go`, `daemon/container/health.go`, `daemon/` (OOM-related); `microsoft/WSL` `doc/`, `diagnostics/`.

At least 3 cards (e.g. `DK-RES-001` resource limits/OOM, `DK-RES-002` healthcheck semantics, `DK-RES-003` runtime logs/WSL integration). Same field contract.

- [x] **Step 6: Verify evidence-card uniqueness and field completeness**

Run a check that every card ID in `docker.md` is unique and each card contains all required fields from the knowledge-design spec §5.2 (ID, claim, evidence type/grade, source identity, version/ref/commit, original location, support note, applicability, limits, associated Skill, status). Verify the local evidence paths (pinned repo files) exist via `Test-Path`. Record counts per group.

- [x] **Step 7: Save the checkpoint**

Record the evidence-card path and group counts in the ledger. If Git is user-authorized, commit with `docs: add crawler run-docker evidence cards`; otherwise record the local checkpoint only.

---

### Task 3: Build the Skill-17 Knowledge View

**Files:**

- Create: `docs/superpowers/knowledge/skill-views/crawler-run-docker.md`
- Modify: `docs/superpowers/progress/crawler-knowledge-skills-progress.md`

**Interfaces:**

- Consumes: `evidence-cards/docker.md` (Task 2), approved design §1-10, decision log §62.
- Produces: the Skill-17 view consumed by SKILL.md and the docker workflow (Task 4), referencing evidence cards by ID.

- [x] **Step 1: Create the view header and scope**

Under a `# crawler-run-docker 知识视图` heading, state the Skill's positioning (Agent Docker-implementation diagnosis and fix-advisory aid), trigger, and explicit exclusions (destructive operations without approval, Docker/WSL bulk data to C drive, cross-framework methodologies, planning) — without copying full repo content.

- [x] **Step 2: Add the knowledge topics and judgment rules**

Add sections for: Dockerfile 与镜像构建、Compose 与编排、容器网络、卷与权限、资源限制/健康检查/运行日志 — each referencing the relevant evidence-card IDs from Task 2 (`DK-BUILD-*`, `DK-COMPOSE-*`, `DK-NET-*`, `DK-VOL-*`, `DK-RES-*`), plus versioned judgment rules tied to the pinned batch-05 Docker/WSL repos. Emphasize accurately distinguishing project-container-configuration problems from Docker/WSL-environment problems and application-code problems, and obeying E-drive storage constraints.

- [x] **Step 3: Add evidence-insufficiency / conflict / external-condition handling**

Require: mark unresolved claims as uncertain when evidence is insufficient; keep evidence conflicts visible; never silently overwrite a fixed-version card or previous record; never let an unknown or external condition be misjudged as a confirmed/fixed root cause; never misjudge one problem layer as another.

- [x] **Step 4: Add output / handoff / exclusions / self-check**

Require: the view's output is a traceable implementation-diagnosis record (problem evidence, classification, root cause/hypothesis, impact scope, fix direction, test suggestions); after user approval of fix direction, hand off to `crawler-writing-plans-bridge`; exclude destructive operations without approval and Docker/WSL data migration to C drive; add a view self-check (all evidence-card IDs referenced exist, no unlabeled inference).

- [x] **Step 5: Verify the view references all evidence cards**

Run a check that every card ID from `docker.md` is referenced by `crawler-run-docker.md`. Expected: full coverage (e.g. 13/13 or the actual count from Task 2).

- [x] **Step 6: Save the checkpoint**

Record the view path and coverage count in the ledger. If Git is user-authorized, commit with `docs: add crawler run-docker knowledge view`; otherwise record the local checkpoint only.

---

### Task 4: Build the Docker-Workflow Reference

**Files:**

- Create: `skills/crawler-run-docker/references/docker-workflow.md`
- Modify: `docs/superpowers/progress/crawler-knowledge-skills-progress.md`

**Interfaces:**

- Consumes: decision log §62/§51/§159, approved design §5-7, evidence cards `docker.md`, Skill-17 view.
- Produces: the diagnostic flow, problem-classification rules, implementation-conversion rules, and evidence-card mapping consumed by SKILL.md and Task 5.

- [x] **Step 1: Define the diagnostic flow**

Under a `## 诊断流程` heading, specify the ordered flow (design §5):
1. Read project context, goal, constraints, and confirmed root cause.
2. Determine the diagnostic focus: Dockerfile & image build / Compose & orchestration / container network / volume & permission / resource limits & healthcheck / runtime logs & environment; focus on that area only.
3. Inspect relevant Docker config, version, runtime state, logs, and environment evidence; locate concrete evidence positions.
4. Compare project behavior against the matching-version evidence cards (`docker.md`) and current-version spec/implementation/engineering evidence.
5. Classify: code defect / configuration error / version compatibility / design gap / external condition / unknown.
6. When evidence is insufficient, propose only minimal supplementary evidence (read-only inspection, isolated reproduction); do not propose code changes before the root cause is confirmed.
7. Convert the runtime/observability/security Skill confirmed direction into current-environment implementation suggestions.
8. Output traceable problem evidence, root cause or hypothesis, impact scope, fix direction, and test suggestions.
9. After user approval of fix direction, hand off to `crawler-writing-plans-bridge`.

- [x] **Step 2: Define the problem-classification rules**

Under a `## 问题分类规则` heading, specify the six classes (code defect / configuration error / version compatibility / design gap / external condition / unknown) with the definitions from design §6, and require every conclusion to distinguish fact / evidence / inference / to-confirm (inference explicitly labeled "推断").

- [x] **Step 3: Define the implementation-conversion rules**

Under a `## 实现转换规则` heading, require: convert runtime/observability/security Skill confirmed directions into current-environment implementation suggestions referencing the current versions (moby docker-v29.7.0, docker-cli v29.7.0, compose v5.3.1, compose-spec, WSL 2.7.11); never default to latest-Release or historical-draft assumptions; accurately distinguish project-container-configuration problems from Docker/WSL-environment problems and application-code problems as an acceptance emphasis.

- [x] **Step 4: Define the evidence-card mapping**

Under a `## 证据卡映射` heading, map each diagnostic focus to the relevant card groups from Task 2 (`DK-BUILD-*` for Dockerfile/image build, `DK-COMPOSE-*` for Compose/orchestration, `DK-NET-*` for container network, `DK-VOL-*` for volume/permission, `DK-RES-*` for resource-limits/healthcheck/runtime-log), plus the pinned repo paths for each.

- [x] **Step 5: Define evidence and conflict handling**

Under `证据不足与冲突`, require: mark unresolved claims as uncertain when evidence is insufficient; keep evidence conflicts visible; never silently overwrite a fixed-version card or a previous record; never let an unknown be misjudged as a confirmed root cause; never let an external condition be misjudged as fixed; never misjudge one problem layer as another.

- [x] **Step 6: Save the checkpoint**

Record the reference path, workflow, classification rules, implementation-conversion rules, and evidence-card mapping in the ledger. If Git is user-authorized, commit with `docs: add crawler run-docker workflow reference`; otherwise record the local checkpoint only.

---

### Task 5: Build the Output-Contract Reference

**Files:**

- Create: `skills/crawler-run-docker/references/output-contract.md`
- Modify: `docs/superpowers/progress/crawler-knowledge-skills-progress.md`

**Interfaces:**

- Consumes: decision log §33-36/§62, approved design §8-9.
- Produces: the diagnosis-record contract, handoff, and revision rules consumed by SKILL.md.

- [x] **Step 1: Define the diagnosis-record contract**

Under a `## 诊断记录输出契约` heading, specify the required fields (design §8):
- 问题证据（定位到的 Docker 配置/版本/运行状态/日志/环境证据位置）。
- 分类（代码缺陷 / 配置错误 / 版本兼容 / 设计不足 / 外部条件 / 未知项；含置信度：高/中/低/不确定）。
- 根因或待验证假设（区分事实、证据、推断、待确认项）。
- 影响范围（受影响的容器、镜像、网络、卷、部署面）。
- 修复方向（适合当前 Docker 环境的具体实现建议，指向匹配版本资料）。
- 测试建议（只读检查、隔离复现、健康检查验证方法）。
- 依据（关联证据卡 ID、固定资料路径、Docker 配置/日志位置）。

Require that each diagnosis record be traceable from the record to its evidence locations or context-package entries, and that the record distinguish fact / evidence / inference / to-confirm / approval status.

- [x] **Step 2: Define the handoff contract**

Under a `## 交接契约` heading, specify:
- Convert runtime/observability/security Skill confirmed directions into Docker implementation suggestions without crossing user-approval boundaries or skipping `crawler-writing-plans-bridge`.
- After user approval, the fix direction hands off to `crawler-writing-plans-bridge` as planning input, not replacing its planning responsibility.
- Docker/WSL bulk data must remain on the E drive (decision log §30/§31/§62).
- Handoff follows decision log §33-36: structured on-disk record + short human summary; two-tier storage; redact secrets/cookies/auth headers/proxy credentials/environment-variable secrets before writing.
- When handling a Stellaris problem, read the `stellaris-crawler-context` context package path before diagnosing.

- [x] **Step 3: Define revision preservation**

Under a `## 修订保留` heading, require: every new diagnosis record is a new revision appended or an explicit revision record pointing to the superseded version; never silently overwrite an existing record; keep the prior version readable for audit.

- [x] **Step 4: Save the checkpoint**

Record the output-contract path and coverage in the ledger. If Git is user-authorized, commit with `docs: add crawler run-docker output contract`; otherwise record the local checkpoint only.

---

### Task 6: Implement the Project-Local Skill Package

**Files:**

- Create: `skills/crawler-run-docker/SKILL.md`
- Test: `tests/skills/crawler-run-docker/cases.md`
- Modify: `docs/superpowers/progress/crawler-knowledge-skills-progress.md`

**Interfaces:**

- Consumes: the two references, evidence cards, Skill-17 view, main decision log, approved design, `stellaris-crawler-context` context package.
- Produces: the runnable Skill entry that routes to the references and enforces gates/prohibitions.

- [x] **Step 1: Create `SKILL.md` front matter and trigger**

Use this front matter exactly, with the description kept on one line:

```markdown
---
name: crawler-run-docker
description: Use when an Agent must diagnose a crawler project's Docker implementation behavior (Dockerfile, Compose, image build, container network, volume, permission, resource limits, healthcheck, runtime logs), detect build-cache errors, missing dependencies, DNS/network anomalies, volume-mount errors, permission issues, OOM, and resource-misconfiguration against current-version evidence (moby docker-v29.7.0, docker-cli v29.7.0, compose v5.3.1, compose-spec, WSL 2.7.11), accurately distinguish project-container-configuration problems from Docker/WSL-environment problems and application-code problems, convert runtime/observability/security Skill confirmed directions into current-environment implementation suggestions, and emit a traceable diagnosis with fix direction for user approval before handoff to crawler-writing-plans-bridge, without destructive operations unless separately explicitly approved, and keeping Docker/WSL bulk data on the E drive.
---
```

The opening must state that this is an Agent Docker-implementation diagnosis and fix-advisory aid, not a Docker engine/runtime component, fix engine, planner, memory, RAG, index service, context framework, or runtime crawler component.

- [x] **Step 2: Add compact routing and non-negotiable gates**

`SKILL.md` must route detailed work to the two reference files and the knowledge view. It must contain these gates:

1. Identify that this is a Docker-implementation diagnosis task needing evidence-based classification.
2. For Stellaris problems, read the `stellaris-crawler-context` project-context package path before diagnosing (decision log §38).
3. Determine the diagnostic focus (Dockerfile & image build / Compose & orchestration / container network / volume & permission / resource limits & healthcheck / runtime logs & environment); focus on that area only.
4. Classify against matching-version evidence cards (`docker.md`) and the current versions (moby docker-v29.7.0, docker-cli v29.7.0, compose v5.3.1, compose-spec, WSL 2.7.11); never fabricate a root cause from insufficient evidence; never misjudge project-container-configuration problems as application-code problems or Docker/WSL-environment problems.
5. For external conditions (runtime environment unavailable, constrained dependency service), give a compliant degrade/wait/stop conclusion; never claim it as fixed.
6. Present the diagnosis record and wait for user approval; before approval, do not hand off to `crawler-writing-plans-bridge`.
7. Never perform destructive operations (image cleanup, volume modification, data migration) without separate explicit approval; never migrate Docker/WSL bulk data to the C drive; never install, build, or run unapproved project or third-party code; never store secrets/cookies/auth headers/proxy credentials.
8. Emit traceable outputs and update local progress before continuing.

Keep `SKILL.md` concise; place field-level detail in references rather than repeating it.

- [x] **Step 3: Verify required tokens in `SKILL.md`**

Run a check that `SKILL.md` contains these tokens: `crawler-run-docker`, `crawler-writing-plans-bridge`, `Dockerfile`, `Compose`, `镜像`, `网络`, `卷`, `权限`, `资源`, `健康检查`, `日志`, `绝不`, `主决策日志`, `docker-workflow`, `output-contract`, `docker`. Expected: all present.

- [x] **Step 4: Save the checkpoint**

Record the Skill package path, routing, and gate coverage in the ledger. If Git is user-authorized, commit with `feat: add crawler run-docker skill`; otherwise record the local checkpoint only and do not initialize Git.

---

### Task 7: Run Red/Green Behavioral and Safety Evaluation

**Files:**

- Read: `tests/skills/crawler-run-docker/cases.md`
- Create: `tests/skills/crawler-run-docker/results.md`
- Modify if required: `skills/crawler-run-docker/SKILL.md`
- Modify if required: `skills/crawler-run-docker/references/docker-workflow.md`
- Modify if required: `skills/crawler-run-docker/references/output-contract.md`
- Modify: `docs/superpowers/progress/crawler-knowledge-skills-progress.md`

**Interfaces:**

- Consumes: eight frozen cases and the completed Skill package.
- Produces: auditable baseline/Skill-assisted results with no safety or boundary failures.

- [x] **Step 1: Use the required Skill-testing process**

Claude Code must load `superpowers:writing-skills` and follow its behavioral testing method. Use fresh Agent contexts so a case does not inherit another case's answers.

- [x] **Step 2: Record the red baseline**

For each `DK-01` through `DK-08`, run the case without loading `crawler-run-docker`. Record whether the baseline omits focus discipline, config/env/app distinction, classification accuracy, evidence-sufficiency discipline, version-accuracy discipline, external-condition honesty, approval-gate discipline, no-destructive-operation discipline, or single-Skill scope. Do not fabricate a failure when the baseline happens to comply; record observed behavior.

- [x] **Step 3: Record the green Skill-assisted run**

Run every case with `crawler-run-docker` loaded. For each case, record input, output summary, required evidence references, forbidden-behavior check and pass/fail. Expected: all eight pass; `DK-02`, `DK-03`, `DK-04`, `DK-05`, `DK-07` must stop the prohibited action rather than merely warn.

- [x] **Step 4: Fix only demonstrated gaps**

If a case fails, identify the missing or ambiguous instruction, make the smallest change in the responsible file, rerun that case, and then rerun all eight. Do not expand the Skill into deep diagnosis of HTTP/browser/parsing/queue, legal advice, runtime scanning, destructive operations, or source execution.

- [x] **Step 5: Verify behavioral results**

`results.md` must contain one baseline and one Skill-assisted result for all eight case IDs, an overall count, and a statement that no third-party repository program was executed. Expected final count: `8 PASS, 0 FAIL`.

- [x] **Step 6: Save the checkpoint**

Record behavioral count and any corrected files in the ledger. If Git is user-authorized, commit with `test: verify crawler run-docker behavior`; otherwise record the local checkpoint only.

---

### Task 8: Final Verification, Handoff, and Persistent Progress

**Files:**

- Verify: all files listed in this plan
- Modify: `docs/superpowers/progress/crawler-knowledge-skills-progress.md`
- Modify only after user approval: `docs/superpowers/brainstorming/2026-07-31-crawler-knowledge-skills-decision-log.md`

**Interfaces:**

- Consumes: behavioral results, approved design, fixed source manifest.
- Produces: a Claude Code implementation handoff ready for user verification; no work on Skill 18.

- [x] **Step 1: Run fresh structural verification**

Run a static check that all required files exist: `skills/crawler-run-docker/SKILL.md`, `skills/crawler-run-docker/references/docker-workflow.md`, `skills/crawler-run-docker/references/output-contract.md`, `docs/superpowers/knowledge/evidence-cards/docker.md`, `docs/superpowers/knowledge/skill-views/crawler-run-docker.md`, `tests/skills/crawler-run-docker/cases.md`, `tests/skills/crawler-run-docker/results.md`. Expected: all present. Also verify cases `^## DK-` count = 8 and results `^## DK-` count = 8.

- [x] **Step 2: Scan implementation artifacts for placeholders and scope leaks**

Run `Select-String` over the Skill package, references, evidence cards, view, and results for placeholder terms and for affirmative instructions to install, build, run, scan, start proxies, perform destructive operations, or crawl targets. Negative safety statements are allowed; any affirmative runtime instruction is a failure. Expected: zero placeholders and zero affirmative runtime instructions. Also scan for secret-like tokens (api key, password, token, cookie, Bearer, OTEL_EXPORTER_OTLP headers) — only negative redaction statements allowed.

- [x] **Step 3: Reconcile evidence and behavior coverage**

Confirm the diagnostic flow, problem-classification rules, and implementation-conversion rules match design §5-6; the evidence-card grouping matches design §7; the output contract matches design §8; the handoff contract matches design §9 and decision log §33-36; all eight behavioral cases pass; no mention of Skill 18 or any future Skill as implementation work; `stellaris-crawler-context` context-package reading is explicit for Stellaris problems. Expected: no missing or duplicate item.

- [x] **Step 4: Update the ledger to `待验证`**

Record all created/modified paths, verification commands and outputs, behavioral count, remaining blockers, and the next action: user or independent reviewer verifies the Claude Code output. Do not mark `已完成` before that verification.

- [x] **Step 5: Handle failure, conflict, and rollback explicitly**

If final verification fails, do not publish the Skill as usable and do not modify the fixed manifest or any third-party repository. Keep the failing artifacts for diagnosis, change only this Skill's ledger status to `已阻塞`, and record the exact failing command, files, evidence IDs and last passing checkpoint. If a user-authorized Git repository exists, restore a prior current-Skill state with a new targeted revert commit; do not rewrite history. Without Git, apply only targeted corrections to the current Skill files and rerun the failed check—never bulk-delete project files or start Skill 18. Evidence conflicts remain visible with status `存在冲突`; they are not "rolled back" into a false deterministic claim.

- [x] **Step 6: Handle Git conditionally**

If `git -C E:\Stellaris rev-parse --is-inside-work-tree` succeeds because the user established a repository, commit remaining verified changes with `docs: finalize crawler run-docker skill`. If it fails, do not initialize Git; record that local files and the ledger are the persistence mechanism.

- [x] **Step 7: Stop before Skill 18**

Report the completed `crawler-run-docker` artifacts and verification evidence to the user. Do not start `crawler-use-postgresql` (Skill 18) planning or implementation until the user accepts this Skill's result and separately authorizes the next Skill.

---

## Plan Completion Criteria

This plan is implemented only when:

- every checkbox is completed or explicitly blocked with evidence;
- structural verification passes;
- all eight behavioral cases pass;
- the diagnostic flow, problem-classification rules, and implementation-conversion rules match the approved design;
- the evidence cards match the approved design §7 and the pinned batch-05 sources, and the Skill-17 view references them;
- the output contract and handoff contract match the approved design and decision-log §33-36;
- no third-party tool or crawler runtime action was executed; no secret content was persisted;
- the progress ledger is at `待验证` with a complete handoff;
- the user or independent reviewer verifies the result before changing the status to `已完成`.

Execution is assigned to Claude Code. This plan does not authorize Codex to execute it and does not authorize work on any other Skill.
