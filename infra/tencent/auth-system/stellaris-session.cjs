const { createHmac, timingSafeEqual } = require("node:crypto");

const COOKIE_NAME = "ifc_stellaris_session";
const COOKIE_PATH = "/zhengwujianli/";
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;
const COOKIE_ATTRIBUTES = `Path=${COOKIE_PATH}; HttpOnly; Secure; SameSite=Lax`;

function encode(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function sign(payload, secret) {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function createSession(userId, secret, now = Date.now()) {
  if (!userId || !secret) throw new Error("userId and secret are required");
  const payload = encode({ userId, exp: now + SESSION_TTL_MS });
  return `${payload}.${sign(payload, secret)}`;
}

function verifySession(token, secret, now = Date.now()) {
  if (typeof token !== "string" || !secret) return null;
  const parts = token.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  const expected = Buffer.from(sign(parts[0], secret));
  const actual = Buffer.from(parts[1]);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
    if (typeof payload.userId !== "string" || !payload.userId || !Number.isFinite(payload.exp) || payload.exp <= now) return null;
    return { userId: payload.userId, exp: payload.exp };
  } catch {
    return null;
  }
}

function setSessionCookie(userId, secret, now = Date.now()) {
  return `${COOKIE_NAME}=${createSession(userId, secret, now)}; ${COOKIE_ATTRIBUTES}`;
}

function clearSessionCookie() {
  return `${COOKIE_NAME}=; Path=${COOKIE_PATH}; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

module.exports = { COOKIE_NAME, COOKIE_PATH, SESSION_TTL_MS, createSession, verifySession, setSessionCookie, clearSessionCookie };
