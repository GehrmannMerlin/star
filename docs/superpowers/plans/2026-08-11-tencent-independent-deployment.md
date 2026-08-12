# Stellaris 腾讯云独立部署与账号隔离 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 创建 `E:\Stellaris-Tencent` 独立源码副本，在腾讯云部署空数据库的完整 Stellaris，并复用共用员工账号实现服务端强制的逐账号任务隔离，最终让 `/zhengwujianli/` 完全脱离阿里云上游。

**Architecture:** 腾讯云 Nginx 使用 `auth_request` 调用现有账号服务新增的 Stellaris 专用会话校验接口，成功后覆盖并注入可信用户 ID；Backend 只在本机端口接收请求，并以 `task_run.owner_user_id` 限制所有任务读写。Web、Backend 和 PostgreSQL 作为独立 Compose 项目运行在 `/opt/stellaris-zhengwujianli`，公网页面与 API 原子切换到 `127.0.0.1:3218` 和 `127.0.0.1:3217`。

**Tech Stack:** PowerShell 7、Node.js 24、pnpm 10、TypeScript 6、React 19、Fastify 5、Kysely、PostgreSQL 18、Vitest 4、Docker 29、Docker Compose 5、Nginx `http_auth_request_module`、Express 4、SQLite、Node `crypto`、Paramiko/SFTP。

## Global Constraints

- 本地专用副本固定为 `E:\Stellaris-Tencent`；源目录 `E:\Stellaris` 不接收腾讯云专属实现改动。
- 当前源目录不是 Git 仓库；不得伪造提交记录。每个任务使用 SHA-256 清单和验证日志作为检查点。
- 腾讯云正式目录固定为 `/opt/stellaris-zhengwujianli`。
- 腾讯云 PostgreSQL 必须是全新空库；不得复制阿里云任务、证据或导出文件。
- 所有账号包括管理员都只能访问自己的任务。
- 浏览器提供的用户 ID 不可信；只有 Nginx 认证子请求生成的内部身份头可被 Backend 使用。
- 其他腾讯云项目的登录请求和 JSON 响应必须保持兼容。
- Homer 已有卡片、封面、排序和 `/zhengwujianli/` URL 不变，不执行重新发布或封面生成。
- 正式 Nginx 配置中 `/zhengwujianli/` 范围不得继续引用 `stellaris.ac.cn`。
- 阿里云 `https://stellaris.ac.cn/` 继续运行，不删除服务和数据。
- 远程修改前必须创建带 UTC 时间戳的备份；仅在 `nginx -t` 通过后 reload。
- 任一登录回归、任务越权、关键服务健康或资源检查失败都停止并回滚。

## File Map

### 独立应用副本

- Create: `E:\Stellaris-Tencent\docs\deployment\tencent-source-baseline.md` — 记录复制来源、排除项和基线哈希。
- Create: `E:\Stellaris-Tencent\packages\db\src\migration-003-task-owner.ts` — 增加所有者列、租户内幂等约束和索引。
- Modify: `E:\Stellaris-Tencent\packages\db\src\migration-provider.ts` — 注册迁移 003。
- Modify: `E:\Stellaris-Tencent\packages\db\src\schema.ts` — 为 `TaskRunTable` 增加 `owner_user_id`。
- Modify: `E:\Stellaris-Tencent\packages\db\src\repos\task-run.ts` — 提供所有者范围内创建、查找、列表和计数。
- Create: `E:\Stellaris-Tencent\packages\db\src\task-owner.test.ts` — 覆盖逐账号幂等、查询和计数。
- Modify: `E:\Stellaris-Tencent\packages\db\src\evidence-invariant.test.ts` — 测试种子补充所有者。
- Modify: `E:\Stellaris-Tencent\packages\db\src\repos\repos.test.ts` — 测试种子补充所有者。
- Create: `E:\Stellaris-Tencent\apps\backend\src\auth\request-user.ts` — 严格解析可信身份头。
- Create: `E:\Stellaris-Tencent\apps\backend\src\auth\request-user.test.ts` — 覆盖缺失、重复和非法身份头。
- Modify: `E:\Stellaris-Tencent\apps\backend\src\contracts\task-routes.ts` — 对全部任务接口执行所有者校验。
- Modify: `E:\Stellaris-Tencent\apps\backend\src\workers\task-control.ts` — 复制任务继承当前用户所有权。
- Modify: `E:\Stellaris-Tencent\apps\backend\src\app.test.ts` — 覆盖 401、跨账号 404 和所有任务端点。
- Modify: `E:\Stellaris-Tencent\apps\backend\src\scripts\canary-anhui.ts` — 内部脚本使用固定 canary 所有者。
- Modify: `E:\Stellaris-Tencent\apps\backend\src\scripts\canary-anhui-regions.ts` — 内部脚本使用固定 canary 所有者。
- Modify: `E:\Stellaris-Tencent\apps\backend\src\workers\*.test.ts` — 任务测试种子显式提供 `test-user` 所有者。
- Modify: `E:\Stellaris-Tencent\packages\rules\src\recovery-executor.test.ts` — 规则测试种子显式提供 `test-user` 所有者。
- Create: `E:\Stellaris-Tencent\apps\backend\src\contracts\session-routes.ts` — 暴露受保护的当前会话探针。
- Create: `E:\Stellaris-Tencent\apps\web\src\auth-http.ts` — 统一处理 401、重新登录、下载和 SSE 会话失效。
- Create: `E:\Stellaris-Tencent\apps\web\src\auth-http.test.ts` — 覆盖登录跳转和安全返回路径。
- Modify: `E:\Stellaris-Tencent\apps\web\src\app.tsx` — 下载后释放临时 Blob URL。
- Modify: `E:\Stellaris-Tencent\apps\web\src\main.tsx` — 所有 API 调用使用认证感知客户端。
- Modify: `E:\Stellaris-Tencent\Dockerfile` — 支持构建时注入 `/zhengwujianli/` 基础路径。
- Create: `E:\Stellaris-Tencent\infra\tencent\compose.yml` — 独立生产服务、端口、网络、健康检查和资源约束。
- Create: `E:\Stellaris-Tencent\infra\tencent\.env.example` — 仅声明变量名，不包含生产秘密。
- Create: `E:\Stellaris-Tencent\infra\tencent\nginx-route.conf` — 可审计的正式路由标记块。
- Create: `E:\Stellaris-Tencent\tests\tencent-deploy-config.test.mjs` — 静态验证端口、上游、认证头和资源约束。

