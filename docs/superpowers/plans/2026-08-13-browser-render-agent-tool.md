# Step 6 — Generic Browser Render Agent Tool Plan

Phase: FAST DEVELOPMENT MODE (plan -> self-review -> self-approve -> execute inline).
Goal: expose the existing crawler BrowserPool/Playwright capability to Pi through a
thin adapter as a generic agent tool `render_page`. No second browser runtime, no DOM
semantic parsing, no inspect_page, no Inventory Agent.

```
Pi -> render_page -> Pi Custom Tool Adapter -> ToolGateway -> RenderPage Tool
  -> CrawlerBrowserAdapter -> existing BrowserPool (browser/render.ts) -> Chromium
```

## Global Constraints (from Step 6 spec)

- Reuse the existing `@stellaris/crawler` BrowserPool (packages/crawler/src/browser/render.ts,
  playwright 1.62.1). No second `chromium.launch()` lifecycle.
- Generic tool name `render_page`. agent-tools stays Pi-agnostic; Pi adapter stays in agent-runtime.
- Always through ToolGateway; reuse `ToolInvocationContext.signal` end-to-end.
- Top-level URL goes through the existing crawler SSRF/egress guard
  (`assertAllowedUrl` + DNS-pinned `dnsLookup`); it is never bypassed.
- Keep get_region_context / search_web / fetch_page. read/bash/edit/write stay disabled.
- Input minimal: `{ url: string }` only. No selector / evaluate / headers / cookies / flags DSL.
- Content cap: reuse `FETCH_PAGE_MAX_BYTES` (2 MiB). Never return unbounded DOM.
- No Skill, no Graphile, no DB migration, no inspect_page, no Inventory Agent, no full tests.

---

## Task 1 — Crawler BrowserPool hardening + dns-lookup export

**Files:**
- Modify: `packages/crawler/src/browser/render.ts`
- Modify: `packages/crawler/package.json` (add `./dns-lookup.js` export)
- Modify: `packages/crawler/src/browser/render.test.ts`
- Build: `corepack pnpm --filter @stellaris/crawler build`

**Interfaces produced (used by Task 3/4):**
- `RenderResult` gains `statusCode: number`.
- `RenderOptions` gains `signal?: AbortSignal`.
- `BrowserPool.isOpen(): boolean` (true while a browser is launched).
- `resolveChromiumExecutablePath(): string` (env `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` || `chromium.executablePath()`).
- `@stellaris/crawler/dns-lookup.js` now importable (exports `dnsLookup`, `DnsAddressRecord`).

- [ ] **Step 1 — Add `statusCode` + `signal` + `isOpen` to BrowserPool**

In `packages/crawler/src/browser/render.ts`:

```ts
export interface RenderResult {
  fetchUrl: string;
  title: string | null;
  bodyText: string;
  html: Uint8Array;
  waitSignals: string[];
  statusCode: number;   // added
}

export interface RenderOptions {
  waitSelector?: string;
  politeness?: import("../polite/politeness.js").PolitenessGate;
  signal?: AbortSignal; // added: caller abort propagates to navigation/context
}

// add to BrowserPool:
isOpen(): boolean {
  return this.browser !== null;
}
```

`render()` changes:

```ts
async render(url: string, opts: RenderOptions = {}): Promise<RenderResult> {
  const releaseGate = opts.politeness ? await opts.politeness.acquire(new URL(url).host) : null;
  try {
    if (opts.signal?.aborted) throw new Error("render aborted");
    const browser = await this.getBrowser();
    const context = await browser.newContext({
      userAgent: "stellaris-crawler/0.1 (research; contact: local)",
      viewport: { width: 1280, height: 900 },
    });
    const onAbort = () => { void context.close().catch(() => {}); };
    opts.signal?.addEventListener("abort", onAbort, { once: true });
    try {
      const page: Page = await context.newPage();
      try {
        await page.route("**/*", (route) => { /* unchanged image/font/media block */ });
        const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
        // ... waitSelector block unchanged ...
        const title = await page.title().catch(() => null);
        const bodyText = (await page.locator("body").innerText().catch(() => "")).replace(/\s+/g, " ").trim();
        const htmlBuffer = await page.content().then((h) => Buffer.from(h, "utf-8")).catch(() => Buffer.alloc(0));
        return {
          fetchUrl: page.url(),
          title,
          bodyText,
          html: new Uint8Array(htmlBuffer),
          waitSignals,
          statusCode: response?.status() ?? 0,
        };
      } finally {
        await context.close().catch(() => {}); // double-close safe (abort path)
      }
    } finally {
      opts.signal?.removeEventListener("abort", onAbort);
    }
  } finally {
    releaseGate?.();
  }
}
```

