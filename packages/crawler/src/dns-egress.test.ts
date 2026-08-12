import { describe, it, expect } from "vitest";
import { httpFetch } from "./http-fetch.js";
import { createSafeEgressPolicy } from "./safe-egress.js";
import { createFixtureServer } from "./testing/fixture-server.js";
import { join } from "node:path";

/**
 * DNS-pinned SSRF 端到端（规格 §23.1）。
 * production 模式下，hostname 形式的 URL 也必须在 DNS 解析层拒绝私网/回环地址。
 * 公网抓取验证依赖真实网络，改为本地 fixture + production 模式 DNS 校验行为。
 */
describe("DNS-pinned SSRF 端到端", () => {
  it("production 模式抓取 private-hostname 被 DNS 校验拒绝", async () => {
    const prod = createSafeEgressPolicy({ mode: "production" });
    await expect(httpFetch("http://localhost:80/", prod)).rejects.toThrow();
  });

  it("production 模式抓取私网字面 IP 被 assertAllowedUrl 拒绝", async () => {
    const prod = createSafeEgressPolicy({ mode: "production" });
    await expect(httpFetch("http://10.0.0.1/", prod)).rejects.toThrow();
  });

  it("offline-fixture 本地金标抓取走 DNS-pinned 成功（不依赖公网）", async () => {
    const srv = await createFixtureServer([{ pathPrefix: "/golden", dir: join(import.meta.dirname, "golden") }]);
    const policy = createSafeEgressPolicy({ mode: "offline-fixture", allowedTestPorts: new Set([srv.basePort]) });
    const res = await httpFetch(`${srv.url}/golden/robots.txt`, policy);
    expect(res.status).toBe(200);
    await srv.close();
  });
});