### 共用账号兼容扩展

- Create: `E:\Stellaris-Tencent\infra\tencent\auth-system\stellaris-session.cjs` — 会话签发、解析、签名和 Cookie 序列化。
- Create: `E:\Stellaris-Tencent\infra\tencent\auth-system\stellaris-session.test.cjs` — Node 内置测试。
- Remote modify: `/www/wwwroot/auth-system/server.js` — 登录成功时签发专用 Cookie，新增校验与退出接口。
- Remote create: `/www/wwwroot/auth-system/stellaris-session.cjs` — 部署经测试的纯模块。
- Remote create: `/www/wwwroot/auth-system/.stellaris-session-secret` — 权限 `600` 的 256 位随机密钥。
- Remote modify: `/www/wwwroot/homer/index.html` — 退出控制台时同步清除专用 Cookie；卡片数据不变。
- Remote modify: `/www/server/panel/vhost/nginx/tongjixinzhi.cn.conf` — 内部认证子请求和腾讯云本机上游。

---

### Task 1: 创建可追溯的本地独立副本

**Files:**
- Create: `E:\Stellaris-Tencent\`
- Create: `E:\Stellaris-Tencent\docs\deployment\tencent-source-baseline.md`

**Interfaces:**
- Consumes: `E:\Stellaris` 当前源码树。
- Produces: 后续任务唯一允许修改的根目录 `E:\Stellaris-Tencent`。

- [ ] **Step 1: 验证复制目标**

运行只读检查：

```powershell
$source = [IO.Path]::GetFullPath('E:\Stellaris')
$target = [IO.Path]::GetFullPath('E:\Stellaris-Tencent')
if ($source -ne 'E:\Stellaris') { throw "Unexpected source: $source" }
if ($target -ne 'E:\Stellaris-Tencent') { throw "Unexpected target: $target" }
if (Test-Path -LiteralPath $target) { throw "Target already exists: $target" }
```

Expected: 两个路径精确匹配，目标不存在。

- [ ] **Step 2: 复制源码并排除运行产物**

```powershell
robocopy 'E:\Stellaris' 'E:\Stellaris-Tencent' /E /COPY:DAT /DCOPY:DAT `
  /XD node_modules dist .git .superpowers `
  /XF '*.tar' '*.log' '.env' 'config.local.json'
$copyExit = $LASTEXITCODE
if ($copyExit -gt 7) { throw "robocopy failed: $copyExit" }
```

Expected: `robocopy` 退出码为 `0..7`，目标包含 `package.json`、`pnpm-lock.yaml`、`apps`、`packages`、`infra` 和 `docs`。

- [ ] **Step 3: 写入复制基线说明**

使用 `apply_patch` 创建 `docs/deployment/tencent-source-baseline.md`，内容包含：来源 `E:\Stellaris`、目标 `E:\Stellaris-Tencent`、UTC 复制时间、排除的目录/文件模式，以及“该副本不是阿里云数据副本”。

- [ ] **Step 4: 生成源码哈希清单**

```powershell
Set-Location 'E:\Stellaris-Tencent'
$copyRoot = [IO.Path]::GetFullPath((Get-Location).Path)
Get-ChildItem -File -Recurse | Where-Object {
  $_.FullName -notmatch '\\node_modules\\|\\dist\\' -and $_.Name -notmatch '\.tar$'
} | Sort-Object FullName | Get-FileHash -Algorithm SHA256 |
  ForEach-Object { "{0}  {1}" -f $_.Hash, [IO.Path]::GetRelativePath($copyRoot, $_.Path) } |
  Set-Content -LiteralPath 'docs\deployment\tencent-source-sha256.txt' -Encoding utf8
