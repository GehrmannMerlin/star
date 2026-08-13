# Step 5 — Generic HTTP Fetch Agent Tool Plan

Phase: FAST DEVELOPMENT MODE (plan -> self-review -> self-approve -> execute).
Goal: expose the existing crawler HTTP capability to Pi through a thin adapter as
a generic agent tool `fetch_page`, reusing `@stellaris/crawler` `httpFetch` and its
SSRF/egress guard. No second HTTP stack, no Browser, no DocumentStore.

```
Pi -> fetch_page -> Pi Custom Tool Adapter -> ToolGateway -> FetchPage Tool
  -> CrawlerHttpAdapter -> existing httpFetch -> HTTP
```

## Task 1 — Fetch contracts + adapter boundary

Inspect crawler `httpFetch`/`safe-egress`/`dns-lookup` (done). Add to
`packages/agent-tools/src/tools/fetch/`:
- `PageFetcher` interface (provider-neutral): `fetchPage({ url, signal })`.
- `PageFetchRequest { url; signal }`, `PageFetchResponse { requestedUrl; finalUrl;
  statusCode; contentType; content; bytes }`.
No Pi imports. Mirrors the SearchProvider pattern.

## Task 2 — Crawler abort plumbing + CrawlerHttpAdapter

Minimal crawler change (allowed: AbortSignal plumbing only):
- `packages/crawler/src/http-fetch.ts`: add `signal?: AbortSignal` to `FetchContext`,
  pass to `http.request` options (conditionally, for exactOptionalPropertyTypes),
  and destroy the response on abort during body read. Backward compatible.

`packages/agent-tools/src/tools/fetch/crawler-http-adapter.ts`:
- Imports `httpFetch`/`OversizedResponseError` from `@stellaris/crawler/http-fetch.js`
  and `createSafeEgressPolicy` from `@stellaris/crawler/safe-egress.js`.
- Production policy with a conservative `maxBytes` (2 MiB, one place) and default
  timeout/redirects. No politeness/cache (single agent fetch, no re-verify).
- Protocol pre-check (`new URL`, http/https only) -> INVALID_INPUT before calling
  httpFetch; the authoritative guard stays inside httpFetch (assertAllowedUrl +
  DNS-pinned lookup) and is NEVER bypassed.
- Error classification (no new failure codes): pre-aborted -> ABORTED; timeout ->
  TIMEOUT; DNS -> DNS_ERROR; TLS/SSL -> TLS_ERROR; SSRF/private/localhost ->
  ACCESS_DENIED; invalid URL/protocol/port -> INVALID_INPUT; OversizedResponseError ->
  INTERNAL_ERROR; other -> INTERNAL_ERROR.
- HTTP status 403 -> HTTP_403, 412 -> HTTP_412 (existing codes; future browser
  fallback signal). Other statuses return SUCCESS with statusCode in the output.
- Decode body via charset from content-type (TextDecoder), utf-8 fallback.

## Task 3 — fetch_page tool + registry/Pi wiring

- `tools/fetch/fetch-page.ts`: `createFetchPageTool(deps?)` with default
  `new CrawlerHttpAdapter()`. Input `{ url: string }` (required, non-empty). Output
  `PageFetchResponse`. Description: "Fetch a public HTTP or HTTPS page and return
  the normalized response for further inspection."
- `default-tool-registry.ts`: register get_region_context + search_web + fetch_page.
  Pi custom-tool allowlist auto-includes fetch_page (read/bash/edit/write stay 0).
- Export from agent-tools index. Add `"@stellaris/crawler": "workspace:*"` to
  agent-tools package.json (agent-tools stays Pi-agnostic; crawler does not import Pi).

## Task 4 — Targeted tests + doctor + fetch smoke

Focused tests only (~7, mock fetch, no real network in unit tests):
- fetch_page tool: valid url -> stub fetcher called with { url, signal }; blank url
  -> INVALID_INPUT.
- CrawlerHttpAdapter (mock `@stellaris/crawler/http-fetch.js`): passes url + signal
  + production policy; output mapping incl. charset decode; timeout -> TIMEOUT;
  403 -> HTTP_403; 412 -> HTTP_412; pre-aborted -> ABORTED.
- Update session-factory / pi-tool-adapter tests to the 3-tool allowlist; doctor
  registered_tools = 3 and a small `http` status (READY when fetch_page registered).
- `packages/agent-runtime/src/smoke/fetch-smoke.ts` runner (`--url`) +
  `agent:smoke:fetch` scripts. Real smoke once on a stable public page.

## Task 5 — Verification, docs, commit

- `corepack pnpm install` (new workspace dep), build crawler -> agent-tools.
- `pnpm -r typecheck`, targeted tests, doctor (3 tools + http READY), one real
  fetch smoke. No DeepSeek/Bocha/Browser smoke, no full workspace tests.
- `docs/agent-runtime/http-fetch-agent-tool.md` (short: purpose, architecture,
  contract, crawler reuse, network safety, abort, failure mapping, deferred items).
- Self-review (see checklist below), one commit
  `feat(agent): add generic http fetch tool`. No push, no production changes.

SELF_REVIEW: PASS
ARCHITECTURE_CONFLICT: NONE
EXECUTION_PREAUTHORIZED_BY_USER: YES
TEST_POLICY: TARGETED_ONLY
