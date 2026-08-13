# Generic Browser Render Agent Tool

> Step 6 of the Pi-agent runtime refactor. Status: implemented, dev smoke PASS.

## Purpose

Expose the existing crawler BrowserPool / Playwright capability to Pi as a
generic agent tool `render_page`. It lets a future Agent upgrade from
`fetch_page` when a page needs a real browser (dynamic content, JS rendering).

## render_page Contract

- Generic tool name: `render_page` (Pi and Skills never see a concrete browser).
- Input (minimal):
  ```json
  { "url": "https://example.gov.cn/xxx" }
  ```
  No selector / evaluate / headers / cookies / userAgent / browser flags DSL.
- Output (mirrors `PageFetchResponse` + render fields):
  ```
  requestedUrl, finalUrl, statusCode, title, contentType,
  content (rendered HTML), bytes, truncated
  ```
- Wait strategy: reuse BrowserPool's current default — `domcontentloaded`
  (30 s goto timeout), no `networkidle`, no fixed settle delay, no waitSelector.
- Content limit: reuse `FETCH_PAGE_MAX_BYTES` (2 MiB); oversized DOM is
  truncated and flagged `truncated: true`. Never returns unbounded DOM.

## Existing BrowserPool Reuse

- The tool routes: `Pi -> render_page -> Pi Custom Tool Adapter -> ToolGateway ->
  RenderPage Tool -> CrawlerBrowserAdapter -> existing BrowserPool -> Chromium`.
- `CrawlerBrowserAdapter` (packages/agent-tools/src/tools/render/) is a thin
  adapter over `@stellaris/crawler/browser/render.js` `BrowserPool` — it never
  calls `chromium.launch()` itself; the pool owns the browser lifecycle.
- The adapter owns and closes a pool it creates; an injected pool is
  caller-owned (tests, the smoke runner).

## Chromium Development Runtime

- Version: Playwright 1.62.1 (project-pinned), Chromium revision 1234 /
  headless shell 1234.
- Installed only into the dev server's Playwright browser cache
  (`~/.cache/ms-playwright/`) via:
  `PLAYWRIGHT_DOWNLOAD_HOST=https://registry.npmmirror.com/-/binary/playwright
  corepack pnpm --filter @stellaris/crawler exec playwright install chromium`.
  Nothing enters git, the repo, or the production container.
- BrowserPool honors `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` first, else
  `chromium.executablePath()` (`resolveChromiumExecutablePath`).

## URL Safety

- Top-level URL passes the same authoritative crawler egress guard as
  `fetch_page` before any browser is launched: cheap protocol pre-check
  (`assertPublicHttpUrl`) -> `assertAllowedUrl` (protocol/port/hostname) ->
  DNS-pinned `dnsLookup` pre-flight (rejects private/metadata/loopback IPs).
  This guard is never bypassed.
- The browser still resolves sub-resources itself; full private-network
  sandboxing for sub-resources is deferred hardening (BrowserPool already
  blocks image/font/media via route interception, which is reused as-is).

## Abort

- `ToolInvocationContext.signal` flows: ToolGateway -> render_page ->
  CrawlerBrowserAdapter -> BrowserPool.
- A pre-aborted signal short-circuits to `ABORTED` before launch. If the
  signal fires mid-render, the pool closes the active context (stopping
  navigation); the adapter maps the failure to `ABORTED`, and a post-render
  check makes abort deterministic even if navigation raced ahead.

## Failure Mapping

New codes (only what is necessary):
- `BROWSER_LAUNCH_FAILED` — executable missing / launch failure.
- `BROWSER_NAVIGATION_FAILED` — goto-level network errors.

Reused: `INVALID_INPUT`, `ACCESS_DENIED`, `DNS_ERROR`, `TIMEOUT`, `ABORTED`,
`INTERNAL_ERROR`.

## Deferred

- `inspect_page` (DOM semantic parsing — personnel/roles/links/institutions)
  is the next module; render_page only returns rendered HTML + metadata.
- Browser sub-resource network sandbox hardening.
- Persistent ToolEvent.
- Inventory Agent.
