# Tencent Independent Deployment Fast-Track Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan. Independent local tasks may run in parallel; do not add per-task full regression runs or repeated review gates.

**Goal:** 尽快把 `E:\Stellaris-Tencent` 部署为腾讯云独立版本，使 `/zhengwujianli/` 完全由腾讯云本机提供，并让所有账号（包括管理员）严格只能访问自己的任务。

**Architecture:** 保留已经完成并验证的数据库所有者隔离与后端授权实现；并行完成前端认证感知和腾讯云部署/会话资产。随后只构建一次、打包一次，在腾讯云完成一次候选认证验证、一次独立应用启动和一次原子 Nginx 切流。

**Tech Stack:** TypeScript、React、Fastify、PostgreSQL、Docker Compose、Nginx `auth_request`、Express/SQLite、Node `crypto`、Paramiko/SFTP。

## Global Constraints

- 只修改 `E:\Stellaris-Tencent`；`E:\Stellaris` 仅保存设计、计划和执行记录。
- 不迁移阿里云业务数据；腾讯云数据库从空库开始。
- 阿里云 `https://stellaris.ac.cn/` 保持运行，只解除腾讯云路径对它的反向代理。
- 所有账号包括管理员都严格只能访问自己创建的任务。
- 不再逐任务运行全量测试、全量构建或重复代码审查；已有通过结果直接复用。
- 后续只运行改动对应的局部测试、受影响包类型检查、一次生产构建和一次上线冒烟。
- Nginx 切换前备份和 `nginx -t`、账号服务备份、回滚路径不得省略。
- 秘密只写入权限 `600` 的远程文件，不进入源码、归档、命令输出或最终报告。

---

### Task 1: 收口已完成的后端账号隔离

**Files:**
- Existing: `apps/backend/src/auth/request-user.ts`
- Existing: `apps/backend/src/contracts/session-routes.ts`
- Existing: `apps/backend/src/contracts/task-routes.ts`
- Existing: `apps/backend/src/workers/task-control.ts`
- Update report: `E:\Stellaris\.superpowers\sdd\2026-08-11-tencent-independent-deployment\task-3-report.md`

**Interfaces:**
- Produces: `GET /api/session`、缺身份 `401`、跨账号任务访问 `404`、owner-aware 创建/列表/控制/复制。

- [ ] **Step 1: 复用已取得的验证证据**

记录而不重跑：身份解析 7/7；`app.test.ts` 22/22；Backend 13/13 文件、53/53 测试；Backend typecheck 退出 0；DB 8/8 文件、19/19 测试。

- [ ] **Step 2: 只做静态调用点检查**

使用文本搜索确认 `createWithIdempotency` 的生产、canary 和测试调用均显式传入 `ownerUserId`，所有 `:id` 公网任务路由在读取结果、文件或调用控制函数前执行 owner 校验。发现遗漏时补齐，并只运行对应单文件测试。

---

### Task 2: 并行完成前端认证感知

**Files:**
- Create: `apps/web/src/auth-http.ts`
- Create: `apps/web/src/auth-http.test.ts`
- Modify: `apps/web/src/main.tsx`
- Modify: `apps/web/src/app.tsx`

**Interfaces:**
- Consumes: 同源 `/api/session` 和 Nginx `401`。
- Produces: `fetchAuthenticated`、`redirectToPortalLogin`、`openAuthenticatedEvents` 和认证感知 Blob 下载。

- [ ] **Step 1: 写一个聚焦测试并观察 RED**

测试 `401` 跳转固定地址 `/?redirect=%2Fzhengwujianli%2F&reauth=1`，`503` 抛出“服务暂不可用”，SSE error 仅在 `/api/session` 返回 `401` 时跳转。

- [ ] **Step 2: 实现并迁移调用**

所有 fetch 使用 `credentials: "same-origin"`；创建、列表、详情、结果、证据、控制和行政区请求使用 `fetchAuthenticated`。导出先 fetch Blob 再创建临时对象 URL，并在下载后 revoke。SSE 保留普通网络错误的浏览器自动重连。

