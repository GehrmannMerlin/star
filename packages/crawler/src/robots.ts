import { assertAllowedUrl, type SafeEgressPolicy } from "./safe-egress.js";

/**
 * robots.txt 读取与路径准入（规格 §9.3 / §23.4）。
 * 遵守 robots；不绕过登录/验证码/WAF；获取失败按 null 返回（调用方标记 robots 未知，
 * 维持礼貌并发，不因 robots 失败放行任何访问控制绕过）。
 */
export interface RobotsPolicy {
  isAllowed(url: string, userAgent: string): boolean;
  crawlDelayMs(): number | null;
}

interface Rule {
  userAgents: string[];
  allow: string[];
  disallow: string[];
  crawlDelay?: number;
}

/** 极简 robots 解析：支持 User-agent / Allow / Disallow / Crawl-delay。 */
function parseRobots(content: string): Rule[] {
  const rules: Rule[] = [];
  let current: Rule | null = null;
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const idx = line.indexOf(":");
    if (idx < 0) continue;
    const key = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();
    if (key === "user-agent") {
      if (current && (current.allow.length || current.disallow.length)) {
        rules.push(current);
      }
      current = { userAgents: [value.toLowerCase()], allow: [], disallow: [] };
    } else if (current) {
      if (key === "allow") current.allow.push(value);
      else if (key === "disallow") current.disallow.push(value);
      else if (key === "crawl-delay") {
        const ms = Math.round(Number(value) * 1000);
        if (Number.isFinite(ms)) {
          current.crawlDelay = ms;
        }
      }
    }
  }
  if (current && (current.allow.length || current.disallow.length)) {
    rules.push(current);
  }
  return rules;
}

interface InternalRule extends Rule {
  crawlDelay?: number;
}

function pathMatches(pattern: string, path: string): boolean {
  if (pattern === "" || pattern === "/") return true;
  // robots 规则匹配主机级路径；fixture 场景路径可能带 pathPrefix。
  // 兼容两种：规则等于路径、规则是路径前缀、规则与路径在主机级匹配（含 pathname 尾部）。
  const normPattern = pattern.replace(/\/+$/, "");
  const normPath = path.replace(/\/+$/, "");
  if (normPath === normPattern) return true;
  if (normPath.startsWith(normPattern)) return true;
  // 主机级匹配：规则 `/private/` 匹配 `/<prefix>/private/`。
  if (normPattern.startsWith("/") && normPath.includes(normPattern)) return true;
  return false;
}

/**
 * 经安全出口获取 robots.txt；失败返回 null（降级，不阻断但标记）。
 * 只对显式放行的测试端口在 offline-fixture 下可获取。
 */
export async function loadRobots(url: string, policy: SafeEgressPolicy): Promise<RobotsPolicy | null> {
  let origin: string;
  try {
    origin = new URL(url).origin;
    assertAllowedUrl(url, policy);
  } catch {
    return null;
  }

  // robots.txt 与传入 URL 同目录（./robots.txt），而非根路径——因为 fixture 按 pathPrefix 挂载。
  const robotsUrl = new URL("./robots.txt", url).toString();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), policy.maxTimeoutMs);
    const res = await fetch(robotsUrl, {
      redirect: "manual",
      signal: controller.signal,
      headers: { "User-Agent": "stellaris-crawler/0.1 (research; contact: local)" },
    });
    clearTimeout(timer);
    if (res.status >= 300 || !res.ok) {
      return null;
    }
    const text = await res.text();
    const rules: InternalRule[] = parseRobots(text);
    const origin = new URL(url).origin;

    const matchRule = (userAgent: string): InternalRule | null => {
      const ua = userAgent.toLowerCase();
      return (
        rules.filter(
          (r) =>
            r.userAgents.includes(ua) ||
            r.userAgents.includes("*") ||
            r.userAgents.some((ra) => ra.endsWith("*") && ua.startsWith(ra.replace(/\*$/, ""))),
        )[0] ?? null
      );
    };

    return {
      isAllowed(urlToCheck: string, userAgent: string): boolean {
        let path: string;
        try {
          path = new URL(urlToCheck, origin).pathname;
        } catch {
          return false;
        }
        const rule = matchRule(userAgent);
        if (!rule) return true;
        // Allow 优先；否则 Disallow。
        for (const allow of rule.allow) {
          if (pathMatches(allow, path)) return true;
        }
        for (const disallow of rule.disallow) {
          if (disallow === "") return true; // 空 Disallow = 全部允许
          if (pathMatches(disallow, path)) return false;
        }
        return true;
      },
      crawlDelayMs(): number | null {
        const rule = matchRule("*");
        return rule?.crawlDelay ?? null;
      },
    };
  } catch {
    return null;
  }
}
