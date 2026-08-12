import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { join } from "node:path";
import { createDb, migrateToLatest, createRepositories } from "@stellaris/db";
import { startPostgres, type StartedPostgres } from "@stellaris/db/testing/pg.js";
import { createEvidenceStore } from "@stellaris/evidence";
import { createSafeEgressPolicy } from "@stellaris/crawler/safe-egress.js";
import { createFixtureServer } from "@stellaris/crawler/testing/fixture-server.js";
import { PolitenessGate, HttpCache } from "@stellaris/crawler";
import { runMultiInstitutionPipeline } from "./multi-institution-driver.js";
import type { SiteAdapter } from "@stellaris/crawler/adapter/loader.js";

/**
 * P1 集成测试：驱动注入 politeness/cache/siteProfile。
 * 验证：多机构驱动跑通 + 站点画像被写入 + 缓存生效 + 批次性能。
 */
describe("P1 驱动性能接入（站点画像+并发+缓存）", () => {
  let pg: StartedPostgres;
  let srv: Awaited<ReturnType<typeof createFixtureServer>>;
  let db: ReturnType<typeof createDb>;
  let repos: ReturnType<typeof createRepositories>;

  beforeAll(async () => {
    pg = await startPostgres();
    db = createDb(pg.config);
    await migrateToLatest(db);
    repos = createRepositories(db);
    srv = await createFixtureServer([
      { pathPrefix: "/golden", dir: join(import.meta.dirname, "../../../../packages/crawler/src/discovery/golden") },
    ]);
  }, 120_000);

  afterAll(async () => {
    await srv.close();
    await db.destroy();
    await pg.stop();
  });

  it("驱动接入后站点画像被写入", async () => {
    const task = await repos.taskRun.createWithIdempotency({
      idempotencyKey: "p1-profile-key",
      mode: "FULL_INSTITUTION",
      expandLevel: "COUNTY",
      ruleVersion: "v1",
    });
    await repos.targetScope.addMany(task.id, [
      { regionCode: "340000", regionName: "安徽省", parentRegionCode: null, regionLevel: "province", included: true },
    ]);
    const adapter: SiteAdapter = {
      siteId: "test",
      hosts: ["localhost"],
      institutionList: { url: `${srv.url}/golden/institution-list.html`, selector: ".list a" },
      leadershipList: null,
      memberDetail: null,
      roles: { primaryKeywords: [], secondaryKeywords: [] },
    };
    const policy = createSafeEgressPolicy({ mode: "offline-fixture", allowedTestPorts: new Set([srv.basePort]) });
    const host = new URL(srv.url).host;

    await runMultiInstitutionPipeline({
      taskRunId: task.id,
      repos,
      evidenceStore: createEvidenceStore(join(process.cwd(), ".tmp-p1-evidence")),
      policy,
      fixtureUrl: srv.url,
      adapter,
      politeness: new PolitenessGate(),
      httpCache: new HttpCache(),
      emit: () => {},
      evidenceRoot: join(process.cwd(), ".tmp-p1-evidence"),
    });

    // 画像已写入。
    const profile = await repos.siteProfile.findByHost(host);
    expect(profile?.host).toBe(host);
    expect(profile?.success_rate).toBeTruthy();
    expect(profile?.last_verified_at).toBeTruthy();
  }, 120_000);

  it("批次性能：10 URL 处理 P95 在合理上限内", async () => {
    // 性能基准（离线 fixture）：机构发现 + 多机构链路应快速完成。
    const started = Date.now();
    const task = await repos.taskRun.createWithIdempotency({
      idempotencyKey: "p1-perf-key",
      mode: "FULL_INSTITUTION",
      expandLevel: "COUNTY",
      ruleVersion: "v1",
    });
    await repos.targetScope.addMany(task.id, [
      { regionCode: "340000", regionName: "安徽省", parentRegionCode: null, regionLevel: "province", included: true },
    ]);
    const adapter: SiteAdapter = {
      siteId: "test",
      hosts: ["localhost"],
      institutionList: { url: `${srv.url}/golden/institution-list.html`, selector: ".list a" },
      leadershipList: null,
      memberDetail: null,
      roles: { primaryKeywords: [], secondaryKeywords: [] },
    };
    const policy = createSafeEgressPolicy({ mode: "offline-fixture", allowedTestPorts: new Set([srv.basePort]) });
    await runMultiInstitutionPipeline({
      taskRunId: task.id,
      repos,
      evidenceStore: createEvidenceStore(join(process.cwd(), ".tmp-p1-perf")),
      policy,
      fixtureUrl: srv.url,
      adapter,
      politeness: new PolitenessGate(),
      httpCache: new HttpCache(),
      emit: () => {},
      evidenceRoot: join(process.cwd(), ".tmp-p1-perf"),
    });
    const elapsedMs = Date.now() - started;
    // 4 机构 × 2 槽位；离线应远低于 60s（P95 门槛的保守上限）。
    const rows = await repos.resultRow.listByTask(task.id);
    expect(rows.length).toBe(8);
    expect(elapsedMs).toBeLessThan(60_000);
  }, 120_000);
});
