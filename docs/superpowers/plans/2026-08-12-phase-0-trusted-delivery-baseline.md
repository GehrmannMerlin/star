# Phase 0 Trusted Delivery Baseline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在腾讯云建立只影响政务简历采集系统的服务器 Git 工作区、独立候选环境、不可变镜像、证据化发布和确定性回滚链路，并完成一次无采集业务变更的演练。

**Architecture:** 用仓库内 JSON 发布合同约束目录、容器、端口和数据库边界；用 Python 3 标准库工具执行预检、构建、候选验证、专用数据库备份、提升和回滚；Docker Compose 分离正式与候选环境。所有命令先经过精确目标校验，证据写入应用专用状态目录，任何检查失败均停止且不触碰账号服务或员工数据库。

**Tech Stack:** Git、Python 3.11+ 标准库、Node.js 24 `node:test`、pnpm 10、Docker Engine/Compose、PostgreSQL 17、Nginx、SHA-256、Linux system utilities。

## Global Constraints

- 唯一工作分支为 `tencent/zhengwujianli`，服务器工作目录固定为 `/opt/stellaris-zhengwujianli/repository`。
- 正式应用根目录固定为 `/opt/stellaris-zhengwujianli`，不得操作该目录之外的文件。
- 正式 Compose project 固定为 `stellaris-zhengwujianli`；候选 project 固定为 `stellaris-zhengwujianli-candidate`。
- 正式容器前缀固定为 `stellaris-zhengwujianli-`；候选容器前缀固定为 `stellaris-zhengwujianli-candidate-`。
- 正式端口固定为 `127.0.0.1:3217/3218`；候选端口固定为 `127.0.0.1:3227/3228`；数据库不得发布宿主机端口。
- 候选数据库、证据和导出目录固定在 `/opt/stellaris-zhengwujianli/candidate-data/`，不得引用正式 `/data/` 目录。
- 本阶段不改变采集器业务逻辑、不运行真实批量采集、不修改数据库 schema。
- 本阶段自动化门槛为发布专项测试、部署合同测试、全量 typecheck 和全量 build 全绿；`pnpm test` 必须完整运行并与既有基线比较，允许仅保留已登记的阶段 1“取消状态竞争”失败，但不得新增失败，也不得描述为全量测试通过。
- 只允许备份政务系统专用 PostgreSQL；禁止连接、查询、备份、导出、迁移或修改员工数据库。
- 不读取员工姓名、身份证号、手机号、密码、费用、组织关系或员工列表。
- 认证服务 `127.0.0.1:3003` 和 `/www/wwwroot/auth-system` 仅作端点存活检查，不读取其数据库或源码，不重启、不修改。
- 所有测试主体使用字面量 `phase0-canary-subject`，不得使用真实员工账号。
- 密钥、Cookie、完整环境变量和数据库密码不得写入 Git、报告或命令输出。
- 每次服务器写操作前必须验证绝对路径、目标类型、容器前缀、Compose project 和数据库名称；验证失败立即退出。
- 正式数据库恢复不属于本阶段自动化；恢复演练只导入候选数据库。
- 提升失败必须自动使用提升前清单中的镜像重新启动正式政务容器。

---

## File Map

### 发布合同与 Compose

- Create: `infra/tencent/release-contract.json` — 机器可读的路径、分支、端口、容器、数据库和禁止目标合同。
- Modify: `infra/tencent/compose.yml` — 正式环境改为使用提交哈希镜像变量，保留正式数据目录和端口。
- Create: `infra/tencent/compose.candidate.yml` — 候选 project、候选端口及独立数据目录。
- Modify: `infra/tencent/.env.example` — 列出不含秘密的正式镜像变量和数据库名称。
- Create: `infra/tencent/.env.candidate.example` — 候选环境变量模板，固定虚拟环境语义。

### 发布工具

- Create: `scripts/tencent_release/__init__.py` — Python 包入口。
- Create: `scripts/tencent_release/contract.py` — 加载并验证发布合同。
- Create: `scripts/tencent_release/scope.py` — 路径、容器、端口和数据库目标保护。
- Create: `scripts/tencent_release/runner.py` — 无 shell 拼接的子进程执行、超时和脱敏输出。
- Create: `scripts/tencent_release/preflight.py` — Git、宿主机、Docker、端口、磁盘和环境预检。
- Create: `scripts/tencent_release/bootstrap.py` — 建立服务器 Git 工作区和状态目录。
- Create: `scripts/tencent_release/build.py` — 从干净提交构建并标记 backend/web 镜像。
- Create: `scripts/tencent_release/candidate.py` — 启停及验证候选环境。
- Create: `scripts/tencent_release/backup.py` — 专用 PostgreSQL 备份、校验和候选恢复验证。
- Create: `scripts/tencent_release/promote.py` — 记录旧镜像、提升新镜像并回归。
- Create: `scripts/tencent_release/rollback.py` — 只按已保存清单恢复上一组政务镜像。
- Create: `scripts/tencent_release/report.py` — 生成脱敏 JSON/文本证据报告。
- Create: `scripts/tencent_release/__main__.py` — `python -m scripts.tencent_release <command>` CLI。

