import { chromium, type Browser, type Page } from "playwright";

/**
 * 进程内浏览器池（规格 §10.2 / §11.2 / §23.3）。
 * - 仅在 HTTP 事实不足且升级条件成立时使用；
 * - 浏览器页面上限 2-4；
 * - 图片/字体/视频默认阻断；
 * - 等待明确 DOM/业务字段信号，不用固定长等待/networkidle；
 * - 浏览器只做只读渲染，不登录、不绕过访问控制。
 */

export interface RenderResult {
  fetchUrl: string;
  title: string | null;
  bodyText: string;
  html: Uint8Array;
  waitSignals: string[];
  statusCode: number;
}

export interface RenderOptions {
  waitSelector?: string;
  /** 礼貌并发闸：acquire/release 站点并发（P1）。 */
  politeness?: import("../polite/politeness.js").PolitenessGate;
  /** 调用方 AbortSignal：中止时关闭当前 context，停止 navigation。 */
  signal?: AbortSignal;
}

export interface BrowserPoolOptions {
  maxPages?: number;
}

/** Chromium executable：优先环境变量覆盖，否则用项目锁定 Playwright 的默认路径。 */
export function resolveChromiumExecutablePath(): string {
  const envPath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?.trim();
  return envPath || chromium.executablePath();
}

export class BrowserPool {
  private browser: Browser | null = null;
  private readonly maxPages: number;

  constructor(opts: BrowserPoolOptions = {}) {
    this.maxPages = opts.maxPages ?? 2;
  }

  /** 是否已启动浏览器进程（smoke/doctor 用）。 */
  isOpen(): boolean {
    return this.browser !== null;
  }

  private async getBrowser(): Promise<Browser> {
    if (!this.browser) {
      const executablePath = resolveChromiumExecutablePath();
      this.browser = await chromium.launch({
        headless: true,
        ...(executablePath ? { executablePath } : {}),
      });
    }
    return this.browser;
  }

  /**
   * 渲染 URL 并返回页面事实。
   * 等待 waitSelector（明确 DOM 信号）或超时；bodyText 为渲染后正文。
   * signal 中止时关闭当前 context（停止 navigation）并在外层 finally 释放。
   */
  async render(url: string, opts: RenderOptions = {}): Promise<RenderResult> {
    const releaseGate = opts.politeness ? await opts.politeness.acquire(new URL(url).host) : null;
    try {
      if (opts.signal?.aborted) {
        throw new Error("render aborted");
      }
      const browser = await this.getBrowser();
      const context = await browser.newContext({
        userAgent: "stellaris-crawler/0.1 (research; contact: local)",
        viewport: { width: 1280, height: 900 },
      });
      const onAbort = () => {
        void context.close().catch(() => {});
      };
      opts.signal?.addEventListener("abort", onAbort, { once: true });
      try {
        const page: Page = await context.newPage();
        try {
          // 阻断非必要资源（规格 §23.3）。
          await page.route("**/*", (route) => {
            const type = route.request().resourceType();
            if (["image", "font", "media"].includes(type)) {
              void route.abort();
            } else {
              void route.continue();
            }
          });

          const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });

          // 等待明确业务字段信号（规格 §10.2：不用固定长等待/networkidle）。
          const waitSignals: string[] = [];
          if (opts.waitSelector) {
            const found = await page.waitForSelector(opts.waitSelector, { timeout: 15_000 }).catch(() => null);
            if (found) {
              waitSignals.push(opts.waitSelector);
            }
          }

          const title = await page.title().catch(() => null);
          const bodyText = (await page.locator("body").innerText().catch(() => "")).replace(/\s+/g, " ").trim();
          const htmlBuffer = await page.content().then((h) => Buffer.from(h, "utf-8")).catch(() => Buffer.alloc(0));

          return {
            fetchUrl: page.url(),
            title,
            bodyText,
            html: new Uint8Array(htmlBuffer),
            waitSignals,
            statusCode: response?.status() ?? 0,
          };
        } finally {
          // 双保险：abort 回调可能已 close，此处幂等关闭。
          await context.close().catch(() => {});
        }
      } finally {
        opts.signal?.removeEventListener("abort", onAbort);
      }
    } finally {
      releaseGate?.();
    }
  }

  /** 关闭浏览器（释放资源）。 */
  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}
