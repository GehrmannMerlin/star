import type { PageFetchResponse } from "../fetch/page-fetcher.js";

/**
 * Provider-neutral page render contracts.
 *
 * A rendered page is raw DOM for a later inspection step; it is NOT formal
 * Evidence yet. Nothing here knows a concrete browser implementation.
 */

export type PageRenderRequest = {
  url: string;
  signal: AbortSignal;
};

/** Normalized render result. Mirrors PageFetchResponse (plus title/truncated)
 *  so a later inspect_page step can consume either tool uniformly. */
export type PageRenderResponse = PageFetchResponse & {
  title: string | null;
  truncated: boolean;
};

/** A component that can render one HTTP(S) page through the crawler browser stack. */
export interface PageRenderer {
  renderPage(request: PageRenderRequest): Promise<PageRenderResponse>;
}
