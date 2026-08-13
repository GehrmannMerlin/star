# Step 5 — Generic HTTP Fetch Agent Tool

Phase: Step 5 of the Stellaris Pi Agent refactor. Exposes the existing crawler
HTTP capability to Pi as a generic agent tool `fetch_page` through a thin adapter.

## Purpose

Give an agent a single generic tool to fetch a public HTTP(S) page and receive a
normalized response for later inspection. Pi knows only `fetch_page`.

## Architecture

```
Pi -> fetch_page -> Pi Custom Tool Adapter -> ToolGateway -> FetchPage Tool
  -> CrawlerHttpAdapter -> crawler httpFetch -> HTTP
```

- Generic tool + contracts live in `packages/agent-tools` (Pi-agnostic).
- `CrawlerHttpAdapter` reuses `@stellaris/crawler` `httpFetch` — no second HTTP
  client, DNS resolver, redirect loop, or User-Agent.
- The crawler's SSRF/egress guard (`assertAllowedUrl` + DNS-pinned lookup) is the
  single authoritative safety boundary and is never bypassed.

## fetch_page Contract

Input: `{ url: string }` (http/https only).

Output: `{ requestedUrl, finalUrl, statusCode, contentType, content, bytes }`.
`content` is the body decoded with the charset declared in `content-type`
(UTF-8 fallback).

## Crawler Reuse

Minimal crawler change: `FetchContext` gained an optional `signal?: AbortSignal`
wired into `http.request` options (AbortSignal plumbing only). Aborting mid-fetch
destroys the request + response stream, so the tool fails with ABORTED.

## Network Safety

- Only http/https, default ports 80/443.
- Private/localhost/reserved/metadata addresses and DNS resolutions are blocked by
  the crawler guard -> ACCESS_DENIED.
- Body capped at 2 MiB (conservative, configured in one place).
- Invalid URL/protocol -> INVALID_INPUT; timeout -> TIMEOUT; DNS -> DNS_ERROR;
  TLS/SSL -> TLS_ERROR; HTTP 403/412 -> HTTP_403/HTTP_412 (future Browser fallback
  signal); oversized -> INTERNAL_ERROR.

## Abort

`ToolInvocationContext.signal` flows through ToolGateway -> fetch_page ->
CrawlerHttpAdapter -> crawler httpFetch. A user cancel terminates the HTTP call.

## Deferred

- `render_page` / Browser fallback
- `inspect_page` (page parsing, encoding edge cases)
- persistent tool events / snapshot DB
