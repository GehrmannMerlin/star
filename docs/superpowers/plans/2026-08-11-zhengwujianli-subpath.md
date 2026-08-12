# 政务简历采集子路径部署 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 `https://tongjixinzhi.cn/zhengwujianli/` 在保留原 URL 的前提下加载真实 Stellaris 前端，并通过同路径前缀访问现有后端。

**Architecture:** 为 Vite 增加可配置的构建基础路径，并让所有前端 API URL 从 `import.meta.env.BASE_URL` 派生。生成 `/zhengwujianli/` 专用静态构建后上传到 Homer 服务器；Nginx 本地提供静态文件，并把 `/zhengwujianli/api/` 代理到 `https://stellaris.ac.cn/api/`。

**Tech Stack:** React 19、TypeScript 6、Vite 8、Vitest 4、Nginx、PowerShell、Paramiko/SFTP。

## Global Constraints

- 公开入口必须保持为 `https://tongjixinzhi.cn/zhengwujianli/`。
- `https://stellaris.ac.cn/` 的默认根路径构建与生产部署不得被破坏。
- 不迁移后端、PostgreSQL、证据文件或导出文件。
- 不接管 Homer 已有的根级 `/api/` 路由。
- 服务器修改前必须备份；只有 `nginx -t` 通过后才能 reload。
- 当前工作区不是 Git 仓库，所有“提交”检查点改为记录变更文件与验证输出，不运行 `git commit`。

## File Map

- Create: `apps/web/src/api-url.ts` — 统一构造带应用基础路径的 API URL。
- Create: `apps/web/src/api-url.test.ts` — 覆盖根路径、子路径、查询参数和前导斜杠。
- Modify: `apps/web/src/main.tsx` — 所有 fetch、EventSource 和导出 URL 改用 `apiUrl()`。
- Modify: `apps/web/vite.config.ts` — 从 `VITE_PUBLIC_BASE` 读取 Vite `base`，默认 `/`。
- Create: `tests/web-subpath-build.test.mjs` — 检查专用构建的 HTML 静态资源前缀。
- Remote modify: `/www/server/panel/vhost/nginx/tongjixinzhi.cn.conf` — 增加子路径静态路由和 API 代理。
- Remote create/replace: `/www/wwwroot/homer/zhengwujianli/` — 专用静态构建。

---

### Task 1: 统一 API URL 构造

**Files:**
- Create: `apps/web/src/api-url.ts`
- Create: `apps/web/src/api-url.test.ts`
- Modify: `apps/web/src/main.tsx`

**Interfaces:**
- Produces: `apiUrl(path: string, baseUrl?: string): string`
- Consumes: Vite 注入的 `import.meta.env.BASE_URL`

- [ ] **Step 1: 写入失败测试**

```ts
import { describe, expect, it } from "vitest";
import { apiUrl } from "./api-url.js";

describe("apiUrl", () => {
  it("keeps the root deployment API path", () => {
    expect(apiUrl("tasks", "/")).toBe("/api/tasks");
  });

  it("prefixes API paths for the Homer subpath build", () => {
    expect(apiUrl("tasks/t1/results", "/zhengwujianli/")).toBe(
      "/zhengwujianli/api/tasks/t1/results",
    );
  });

  it("preserves query strings and removes a leading slash", () => {
    expect(apiUrl("/regions/children?parent=340000", "/zhengwujianli")).toBe(
      "/zhengwujianli/api/regions/children?parent=340000",
    );
  });
});
```

- [ ] **Step 2: 运行测试并确认 RED**

Run: `pnpm --filter @stellaris/web exec vitest run src/api-url.test.ts`

Expected: FAIL，因为 `./api-url.js` 尚不存在。

- [ ] **Step 3: 实现最小 URL 构造函数**

```ts
function normalizeBase(baseUrl: string): string {
  const trimmed = baseUrl.trim();
  if (!trimmed || trimmed === "/") return "/";
  return `/${trimmed.replace(/^\/+|\/+$/g, "")}/`;
}

export function apiUrl(
  path: string,
  baseUrl: string = import.meta.env.BASE_URL,
): string {
  const base = normalizeBase(baseUrl);
  const apiPath = `api/${path.replace(/^\/+/, "")}`;
  return base === "/" ? `/${apiPath}` : `${base}${apiPath}`;
}
```

- [ ] **Step 4: 运行测试并确认 GREEN**

Run: `pnpm --filter @stellaris/web exec vitest run src/api-url.test.ts`

Expected: 3 tests PASS。

- [ ] **Step 5: 将生产 API 客户端全部迁移到 `apiUrl()`**

在 `apps/web/src/main.tsx` 导入：

