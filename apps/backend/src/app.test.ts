import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { join } from "node:path";
import { createDb, migrateToLatest } from "@stellaris/db";
import { startPostgres, type StartedPostgres } from "@stellaris/db/testing/pg.js";
import { buildApp } from "./server.js";
import { createFixtureServer } from "@stellaris/crawler/testing/fixture-server.js";
import type { FastifyInstance } from "fastify";

let pg: StartedPostgres;
let app: FastifyInstance;
let fixture: Awaited<ReturnType<typeof createFixtureServer>>;
let serverPort: number;
let db: ReturnType<typeof createDb>;

const validCreate = {
  clientIdempotencyKey: "app-test-key-0001",
  regionCode: "110000",
  regionName: "北京市",
  institutionName: "某某区人民政府",
  institutionType: "government",
  ruleVersion: "v1",
};

beforeAll(async () => {
  pg = await startPostgres();
  db = createDb(pg.config);
  await migrateToLatest(db);
  fixture = await createFixtureServer([
    { pathPrefix: "/golden", dir: join(import.meta.dirname, "../../../packages/crawler/src/golden") },
    { pathPrefix: "/discovery", dir: join(import.meta.dirname, "../../../packages/crawler/src/discovery/golden") },
  ]);
  app = await buildApp({ db, fixtureUrl: fixture.url, egressMode: "offline-fixture", fixturePort: fixture.basePort });
  await app.listen({ port: 0, host: "127.0.0.1" });
  serverPort = (app.server.address() as { port: number }).port;
}, 120_000);

afterAll(async () => {
  await app.close();
  await fixture.close();
  await db.destroy();
  await pg.stop();
});

/** 轮询任务直到到达终态（回放完成后 statusZh=已完成）。 */
async function waitForTaskCompletion(taskId: string, timeoutMs = 15_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const detail = await app.inject({ method: "GET", url: `/api/tasks/${taskId}` });
    const statusZh = detail.json()?.task?.statusZh;
    if (statusZh && statusZh !== "待开始" && statusZh !== "正在抓取") {
      return;
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`任务 ${taskId} 在 ${timeoutMs}ms 内未完成`);
}

