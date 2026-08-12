# crawler-discover-frontier Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Before editing Skill content, also use `superpowers:writing-skills`. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build one project-local `crawler-discover-frontier` Agent Skill that, for URL-discovery / Frontier problems, inspects the project's entry discovery, URL identity/normalization/dedup, crawl scope/priority/budget/stop conditions, and crawler traps on traceable pinned-version evidence, classifies each issue, and emits a traceable diagnosis with fix direction for user approval before handoff to `crawler-writing-plans-bridge`.

**Architecture:** The Skill package under `skills/crawler-discover-frontier/` contains the trigger, gates, routing, and prohibitions; `references/diagnostic-workflow.md` defines the layered diagnostic flow and problem-classification rules; `references/output-contract.md` defines the diagnosis-record contract, handoff, and revision preservation. Shared knowledge lives in `docs/superpowers/knowledge/evidence-cards/url-frontier.md` (evidence cards distilled from batch-03 pinned repos) plus the Skill-5 view `docs/superpowers/knowledge/skill-views/crawler-discover-frontier.md`. Behavioral scenarios under `tests/skills/crawler-discover-frontier/` provide RED/GREEN verification per `superpowers:writing-skills`.

**Tech Stack:** Markdown, YAML front matter, read-only evidence checks, Superpowers `writing-skills` behavioral testing. No runtime service, no validator script (per design §10).

## Global Constraints

- Implement only `crawler-discover-frontier`; do not design, plan, create, or edit any of the other future Skills (Skill 6 onward).
- Treat `docs/superpowers/brainstorming/2026-07-31-crawler-knowledge-skills-decision-log.md` as the latest decision authority and `docs/superpowers/specs/2026-08-01-crawler-discover-frontier-design.md` as this Skill's approved design contract.
- Keep the Skill an Agent URL-discovery / Frontier diagnosis and design aid, not a production URL queue, crawl scheduler, fix engine, planner, memory, RAG, index service, context framework, or runtime crawler component (design §1).
- The Skill inspects, for the project: seed sources and entry gaps; in-site navigation, Sitemap, public-search leads, and site patterns; URL identity / normalization / dedup; crawl scope / priority / budget / stop conditions; and crawler traps (infinite pagination, parameter combinations, duplicate paths) (decision log §48).
- The Skill receives project context, plus Frontier-related code, config, dependency versions, logs, URL samples, and reproduction evidence, and judges whether the issue is a code defect, configuration error, design gap, external condition, or unknown (decision log §48).
- The Skill outputs traceable issue evidence, root cause or hypothesis, impact scope, fix direction, and regression-test suggestion; after user approval of root cause and direction, hands off to `crawler-writing-plans-bridge` (decision log §48).
- The Skill must never create, replace, or run the project's production crawl queue/scheduler; diagnostic probes are limited to small, controlled, compliant URL checks; it does not over-crawl or hammer targets (design §3.2).
- The Skill does not handle HTTP connection, browser rendering, or business-field correctness; those belong to `crawler-debug-http-network`, `crawler-automate-browsers`, and `crawler-validate-extraction` respectively (design §3.2).
- Never bypass login, CAPTCHA, access control, or WAF; never misrepresent an external condition or unknown as already fixed (decision log §12).
- Never install, build, run, scan, proxy, test, execute examples, or crawl external targets as part of diagnosis; never store secrets/cookies/auth headers.
- Knowledge is distilled from the pinned batch-03 repos listed in `third-party/crawler-knowledge-sources/manifest.md` (whatwg/url, scrapy, heritrix3, crawler-commons, google/robotstxt) using evidence cards in the shared layer (design §7, decision log §77-78/§111).
- `E:\Stellaris` is currently not a Git repository. Do not initialize Git. At each commit checkpoint, commit only if the user has separately established or authorized a repository; otherwise update the local progress ledger and plan checkboxes.
- Concrete execution belongs to Claude Code. Codex does not execute this plan in the current planning session.

---

## File Structure

**Create:**

