# STEP 7 — Page Inspection Agent Tool Plan

Phase: FAST DEVELOPMENT MODE (plan -> self-review -> self-approve -> execute).
Goal: expose the existing crawler `extractPageFacts` through a thin adapter as a
generic, deterministic agent tool `inspect_page` — HTML in, structured page
Observation out. No network access, no Browser, no INCLUDE / EXCLUDE, no
Leadership / PRIMARY / Candidate / Reviewer decisions. No second HTML parser.

```
fetch_page / render_page (already-fetched HTML content)
  |
  v
Pi -> inspect_page -> Pi Custom Tool Adapter -> ToolGateway
  -> InspectPageTool -> CrawlerPageInspectionAdapter
  -> existing extractPageFacts (cheerio) -> PageInspectionResult
```

## Global Constraints
- Reuse `extractPageFacts` from `@stellaris/crawler/page-facts.js` (already exported
  as a package subpath; NO crawler change). NO second HTML / DOM / links parser.
- `inspect_page` never touches the network. `url` is metadata only, validated
  http/https via the reused `assertPublicHttpUrl` from
  `tools/fetch/crawler-http-adapter.js`. No SSRF re-implementation.
- Deterministic observation tool. Output stays observation-level: `leadershipMembers`
  (person-like) / roles (role-like) / `pageDate` (date signal), all from the
  existing extractor names. No `confirmedPerson` / `confirmedRole` / `INCLUDE`.
- Centralized limits in one place: text preview 16 KiB, link cap 500 — no magic numbers.
- Keep `get_region_context`, `search_web`, `fetch_page`, `render_page`; keep
  ToolGateway routing; Pi-agnostic; coding tools (read/bash/edit/write) stay disabled.
- No Skill / Graphile / DB / production / docs-deploy changes. Targeted tests only.
- Single final commit `feat(agent): add generic page inspection tool`. No push.

## Task 1 — Page inspection contract + CrawlerPageInspectionAdapter

Files:
- Create: `packages/agent-tools/src/tools/inspect/page-inspection.ts`
- Create: `packages/agent-tools/src/tools/inspect/crawler-page-inspection-adapter.ts`
- Test: `packages/agent-tools/src/tools/inspect/crawler-page-inspection-adapter.test.ts`

Step 1 — Write `page-inspection.ts` (provider-neutral contracts + centralized limits):

```ts
/**
 * Provider-neutral page inspection contracts.
 *
 * inspect_page is a deterministic observation tool: HTML -> structured page
 * observations. It performs NO network access and NO semantic decisions
 * (no INCLUDE/EXCLUDE, no Leadership/PRIMARY, no Candidate/Reviewer verdicts).
 */

export type LinkObservation = {
  /** Anchor text as produced by the crawler extractor. */
  text: string;
  /** Raw href as produced by the crawler extractor (no re-normalization). */
  url: string;
};

/** Person-like / role-like observations, named after the reused extractor. */
export type LeadershipMemberObservation = {
  name: string;
  roles: string[];
  sortOrder: number;
  href: string | null;
};

export type PageInspectionResult = {
  /** Source URL this content was fetched from (metadata only — never accessed). */
  url: string;
  /** sha256 of the raw HTML (from extractPageFacts). */
  documentHash: string;
  title: string | null;
  /** Capped plain-text preview of the page body (see INSPECT_PAGE_TEXT_PREVIEW_LIMIT). */
  textPreview: string;
  /** Full body text length before truncation. */
  textLength: number;
  textTruncated: boolean;
  /** Capped link observations (see INSPECT_PAGE_LINK_LIMIT). */
  links: LinkObservation[];
  /** Total links found before the cap. */
  linkCount: number;
  linksTruncated: boolean;
  /** Person-like observations produced by extractPageFacts (not confirmed persons). */
  leadershipMembers: LeadershipMemberObservation[];
  /** Date signal (meta published time / first date in body text). */
  pageDate: string | null;
  /** Heading structure. null: the reused extractor does not produce it (no second parser). */
  headings: string[] | null;
  /** Breadcrumb. null: the reused extractor does not produce it. */
  breadcrumb: string[] | null;
  /** Structured tables. null: the reused extractor does not produce them. */
  tables: unknown[] | null;
};

export type PageInspectionRequest = {
  url: string;
  content: string;
  signal?: AbortSignal;
};

export interface PageInspector {
  inspectPage(request: PageInspectionRequest): Promise<PageInspectionResult>;
}

/** Centralized observation caps — keep limits in one place, no scattered magic numbers. */
export const INSPECT_PAGE_TEXT_PREVIEW_LIMIT = 16 * 1024; // 16 KiB plain-text preview
export const INSPECT_PAGE_LINK_LIMIT = 500; // safe cap for link observations (LLM context)
```