```ts
import { apiUrl } from "./api-url.js";
```

把所有 `/api/...` 字符串替换为不带 `/api/` 的相对 API 路径，例如：

```ts
fetch(apiUrl("tasks"))
fetch(apiUrl(`tasks/${id}/results`))
new EventSource(apiUrl(`tasks/${id}/events`))
{ url: apiUrl(`tasks/${id}/export`) }
fetch(apiUrl(`regions/children?parent=${encodeURIComponent(parent)}`))
```

- [ ] **Step 6: 验证前端测试、类型和默认构建**

Run:

```powershell
pnpm --filter @stellaris/web test
pnpm --filter @stellaris/web typecheck
pnpm --filter @stellaris/web build
```

Expected: 全部 exit 0；默认 `apps/web/dist/index.html` 仍引用 `/assets/...`。

- [ ] **Step 7: 记录检查点**

记录变更文件 `api-url.ts`、`api-url.test.ts`、`main.tsx` 及三条验证命令输出。由于工作区没有 `.git`，不执行 commit。

---

### Task 2: 生成可验证的子路径构建

**Files:**
- Modify: `apps/web/vite.config.ts`
- Create: `tests/web-subpath-build.test.mjs`

**Interfaces:**
- Consumes: 环境变量 `VITE_PUBLIC_BASE`
- Produces: `apps/web/dist/index.html` 中的 `/zhengwujianli/assets/...` 引用

- [ ] **Step 1: 写入构建产物测试**

```js
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const html = await readFile(new URL("../apps/web/dist/index.html", import.meta.url), "utf8");
assert.match(html, /src="\/zhengwujianli\/assets\//);
assert.match(html, /href="\/zhengwujianli\/assets\//);
console.log("subpath build asset prefixes verified");
```

- [ ] **Step 2: 对当前默认构建运行测试并确认 RED**

Run: `node tests/web-subpath-build.test.mjs`

Expected: FAIL，因为当前构建引用 `/assets/...`。

- [ ] **Step 3: 给 Vite 添加可配置 base**

在 `apps/web/vite.config.ts` 的配置对象加入：

```ts
base: process.env.VITE_PUBLIC_BASE || "/",
```

- [ ] **Step 4: 生成专用构建**

Run:

```powershell
$env:VITE_PUBLIC_BASE='/zhengwujianli/'
pnpm --filter @stellaris/web build
Remove-Item Env:VITE_PUBLIC_BASE
```

Expected: build exit 0。

- [ ] **Step 5: 运行构建产物测试并确认 GREEN**

Run: `node tests/web-subpath-build.test.mjs`

Expected: PASS 并输出 `subpath build asset prefixes verified`。

- [ ] **Step 6: 运行完整前端验证**

Run:

```powershell
pnpm --filter @stellaris/web test
pnpm --filter @stellaris/web typecheck
```

Expected: 全部 exit 0。

---

### Task 3: 建立生产失败基线并部署静态文件

**Files:**
- Read: `apps/web/dist/index.html`
- Remote create/replace: `/www/wwwroot/homer/zhengwujianli/`

**Interfaces:**
- Consumes: Task 2 的 `apps/web/dist/`
- Produces: Homer 本地可读取的 `/www/wwwroot/homer/zhengwujianli/index.html`

- [ ] **Step 1: 记录部署前失败基线**

Run:

```powershell
curl.exe -sS -L https://tongjixinzhi.cn/zhengwujianli/ | Select-String '<title>政务简历采集</title>'
```

Expected: 无匹配；当前返回 Homer 首页。

- [ ] **Step 2: 校验本地构建完整性**

检查 `index.html`、至少一个 `.js` 和一个 `.css` 文件存在且大小大于 0；确认 HTML 只引用 `/zhengwujianli/assets/`。

- [ ] **Step 3: 上传到远端临时目录**

在本次部署开始时生成且只生成一次：

```powershell
$deployStamp = [DateTime]::UtcNow.ToString('yyyyMMddHHmmss')
```

通过 SFTP 上传 `apps/web/dist/` 到：

`/www/wwwroot/homer/.zhengwujianli-upload-${deployStamp}/`

上传后逐文件比较本地大小和远端大小。

- [ ] **Step 4: 原子切换静态目录**

远端执行顺序：

```sh
test -d /www/wwwroot/homer/.zhengwujianli-upload-${deployStamp}
mv /www/wwwroot/homer/zhengwujianli /www/wwwroot/homer/zhengwujianli.bak-${deployStamp}  # 仅当正式目录已存在
mv /www/wwwroot/homer/.zhengwujianli-upload-${deployStamp} /www/wwwroot/homer/zhengwujianli
```