- [ ] **Step 3: 只运行局部验证**

```powershell
pnpm --filter @stellaris/web exec vitest run src/auth-http.test.ts
pnpm --filter @stellaris/web typecheck
```

两条命令各运行一次并要求退出 `0`；不运行 Web 全量测试或构建。

---

### Task 3: 并行完成 Compose、Nginx 模板和专用会话模块

**Files:**
- Modify: `Dockerfile`
- Create: `infra/tencent/compose.yml`
- Create: `infra/tencent/.env.example`
- Create: `infra/tencent/nginx-route.conf`
- Create: `infra/tencent/auth-system/stellaris-session.cjs`
- Create: `infra/tencent/auth-system/stellaris-session.test.cjs`
- Create: `tests/tencent-deploy-config.test.mjs`

**Interfaces:**
- Produces: Compose 项目 `stellaris-zhengwujianli`；Backend `127.0.0.1:3217`；Web `127.0.0.1:3218`；不公开 PostgreSQL；Cookie `ifc_stellaris_session`。

- [ ] **Step 1: 创建独立运行配置**

Compose 使用 `/opt/stellaris-zhengwujianli/data`，数据库密码从远程 `.env` 读取；PostgreSQL 无 `ports`；三个服务有健康检查和内存限制。Docker 构建参数固定 `VITE_PUBLIC_BASE=/zhengwujianli/`。

- [ ] **Step 2: 创建 Nginx 标记块**

页面代理到 `127.0.0.1:3218`，API 代理到 `127.0.0.1:3217/api/`；两者使用 `auth_request` 调用 `127.0.0.1:3003/api/stellaris-session/verify`。API 仅使用认证子请求返回值覆盖 `X-IFC-User-ID`，模板内不得包含 `stellaris.ac.cn`。

- [ ] **Step 3: 实现 HMAC 会话模块**

使用 HMAC-SHA256、base64url、24 小时有效期和 timing-safe 签名比较。Cookie 必须含 `Path=/zhengwujianli/; HttpOnly; Secure; SameSite=Lax`；清除 Cookie 使用相同名称和路径。

- [ ] **Step 4: 只运行三个配置级验证**

```powershell
node tests/tencent-deploy-config.test.mjs
node --test infra/tencent/auth-system/stellaris-session.test.cjs
docker compose -f infra/tencent/compose.yml config --quiet
```

每条只运行一次并要求退出 `0`。

---

### Task 4: 单次构建、归档和秘密扫描

**Files:**
- Create outside source: `E:\stellaris-zhengwujianli-${deployStamp}.tar`
- Create: `docs/deployment/checkpoints/fast-track-build.txt`

- [ ] **Step 1: 只运行一次生产构建**

```powershell
$env:VITE_PUBLIC_BASE='/zhengwujianli/'
pnpm build
Remove-Item Env:VITE_PUBLIC_BASE
```

要求退出 `0`。失败时只修复构建直接暴露的问题并重跑该构建，不补跑全量测试。

- [ ] **Step 2: 扫描秘密并打包**

确认源码不含 SSH 密码、员工密码、会话密钥或生产数据库密码。归档排除 `node_modules`、`dist`、`.env`、日志和旧归档；记录文件大小与 SHA-256。

---

### Task 5: 一次完成腾讯云候选认证与独立应用部署

**Files:**
- Remote modify: `/www/wwwroot/auth-system/server.js`
- Remote create: `/www/wwwroot/auth-system/stellaris-session.cjs`
- Remote modify: `/www/wwwroot/homer/index.html`
- Remote create: `/opt/stellaris-zhengwujianli/releases/${deployStamp}/`

- [ ] **Step 1: 精确验证目标并备份**

确认账号目录、Homer、Nginx 配置均为预期普通文件/目录；确认 `3217`、`3218`、候选账号端口 `3219` 空闲。备份账号服务、Homer 和 Nginx 活动配置，记录路径和哈希。

- [ ] **Step 2: 在 3219 做一次认证闭环**

