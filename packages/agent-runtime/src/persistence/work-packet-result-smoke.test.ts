import { describe, expect, it } from "vitest";
import { runWorkPacketResultSmoke } from "./work-packet-result-smoke.js";

describe("disposable PostgreSQL work packet + biography result smoke", () => {
  it(
    "migration → Packet A/B → evidence + Round1 rework + Round2 approved → new instances reload → Biography Results",
    async () => {
      const { status, report } = await runWorkPacketResultSmoke();

      expect(status).toBe("OK");
      expect(report.migration).toBe("PASS");
      expect(report.packet_a_reloaded).toBe(true);
      expect(report.packet_b_reloaded).toBe(true);
      expect(report.packet_a_state).toBe("POSITION_DECIDED");
      expect(report.packet_b_state).toBe("READY_FOR_REVIEW");
      expect(report.evidence_persisted).toBe(true);
      expect(report.round1_review_persisted).toBe(true);
      expect(report.round2_review_persisted).toBe(true);
      expect(report.review_history_count).toBe(2);
      expect(report.latest_review_round).toBe(2);
      expect(report.latest_review_outcome).toBe("APPROVED");
      expect(report.source_of_truth).toBe("LATEST_FROZEN_APPROVED_REVIEW");
      expect(report.result_a_status).toBe("RESOLVED");
      expect(report.result_a_primary1_decision).toBe("RESOLVED");
      expect(typeof report.result_a_primary1_url).toBe("string");
      expect(report.result_a_primary2_decision).toBe("RESOLVED");
      expect(typeof report.result_a_primary2_url).toBe("string");
      expect(report.result_b_status).toBe("UNRESOLVED");
      expect(report.result_b_primary1_url).toBeNull();
      expect(report.result_b_primary2_url).toBeNull();
      expect(report.temporary_resources_removed).toBe(true);
    },
    240_000,
  );
});