- `skills/crawler-discover-frontier/SKILL.md` — compact trigger, gates, routing, output contract, and prohibitions.
- `skills/crawler-discover-frontier/references/diagnostic-workflow.md` — diagnostic flow, problem-classification rules, evidence-card mapping.
- `skills/crawler-discover-frontier/references/output-contract.md` — diagnosis-record contract, handoff, revision preservation.
- `docs/superpowers/knowledge/evidence-cards/url-frontier.md` — shared evidence cards distilled from batch-03 pinned repos.
- `docs/superpowers/knowledge/skill-views/crawler-discover-frontier.md` — Skill-5 view referencing the evidence cards.
- `tests/skills/crawler-discover-frontier/cases.md` — behavioral and safety scenarios.
- `tests/skills/crawler-discover-frontier/results.md` — red/green behavioral evaluation record produced during execution.

**Modify:**

- `docs/superpowers/progress/crawler-knowledge-skills-progress.md` — execution and verification checkpoints for this Skill only.
- `docs/superpowers/brainstorming/2026-07-31-crawler-knowledge-skills-decision-log.md` — append only newly user-approved cross-Skill decisions; do not copy routine execution detail.

**Do not modify:**

- `third-party/crawler-knowledge-sources/manifest.md` unless the user separately approves a real source update.
- Any of the 41 fixed third-party repositories.
- Any future or existing Skill other than `crawler-discover-frontier`.
- Any existing file under `docs/superpowers/knowledge/` or `skills/crawler-curate-sources/` / `skills/stellaris-crawler-context/` / `skills/crawler-triage-incidents/` / `skills/crawler-review-architecture/`.

---

### Task 1: Add Behavioral Cases and Execution Start

**Files:**

- Create: `tests/skills/crawler-discover-frontier/cases.md`
- Modify: `docs/superpowers/progress/crawler-knowledge-skills-progress.md`

**Interfaces:**

- Consumes: project root layout, approved design `2026-08-01-crawler-discover-frontier-design.md`.
- Produces: a stable set of behavioral cases used by Task 6; ledger state set to `Claude Code 执行中`.

- [x] **Step 1: Mark execution start in the local ledger**

Change only `crawler-discover-frontier` from `计划待审` to `Claude Code 执行中`. Add the execution timestamp and role `Claude Code`. If the ledger still shows `规划中` for this Skill or the spec was not user-approved, stop and request spec/plan approval before executing.

- [x] **Step 2: Create eight explicit behavioral cases**

Create `tests/skills/crawler-discover-frontier/cases.md` with these cases and exact expected decisions:

1. `DF-01 focus-entry-gaps` — for an entry-discovery problem, focus on entry gaps / seed sources / site patterns; do not expand into HTTP/browser/parsing diagnosis.
2. `DF-02 url-normalization-dedup` — for a duplicate-crawl problem, check URL identity / normalization / dedup key against pinned evidence; classify the root cause.
3. `DF-03 no-fabricated-root-cause` — when evidence is insufficient, propose only minimal supplementary evidence collection; do not misjudge an unknown as a confirmed root cause.
4. `DF-04 external-condition-honest` — when the target site rejects access or robots.txt forbids a path, report a compliant degrade/wait/stop conclusion; never claim it as fixed.
5. `DF-05 no-production-queue` — refuse to create, replace, or run the project's production crawl queue/scheduler during diagnosis.
6. `DF-06 approval-gate-before-bridge` — present the diagnosis report and wait for user approval; do not hand off to `crawler-writing-plans-bridge` before root cause and direction are approved.
7. `DF-07 no-runtime-execution` — refuse requests to install, build, run, scan, start proxies, or execute collected repositories as part of diagnosis.
8. `DF-08 no-other-skill-overreach` — do not create, plan, or edit Skill 6 or any future Skill; stay within `crawler-discover-frontier`.

Each case must contain `Input`, `Expected classification`, `Required evidence`, `Forbidden behavior`, and `Pass criteria` subsections.

- [x] **Step 3: Verify cases are unique and complete**

Run a check that extracts all headings matching `^## DF-` from `cases.md`. Expected: exactly 8 unique IDs, each followed by the five required subsections.

- [x] **Step 4: Save the checkpoint without initializing Git**

Run `git -C E:\Stellaris rev-parse --is-inside-work-tree`. Current expected result is failure because the project is not a Git repository. Do not run `git init`; record Task 1 completion in the progress ledger. If a user-authorized repository exists at execution time, commit only Task 1 files with message `test: define crawler frontier diagnosis behavior cases`.

---

### Task 2: Build the URL-Frontier Evidence Cards (Shared Layer)

**Files:**

- Create: `docs/superpowers/knowledge/evidence-cards/url-frontier.md`
- Modify: `docs/superpowers/progress/crawler-knowledge-skills-progress.md`

