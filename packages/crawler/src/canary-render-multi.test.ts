import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { chromium, type Browser } from "playwright";

/**
 * R-13 Canary: 机构列表页动态加载验证（Playwright 渲染）。
 * 结论依据：zfjg_lmcon 容器 HTTP 返回为空 → 机构列表 JS 动态加载 → 需浏览器升级。
 */
describe("R-13 机构列表动态渲染", () => {
  let browser: Browser;
  beforeAll(async () => {
    browser = await chromium.launch({ headless: true });
  });
  afterAll(async () => {
    await browser.close();
  });

  it("渲染机构列表页后抽取真实机构", async () => {
    const context = await browser.newContext({
      userAgent: "stellaris-crawler/0.1 (research; contact: local)",
      viewport: { width: 1280, height: 900 },
    });
    const page = await context.newPage();
    await page.route("**/*", (route) => {
      const type = route.request().resourceType();
      if (["image", "font", "media"].includes(type)) {
        void route.abort();
      } else {
        void route.continue();
      }
    });
    await page.goto("https://www.ah.gov.cn/site/tpl/2121", { waitUntil: "domcontentloaded", timeout: 30_000 });
    await page.waitForTimeout(3000);

    const bodyText = (await page.locator("body").innerText()).replace(/\s+/g, " ").slice(0, 800);
    process.stdout.write(`\n[R13] 渲染后机构列表页 body:\n${bodyText}\n`);

    // 断言：渲染后应出现真实机构名称（发改委/教育厅/公安厅等）。
    const hasInstitution = /委员会|教育厅|公安厅|财政厅|交通运输厅|卫生健康/.test(bodyText);
    process.stdout.write(`[R13] 渲染命中机构名称=${hasInstitution}\n`);
    expect(hasInstitution).toBe(true);
    await context.close();
  }, 60_000);
});