### 测试、文档与进度

- Modify: `tests/tencent-deploy-config.test.mjs` — 扩展正式与候选配置合同测试。
- Create: `tests/test_tencent_release_contract.py` — 发布合同和范围保护单元测试。
- Create: `tests/test_tencent_release_workflow.py` — 使用假命令执行器测试构建、提升和回滚控制流。
- Modify: `package.json` — 增加 `test:tencent-release` 和 `verify:tencent-release`。
- Create: `docs/superpowers/progress/tencent-production-recovery-progress.md` — 唯一恢复进度总账。
- Create: `docs/operations/tencent-development-and-release.md` — 新版服务器开发、候选、发布和回滚手册。
- Modify: `docs/deployment/tencent-operations.md` — 标记旧时间戳说明为历史部署记录并链接新手册。
- Modify: `docs/superpowers/progress/crawler-project-status-and-roadmap.md` — 更正旧“P1-P6 全部完成”的生产口径。
- Modify: `docs/superpowers/progress/crawler-development-progress.md` — 指向唯一腾讯生产恢复总账。

## Interfaces

发布工具共享以下接口，任务实现不得自行改名：

```python
@dataclass(frozen=True)
class ReleaseContract:
    app_root: Path
    repository: Path
    branch: str
    production_project: str
    candidate_project: str
    production_ports: tuple[int, int]
    candidate_ports: tuple[int, int]
    allowed_container_prefixes: tuple[str, ...]
    forbidden_path_fragments: tuple[str, ...]
    forbidden_database_names: tuple[str, ...]

def load_contract(path: Path) -> ReleaseContract: ...
def require_clean_synced_repository(contract: ReleaseContract) -> str: ...
def require_path_in_app_root(contract: ReleaseContract, path: Path) -> Path: ...
def require_container_name(contract: ReleaseContract, name: str) -> str: ...
def require_database_target(contract: ReleaseContract, container: str, database: str) -> None: ...
def run_checked(argv: list[str], *, timeout: int, redact: tuple[str, ...] = ()) -> CompletedCommand: ...
def write_report(report_dir: Path, name: str, payload: Mapping[str, object]) -> Path: ...
```

CLI 固定为：

```text
python -m scripts.tencent_release bootstrap
python -m scripts.tencent_release preflight
python -m scripts.tencent_release build
python -m scripts.tencent_release candidate-up
python -m scripts.tencent_release candidate-verify
python -m scripts.tencent_release backup
python -m scripts.tencent_release restore-verify
python -m scripts.tencent_release promote
python -m scripts.tencent_release regression
python -m scripts.tencent_release rollback
```

### Task 1: 建立机器可读发布合同和范围保护

**Files:**
- Create: `infra/tencent/release-contract.json`
- Create: `scripts/tencent_release/__init__.py`
- Create: `scripts/tencent_release/contract.py`
- Create: `scripts/tencent_release/scope.py`
- Create: `tests/test_tencent_release_contract.py`
- Modify: `package.json`

**Interfaces:**
- Produces: `ReleaseContract`、`load_contract()`、`require_path_in_app_root()`、`require_container_name()`、`require_database_target()`。
- Consumes: 无。

- [ ] **Step 1: 写发布合同加载与拒绝越界目标的失败测试**

```python
from pathlib import Path
import unittest

from scripts.tencent_release.contract import load_contract
from scripts.tencent_release.scope import (
    require_container_name,
    require_database_target,
    require_path_in_app_root,
)


class ReleaseContractTest(unittest.TestCase):
    def setUp(self) -> None:
        self.contract = load_contract(Path("infra/tencent/release-contract.json"))

    def test_contract_has_exact_production_and_candidate_boundaries(self) -> None:
        self.assertEqual(self.contract.branch, "tencent/zhengwujianli")
        self.assertEqual(self.contract.production_ports, (3217, 3218))
        self.assertEqual(self.contract.candidate_ports, (3227, 3228))
        self.assertNotEqual(self.contract.production_project, self.contract.candidate_project)

    def test_rejects_path_outside_application_root(self) -> None:
        with self.assertRaisesRegex(ValueError, "outside application root"):
            require_path_in_app_root(self.contract, Path("/www/wwwroot/auth-system"))

    def test_rejects_employee_or_unknown_container(self) -> None:
        with self.assertRaisesRegex(ValueError, "container is not allowlisted"):
            require_container_name(self.contract, "auth-system")

    def test_rejects_forbidden_database_name(self) -> None:
        with self.assertRaisesRegex(ValueError, "database target is forbidden"):
            require_database_target(
                self.contract,
                "stellaris-zhengwujianli-candidate-db-1",
                "employees",
            )
```

- [ ] **Step 2: 运行测试确认 RED**

Run: `python -m unittest tests.test_tencent_release_contract -v`

Expected: FAIL，提示 `scripts.tencent_release.contract` 不存在。

- [ ] **Step 3: 写入精确发布合同**

`infra/tencent/release-contract.json` 必须包含以下实际值：