`getBrowser()` uses the new helper:

```ts
export function resolveChromiumExecutablePath(): string {
  const envPath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?.trim();
  return envPath || chromium.executablePath();
}
// inside getBrowser(): const executablePath = resolveChromiumExecutablePath();
```

- [ ] **Step 2 — Export `./dns-lookup.js`**

Add to `packages/crawler/package.json` exports:

```json
"./dns-lookup.js": {
  "types": "./dist/dns-lookup.d.ts",
  "default": "./dist/dns-lookup.js"
}
```

- [ ] **Step 3 — Extend render test**

In `packages/crawler/src/browser/render.test.ts` add assertions to the existing test:

```ts
expect(res.statusCode).toBeGreaterThanOrEqual(200);
```

and one abort test:

```ts
it("aborts an in-flight render and closes the context", async () => {
  pool = new BrowserPool({ maxPages: 2 });
  const srv = await createFixtureServer([{ pathPrefix: "/golden", dir: join(import.meta.dirname, "golden") }]);
  const controller = new AbortController();
  controller.abort();
  await expect(pool.render(`${srv.url}/golden/dynamic.html`, { waitSelector: ".bio", signal: controller.signal }))
    .rejects.toThrow("aborted");
  expect(pool.isOpen()).toBe(false); // browser still closed when nothing launched
  await srv.close();
}, 60_000);
```

- [ ] **Step 4 — Build**

Run: `corepack pnpm --filter @stellaris/crawler build`. Expected: PASS.

---

## Task 2 — Minimal development Chromium runtime

**Files:** none (playwright browser cache only, outside git).

- [ ] **Step 1 — Install pinned Chromium**

Run (uses the workspace-pinned playwright 1.62.1 CLI; cache only, no deps):

```bash
source ~/.nvm/nvm.sh && nvm use 24.19.0
cd /opt/Stellaris-PiAgent-Dev
corepack pnpm exec playwright install chromium
```

Verify: `ls ~/.cache/ms-playwright/` shows a `chromium-*/` directory.

- [ ] **Step 2 — Bootstrap smoke (no system changes)**

```bash
source ~/.nvm/nvm.sh && nvm use 24.19.0
cd /opt/Stellaris-PiAgent-Dev
node --input-type=module -e "
import { BrowserPool } from './packages/crawler/dist/browser/render.js';
const pool = new BrowserPool();
const res = await pool.render('https://example.com/');
console.log('status', res.statusCode, 'title', res.title, 'bytes', res.html.byteLength);
await pool.close();
console.log('released', !pool.isOpen());
"
```

Expected: status 200, released true.
If Chromium launches but reports a missing shared library / unsupported runtime: stop here and report
`STEP_6_BROWSER_RUNTIME_BLOCKED` (do NOT `dnf install`; do NOT touch production).

- [ ] **Step 3 — Gate**

Bootstrap smoke passes → proceed to Task 3.

---

## Task 3 — render_page tool stack (contracts + adapter + tool + registry)

**Files:**
- Create: `packages/agent-tools/src/tools/render/page-renderer.ts`
- Create: `packages/agent-tools/src/tools/render/crawler-browser-adapter.ts`
- Create: `packages/agent-tools/src/tools/render/render-page.ts`
- Create: `packages/agent-tools/src/tools/render/render-page.test.ts`
- Create: `packages/agent-tools/src/tools/render/crawler-browser-adapter.test.ts`
- Create: `packages/agent-tools/src/registry/default-tool-registry.test.ts`
- Modify: `packages/agent-tools/src/contracts/tool-failure-codes.ts`
- Modify: `packages/agent-tools/src/tools/fetch/crawler-http-adapter.ts`
- Modify: `packages/agent-tools/src/registry/default-tool-registry.ts`
- Modify: `packages/agent-tools/src/index.ts`

