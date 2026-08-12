/**
 * 真实安徽多机构闭环 Canary（R-21 授权）。
 * 执行方式：production egress + 真实安徽适配器 + BrowserPool，跑 runMultiInstitutionPipeline。
 * 范围：仅 www.ah.gov.cn（安徽省本级 340000），只读、礼貌并发、DNS-pinned SSRF。
 * 用法：tsx src/scripts/canary-anhui.ts（需真实网络 + 本地 Chromium）。
 */
import { createDb, migrateToLatest, createRepositories } from "@stellaris/db";
import { startPostgres } from "@stellaris/db/testing/pg.js";
import { createEvidenceStore } from "@stellaris/evidence";
import { createSafeEgressPolicy } from "@stellaris/crawler/safe-egress.js";
import { loadAdapter } from "@stellaris/crawler/adapter/loader.js";
import { BrowserPool } from "@stellaris/crawler/browser/render.js";
import { runMultiInstitutionPipeline } from "../workers/multi-institution-driver.js";
import { join } from "node:path";

async function main(): Promise<void> {
  // 1. 只读预检：production 出口策略（DNS-pinned SSRF 生效）。
  const policy = createSafeEgressPolicy({ mode: "production" });

  // 2. 数据库：Testcontainers PostgreSQL 18（结果入库，便于核对）。
  const pg = await startPostgres();
  const db = createDb(pg.config);
  await migrateToLatest(db);
  const repos = createRepositories(db);
  const evidenceRoot = join(process.cwd(), ".tmp-canary-evidence");

  // 3. 创建任务 + 冻结安徽省本级范围。
  const task = await repos.taskRun.createWithIdempotency({
    ownerUserId: "canary",
    idempotencyKey: `canary-anhui-${Date.now()}`,
    mode: "FULL_INSTITUTION",
    expandLevel: "COUNTY",
    ruleVersion: "v1",
  });
  await repos.targetScope.addMany(task.id, [
    { regionCode: "340000", regionName: "安徽省", parentRegionCode: null, regionLevel: "province", included: true },
  ]);

  // 4. 真实适配器 + 浏览器池 + 多机构驱动。
  const adapter = loadAdapter("anhui-provincial-government");
  const browserPool = new BrowserPool({ maxPages: 2 });
  const events: string[] = [];
  console.log(`[canary] 任务 ${task.id} 开始（生产 egress）`);
  console.log(`[canary] 适配器: ${adapter.siteId}; 行政区入口: ${adapter.regionEntries?.["340000"]}`);

  const started = Date.now();
  await runMultiInstitutionPipeline({
    taskRunId: task.id,
    repos,
    evidenceStore: createEvidenceStore(evidenceRoot),
    policy,
    adapter,
    browserPool,
    emit: (e) => events.push(e.type),
    evidenceRoot,
    regionCode: "340000",
    regionName: "安徽省",
  });
  console.log(`[canary] 驱动完成，耗时 ${((Date.now() - started) / 1000).toFixed(1)}s，事件数 ${events.length}`);

  // 5. 结果核对。
  const insts = await repos.institutionSnapshot.listByTask(task.id);
  const rows = await repos.resultRow.listByTask(task.id);
  const nonEmpty = rows.filter((r) => r.position_url !== null);
  console.log(`[canary] 机构数: ${insts.length}`);
  console.log(`[canary] result_row: ${rows.length}（非空 URL: ${nonEmpty.length}）`);
  for (const r of rows) {
    console.log(
      `  - ${r.institution_name} [${r.slot}] ${r.person_name ?? "(空)"}: ${r.position_url ?? "(空URL) " + r.result_zh}`,
    );
  }
  const blocked = insts.filter((i) => i.status === "BLOCKED" || i.status === "FAILED");
  console.log(`[canary] 机构终态: 正常 ${insts.length - blocked.length}, BLOCKED/FAILED ${blocked.length}`);

  // 6. 清理。
  await browserPool.close();
  await db.destroy();
  await pg.stop();
}

main().then(() => process.exit(0)).catch((e) => {
  console.error("[canary] 失败:", e);
  process.exit(1);
});