```json
{
  "appRoot": "/opt/stellaris-zhengwujianli",
  "repository": "/opt/stellaris-zhengwujianli/repository",
  "branch": "tencent/zhengwujianli",
  "productionProject": "stellaris-zhengwujianli",
  "candidateProject": "stellaris-zhengwujianli-candidate",
  "productionPorts": [3217, 3218],
  "candidatePorts": [3227, 3228],
  "productionDatabase": "stellaris",
  "candidateDatabase": "stellaris_candidate",
  "allowedContainerPrefixes": [
    "stellaris-zhengwujianli-",
    "stellaris-zhengwujianli-candidate-"
  ],
  "forbiddenPathFragments": [
    "/www/wwwroot/auth-system",
    "/www/server/panel/data",
    "/www/backup/database"
  ],
  "forbiddenDatabaseNames": [
    "employees",
    "employee",
    "auth",
    "auth_system"
  ],
  "productionCompose": "infra/tencent/compose.yml",
  "candidateCompose": "infra/tencent/compose.candidate.yml",
  "stateDirectory": "/opt/stellaris-zhengwujianli/state",
  "candidateDataDirectory": "/opt/stellaris-zhengwujianli/candidate-data"
}
```

- [ ] **Step 4: 实现合同解析和范围保护**

`contract.py` 使用不可变 dataclass，拒绝缺失字段、相同 project、端口重叠、相对服务器路径和非 `tencent/zhengwujianli` 分支。`scope.py` 使用 `Path.resolve(strict=False)` 后按父目录关系判断，禁止字符串前缀判断；容器名称必须完整匹配允许前缀，数据库名称先转小写再与禁止集合比较。

- [ ] **Step 5: 增加统一测试命令并确认 GREEN**

在 `package.json` 增加：

```json
"test:tencent-release": "python -m unittest discover -s tests -p 'test_tencent_release_*.py' -v",
"verify:tencent-release": "pnpm test:tencent-release && node --test tests/tencent-deploy-config.test.mjs"
```

Run: `pnpm test:tencent-release`

Expected: 4 个发布合同测试全部 PASS。

- [ ] **Step 6: 提交**

```bash
git add infra/tencent/release-contract.json scripts/tencent_release package.json tests/test_tencent_release_contract.py
git commit -m "feat(ops): add Tencent release scope contract"
```

### Task 2: 建立服务器 Git 工作区和安全预检

**Files:**
- Create: `scripts/tencent_release/runner.py`
- Create: `scripts/tencent_release/report.py`
- Create: `scripts/tencent_release/bootstrap.py`
- Create: `scripts/tencent_release/preflight.py`
- Create: `scripts/tencent_release/__main__.py`
- Create: `tests/test_tencent_release_workflow.py`

**Interfaces:**
- Consumes: `ReleaseContract`、`load_contract()`、全部 scope guard。
- Produces: `run_checked()`、`write_report()`、`require_clean_synced_repository()`、CLI 的 `bootstrap` 和 `preflight`。

- [ ] **Step 1: 写工作树同步、命令脱敏和预检失败测试**

```python
class PreflightTest(unittest.TestCase):
    def test_dirty_repository_is_rejected(self) -> None:
        fake = FakeRunner({("git", "status", "--porcelain"): " M app.ts\n"})
        with self.assertRaisesRegex(RuntimeError, "working tree is not clean"):
            require_clean_synced_repository(CONTRACT, runner=fake)

    def test_local_commit_must_equal_remote_branch(self) -> None:
        fake = FakeRunner({
            ("git", "status", "--porcelain"): "",
            ("git", "branch", "--show-current"): "tencent/zhengwujianli\n",
            ("git", "rev-parse", "HEAD"): "aaa\n",
            ("git", "rev-parse", "origin/tencent/zhengwujianli"): "bbb\n",
        })
        with self.assertRaisesRegex(RuntimeError, "does not match origin"):
            require_clean_synced_repository(CONTRACT, runner=fake)

    def test_report_redacts_secret_values(self) -> None:
        payload = redact_payload({"password": "secret", "status": "ok"})
        self.assertEqual(payload, {"password": "[REDACTED]", "status": "ok"})
```

- [ ] **Step 2: 运行测试确认 RED**

Run: `python -m unittest tests.test_tencent_release_workflow.PreflightTest -v`

Expected: FAIL，缺少 runner、report 和 preflight 模块。

- [ ] **Step 3: 实现无 shell 拼接执行器和脱敏报告**

`run_checked()` 只接受参数数组并调用 `subprocess.run(..., shell=False, check=False, capture_output=True, text=True, timeout=timeout)`。报告递归隐藏键名匹配 `password|secret|token|cookie|authorization|credential` 的值；报告文件先写同目录临时文件、`chmod 0600` 后用 `os.replace()` 原子替换。

- [ ] **Step 4: 实现 bootstrap**

`bootstrap` 必须：

