# 腾讯云政务简历开发、候选发布与回滚手册

## 固定边界

- 唯一服务器仓库：`/opt/stellaris-zhengwujianli/repository`；唯一生产分支：`tencent/zhengwujianli`。
- 正式 project：`stellaris-zhengwujianli`；候选 project：`stellaris-zhengwujianli-candidate`。
- 正式端口仅 `127.0.0.1:3217/3218`；候选仅 `127.0.0.1:3227/3228`；数据库不发布端口。
- 禁止进入运行容器修改源码、覆盖当前 release 或执行 `docker compose down`。
- 禁止读取、导出、迁移或修改员工信息；auth-system 只允许健康端点与 PID 检查。

腾讯主机只有 `python3` 命令，因此使用 `python3 -m`。工具仅在自身进程启用 NVM Node 24，不改变默认 Node 20。

## 固定顺序

```bash
cd /opt/stellaris-zhengwujianli/repository
git fetch origin tencent/zhengwujianli
git status --short --branch
python3 -m scripts.tencent_release preflight
python3 -m scripts.tencent_release build
python3 -m scripts.tencent_release candidate-up
python3 -m scripts.tencent_release candidate-verify
python3 -m scripts.tencent_release backup
python3 -m scripts.tencent_release restore-verify
python3 -m scripts.tencent_release promote
python3 -m scripts.tencent_release regression
python3 -m scripts.tencent_release rollback
```

任何命令失败立即停止，不跳过证据门槛，不手工修改报告或清单。

## 命令合同

- `bootstrap`：只创建应用根下的 repository、state 与 candidate-data；拒绝脏工作树、分叉和错误 origin；不 reset/clean/checkout。
- `preflight`：只读检查 Git、运行时、正式政务容器、端口、磁盘、`.env` 权限和 auth 健康；不读取 `.env` 内容。报告 `state/reports/preflight.json`。
- `build`：从干净同步的 40 位 SHA 执行 install/typecheck/完整 test/build，构建两个 SHA 镜像，禁止 `latest`。报告 `state/reports/build.json`。
- `candidate-up`：只对候选 Compose 执行 `up -d --no-build --pull never`，禁止 `down`。清单 `state/manifests/candidate-baseline.json`。
- `candidate-verify`：验证三个候选容器、3227/3228、无 DB 端口、健康/会话/Web 资源及正式容器未变化；只用 `phase0-canary-subject`，不创建任务。
- `backup`：只允许正式政务 DB 容器和数据库 `stellaris`；报告只含哈希、大小、版本、路径，不输出业务行。
- `restore-verify`：只允许候选 DB 容器和 `stellaris_candidate`；只输出迁移版本、表名与计数，禁止恢复正式数据库。
- `promote`：要求同一提交的候选报告和备份清单；只更新 backend/web，不重启 db、auth-system、Homer 或其他项目。
- `regression`：只读验证容器、db/auth 不变、认证边界、资源、Homer、satmap、kdocs-sync 和阿里原站；不访问员工接口或数据库。
- `rollback`：只接受本次 promotion 清单；Compose/Nginx 漂移或旧镜像缺失时拒绝；只恢复 backend/web。

## 报告、失败与恢复

- 报告目录：`/opt/stellaris-zhengwujianli/state/reports/`；清单目录：`state/manifests/`；备份目录：`state/backups/`。
- 目录权限 0700、文件 0600。state、candidate-data、真实 `.env`、归档和完整日志不得提交 Git。
- 构建/候选/备份失败时正式环境保持不变；不得提升。
- 提升健康失败自动按 promotion 清单回滚；Nginx 哈希漂移立即停止。
- 工作树脏、远端分叉、push 失败或其他项目异常时保护现场并停止。