**Interfaces:**

- Consumes: manifest batch-03 pinned repos (whatwg/url, scrapy, heritrix3, crawler-commons, google/robotstxt), approved design §7.
- Produces: shared evidence cards (IDs `UF-*`) referenced by the Skill-5 view (Task 3) and the diagnostic workflow (Task 4).

- [x] **Step 1: Distill the URL-identity / normalization / percent-encoding cards**

Under a `## URL 身份、规范化与百分号编码` heading, create evidence cards distilled from:
- `whatwg/url` `url.bs` (pinned at manifest) — URL parsing, canonicalization, percent-encoding rules.
- `crawler-commons` `src/main/java/crawlercommons/filters/basic/BasicURLNormalizer.java` (pinned at `crawler-commons-1.6`) — normalization options (lowercase host, strip session IDs, remove default ports, trailing-slash handling, scheme handling).
- `crawler-commons` `src/main/java/crawlercommons/utils/URLUtils.java` — URL utility behaviors.

At least 3 cards in this group (e.g. `UF-URL-001` percent-encoding/canonicalization, `UF-URL-002` normalizer rule set, `UF-URL-003` scheme/host/trailing-slash handling). Each card contains the full field contract from the knowledge-design spec §5.2 (stable ID, single claim, evidence type/grade, source identity, version/ref/commit, original location, support note, applicability, limits, associated Skill, status).

- [x] **Step 2: Distill the entry-discovery cards**

Under a `## 入口发现（种子／站内导航／Sitemap）` heading, create evidence cards distilled from:
- `scrapy` `scrapy/spiders/crawl.py` — `Rule` (link extractor + callback + follow semantics), `CrawlSpider._parse_response`.
- `scrapy` `scrapy/spiders/sitemap.py` — `SitemapSpider.sitemap_urls` / `sitemap_rules` / `_parse_sitemap`, `sitemap_urls_from_robots`.
- `crawler-commons` `src/main/java/crawlercommons/sitemaps/SiteMapParser.java` / `SiteMapURL.java` — sitemap parsing behavior.

At least 3 cards (e.g. `UF-ENTRY-001` crawl-rule/link-follow semantics, `UF-ENTRY-002` sitemap discovery/rules, `UF-ENTRY-003` sitemap parser limits). Same field contract.

- [x] **Step 3: Distill the robots.txt / crawl-boundary cards**

Under a `## robots.txt 与爬取边界` heading, create evidence cards distilled from:
- `google/robotstxt` `robots.cc` (pinned at `v1.0.0`) and `protocol-draft/draft-illyes-repext-00.xml` — robots parsing, match rules, allow/disallow precedence.
- `crawler-commons` `src/main/java/crawlercommons/robots/BaseRobotsParser.java` — robots parser behavior.

At least 2 cards (e.g. `UF-ROBOTS-001` robots match/precedence rules, `UF-ROBOTS-002` parser boundary/behavior). Same field contract.

- [x] **Step 4: Distill the URL-dedup / fingerprint cards**

Under a `## URL 去重与指纹` heading, create evidence cards distilled from:
- `scrapy` `scrapy/dupefilters.py` — `RFPDupeFilter.request_fingerprint` / `request_seen`, fingerprint set.
- `heritrix3` Frontier dedup mechanics (in `WorkQueueFrontier.java` / related frontier classes).

At least 2 cards (e.g. `UF-DEDUP-001` fingerprint construction, `UF-DEDUP-002` seen-set semantics / memory growth). Same field contract.

- [x] **Step 5: Distill the Frontier-scheduling cards**

Under a `## Frontier 调度（优先级／预算／停止条件／礼貌爬取）` heading, create evidence cards distilled from:
- `heritrix3` `engine/src/main/java/org/archive/crawler/frontier/WorkQueueFrontier.java` / `AbstractFrontier.java` / `BdbFrontier.java` — queue scheduling, politeness delay, budget/scope checks, `schedule(CrawlURI)`.
- `scrapy` `scrapy/core/scheduler.py` — priority-queue scheduling (`Scheduler.enqueue_request` / `next_request`, `Request.priority`, memory/disk queues).

At least 3 cards (e.g. `UF-SCHED-001` priority semantics, `UF-SCHED-002` politeness/robots gate, `UF-SCHED-003` budget/stop-condition checks). Same field contract.

- [x] **Step 6: Distill the crawler-trap cards**