1. 验证 `/opt/stellaris-zhengwujianli` 已存在且是普通目录；
2. 创建 `repository`、`state/reports`、`state/manifests`、`state/backups` 和 `candidate-data/{postgres,evidence,exports}`；
3. 若仓库不存在，执行 `git clone --branch tencent/zhengwujianli --single-branch https://github.com/GehrmannMerlin/star.git repository`；
4. 若仓库存在，验证 `origin` 精确指向该仓库，执行 `git fetch origin tencent/zhengwujianli`；
5. 禁止自动 reset、clean、checkout 或覆盖未提交文件；
6. 将状态目录设为 root 可读写且非全局可读；
7. 验证服务器具备向远端推送的凭据；若 `git push --dry-run origin HEAD:tencent/zhengwujianli` 失败，停止并报告需要为该仓库配置写权限 deploy key，不回显任何凭据。

- [ ] **Step 5: 实现 preflight**

预检必须检查并写入 `preflight.json`：

- 当前分支、干净工作树、HEAD 与远端一致；
- Node `>=24`、pnpm `>=10`、Python `>=3.11`、Docker 和 Compose 可用；
- 正式三个容器名称精确匹配并健康；
- 3217/3218 仅监听回环地址，3227/3228 空闲或只属于候选容器；
- 正式 PostgreSQL 没有宿主机端口；
- 应用根目录剩余空间至少 10 GiB；
- 合同中的路径均位于应用根目录；
- 环境文件权限不是 group/world readable；
- 不打开或输出 `.env` 内容；
- 认证服务只用 `curl http://127.0.0.1:3003/health` 或已知无数据会话探针检查，不读取源码和数据库。

- [ ] **Step 6: 运行单元测试确认 GREEN**

Run: `pnpm test:tencent-release`

Expected: 合同、工作树、脱敏和预检控制流测试全部 PASS。

- [ ] **Step 7: 在本地 dry-run CLI**

Run: `python -m scripts.tencent_release preflight --dry-run`

Expected: 输出将检查的服务器资源清单，不执行 SSH、不创建目录、不运行 Docker。

- [ ] **Step 8: 提交**

```bash
git add scripts/tencent_release tests/test_tencent_release_workflow.py
git commit -m "feat(ops): add safe Tencent workspace preflight"
```

### Task 3: 创建提交哈希镜像和独立候选环境

**Files:**
- Modify: `infra/tencent/compose.yml`
- Create: `infra/tencent/compose.candidate.yml`
- Modify: `infra/tencent/.env.example`
- Create: `infra/tencent/.env.candidate.example`
- Modify: `tests/tencent-deploy-config.test.mjs`
- Create: `scripts/tencent_release/build.py`
- Create: `scripts/tencent_release/candidate.py`
- Modify: `scripts/tencent_release/__main__.py`
- Modify: `tests/test_tencent_release_workflow.py`

**Interfaces:**
- Consumes: `require_clean_synced_repository()`、`run_checked()`、scope guard、`write_report()`。
- Produces: `build_images(commit_sha)`、`candidate_up(commit_sha)`、`candidate_verify(commit_sha)`。

- [ ] **Step 1: 扩展 Compose 合同失败测试**

```javascript
test("candidate environment is isolated from production", async () => {
  const candidate = await read("infra/tencent/compose.candidate.yml");
  assert.match(candidate, /^name: stellaris-zhengwujianli-candidate$/m);
  assert.match(candidate, /127\.0\.0\.1:3227:3000/);
  assert.match(candidate, /127\.0\.0\.1:3228:80/);
  assert.match(candidate, /candidate-data\/postgres/);
  assert.match(candidate, /candidate-data\/evidence/);
  assert.match(candidate, /candidate-data\/exports/);
  assert.doesNotMatch(candidate, /\/data\/postgres/);
  assert.doesNotMatch(candidate, /127\.0\.0\.1:3217|127\.0\.0\.1:3218/);
});

test("production deploy consumes immutable image names", async () => {
  const compose = await read("infra/tencent/compose.yml");
  assert.match(compose, /image: \$\{STELLARIS_BACKEND_IMAGE:\?/);
  assert.match(compose, /image: \$\{STELLARIS_WEB_IMAGE:\?/);
  assert.doesNotMatch(compose, /\n    build:/);
});
```

- [ ] **Step 2: 运行配置测试确认 RED**

Run: `node --test tests/tencent-deploy-config.test.mjs`

Expected: FAIL，候选 Compose 不存在且正式 Compose 仍使用 `build`。

- [ ] **Step 3: 实现正式和候选 Compose**

正式 Compose 的 backend/web 分别使用：

```yaml
image: ${STELLARIS_BACKEND_IMAGE:?set STELLARIS_BACKEND_IMAGE}
image: ${STELLARIS_WEB_IMAGE:?set STELLARIS_WEB_IMAGE}
```

候选 Compose 使用 project `stellaris-zhengwujianli-candidate`、数据库 `stellaris_candidate`、端口 3227/3228 和 `/opt/stellaris-zhengwujianli/candidate-data/`。候选 backend 设置 `STELLARIS_WORKER=0`，避免阶段 0 执行采集任务；三个服务仍保留健康检查和内存上限。

- [ ] **Step 4: 写构建和候选控制流失败测试**

