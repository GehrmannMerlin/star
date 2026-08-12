import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { join } from "node:path";
import { createDb, migrateToLatest, createRepositories } from "@stellaris/db";
import { startPostgres, type StartedPostgres } from "@stellaris/db/testing/pg.js";
import { createEvidenceStore } from "@stellaris/evidence";
import { createSafeEgressPolicy } from "@stellaris/crawler/safe-egress.js";
import { createFixtureServer } from "@stellaris/crawler/testing/fixture-server.js";
import { BrowserPool } from "@stellaris/crawler/browser/render.js";
import { runMultiInstitutionPipeline } from "./multi-institution-driver.js";
import type { SiteAdapter } from "@stellaris/crawler/adapter/loader.js";

/**
 * 浏览器升级路径离线测试（R-09：JS 动态详情页需浏览器升级）。
 * fixture 结构模拟安徽：静态领导集合页 + JS 动态详情页（HTTP 拿空正文，浏览器渲染后才有简历）。
 */
describe("多机构驱动浏览器升级路径", () => {
  let pg: StartedPostgres;
  let srv: Awaited<ReturnType<typeof createFixtureServer>>;
  let db: ReturnType<typeof createDb>;
  let repos: ReturnType<typeof createRepositories>;
  let pool: BrowserPool;

  beforeAll(async () => {
    pg = await startPostgres();
    db = createDb(pg.config);
    await migrateToLatest(db);
    repos = createRepositories(db);
    // 挂载 discovery golden（机构列表/领导集合）与 browser golden（动态详情页）。
    srv = await createFixtureServer([
      { pathPrefix: "/golden", dir: join(import.meta.dirname, "../../../../packages/crawler/src/discovery/golden") },
      { pathPrefix: "/browser", dir: join(import.meta.dirname, "../../../../packages/crawler/src/browser/golden") },
    ]);
    pool = new BrowserPool({ maxPages: 2 });
  }, 120_000);

  afterAll(async () => {
    await pool.close();
    await srv.close();
    await db.destroy();
    await pg.stop();
  });

  it("JS 动态详情页 → 浏览器升级渲染 → 抽取 → 非空 result_row（Reviewer MATCH）", async () => {
    const task = await repos.taskRun.createWithIdempotency({
      ownerUserId: "test-user",
      idempotencyKey: "browser-upgrade-key",
      mode: "FULL_INSTITUTION",
      expandLevel: "COUNTY",
      ruleVersion: "v1",
    });
    await repos.targetScope.addMany(task.id, [
      { regionCode: "340000", regionName: "安徽省", parentRegionCode: null, regionLevel: "province", included: true },
    ]);

    // 适配器：领导集合页指向一个静态页，含指向动态详情页的成员链接；memberDetail 需浏览器。
    const adapter: SiteAdapter = {
      siteId: "test",
      hosts: ["localhost"],
      institutionList: { url: `${srv.url}/golden/institution-list.html`, selector: ".list a" },
      leadershipList: { url: `${srv.url}/golden/leadership.html`, memberSelector: "a[href]" },
      memberDetail: { render: "playwright", bioSelector: ".bio" },
      roles: { primaryKeywords: ["省长"], secondaryKeywords: ["副省长"] },
    };

    const policy = createSafeEgressPolicy({ mode: "offline-fixture", allowedTestPorts: new Set([srv.basePort]) });
    const evidenceRoot = join(process.cwd(), ".tmp-browser-upgrade-evidence");
    const events: string[] = [];

    await runMultiInstitutionPipeline({
      taskRunId: task.id,
      repos,
      evidenceStore: createEvidenceStore(evidenceRoot),
      policy,
      fixtureUrl: srv.url,
      adapter,
      browserPool: pool,
      emit: (e) => events.push(e.type),
      evidenceRoot,
    });

    // 至少一个非空 result_row（浏览器渲染抽取成功 → Reviewer MATCH → 非空 URL）。
    const rows = await repos.resultRow.listByTask(task.id);
    const nonEmpty = rows.filter((r) => r.position_url !== null);
    expect(nonEmpty.length).toBeGreaterThan(0);
  }, 120_000);
});
