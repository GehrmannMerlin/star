import { describe, it, expect } from "vitest";
import type { PageFacts } from "@stellaris/crawler/page-facts.js";
import { classifyPage } from "./classify.js";
import { selectTwoPrimary } from "./selection.js";
import { checkHardGates } from "./admission.js";
import { decideRecovery, buildRecoveryOrder } from "./recovery.js";
import type { LeadershipStructure } from "./leadership.js";

const collectionFacts: PageFacts = {
  documentHash: "h1",
  title: "某某区人民政府领导信息",
  bodyText: "张三 区长；李四 常务副区长；王五 副区长",
  leadershipMembers: [
    { name: "张三", roles: ["区长"], sortOrder: 1, href: "https://x.gov.cn/ldr/zhang-san.html" },
    { name: "李四", roles: ["常务副区长"], sortOrder: 2, href: "https://x.gov.cn/ldr/li-si.html" },
    { name: "王五", roles: ["副区长"], sortOrder: 3, href: "https://x.gov.cn/ldr/wang-wu.html" },
  ],
  links: [],
  pageDate: null,
};

const newsFacts: PageFacts = {
  documentHash: "h2",
  title: "某某区工作动态",
  bodyText: "会议调研报道 工作动态",
  leadershipMembers: [],
  links: [],
  pageDate: null,
};

const structure: LeadershipStructure = {
  institutionSnapshotId: "i1",
  members: [
    { personName: "张三", roles: ["区长"], sortOrder: 1, currentnessStatus: "CURRENT_COLLECTION_MEMBER" },
    { personName: "李四", roles: ["常务副区长"], sortOrder: 2, currentnessStatus: "CURRENT_COLLECTION_MEMBER" },
    { personName: "王五", roles: ["副区长"], sortOrder: 3, currentnessStatus: "CURRENT_COLLECTION_MEMBER" },
  ],
};

describe("规则引擎", () => {
  it("集合页判型为 CURRENT_LEADER_COLLECTION，新闻页判型为禁止", () => {
    const c1 = classifyPage("某某区人民政府领导信息", "张三 区长 李四", collectionFacts);
    expect(c1.pageType).toBe("CURRENT_LEADER_COLLECTION");
    expect(c1.forbidden).toBe(false);
    const c2 = classifyPage("某某区工作动态", "会议调研报道", newsFacts);
    expect(c2.forbidden).toBe(true);
  });

  it("政府机构选出 PRIMARY_1=张三、PRIMARY_2=李四", () => {
    const sel = selectTwoPrimary("government", structure);
    expect(sel[0]).toMatchObject({ slot: "PRIMARY_1", personName: "张三", status: "FILLED" });
    expect(sel[1]).toMatchObject({ slot: "PRIMARY_2", personName: "李四", status: "FILLED" });
  });

  it("同一自然人不得占两个主要人员槽位", () => {
    const single: LeadershipStructure = {
      institutionSnapshotId: "i2",
      members: [{ personName: "张三", roles: ["区长"], sortOrder: 1, currentnessStatus: "CURRENT_COLLECTION_MEMBER" }],
    };
    const sel = selectTwoPrimary("government", single);
    expect(sel[0].personName).toBe("张三");
    expect(sel[1].personName).not.toBe("张三");
  });

  it("任一硬门槛失败则准入失败，分数不抵门槛", () => {
    const r = checkHardGates({
      url: "https://x/",
      pageType: "CURRENT_LEADER_COLLECTION",
      forbidden: false,
      personName: "张三",
      institutionName: "某某区人民政府",
      officialRole: "区长",
      currentness: "CURRENT_COLLECTION_MEMBER",
      priorityEntryChecked: true,
      reviewerConsistent: false,
      officialDomains: ["x.gov.cn"],
      forbiddenSignals: [],
    });
    expect(r.passed).toBe(false);
    expect(r.failures.some((f) => f.gate === "reviewer_consistent")).toBe(true);
  });

  it("URL 为空、人员错误、当前性冲突任一都触发 Recovery", () => {
    expect(
      decideRecovery({
        urlEmpty: true,
        forbidden: false,
        personMismatch: false,
        institutionMismatch: false,
        roleMismatch: false,
        currentnessConflict: false,
        priorityNotChecked: false,
        secondUnconfirmed: false,
        reviewerDisagree: false,
      }).triggered,
    ).toBe(true);
    expect(
      decideRecovery({
        urlEmpty: false,
        forbidden: false,
        personMismatch: false,
        institutionMismatch: false,
        roleMismatch: false,
        currentnessConflict: true,
        priorityNotChecked: false,
        secondUnconfirmed: false,
        reviewerDisagree: false,
      }).triggered,
    ).toBe(true);
  });

  it("Recovery 顺序遵循规格 §14.3 八步", () => {
    const order = buildRecoveryOrder();
    expect(order).toHaveLength(8);
    expect(order[0]).toBe("site_profile_entry");
    expect(order[7]).toBe("region_success_pattern");
  });
});
