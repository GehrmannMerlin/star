import { isIP } from "node:net";

/**
 * 安全出口策略（规格 §23.1 / §23.2）。
 * - 仅允许 http/https；默认端口 80/443；
 * - 拒绝 URL 用户名/密码、file/data/ftp/javascript/blob/ws；
 * - 拒绝回环/私有/链路本地/组播/保留/云元数据/IPv4 映射 IPv6；
 * - 每次重定向逐跳重新校验（assertRedirectChain）。
 * - offline-fixture 模式：对显式登记测试端口放行（本地金标回放专用）。
 */

export type EgressMode = "offline-fixture" | "production";

export interface SafeEgressPolicy {
  mode: EgressMode;
  allowedPorts: ReadonlySet<number>;
  allowedTestPorts: ReadonlySet<number>;
  maxRedirects: number;
  maxBytes: number;
  maxTimeoutMs: number;
}

export function createSafeEgressPolicy(
  opts: Partial<SafeEgressPolicy> = {},
): SafeEgressPolicy {
  return {
    mode: opts.mode ?? "production",
    allowedPorts: opts.allowedPorts ?? new Set([80, 443]),
    allowedTestPorts: opts.allowedTestPorts ?? new Set(),
    maxRedirects: opts.maxRedirects ?? 5,
    maxBytes: opts.maxBytes ?? 10 * 1024 * 1024,
    maxTimeoutMs: opts.maxTimeoutMs ?? 30_000,
  };
}

const BLOCKED_PROTOCOLS = ["file:", "data:", "ftp:", "javascript:", "blob:", "ws:", "wss:"];

/** 判断 IP 是否属于禁止网段。 */
function isBlockedIp(ip: string): boolean {
  const family = isIP(ip);
  if (family === 0) {
    return false; // 非 IP（hostname 等），DNS 解析后另行校验
  }
  if (family === 4) {
    const parts = ip.split(".").map(Number);
    const [a, b] = parts as [number, number, number, number];
    if (a === 127) return true; // 回环
    if (a === 10) return true; // 私有 10/8
    if (a === 169 && b === 254) return true; // 链路本地/云元数据
    if (a === 172 && b >= 16 && b <= 31) return true; // 私有 172.16/12
    if (a === 192 && b === 168) return true; // 私有 192.168/16
    if (a === 0) return true; // 保留
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    if (a >= 224) return true; // 组播+保留
    if (a === 198 && (b === 18 || b === 19)) return true; // benchmark
    if (a === 192 && b === 0 && parts[2] === 0) return true; // IETF 协议分配
    if (a === 192 && b === 0 && parts[2] === 2) return true; // TEST-NET-1
    if (a === 198 && b === 51 && parts[2] === 100) return true; // TEST-NET-2
    if (a === 203 && b === 0 && parts[2] === 113) return true; // TEST-NET-3
    return false;
  }
  // IPv6
  if (ip === "::1" || ip === "::") return true; // 回环/未指定
  const lower = ip.toLowerCase();
  if (lower.startsWith("fe80")) return true; // 链路本地
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // ULA 私有
  if (lower.startsWith("ff")) return true; // 组播
  if (lower.startsWith("::ffff:") || lower.startsWith("64:ff9b")) return true; // 映射/嵌入
  return false;
}

/** 校验单个 URL 的协议、端口与主机地址（production 模式下 DNS/IP 逐项拒绝）。 */
export function assertAllowedUrl(url: string, policy: SafeEgressPolicy): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`非法 URL: ${url}`);
  }

  if (BLOCKED_PROTOCOLS.includes(parsed.protocol)) {
    throw new Error(`禁止的协议: ${parsed.protocol}`);
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`仅允许 http/https: ${parsed.protocol}`);
  }
  if (parsed.username || parsed.password) {
    throw new Error("URL 不得包含用户名/密码");
  }

  const host = parsed.hostname.replace(/^\[|\]$/g, ""); // 剥离 IPv6 括号
  const port = parsed.port === "" ? (parsed.protocol === "https:" ? 443 : 80) : Number(parsed.port);

  if (policy.mode === "production") {
    if (!policy.allowedPorts.has(port)) {
      throw new Error(`非默认端口被拒: ${port}`);
    }
    // 字面 IP 直接校验；hostname 场景由调用方在 DNS 解析后再次调用校验。
    if (isIP(host)) {
      if (isBlockedIp(host)) {
        throw new Error(`禁止的地址段: ${host}`);
      }
    } else {
      if (host === "localhost") {
        throw new Error("禁止 localhost");
      }
      if (host.endsWith(".local") || host === "metadata.google.internal") {
        throw new Error("禁止保留主机名");
      }
    }
  } else {
    // offline-fixture：只放行显式登记的测试端口。
    if (!policy.allowedTestPorts.has(port)) {
      throw new Error(`测试端口未登记: ${port}`);
    }
  }
}

/** 重定向链逐跳复核：每一跳重新校验。 */
export function assertRedirectChain(urls: string[], policy: SafeEgressPolicy): void {
  if (urls.length > policy.maxRedirects) {
    throw new Error(`重定向上限 ${policy.maxRedirects} 被超`);
  }
  for (const u of urls) {
    assertAllowedUrl(u, policy);
  }
}

/** 校验解析后的 IP（供 DNS 解析后再次确认）。 */
export function assertResolvedIp(ip: string, policy: SafeEgressPolicy): void {
  if (policy.mode === "production" && isBlockedIp(ip)) {
    throw new Error(`DNS 解析到禁止地址: ${ip}`);
  }
}
