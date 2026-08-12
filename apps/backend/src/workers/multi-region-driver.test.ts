import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { join } from "node:path";
import { createDb, migrateToLatest, createRepositories } from "@stellaris/db";
import { startPostgres, type StartedPostgres } from "@stellaris/db/testing/pg.js";
import { createEvidenceStore } from "@stellaris/evidence";
import { createSafeEgressPolicy } from "@stellaris/crawler/safe-egress.js";
import { createFixtureServer } from "@stellaris/crawler/testing/fixture-server.js";
import { runMultiRegionPipeline } from "./multi-region-driver.js";
import type { SiteAdapter } from "@stellaris/crawler/adapter/loader.js";

describe("多行政区编排驱动", () => {
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

  it("2 行政区串行 → 每行政区多机构结果", async () => {
    const task = await repos.taskRun.createWithIdempotency({
      ownerUserId: "test-user",
      idempotencyKey: "multi-region-test-key",
      mode: "FULL_INSTITUTION",
      expandLevel: "COUNTY",
      ruleVersion: "v1",
    });
    // 冻结 2 个行政区（合肥 340100、芜湖 340200）。
    await repos.targetScope.addMany(task.id, [
      { regionCode: "340100", regionName: "合肥市", parentRegionCode: "340000", regionLevel: "city", included: true },
      { regionCode: "340200", regionName: "芜湖市", parentRegionCode: "340000", regionLevel: "city", included: true },
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
    const evidenceStore = createEvidenceStore(join(process.cwd(), ".tmp-mr-evidence"));
    const events: string[] = [];

    await runMultiRegionPipeline({
      taskRunId: task.id,
      repos,
      evidenceStore,
      policy,
      fixtureUrl: srv.url,
      adapter,
      emit: (e) => events.push(e.type),
      evidenceRoot: join(process.cwd(), ".tmp-mr-evidence"),
    });

    // 每行政区走机构发现（institution-list.html 有 4 机构）→ 4 机构 × 2 槽位 = 8 行/行政区。
    const rows = await repos.resultRow.listByTask(task.id);
    expect(rows.length).toBe(16); // 2 行政区 × 4 机构 × 2 槽位

    // 两个行政区都有结果。
    const regionCodes = new Set(rows.map((r) => r.region_code));
    expect(regionCodes.has("340100")).toBe(true);
    expect(regionCodes.has("340200")).toBe(true);

    // 任务完成。
    const completed = await repos.taskRun.findById(task.id);
    expect(completed?.status).toBe("COMPLETED");
  }, 120_000);
});
