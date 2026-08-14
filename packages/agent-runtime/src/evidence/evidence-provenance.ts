import {
  normalizeUrlForJoin,
  type MemoryToolEventSink,
  type UrlCandidatePoolRow,
} from "@stellaris/agent-tools";
import type { CandidateProvenance, EvidenceProvenanceGate } from "./evidence-types.js";

/**
 * Deterministic per-candidate provenance gate. Every candidate URL must be
 * really opened (fetch_page/render_page SUCCESS — requestedUrl OR finalUrl
 * match) and really inspected (inspect_page SUCCESS — url match) within this
 * session. Search snippets never count.
 */
export function evaluateEvidenceProvenance(
  eventSink: MemoryToolEventSink,
  candidates: UrlCandidatePoolRow[],
): EvidenceProvenanceGate {
  const openedUrls = new Set<string>();
  const inspectedUrls = new Set<string>();
  for (const event of eventSink.successes) {
    if (event.toolName === "fetch_page" || event.toolName === "render_page") {
      const data = event.data as { requestedUrl?: unknown; finalUrl?: unknown };
      for (const url of [data.requestedUrl, data.finalUrl]) {
        if (typeof url === "string" && url.length > 0) {
          openedUrls.add(normalizeUrlForJoin(url));
        }
      }
    }
    if (event.toolName === "inspect_page") {
      const data = event.data as { url?: unknown };
      if (typeof data.url === "string" && data.url.length > 0) {
        inspectedUrls.add(normalizeUrlForJoin(data.url));
      }
    }
  }

  const rows: CandidateProvenance[] = candidates.map((candidate) => {
    const url = typeof candidate.url === "string" ? candidate.url : "";
    const targetId = typeof candidate.target_id === "string" ? candidate.target_id : "";
    const normalized = url.length > 0 ? normalizeUrlForJoin(url) : "";
    return {
      url,
      targetId,
      opened: normalized.length > 0 && openedUrls.has(normalized),
      inspected: normalized.length > 0 && inspectedUrls.has(normalized),
    };
  });

  const passed = rows.length > 0 && rows.every((row) => row.opened && row.inspected);
  return { candidates: rows, passed };
}