describe("任务 API 与 SSE", () => {
  it("创建任务返回 created 且任务状态为已完成", async () => {
    const res = await app.inject({ method: "POST", url: "/api/tasks", payload: validCreate });
    expect(res.statusCode).toBe(200);
    expect(res.json().idempotencyResult).toBe("created");
    const id = res.json().task.id;
    await waitForTaskCompletion(id);
    const detail = await app.inject({ method: "GET", url: `/api/tasks/${id}` });
    expect(detail.statusCode).toBe(200);
    expect(detail.json().task.statusZh).toBe("已完成");
  });

  it("同幂等键重复创建返回 replayed 且同一任务 id", async () => {
    const a = await app.inject({ method: "POST", url: "/api/tasks", payload: validCreate });
    const b = await app.inject({ method: "POST", url: "/api/tasks", payload: validCreate });
    expect(b.json().idempotencyResult).toBe("replayed");
    expect(b.json().task.id).toBe(a.json().task.id);
  });

  it("结果含两槽位且 PRIMARY_1 的 positionUrl 已被 Reviewer 复核", async () => {
    const id = (await app.inject({ method: "POST", url: "/api/tasks", payload: validCreate })).json().task.id;
    await waitForTaskCompletion(id);
    const results = (await app.inject({ method: "GET", url: `/api/tasks/${id}/results` })).json();
    expect(results).toHaveLength(2);
    const p1 = results.find((r: { slot: string }) => r.slot === "PRIMARY_1");
    expect(p1.positionUrl).toMatch(/^https?:\/\//);
    expect(p1.pageTypeZh).toBeTruthy();
  });

  it("SSE 事件按序推送且带 seq", async () => {
    const id = (await app.inject({ method: "POST", url: "/api/tasks", payload: validCreate })).json().task.id;
    await waitForTaskCompletion(id);
    // 用真实 fetch 打开 SSE 连接，读取已缓冲事件后中止。
    const controller = new AbortController();
    const res = await fetch(`http://127.0.0.1:${serverPort}/api/tasks/${id}/events`, {
      signal: controller.signal,
    });
    expect(res.headers.get("content-type")).toContain("text/event-stream");
    const reader = res.body!.getReader();
    let text = "";
    while (!text.includes("result.upserted") && !text.includes("task.completed")) {
      const { value, done } = await reader.read();
      if (done) break;
      text += new TextDecoder().decode(value);
    }
    controller.abort();
    expect(text).toContain("result.upserted");
    expect(text).toContain("task.completed");
    expect(text).toMatch(/"seq":\d+/);
  });
});

describe("完整机构模式（FULL_INSTITUTION）", () => {
  let app2: FastifyInstance;

  beforeAll(async () => {
    // 用 fixture 指向的适配器重建 app（离线测试；真实网络时用安徽官方适配器）。
    const testAdapter = {
      siteId: "test",
      hosts: ["localhost"],
      institutionList: { url: `${fixture.url}/discovery/institution-list.html`, selector: ".list a" },
      leadershipList: null,
      memberDetail: null,
      roles: { primaryKeywords: [], secondaryKeywords: [] },
    };
    app2 = await buildApp({
      db,
      fixtureUrl: fixture.url,
      egressMode: "offline-fixture",
      fixturePort: fixture.basePort,
      adapter: testAdapter,
    });
    await app2.listen({ port: 0, host: "127.0.0.1" });
  });

  afterAll(async () => {
    await app2.close();
  });

  it("FULL_INSTITUTION 创建任务 → 机构发现 → 多机构结果", async () => {
    const payload = {
      clientIdempotencyKey: "full-inst-key-0001",
      mode: "FULL_INSTITUTION",
      regionCode: "340000",
      regionName: "安徽省",
      ruleVersion: "v1",
    };
    const created = (await app2.inject({ method: "POST", url: "/api/tasks", payload })).json();
    expect(created.idempotencyResult).toBe("created");
    const id = created.task.id;

    // 等待任务完成（多机构驱动）。
    const deadline = Date.now() + 20_000;
    let statusZh = "";
    while (Date.now() < deadline) {
      const detail = await app2.inject({ method: "GET", url: `/api/tasks/${id}` });
      statusZh = detail.json()?.task?.statusZh ?? "";
      if (statusZh !== "待开始" && statusZh !== "正在准备" && statusZh !== "正在抓取") {
        break;
      }
      await new Promise((r) => setTimeout(r, 200));
    }
    expect(statusZh).toBe("已完成");

    // 机构清单：institution-list.html 有 4 个机构。
    const detail = (await app2.inject({ method: "GET", url: `/api/tasks/${id}` })).json();
    expect(detail.task.statusZh).toBe("已完成");

    // 结果：每机构两槽位。
    const results = (await app2.inject({ method: "GET", url: `/api/tasks/${id}/results` })).json();
    expect(results.length).toBeGreaterThanOrEqual(8); // ≥4 机构 × 2 槽位
  }, 60_000);
});

describe("多行政区模式（regionCodes）", () => {
  let app3: FastifyInstance;
  let pg3: StartedPostgres;
  let db3: ReturnType<typeof createDb>;
  let fixture3: Awaited<ReturnType<typeof createFixtureServer>>;

  beforeAll(async () => {
    // 独立 postgres 容器与 fixture，避免与其他 describe 共享状态污染。
    pg3 = await startPostgres();
    db3 = createDb(pg3.config);
    await migrateToLatest(db3);
    fixture3 = await createFixtureServer([
      { pathPrefix: "/golden", dir: join(import.meta.dirname, "../../../packages/crawler/src/golden") },
      { pathPrefix: "/discovery", dir: join(import.meta.dirname, "../../../packages/crawler/src/discovery/golden") },
    ]);
    const testAdapter = {
      siteId: "test",
      hosts: ["localhost"],
      institutionList: { url: `${fixture3.url}/discovery/institution-list.html`, selector: ".list a" },
      leadershipList: null,
      memberDetail: null,
      roles: { primaryKeywords: [], secondaryKeywords: [] },
    };
    app3 = await buildApp({
      db: db3,
      fixtureUrl: fixture3.url,
      egressMode: "offline-fixture",
      fixturePort: fixture3.basePort,
      adapter: testAdapter,
    });
    await app3.listen({ port: 0, host: "127.0.0.1" });
  });

  afterAll(async () => {
    await app3.close();
    await fixture3.close();
    await db3.destroy();
    await pg3.stop();
  });

  it("行政区查询 API：树与子级", async () => {
    const tree = (await app3.inject({ method: "GET", url: "/api/regions/tree" })).json();
    expect(Array.isArray(tree)).toBe(true);
    expect(tree.length).toBeGreaterThan(10); // 省 + 16 地市
    const children = (await app3.inject({ method: "GET", url: "/api/regions/children?parent=340000" })).json();
    expect(children.length).toBe(16);
    expect(children.some((c: { name: string }) => c.name.includes("合肥"))).toBe(true);
  });

  it("POST /api/tasks regionCodes → 多行政区冻结 → 结果", async () => {
    const payload = {
      clientIdempotencyKey: "multi-region-api-key-0001",
      mode: "FULL_INSTITUTION",
      regionCodes: ["340100", "340200"],
      expandLevel: "COUNTY",
      ruleVersion: "v1",
    };
    const created = (await app3.inject({ method: "POST", url: "/api/tasks", payload })).json();
    expect(created.idempotencyResult).toBe("created");
    const id = created.task.id;

    // 等待完成。
    const deadline = Date.now() + 30_000;
    let statusZh = "";
    while (Date.now() < deadline) {
      const detail = await app3.inject({ method: "GET", url: `/api/tasks/${id}` });
      statusZh = detail.json()?.task?.statusZh ?? "";
      if (statusZh !== "待开始" && statusZh !== "正在准备" && statusZh !== "正在抓取") {
        break;
      }
      await new Promise((r) => setTimeout(r, 200));
    }
    expect(statusZh).toBe("已完成");

    const results = (await app3.inject({ method: "GET", url: `/api/tasks/${id}/results` })).json() as Array<{ regionCode: string }>;
    expect(results.length).toBeGreaterThan(0); // 有结果（区县机构发现数量因 fixture 而定）
    // 展开后结果含合肥（3401xx）前缀的区县。
    const regionCodes = new Set(results.map((r: { regionCode: string }) => r.regionCode));
    const hasHefei = [...regionCodes].some((c: string) => c.startsWith("3401"));
    expect(hasHefei).toBe(true);
  }, 60_000);
});

describe("任务控制 API（暂停/继续/取消/复制）", () => {
  let app4: FastifyInstance;

  beforeAll(async () => {
    // 复用顶层 db/fixture，用 testAdapter（多行政区机构发现指向 /discovery fixture）。
    const testAdapter = {
      siteId: "test",
      hosts: ["localhost"],
      institutionList: { url: `${fixture.url}/discovery/institution-list.html`, selector: ".list a" },
      leadershipList: null,
      memberDetail: null,
      roles: { primaryKeywords: [], secondaryKeywords: [] },
    };
    app4 = await buildApp({
      db,
      fixtureUrl: fixture.url,
      egressMode: "offline-fixture",
      fixturePort: fixture.basePort,
      adapter: testAdapter,
    });
    await app4.listen({ port: 0, host: "127.0.0.1" });
  });

  afterAll(async () => {
    await app4.close();
  });

  it("POST /api/tasks/:id/pause → 任务 PAUSED；resume → 任务最终完成", async () => {
    // 用多行政区任务（机构发现 + 多机构链路耗时较长，便于在运行中暂停）。
    const payload = {
      clientIdempotencyKey: "tc-api-pause-key-0001",
      mode: "FULL_INSTITUTION",
      regionCodes: ["340100", "340200"],
      expandLevel: "COUNTY",
      ruleVersion: "v1",
    };
    const created = (await app4.inject({ method: "POST", url: "/api/tasks", payload })).json();
    const id = created.task.id;

    // 等待任务进入 CRAWLING（正在抓取），再暂停。
    let status = "";
    const deadline = Date.now() + 15_000;
    while (Date.now() < deadline) {
      status = (await app4.inject({ method: "GET", url: `/api/tasks/${id}` })).json()?.task?.status ?? "";
      if (status === "CRAWLING") break;
      await new Promise((r) => setTimeout(r, 100));
    }
    expect(status).toBe("CRAWLING");

    const paused = await app4.inject({ method: "POST", url: `/api/tasks/${id}/pause` });
    expect(paused.statusCode).toBe(200);
    expect(paused.json().ok).toBe(true);
    expect(paused.json().task.status).toBe("PAUSED");

    const resumed = await app4.inject({ method: "POST", url: `/api/tasks/${id}/resume` });
    expect(resumed.statusCode).toBe(200);
    expect(resumed.json().ok).toBe(true);

    // 等待完成。
    const d2 = Date.now() + 30_000;
    let statusZh = "";
    while (Date.now() < d2) {
      const detail = await app4.inject({ method: "GET", url: `/api/tasks/${id}` });
      statusZh = detail.json()?.task?.statusZh ?? "";
      if (statusZh !== "待开始" && statusZh !== "正在准备" && statusZh !== "正在抓取") {
        break;
      }
      await new Promise((r) => setTimeout(r, 200));
    }
    expect(statusZh).toBe("已完成");
  }, 90_000);

  it("POST /api/tasks/:id/cancel → CANCELLED；duplicate → 新任务；终态不可再控制", async () => {
    const payload = {
      clientIdempotencyKey: "tc-api-cancel-key-0001",
      mode: "FULL_INSTITUTION",
      regionCode: "340000",
      regionName: "安徽省",
      ruleVersion: "v1",
    };
    const created = (await app4.inject({ method: "POST", url: "/api/tasks", payload })).json();
    const id = created.task.id;

    const cancelled = await app4.inject({ method: "POST", url: `/api/tasks/${id}/cancel` });
    expect(cancelled.statusCode).toBe(200);
    expect(cancelled.json().ok).toBe(true);
    expect(cancelled.json().task.status).toBe("CANCELLED");

    // 已取消任务不能继续。
    const resumeCancelled = await app4.inject({ method: "POST", url: `/api/tasks/${id}/resume` });
    expect(resumeCancelled.json().ok).toBe(false);

    // 可复制为新任务。
    const dup = await app4.inject({ method: "POST", url: `/api/tasks/${id}/duplicate` });
    expect(dup.statusCode).toBe(200);
    expect(dup.json().ok).toBe(true);
    expect(dup.json().newTaskId).toBeTruthy();
    expect(dup.json().newTaskId).not.toBe(id);
  }, 30_000);

  it("任务详情含 controlable 字段", async () => {
    const created = (await app.inject({ method: "POST", url: "/api/tasks", payload: validCreate })).json();
    const id = created.task.id;
    const detail = await app.inject({ method: "GET", url: `/api/tasks/${id}` });
    expect(typeof detail.json().task.controlable).toBe("boolean");
  }, 30_000);
});

describe("P3 任务列表端点（GET /api/tasks）", () => {
  it("默认返回最近任务（降序）且含 total", async () => {
    // 先创建 3 个任务，再查列表。
    for (let i = 0; i < 3; i++) {
      await app.inject({
        method: "POST",
        url: "/api/tasks",
        payload: { ...validCreate, clientIdempotencyKey: `p3-list-${i}-${Date.now()}` },
      });
    }
    const res = await app.inject({ method: "GET", url: "/api/tasks" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body.tasks)).toBe(true);
    expect(body.tasks.length).toBeGreaterThanOrEqual(3);
    expect(typeof body.total).toBe("number");
    expect(body.total).toBeGreaterThanOrEqual(3);
    // 降序：第 0 个 requestedAt >= 第 1 个。
    const first = body.tasks[0].requestedAt;
    const second = body.tasks[1].requestedAt;
    expect(new Date(first).getTime()).toBeGreaterThanOrEqual(new Date(second).getTime());
  }, 30_000);

  it("limit/offset 分页生效", async () => {
    const page1 = (await app.inject({ method: "GET", url: "/api/tasks?limit=2&offset=0" })).json();
    const page2 = (await app.inject({ method: "GET", url: "/api/tasks?limit=2&offset=2" })).json();
    expect(page1.tasks.length).toBe(2);
    expect(page2.tasks.length).toBeGreaterThanOrEqual(0);
    // 两页无重叠 id。
    const ids1 = new Set(page1.tasks.map((t: { id: string }) => t.id));
    const ids2 = new Set(page2.tasks.map((t: { id: string }) => t.id));
    for (const id of ids2) expect(ids1.has(id)).toBe(false);
  }, 30_000);

  it("status/mode 筛选生效且 total 一致", async () => {
    // 创建 1 个 TARGETED 任务（fixture 回放后 COMPLETED）。
    const created = (await app.inject({
      method: "POST",
      url: "/api/tasks",
      payload: { ...validCreate, clientIdempotencyKey: `p3-filter-${Date.now()}` },
    })).json();
    const id = created.task.id;
    await waitForTaskCompletion(id);

    const res = await app.inject({ method: "GET", url: "/api/tasks?status=COMPLETED&mode=TARGETED" });
    const body = res.json();
    expect(body.tasks.every((t: { status: string; mode: string }) => t.status === "COMPLETED" && t.mode === "TARGETED")).toBe(true);
    expect(body.total).toBe(body.tasks.length);
    expect(body.tasks.some((t: { id: string }) => t.id === id)).toBe(true);
  }, 30_000);

  it("limit 上限 100，非法参数被钳制", async () => {
    const res = await app.inject({ method: "GET", url: "/api/tasks?limit=9999" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.tasks.length).toBeLessThanOrEqual(100);
  }, 30_000);
});

describe("R-37 缺入口自动补全容错（真实安徽适配器）", () => {
  let app5: FastifyInstance;

  beforeAll(async () => {
    // 复用顶层 db/fixture，加载真实安徽适配器（R-37 补配后 29 机构）。
    const { loadAdapter } = await import("@stellaris/crawler/adapter/loader.js");
    app5 = await buildApp({
      db,
      fixtureUrl: fixture.url,
      egressMode: "offline-fixture",
      fixturePort: fixture.basePort,
      adapter: loadAdapter("anhui-provincial-government"),
    });
    await app5.listen({ port: 0, host: "127.0.0.1" });
  });

  afterAll(async () => {
    await app5.close();
  });

  /** 创建 TARGETED 任务，读回机构快照的 officialEntryUrl（POST 时同步写入，无需等驱动）。 */
  async function createTargetedEntryUrl(name: string): Promise<string | null> {
    const payload = {
      clientIdempotencyKey: `r37-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      regionCode: "340000",
      regionName: "安徽省",
      institutionName: name,
      institutionType: "government",
      ruleVersion: "v1",
    };
    const res = await app5.inject({ method: "POST", url: "/api/tasks", payload });
    expect(res.statusCode).toBe(200);
    const id = res.json().task.id;
    const detail = (await app5.inject({ method: "GET", url: `/api/tasks/${id}` })).json();
    return detail?.institution?.officialEntryUrl ?? null;
  }

  it("空入口 + 精确全名（省公安厅）→ 补全 gat.ah.gov.cn", async () => {
    const url = await createTargetedEntryUrl("省公安厅");
    expect(url).toBe("https://gat.ah.gov.cn/");
  });

  it("空入口 + 全名前缀（安徽省公安厅）→ 归一化后补全", async () => {
    const url = await createTargetedEntryUrl("安徽省公安厅");
    expect(url).toBe("https://gat.ah.gov.cn/");
  });

  it("空入口 + 前导空格（ 安徽省人民政府）→ trim 后补全", async () => {
    const url = await createTargetedEntryUrl("  安徽省人民政府");
    expect(url).toBe("https://www.ah.gov.cn/szf/index.html");
  });

  it("未适配机构（省民宗委）→ 不误配，入口保持空且任务正常终态（R-37 空入口修复）", async () => {
    const url = await createTargetedEntryUrl("省民宗委");
    expect(url).toBeNull();
    // 空入口分支应 COMPLETED（此前漏 complete() 永久卡 CRAWLING）。
    const payload = {
      clientIdempotencyKey: `r37-unmatched-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      regionCode: "340000",
      regionName: "安徽省",
      institutionName: "省民宗委",
      institutionType: "government",
      ruleVersion: "v1",
    };
    const created = (await app5.inject({ method: "POST", url: "/api/tasks", payload })).json();
    const id = created.task.id;
    const deadline = Date.now() + 15_000;
    let statusZh = "";
    while (Date.now() < deadline) {
      const detail = await app5.inject({ method: "GET", url: `/api/tasks/${id}` });
      statusZh = detail.json()?.task?.statusZh ?? "";
      if (statusZh !== "待开始" && statusZh !== "正在抓取") break;
      await new Promise((r) => setTimeout(r, 200));
    }
    expect(statusZh).toBe("已完成");
    // fixture 模式：空入口回退 fixture 集合页回放（非「受限」），同样证明任务不再卡 CRAWLING。
    const results = (await app5.inject({ method: "GET", url: `/api/tasks/${id}/results` })).json();
    expect(results.length).toBe(2);
  }, 30_000);
});