```

Expected: 清单非空，且不包含 `node_modules`、`dist` 和 `.tar`。

- [ ] **Step 5: 安装依赖并验证复制基线**

```powershell
Set-Location 'E:\Stellaris-Tencent'
pnpm install --frozen-lockfile
pnpm test
pnpm build
pnpm typecheck
```

Expected: 四条命令退出码均为 `0`。构建先生成 workspace 包声明文件，随后类型检查不得依赖源目录中的旧 `dist`。

---

### Task 2: 在数据库建立任务所有权边界

**Files:**
- Create: `packages/db/src/migration-003-task-owner.ts`
- Modify: `packages/db/src/migration-provider.ts`
- Modify: `packages/db/src/schema.ts`
- Modify: `packages/db/src/repos/task-run.ts`
- Create: `packages/db/src/task-owner.test.ts`
- Modify: `packages/db/src/evidence-invariant.test.ts`
- Modify: `packages/db/src/repos/repos.test.ts`

**Interfaces:**
- Consumes: `TaskRunRepository`、Kysely `Database` 和迁移 001/002。
- Produces: `owner_user_id: string`；`createWithIdempotency({ ownerUserId, ... })`；`findByIdForOwner(taskRunId, ownerUserId)`；所有者范围内的 `listRecent` 和 `count`。

- [ ] **Step 1: 写入失败的所有权测试**

在 `task-owner.test.ts` 中用两个用户 `user-a`、`user-b` 验证：

```ts
const a = await repo.createWithIdempotency({
  ownerUserId: "user-a",
  idempotencyKey: "same-key",
  mode: "TARGETED",
  expandLevel: "COUNTY",
  ruleVersion: "v1",
});
const b = await repo.createWithIdempotency({
  ownerUserId: "user-b",
  idempotencyKey: "same-key",
  mode: "TARGETED",
  expandLevel: "COUNTY",
  ruleVersion: "v1",
});
expect(a.id).not.toBe(b.id);
expect(await repo.findByIdForOwner(a.id, "user-a")).toBeDefined();
expect(await repo.findByIdForOwner(a.id, "user-b")).toBeUndefined();
expect((await repo.listRecent({ ownerUserId: "user-a", limit: 20, offset: 0 }))).toHaveLength(1);
expect(await repo.count({ ownerUserId: "user-b" })).toBe(1);
```

- [ ] **Step 2: 运行测试确认 RED**

```powershell
pnpm --filter @stellaris/db exec vitest run src/task-owner.test.ts
```

Expected: 因 `ownerUserId` 和 `findByIdForOwner` 尚不存在而失败。

- [ ] **Step 3: 实现迁移 003**

迁移 `up` 按顺序执行：

```sql
ALTER TABLE task_run ADD COLUMN owner_user_id text;
UPDATE task_run SET owner_user_id = '__legacy__' WHERE owner_user_id IS NULL;
ALTER TABLE task_run ALTER COLUMN owner_user_id SET NOT NULL;
ALTER TABLE task_run DROP CONSTRAINT task_run_idempotency_key_unique;
ALTER TABLE task_run ADD CONSTRAINT task_run_owner_idempotency_key_unique
  UNIQUE (owner_user_id, idempotency_key);
CREATE INDEX idx_task_run_owner_requested_at
  ON task_run (owner_user_id, requested_at DESC);
