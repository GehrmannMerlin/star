import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { join } from "node:path";
import { createDb, migrateToLatest, createRepositories } from "@stellaris/db";
import { startPostgres, type StartedPostgres } from "@stellaris/db/testing/pg.js";
import { createEvidenceStore } from "@stellaris/evidence";
import { createSafeEgressPolicy } from "@stellaris/crawler/safe-egress.js";
import { createFixtureServer } from "@stellaris/crawler/testing/fixture-server.js";
import { runMultiInstitutionPipeline } from "./multi-institution-driver.js";
import type { SiteAdapter } from "@stellaris/crawler/adapter/loader.js";

describe("多机构编排驱动", () => {
  let pg: StartedPostgres;
  let srv: Awaited<ReturnType<typeof createFixtureServer>>;
  let db: ReturnType<typeof createDb>;
  let repos: ReturnType<typeof createRepositories>;

  beforeAll(async () => {
    pg = await startPostgres();
    db = createDb(pg.config);
    await migrateToLatest(db);
    repos = createRepositories(db);
    srv = await createFixtureServer([{ pathPrefix: "/golden", dir: join(import.meta.dirname, "../../../../packages/crawler/src/discovery/golden") }]);
  }, 120_000);

  afterAll(async () => {
    await srv.close();
    await db.destroy();
    await pg.stop();
  });

  it("3 机构完整链路 → 每机构两槽位 result_row", async () => {
    const task = await repos.taskRun.createWithIdempotency({
      idempotencyKey: "multi-inst-test-key",
      mode: "FULL_INSTITUTION",
      expandLevel: "COUNTY",
      ruleVersion: "v1",
    });
    await repos.targetScope.addMany(task.id, [
      { regionCode: "340000", regionName: "安徽省", parentRegionCode: null, regionLevel: "province", included: true },
    ]);

    // 离线适配器：机构列表页 + 领导列表页。
    const adapter: SiteAdapter = {
      siteId: "test",
      hosts: ["localhost"],
      institutionList: { url: `${srv.url}/golden/institution-list.html`, selector: ".list a" },
      leadershipList: null,
      memberDetail: null,
      roles: { primaryKeywords: [], secondaryKeywords: [] },
    };

    const policy = createSafeEgressPolicy({ mode: "offline-fixture", allowedTestPorts: new Set([srv.basePort]) });
    const evidenceStore = createEvidenceStore(join(process.cwd(), ".tmp-multi-evidence"));
    const events: string[] = [];

    await runMultiInstitutionPipeline({
      taskRunId: task.id,
      repos,
      evidenceStore,
      policy,
      fixtureUrl: srv.url,
      adapter,
      emit: (e) => events.push(e.type),
      evidenceRoot: join(process.cwd(), ".tmp-multi-evidence"),
    });

    // 断言：机构清单 4 行（institution-list.html 有 4 个机构）。
    const institutions = await repos.institutionSnapshot.listByTask(task.id);
    expect(institutions.length).toBe(4);

    // 断言：result_row 每机构两槽位。
    const rows = await repos.resultRow.listByTask(task.id);
    expect(rows.length).toBe(8); // 4 机构 × 2 槽位
    const byInstitution = new Map<string, number>();
    for (const r of rows) {
      byInstitution.set(r.institution_snapshot_id, (byInstitution.get(r.institution_snapshot_id) ?? 0) + 1);
    }
    for (const [instId, count] of byInstitution) {
      expect(count).toBe(2);
      void instId;
    }

    // 断言：任务完成。
    const completed = await repos.taskRun.findById(task.id);
    expect(completed?.status).toBe("COMPLETED");
  }, 120_000);
});