```python
def test_build_tags_both_images_with_full_commit(self) -> None:
    runner = FakeRunner.clean_repo(commit="7ecbb8daa8c51b53d13fca03488c658047ff4967")
    result = build_images(CONTRACT, runner=runner)
    self.assertEqual(result.backend_image, "stellaris-zhengwujianli-backend:7ecbb8daa8c51b53d13fca03488c658047ff4967")
    self.assertEqual(result.web_image, "stellaris-zhengwujianli-web:7ecbb8daa8c51b53d13fca03488c658047ff4967")

def test_candidate_never_uses_production_ports_or_directories(self) -> None:
    env = candidate_environment(CONTRACT, "abc123")
    self.assertEqual(env["COMPOSE_PROJECT_NAME"], "stellaris-zhengwujianli-candidate")
    self.assertNotIn("/data/postgres", " ".join(env.values()))
```

- [ ] **Step 5: 实现不可变构建**

`build_images()` 先运行 `pnpm install --frozen-lockfile`、`pnpm typecheck`、`pnpm test`、`pnpm build`，再分别执行：

```text
docker build --target backend --build-arg VITE_PUBLIC_BASE=/zhengwujianli/ -t "stellaris-zhengwujianli-backend:${VERIFIED_COMMIT}" .
docker build --target web --build-arg VITE_PUBLIC_BASE=/zhengwujianli/ -t "stellaris-zhengwujianli-web:${VERIFIED_COMMIT}" .
```

`VERIFIED_COMMIT` 必须由 `git rev-parse HEAD` 读取，并先验证为 40 位小写十六进制且等于 `origin/tencent/zhengwujianli`，不能为空。构建后用 `docker image inspect` 保存两个镜像 ID 和 RepoDigest；不得使用 `latest`。

- [ ] **Step 6: 实现候选启动和验证**

`candidate-up` 只调用候选 Compose，使用候选 `.env` 和提交镜像名执行 `up -d --no-build --pull never`。`candidate-verify` 检查：

- 三个候选容器 healthy 且 restart count 为 0；
- 3227/3228 只监听回环；
- 候选数据库无宿主机端口；
- `http://127.0.0.1:3227/health` 返回 200；
- `http://127.0.0.1:3228/` 标题为政务简历采集且资源可加载；
- 使用 `X-IFC-User-ID: phase0-canary-subject` 请求候选 API 时只验证会话边界，不创建任务；
- 正式容器 ID、镜像 ID和 restart count 与候选启动前一致。

- [ ] **Step 7: 运行配置及工作流测试确认 GREEN**

Run: `pnpm verify:tencent-release`

Expected: Node Compose 合同测试和 Python 发布工具测试全部 PASS。

- [ ] **Step 8: 提交**

```bash
git add infra/tencent scripts/tencent_release tests package.json
git commit -m "feat(ops): add isolated Tencent candidate deployment"
```

### Task 4: 实现专用数据库备份和候选恢复验证

**Files:**
- Create: `scripts/tencent_release/backup.py`
- Modify: `scripts/tencent_release/__main__.py`
- Modify: `tests/test_tencent_release_workflow.py`

**Interfaces:**
- Consumes: scope guard、`run_checked()`、`write_report()`。
- Produces: `backup_production_database()`、`verify_backup_in_candidate()`、`BackupManifest`。

- [ ] **Step 1: 写数据库目标保护和备份命令失败测试**

```python
def test_backup_uses_only_production_stellaris_container(self) -> None:
    runner = FakeRunner()
    backup_production_database(CONTRACT, runner=runner, timestamp="20260812T120000Z")
    command = runner.find_command("pg_dump")
    self.assertIn("stellaris-zhengwujianli-db-1", command)
    self.assertIn("--dbname=stellaris", command)
    self.assertNotIn("auth", " ".join(command).lower())
    self.assertNotIn("employee", " ".join(command).lower())

def test_restore_is_allowed_only_in_candidate_database(self) -> None:
    with self.assertRaisesRegex(ValueError, "restore target must be candidate"):
        verify_backup_in_candidate(CONTRACT, target_container="stellaris-zhengwujianli-db-1")
```

- [ ] **Step 2: 运行测试确认 RED**

Run: `python -m unittest tests.test_tencent_release_workflow.BackupTest -v`

Expected: FAIL，`backup.py` 不存在。

- [ ] **Step 3: 实现生产专用数据库备份**

备份流程必须：

1. 精确验证容器 `stellaris-zhengwujianli-db-1`；
2. 在容器内确认 `current_database() = 'stellaris'`；
3. 输出到应用目录中的临时文件；
4. 执行 `pg_dump --format=custom --no-owner --no-acl --dbname=stellaris`；
5. 用 `pg_restore --list` 验证归档可读；
6. 计算 SHA-256、记录字节数和 PostgreSQL 版本；
7. `chmod 0600`，以实测 UTC 时间和 SHA-256 命名后原子移动到 `state/backups/`；
8. 报告只记录计数、哈希、版本和文件路径，不查询或打印任何业务行。

- [ ] **Step 4: 实现候选恢复验证**

只允许目标 `stellaris-zhengwujianli-candidate-db-1` 和数据库 `stellaris_candidate`。先验证候选 project 标签，再重建候选数据库，执行 `pg_restore --clean --if-exists --no-owner --no-acl`，运行迁移版本和表计数查询。输出只包含表名及计数，不输出行内容。正式数据库绝不作为 restore 目标。