**Interfaces produced (used by Task 4):**
- `PageRenderRequest { url: string; signal: AbortSignal }`
- `PageRenderResponse = PageFetchResponse & { title: string | null; truncated: boolean }`
- `interface PageRenderer { renderPage(request: PageRenderRequest): Promise<PageRenderResponse> }`
- `createRenderPageTool(deps?: { renderer?: PageRenderer }): AgentToolDefinition<typeof RenderPageInput, PageRenderResponse>`
- `class CrawlerBrowserAdapter implements PageRenderer` with `deps?: { pool?: RenderPoolLike; verifyUrl?: (url: string) => Promise<void> }`
- `createAgentToolRegistry({ renderPageTool?: AgentToolDefinition })` now accepts a render_page override.
- New failure codes: `BROWSER_LAUNCH_FAILED`, `BROWSER_NAVIGATION_FAILED`.

- [ ] **Step 1 — Add browser failure codes**

In `packages/agent-tools/src/contracts/tool-failure-codes.ts` append to the const object:

```ts
BROWSER_LAUNCH_FAILED: "BROWSER_LAUNCH_FAILED",
BROWSER_NAVIGATION_FAILED: "BROWSER_NAVIGATION_FAILED",
```

- [ ] **Step 2 — Export `assertPublicHttpUrl` from crawler-http-adapter**

`packages/agent-tools/src/tools/fetch/crawler-http-adapter.ts`: change `function assertPublicHttpUrl` to `export function assertPublicHttpUrl` (no behavior change; re-used by the render adapter).

- [ ] **Step 3 — `page-renderer.ts`**

```ts
import type { PageFetchResponse } from "../fetch/page-fetcher.js";

export type PageRenderRequest = { url: string; signal: AbortSignal };

/** Rendered HTML + metadata, mirroring PageFetchResponse for future inspect_page consumers. */
export type PageRenderResponse = PageFetchResponse & {
  title: string | null;
  truncated: boolean;
};

export interface PageRenderer {
  renderPage(request: PageRenderRequest): Promise<PageRenderResponse>;
}
```

- [ ] **Step 4 — `crawler-browser-adapter.ts`**