```

迁移 `down` 删除索引与复合约束后，先把每条任务的幂等键确定性改写为 `<task UUID>:<原幂等键>`，再恢复单列幂等约束并删除 `owner_user_id`。该策略保留任务数据，但显式降级后旧客户端用原幂等键重试会创建新任务。增加 focused up/down 测试：两个所有者使用同一原始键时，降级必须成功、两行都保留、改写后的键互不相同且旧全局唯一约束成立。在 `migration-provider.ts` 注册为第三项，并将 `TaskRunTable` 增加 `owner_user_id: string`。

- [ ] **Step 4: 实现所有者范围仓储**

`createWithIdempotency` 写入 `owner_user_id`，冲突后使用两个条件查询：

```ts
.where("owner_user_id", "=", input.ownerUserId)
.where("idempotency_key", "=", input.idempotencyKey)
```

新增：

```ts
async findByIdForOwner(taskRunId: string, ownerUserId: string): Promise<TaskRunRow | undefined>
```

`listRecent` 和 `count` 的参数必须包含 `ownerUserId: string`，并在任何可选筛选前首先添加 `.where("owner_user_id", "=", opts.ownerUserId)`。保留现有不带所有者的 `findById`、状态更新和恢复查询，只供 Worker 内部使用。

- [ ] **Step 5: 更新所有任务创建调用和测试种子**

对生产请求传入当前用户 ID；Worker 的复制任务由 Task 3 传入原任务所有者。测试直接插入 `task_run` 时明确使用 `owner_user_id: "test-user"`，不得依赖数据库默认值。

- [ ] **Step 6: 运行数据库验证确认 GREEN**

```powershell
pnpm --filter @stellaris/db test
pnpm --filter @stellaris/db typecheck
```

Expected: 所有测试通过，类型检查退出码为 `0`。

- [ ] **Step 7: 记录检查点**

将本任务改动文件 SHA-256 追加到 `docs/deployment/tencent-source-sha256.txt`，并保存测试输出到 `docs/deployment/checkpoints/task-02-db-owner.txt`。

---

### Task 3: 后端强制可信身份与逐任务授权

**Files:**
- Create: `apps/backend/src/auth/request-user.ts`
- Create: `apps/backend/src/auth/request-user.test.ts`
- Create: `apps/backend/src/contracts/session-routes.ts`
- Modify: `apps/backend/src/server.ts`
- Modify: `apps/backend/src/contracts/task-routes.ts`
- Modify: `apps/backend/src/workers/task-control.ts`
- Modify: `apps/backend/vitest.config.ts`
- Modify: `apps/backend/src/app.test.ts`
- Modify: `apps/backend/src/scripts/canary-anhui.ts`
- Modify: `apps/backend/src/scripts/canary-anhui-regions.ts`
- Modify: `apps/backend/src/workers/*.test.ts` containing `createWithIdempotency`
- Modify: `packages/rules/src/recovery-executor.test.ts`

**Interfaces:**
- Consumes: Nginx 覆盖的 `x-ifc-user-id` 请求头和 Task 2 的所有者仓储。
- Produces: `requireRequestUserId(req): string`；`GET /api/session`；任务接口缺身份返回 `401`、跨账号返回 `404`。

- [ ] **Step 0: 修复已确认的后端测试基线资源争用**

默认后端测试已连续两次在并行启动多个 Testcontainers PostgreSQL 时发生 `beforeAll` 10 秒超时；同一套件使用 `--maxWorkers=1 --no-file-parallelism` 后 12 个文件、42 个测试全部通过。仅修改 `apps/backend/vitest.config.ts` 将测试文件串行化，随后运行不带附加参数的 `pnpm --filter @stellaris/backend test`，必须退出 `0`。此项不改变生产行为，不得放宽钩子超时。

- [ ] **Step 1: 写入身份解析失败测试**

测试以下输入：缺失头、数组型重复头、空字符串、超过 128 字符、含控制字符均抛出 `UnauthenticatedError`；`x-ifc-user-id: 42` 返回字符串 `"42"`。

- [ ] **Step 2: 运行身份测试确认 RED**

```powershell
pnpm --filter @stellaris/backend exec vitest run src/auth/request-user.test.ts
```

Expected: 因模块不存在而失败。

- [ ] **Step 3: 实现严格身份解析**

```ts
export const TRUSTED_USER_HEADER = "x-ifc-user-id";

export class UnauthenticatedError extends Error {}

export function requireRequestUserId(req: FastifyRequest): string {
  const raw = req.headers[TRUSTED_USER_HEADER];
  if (typeof raw !== "string") throw new UnauthenticatedError("missing trusted user");
  const value = raw.trim();
  if (!value || value.length > 128 || /[\u0000-\u001f\u007f]/.test(value)) {
    throw new UnauthenticatedError("invalid trusted user");
  }
  return value;
}
```

- [ ] **Step 4: 写入路由隔离失败测试**

在 `app.test.ts` 使用固定头：

```ts
const USER_A = { "x-ifc-user-id": "user-a" };
const USER_B = { "x-ifc-user-id": "user-b" };
```

覆盖：无头创建/列表返回 `401`；A 创建任务后 B 对详情、结果、证据、导出、SSE、暂停、继续、取消和复制全部得到 `404`；A 能执行对应操作；A/B 列表和 `total` 只统计自己的任务。

- [ ] **Step 5: 运行路由测试确认 RED**

```powershell
pnpm --filter @stellaris/backend exec vitest run src/app.test.ts
```

Expected: 当前接口未要求身份且未过滤所有者，新增断言失败。

- [ ] **Step 6: 添加统一授权辅助函数**

在 `task-routes.ts` 内集中实现：

```ts
async function requireOwnedTask(
  req: FastifyRequest,
  reply: FastifyReply,
  repos: Repositories,
  taskId: string,
): Promise<{ userId: string; task: TaskRunRow } | undefined> {
  let userId: string;
  try { userId = requireRequestUserId(req); }
  catch { await reply.code(401).send({ error: "UNAUTHENTICATED" }); return; }
  const task = await repos.taskRun.findByIdForOwner(taskId, userId);
  if (!task) { await reply.code(404).send({ error: "TASK_NOT_FOUND" }); return; }
  return { userId, task };
}
```

列表、创建先调用 `requireRequestUserId`；所有 `:id` 路由必须在读取结果、文件或调用控制函数之前调用 `requireOwnedTask`。未经该辅助函数不得根据请求中的任务 ID 访问关联仓储或文件系统。

- [ ] **Step 7: 让创建、列表和控制继承所有者**

创建任务向 `createWithIdempotency` 传 `ownerUserId`。列表和计数传相同 `ownerUserId`。将复制签名改为：

```ts
duplicateTask(taskRunId: string, ownerUserId: string, deps: TaskControlDeps)
```

复制前调用 `findByIdForOwner`，创建副本时传 `ownerUserId`。暂停、继续和取消在路由层完成所有者校验后才调用现有 Worker 控制函数。

同时更新所有内部 `createWithIdempotency` 调用：两个 canary 脚本使用 `ownerUserId: "canary"`，Backend Worker 测试和 Rules 测试种子使用 `ownerUserId: "test-user"`。不得为兼容旧签名给仓储增加默认所有者。

- [ ] **Step 8: 注册会话探针**

`GET /api/session` 调用 `requireRequestUserId`，成功返回 `{ authenticated: true, userId }`；缺失身份头返回 `401`。在 `server.ts` 注册该路由。它供前端在 SSE 断线时区分登录失效与普通网络中断。

- [ ] **Step 9: 运行后端全量验证确认 GREEN**

```powershell
pnpm --filter @stellaris/backend test
pnpm --filter @stellaris/backend typecheck
pnpm --filter @stellaris/db test
```

Expected: 三条命令均退出 `0`；跨账号所有端点均为 `404`。

---

### Task 4: 前端统一处理登录失效、SSE 与导出

**Files:**
- Create: `apps/web/src/auth-http.ts`
- Create: `apps/web/src/auth-http.test.ts`
- Modify: `apps/web/src/app.tsx`
- Modify: `apps/web/src/main.tsx`

**Interfaces:**
- Consumes: 同源 `/zhengwujianli/api/`、`GET /api/session` 和 Nginx 的 `401`。
- Produces: `fetchAuthenticated`、`redirectToPortalLogin`、`openAuthenticatedEvents` 和可检查 401 的 Blob 下载。

- [ ] **Step 1: 写入登录跳转失败测试**

验证 `fetchAuthenticated` 收到 `401` 时调用：

```ts
location.assign("/?redirect=%2Fzhengwujianli%2F&reauth=1");
```

并验证 `200` 原样返回、`503` 抛出“服务暂不可用”、其他非 2xx 抛出带状态码的错误。返回地址使用固定同源路径，不读取任意外部 URL。

- [ ] **Step 2: 运行测试确认 RED**

```powershell
pnpm --filter @stellaris/web exec vitest run src/auth-http.test.ts
```

Expected: 因模块不存在而失败。

- [ ] **Step 3: 实现认证感知 fetch**

```ts
export const LOGIN_URL = "/?redirect=%2Fzhengwujianli%2F&reauth=1";

export function redirectToPortalLogin(): void {
  window.location.assign(LOGIN_URL);
}

export async function fetchAuthenticated(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const response = await fetch(input, { ...init, credentials: "same-origin" });
  if (response.status === 401) { redirectToPortalLogin(); throw new Error("UNAUTHENTICATED"); }
  if (response.status === 503) throw new Error("服务暂不可用");
  if (!response.ok) throw new Error(`请求失败（HTTP ${response.status}）`);
  return response;
}
```

- [ ] **Step 4: 实现 SSE 会话复核**

`openAuthenticatedEvents(url, sessionUrl)` 创建 `EventSource`。其 `error` 监听器调用 `fetch(sessionUrl, { credentials: "same-origin" })`；只有会话探针返回 `401` 时跳转登录，其他网络错误保留浏览器默认重连行为。

- [ ] **Step 5: 迁移全部 API 调用**

`main.tsx` 的创建、列表、详情、结果、证据、控制和行政区请求全部使用 `fetchAuthenticated`。`openEvents` 使用 `openAuthenticatedEvents(apiUrl(...), apiUrl("session"))`。

导出不再直接设置 API URL；使用 `fetchAuthenticated` 获取 Blob，创建 `URL.createObjectURL(blob)`，返回该临时 URL。`app.tsx` 使用该 URL 触发下载后在 `setTimeout` 中调用 `URL.revokeObjectURL(url)`。这样导出遇到 `401` 时不会显示原始 JSON，也不会长期保留 Blob。

- [ ] **Step 6: 运行 Web 验证确认 GREEN**

```powershell
pnpm --filter @stellaris/web test
pnpm --filter @stellaris/web typecheck
$env:VITE_PUBLIC_BASE='/zhengwujianli/'
pnpm --filter @stellaris/web build
Remove-Item Env:VITE_PUBLIC_BASE
node tests/web-subpath-build.test.mjs
```

Expected: 测试、类型检查和构建全部通过，生成 HTML 只引用 `/zhengwujianli/assets/`。

---

### Task 5: 创建腾讯云专用镜像与 Compose 配置

**Files:**
- Modify: `Dockerfile`
- Create: `infra/tencent/compose.yml`
- Create: `infra/tencent/.env.example`
- Create: `infra/tencent/nginx-route.conf`
- Create: `tests/tencent-deploy-config.test.mjs`

**Interfaces:**
- Consumes: Task 2–4 的应用构建和固定端口 `3217`、`3218`。
- Produces: Compose 项目 `stellaris-zhengwujianli`，本机 Backend `127.0.0.1:3217`、Web `127.0.0.1:3218`，不暴露 PostgreSQL。

- [ ] **Step 1: 写入部署配置失败测试**

测试读取 `compose.yml` 和 `nginx-route.conf`，断言：

- 容器名均以 `stellaris-zhengwujianli-` 开头；
- Backend 只绑定 `127.0.0.1:3217:3000`；
- Web 只绑定 `127.0.0.1:3218:80`；
- PostgreSQL 没有 `ports`；
- Nginx API 上游为 `http://127.0.0.1:3217/api/`；
- 页面上游为 `http://127.0.0.1:3218/`；
- 标记块中不存在 `stellaris.ac.cn`；
- Nginx 明确覆盖 `X-IFC-User-ID`；
- Backend、Web、PostgreSQL 都有健康检查和内存限制。

- [ ] **Step 2: 运行测试确认 RED**

```powershell
node tests/tencent-deploy-config.test.mjs
```

Expected: 配置文件尚不存在而失败。

- [ ] **Step 3: 让 Docker 构建接受基础路径**

在 Builder 的构建命令前加入：

```dockerfile
ARG VITE_PUBLIC_BASE=/
ENV VITE_PUBLIC_BASE=${VITE_PUBLIC_BASE}
RUN pnpm build
```

Compose 的 Backend 和 Web 构建均传入 `VITE_PUBLIC_BASE=/zhengwujianli/`，保证同一源码生成一致路径。

- [ ] **Step 4: 编写独立 Compose**

使用以下固定边界：

```yaml
name: stellaris-zhengwujianli
services:
  postgres:
    image: postgres:18
    container_name: stellaris-zhengwujianli-postgres
    mem_limit: 768m
    volumes:
      - /opt/stellaris-zhengwujianli/data/pgdata:/var/lib/postgresql
  backend:
    container_name: stellaris-zhengwujianli-backend
    mem_limit: 2g
    ports: ["127.0.0.1:3217:3000"]
    volumes:
      - /opt/stellaris-zhengwujianli/data/app:/opt/stellaris/data
  web:
    container_name: stellaris-zhengwujianli-web
    mem_limit: 128m
    ports: ["127.0.0.1:3218:80"]
```

PostgreSQL 密码只从 `/opt/stellaris-zhengwujianli/.env` 读取；`.env.example` 只列出 `STELLARIS_PG_PASSWORD=`。Backend 设置 `STELLARIS_EVIDENCE_ROOT=/opt/stellaris/data/evidence`、`STELLARIS_EXPORT_ROOT=/opt/stellaris/data/exports` 和 `STELLARIS_WORKER=1`。

- [ ] **Step 5: 编写可审计 Nginx 标记块**

标记块必须包含：

```nginx
# == Stellaris Tencent independent start ==
location = /_stellaris_session_verify {
    internal;
    proxy_pass http://127.0.0.1:3003/api/stellaris-session/verify;
    proxy_pass_request_body off;
    proxy_set_header Content-Length "";
    proxy_set_header Cookie $http_cookie;
}

location ^~ /zhengwujianli/api/ {
    auth_request /_stellaris_session_verify;
    auth_request_set $ifc_user_id $upstream_http_x_ifc_user_id;
    proxy_set_header X-IFC-User-ID $ifc_user_id;
    proxy_pass http://127.0.0.1:3217/api/;
    proxy_buffering off;
    proxy_read_timeout 3600s;
}

location ^~ /zhengwujianli/ {
    auth_request /_stellaris_session_verify;
    error_page 401 =302 /?redirect=%2Fzhengwujianli%2F&reauth=1;
    proxy_pass http://127.0.0.1:3218/;
}
# == Stellaris Tencent independent end ==
```

同时保留精确路径 `/zhengwujianli` 到 `/zhengwujianli/` 的 301。API location 只保留一条 `proxy_set_header X-IFC-User-ID $ifc_user_id`；Nginx 由此覆盖客户端同名头，防止浏览器身份头透传。

- [ ] **Step 6: 运行部署配置验证确认 GREEN**

```powershell
node tests/tencent-deploy-config.test.mjs
docker compose -f infra/tencent/compose.yml config --quiet
```

Expected: 静态测试通过；Compose 配置可解析且不输出生产秘密。

---

### Task 6: 实现可独立测试的 Stellaris 专用会话模块

**Files:**
- Create: `infra/tencent/auth-system/stellaris-session.cjs`
- Create: `infra/tencent/auth-system/stellaris-session.test.cjs`

**Interfaces:**
- Consumes: 32 字节以上随机密钥、员工稳定 ID、当前时间。
- Produces: `issueSession`、`verifySession`、`readCookie`、`setCookieHeader`、`clearCookieHeader`；Cookie 名 `ifc_stellaris_session`。

- [ ] **Step 1: 写入失败的会话测试**

使用固定测试密钥验证：签发后可解析用户 ID；篡改 payload 或签名失败；过期失败；错误密钥失败；Cookie 设置含 `Path=/zhengwujianli/; HttpOnly; Secure; SameSite=Lax; Max-Age=86400`；清除头使用相同名称与路径且 `Max-Age=0`。

- [ ] **Step 2: 运行测试确认 RED**

```powershell
node --test infra/tencent/auth-system/stellaris-session.test.cjs
```

Expected: 模块不存在而失败。

- [ ] **Step 3: 实现 HMAC 会话格式**

使用 `base64url(JSON payload) + "." + base64url(HMAC-SHA256)`。payload 固定字段：

```js
{ v: 1, sub: String(userId), iat: nowSec, exp: nowSec + 86400 }
```

`verifySession` 先限制令牌总长度不超过 2048，再校验两段格式、JSON 字段类型、版本、过期时间和 `crypto.timingSafeEqual` 签名；返回 `{ userId, issuedAt, expiresAt }`，任何失败返回 `null`，不得抛出含令牌内容的错误。

- [ ] **Step 4: 运行会话测试确认 GREEN**

```powershell
node --test infra/tencent/auth-system/stellaris-session.test.cjs
```

Expected: 全部测试通过，输出不含密钥或令牌。

---

### Task 7: 完成应用全量验证并生成部署包

**Files:**
- Create: `docs/deployment/checkpoints/task-07-full-verification.txt`
- Create outside source tree: `E:\stellaris-zhengwujianli-${deployStamp}.tar`

**Interfaces:**
- Consumes: Task 1–6 完成的独立副本。
- Produces: 通过验证的源码包及 SHA-256。

- [ ] **Step 1: 运行全量验证**

```powershell
Set-Location 'E:\Stellaris-Tencent'
pnpm test
pnpm typecheck
$env:VITE_PUBLIC_BASE='/zhengwujianli/'
pnpm build
Remove-Item Env:VITE_PUBLIC_BASE
node tests/web-subpath-build.test.mjs
node tests/tencent-deploy-config.test.mjs
node --test infra/tencent/auth-system/stellaris-session.test.cjs
docker compose -f infra/tencent/compose.yml config --quiet
```

Expected: 每条命令退出 `0`。

- [ ] **Step 2: 检查源码秘密与阿里云耦合**

扫描源文件，确认不包含 SSH 密码、员工密码、会话密钥、生产 PostgreSQL 密码；允许文档提到 `stellaris.ac.cn`，但 `infra/tencent/nginx-route.conf` 不得包含它。

- [ ] **Step 3: 生成部署归档**

将 `$deployStamp = [DateTime]::UtcNow.ToString('yyyyMMddHHmmss')` 只生成一次，并把 `$archivePath = "E:\stellaris-zhengwujianli-$deployStamp.tar"`。使用该路径创建 tar，排除 `node_modules`、所有 `dist`、`.env`、日志、临时文件和先前归档。归档必须包含锁文件、Dockerfile、`apps`、`packages`、`config`、`infra/tencent` 和测试。

- [ ] **Step 4: 记录归档校验值**

```powershell
Get-FileHash -Algorithm SHA256 -LiteralPath $archivePath
```

将归档绝对路径、字节数和 SHA-256 写入检查点文件，不记录秘密。

---

### Task 8: 在腾讯云候选端口验证账号服务兼容扩展

**Files:**
- Remote candidate: `/www/wwwroot/auth-system/.stellaris-candidate-${deployStamp}/`
- Remote backup: `/www/wwwroot/auth-system/server.js.bak-stellaris-${deployStamp}`
- Remote backup: `/www/wwwroot/homer/index.html.bak-stellaris-${deployStamp}`

**Interfaces:**
- Consumes: Task 6 会话模块、当前 `server.js`、当前员工数据库的临时副本。
- Produces: 原登录 JSON 兼容、专用 Cookie 可验证、退出可清除的候选账号服务。

- [ ] **Step 1: 验证远程目标与候选端口**

通过 Paramiko 解析并精确验证 `/www/wwwroot/auth-system`、`/www/wwwroot/homer/index.html`。检查 `3219` 未监听；若占用则停止，不自动选择未知端口。

- [ ] **Step 2: 创建只影响候选数据库的测试环境**

复制当前账号服务代码和 SQLite 数据库到候选目录。仅在候选数据库插入名为 `__stellaris_canary__` 的临时员工，密码在进程内随机生成，不输出、不写日志，候选验证完成后随候选目录一起删除。

- [ ] **Step 3: 在本地候选副本集成三个接口**

对下载的 `server.js` 候选文件做最小改动：

1. 成功 `/api/verify-login` 响应前调用 `issueSession` 并设置 `Set-Cookie`；原 JSON 不增删字段。
2. `GET /api/stellaris-session/verify` 从 Cookie 验签，按 `sub` 查询员工；员工不存在或 `isAccountExpired(employee)` 时返回 `401`，成功时返回 `204` 和 `X-IFC-User-ID`。
3. `POST /api/stellaris-session/logout` 设置清除 Cookie 头并返回 `{ success: true }`。

密钥从固定文件 `/www/wwwroot/auth-system/.stellaris-session-secret` 读取，长度不足 32 字节时拒绝启动专用接口。

- [ ] **Step 4: 在 `3219` 启动候选账号服务**

候选进程使用候选数据库和独立端口，不停止 PM2 正式服务。等待健康响应，进程退出或端口未监听时停止。

- [ ] **Step 5: 验证登录兼容与会话闭环**

使用候选临时员工请求 `/api/verify-login`：保存 JSON 响应键集合和 `Set-Cookie` 属性；用返回 Cookie 请求专用校验接口，断言 `204` 与正确用户 ID；调用退出接口，断言清除头与相同 Path；篡改 Cookie 后校验接口返回 `401`。

另对无效账号请求比较正式 `3003` 与候选 `3219` 的状态码和 JSON 键集合，确认既有失败协议未变化。

- [ ] **Step 6: 修改 Homer 退出逻辑候选文件**

把 `handleAuthLogout` 改为 `async`，先以 `POST` 调用 `/auth/api/stellaris-session/logout`，在 `finally` 中清除两个既有 `localStorage` 键并显示登录页。不得修改 `APP_DATA`、`DEFAULT_ORDER`、卡片 image 或 URL。

- [ ] **Step 7: 停止候选并安全清理候选目录**

确认候选进程 PID 与命令行都位于候选目录，停止后验证 `3219` 已释放。解析候选目录真实路径，确认它是 `/www/wwwroot/auth-system/.stellaris-candidate-` 的单一普通目录、不是链接，再删除。任何验证失败都停止并保留现场。

---

### Task 9: 部署正式账号扩展和腾讯云独立应用候选

**Files:**
- Remote modify/create: Task 8 通过验证的账号文件。
- Remote create: `/opt/stellaris-zhengwujianli/releases/${deployStamp}/`
- Remote create: `/opt/stellaris-zhengwujianli/.env`
- Remote create: `/opt/stellaris-zhengwujianli/data/`

**Interfaces:**
- Consumes: Task 7 归档、Task 8 已验证候选、空闲端口 `3217/3218`。
- Produces: 尚未接管公网的正式账号扩展和本机可访问的独立应用。

- [ ] **Step 1: 生成一次性部署时间戳并复核资源**

记录单一 UTC 时间戳；再次确认 `3217`、`3218` 空闲，根卷可用空间大于 20 GB、可用内存加可回收缓存大于 2.5 GiB。任一条件不满足则停止。

- [ ] **Step 2: 上传并核对归档**

SFTP 上传到 `/opt/stellaris-zhengwujianli/.upload-${deployStamp}.tar`，比较本地/远端字节数和 SHA-256。只在一致后解压到 `releases/${deployStamp}`。

- [ ] **Step 3: 创建生产秘密和数据目录**

使用 `openssl rand` 生成 PostgreSQL 密码和 32 字节以上会话密钥；命令输出直接重定向到目标文件，不打印终端。设置：

- `/opt/stellaris-zhengwujianli/.env` 权限 `600`；
- `/www/wwwroot/auth-system/.stellaris-session-secret` 权限 `600`；
- 数据目录为普通目录，不得是符号链接或挂载到其他项目数据。

- [ ] **Step 4: 原子部署账号服务文件**

先备份正式 `server.js`、现有会话模块（若存在）和 Homer `index.html`。上传候选文件到同目录临时文件，比较哈希后原子替换。运行 `node --check` 检查两个 JavaScript 文件；检查 Homer 的 `zhengwujianli` 卡片、`DEFAULT_ORDER` 和退出函数各只出现预期次数。

- [ ] **Step 5: 重载 PM2 并执行账号回归**

重载账号服务后验证：正式 `3003` 监听；原无效登录协议不变；专用校验在无 Cookie 时返回 `401`；Homer 首页返回 `200`。任一失败立即恢复三个备份并重载 PM2。

- [ ] **Step 6: 构建并启动独立 Compose**

在 release 目录运行：

```sh
docker compose --env-file /opt/stellaris-zhengwujianli/.env \
  -f infra/tencent/compose.yml build --pull
docker compose --env-file /opt/stellaris-zhengwujianli/.env \
  -f infra/tencent/compose.yml up -d
```

等待三个健康检查通过。检查容器资源限制、端口绑定和日志；日志不得出现数据库密码或会话令牌。

- [ ] **Step 7: 验证本机应用与空库**

验证 `http://127.0.0.1:3218/` 返回专用前端，资源路径构建正确；`http://127.0.0.1:3217/health` 返回 `200`。从 PostgreSQL 查询 `task_run` 数量必须为 `0`，迁移最新项必须是 `2026-08-11-task-owner`，`owner_user_id` 必须为 `NOT NULL`。

- [ ] **Step 8: 在隔离测试数据库执行双账号集成测试**

为同一镜像启动一次性测试 PostgreSQL 与 Backend，仅绑定本机临时端口；运行 Task 3 的 HTTP 双账号测试和全量后端测试。测试结束后验证一次性 Compose 项目名、容器、网络和卷均只属于测试项目，再删除测试项目。正式数据库保持 `task_run=0`。

---

### Task 10: 原子切换 `/zhengwujianli/` 并执行公网验收

**Files:**
- Remote modify: `/www/server/panel/vhost/nginx/tongjixinzhi.cn.conf`
- Remote backup: `/www/server/panel/vhost/nginx/tongjixinzhi.cn.conf.bak-stellaris-${deployStamp}`

**Interfaces:**
- Consumes: Task 9 健康服务、Task 5 Nginx 标记块、正式账号校验接口。
- Produces: 页面和 API 均由腾讯云本机提供，阿里云不再作为该路径上游。

- [ ] **Step 1: 记录切换前基线**

记录以下 URL 的状态码、内容类型和正文 SHA-256：Homer 首页、`/zhengwujianli/`、`/zhengwujianli/api/tasks`、阿里云首页和阿里云 `/api/tasks`。不要记录响应中的员工信息。

- [ ] **Step 2: 构造候选 Nginx 配置**

从活动配置精确删除旧 `# == Stellaris zhengwujianli start/end ==` 块并插入 Task 5 新块。断言旧标记为一对、新标记为一对，`location = /_stellaris_session_verify`、API location、页面 location 各出现一次；新块不含 `stellaris.ac.cn`。

- [ ] **Step 3: 备份并检查候选配置**

将活动配置复制为带时间戳备份。上传候选为同目录普通文件，验证 owner/mode 与活动文件一致，随后原子替换活动配置。立即运行：

```sh
/www/server/nginx/sbin/nginx -t -c /www/server/nginx/conf/nginx.conf
```

Expected: 同时出现 `syntax is ok` 与 `test is successful`。失败时恢复备份，不 reload。

- [ ] **Step 4: Reload 并验证未登录边界**

执行 Nginx reload。无 Cookie 请求页面应 `302` 到固定控制台登录 URL；无 Cookie 请求 API 应 `401`，不得返回 Homer HTML、阿里云 JSON 或 `200`。

- [ ] **Step 5: 验证已登录路径**

从账号数据库只选择两个当前有效员工 ID，不读取密码或身份证号；在单一 Node 进程内存中使用生产密钥签发两个短期验收 Cookie，并由同一进程直接发送 HTTPS 请求，Cookie 不进入命令行、文件或输出。两个 Cookie 分别请求 `/zhengwujianli/api/session`，必须返回各自用户 ID；任务列表均为 `{ tasks: [], total: 0 }`。

- [ ] **Step 6: 验证页面、资源、SSE 配置和导出边界**

使用有效 Cookie 请求页面并提取 JS/CSS URL，逐项断言 `200`、正确 MIME 和 `/zhengwujianli/assets/` 前缀。确认 Nginx API location 含 `proxy_buffering off`、`proxy_read_timeout 3600s`，Backend 跨账号自动化测试已覆盖 SSE 和导出 404。

- [ ] **Step 7: 验证 Homer 与其他项目回归**

确认 Homer 卡片仍为 `zhengwujianli`、URL 仍为 `/zhengwujianli/`、image 和顺序与基线相同。验证 `/auth/` 登录页和至少两个既有代表性应用返回切换前相同状态。确认控制台退出接口返回清除专用 Cookie 的头。

- [ ] **Step 8: 验证阿里云解绑但原站保留**

检查新 Nginx 标记块及其 API 上游不含 `stellaris.ac.cn`；从腾讯云 Backend 日志确认请求到达新容器。`https://stellaris.ac.cn/` 和其 `/api/tasks` 仍返回切换前兼容状态，但不再是腾讯云请求的上游。

- [ ] **Step 9: 失败时执行确定性回滚**

若任一关键验收失败：恢复 Nginx 备份，运行 `nginx -t`，通过后 reload；若登录回归失败，同时恢复账号服务和 Homer 备份并重载 PM2。回滚后重新验证 Homer、旧腾讯云反代和阿里云站点。独立容器可保持停止状态用于诊断，不删除其数据。

- [ ] **Step 10: 保存最终证据**

保存不含秘密的容器状态、健康检查、Nginx 测试输出、路由哈希、公网状态码、空库计数、双账号测试摘要和备份路径到 `E:\Stellaris-Tencent\docs\deployment\checkpoints\task-10-production-cutover.txt`。

---

### Task 11: 完成前最终验证与交付

**Files:**
- Update: `docs/deployment/tencent-source-sha256.txt`
- Create: `docs/deployment/tencent-operations.md`
- Create: `docs/deployment/checkpoints/final-verification.txt`

**Interfaces:**
- Consumes: 已切换的腾讯云系统和全部检查点。
- Produces: 后续维护入口、回滚说明和最终可复核证据。

- [ ] **Step 1: 重新运行本地全量验证**

```powershell
Set-Location 'E:\Stellaris-Tencent'
pnpm test
pnpm typecheck
$env:VITE_PUBLIC_BASE='/zhengwujianli/'
pnpm build
Remove-Item Env:VITE_PUBLIC_BASE
node tests/web-subpath-build.test.mjs
node tests/tencent-deploy-config.test.mjs
node --test infra/tencent/auth-system/stellaris-session.test.cjs
```

Expected: 全部退出 `0`。

- [ ] **Step 2: 重新运行生产只读验证**

确认三个容器健康、正式数据库任务数仍为 `0`、未登录页面/API 行为正确、两个有效会话身份互不混淆、Homer 卡片不变、新路由无阿里云上游、阿里云原站仍正常。

- [ ] **Step 3: 写运维说明**

`tencent-operations.md` 明确：本地维护根目录、远程 release/数据目录、Compose 命令、日志查看、健康检查、备份位置、账号服务文件、会话密钥位置、Nginx 标记、升级顺序和回滚顺序。文档只写变量名和路径，不写秘密值。

- [ ] **Step 4: 按 verification-before-completion 复核证据**

在声明完成前读取每条验证命令的最新退出码和输出，不使用先前缓存结果。最终报告列出：实施文件、测试数量、生产健康、空库、账号隔离、解绑证据、阿里云保留状态、备份位置和已知运维注意事项。