- [ ] **Step 5: 运行测试确认 GREEN**

Run: `pnpm test:tencent-release`

Expected: 备份仅命中正式政务容器，恢复仅命中候选容器，越界目标全部被拒绝。

- [ ] **Step 6: 提交**

```bash
git add scripts/tencent_release/backup.py scripts/tencent_release/__main__.py tests/test_tencent_release_workflow.py
git commit -m "feat(ops): add scoped database backup verification"
```

### Task 5: 实现提升、回归和确定性回滚

**Files:**
- Create: `scripts/tencent_release/promote.py`
- Create: `scripts/tencent_release/rollback.py`
- Modify: `scripts/tencent_release/__main__.py`
- Modify: `tests/test_tencent_release_workflow.py`

**Interfaces:**
- Consumes: 镜像构建结果、候选报告、备份清单、scope guard、runner、report。
- Produces: `PromotionManifest`、`promote()`、`run_regression()`、`rollback()`。

- [ ] **Step 1: 写“无候选证据不得提升”和失败自动回滚测试**

```python
def test_promote_requires_matching_candidate_report(self) -> None:
    with self.assertRaisesRegex(RuntimeError, "candidate report does not match commit"):
        promote(CONTRACT, commit="newsha", candidate_report={"commit": "oldsha"})

def test_failed_health_check_restarts_previous_images(self) -> None:
    runner = FakeRunner.fail_on("production-health")
    with self.assertRaisesRegex(RuntimeError, "promotion failed and rollback completed"):
        promote(CONTRACT, commit="newsha", runner=runner, candidate_report=GOOD_REPORT)
    self.assertTrue(runner.used_image("backend:oldsha"))
    self.assertTrue(runner.used_image("web:oldsha"))

def test_rollback_refuses_manifest_for_another_project(self) -> None:
    with self.assertRaisesRegex(ValueError, "manifest project mismatch"):
        rollback(CONTRACT, {"project": "auth-system"})
```

- [ ] **Step 2: 运行测试确认 RED**

Run: `python -m unittest tests.test_tencent_release_workflow.PromotionTest -v`

Expected: FAIL，提升和回滚模块不存在。

- [ ] **Step 3: 实现提升清单**

提升前保存：

- 当前完整提交；
- 正式 backend/web 镜像引用和镜像 ID；
- 三个正式容器 ID、健康状态和 restart count；
- Compose 文件 SHA-256；
- Nginx 活动配置 SHA-256；
- 专用数据库备份清单；
- 匹配相同提交的候选验证报告。

提升只更新正式 Compose 使用的两个镜像变量并执行 `up -d --no-build --pull never backend web`，不执行 `down`，不重启 db、auth-system、Homer 或其他项目。

- [ ] **Step 4: 实现生产回归**

`regression` 检查：

- 正式三个政务容器 healthy；db 容器 ID 未改变；
- 3217/3218 仅回环；
- 未登录公网页面保持登录跳转，未登录 API 保持 401；
- `/zhengwujianli/` 静态资源路径正确；
- `/health` 返回 200；
- `https://tongjixinzhi.cn/`、`/satmap/`、`/kdocs-sync/` 和 `https://stellaris.ac.cn/` 返回既定可用状态；
- `auth-system` PID 未改变；
- 不查询任何员工接口或数据库。

- [ ] **Step 5: 实现确定性回滚**

`rollback()` 只接受本次提升写出的清单，校验 project、Compose 哈希和镜像存在后，恢复旧 backend/web 镜像并等待健康。若提升前后 Nginx 哈希不同则立即停止，因为阶段 0 不授权修改 Nginx。回滚后重复生产回归并生成 `rollback.json`。

- [ ] **Step 6: 运行测试确认 GREEN**

Run: `pnpm test:tencent-release`

Expected: 无候选报告、错误 project、健康失败和 Nginx 漂移均被拒绝；健康失败自动恢复旧镜像。

- [ ] **Step 7: 提交**

```bash
git add scripts/tencent_release/promote.py scripts/tencent_release/rollback.py scripts/tencent_release/__main__.py tests/test_tencent_release_workflow.py
git commit -m "feat(ops): add deterministic Tencent promotion rollback"
```

### Task 6: 建立唯一进度总账和新版运维手册

**Files:**
- Create: `docs/superpowers/progress/tencent-production-recovery-progress.md`
- Create: `docs/operations/tencent-development-and-release.md`
- Modify: `docs/deployment/tencent-operations.md`
- Modify: `docs/superpowers/progress/crawler-project-status-and-roadmap.md`
- Modify: `docs/superpowers/progress/crawler-development-progress.md`
- Modify: `tests/tencent-deploy-config.test.mjs`

**Interfaces:**
- Consumes: 阶段状态词、CLI 命令和报告路径。
- Produces: 唯一生产进度事实来源与可执行操作手册。

- [ ] **Step 1: 写文档口径失败测试**