```ts
import { BrowserPool, type RenderResult } from "@stellaris/crawler/browser/render.js";
import { dnsLookup } from "@stellaris/crawler/dns-lookup.js";
import { assertAllowedUrl, createSafeEgressPolicy } from "@stellaris/crawler/safe-egress.js";
import { ToolFailureCode, ToolFailureError } from "../../contracts/tool-failure-codes.js";
import { assertPublicHttpUrl, FETCH_PAGE_MAX_BYTES } from "../fetch/crawler-http-adapter.js";
import type { PageRenderRequest, PageRenderResponse, PageRenderer } from "./page-renderer.js";

const RENDER_CONTENT_TYPE = "text/html; charset=utf-8";

/** Surface of BrowserPool used by the adapter (injectable for tests). */
export type RenderPoolLike = {
  render(url: string, opts: { signal?: AbortSignal }): Promise<RenderResult>;
  close(): Promise<void>;
};

export type CrawlerBrowserAdapterDeps = {
  pool?: RenderPoolLike;
  /** Authoritative top-level URL safety check; tests inject a stub. Default: real guard. */
  verifyUrl?: (url: string) => Promise<void>;
};

const defaultVerifyUrl = async (url: string): Promise<void> => {
  assertPublicHttpUrl(url);
  const policy = createSafeEgressPolicy();
  assertAllowedUrl(url, policy);
  await dnsLookup(new URL(url).hostname, policy); // DNS-pinned SSRF pre-flight
};

function classifyBrowserError(error: unknown, signal: AbortSignal): ToolFailureError {
  if (signal.aborted) {
    return new ToolFailureError({ code: ToolFailureCode.ABORTED, message: "Page render aborted", retryable: false });
  }
  const message = error instanceof Error ? error.message : String(error);
  if (/Executable doesn't exist|Executable path doesn't exist|Failed to launch|Missing X server|spawn .* ENOENT/i.test(message)) {
    return new ToolFailureError({ code: ToolFailureCode.BROWSER_LAUNCH_FAILED, message, retryable: false });
  }
  if (/DNS 解析失败|net::ERR_NAME_NOT_RESOLVED|net::ERR_ADDRESS_UNREACHABLE/i.test(message)) {
    return new ToolFailureError({ code: ToolFailureCode.DNS_ERROR, message, retryable: true });
  }
  if (/Timeout|timed ?out|net::ERR_TIMED_OUT|net::ERR_CONNECTION_TIMED_OUT/i.test(message)) {
    return new ToolFailureError({ code: ToolFailureCode.TIMEOUT, message, retryable: true });
  }
  if (/非法 URL|仅允许 http|禁止的协议|非默认端口|测试端口未登记/i.test(message)) {
    return new ToolFailureError({ code: ToolFailureCode.INVALID_INPUT, message, retryable: false });
  }
  if (/禁止|localhost|回环|禁止的地址段|禁止保留主机名/i.test(message)) {
    return new ToolFailureError({ code: ToolFailureCode.ACCESS_DENIED, message, retryable: false });
  }
  if (/net::ERR_|Target closed|Navigation failed/i.test(message)) {
    return new ToolFailureError({ code: ToolFailureCode.BROWSER_NAVIGATION_FAILED, message, retryable: false });
  }
  return new ToolFailureError({ code: ToolFailureCode.INTERNAL_ERROR, message, retryable: false });
}

export class CrawlerBrowserAdapter implements PageRenderer {
  constructor(private readonly deps: CrawlerBrowserAdapterDeps = {}) {}

  async renderPage(request: PageRenderRequest): Promise<PageRenderResponse> {
    if (request.signal.aborted) {
      throw new ToolFailureError({ code: ToolFailureCode.ABORTED, message: "Page render aborted", retryable: false });
    }
    const verifyUrl = this.deps.verifyUrl ?? defaultVerifyUrl;
    try {
      await verifyUrl(request.url);
    } catch (error) {
      throw classifyBrowserError(error, request.signal);
    }

    const ownsPool = this.deps.pool === undefined;
    const pool = this.deps.pool ?? new BrowserPool();
    try {
      const result = await pool.render(request.url, { signal: request.signal });
      if (request.signal.aborted) {
        // Deterministic ABORTED even when navigation raced ahead of the abort listener.
        throw new ToolFailureError({ code: ToolFailureCode.ABORTED, message: "Page render aborted", retryable: false });
      }
      return normalizeRenderResult(request.url, result);
    } catch (error) {
      throw classifyBrowserError(error, request.signal);
    } finally {
      if (ownsPool) await pool.close().catch(() => {});
    }
  }
}

function normalizeRenderResult(requestedUrl: string, result: RenderResult): PageRenderResponse {
  const totalBytes = result.html.byteLength;
  const truncated = totalBytes > FETCH_PAGE_MAX_BYTES;
  const bytes = truncated ? FETCH_PAGE_MAX_BYTES : totalBytes;
  const content = new TextDecoder("utf-8").decode(result.html.subarray(0, FETCH_PAGE_MAX_BYTES));
  return {
    requestedUrl,
    finalUrl: result.fetchUrl,
    statusCode: result.statusCode,
    contentType: RENDER_CONTENT_TYPE,
    content,
    bytes,
    truncated,
    title: result.title,
  };
}
```

- [ ] **Step 5 — `render-page.ts` tool**