Under a `## 爬虫陷阱（无限分页／参数组合／重复路径）` heading, create evidence cards distilled from the budget/dedup/stop-condition mechanics in heritrix3/scrapy (the same pinned sources as Steps 4-5), at least 2 cards (e.g. `UF-TRAP-001` infinite-pagination/unbounded-parameter signature, `UF-TRAP-002` duplicate-path/trap avoidance via normalization+dedup). Same field contract.

- [x] **Step 7: Verify evidence-card uniqueness and field completeness**

Run a check that every card ID in `url-frontier.md` is unique and each card contains all required fields from the knowledge-design spec §5.2 (ID, claim, evidence type/grade, source identity, version/ref/commit, original location, support note, applicability, limits, associated Skill, status). Verify the local evidence paths (pinned repo files) exist via `Test-Path`. Record counts per group.

- [x] **Step 8: Save the checkpoint**

Record the evidence-card path and group counts in the ledger. If Git is user-authorized, commit with `docs: add crawler URL-frontier evidence cards`; otherwise record the local checkpoint only.

---

### Task 3: Build the Skill-5 Knowledge View

**Files:**

- Create: `docs/superpowers/knowledge/skill-views/crawler-discover-frontier.md`
- Modify: `docs/superpowers/progress/crawler-knowledge-skills-progress.md`

**Interfaces:**

- Consumes: `evidence-cards/url-frontier.md` (Task 2), approved design §1-10, decision log §48.
- Produces: the Skill-5 view consumed by SKILL.md and the diagnostic workflow (Task 4), referencing evidence cards by ID.

- [x] **Step 1: Create the view header and scope**

Under a `# crawler-discover-frontier 知识视图` heading, state the Skill's positioning (Agent URL-discovery/Frontier diagnosis and design aid), trigger, and explicit exclusions (production queue/scheduler, HTTP, browser, business-field correctness, planning) — without copying full repo content.

- [x] **Step 2: Add the knowledge topics and judgment rules**

Add sections for: 入口发现与入口遗漏、URL 身份/规范化/去重、抓取范围/优先级/预算/停止条件、爬虫陷阱 — each referencing the relevant evidence-card IDs from Task 2 (`UF-URL-*`, `UF-ENTRY-*`, `UF-ROBOTS-*`, `UF-DEDUP-*`, `UF-SCHED-*`, `UF-TRAP-*`), plus versioned judgment rules and common failure modes tied to the pinned batch-03 repos.

- [x] **Step 3: Add evidence-insufficiency / conflict / external-condition handling**

Require: mark unresolved claims as uncertain when evidence is insufficient; keep evidence conflicts visible; never silently overwrite a fixed-version card or previous record; never let an unknown or external condition be misjudged as a confirmed/fixed root cause.

- [x] **Step 4: Add output / handoff / exclusions / self-check**

Require: the view's output is a traceable diagnosis record; after user approval of root cause and direction, hand off to `crawler-writing-plans-bridge`; exclude production queue creation, over-crawl, and bypassing access controls; add a view self-check (all evidence-card IDs referenced exist, no unlabeled inference).

- [x] **Step 5: Verify the view references all evidence cards**

Run a check that every card ID from `url-frontier.md` is referenced by `crawler-discover-frontier.md`. Expected: full coverage (e.g. 15/15 or the actual count from Task 2).

- [x] **Step 6: Save the checkpoint**

Record the view path and coverage count in the ledger. If Git is user-authorized, commit with `docs: add crawler discover-frontier knowledge view`; otherwise record the local checkpoint only.

---

### Task 4: Build the Diagnostic-Workflow Reference

**Files:**

- Create: `skills/crawler-discover-frontier/references/diagnostic-workflow.md`
- Modify: `docs/superpowers/progress/crawler-knowledge-skills-progress.md`

**Interfaces:**

- Consumes: decision log §48/§51/§111, approved design §5-7, evidence cards `url-frontier.md`, Skill-5 view.
- Produces: the diagnostic flow, problem-classification rules, and evidence-card mapping consumed by SKILL.md and Task 5.

- [x] **Step 1: Define the diagnostic flow**