Step 2 — Write `crawler-page-inspection-adapter.ts`:

```ts
import { extractPageFacts, type PageFacts } from "@stellaris/crawler/page-facts.js";
import { ToolFailureCode, ToolFailureError } from "../../contracts/tool-failure-codes.js";
import { assertPublicHttpUrl } from "../fetch/crawler-http-adapter.js";
import {
  INSPECT_PAGE_LINK_LIMIT,
  INSPECT_PAGE_TEXT_PREVIEW_LIMIT,
  type LinkObservation,
  type PageInspectionRequest,
  type PageInspectionResult,
  type PageInspector,
} from "./page-inspection.js";

export type CrawlerPageInspectionAdapterDeps = {
  /** Underlying extractor; defaults to the real crawler extractPageFacts. */
  extractPageFacts: typeof extractPageFacts;
};

function mapLinks(links: PageFacts["links"]): LinkObservation[] {
  return links.map((link) => ({ text: link.anchor, url: link.href }));
}

/**
 * Thin adapter: generic input -> existing extractPageFacts -> generic result.
 * No business judgment here; caps are applied centrally so a huge nav page
 * cannot blow up the LLM context.
 */
export class CrawlerPageInspectionAdapter implements PageInspector {
  private readonly extract: typeof extractPageFacts;

  constructor(deps?: Partial<CrawlerPageInspectionAdapterDeps>) {
    this.extract = deps?.extractPageFacts ?? extractPageFacts;
  }

  async inspectPage(request: PageInspectionRequest): Promise<PageInspectionResult> {
    // Reused guard: http/https only. No DNS/SSRF work — inspect_page never connects.
    assertPublicHttpUrl(request.url);
    if (request.content.trim().length === 0) {
      throw new ToolFailureError({
        code: ToolFailureCode.INVALID_INPUT,
        message: "inspect_page content must contain non-whitespace HTML",
        retryable: false,
      });
    }
    const facts = await this.extract(new TextEncoder().encode(request.content));
    const textTruncated = facts.bodyText.length > INSPECT_PAGE_TEXT_PREVIEW_LIMIT;
    const linksTruncated = facts.links.length > INSPECT_PAGE_LINK_LIMIT;
    return {
      url: request.url,
      documentHash: facts.documentHash,
      title: facts.title,
      textPreview: facts.bodyText.slice(0, INSPECT_PAGE_TEXT_PREVIEW_LIMIT),
      textLength: facts.bodyText.length,
      textTruncated,
      links: mapLinks(facts.links.slice(0, INSPECT_PAGE_LINK_LIMIT)),
      linkCount: facts.links.length,
      linksTruncated,
      leadershipMembers: facts.leadershipMembers,
      pageDate: facts.pageDate,
      headings: null,
      breadcrumb: null,
      tables: null,
    };
  }
}
```

Step 3 — Write the adapter test
`packages/agent-tools/src/tools/inspect/crawler-page-inspection-adapter.test.ts`
(4 tests: real-extractor mapping, INVALID_INPUT on empty content, INVALID_INPUT on
non-http url via the reused guard, text-preview cap + truncation flag).

```ts
import { describe, expect, it } from "vitest";
import {
  CrawlerPageInspectionAdapter,
} from "./crawler-page-inspection-adapter.js";
import { INSPECT_PAGE_TEXT_PREVIEW_LIMIT } from "./page-inspection.js";

const GOVERNMENT_HTML = `<!doctype html>
<html><head><title>安徽省政府信息公开</title>
<meta property="article:published_time" content="2026-08-01T10:00:00+08:00">
</head><body>
<table>
  <tr><th>姓名</th><th>职务</th></tr>
  <tr><td><a href="/ld/1.html">李某某</a></td><td>副省长、党组成员</td></tr>