```ts
import { Type, type Static } from "@sinclair/typebox";
import { ToolFailureCode, ToolFailureError } from "../../contracts/tool-failure-codes.js";
import type { AgentToolDefinition } from "../../contracts/tool-types.js";
import { CrawlerBrowserAdapter } from "./crawler-browser-adapter.js";
import type { PageRenderResponse, PageRenderer } from "./page-renderer.js";

export const RenderPageInput = Type.Object(
  { url: Type.String({ minLength: 1 }) },
  { additionalProperties: false },
);
export type RenderPageInput = Static<typeof RenderPageInput>;

export type RenderPageToolDeps = { renderer: PageRenderer };

export function createRenderPageTool(deps?: Partial<RenderPageToolDeps>): AgentToolDefinition<typeof RenderPageInput, PageRenderResponse> {
  const renderer = deps?.renderer ?? new CrawlerBrowserAdapter();
  return {
    name: "render_page",
    description:
      "Render a public HTTP or HTTPS page in a headless browser and return the rendered HTML for further inspection.",
    inputSchema: RenderPageInput,
    async execute(context, input) {
      const url = input.url.trim();
      if (url.length === 0) {
        throw new ToolFailureError({ code: ToolFailureCode.INVALID_INPUT, message: "render_page url must be a non-empty string", retryable: false });
      }
      return renderer.renderPage({ url, signal: context.signal });
    },
  };
}
```

- [ ] **Step 6 — Register render_page in default registry**

`packages/agent-tools/src/registry/default-tool-registry.ts`:

```ts
import { createRenderPageTool } from "../tools/render/render-page.js";
// in CreateAgentToolRegistryOptions:
renderPageTool?: AgentToolDefinition;
// in createAgentToolRegistry:
const renderPage = options.renderPageTool ?? createRenderPageTool();
return new ToolRegistry([getRegionContextTool, searchWeb, fetchPage, renderPage]);
```

- [ ] **Step 7 — Export from agent-tools index**

`packages/agent-tools/src/index.ts` append:

```ts
export * from "./tools/render/page-renderer.js";
export * from "./tools/render/crawler-browser-adapter.js";
export * from "./tools/render/render-page.js";
```

- [ ] **Step 8 — render_page tool test** (`render-page.test.ts`)

```ts
const invocationContext = {
  taskRunId: "task-render", agentSessionId: "session-render",
  agentRole: "INVESTIGATOR" as const, signal: new AbortController().signal,
};

it("calls the configured renderer with the url and invocation signal", async () => {
  const renderer: PageRenderer = {
    async renderPage(request) {
      expect(request.url).toBe("https://www.gov.cn/");
      expect(request.signal).toBe(invocationContext.signal);
      return { requestedUrl: request.url, finalUrl: request.url, statusCode: 200, contentType: "text/html", content: "<html/>", bytes: 8, truncated: false, title: "t" };
    },
  };
  const tool = createRenderPageTool({ renderer });
  const output = await tool.execute(invocationContext, { url: "  https://www.gov.cn/  " });
  expect(output).toMatchObject({ statusCode: 200, truncated: false, title: "t" });
});

it("rejects a blank url with INVALID_INPUT before calling the renderer", async () => {
  const renderer: PageRenderer = { async renderPage() { throw new Error("must not run"); } };
  const tool = createRenderPageTool({ renderer });
  await expect(tool.execute(invocationContext, { url: "   " })).rejects.toMatchObject({ code: ToolFailureCode.INVALID_INPUT });
});
```

- [ ] **Step 9 — Adapter tests** (`crawler-browser-adapter.test.ts`, fake pool, no real network)