每个目标必须先解析并确认位于 `/www/wwwroot/homer/` 内；任何检查失败立即停止。

---

### Task 4: 安全更新 Nginx 路由

**Files:**
- Remote modify: `/www/server/panel/vhost/nginx/tongjixinzhi.cn.conf`

**Interfaces:**
- Consumes: `/www/wwwroot/homer/zhengwujianli/` 静态构建
- Produces: `/zhengwujianli/` 静态路由和 `/zhengwujianli/api/` 上游代理

- [ ] **Step 1: 备份并准备候选配置**

备份活动配置为：

`/www/server/panel/vhost/nginx/tongjixinzhi.cn.conf.bak-zhengwujianli-${deployStamp}`

在第一个 `tongjixinzhi.cn` HTTPS server block 的通用 `location /` 之前插入：

```nginx
    # == Stellaris 政务简历采集 start ==
    location = /zhengwujianli {
        return 301 /zhengwujianli/;
    }

    location ^~ /zhengwujianli/api/ {
        proxy_pass https://stellaris.ac.cn/api/;
        proxy_http_version 1.1;
        proxy_set_header Host stellaris.ac.cn;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Prefix /zhengwujianli;
        proxy_ssl_server_name on;
        proxy_ssl_name stellaris.ac.cn;
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
        client_max_body_size 100m;
    }

    location ^~ /zhengwujianli/ {
        try_files $uri $uri/ /zhengwujianli/index.html;
    }
    # == Stellaris 政务简历采集 end ==
```

- [ ] **Step 2: 检查候选配置幂等性**

确认 start/end 标记各出现一次，`location = /zhengwujianli`、`location ^~ /zhengwujianli/api/` 和静态 location 各出现一次。

- [ ] **Step 3: 运行语法检查**

Run: `nginx -t`

Expected: exit 0，输出 `syntax is ok` 与 `test is successful`。失败时立即恢复备份，不 reload。

- [ ] **Step 4: 重载 Nginx**

Run: `nginx -s reload`

Expected: exit 0。

---

### Task 5: 端到端验收与回滚判定

**Files:**
- Read-only verification of public URLs and remote configuration

**Interfaces:**
- Consumes: Tasks 1-4 的已部署结果
- Produces: 逐项验收证据或触发回滚

- [ ] **Step 1: 验证 HTML 与首页隔离**

Run:

```powershell
curl.exe -sS -L -o NUL -w '%{http_code}' https://tongjixinzhi.cn/zhengwujianli/
curl.exe -sS -L https://tongjixinzhi.cn/zhengwujianli/ | Select-String '<title>政务简历采集</title>'
```

Expected: HTTP 200，标题匹配；目标正文 SHA-256 不等于 Homer 首页。

- [ ] **Step 2: 验证静态资源**

从公开 HTML 提取 JS/CSS URL，逐个请求。

Expected: JS 为 HTTP 200 + `application/javascript`，CSS 为 HTTP 200 + `text/css`。

- [ ] **Step 3: 验证只读 API**

Run:

```powershell
curl.exe -sS -L -o NUL -w '%{http_code}|%{content_type}' https://tongjixinzhi.cn/zhengwujianli/api/tasks
curl.exe -sS -L -o NUL -w '%{http_code}|%{content_type}' https://tongjixinzhi.cn/zhengwujianli/api/regions/provinces
```

Expected: 两项均为 HTTP 200 + `application/json`，响应 JSON 可解析。

- [ ] **Step 4: 验证 SSE 配置与 URL**

确认生产 bundle 包含 `/zhengwujianli/api/`，活动 Nginx location 包含 `proxy_buffering off` 和 `proxy_read_timeout 3600s`。对一个现有任务事件 URL 使用短超时请求，确认连接进入上游而不是返回 Homer HTML。

- [ ] **Step 5: 回归检查**

确认以下地址仍为 HTTP 200：

- `https://tongjixinzhi.cn/`
- `https://stellaris.ac.cn/`
- Homer 原有根级 `/api/` 代表性只读端点（记录修改前后状态，不要求原本失败的端点变为成功）。

- [ ] **Step 6: 失败时回滚**

若 HTML、任一静态资源或两项只读 API 验收失败：恢复 Nginx 备份和静态目录备份，运行 `nginx -t`，仅在通过后 reload，并重新确认 Homer 首页恢复。

- [ ] **Step 7: 完成前重新运行全量验证**

Run:

```powershell
pnpm --filter @stellaris/web test
pnpm --filter @stellaris/web typecheck
```

Expected: 全部 exit 0；随后按 `verification-before-completion` 要求报告公网验收证据。
