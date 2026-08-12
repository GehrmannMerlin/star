const assert = require("node:assert/strict");
const test = require("node:test");
const session = require("./stellaris-session.cjs");

const secret = "test-secret";
const now = 1_700_000_000_000;

test("signs and verifies a 24-hour base64url HMAC session", () => {
  const token = session.createSession("user-42", secret, now);
  assert.match(token, /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
  assert.deepEqual(session.verifySession(token, secret, now + session.SESSION_TTL_MS - 1), {
    userId: "user-42", exp: now + session.SESSION_TTL_MS,
  });
});

test("rejects expired, changed, and incorrectly signed sessions", () => {
  const token = session.createSession("user-42", secret, now);
  assert.equal(session.verifySession(token, secret, now + session.SESSION_TTL_MS), null);
  assert.equal(session.verifySession(`${token}x`, secret, now), null);
  assert.equal(session.verifySession(token, "other-secret", now), null);
});

test("uses the scoped secure cookie attributes for creation and clearing", () => {
  assert.match(session.setSessionCookie("user-42", secret, now), /^ifc_stellaris_session=.*; Path=\/zhengwujianli\/; HttpOnly; Secure; SameSite=Lax$/);
  assert.equal(session.clearSessionCookie(), "ifc_stellaris_session=; Path=/zhengwujianli/; HttpOnly; Secure; SameSite=Lax; Max-Age=0");
});
