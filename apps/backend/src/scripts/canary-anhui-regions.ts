/**
 * 安徽 16 地市只读校准 Canary（P4-B，D2 逐站授权后执行）。
 * 范围：安徽 16 地市政府官网（独立域名 *.gov.cn，DNS 已核验解析成功）。
 * 执行方式：production egress + 真实安徽适配器 + BrowserPool，跑 runMultiRegionPipeline。
 * 边界（R-08/R-21 一致）：只读、礼貌并发 ≤2、DNS-pinned SSRF、robots、不绕过访问控制；
 * 每站少量请求；不改生产数据；地市无领导信息页 → 如实「该机构无领导信息」。
 * 用法：tsx src/scripts/canary-anhui-regions.ts [--regions 340100,340200] [--dry-run]
 *   --dry-run：仅列出将访问的行政区与入口，不发真实请求（默认开启，需显式 --run 才真实抓取）。
 * 状态：**脚本骨架**。真实请求需 D2 逐站授权（R-43 边界）。
 */
import { createDb, migrateToLatest, createRepositories } from "@stellaris/db";
import { startPostgres } from "@stellaris/db/testing/pg.js";
import { createEvidenceStore } from "@stellaris/evidence";
import { createSafeEgressPolicy } from "@stellaris/crawler/safe-egress.js";
import { loadAdapter } from "@stellaris/crawler/adapter/loader.js";
import { BrowserPool } from "@stellaris/crawler/browser/render.js";
import { runMultiRegionPipeline } from "../workers/multi-region-driver.js";
import { join } from "node:path";

/** 安徽 16 地市代码（GB/T 2260，与 contracts regionEntries 对齐）。 */
export const ANHUI_CITY_CODES = [
  "340100", "340200", "340300", "340400", "340500", "340600",
  "340700", "340800", "341000", "341100", "341200", "341300",
  "341500", "341600", "341700", "341800",
] as const;

function parseArgs(argv: string[]): { regions: string[]; run: boolean } {
  const regions: string[] = [];
  let run = false;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--regions") {
      const list = argv[i + 1];
      if (list) regions.push(...list.split(",").map((s) => s.trim()).filter(Boolean));
    }
    if (argv[i] === "--run") run = true;
  }
  return { regions: regions.length > 0 ? regions : [...ANHUI_CITY_CODES], run };
}

async function main(): Promise<void> {
  const { regions, run } = parseArgs(process.argv.slice(2));
  const adapter = loadAdapter("anhui-provincial-government");

  // 校验行政区均有入口映射。
  const missing = regions.filter((c) => !adapter.regionEntries?.[c]);
  if (missing.length > 0) {
    throw new Error(`缺少真实入口映射的行政区: ${missing.join(", ")}`);
  }

  // 骨架模式：仅输出将访问的入口，不发真实请求（R-43：真实执行待 D2 授权）。
  if (!run) {
    console.log("[canary-regions] DRY-RUN：将访问以下行政区（真实请求待 D2 授权）");
    for (const c of regions) {
      console.log(`  ${c} -> ${adapter.regionEntries![c]}`);
    }
    console.log(`共 ${regions.length} 个行政区`);
    return;
  }

  // 真实执行（需 --run 显式开启 + D2 授权，R-45）。
  const policy = createSafeEgressPolicy({ mode: "production" });
  const pg = await startPostgres();
  const db = createDb(pg.config);
  await migrateToLatest(db);
  const repos = createRepositories(db);
  const evidenceRoot = join(process.cwd(), ".tmp-canary-regions-evidence");
  // R-44 缺口已补（multi-region-driver 透传 BrowserPool），地市 JS 动态领导页可浏览器升级渲染。
  const browserPool = new BrowserPool({ maxPages: 2 });

  const task = await repos.taskRun.createWithIdempotency({
    ownerUserId: "canary",
    idempotencyKey: `canary-regions-${Date.now()}`,
    mode: "FULL_INSTITUTION",
    expandLevel: "COUNTY",
    ruleVersion: "v1",
  });
  await repos.targetScope.addMany(
    task.id,
    regions.map((code) => ({
      regionCode: code,
      regionName: adapter.regionEntries![code] ?? code,
      parentRegionCode: code.slice(0, 2) + "0000",
      regionLevel: "city" as const,
      included: true,
    })),
  );

  console.log(`[canary-regions] 任务 ${task.id} 开始（${regions.length} 地市，生产 egress）`);
  const started = Date.now();
  await runMultiRegionPipeline({
    taskRunId: task.id,
    repos,
    evidenceStore: createEvidenceStore(evidenceRoot),
    policy,
    adapter,
    browserPool,
    emit: () => {},
    evidenceRoot,
  });
  console.log(`[canary-regions] 完成，耗时 ${((Date.now() - started) / 1000).toFixed(1)}s`);

  const rows = await repos.resultRow.listByTask(task.id);
  const nonEmpty = rows.filter((r) => r.position_url !== null);
  console.log(`[canary-regions] result_row: ${rows.length}（非空 URL: ${nonEmpty.length}）`);
  for (const r of rows) {
    console.log(`  - ${r.institution_name} [${r.slot}] ${r.person_name ?? "(空)"}: ${r.position_url ?? "(空URL) " + r.result_zh}`);
  }

  await browserPool.close();
  await db.destroy();
  await pg.stop();
}

main().then(() => process.exit(0)).catch((e) => {
  console.error("[canary-regions] 失败:", e);
  process.exit(1);
});
