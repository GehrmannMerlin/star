# Step 7 — Generic Page Inspection Agent Tool

Phase: Step 7 of the Stellaris Pi Agent refactor. Exposes the existing crawler
`extractPageFacts` to Pi as a generic, deterministic observation tool
`inspect_page` through a thin adapter. HTML in, structured page Observation out.

## Purpose

Give an agent a single generic tool to turn HTML it already obtained (via
`fetch_page` or `render_page`) into structured page observations for later
institution / leadership discovery. Pi knows only `inspect_page`.

## Architecture

```
fetch_page / render_page (already-fetched HTML content)
  |
  v
Pi -> inspect_page -> Pi Custom Tool Adapter -> ToolGateway -> InspectPage Tool
  -> CrawlerPageInspectionAdapter -> crawler extractPageFacts -> PageInspectionResult
```

- Generic tool + contracts live in `packages/agent-tools` (Pi-agnostic, no Pi imports).
- `CrawlerPageInspectionAdapter` reuses `@stellaris/crawler` `extractPageFacts`
  (cheerio) — no second HTML / DOM / links parser.
- `inspect_page` never connects: `url` is metadata only, validated http/https via
  the reused `assertPublicHttpUrl`. No DNS / SSRF work.

## inspect_page Contract

Input: `{ url: string, content: string }` (`content` is the raw HTML to parse).

Output `PageInspectionResult`:

- `url` — source URL metadata (never accessed).
- `documentHash` — sha256 of the raw HTML (from extractPageFacts).
- `title` — `<title>` text or null.
- `textPreview` / `textLength` / `textTruncated` — capped plain-text preview
  (16 KiB) plus the full length and whether it was truncated.
- `links` / `linkCount` / `linksTruncated` — capped link observations
  `{ text, url }` (raw hrefs as produced by the extractor) plus the full count.
- `leadershipMembers` — person-like / role-like observations from the existing
  extractor (table rows and `liId` list/card structures). Named after the
  extractor; they are observations, not confirmed persons.
- `pageDate` — date signal (meta published time / first date in body text).
- `headings` / `breadcrumb` / `tables` — `null`; the reused extractor does not
  produce these and no second parser was added this round.

## Observation-only Boundary

`inspect_page` is deterministic. It outputs observations only: it never emits
INCLUDE / EXCLUDE, PRIMARY, final Person / Position, Candidate ACCEPT/REJECT, or
Reviewer verdicts. Semantic decisions belong to Pi + Skill in a later stage.

## Text / Link Limits

Centralized constants in `tools/inspect/page-inspection.ts` (no magic numbers):

- `INSPECT_PAGE_TEXT_PREVIEW_LIMIT` = 16 KiB plain-text preview.
- `INSPECT_PAGE_LINK_LIMIT` = 500 link observations.

`textPreview` / `links` are capped so a huge navigation page cannot blow up the
LLM context; `textLength` / `linkCount` report the true totals and
`textTruncated` / `linksTruncated` flag the truncation.

## ToolGateway

`inspect_page` routes through the shared ToolGateway exactly like the other
tools. It is registered in `createAgentToolRegistry`; the Pi custom-tool
allowlist and session tool allowlist are derived from the registry, so
`inspect_page` is callable and the default coding tools
(`read`/`bash`/`edit`/`write`) stay disabled.

## Failure Mapping

- Empty / whitespace-only `content` -> INVALID_INPUT (no empty-facts success).
- Non-http(s) `url` -> INVALID_INPUT via the reused `assertPublicHttpUrl`.
- Schema-invalid input -> INVALID_INPUT at the Gateway.

## Raw HTML Handoff

First version passes the raw HTML `content` string directly into the tool. This
is the fastest closed loop today, but many agent calls that push raw HTML into
model context could grow token cost.

RAW_HTML_HANDOFF_OPTIMIZATION_DEFERRED — a future phase may introduce an opaque
`pageRef` plus a persistent page snapshot so the model only receives the
structured Observation, not the raw HTML.

## Deferred

- persistent Page Snapshot / snapshot DB (Raw HTML handoff optimization)
- opaque `pageRef` content reference
- Inventory Agent (institution discovery / INCLUDE-EXCLUDE freeze)
- heading / breadcrumb / structured-table extraction (needs an extractor
  upgrade; a second parser is intentionally avoided for now)
- absolute-URL normalization of link observations (no shared normalizer yet)
