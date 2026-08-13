/**
 * Provider-neutral page fetch contracts.
 *
 * A fetched page is raw content for a later inspection step; it is NOT formal
 * Evidence yet. Nothing here knows a concrete HTTP implementation.
 */

export type PageFetchRequest = {
  url: string;
  signal: AbortSignal;
};

/** Normalized fetch result. `content` is the decoded body text. */
export type PageFetchResponse = {
  requestedUrl: string;
  finalUrl: string;
  statusCode: number;
  contentType: string;
  content: string;
  bytes: number;
};

/** A component that can fetch one HTTP(S) page through the crawler HTTP stack. */
export interface PageFetcher {
  fetchPage(request: PageFetchRequest): Promise<PageFetchResponse>;
}
