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
