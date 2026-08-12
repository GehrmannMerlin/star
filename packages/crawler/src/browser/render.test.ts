import { describe, it, expect, afterAll } from "vitest";
import { join } from "node:path";
import { BrowserPool } from "./render.js";
import { createFixtureServer } from "../testing/fixture-server.js";

describe("进程内浏览器池", () => {
  let pool: BrowserPool;
  afterAll(async () => {
    if (pool) await pool.close();
  });

  it("渲染本地动态页并抽取正文", async () => {
    pool = new BrowserPool({ maxPages: 2 });
    const srv = await createFixtureServer([{ pathPrefix: "/golden", dir: join(import.meta.dirname, "golden") }]);
    const res = await pool.render(`${srv.url}/golden/dynamic.html`, { waitSelector: ".bio" });
    expect(res.title).toContain("王清宪");
    expect(res.bodyText).toContain("王清宪");
    expect(res.bodyText).toContain("省委副书记、省长");
    expect(res.waitSignals).toContain(".bio");
    expect(res.html.byteLength).toBeGreaterThan(0);
    await srv.close();
  }, 60_000);
});
