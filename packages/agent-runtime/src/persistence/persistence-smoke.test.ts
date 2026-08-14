import { describe, expect, it } from "vitest";
import { runPersistenceSmoke } from "./persistence-smoke.js";

describe("disposable PostgreSQL persistence smoke", () => {
  it(
    "migration → write → new instances → reload → provenance PASS → duplicate REJECTED",
    async () => {
      const report = await runPersistenceSmoke();

      expect(report.migration).toBe("PASS");
      expect(report.eventsInserted).toBeGreaterThan(0);
      expect(report.evidenceInserted).toBe(true);
      expect(report.payloadHashMatch).toBe(true);
      expect(report.evidenceFrozen).toBe(true);
      expect(report.eventsReloaded).toBeGreaterThan(0);
      expect(report.evidenceReloaded).toBe(true);
      expect(report.provenanceAfterReload).toBe("PASS");
      expect(report.duplicateSubmit).toBe("REJECTED");
      expect(report.rawHtmlPersisted).toBe(false);
      expect(report.secretLikePersisted).toBe(false);
    },
    180_000,
  );
});