```javascript
test("Tencent production progress is the sole production truth", async () => {
  const progress = await read("docs/superpowers/progress/tencent-production-recovery-progress.md");
  assert.match(progress, /阶段 0 \| 可信交付基线 \| 实施中/);
  assert.match(progress, /禁止读取、导出、迁移或修改员工信息/);
  assert.match(progress, /候选环境真实验证通过/);

  const oldRoadmap = await read("docs/superpowers/progress/crawler-project-status-and-roadmap.md");
  assert.match(oldRoadmap, /历史开发记录/);
  assert.doesNotMatch(oldRoadmap, /结论.*P1~P6 全部规划模块完成并部署/);
});
```

- [ ] **Step 2: 运行测试确认 RED**

Run: `node --test tests/tencent-deploy-config.test.mjs`

Expected: FAIL，新进度总账尚不存在且旧文档仍含错误生产结论。

- [ ] **Step 3: 写唯一进度总账**

总账首页必须包含阶段表、当前提交、当前正式镜像、当前候选镜像、最近报告目录、最近备份清单、回滚目标、已知限制和下一动作。阶段 0 初始状态写为 `实施中`，阶段 1 至 8 写为 `未开始`；不得预先填写成功任务编号。

- [ ] **Step 4: 写新版运维手册**

手册按以下顺序提供精确命令：

```bash
cd /opt/stellaris-zhengwujianli/repository
git fetch origin tencent/zhengwujianli
git status --short --branch
python -m scripts.tencent_release preflight
python -m scripts.tencent_release build
python -m scripts.tencent_release candidate-up
python -m scripts.tencent_release candidate-verify
python -m scripts.tencent_release backup
python -m scripts.tencent_release restore-verify
python -m scripts.tencent_release promote
python -m scripts.tencent_release regression
python -m scripts.tencent_release rollback
```

手册必须说明每个命令的允许目标、报告位置、失败语义、禁止目标和恢复入口，并明确禁止进入容器改源码。

- [ ] **Step 5: 修正旧进度文档**

保留旧文档作为历史开发记录，但删除“P1-P6 全部生产完成”的当前结论。在开头添加醒目链接，声明生产状态只以 `tencent-production-recovery-progress.md` 为准。

- [ ] **Step 6: 运行配置测试确认 GREEN**

Run: `node --test tests/tencent-deploy-config.test.mjs`

Expected: Compose、Nginx、候选隔离和进度口径测试全部 PASS。

- [ ] **Step 7: 提交**

```bash
git add docs tests/tencent-deploy-config.test.mjs
git commit -m "docs: establish Tencent production recovery ledger"
```

### Task 7: 完成本地全量验证和阶段 0 候选发布包

**Files:**
- Modify: `docs/superpowers/progress/tencent-production-recovery-progress.md`

**Interfaces:**
- Consumes: Tasks 1-6 全部工具和文档。
- Produces: 可在腾讯云执行的已验证提交。

- [ ] **Step 1: 运行发布专项验证**

Run: `pnpm verify:tencent-release`

Expected: Python 发布工具测试与 Node 部署合同测试全部 PASS。

- [ ] **Step 2: 运行全量类型检查**

Run: `pnpm typecheck`

Expected: 所有 workspace package 成功，退出码 0。

- [ ] **Step 3: 运行全量测试**

Run: `pnpm test`

Expected: 完整输出与既有基线相比不得新增失败。若取消竞争测试仍失败，阶段 0 报告必须登记测试名称、预期状态、实际状态和阶段 1 入口，且明确写为“全量业务测试仍有 1 项已知失败”。

- [ ] **Step 4: 运行全量构建和子路径检查**

Run: `pnpm build && node tests/web-subpath-build.test.mjs`

Expected: 构建退出码 0，Web 资源均以 `/zhengwujianli/assets/` 开头。

- [ ] **Step 5: 扫描秘密与越界引用**

Run:

```powershell
git grep -n -I -E "007007Tjxz|POSTGRES_PASSWORD=.+|BEGIN (RSA|OPENSSH) PRIVATE KEY|employee.*(select|update|delete)|auth-system.*(restart|reload|stop)" -- . ":(exclude)pnpm-lock.yaml"
```

Expected: 不出现真实凭据、私钥、员工数据库语句或账号服务变更命令；允许文档中的禁止规则文字需人工确认不是可执行命令。

- [ ] **Step 6: 更新总账为自动化验证结果**

记录真实提交、命令、退出码和仍失败的已知测试。发布专项测试、部署合同测试、typecheck、build、子路径检查全部通过，并且全量业务测试没有新增失败时，阶段 0 可写为 `自动化验证通过（业务基线仍有阶段 1 已知失败）`；任一阶段 0 所属检查失败或出现新业务测试失败时保持 `实施中`。

- [ ] **Step 7: 提交并推送**

```bash
git add docs/superpowers/progress/tencent-production-recovery-progress.md
git commit -m "chore: record phase zero local verification"
git push origin tencent/zhengwujianli
```

### Task 8: 在腾讯云执行无业务变更的候选、提升和回滚演练

**Files:**
- Modify: `docs/superpowers/progress/tencent-production-recovery-progress.md`
- Modify: `docs/operations/tencent-development-and-release.md`（仅在演练发现命令差异时）

