# Step 4 — Provider-Neutral Web Search Tool

Phase: Step 4 of the Stellaris Pi Agent refactor. Adds a generic agent tool
`search_web` backed by a provider-neutral `SearchProvider` abstraction, with
Bocha as the initial provider adapter.

## Architecture

```
Pi (agent)
  -> search_web (generic tool)
  -> ToolGateway (callId / start / success / failure / abort)
  -> SearchProvider
  -> SearchProviderRegistry
  -> BochaSearchProvider  (the ONLY place that knows Bocha)
  -> Bocha Web Search API  (POST /v1/web-search)
  -> normalized SearchResult[]
```

- Pi knows only `search_web`; the provider is chosen server-side from
  `WEB_SEARCH_PROVIDER`.
- `BOCHA_API_KEY` is a server-side secret; it never reaches the user Task API,
  git, docs, logs, or the final report.
- A `SearchResult` is a **navigation candidate only** — it identifies a URL
  that still needs fetch + snapshot before it becomes formal Evidence. This
  phase creates no Evidence.

## Runtime config

- `WEB_SEARCH_PROVIDER=bocha` selects the provider (default: none -> fail closed).
- `BOCHA_API_KEY` supplies the secret for the Bocha adapter.

## Search failure taxonomy (added to ToolFailureCode)

- `SEARCH_PROVIDER_NOT_CONFIGURED` — no provider or no provider secret.
- `SEARCH_PROVIDER_NOT_FOUND` — configured provider name unknown (fail closed).
- `SEARCH_AUTH_FAILED` — HTTP 401/403.
- `SEARCH_RATE_LIMITED` — HTTP 429.
- `SEARCH_REQUEST_FAILED` — other HTTP failure or network error.

## Tests

Focused unit tests only (mock fetch): normalization, auth/rate-limit mapping,
invalid input, provider routing, tool registration, and a `get_region_context`
regression. No real Bocha call in unit tests; the real call happens only in the
one-shot `agent:smoke:search` runner.