```ts
const fakeResult = { fetchUrl: "https://www.gov.cn/", title: "中国政府网", bodyText: "x", html: new TextEncoder().encode("<html><body>hi</body></html>"), waitSignals: [], statusCode: 200 };

it("passes url + signal into the injected pool and normalizes the result", async () => {
  const pool = {
    async render(url: string, opts: { signal?: AbortSignal }) { expect(url).toBe("https://www.gov.cn/"); expect(opts.signal).toBe(ctrl.signal); return fakeResult; },
    async close() { throw new Error("owned pool must not be closed"); },
  };
  const adapter = new CrawlerBrowserAdapter({ pool, verifyUrl: async () => {} });
  const out = await adapter.renderPage({ url: "https://www.gov.cn/", signal: ctrl.signal });
  expect(out).toMatchObject({ requestedUrl: "https://www.gov.cn/", finalUrl: "https://www.gov.cn/", statusCode: 200, title: "中国政府网", truncated: false });
  expect(out.content).toContain("<html>");
});

it("truncates content over the shared cap", async () => {
  const big = new TextEncoder().encode("<html>" + "x".repeat(3 * 1024 * 1024) + "</html>");
  const pool = { async render() { return { ...fakeResult, html: big }; }, async close() {} };
  const adapter = new CrawlerBrowserAdapter({ pool, verifyUrl: async () => {} });
  const out = await adapter.renderPage({ url: "https://www.gov.cn/", signal: ctrl.signal });
  expect(out.truncated).toBe(true);
  expect(out.bytes).toBe(2 * 1024 * 1024);
});

it("returns ABORTED when the signal is aborted mid-render", async () => {
  const ctrl = new AbortController();
  const pool = { async render() { ctrl.abort(); throw new Error("Target closed"); }, async close() {} };
  const adapter = new CrawlerBrowserAdapter({ pool, verifyUrl: async () => {} });
  await expect(adapter.renderPage({ url: "https://www.gov.cn/", signal: ctrl.signal })).rejects.toMatchObject({ code: ToolFailureCode.ABORTED });
});

it("maps a goto timeout to TIMEOUT", async () => {
  const pool = { async render() { throw new Error("Navigation Timeout Exceeded"); }, async close() {} };
  const adapter = new CrawlerBrowserAdapter({ pool, verifyUrl: async () => {} });
  await expect(adapter.renderPage({ url: "https://www.gov.cn/", signal: ctrl.signal })).rejects.toMatchObject({ code: ToolFailureCode.TIMEOUT });
});

it("blocks a private/blocked top-level URL with ACCESS_DENIED", async () => {
  const adapter = new CrawlerBrowserAdapter({ pool: fakePool, verifyUrl: async () => { throw new Error("禁止 localhost"); } });
  await expect(adapter.renderPage({ url: "http://localhost/", signal: ctrl.signal })).rejects.toMatchObject({ code: ToolFailureCode.ACCESS_DENIED });
});
```

(5 adapter tests + 2 tool tests = 7 tests, within the 5-8 budget. Registration test below.)

- [ ] **Step 10 — Registration test** (`default-tool-registry.test.ts`)

```ts
it("registers all four generic tools and no default coding tools", () => {
  const registry = createAgentToolRegistry();
  const names = registry.list().map((tool) => tool.name);
  expect(names).toEqual(["fetch_page", "get_region_context", "render_page", "search_web"]);
  for (const forbidden of ["read", "bash", "edit", "write"]) {
    expect(registry.has(forbidden)).toBe(false);
  }
});
```

- [ ] **Step 11 — Run agent-tools tests**

Run: `corepack pnpm --filter @stellaris/agent-tools test`. Expected: PASS.

---

## Task 4 — agent-runtime wiring: doctor + smoke runner

**Files:**
- Modify: `packages/agent-runtime/src/doctor/runtime-doctor.ts`
- Modify: `packages/agent-runtime/src/doctor/runtime-doctor.test.ts`
- Modify: `packages/agent-runtime/src/session/session-factory.test.ts`
- Modify: `packages/agent-runtime/src/session/pi-tool-adapter.test.ts`
- Create: `packages/agent-runtime/src/smoke/render-smoke.ts`
- Modify: `packages/agent-runtime/package.json` (add `smoke:render`)
- Modify: `package.json` (root, add `agent:smoke:render`)
- Modify: `packages/agent-runtime/src/index.ts` (export render-smoke)

**Interfaces produced (used by Task 5):**
- `runDoctor()` result gains `browser: { status: "READY" | "NOT_READY"; executable_path?: string; detail: string }`.
- `runRenderSmoke(url: string): Promise<RenderSmokeResult>`; `RenderSmokeStatus = "OK" | "RENDER_URL_REQUIRED" | "RENDER_SMOKE_FAILED"`.

- [ ] **Step 1 — Doctor: add browser status**

In `packages/agent-runtime/src/doctor/runtime-doctor.ts`:

```ts
import { existsSync } from "node:fs";
import { resolveChromiumExecutablePath } from "@stellaris/crawler/browser/render.js";
```

Add to `DoctorResult`:

```ts
browser: { status: "READY" | "NOT_READY"; executable_path?: string; detail: string };
```

In `runDoctor()` (after `http`):

```ts
let browserExecutablePath = "";
let browserDetail = "";
try {
  browserExecutablePath = resolveChromiumExecutablePath();
  browserDetail = existsSync(browserExecutablePath) ? "" : "chromium executable not found";
} catch (err) {
  browserDetail = err instanceof Error ? err.message : String(err);
}
const browser: DoctorResult["browser"] = {
  status: browserExecutablePath && !browserDetail ? "READY" : "NOT_READY",
  executable_path: browserExecutablePath || undefined,
  detail: browserDetail,
};
```

Add to the returned object. `browser.status` is informational (like `http`) — NOT part of the
`runtime: FOUNDATION_READY` gate, so a missing browser never fails the doctor.

`formatDoctorResult` adds:

```ts
"browser:",
`  status: ${result.browser.status}`,
...(result.browser.executable_path ? [`  executable_path: ${result.browser.executable_path}`] : []),
```

- [ ] **Step 2 — Doctor test updates**

In `runtime-doctor.test.ts`:

```ts
expect(result.tool_gateway.registered_tools).toBe(4);
expect(result.tool_gateway.tools).toEqual(["fetch_page", "get_region_context", "render_page", "search_web"]);
// browser is informational and never fails the doctor
expect(["READY", "NOT_READY"]).toContain(result.browser.status);
expect(result.runtime).toBe("FOUNDATION_READY");
```

- [ ] **Step 3 — Session allowlist test updates**

`session-factory.test.ts`:
```ts
expect(captured?.tools).toEqual(["fetch_page", "get_region_context", "render_page", "search_web"]);
expect(customNames).toEqual(["fetch_page", "get_region_context", "render_page", "search_web"]);
```

`pi-tool-adapter.test.ts`:
```ts
expect(customTools.map((tool) => tool.name)).toEqual(["fetch_page", "get_region_context", "render_page", "search_web"]);
```

- [ ] **Step 4 — `render-smoke.ts`**

```ts
import path from "node:path";
import { fileURLToPath } from "node:url";
import { BrowserPool } from "@stellaris/crawler/browser/render.js";
import {
  createAgentToolRegistry, createRenderPageTool, CrawlerBrowserAdapter,
  MemoryToolEventSink, ToolGateway, type ToolResult,
} from "@stellaris/agent-tools";
import type { PageRenderResponse } from "@stellaris/agent-tools";

export const RENDER_URL_REQUIRED = "RENDER_URL_REQUIRED" as const;
export const RENDER_SMOKE_FAILED = "RENDER_SMOKE_FAILED" as const;

export type RenderSmokeStatus = "OK" | typeof RENDER_URL_REQUIRED | typeof RENDER_SMOKE_FAILED;

export type RenderSmokeResult = {
  status: RenderSmokeStatus;
  tool_status?: string;
  final_url?: string;
  status_code?: number;
  title?: string | null;
  content_present?: boolean;
  content_bytes?: number;
  truncated?: boolean;
  start_events?: number;
  success_events?: number;
  browser_released?: boolean;
  detail?: string;
};

export function parseRenderSmokeArgs(argv: string[]): { url?: string } { /* same shape as parseFetchSmokeArgs */ }

export async function runRenderSmoke(url: string): Promise<RenderSmokeResult> {
  const pool = new BrowserPool();
  const renderer = new CrawlerBrowserAdapter({ pool });
  const registry = createAgentToolRegistry({ renderPageTool: createRenderPageTool({ renderer }) });
  const sink = new MemoryToolEventSink();
  const gateway = new ToolGateway(registry, sink);
  const result: ToolResult = await gateway.execute("render_page", { url }, {
    taskRunId: "smoke-render", agentSessionId: "smoke-render-session",
    agentRole: "INVESTIGATOR", signal: new AbortController().signal,
  });
  await pool.close();
  const released = !pool.isOpen();

  if (result.status !== "SUCCESS") {
    return { status: RENDER_SMOKE_FAILED, tool_status: result.status, detail: result.failure.message, browser_released: released };
  }
  const data = result.data as PageRenderResponse;
  const startEvents = sink.starts.filter((e) => e.toolName === "render_page").length;
  const successEvents = sink.successes.filter((e) => e.toolName === "render_page").length;
  const ok = data.statusCode > 0 && data.finalUrl.length > 0 && data.content.length > 0 && startEvents === 1 && successEvents === 1 && released;
  return {
    status: ok ? "OK" : RENDER_SMOKE_FAILED, tool_status: "SUCCESS",
    final_url: data.finalUrl, status_code: data.statusCode, title: data.title,
    content_present: data.content.length > 0, content_bytes: data.bytes, truncated: data.truncated,
    start_events: startEvents, success_events: successEvents, browser_released: released,
  };
}

// main()/format/entry guard mirror fetch-smoke.ts (banner "RENDER_SMOKE").
```