候选账号服务使用候选 SQLite 副本和临时测试员工；只验证一次：原登录 JSON 键保持兼容、成功登录设置专用 Cookie、verify 返回正确用户 ID、篡改 Cookie 返回 `401`、logout 清除 Cookie。验证后停止候选进程并安全删除候选目录。

- [ ] **Step 3: 原子部署账号扩展**

生产密钥写入 `/www/wwwroot/auth-system/.stellaris-session-secret` 并设置 `600`。原子替换已验证文件，运行 `node --check`，重载 PM2；无 Cookie verify 必须返回 `401`，Homer 必须返回 `200`。失败立即恢复备份。

- [ ] **Step 4: 上传并启动独立 Compose**

上传归档并校验远程 SHA-256；创建权限 `600` 的 `/opt/stellaris-zhengwujianli/.env`；构建并启动三个服务。只验证三个容器 healthy、`3217/3218` 仅绑定回环地址、正式 `task_run` 为 `0`、`owner_user_id` 为 `NOT NULL`。

- [ ] **Step 5: 使用腾讯镜像系统 Chromium，取消 Playwright 浏览器下载**

停止前必须确认尚未完成的 Docker Compose 构建、Playwright downloader 和并行 Range 下载进程都只属于 `/opt/stellaris-zhengwujianli/releases/20260811T094203Z`；仅对这些精确 PID 发送 `SIGTERM` 并等待干净退出。保留 `/opt/stellaris-zhengwujianli/browser-mirror-*` 文件，不删除。

修改 `packages/crawler/src/browser/render.ts`，只在环境变量非空时传入系统浏览器路径：

```ts
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?.trim();
this.browser = await chromium.launch({
  headless: true,
  ...(executablePath ? { executablePath } : {}),
});
```

Dockerfile 保留已验证的 CA bundle 和 HTTPS 腾讯 Debian 镜像，但将最终 Playwright 安装命令替换为：

```dockerfile
RUN apt-get update \
  && apt-get install -y --no-install-recommends chromium \
  && rm -rf /var/lib/apt/lists/*
```

Compose Backend 设置 `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium`。本地文件和远程 exact release 文件分别原子更新并核对 SHA-256；不重新打包、不重新上传归档、不运行测试套件。执行一次缓存构建和 `compose up -d`。容器 healthy 后只运行一次容器内 Chromium 启动/版本/退出冒烟；失败则停止，不切流。

---

### Task 6: 原子切流与一次公网验收

**Files:**
- Remote modify: `/www/server/panel/vhost/nginx/tongjixinzhi.cn.conf`
- Create: `docs/deployment/tencent-operations.md`
- Create: `docs/deployment/checkpoints/fast-track-cutover.txt`

- [ ] **Step 1: 构造并切换 Nginx 配置**

精确替换旧 Stellaris 标记块；新块中页面/API 均指向腾讯云回环端口且不含 `stellaris.ac.cn`。原子替换后运行 `/www/server/nginx/sbin/nginx -t -c /www/server/nginx/conf/nginx.conf`；只有同时出现 `syntax is ok` 和 `test is successful` 才 reload。

- [ ] **Step 2: 只做一次关键公网冒烟**

验证：未登录页面跳转、未登录 API 为 `401`；有效会话可打开页面且 `/api/session` 返回正确账号；两个账号列表互相隔离并对对方任务得到 `404`；数据库初始为空；Homer 卡片不变；至少两个其他项目仍返回原状态；新 Nginx 块不再引用阿里云；阿里云原站仍正常。

- [ ] **Step 3: 失败立即回滚，成功写运维说明**

关键冒烟任一失败时恢复 Nginx、账号服务和 Homer 对应备份，并在 `nginx -t` 通过后 reload。成功时记录 Compose、日志、健康检查、升级和回滚命令；文档只记录路径和变量名，不记录秘密值。

---

## Completion Evidence

完成报告只引用最新的局部测试结果、单次生产构建、容器健康、空库计数、双账号隔离、公网路由、阿里云保留状态和备份路径；不再触发新的全量测试或重复审查。
