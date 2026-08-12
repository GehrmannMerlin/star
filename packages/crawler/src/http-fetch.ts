import { createHash } from "node:crypto";
import http from "node:http";
import https from "node:https";
import { dnsLookup } from "./dns-lookup.js";
import { assertAllowedUrl, assertRedirectChain, type SafeEgressPolicy } from "./safe-egress.js";
import type { PolitenessGate } from "./polite/politeness.js";
import type { HttpCache } from "./http-cache.js";

/** 分页陷阱防护：URL 路径深度上限（P6-T3）。 */
const MAX_PATH_DEPTH = 8;

/** 超限响应错误（规格 §23.3 资源上限）。 */
export class OversizedResponseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OversizedResponseError";
  }
}

/**
 * HTTP 抓取上下文（P1 性能接入，规格 §11）。
 * 可选；缺省时行为与既有版本一致（向后兼容）。
 */
export interface FetchContext {
  /** 礼貌并发闸：acquire/release 站点+全局并发。 */
  politeness?: PolitenessGate;
  /** HTTP 内存缓存：命中直接返回正文。 */
  cache?: HttpCache;
  /** 绕过缓存直连（Reviewer 复验必须 true，§5.3）。 */
  cacheBypass?: boolean;
  /** 抓取结果回调（画像更新挂钩）。 */
  onFetch?: (info: { host: string; ok: boolean; durationMs: number; status: number; retryAfterMs?: number }) => void;
}

export interface HttpResponse {
  fetchUrl: string;
  originalUrl: string;
  canonicalKey: string;
  status: number;
  headers: Record<string, string>;
  body: Uint8Array;
  redirectChain: string[];
}