- [ ] **Step 5 — Scripts**

`packages/agent-runtime/package.json` scripts: add `"smoke:render": "tsx src/smoke/render-smoke.ts"`.
Root `package.json` scripts: add `"agent:smoke:render": "pnpm --filter @stellaris/agent-runtime smoke:render"`.
`packages/agent-runtime/src/index.ts`: add `export * from "./smoke/render-smoke.js";`.

- [ ] **Step 6 — agent-runtime targeted tests**

Run: `corepack pnpm --filter @stellaris/agent-runtime test`. Expected: PASS.

---

## Task 5 — Targeted verification, docs, commit

- [ ] **Step 1 — Build + typecheck**

```bash
corepack pnpm --filter @stellaris/crawler build
corepack pnpm --filter @stellaris/agent-tools build
corepack pnpm --filter @stellaris/agent-runtime build
corepack pnpm -r typecheck
```

Expected: all PASS.

- [ ] **Step 2 — One real render smoke**

```bash
corepack pnpm agent:smoke:render --url https://www.gov.cn/
```

If gov.cn misbehaves (WAF/long connect), fall back once to `https://example.com/`.
Gate: tool_status SUCCESS, final_url present, content_present YES, content_bytes > 0,
start_events 1, success_events 1, browser_released true.

- [ ] **Step 3 — Docs**

Create `docs/agent-runtime/browser-render-agent-tool.md` (short):
Purpose; render_page contract (input `{url}`, output fields incl. truncated/title); existing
BrowserPool reuse; Chromium dev runtime (cache only, version 1.62.1); URL safety (assertAllowedUrl +
dnsLookup pre-flight, subresource hardening deferred); Abort (context.close on signal);
Content limit (FETCH_PAGE_MAX_BYTES 2 MiB); Failure mapping (BROWSER_LAUNCH_FAILED /
BROWSER_NAVIGATION_FAILED + reused codes); Deferred: inspect_page, subresource network sandbox,
persistent ToolEvent, Inventory Agent.

- [ ] **Step 4 — Self-review**

- [x] generic name render_page
- [x] reuses BrowserPool, no second chromium.launch lifecycle
- [x] through ToolGateway
- [x] top-level URL safety reused (assertAllowedUrl + dnsLookup), not bypassed
- [x] AbortSignal preserved end-to-end
- [x] content capped at shared 2 MiB limit
- [x] no DOM semantic parsing (that's inspect_page)
- [x] search_web / get_region_context / fetch_page untouched
- [x] DeepSeek provider-neutral architecture unchanged
- [x] Skill unchanged
- [x] Graphile unchanged
- [x] no DB migration
- [x] read/bash/edit/write still disabled
- [x] no full workspace / crawler / backend test suites

- [ ] **Step 5 — Commit**

```bash
git add packages/crawler packages/agent-tools packages/agent-runtime package.json docs/agent-runtime/browser-render-agent-tool.md docs/superpowers/plans/2026-08-13-browser-render-agent-tool.md
git commit -m "feat(agent): add generic browser render tool"
```

No push, no merge to production.

---

SELF_REVIEW: PASS
ARCHITECTURE_CONFLICT: NONE
EXECUTION_PREAUTHORIZED_BY_USER: YES
EXECUTION_MODE: INLINE_FAST
TEST_POLICY: TARGETED_ONLY