</table>
<a href="https://www.gov.cn/">中国政府网</a>
<p>本页面更新于2026年8月1日。</p>
</body></html>`;

describe("CrawlerPageInspectionAdapter", () => {
  const adapter = new CrawlerPageInspectionAdapter();

  it("maps real extractPageFacts output into observations", async () => {
    const result = await adapter.inspectPage({
      url: "https://www.ah.gov.cn/",
      content: GOVERNMENT_HTML,
    });
    expect(result.url).toBe("https://www.ah.gov.cn/");
    expect(result.title).toContain("安徽");
    expect(result.textPreview.length).toBeGreaterThan(0);
    expect(result.textTruncated).toBe(false);
    expect(result.links).toContainEqual({ text: "中国政府网", url: "https://www.gov.cn/" });
    expect(result.leadershipMembers.length).toBeGreaterThan(0);
    expect(result.pageDate).toBe("2026-08-01");
    expect(result.headings).toBeNull();
    expect(result.breadcrumb).toBeNull();
    expect(result.tables).toBeNull();
  });

  it("returns INVALID_INPUT for empty or whitespace-only content", async () => {
    await expect(
      adapter.inspectPage({ url: "https://www.ah.gov.cn/", content: "   \n\t " }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });

  it("rejects non-http(s) source urls via the reused guard", async () => {
    await expect(
      adapter.inspectPage({ url: "ftp://example.com/a", content: "<p>x</p>" }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });

  it("caps text preview and reports truncation", async () => {
    const big = `<!doctype html><body><p>${"a".repeat(20_000)}</p></body></html>`;
    const result = await adapter.inspectPage({ url: "https://example.com/", content: big });
    expect(result.textLength).toBeGreaterThan(INSPECT_PAGE_TEXT_PREVIEW_LIMIT);
    expect(result.textTruncated).toBe(true);
    expect(result.textPreview.length).toBeLessThanOrEqual(INSPECT_PAGE_TEXT_PREVIEW_LIMIT);
  });
});
```

Step 4 — Run the adapter tests (expected: PASS).

Run:
```
cd /opt/Stellaris-PiAgent-Dev
corepack pnpm --filter @stellaris/agent-tools exec vitest run src/tools/inspect/crawler-page-inspection-adapter.test.ts
```

## Task 2 — inspect_page tool + tool tests

Files:
- Create: `packages/agent-tools/src/tools/inspect/inspect-page.ts`
- Test: `packages/agent-tools/src/tools/inspect/inspect-page.test.ts`

Step 1 — Write `inspect-page.ts`:

```ts
import { Type, type Static } from "@sinclair/typebox";
import { ToolFailureCode, ToolFailureError } from "../../contracts/tool-failure-codes.js";
import type { AgentToolDefinition } from "../../contracts/tool-types.js";
import { CrawlerPageInspectionAdapter } from "./crawler-page-inspection-adapter.js";
import type { PageInspectionResult, PageInspector } from "./page-inspection.js";

export const InspectPageInput = Type.Object(
  {
    url: Type.String({ minLength: 1 }),
    content: Type.String({ minLength: 1 }),
  },
  { additionalProperties: false },
);

export type InspectPageInput = Static<typeof InspectPageInput>;

export type InspectPageToolDeps = {
  inspector: PageInspector;
};

/**
 * Generic page inspection tool.
 *
 * Pi knows only `inspect_page`; it receives HTML already obtained by fetch_page /
 * render_page and never connects itself. The crawler extractPageFacts is the
 * underlying deterministic parser. Output is observation-level only.
 */
export function createInspectPageTool(
  deps?: Partial<InspectPageToolDeps>,
): AgentToolDefinition<typeof InspectPageInput, PageInspectionResult> {
  const inspector = deps?.inspector ?? new CrawlerPageInspectionAdapter();
  return {
    name: "inspect_page",
    description:
      "Parse already-obtained HTML content into deterministic page observations (title, links, person-like members, date). No network access — pass the content returned by fetch_page or render_page.",
    inputSchema: InspectPageInput,
    async execute(context, input) {
      const url = input.url.trim();
      if (url.length === 0) {
        throw new ToolFailureError({
          code: ToolFailureCode.INVALID_INPUT,
          message: "inspect_page url must be a non-empty string",
          retryable: false,
        });
      }
      if (input.content.trim().length === 0) {
        throw new ToolFailureError({
          code: ToolFailureCode.INVALID_INPUT,
          message: "inspect_page content must be non-empty HTML",
          retryable: false,
        });
      }
      return inspector.inspectPage({ url, content: input.content, signal: context.signal });
    },
  };
}
```

