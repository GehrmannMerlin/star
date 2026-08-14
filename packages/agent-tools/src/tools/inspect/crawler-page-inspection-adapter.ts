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
