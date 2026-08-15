import { describe, it, expect } from "vitest";
import { BiographyTaskResultReader } from "./biography-task-result-reader.js";
import type { BiographyUrlResult } from "./biography-url-result.js";

/** 构造最小 BiographyUrlResult（只关心 packetId 顺序）。 */
function result(packetId: string): BiographyUrlResult {
  return {
    packetId,
    regionCode: null,
    institutionId: "inst-" + packetId,
    institutionName: "机构-" + packetId,
    status: "UNRESOLVED",
    sourceOfTruth: "LATEST_FROZEN_APPROVED_REVIEW",
    primary1: {
      primarySlot: "PRIMARY_1",
      targetId: null,
      personId: null,
      personName: null,
      biographyUrl: null,
      decisionStatus: "UNRESOLVED",
      reviewRound: null,
      sourceReviewId: null,
    },
    primary2: {
      primarySlot: "PRIMARY_2",
      targetId: null,
      personId: null,
      personName: null,
      biographyUrl: null,
      decisionStatus: "UNRESOLVED",
      reviewRound: null,
      sourceReviewId: null,
    },
  };
}

describe("BiographyTaskResultReader", () => {
  it("保持输入 packetId 顺序，过滤不存在的 packet", async () => {
    const reader = new BiographyTaskResultReader({
      async read(id) {
        if (id === "missing") return null;
        return result(id);
      },
    });
    const out = await reader.readMany(["p2", "missing", "p1", "missing"]);
    expect(out.map((r) => r.packetId)).toEqual(["p2", "p1"]);
  });

  it("空输入返回空数组", async () => {
    const reader = new BiographyTaskResultReader({ read: async () => null });
    await expect(reader.readMany([])).resolves.toEqual([]);
  });
});