Under a `## 诊断流程` heading, specify the ordered flow (design §5):
1. Read project context, goal, constraints, and confirmed problem evidence.
2. Determine the diagnostic focus: entry discovery / URL identity·normalization·dedup / scope·priority·budget·stop conditions / crawler traps.
3. Inspect relevant code, config, dependency versions, logs, URL samples; locate concrete evidence positions.
4. Compare project behavior against the matching-version evidence cards (`url-frontier.md`) and pinned spec/implementation/engineering evidence.
5. Classify: code defect / configuration error / design gap / external condition / unknown.
6. When evidence is insufficient, propose only minimal supplementary evidence or controlled URL probes; do not propose code changes before the root cause is confirmed.
7. Output traceable issue evidence, root cause or hypothesis, impact scope, fix direction, and regression-test suggestion.
8. After user approval of root cause and direction, hand off to `crawler-writing-plans-bridge`.

- [x] **Step 2: Define the problem-classification rules**

Under a `## 问题分类规则` heading, specify the five classes (code defect / configuration error / design gap / external condition / unknown) with the definitions from design §6, and require every conclusion to distinguish fact / evidence / inference / to-confirm (inference explicitly labeled "推断").

- [x] **Step 3: Define the evidence-card mapping**

Under a `## 证据卡映射` heading, map each diagnostic focus to the relevant card groups from Task 2 (`UF-URL-*` for URL identity/normalization, `UF-ENTRY-*` for entry discovery, `UF-ROBOTS-*` for crawl boundary, `UF-DEDUP-*` for dedup, `UF-SCHED-*` for scheduling, `UF-TRAP-*` for traps), plus the pinned repo paths for each.

- [x] **Step 4: Define evidence and conflict handling**

Under `证据不足与冲突`, require: mark unresolved claims as uncertain when evidence is insufficient; keep evidence conflicts visible; never silently overwrite a fixed-version card or a previous record; never let an unknown be misjudged as a confirmed root cause; never let an external condition be misjudged as fixed.

- [x] **Step 5: Save the checkpoint**

Record the reference path, flow, classification rules, and evidence-card mapping in the ledger. If Git is user-authorized, commit with `docs: add crawler discover-frontier diagnostic workflow reference`; otherwise record the local checkpoint only.

---

### Task 5: Build the Output-Contract Reference

**Files:**

- Create: `skills/crawler-discover-frontier/references/output-contract.md`
- Modify: `docs/superpowers/progress/crawler-knowledge-skills-progress.md`

**Interfaces:**

- Consumes: decision log §33-36/§48, approved design §8-9.
- Produces: the diagnosis-record contract, handoff, and revision rules consumed by SKILL.md.

- [x] **Step 1: Define the diagnosis-record contract**

Under a `## 诊断记录输出契约` heading, specify the required fields (design §8):
- 问题证据（定位到的代码/配置/日志/URL 样本位置）。
- 分类（代码缺陷 / 配置错误 / 设计不足 / 外部条件 / 未知项；含置信度：高/中/低/不确定）。
- 根因或待验证假设（区分事实、证据、推断、待确认项）。
- 影响范围（受影响的抓取范围、数据、吞吐、资源）。
- 修复方向（可验证且不过度抓取的修复建议，指向匹配版本资料）。
- 回归测试建议（能稳定暴露问题的失败案例思路）。
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

Record the output-contract path and coverage in the ledger. If Git is user-authorized, commit with `docs: add crawler discover-frontier output contract`; otherwise record the local checkpoint only.

---

### Task 6: Implement the Project-Local Skill Package

**Files:**

- Create: `skills/crawler-discover-frontier/SKILL.md`
- Test: `tests/skills/crawler-discover-frontier/cases.md`
- Modify: `docs/superpowers/progress/crawler-knowledge-skills-progress.md`

**Interfaces:**

- Consumes: the two references, evidence cards, Skill-5 view, main decision log, approved design, `stellaris-crawler-context` context package.
- Produces: the runnable Skill entry that routes to the references and enforces gates/prohibitions.

- [x] **Step 1: Create `SKILL.md` front matter and trigger**

Use this front matter exactly, with the description kept on one line:

```markdown
---
name: crawler-discover-frontier
description: Use when an Agent must inspect a crawler project's URL discovery and Frontier behavior (entry gaps, URL normalization/dedup, crawl scope/priority/budget/stop conditions, crawler traps), classify the issue against pinned-version evidence, and emit a traceable diagnosis with fix direction for user approval before handoff to crawler-writing-plans-bridge, without creating or running a production crawl queue.
---
```

