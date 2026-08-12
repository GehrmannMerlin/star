import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { join } from "node:path";
import { createFixtureServer } from "./testing/fixture-server.js";
import { loadRobots, type RobotsPolicy } from "./robots.js";
import { createSafeEgressPolicy } from "./safe-egress.js";

describe("robots 遵守", () => {
  let srv: Awaited<ReturnType<typeof createFixtureServer>>;
  let robots: RobotsPolicy | null;

  beforeAll(async () => {
    srv = await createFixtureServer([{ pathPrefix: "/robots-fixture", dir: join(import.meta.dirname, "golden") }]);
    const policy = createSafeEgressPolicy({ mode: "offline-fixture", allowedTestPorts: new Set([srv.basePort]) });
    robots = await loadRobots(`${srv.url}/robots-fixture/robots.txt`, policy);
  });

  afterAll(async () => {
    await srv.close();
  });

  it("robots 禁止路径返回 not allowed，允许路径返回 allowed", () => {
    expect(robots).not.toBeNull();
    expect(robots!.isAllowed(`${srv.url}/robots-fixture/collection.html`, "*")).toBe(true);
    expect(robots!.isAllowed(`${srv.url}/robots-fixture/private/`, "*")).toBe(false);
  });

  it("robots 获取失败时按降级规则处理（null 不阻断但标记）", async () => {
    const prod = createSafeEgressPolicy({ mode: "production" });
    const missing = await loadRobots("http://127.0.0.1:1/robots.txt", prod);
    expect(missing).toBeNull();
  });
});
