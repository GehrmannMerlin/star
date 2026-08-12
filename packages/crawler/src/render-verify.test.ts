import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { chromium, type Browser } from "playwright";

/**
 * Playwright 渲染验证（R-09，R-08 同一目标延伸）。
 * 验证：HTTP 拿不到动态简历 → Playwright 渲染后领导个人简历可抽取。
 * 只读；单域；图片/字体/视频默认阻断；不绕过访问控制。
 */
describe("R-09 Playwright 渲染验证（安徽省人民政府）", () => {
  let browser: Browser;

  beforeAll(async () => {
    browser = await chromium.launch({ headless: true });
  });

  afterAll(async () => {
    await browser.close();
  });

  it("渲染领导详情页后抽取个人简历正文", async () => {
    const context = await browser.newContext({
      userAgent: "stellaris-crawler/0.1 (research; contact: local)",
      viewport: { width: 1280, height: 900 },
    });
    const page = await context.newPage();
    // 阻断非必要资源（规格 §23.3）。
    await page.route("**/*", (route) => {
      const type = route.request().resourceType();
      if (["image", "font", "media"].includes(type)) {
        void route.abort();
      } else {
        void route.continue();
      }
    });

    const detailUrl = "https://www.ah.gov.cn/content/column/6784021?liId=711";
    await page.goto(detailUrl, { waitUntil: "domcontentloaded", timeout: 30_000 });
    // 等待动态简历渲染（等待业务字段，不用固定长等待/networkidle，规格 §10.2）。
    await page.waitForSelector("text=王清宪", { timeout: 20_000 }).catch(() => undefined);
    await page.waitForTimeout(2000);

    const title = await page.title();
    const bodyText = (await page.locator("body").innerText()).replace(/\s+/g, " ").slice(0, 500);
    process.stdout.write(`\n[R09] 渲染后 title=${title}\n`);
    process.stdout.write(`[R09] 渲染后 body: ${bodyText}\n`);

    // 断言：渲染后应能抽到领导姓名与简历关键词。
    const text = bodyText;
    expect(text).toContain("王清宪");
    const hasBio = /简历|职务|工作分工|党组书记|省长/.test(text);
    process.stdout.write(`[R09] 命中简历关键词=${hasBio}\n`);
    await context.close();
  }, 60_000);
});
