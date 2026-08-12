# 腾讯云独立部署运维说明

## 当前部署

- 发布目录：`/opt/stellaris-zhengwujianli/releases/20260811T094203Z`
- Compose 文件：`infra/tencent/compose.yml`
- 环境文件：`/opt/stellaris-zhengwujianli/.env`（权限 600；不要把值写入文档或日志）
- 后端：`127.0.0.1:3217`
- Web：`127.0.0.1:3218`
- PostgreSQL：仅 Compose 内网，不发布宿主机端口
- 公网入口：`https://tongjixinzhi.cn/zhengwujianli/`
- Nginx 配置：`/www/server/panel/vhost/nginx/tongjixinzhi.cn.conf`

本次快速部署使用服务器已有的 `postgres:17`（PG 17.10），而不是最初 Compose 中的 `postgres:18-alpine`。原因是 Docker Hub 拉取长期停滞；项目迁移只使用 PostgreSQL 13+ 功能，且切换时数据目录为空。后续升级数据库镜像前，必须先备份数据并验证升级路径。

后端使用 Debian/Tencent HTTPS 镜像安装的系统 Chromium。Compose 通过变量 `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium` 指定浏览器；不要再执行 Playwright 浏览器下载。

## 常用命令

```bash
BASE=/opt/stellaris-zhengwujianli
RELEASE=$BASE/releases/20260811T094203Z
COMPOSE=$RELEASE/infra/tencent/compose.yml

docker compose --env-file "$BASE/.env" -f "$COMPOSE" ps
docker compose --env-file "$BASE/.env" -f "$COMPOSE" logs --tail 200 backend
docker compose --env-file "$BASE/.env" -f "$COMPOSE" logs --tail 200 web
docker compose --env-file "$BASE/.env" -f "$COMPOSE" logs --tail 200 db
```

启动已有镜像，不触发重建或拉取：

```bash
docker compose --env-file "$BASE/.env" -f "$COMPOSE" up -d --no-build --pull never
```

停止服务：

```bash
docker compose --env-file "$BASE/.env" -f "$COMPOSE" down
```

## 健康与数据检查

```bash
docker inspect -f '{{.Name}} {{.State.Status}} {{.State.Health.Status}} {{.RestartCount}}' \
  stellaris-zhengwujianli-db-1 \
  stellaris-zhengwujianli-backend-1 \
  stellaris-zhengwujianli-web-1

ss -ltn | awk '$4 ~ /:3217$|:3218$/ {print}'

docker compose --env-file "$BASE/.env" -f "$COMPOSE" exec -T db \
  psql -U stellaris -d stellaris -Atc 'SELECT count(*) FROM task_run;'
```

端口 3217/3218 必须只显示 `127.0.0.1`；数据库不得有宿主机端口映射。

## 发布更新

1. 在新的时间戳目录中放置完整发布内容，不覆盖旧发布目录。
2. 保留 `.env`，不要重新生成生产密码或会话密钥。
3. 核对 Dockerfile、Compose 和源文件哈希。
4. 只执行一次必要的缓存构建。
5. 三个容器全部 healthy 后，才允许更新 Nginx 路由。
6. Nginx 必须先执行：

```bash
/www/server/nginx/sbin/nginx -t -c /www/server/nginx/conf/nginx.conf
```

只有同时出现 `syntax is ok` 和 `test is successful` 才可 reload。

## 回滚

本次关键备份：

- Nginx 切流前：`/www/server/panel/vhost/nginx/tongjixinzhi.cn.conf.bak-stellaris-20260811T223500Z`
- Nginx 页面跳转修正前：`/www/server/panel/vhost/nginx/tongjixinzhi.cn.conf.bak-pre-login-redirect-20260811T224000Z`
- PG17 切换前 Compose：`/opt/stellaris-zhengwujianli/releases/20260811T094203Z/infra/tencent/compose.yml.pre-pg17-fast-track-20260811T222500Z`
- 系统 Chromium 修改前文件：同一发布目录中的 `*.pre-system-chromium-20260811T214000Z`

恢复 Nginx 时先把指定备份复制为同目录临时普通文件，再原子替换活动文件；随后运行 `nginx -t`，通过后 reload。不要修改同一配置中的其他项目块。

数据库数据目录为 `/opt/stellaris-zhengwujianli/data/postgres`。不要跨 PostgreSQL 主版本直接复用数据目录；升级或回滚前先做独立备份。
