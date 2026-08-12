/**
 * 统一脱敏（规格 §23 / §9.2）：日志、SSE、证据摘要共用出口。
 * 不保存密钥、Cookie、认证请求头、代理凭据、数据库连接串凭据。
 */

const TRACKING_PARAMS = new Set(["token", "access_token", "signature", "sig", "auth", "session", "sessionid", "sid", "key", "apikey", "password", "secret", "code"]);

/** 白名单响应头名（其余一律 REDACTED）。 */
const HEADER_WHITELIST = new Set([
  "content-type",
  "content-length",
  "content-encoding",
  "cache-control",
  "etag",
  "last-modified",
  "date",
  "server",
  "retry-after",
]);

/** URL 脱敏：去 userinfo、追踪参数值保留键名、截断超长查询。 */
export function sanitizeUrlForDisplay(url: string): string {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    // 不可解析：直接截断。
    return url.slice(0, 256);
  }
  parsed.username = "";
  parsed.password = "";
  const params = parsed.searchParams;
  for (const key of Array.from(params.keys())) {
    if (TRACKING_PARAMS.has(key.toLowerCase())) {
      params.set(key, "***");
    }
  }
  parsed.search = params.toString();
  let out = parsed.toString();
  if (out.length > 2048) {
    out = `${out.slice(0, 2048)}...`;
  }
  return out;
}

/** 白名单头名原样返回，其余一律 REDACTED。 */
export function sanitizeHeaderNameForLog(name: string): string {
  return HEADER_WHITELIST.has(name.toLowerCase()) ? name : "REDACTED";
}

const SECRET_PATTERNS: RegExp[] = [
  /Authorization:\s*Bearer\s+\S+/gi,
  /Cookie:\s*[^;\r\n]+/gi,
  /Set-Cookie:\s*[^;\r\n]+/gi,
  /(password|passwd|pwd)\s*[=:]\s*\S+/gi,
  /(secret|token|apikey|api_key)\s*[=:]\s*\S+/gi,
];

/** 证据文本脱敏：移除 Cookie/Authorization 值、替换敏感键值。 */
export function sanitizeTextForEvidence(text: string): string {
  let out = text;
  for (const pattern of SECRET_PATTERNS) {
    out = out.replace(pattern, (match) => {
      const eqIdx = match.search(/[=:]/);
      return eqIdx >= 0 ? `${match.slice(0, eqIdx + 1)} <secret>` : "<secret>";
    });
  }
  return out;
}