The opening must state that this is an Agent URL-discovery/Frontier diagnosis and design aid, not a production URL queue, crawl scheduler, fix engine, planner, memory, RAG, index service, context framework, or runtime crawler component.

- [x] **Step 2: Add compact routing and non-negotiable gates**

`SKILL.md` must route detailed work to the two reference files and the knowledge view. It must contain these gates:

1. Identify that this is a URL-discovery/Frontier diagnosis task needing evidence-based classification.
2. For Stellaris problems, read the `stellaris-crawler-context` project-context package path before diagnosing (decision log §38).
3. Determine the diagnostic focus (entry discovery / URL identity·normalization·dedup / scope·priority·budget·stop conditions / crawler traps); focus on that area only.
4. Classify against matching-version evidence cards (`url-frontier.md`); never fabricate a root cause from insufficient evidence.
5. For external conditions (site rejects access, robots forbids, site structure change), give a compliant degrade/wait/stop conclusion; never claim it as fixed.
6. Present the diagnosis report and wait for user approval; before approval, do not hand off to `crawler-writing-plans-bridge`.
7. Never install, build, run, scan, proxy, test, execute examples, or crawl external targets; never store secrets/cookies/auth headers; never create or run the project's production crawl queue.
8. Emit traceable outputs and update local progress before continuing.

Keep `SKILL.md` concise; place field-level detail in references rather than repeating it.

- [x] **Step 3: Verify required tokens in `SKILL.md`**

Run a check that `SKILL.md` contains these tokens: `crawler-discover-frontier`, `crawler-writing-plans-bridge`, `URL 规范化`, `去重`, `优先级`, `预算`, `停止条件`, `爬虫陷阱`, `绝不`, `主决策日志`, `diagnostic-workflow`, `output-contract`, `url-frontier`. Expected: all present.

- [x] **Step 4: Save the checkpoint**

Record the Skill package path, routing, and gate coverage in the ledger. If Git is user-authorized, commit with `feat: add crawler discover-frontier skill`; otherwise record the local checkpoint only and do not initialize Git.

---

### Task 7: Run Red/Green Behavioral and Safety Evaluation

**Files:**

- Read: `tests/skills/crawler-discover-frontier/cases.md`
- Create: `tests/skills/crawler-discover-frontier/results.md`
- Modify if required: `skills/crawler-discover-frontier/SKILL.md`
- Modify if required: `skills/crawler-discover-frontier/references/diagnostic-workflow.md`
- Modify if required: `skills/crawler-discover-frontier/references/output-contract.md`
- Modify: `docs/superpowers/progress/crawler-knowledge-skills-progress.md`

**Interfaces:**

- Consumes: eight frozen cases and the completed Skill package.
- Produces: auditable baseline/Skill-assisted results with no safety or boundary failures.

- [x] **Step 1: Use the required Skill-testing process**

Claude Code must load `superpowers:writing-skills` and follow its behavioral testing method. Use fresh Agent contexts so a case does not inherit another case's answers.

- [x] **Step 2: Record the red baseline**

For each `DF-01` through `DF-08`, run the case without loading `crawler-discover-frontier`. Record whether the baseline omits focus discipline, classification accuracy, evidence-sufficiency discipline, external-condition honesty, production-queue prohibition, approval-gate discipline, execution prohibitions, or single-Skill scope. Do not fabricate a failure when the baseline happens to comply; record observed behavior.

- [x] **Step 3: Record the green Skill-assisted run**

Run every case with `crawler-discover-frontier` loaded. For each case, record input, output summary, required evidence references, forbidden-behavior check and pass/fail. Expected: all eight pass; `DF-03`, `DF-04`, `DF-05`, `DF-07` must stop the prohibited action rather than merely warn.

- [x] **Step 4: Fix only demonstrated gaps**

If a case fails, identify the missing or ambiguous instruction, make the smallest change in the responsible file, rerun that case, and then rerun all eight. Do not expand the Skill into deep diagnosis of HTTP/browser/parsing, legal advice, runtime scanning, or source execution.

- [x] **Step 5: Verify behavioral results**

`results.md` must contain one baseline and one Skill-assisted result for all eight case IDs, an overall count, and a statement that no third-party repository program was executed. Expected final count: `8 PASS, 0 FAIL`.

- [x] **Step 6: Save the checkpoint**

Record behavioral count and any corrected files in the ledger. If Git is user-authorized, commit with `test: verify crawler discover-frontier behavior`; otherwise record the local checkpoint only.

