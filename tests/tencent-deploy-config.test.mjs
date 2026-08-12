import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Tencent Compose keeps services local, durable, and resource-bounded", async () => {
  const compose = await read("infra/tencent/compose.yml");
  assert.match(compose, /^name: stellaris-zhengwujianli$/m);
  assert.match(compose, /127\.0\.0\.1:3217:3000/);
  assert.match(compose, /127\.0\.0\.1:3218:80/);
  const dbBlock = compose.split("\n  backend:")[0];
  assert.doesNotMatch(dbBlock, /\n    ports:/);
  assert.match(compose, /\/opt\/stellaris-zhengwujianli\/data/);
  assert.match(compose, /POSTGRES_PASSWORD: \$\{POSTGRES_PASSWORD/);
  assert.equal((compose.match(/healthcheck:/g) ?? []).length, 3);
  assert.equal((compose.match(/mem_limit:/g) ?? []).length, 3);
  assert.match(compose, /VITE_PUBLIC_BASE: \/zhengwujianli\//);
});

test("Nginx protects page and API routes and forwards only verified API identity", async () => {
  const nginx = await read("infra/tencent/nginx-route.conf");
  assert.doesNotMatch(nginx, /stellaris\.ac\.cn/);
  assert.match(nginx, /127\.0\.0\.1:3218/);
  assert.match(nginx, /127\.0\.0\.1:3217\/api\//);
  assert.match(nginx, /127\.0\.0\.1:3003\/api\/stellaris-session\/verify/);
  assert.equal((nginx.match(/auth_request \/_stellaris_session_verify;/g) ?? []).length, 2);
  assert.match(nginx, /proxy_set_header X-IFC-User-ID \$stellaris_user_id;/);
  assert.match(nginx, /return 302 "\/\?redirect=%2Fzhengwujianli%2F&reauth=1";/);
});