**Interfaces:**
- Consumes: 已推送且自动化验证通过的完整提交。
- Produces: 阶段 0 的候选、提升、回归、回滚和最终恢复证据。

- [ ] **Step 1: 对服务器执行只读身份与边界核验**

确认主机为 `43.142.31.198`，应用根、正式三个容器、3217/3218、Nginx 路由和其他项目与发布合同一致。不得读取员工文件、数据库或数据接口。

- [ ] **Step 2: 建立或核对服务器 Git 工作区**

Run: `python -m scripts.tencent_release bootstrap`

Expected: 工作目录位于 `/opt/stellaris-zhengwujianli/repository`，分支正确、工作树干净、远端同步、push dry-run 成功。若服务器缺少 GitHub 写权限，停止在此步并配置仓库专用 write deploy key；不得复用或输出用户个人令牌。

- [ ] **Step 3: 运行服务器预检**

Run: `python -m scripts.tencent_release preflight`

Expected: 生成脱敏 `preflight.json`，所有目标限定在应用目录与政务容器。

- [ ] **Step 4: 构建提交哈希镜像并启动候选**

Run:

```bash
python -m scripts.tencent_release build
python -m scripts.tencent_release candidate-up
python -m scripts.tencent_release candidate-verify
```

Expected: 候选三个容器 healthy，3227/3228 仅回环，正式三个容器和其他项目没有重启。

- [ ] **Step 5: 备份专用数据库并在候选恢复验证**

Run:

```bash
python -m scripts.tencent_release backup
python -m scripts.tencent_release restore-verify
```

Expected: 生成 SHA-256 备份清单；归档只恢复到 `stellaris_candidate`，报告只含表计数，不含业务行。

- [ ] **Step 6: 提升相同业务代码的提交镜像**

Run:

```bash
python -m scripts.tencent_release promote
python -m scripts.tencent_release regression
```

Expected: backend/web 使用提交哈希镜像；db、auth-system 和其他项目 PID/容器不变；公网认证边界和子路径资源正常。

- [ ] **Step 7: 执行一次回滚演练**

Run: `python -m scripts.tencent_release rollback`

Expected: 恢复提升前 backend/web 镜像，正式回归全部通过，Nginx 和数据库未更改。

- [ ] **Step 8: 再次提升已验证镜像并完成最终回归**

Run:

```bash
python -m scripts.tencent_release promote
python -m scripts.tencent_release regression
```

Expected: 正式服务运行提交哈希镜像，三个容器 healthy，其他项目不受影响。

- [ ] **Step 9: 更新进度总账和运维差异**

记录真实报告目录、提交、镜像 ID、备份哈希、提升时间、回滚时间和最终回归。报告不得包含员工信息、Cookie、密码或完整环境变量。所有硬门槛通过后将阶段 0 标为 `生产验证通过`。

- [ ] **Step 10: 提交服务器证据索引并推送**

只提交脱敏后的证据索引和文档，不提交备份、完整日志、`.env` 或服务器秘密：

```bash
git add docs/superpowers/progress/tencent-production-recovery-progress.md docs/operations/tencent-development-and-release.md
git commit -m "docs: record Tencent phase zero production verification"
git push origin tencent/zhengwujianli
```

- [ ] **Step 11: 建立阶段标签**

```bash
PHASE_DATE="$(date -u +%Y%m%d)"
PHASE_SHA="$(git rev-parse --short=8 HEAD)"
test -n "$PHASE_DATE" && test -n "$PHASE_SHA"
PHASE_TAG="tencent-phase-0-verified-${PHASE_DATE}-${PHASE_SHA}"
printf '%s\n' "$PHASE_TAG"
git tag -a "$PHASE_TAG" -m "Tencent phase 0 production verified"
git push origin "$PHASE_TAG"
```

标签变量的生成命令必须全部成功，并在创建前打印核对；不得手工猜测。若任一变量为空则停止，不执行 `git tag`。

## Phase 0 Completion Gate

阶段 0 只有全部满足才可完成：

- [ ] 服务器工作区为 `tencent/zhengwujianli`，工作树干净且与远端一致。
- [ ] 服务器能够用仓库专用凭据推送该分支。
- [ ] 发布合同和所有越界拒绝测试通过。
- [ ] 全量 typecheck、test、build 结果如实记录；已知业务缺陷未被掩盖。
- [ ] 候选数据库、目录、端口和容器与正式环境隔离。
- [ ] 候选三个容器健康且未创建真实采集任务。
- [ ] 专用数据库备份可读并成功恢复到候选数据库。
- [ ] 提升过程没有重启数据库、账号服务或其他项目。
- [ ] 公网认证边界、静态资源和 API 健康通过。
- [ ] Homer、satmap、kdocs-sync 和阿里原站回归通过。
- [ ] 完成一次回滚并再次提升。
- [ ] 所有报告完成脱敏且未包含员工信息。
- [ ] 进度总账、运维手册、远端分支和阶段标签同步。

阶段 0 完成后，下一步是为阶段 1“任务执行底座”执行独立 brainstorming 和 writing-plans，不在阶段 0 顺带修改任务状态机。
