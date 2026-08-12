import { describe, it, expect, vi } from "vitest";
import { dnsLookup } from "./dns-lookup.js";
import { createSafeEgressPolicy } from "./safe-egress.js";

const productionPolicy = createSafeEgressPolicy({ mode: "production" });

describe("dns-lookup DNS 层 SSRF 校验", () => {
  it("解析到私网/元数据 IP 被拒绝", async () => {
    // 模拟真实 DNS 解析到禁止地址（此处直接用已知保留地址域名的解析结果判断）。
    // 用 dnsLookup 对 localhost 应失败（localhost 解析到 127.0.0.1，属回环）。
    await expect(dnsLookup("localhost", productionPolicy)).rejects.toThrow(/禁止地址|DNS 解析/);
  });

  it("offline-fixture 模式放行本地地址", async () => {
    const fixturePolicy = createSafeEgressPolicy({ mode: "offline-fixture", allowedTestPorts: new Set([8899]) });
    const records = await dnsLookup("127.0.0.1", fixturePolicy);
    expect(records[0]?.address).toBe("127.0.0.1");
  });

  it("解析到公共地址放行（用 example.com）", async () => {
    const records = await dnsLookup("example.com", productionPolicy);
    expect(records.length).toBeGreaterThan(0);
  });
});