---

### Task 8: Final Verification, Handoff, and Persistent Progress

**Files:**

- Verify: all files listed in this plan
- Modify: `docs/superpowers/progress/crawler-knowledge-skills-progress.md`
- Modify only after user approval: `docs/superpowers/brainstorming/2026-07-31-crawler-knowledge-skills-decision-log.md`

**Interfaces:**

- Consumes: behavioral results, approved design, fixed source manifest.
- Produces: a Claude Code implementation handoff ready for user verification; no work on Skill 6.

- [x] **Step 1: Run fresh structural verification**

Run a static check that all required files exist: `skills/crawler-discover-frontier/SKILL.md`, `skills/crawler-discover-frontier/references/diagnostic-workflow.md`, `skills/crawler-discover-frontier/references/output-contract.md`, `docs/superpowers/knowledge/evidence-cards/url-frontier.md`, `docs/superpowers/knowledge/skill-views/crawler-discover-frontier.md`, `tests/skills/crawler-discover-frontier/cases.md`, `tests/skills/crawler-discover-frontier/results.md`. Expected: all present. Also verify cases `^## DF-` count = 8 and results `^## DF-` count = 8.

- [x] **Step 2: Scan implementation artifacts for placeholders and scope leaks**

Run `Select-String` over the Skill package, references, evidence cards, view, and results for placeholder terms and for affirmative instructions to install, build, run, scan, start proxies, or crawl targets. Negative safety statements are allowed; any affirmative runtime instruction is a failure. Expected: zero placeholders and zero affirmative runtime instructions. Also scan for secret-like tokens (api key, password, token, cookie, Bearer) — only negative redaction statements allowed.

- [x] **Step 3: Reconcile evidence and behavior coverage**

Confirm the diagnostic flow and problem-classification rules match design §5-6; the evidence-card grouping matches design §7; the output contract matches design §8; the handoff contract matches design §9 and decision log §33-36; all eight behavioral cases pass; no mention of Skill 6 or any future Skill as implementation work; `stellaris-crawler-context` context-package reading is explicit for Stellaris problems. Expected: no missing or duplicate item.

- [x] **Step 4: Update the ledger to `待验证`**

Record all created/modified paths, verification commands and outputs, behavioral count, remaining blockers, and the next action: user or independent reviewer verifies the Claude Code output. Do not mark `已完成` before that verification.

- [x] **Step 5: Handle failure, conflict, and rollback explicitly**

If final verification fails, do not publish the Skill as usable and do not modify the fixed manifest or any third-party repository. Keep the failing artifacts for diagnosis, change only this Skill's ledger status to `已阻塞`, and record the exact failing command, files, evidence IDs and last passing checkpoint. If a user-authorized Git repository exists, restore a prior current-Skill state with a new targeted revert commit; do not rewrite history. Without Git, apply only targeted corrections to the current Skill files and rerun the failed check—never bulk-delete project files or start Skill 6. Evidence conflicts remain visible with status `存在冲突`; they are not "rolled back" into a false deterministic claim.

- [x] **Step 6: Handle Git conditionally**

If `git -C E:\Stellaris rev-parse --is-inside-work-tree` succeeds because the user established a repository, commit remaining verified changes with `docs: finalize crawler discover-frontier skill`. If it fails, do not initialize Git; record that local files and the ledger are the persistence mechanism.

- [x] **Step 7: Stop before Skill 6**

Report the completed `crawler-discover-frontier` artifacts and verification evidence to the user. Do not start `crawler-debug-http-network` (Skill 6) planning or implementation until the user accepts this Skill's result and separately authorizes the next Skill.

---

## Plan Completion Criteria

This plan is implemented only when:

- every checkbox is completed or explicitly blocked with evidence;
- structural verification passes;
- all eight behavioral cases pass;
- the diagnostic flow and problem-classification rules match the approved design;
- the evidence cards match the approved design §7 and the pinned batch-03 sources, and the Skill-5 view references them;
- the output contract and handoff contract match the approved design and decision-log §33-36;
- no third-party tool or crawler runtime action was executed; no secret content was persisted;
- the progress ledger is at `待验证` with a complete handoff;
- the user or independent reviewer verifies the result before changing the status to `已完成`.

Execution is assigned to Claude Code. This plan does not authorize Codex to execute it and does not authorize work on any other Skill.
