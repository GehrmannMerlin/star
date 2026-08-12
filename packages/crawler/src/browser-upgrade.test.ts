import { describe, it, expect } from "vitest";
import { shouldUpgradeToPlaywright } from "./browser-upgrade.js";

describe("browser-upgrade 升级条件", () => {
  it("正文缺失触发升级", () => {
    expect(shouldUpgradeToPlaywright({ bodyLength: 0, hashRoute: false, dynamicList: false, blocked: false })).toBe(true);
  });
  it("Hash 路由触发升级", () => {
    expect(shouldUpgradeToPlaywright({ bodyLength: 1000, hashRoute: true, dynamicList: false, blocked: false })).toBe(true);
  });
  it("动态列表触发升级", () => {
    expect(shouldUpgradeToPlaywright({ bodyLength: 1000, hashRoute: false, dynamicList: true, blocked: false })).toBe(true);
  });
  it("HTTP 阻断触发升级", () => {
    expect(shouldUpgradeToPlaywright({ bodyLength: 1000, hashRoute: false, dynamicList: false, blocked: true })).toBe(true);
  });
  it("条件全部不满足不升级", () => {
    expect(shouldUpgradeToPlaywright({ bodyLength: 5000, hashRoute: false, dynamicList: false, blocked: false })).toBe(false);
  });
});