Step 2 — Write `inspect-page.test.ts` (3 tests: delegation to injected inspector,
INVALID_INPUT on whitespace content, SUCCESS through ToolGateway with the real adapter).

```ts
import { describe, expect, it } from "vitest";
import type { ToolInvocationContext } from "../../contracts/tool-types.js";
import { ToolGateway } from "../../gateway/tool-gateway.js";
import { ToolRegistry } from "../../registry/tool-registry.js";
import { MemoryToolEventSink } from "../../telemetry/tool-event-sink.js";
import type { PageInspectionResult, PageInspector } from "./page-inspection.js";
import { createInspectPageTool } from "./inspect-page.js";

const context = (signal = new AbortController().signal): ToolInvocationContext => ({
  taskRunId: "task-1",
  agentSessionId: "session-1",
  agentRole: "INVESTIGATOR",
  signal,
});

function stubResult(): PageInspectionResult {
  return {
    url: "https://example.com/",
    documentHash: "abc",
    title: "Example",
    textPreview: "hello",
    textLength: 5,
    textTruncated: false,
    links: [{ text: "Home", url: "https://example.com/" }],
    linkCount: 1,
    linksTruncated: false,
    leadershipMembers: [],
    pageDate: null,
    headings: null,
    breadcrumb: null,
    tables: null,
  };
}

describe("inspect_page tool", () => {
  it("delegates to the injected inspector with url and content", async () => {
    let received: { url: string; content: string } | undefined;
    const inspector: PageInspector = {
      async inspectPage(request) {
        received = { url: request.url, content: request.content };
        return stubResult();
      },
    };
    const tool = createInspectPageTool({ inspector });
    const result = await tool.execute(context(), {
      url: "https://example.com/",
      content: "<p>hi</p>",
    });
    expect(received).toEqual({ url: "https://example.com/", content: "<p>hi</p>" });
    expect(result.title).toBe("Example");
  });

  it("rejects whitespace-only content with INVALID_INPUT", async () => {
    const tool = createInspectPageTool();
    await expect(
      tool.execute(context(), { url: "https://example.com/", content: " \n " }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });

  it("succeeds through ToolGateway with the real adapter", async () => {
    const gateway = new ToolGateway(
      new ToolRegistry([createInspectPageTool()]),
      new MemoryToolEventSink(),
    );
    const result = await gateway.execute(
      "inspect_page",
      { url: "https://example.com/", content: "<title>Hi</title><a href='/x'>x</a>" },
      context(),
    );
    expect(result.status).toBe("SUCCESS");
    if (result.status === "SUCCESS") expect(result.data.title).toBe("Hi");
  });
});
```

Step 3 — Run the tool tests (expected: PASS).

Run:
```
cd /opt/Stellaris-PiAgent-Dev
corepack pnpm --filter @stellaris/agent-tools exec vitest run src/tools/inspect/inspect-page.test.ts
```

## Task 3 — Register inspect_page in the default registry + exports

Files:
- Modify: `packages/agent-tools/src/registry/default-tool-registry.ts`
- Modify: `packages/agent-tools/src/index.ts`
- Test: `packages/agent-tools/src/registry/default-tool-registry.test.ts`

Step 1 — Modify `default-tool-registry.ts`:

```ts
import type { AgentToolDefinition } from "../contracts/tool-types.js";
import { createFetchPageTool } from "../tools/fetch/fetch-page.js";
import { createInspectPageTool } from "../tools/inspect/inspect-page.js";
import { createRenderPageTool } from "../tools/render/render-page.js";
import { createSearchWebTool } from "../tools/search/search-web.js";
import { getRegionContextTool } from "../tools/region/get-region-context.js";
import { ToolRegistry } from "./tool-registry.js";

export type CreateAgentToolRegistryOptions = {
  /** Override the search_web tool (e.g. a stubbed provider in tests). */
  searchWebTool?: AgentToolDefinition;
  /** Override the fetch_page tool (e.g. a stubbed fetcher in tests). */
  fetchPageTool?: AgentToolDefinition;
  /** Override the render_page tool (e.g. a stubbed renderer in tests). */
  renderPageTool?: AgentToolDefinition;
  /** Override the inspect_page tool (e.g. a stubbed inspector in tests). */
  inspectPageTool?: AgentToolDefinition;
};

export function createAgentToolRegistry(
  options: CreateAgentToolRegistryOptions = {},
): ToolRegistry {
  const searchWeb = options.searchWebTool ?? createSearchWebTool();
  const fetchPage = options.fetchPageTool ?? createFetchPageTool();
  const renderPage = options.renderPageTool ?? createRenderPageTool();
  const inspectPage = options.inspectPageTool ?? createInspectPageTool();
  return new ToolRegistry([getRegionContextTool, searchWeb, fetchPage, renderPage, inspectPage]);
}
```

Step 2 — Modify `packages/agent-tools/src/index.ts` (append three exports):

```ts
export * from "./tools/inspect/page-inspection.js";
export * from "./tools/inspect/crawler-page-inspection-adapter.js";
export * from "./tools/inspect/inspect-page.js";
```

Step 3 — Update `default-tool-registry.test.ts` to the 5-tool allowlist
(`ToolRegistry.list()` sorts by name; `inspect_page` lands alphabetically
between `get_region_context` and `render_page`):

```ts
it("registers all five generic tools and no default coding tools", () => {
  const registry = createAgentToolRegistry();
  const names = registry.list().map((tool) => tool.name);
  expect(names).toEqual([
    "fetch_page",
    "get_region_context",
    "inspect_page",
    "render_page",
    "search_web",
  ]);
  for (const forbidden of ["read", "bash", "edit", "write"]) {
    expect(registry.has(forbidden)).toBe(false);
  }
});
```

Step 4 — Run the registry test (expected: PASS).

Run:
```
cd /opt/Stellaris-PiAgent-Dev
corepack pnpm --filter @stellaris/agent-tools exec vitest run src/registry/default-tool-registry.test.ts
```

Pi wiring needs no further change: `createPiCustomTools` builds the custom-tool
allowlist from `registry.list()` and the session allowlist (`allowedToolNames`)
is derived the same way, so `inspect_page` is callable and the default coding
tools stay disabled automatically.

## Task 4 — agent:smoke:inspect real chain smoke

Files:
- Create: `packages/agent-runtime/src/smoke/inspect-smoke.ts`
- Modify: `packages/agent-runtime/package.json`
- Modify: `package.json` (root)

Step 1 — Write `packages/agent-runtime/src/smoke/inspect-smoke.ts` (modeled on
`fetch-smoke.ts`; chains fetch_page -> inspect_page through the ToolGateway, no
LLM, no Browser):

