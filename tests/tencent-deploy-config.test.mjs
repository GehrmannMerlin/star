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
  const dockerfile = await read("Dockerfile");
  assert.match(dockerfile, /ARG VITE_PUBLIC_BASE=\//);
});

test("Nginx protects page and API routes and forwards only verified API identity", async () => {
  const nginx = await read("infra/tencent/nginx-route.conf");
  assert.doesNotMatch(nginx, /stellaris\.ac\.cn/);
  assert.match(nginx, /proxy_pass http:\/\/127\.0\.0\.1:3218\/;/);
  assert.doesNotMatch(nginx, /proxy_pass http:\/\/127\.0\.0\.1:3218;/);
  assert.match(nginx, /127\.0\.0\.1:3217\/api\//);
  assert.match(nginx, /127\.0\.0\.1:3003\/api\/stellaris-session\/verify/);
  assert.equal((nginx.match(/auth_request \/_stellaris_session_verify;/g) ?? []).length, 2);
  assert.match(nginx, /proxy_set_header X-IFC-User-ID \$stellaris_user_id;/);
  assert.match(nginx, /return 302 "\/\?redirect=%2Fzhengwujianli%2F&reauth=1";/);
});


test("candidate environment is isolated from production", async () => {
  const candidate = await read("infra/tencent/compose.candidate.yml");
  assert.match(candidate, /^name: stellaris-zhengwujianli-candidate$/m);
  assert.match(candidate, /127\.0\.0\.1:3227:3000/);
  assert.match(candidate, /127\.0\.0\.1:3228:80/);
  assert.match(candidate, /candidate-data\/postgres/);
  assert.match(candidate, /candidate-data\/evidence/);
  assert.match(candidate, /candidate-data\/exports/);
  assert.match(candidate, /POSTGRES_DB: stellaris_candidate/);
  assert.match(candidate, /STELLARIS_WORKER: "0"/);
  assert.doesNotMatch(candidate, /\/data\/postgres/);
  assert.doesNotMatch(candidate, /127\.0\.0\.1:3217|127\.0\.0\.1:3218/);
  const dbBlock = candidate.split("\n  backend:")[0];
  assert.doesNotMatch(dbBlock, /\n    ports:/);
  assert.equal((candidate.match(/healthcheck:/g) ?? []).length, 3);
  assert.equal((candidate.match(/mem_limit:/g) ?? []).length, 3);
});

test("production deploy consumes immutable image names", async () => {
  const compose = await read("infra/tencent/compose.yml");
  assert.match(compose, /image: \${STELLARIS_BACKEND_IMAGE:\?/);
  assert.match(compose, /image: \${STELLARIS_WEB_IMAGE:\?/);
  assert.doesNotMatch(compose, /\n    build:/);
});



test("Tencent production progress is the sole production truth", async () => {
  const progress = await read(
    "docs/superpowers/progress/tencent-production-recovery-progress.md",
  );
  assert.match(progress, new RegExp("\\u9636\\u6bb5 0 \\| \\u53ef\\u4fe1\\u4ea4\\u4ed8\\u57fa\\u7ebf \\| \\u5b9e\\u65bd\\u4e2d"));
  assert.match(progress, new RegExp("\\u7981\\u6b62\\u8bfb\\u53d6\\u3001\\u5bfc\\u51fa\\u3001\\u8fc1\\u79fb\\u6216\\u4fee\\u6539\\u5458\\u5de5\\u4fe1\\u606f"));
  assert.match(progress, new RegExp("\\u5019\\u9009\\u73af\\u5883\\u771f\\u5b9e\\u9a8c\\u8bc1\\u901a\\u8fc7"));
  assert.match(progress, new RegExp("\\u5f53\\u524d\\u6b63\\u5f0f\\u955c\\u50cf"));
  assert.match(progress, new RegExp("\\u6700\\u8fd1\\u62a5\\u544a\\u76ee\\u5f55"));
  assert.match(progress, new RegExp("\\u56de\\u6eda\\u76ee\\u6807"));

  const oldRoadmap = await read(
    "docs/superpowers/progress/crawler-project-status-and-roadmap.md",
  );
  assert.match(oldRoadmap, new RegExp("\\u5386\\u53f2\\u5f00\\u53d1\\u8bb0\\u5f55"));
  assert.match(oldRoadmap, /tencent-production-recovery-progress\.md/);
  assert.doesNotMatch(
    oldRoadmap,
    new RegExp("\\u7ed3\\u8bba.*P1~P6 \\u5168\\u90e8\\u89c4\\u5212\\u6a21\\u5757\\u5b8c\\u6210\\u5e76\\u90e8\\u7f72"),
  );

  const oldProgress = await read(
    "docs/superpowers/progress/crawler-development-progress.md",
  );
  assert.match(oldProgress, /tencent-production-recovery-progress\.md/);
});
