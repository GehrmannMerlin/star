# 政务简历采集子路径部署设计

## 目标

保留公开入口 `https://tongjixinzhi.cn/zhengwujianli/`，使应用中心卡片点击后加载真实的“政务简历采集”应用，而不是回退到 Homer 首页。

后端、数据库和现有主站 `https://stellaris.ac.cn/` 保持不变。Homer 服务器只托管一个适配 `/zhengwujianli/` 的前端构建，并把带前缀的 API 请求反向代理到现有 Stellaris 后端。

## 已确认现状

- `tongjixinzhi.cn` 解析到 `43.142.31.198`，该服务器承载 Homer 应用中心。
- `stellaris.ac.cn` 解析到 `47.238.145.24`，该服务器承载真实 Stellaris 前后端。
- Homer 卡片使用 `/zhengwujianli/`，但该路径当前命中 Homer 的 SPA fallback，返回与首页完全相同的 HTML。
- Stellaris 当前前端构建使用根级 `/assets/...` 静态资源路径。
- Stellaris 前端通过根级 `/api/...` 访问任务、地区、导出和 SSE 接口。
- Homer 的根级 `/api/` 已被其他应用占用，不能改为 Stellaris API。

## 方案选择

采用“子路径专用静态前端 + 带前缀 API 反向代理”。

不采用运行时 `sub_filter` 改写上游 HTML 和 JavaScript，因为它依赖构建产物中的字符串形式，前端重新打包后容易失效。不在 Homer 服务器复制后端与数据库，避免重复基础设施和数据同步问题。

## 应用改动

### 可配置基础路径

Vite 构建基础路径由环境变量控制：

- 默认构建继续使用 `/`，保证 `https://stellaris.ac.cn/` 不受影响。
- Homer 专用构建使用 `/zhengwujianli/`，使脚本、样式和其他静态资源位于该前缀下。

前端 API 基础路径从 Vite 的构建基础路径派生：

- 默认构建请求 `/api/...`。
- Homer 专用构建请求 `/zhengwujianli/api/...`。

任务列表、任务详情、结果、证据、导出、任务控制、地区接口和 EventSource 必须统一使用同一个 API URL 构造函数，避免遗漏硬编码根路径。

### 测试边界

新增单元测试覆盖：

- 根路径构建生成 `/api/...`。
- `/zhengwujianli/` 构建生成 `/zhengwujianli/api/...`。
- 查询参数和路径参数不会丢失。
- EventSource 与普通 fetch 使用相同前缀。

遵循红—绿流程：先建立能够复现当前错误路径的失败测试，再实现最小改动使其通过。

## Homer 服务器部署

### 静态文件

将专用构建上传到独立目录：

`/www/wwwroot/homer/zhengwujianli/`

上传使用临时目录，完成文件校验后再切换到正式目录。已有目录若存在，先移动为带时间戳的备份，避免半成品上线并提供快速回滚点。

### Nginx 路由

在活动站点配置 `/www/server/panel/vhost/nginx/tongjixinzhi.cn.conf` 中增加：

1. 精确路径 `/zhengwujianli` 返回 301 到 `/zhengwujianli/`。
2. `/zhengwujianli/api/` 去除公开前缀后代理到 `https://stellaris.ac.cn/api/`。
3. `/zhengwujianli/` 从专用静态目录提供文件，并把未知前端路由回退到 `/zhengwujianli/index.html`。

API 代理设置正确的上游 Host 和 SNI，转发客户端 IP、协议与主机信息。SSE 请求关闭代理缓冲和缓存，延长读取超时；普通 JSON、导出请求和 EventSource 共用相同的前缀路由。

## 安全发布与回滚

1. 修改前备份活动 Nginx 配置和现有静态目录。
2. 上传到临时目录并检查 `index.html`、JavaScript 和 CSS 文件存在且非空。
3. 写入候选 Nginx 配置后运行 `nginx -t`。
4. 仅在语法检查通过后原子替换配置并执行 reload。
5. 任一步失败都停止，不继续扩大修改；保留原配置和原静态目录。
6. 若上线后验证失败，恢复配置备份和静态目录备份，再次执行 `nginx -t` 与 reload。

## 验收标准

- `https://tongjixinzhi.cn/zhengwujianli/` 返回 HTTP 200，页面标题为“政务简历采集”，内容不再等于 Homer 首页。
- 页面引用的 JavaScript 和 CSS 都位于 `/zhengwujianli/assets/`，并返回正确 MIME 类型和 HTTP 200。
- `/zhengwujianli/api/tasks` 与 `/zhengwujianli/api/regions/provinces` 返回与 Stellaris 上游一致的成功 JSON。
- EventSource 请求使用 `/zhengwujianli/api/.../events`，代理不缓冲流式响应。
- 应用中心卡片仍指向 `/zhengwujianli/`，点击后打开真实应用。
- `https://stellaris.ac.cn/` 原站继续正常返回 HTTP 200。
- Homer 首页及现有根级 `/api/` 路由不受影响。

## 非目标

- 不迁移 Stellaris 后端、PostgreSQL 数据库或证据文件。
- 不改变 `stellaris.ac.cn` 的现有部署结构。
- 不把 Homer 根级 `/api/` 改为 Stellaris API。
- 不使用 iframe、跨域重定向或运行时 JavaScript 字符串替换来伪装子路径部署。