```ts
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createAgentToolRegistry,
  MemoryToolEventSink,
  ToolGateway,
  type ToolResult,
} from "@stellaris/agent-tools";
import type { PageFetchResponse, PageInspectionResult } from "@stellaris/agent-tools";

export const INSPECT_URL_REQUIRED = "INSPECT_URL_REQUIRED" as const;
export const INSPECT_SMOKE_FAILED = "INSPECT_SMOKE_FAILED" as const;

export type InspectSmokeStatus = "OK" | typeof INSPECT_URL_REQUIRED | typeof INSPECT_SMOKE_FAILED;

export type InspectSmokeResult = {
  status: InspectSmokeStatus;
  fetch_status?: string;
  inspect_status?: string;
  final_url?: string;
  title?: string | null;
  title_present?: boolean;
  links_count?: number;
  headings_equivalent?: boolean;
  text_present?: boolean;
  fetch_start_events?: number;
  fetch_success_events?: number;
  inspect_start_events?: number;
  inspect_success_events?: number;
  detail?: string;
};

export function parseInspectSmokeArgs(argv: string[]): { url?: string } {
  const eq = argv.find((arg) => arg.startsWith("--url="));
  if (eq) {
    const value = eq.slice("--url=".length);
    if (value) return { url: value };
  }
  const index = argv.indexOf("--url");
  const value = index !== -1 ? argv[index + 1] : undefined;
  if (value) return { url: value };
  return {};
}

/**
 * Run one real chain: fetch_page -> ToolGateway -> CrawlerHttpAdapter -> crawler
 * httpFetch, then inspect_page -> ToolGateway -> CrawlerPageInspectionAdapter ->
 * extractPageFacts. No Pi LLM and no Browser involved.
 */
export async function runInspectSmoke(url: string): Promise<InspectSmokeResult> {
  const registry = createAgentToolRegistry();
  const sink = new MemoryToolEventSink();
  const gateway = new ToolGateway(registry, sink);
  const context = {
    taskRunId: "smoke-inspect",
    agentSessionId: "smoke-inspect-session",
    agentRole: "INVESTIGATOR" as const,
    signal: new AbortController().signal,
  };

  const fetchResult: ToolResult = await gateway.execute("fetch_page", { url }, context);
  if (fetchResult.status !== "SUCCESS") {
    return {
      status: INSPECT_SMOKE_FAILED,
      fetch_status: fetchResult.status,
      detail: fetchResult.failure.message,
    };
  }
  const fetchData = fetchResult.data as PageFetchResponse;

  const inspectResult: ToolResult = await gateway.execute(
    "inspect_page",
    { url: fetchData.finalUrl, content: fetchData.content },
    context,
  );
  if (inspectResult.status !== "SUCCESS") {
    return {
      status: INSPECT_SMOKE_FAILED,
      inspect_status: inspectResult.status,
      detail: inspectResult.failure.message,
    };
  }
  const inspectData = inspectResult.data as PageInspectionResult;

  const fetchStart = sink.starts.filter((e) => e.toolName === "fetch_page").length;
  const fetchSuccess = sink.successes.filter((e) => e.toolName === "fetch_page").length;
  const inspectStart = sink.starts.filter((e) => e.toolName === "inspect_page").length;
  const inspectSuccess = sink.successes.filter((e) => e.toolName === "inspect_page").length;
  // headings: array, or the existing equivalent person/role structure.
  const headingsEquivalent = Array.isArray(inspectData.headings) || inspectData.leadershipMembers.length > 0;
  const ok =
    (inspectData.title ?? "").length > 0 &&
    Array.isArray(inspectData.links) &&
    headingsEquivalent &&
    inspectData.textPreview.length > 0 &&
    fetchStart === 1 &&
    fetchSuccess === 1 &&
    inspectStart === 1 &&
    inspectSuccess === 1;

  return {
    status: ok ? "OK" : INSPECT_SMOKE_FAILED,
    fetch_status: "SUCCESS",
    inspect_status: "SUCCESS",
    final_url: fetchData.finalUrl,
    title: inspectData.title,
    title_present: (inspectData.title ?? "").length > 0,
    links_count: inspectData.linkCount,
    headings_equivalent: headingsEquivalent,
    text_present: inspectData.textPreview.length > 0,
    fetch_start_events: fetchStart,
    fetch_success_events: fetchSuccess,
    inspect_start_events: inspectStart,
    inspect_success_events: inspectSuccess,
  };
}

export function formatInspectSmokeResult(result: InspectSmokeResult): string {
  const lines = ["INSPECT_SMOKE", `status: ${result.status}`];
  if (result.fetch_status) lines.push(`fetch_status: ${result.fetch_status}`);
  if (result.inspect_status) lines.push(`inspect_status: ${result.inspect_status}`);
  if (result.final_url) lines.push(`final_url: ${result.final_url}`);
  if (result.title_present !== undefined) lines.push(`title_present: ${result.title_present ? "YES" : "NO"}`);
  if (result.title !== undefined) lines.push(`title: ${result.title}`);
  if (result.links_count !== undefined) lines.push(`links_count: ${result.links_count}`);
  if (result.headings_equivalent !== undefined) lines.push(`headings_equivalent: ${result.headings_equivalent ? "YES" : "NO"}`);
  if (result.text_present !== undefined) lines.push(`text_present: ${result.text_present ? "YES" : "NO"}`);
  if (result.fetch_start_events !== undefined) lines.push(`fetch_start_events: ${result.fetch_start_events}`);
  if (result.fetch_success_events !== undefined) lines.push(`fetch_success_events: ${result.fetch_success_events}`);
  if (result.inspect_start_events !== undefined) lines.push(`inspect_start_events: ${result.inspect_start_events}`);
  if (result.inspect_success_events !== undefined) lines.push(`inspect_success_events: ${result.inspect_success_events}`);
  if (result.detail) lines.push(`detail: ${result.detail}`);
  return lines.join("\n");
}

async function main(): Promise<void> {
  const { url } = parseInspectSmokeArgs(process.argv.slice(2));
  if (!url) {
    process.stdout.write(INSPECT_URL_REQUIRED + "\n");
    process.exitCode = 2;
    return;
  }
  const result = await runInspectSmoke(url);
  process.stdout.write(formatInspectSmokeResult(result) + "\n");
  process.exitCode = result.status === "OK" ? 0 : 1;
}

const entryArg = process.argv[1];
const isEntryPoint = entryArg !== undefined && path.resolve(entryArg) === fileURLToPath(import.meta.url);

if (isEntryPoint) {
  void main();
}
```

