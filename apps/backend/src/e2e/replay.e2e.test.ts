import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ExcelJS from "exceljs";
import { createDb, migrateToLatest } from "@stellaris/db";
import { startPostgres, type StartedPostgres } from "@stellaris/db/testing/pg.js";
import { createFixtureServer } from "@stellaris/crawler/testing/fixture-server.js";
import { buildApp } from "../server.js";
import type { FastifyInstance } from "fastify";

describe("离线端到端金标回放", () => {
  let pg: StartedPostgres;
  let fixture: Awaited<ReturnType<typeof createFixtureServer>>;
  let app: FastifyInstance;
  let exportDir: string;
  let db: ReturnType<typeof createDb>;

  const payload = {
    clientIdempotencyKey: "e2e-replay-key-0001",
    regionCode: "110000",
    regionName: "北京市",
    institutionName: "某某区人民政府",
    institutionType: "government",
    ruleVersion: "v1",
  };
  const TEST_USER = { "x-ifc-user-id": "test-user" };

  beforeAll(async () => {
    pg = await startPostgres();
    db = createDb(pg.config);
    await migrateToLatest(db);
    fixture = await createFixtureServer([
      { pathPrefix: "/golden", dir: join(import.meta.dirname, "../../../../packages/crawler/src/golden") },
    ]);
    exportDir = await mkdtemp(join(tmpdir(), "stellaris-e2e-"));
    app = await buildApp({
      db,
      fixtureUrl: fixture.url,
      egressMode: "offline-fixture",
      fixturePort: fixture.basePort,
      exportRoot: exportDir,
    });
  }, 120_000);

  afterAll(async () => {
    await app.close();
    await fixture.close();
    await db.destroy();
    await pg.stop();
    await rm(exportDir, { recursive: true, force: true });
  });

  /** 轮询任务直到终态。 */
  async function waitForCompletion(taskId: string): Promise<void> {
    const deadline = Date.now() + 15_000;
    while (Date.now() < deadline) {
      const detail = await app.inject({ method: "GET", url: `/api/tasks/${taskId}`, headers: TEST_USER });
      const statusZh = detail.json()?.task?.statusZh;
      if (statusZh && statusZh !== "待开始" && statusZh !== "正在抓取") {
        return;
      }
      await new Promise((r) => setTimeout(r, 200));
    }
    throw new Error(`任务 ${taskId} 未在时限内完成`);
  }

  it("从创建任务到单 Sheet Excel 的完整纵向闭环", async () => {
    const created = (await app.inject({ method: "POST", url: "/api/tasks", payload, headers: TEST_USER })).json();
    expect(created.idempotencyResult).toBe("created");
    const id = created.task.id;
    await waitForCompletion(id);

    // 任务详情：已完成 + 机构快照。
    const detail = (await app.inject({ method: "GET", url: `/api/tasks/${id}`, headers: TEST_USER })).json();
    expect(detail.task.statusZh).toBe("已完成");
    expect(detail.institution.officialName).toBe("某某区人民政府");

    // 两槽位结果，PRIMARY_1/PRIMARY_2 均有非空 URL（已被 Reviewer 复核）。
    const results = (await app.inject({ method: "GET", url: `/api/tasks/${id}/results`, headers: TEST_USER })).json();
    expect(results).toHaveLength(2);
    const p1 = results.find((r: { slot: string }) => r.slot === "PRIMARY_1");
    const p2 = results.find((r: { slot: string }) => r.slot === "PRIMARY_2");
    expect(p1.positionUrl).toMatch(/^https?:\/\//);
    expect(p2.positionUrl).toMatch(/^https?:\/\//);
    expect(p1.pageTypeZh).toBe("个人简介页");
    expect(p2.pageTypeZh).toBe("个人简介页");

    // 不变量：非空 URL 对应通过的 Reviewer 决策（DB 触发器已强制，这里复核结果链）。
    const evidence = (await app.inject({ method: "GET", url: `/api/tasks/${id}/evidence/${p1.id}`, headers: TEST_USER })).json();
    expect(evidence.summary.officialSourceUrls.length).toBeGreaterThan(0);

    // Excel：单 Sheet + 13 列 + 超链接 + 网页同源。
    const exp = (await app.inject({ method: "GET", url: `/api/tasks/${id}/export`, headers: TEST_USER })).json();
    expect(exp.rowCount).toBe(2);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(join(exportDir, exp.filename));
    expect(wb.worksheets).toHaveLength(1);
    expect(wb.worksheets[0]!.name).toBe("岗位信息采集结果");
    expect(wb.worksheets[0]!.getRow(1).cellCount).toBe(13);
    const excelP1Name = wb.worksheets[0]!.getRow(2).getCell(8).value; // 现任人员
    const excelP1Url = wb.worksheets[0]!.getRow(2).getCell(10).value; // 岗位信息URL
    expect(excelP1Name).toBe(p1.personName);
    expect(excelP1Url).toEqual({ text: p1.positionUrl, hyperlink: p1.positionUrl });
  });
});
