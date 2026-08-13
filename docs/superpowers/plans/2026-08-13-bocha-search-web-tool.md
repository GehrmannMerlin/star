# Step 4 — Provider-Neutral Web Search Tool Plan

Phase: FAST DEVELOPMENT MODE (plan -> self-review -> self-approve -> execute).
Goal: a generic agent tool `search_web` routed through ToolGateway -> SearchProvider
-> SearchProviderRegistry -> BochaSearchProvider -> Bocha Web Search API, returning
normalized SearchResult[] that are only navigation candidates (NOT Evidence).

Pi knows only `search_web`. Pi never sees Bocha.

## Task 1 — Architecture inspection + Search contracts

Confirm the existing tool stack (ToolRegistry, ToolGateway, ToolInvocationContext,
ToolResult, ToolFailureCode, MemoryToolEventSink, Pi custom tool adapter,
AgentSessionFactory allowlist, RuntimeModelConfig). No redesign.

Add generic search contracts in `packages/agent-tools/src/search/`:
- `SearchFreshness`: noLimit | oneDay | oneWeek | oneMonth | oneYear (default noLimit).
- `SearchRequest { query: string; limit?: number; freshness?: SearchFreshness }`.
- `SearchResult { title; url; snippet; domain; rank; siteName?; publishedAt? }`.
- `SearchProvider` interface: `name`, `isConfigured`, `search(request, signal)`.
- New failure codes in `tool-failure-codes.ts`: SEARCH_PROVIDER_NOT_CONFIGURED,
  SEARCH_PROVIDER_NOT_FOUND, SEARCH_AUTH_FAILED, SEARCH_RATE_LIMITED, SEARCH_REQUEST_FAILED.

## Task 2 — SearchProviderRegistry + Bocha adapter

- `SearchProviderRegistry`: register/get/list; resolve(name) fails closed with
  SEARCH_PROVIDER_NOT_FOUND (no auto fallback).
- `providers/bocha-search-provider.ts` (Bocha logic lives ONLY here + wiring):
  POST https://api.bochaai.com/v1/web-search, Bearer <BOCHA_API_KEY>,
  body `{ query, freshness, summary: true, count }`. Node 24 native fetch, no new deps.
  Normalize `webPages.value` (defensive `data.webPages.value` fallback): name->title,
  url->url, summary (else snippet)->snippet, siteName->siteName,
  datePublished->publishedAt, hostname->domain, index->rank. Missing fields fall back
  safely; entries without a URL are skipped; one bad entry never fails the search.
  401/403 -> SEARCH_AUTH_FAILED, 429 -> SEARCH_RATE_LIMITED, other non-2xx ->
  SEARCH_REQUEST_FAILED, network error -> SEARCH_REQUEST_FAILED, abort -> ABORTED.
  `isConfigured` = apiKey present. `BOCHA_API_KEY_ENV` constant lives here.
- Generic runtime config: `WEB_SEARCH_PROVIDER` env, fail closed when unset.
- `createSearchProviderRegistryFromEnv(env)` composition root registers the Bocha
  provider (apiKey from env, may be empty -> not configured).

## Task 3 — search_web tool + registry/Pi wiring

- `tools/search/search-web.ts`: `createSearchWebTool(deps?)`; generic name
  `search_web`, description "Search the public web for candidate pages and return
  normalized search results." Input schema: query (required, non-empty), limit
  (default 8, range 1..20), freshness (enum). Trims query; blank -> INVALID_INPUT.
  No configured provider -> SEARCH_PROVIDER_NOT_CONFIGURED; unknown -> NOT_FOUND;
  provider not configured -> SEARCH_PROVIDER_NOT_CONFIGURED. Output `{ provider,
  results }`. Routes through ToolGateway (callId/start/success/failure/abort).
- `default-tool-registry.ts`: register get_region_context + search_web. The Pi
  custom-tool allowlist (`registry.list()`) now auto-includes search_web while
  read/bash/edit/write stay disabled (allowlist mechanism unchanged).
- Export search modules from agent-tools `index.ts`.

## Task 4 — Targeted tests + doctor + smoke runner

Targeted tests only (~8-10, mock fetch, never hit real Bocha in unit tests):
- Bocha response -> normalized SearchResult.
- 401 -> SEARCH_AUTH_FAILED; 429 -> SEARCH_RATE_LIMITED.
- normal response -> SUCCESS.
- search_web empty/blank query -> INVALID_INPUT.
- search_web valid query -> provider called, SUCCESS via Gateway.
- no provider / unknown provider -> NOT_CONFIGURED / NOT_FOUND.
- registration: tools = get_region_context + search_web, coding tools absent.
- get_region_context regression through ToolGateway SUCCESS.

Update existing expectations (session-factory, pi-tool-adapter, runtime-doctor) to
the two-tool allowlist. Doctor adds `search: { provider, status }`; without a key it
stays FOUNDATION_READY with search NOT_CONFIGURED. Add lightweight smoke runner
`src/smoke/search-smoke.ts` (--query) + `agent:smoke:search` script. No DeepSeek
smoke, no Pi LLM, no fetch_page, no Browser, no DB, no Graphile.

## Task 5 — Verification, docs, commit

- `corepack pnpm -r typecheck`; build only if package entry changed.
- Run search + agent-tools tests, agent-runtime targeted tests, runtime doctor.
- Real Bocha smoke once (BOCHA_API_KEY required). If the key is absent: report
  STEP_4_WAITING_FOR_BOCHA_KEY, do not re-plan or revert.
- Write this plan + short docs note. No push, no production changes.
- One commit: `feat(agent): add provider-neutral web search tool`.

SELF_REVIEW: PASS
ARCHITECTURE_CONFLICT: NONE
EXECUTION_PREAUTHORIZED_BY_USER: YES