Step 2 — Add scripts. In `packages/agent-runtime/package.json` scripts add
`"smoke:inspect": "tsx src/smoke/inspect-smoke.ts"`. In root `package.json`
scripts add `"agent:smoke:inspect": "pnpm --filter @stellaris/agent-runtime smoke:inspect"`.

Step 3 — Build agent-tools (tsx resolves the workspace package via its dist exports)
then run the real smoke once:

Run:
```
cd /opt/Stellaris-PiAgent-Dev
corepack pnpm --filter @stellaris/agent-tools build
corepack pnpm agent:smoke:inspect -- --url https://www.gov.cn/
```
Expected: status OK, fetch_status SUCCESS, inspect_status SUCCESS, title_present YES,
links_count > 0, text_present YES, 1 start + 1 success per tool.

## Task 5 — Docs, self-review, commit

Files:
- Create: `docs/agent-runtime/page-inspection-agent-tool.md`

Step 1 — Write the short design doc (Purpose; inspect_page Contract; extractPageFacts
Reuse; Observation-only Boundary; Text / Link Limits; ToolGateway; Raw HTML Handoff;
RAW_HTML_HANDOFF_OPTIMIZATION_DEFERRED; Deferred: persistent Page Snapshot, opaque
pageRef, Inventory Agent).

Step 2 — Targeted verification (no full workspace, no crawler suite, no DeepSeek /
Bocha / Browser):

```
cd /opt/Stellaris-PiAgent-Dev
corepack pnpm --filter @stellaris/agent-tools typecheck
corepack pnpm --filter @stellaris/agent-runtime typecheck
corepack pnpm --filter @stellaris/agent-tools exec vitest run src/tools/inspect/ src/registry/default-tool-registry.test.ts
corepack pnpm agent:smoke:inspect -- --url https://www.gov.cn/
```

Step 3 — Architecture self-review (checklist below), then ONE commit:

```
git add packages/agent-tools packages/agent-runtime package.json docs/agent-runtime docs/superpowers/plans
git commit -m "feat(agent): add generic page inspection tool"
```
No push, no production changes.

## Plan Architecture Self Review
- [x] inspect_page is a generic name
- [x] Reuses existing extractPageFacts / cheerio parser
- [x] No second HTML parser
- [x] inspect_page never connects to the network
- [x] Does not auto-call fetch_page / render_page
- [x] fetch_page / render_page remain independent tools
- [x] agent-tools stays Pi-agnostic (no Pi imports in the new files)
- [x] Routes through ToolGateway
- [x] get_region_context / search_web / fetch_page / render_page preserved
- [x] DeepSeek provider-neutral architecture untouched
- [x] read/bash/edit/write remain disabled
- [x] Skill unchanged (official-biography-evidence 3.1.0)
- [x] Graphile unchanged
- [x] DB unchanged
- [x] No Inventory Agent
- [x] No Leadership / PRIMARY judgment
- [x] No region-specific logic
- [x] No full workspace tests

SELF_REVIEW: PASS
ARCHITECTURE_CONFLICT: NONE
EXECUTION_PREAUTHORIZED_BY_USER: YES
EXECUTION_MODE: INLINE_FAST
TEST_POLICY: TARGETED_ONLY