/** 去掉显式追踪参数（业务/签名/顺序敏感参数保留），生成去重键。 */
function canonicalKeyFor(url: string): string {
  const parsed = new URL(url);
  const TRACKING = new Set(["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "spm", "from"]);
  const params = parsed.searchParams;
  for (const key of Array.from(params.keys())) {
    if (TRACKING.has(key.toLowerCase())) {
      params.delete(key);
    }
  }
  parsed.search = params.toString();
  parsed.hash = "";
  return `${parsed.protocol}//${parsed.host}${parsed.pathname}${parsed.search}`;
}

/** Node http(s) 请求的 lookup 签名（DNS-pinned SSRF 防护）。 */
function makeLookup(
  policy: SafeEgressPolicy,
): (
  hostname: string,
  options: { family?: number | "IPv4" | "IPv6" },
  callback: (err: NodeJS.ErrnoException | null, address: string | { address: string; family: number }[], family?: number) => void,
) => void {
  return (hostname, options, callback) => {
    void (async () => {
      try {
        const familyNum = options.family === 6 || options.family === "IPv6" ? 6 : options.family === 4 || options.family === "IPv4" ? 4 : undefined;
        const addresses = await dnsLookup(hostname, policy, familyNum);
        const first = addresses[0];
        if (!first) {
          callback(new Error(`DNS 解析无可用地址: ${hostname}`), "");
          return;
        }
        callback(null, first.address, first.family);
      } catch (err) {
        callback(err instanceof Error ? (err as NodeJS.ErrnoException) : new Error(String(err)), "");
      }
    })();
  };
}

/**
 * HTTP 优先抓取（规格 §10.1 / §23）。
 * - 请求前 assertAllowedUrl；逐跳重定向重新校验；
 * - DNS-pinned：用 node:http(s) 的自定义 lookup 解析全部 A/AAAA 并逐项校验
 *   （拒绝私网/元数据 IP），单连接内固定解析结果；
 * - HTTPS 自动使用原始 hostname 做 SNI 与证书校验；
 * - 超过 maxRedirects 拒绝；超过 maxBytes 抛 OversizedResponseError。
 */
export async function httpFetch(url: string, policy: SafeEgressPolicy, ctx?: FetchContext): Promise<HttpResponse> {
  const originalUrl = url;
  assertAllowedUrl(url, policy);
  const host = new URL(url).host;
  const started = Date.now();
  const retryAfterMs = 0;
  const releaseGate = ctx?.politeness ? await ctx.politeness.acquire(host) : null;

  // P6-T3 无限分页防护：URL 路径深度超限（分页递归陷阱）→ 拒绝。
  const parsedUrl = new URL(url);
  const pathDepth = parsedUrl.pathname.split("/").filter(Boolean).length;
  if (pathDepth > MAX_PATH_DEPTH) {
    throw new Error(`分页陷阱：URL 路径深度 ${pathDepth} 超过上限 ${MAX_PATH_DEPTH}`);
  }

  try {
    // 缓存命中（非 bypass）：直接返回正文（非真实网络事件，不触发 onFetch 画像更新）。
    const cacheKey = canonicalKeyFor(url);
    if (ctx?.cache && !ctx.cacheBypass) {
      const cached = ctx.cache.get(cacheKey);
      if (cached) {
        return {
          fetchUrl: url,
          originalUrl,
          canonicalKey: cacheKey,
          status: 200,
          headers: {},
          body: cached,
          redirectChain: [url],
        };
      }
    }

    let currentUrl = url;
    const redirectChain: string[] = [];
    const lookup = makeLookup(policy);

    // 逐跳循环（不依赖客户端的 auto-redirect，保证每跳重新校验）。
    for (let hop = 0; hop <= policy.maxRedirects; hop++) {
      const parsed = new URL(currentUrl);
      const isHttps = parsed.protocol === "https:";
      const port = parsed.port === "" ? (isHttps ? 443 : 80) : Number(parsed.port);

      const requestFn = isHttps ? https.request : http.request;
      const response = await new Promise<http.IncomingMessage>((resolve, reject) => {
        const req = requestFn(
          {
            protocol: parsed.protocol,
            hostname: parsed.hostname,
            port,
            path: `${parsed.pathname}${parsed.search}`,
            method: "GET",
            headers: { "User-Agent": "stellaris-crawler/0.1 (research; contact: local)" },
            lookup,
            // 禁用 autoSelectFamily：DNS-pinned 方案需要固定单一解析结果，避免 Node 双栈协商触发非法地址。
            autoSelectFamily: false,
            timeout: policy.maxTimeoutMs,
          } as http.RequestOptions & { autoSelectFamily?: boolean },
          (res) => resolve(res),
        );
        req.on("timeout", () => {
          req.destroy(new Error(`请求超时: ${currentUrl}`));
        });
        req.on("error", (err) => reject(err));
        req.end();
      });

      const status = response.statusCode ?? 0;
      const headerRecord: Record<string, string> = {};
      for (const [k, v] of Object.entries(response.headers)) {
        if (v !== undefined) {
          headerRecord[k] = Array.isArray(v) ? v.join(", ") : v;
        }
      }

      // 429/503：记录退避（画像/并发闸）。
      if (status === 429 || status === 503) {
        const retryAfter = response.headers["retry-after"];
        const retryAfterNum = retryAfter ? Number(retryAfter) * 1000 || undefined : undefined;
        ctx?.politeness?.recordError(host, status, retryAfterNum);
        ctx?.onFetch?.({ host, ok: false, durationMs: Date.now() - started, status, ...(retryAfterNum !== undefined ? { retryAfterMs: retryAfterNum } : {}) });
      }

      if (status >= 300 && status < 400) {
        const location = response.headers.location;
        if (!location) {
          throw new Error(`重定向无 Location: ${currentUrl}`);
        }
        const next = new URL(location, currentUrl).toString();
        redirectChain.push(currentUrl);
        // 逐跳复核下一跳（DNS 会在下一跳循环中重新解析校验）。
        assertRedirectChain([...redirectChain, next], policy);
        currentUrl = next;
        continue;
      }

      // 读取正文并限制大小（规格 §23.3）。
      // P6-T3 压缩炸弹防护：压缩响应在解压后仍超限 → 抛错（防 gzip 炸弹）。压缩比上限防护。
      const encoding = (response.headers["content-encoding"] ?? "").toLowerCase();
      const isCompressed = /gzip|deflate|br/.test(encoding);
      // 压缩响应：原始大小上限收紧（压缩比 ≤10 视为安全；超过即解压检测）。
      const compressedLimit = isCompressed ? Math.ceil(policy.maxBytes / 3) : policy.maxBytes;
      const chunks: Buffer[] = [];
      let total = 0;
      for await (const chunk of response) {
        const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        total += buf.byteLength;
        if (total > policy.maxBytes) {
          response.destroy();
          throw new OversizedResponseError(`响应超过 ${policy.maxBytes} 字节上限`);
        }
        if (isCompressed && total > compressedLimit) {
          // 压缩原始已异常大：解压探测，确认是否压缩炸弹。
          try {
            const { unzipSync, brotliDecompressSync } = await import("node:zlib");
            const inflated = encoding.includes("br")
              ? brotliDecompressSync(Buffer.concat(chunks))
              : unzipSync(Buffer.concat(chunks));
            if (inflated.byteLength > policy.maxBytes) {
              response.destroy();
              throw new OversizedResponseError(`压缩炸弹：解压后 ${inflated.byteLength} 字节超上限`);
            }
          } catch (err) {
            if (err instanceof OversizedResponseError) throw err;
            // 解压失败（非压缩流或损坏）→ 不阻断，以原始大小为准。
          }
        }
        chunks.push(buf);
      }
      const body = new Uint8Array(total);
      let offset = 0;
      for (const chunk of chunks) {
        body.set(new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.byteLength), offset);
        offset += chunk.byteLength;
      }

      // 写入缓存（非 bypass、2xx 才缓存；no-store 不缓存）。
      const cacheControl = headerRecord["cache-control"] ?? "";
      if (ctx?.cache && !ctx.cacheBypass && status >= 200 && status < 300 && !/no-store/i.test(cacheControl)) {
        ctx.cache.set(cacheKey, body);
      }
      ctx?.onFetch?.({ host, ok: status >= 200 && status < 300, durationMs: Date.now() - started, status, retryAfterMs });

      redirectChain.push(currentUrl);
      return {
        fetchUrl: currentUrl,
        originalUrl,
        canonicalKey: cacheKey,
        status,
        headers: headerRecord,
        body,
        redirectChain,
      };
    }

    throw new Error(`重定向上限 ${policy.maxRedirects} 被超`);
  } finally {
    releaseGate?.();
  }
}

/** 供证据库直接使用的内容哈希。 */
export function hashContent(raw: Uint8Array): string {
  return createHash("sha256").update(raw).digest("hex");
}
