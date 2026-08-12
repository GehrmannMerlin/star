# 爬虫知识资料库首遍资料审查——第 5 批：当前重点技术栈

> 审查日期：2026-07-31
>
> 对应一级方向：当前重点技术栈
>
> 对应 Skills：`crawler-debug-typescript-node`、`crawler-use-crawlee`、`crawler-use-playwright`、`crawler-run-docker`、`crawler-use-postgresql`
>
> 状态：等待用户核对
>
> 边界：本文记录当前项目事实、联网审查事实和 Agent 建议，不是已确认决策。未下载或克隆任何第三方源码，未安装依赖，未启动 Docker 引擎或容器，未设计或实施 Skill，也未修改爬虫代码。

## 1. 审查口径与版本事实边界

### 1.1 已确认决策

- 本批五个 Skill 均是面向 Agent 的实现诊断与修复顾问，不是 TypeScript 编译服务、Node.js 运行时、Crawlee/Playwright 爬虫、Docker 管理器或 PostgreSQL 运维组件。
- 第一遍只发现和审查资料、记录元数据并形成准入、候选和拒绝清单；未经用户核对、且六个一级方向尚未全部完成前，不得固定 Commit 或浅克隆。
- Docker 引擎、镜像、容器、卷、WSL 虚拟磁盘及其他大体量数据必须继续位于 E 盘；第三方资料库采用 50 GB 软上限，并尽量保留 E 盘至少 120 GB 可用空间。

### 1.2 当前项目事实

- `E:\Stellaris` 目前只有 `.superpowers` 和 `docs`，没有爬虫源码、`package.json`、锁文件、`tsconfig.json`、Dockerfile、Compose 文件或数据库配置，因此没有可从项目制品核验的“项目锁定版本”。
- 本机可验证工具状态：Node.js `v24.18.0`、全局 TypeScript `5.9.3`、pnpm `10.28.0`、npm `11.11.0`、Docker CLI `29.5.3`、Docker Compose `v5.1.4`；未找到 `psql`。
- Docker 引擎当前未运行，CLI 无法连接 `dockerDesktopLinuxEngine`；本轮没有启动它。`E:\DockerDesktopWSL` 存在，继续受 E 盘存储硬边界约束。

### 1.3 历史设计草案

- 历史文档曾提出 TypeScript 6.0、Node.js 24 LTS、Crawlee 3.16、Playwright 1.62、PostgreSQL 18 和 Docker 29.5.3。
- 这些值只是历史设计输入，不是当前项目锁定事实，也不得覆盖未来真实的清单、锁文件、镜像标签和数据库版本证据。

### 1.4 本次联网观察与 Agent 建议

- 2026-07-31 的官方资料/Release 元数据显示：TypeScript 最新稳定补丁为 `6.0.3`；Node.js 本机所用 `24.18.0` 为 LTS；Crawlee 最新 Release 为 `3.17.0`；Playwright 最新 Release 为 `1.62.1`；Docker Engine 最新 Release 为 `29.7.0`，Compose 最新 Release 为 `5.3.1`；PostgreSQL 18 当前小版本为 `18.4`。
- 因项目没有版本锁，本批只批准“仓库是否有资格进入第二遍”，不批准最终适用版本。第二遍固定 Commit 前，必须先以届时真实项目制品重新绑定版本；不得仅凭本报告把最新版本或历史草案版本写成项目约束。
- Star、最后推送、Release 和 GitHub `size` 均为审查日观察值，会继续变化。`size` 是完整仓库体积风险代理，不等于固定 Commit 后的实际浅克隆大小。

## 2. Agent 建议：准入的权威在线资料（未确认）

| 来源 | 官方性与适用版本 | 主要用途 | 对应 Skill | 使用边界 |
|---|---|---|---|---|
| [TypeScript Handbook 与 TSConfig Reference](https://www.typescriptlang.org/docs/) | TypeScript 官方；当前文档覆盖 6.0，具体项目版本待锁文件 | 类型收窄、模块、声明、项目引用、编译选项和配置诊断 | `crawler-debug-typescript-node` | 先读取项目 `tsconfig` 和实际编译器版本；不得用 6.0 默认值解释 5.9 项目 |
| [TypeScript 6.0 Release Notes](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-6-0.html) | TypeScript 官方；6.0 | 6.0 默认值、弃用、破坏性变化及 7.0 迁移风险 | `crawler-debug-typescript-node` | 仅在项目确实采用或评估 6.0 时适用；不是当前项目版本证明 |
| [Node.js v24.18.0 API 文档](https://nodejs.org/download/release/latest-v24.x/docs/api/) | Node.js 官方；本机实装 `v24.18.0` LTS | ESM/CommonJS、Stream、Process、Error、AsyncLocalStorage、诊断报告、性能与内存诊断 | `crawler-debug-typescript-node` | 这是当前机器事实，不等于未来项目部署镜像版本 |
| [Node.js 24.18.0 Release](https://nodejs.org/en/blog/release/v24.18.0) | Node.js 官方；`24.18.0` LTS | 补丁变化、依赖更新和兼容性核对 | `crawler-debug-typescript-node` | 只解释该补丁线；跨大版本结论必须重新核对 |
| [Crawlee JavaScript 文档与 API](https://crawlee.dev/js/docs/) | Apify/Crawlee 官方；在线当前 API 显示 3.17，历史草案为 3.16 | Crawler 选择、RequestQueue、Dataset、AutoscaledPool、SessionPool、生命周期、重试与配置 | `crawler-use-crawlee` | 不执行模板、CLI 或抓取示例；最终必须按项目依赖精确选版本化文档 |
| [Crawlee Releases](https://github.com/apify/crawlee/releases) | Crawlee 官方；审查时最新 `v3.17.0` | 识别 API、生命周期和行为变化 | `crawler-use-crawlee` | `3.17.0` 只是当前观察，不覆盖历史草案 `3.16`，也不构成升级建议 |
| [Playwright 文档](https://playwright.dev/docs/intro) | Microsoft Playwright 官方；当前 1.62 系列 | Browser/Context/Page、Locator、自动等待、网络事件、Trace、浏览器安装与启动配置 | `crawler-use-playwright` | 只用于诊断受授权的项目和隔离复现，不承担生产抓取，不提供绕过登录、验证码、访问控制或 WAF 的方法 |
| [Playwright 1.62 Release Notes](https://playwright.dev/docs/release-notes) | Playwright 官方；1.62，仓库补丁 Release 为 `1.62.1` | API 增删、浏览器版本、破坏性变化和调试能力 | `crawler-use-playwright` | Playwright 与浏览器二进制版本必须成组核对；不得只看 npm 包版本 |
| [Playwright Locators](https://playwright.dev/docs/locators) 与 [Auto-waiting](https://playwright.dev/docs/actionability) | Playwright 官方；当前文档 | 定位稳定性、actionability、等待竞态和断言重试 | `crawler-use-playwright` | 优先解释证据中的定位与等待问题，不把强制操作当默认修复 |
| [Playwright Trace Viewer](https://playwright.dev/docs/trace-viewer) 与 [Network](https://playwright.dev/docs/network) | Playwright 官方；当前文档 | Trace、请求/响应、路由、HAR 与失败证据关联 | `crawler-use-playwright` | Trace 可能包含敏感信息；只处理用户授权证据，不上传或外发项目制品 |
| [Docker Engine 29 Release Notes](https://docs.docker.com/engine/release-notes/29/) | Docker 官方；审查时仓库最新 `29.7.0` | Engine/API、存储、网络、安全修复与破坏性变化 | `crawler-run-docker` | 本机 CLI `29.5.3` 落后于当前 Release；这里只记录差异，不启动或升级引擎 |
| [Compose Specification](https://docs.docker.com/reference/compose-file/) | Docker/Compose 官方；Compose Spec 滚动版本，本机 CLI `5.1.4` | services、networks、volumes、healthcheck、depends_on、profiles 与构建定义 | `crawler-run-docker` | 必须按本机/项目实际 Compose 功能核对；顶层 `version` 已属兼容性信息而非格式选择器 |
| [Docker Desktop WSL 2 backend](https://docs.docker.com/desktop/features/wsl/) 与 [WSL best practices](https://docs.docker.com/desktop/features/wsl/best-practices/) | Docker 官方；Windows/WSL 2 当前指南 | 区分 Docker Desktop、WSL、文件系统、资源限制和虚拟磁盘问题 | `crawler-run-docker` | 官方默认 C 盘路径不适用于本项目；Stellaris 已确认的 E 盘硬边界优先 |
| [Docker storage](https://docs.docker.com/engine/storage/) 与 [Volumes](https://docs.docker.com/engine/storage/volumes/) | Docker 官方；当前 Engine | 容器层、bind mount、volume、tmpfs、备份和持久性边界 | `crawler-run-docker` | 只做只读诊断；迁移、删除、清理、重建卷或虚拟磁盘必须另获明确批准 |
| [PostgreSQL 18 Documentation](https://www.postgresql.org/docs/18/) | PostgreSQL 官方；18，当前小版本 `18.4` | SQL、Schema、事务、锁、索引、EXPLAIN、统计信息、日志与服务器配置 | `crawler-use-postgresql` | 项目尚无服务端、驱动和迁移工具版本；不得仅因历史草案写入 PostgreSQL 18 约束 |
| [PostgreSQL Versioning Policy](https://www.postgresql.org/support/versioning/) | PostgreSQL 官方；18 支持至 2030-11-14 | 大/小版本语义、支持期和升级风险 | `crawler-use-postgresql` | 大版本升级需要独立迁移评估；本 Skill 不自行升级数据库 |
| [PostgreSQL Concurrency Control](https://www.postgresql.org/docs/18/mvcc.html)、[Indexes](https://www.postgresql.org/docs/18/indexes.html) 与 [EXPLAIN](https://www.postgresql.org/docs/18/sql-explain.html) | PostgreSQL 官方；18 | 隔离级别、锁等待/死锁、索引选择和查询计划证据 | `crawler-use-postgresql` | 默认只读诊断；`ANALYZE`、DDL、数据修改和修复迁移必须经过规划与明确批准 |

## 3. Agent 建议：准入清单（未确认）

| 仓库 | 官方性/作用 | Star | 维护状态 | 许可证 | 适用版本候选 | GitHub 体积代理 | 对应 Skill | 建议理由 |
|---|---|---:|---|---|---|---:|---|---|
| [microsoft/TypeScript](https://github.com/microsoft/TypeScript) | TypeScript 编译器、语言服务、测试与版本化实现 | 110,013 | 活跃；最后推送 2026-07-27 | Apache-2.0 | 当前 Release `v6.0.3`；最终按项目锁文件 | 约 2.82 GiB | TypeScript/Node.js | 直接实现与回归测试是编译通过但运行/声明行为异常的重要证据；虽历史体积大，但属于核心技术栈 |
| [nodejs/node](https://github.com/nodejs/node) | Node.js 官方运行时、内置模块文档与测试 | 118,572 | 活跃；最后推送 2026-07-30 | Node.js 主体 MIT 风格许可，根 LICENSE 同时列明外部组件许可 | 本机对应 `v24.18.0`；最终按项目运行时 | 约 1.46 GiB | TypeScript/Node.js | 内置模块、错误码、ESM、Stream、进程、诊断和跨平台测试的直接实现依据；第二遍须固定 24.x 或真实部署版本，不取默认主干 |
| [apify/crawlee](https://github.com/apify/crawlee) | Crawlee JavaScript/TypeScript 官方源码、文档、示例和测试 | 25,115 | 活跃；最后推送 2026-07-30 | Apache-2.0 | 当前 `v3.17.0`；历史草案 3.16；最终按项目锁文件 | 约 167.9 MiB | Crawlee | RequestQueue、AutoscaledPool、SessionPool、Crawler 生命周期和适配器行为均需版本化源码/测试佐证 |
| [microsoft/playwright](https://github.com/microsoft/playwright) | Playwright 官方 Node.js 实现、协议适配、浏览器补丁和测试 | 93,733 | 活跃；最后推送 2026-07-30 | Apache-2.0 | 当前 `v1.62.1`；最终按项目锁文件及配套浏览器 | 约 234.1 MiB | Playwright | Locator、自动等待、Context/Page 生命周期、网络与 Trace 的具体行为集中在此；不得运行生产抓取或规避访问控制 |
| [moby/moby](https://github.com/moby/moby) | Docker Engine 上游实现、API、网络、存储和回归测试 | 71,935 | 活跃；最后推送 2026-07-30 | Apache-2.0 | 当前 `docker-v29.7.0`；本机 CLI 29.5.3，Engine 未运行 | 约 261.5 MiB | Docker | 用于区分 daemon、网络、volume、资源与应用问题；第二遍只能取与实际 Engine 对应的发布标签 |
| [docker/cli](https://github.com/docker/cli) | Docker 官方 CLI 与 Engine API 客户端 | 5,977 | 活跃；最后推送 2026-07-30 | Apache-2.0 | 与实际 Engine/CLI 版本绑定 | 约 272.5 MiB | Docker | CLI 输出、上下文、连接和 API 兼容问题不能只从 daemon 源码解释 |
| [docker/compose](https://github.com/docker/compose) | Docker Compose 官方实现与测试 | 37,888 | 活跃；最后推送 2026-07-30 | Apache-2.0 | 当前 `v5.3.1`；本机 `v5.1.4` | 约 27.6 MiB | Docker | Compose 解析、依赖、healthcheck、网络、卷和生命周期行为的直接实现证据；不构成升级建议 |
| [compose-spec/compose-spec](https://github.com/compose-spec/compose-spec) | Compose Specification 官方规范源码 | 2,716 | 活跃；最后推送 2026-07-17 | Apache-2.0 | 滚动 `main`；第二遍固定审查日 Commit | 约 0.9 MiB | Docker | 小体积、语言无关，可把规范要求与 Docker Compose 具体实现分开核对 |
| [microsoft/WSL](https://github.com/microsoft/WSL) | Microsoft WSL 官方源码、工具与问题证据 | 33,256 | 活跃；最后推送 2026-07-31 | MIT | 当前 Release `2.7.11`；最终按本机 WSL | 约 75.9 MiB | Docker | Docker Desktop WSL 后端故障需要区分 WSL 内核/文件系统与 Docker 问题；不授权迁移或修改虚拟磁盘 |
| [postgres/postgres](https://github.com/postgres/postgres) | PostgreSQL 官方 Git 仓库镜像，含服务器、客户端、文档和回归测试 | 21,642 | 活跃；最后推送 2026-07-31 | PostgreSQL License；GitHub 自动识别为 `NOASSERTION`，已由官网许可页核对 | 当前 `REL_18_4_STABLE`；最终按真实服务器版本 | 约 745.1 MiB | PostgreSQL | 事务、锁、优化器、索引、SQLSTATE 与版本回归的权威实现证据；默认只读分析 |
| [docker-library/postgres](https://github.com/docker-library/postgres) | Docker Official Image 的 PostgreSQL 镜像定义与入口脚本 | 2,502 | 活跃；最后推送 2026-07-16 | MIT | 与项目镜像标签绑定 | 约 1.2 MiB | Docker、PostgreSQL | 小体积且直接覆盖镜像初始化、环境变量、数据目录与升级边界；不能替代 PostgreSQL 服务端版本证据 |

准入仓库 GitHub 体积代理合计约 **6,169.4 MiB（6.03 GiB）**。其中 TypeScript、Node.js 和 PostgreSQL 的完整历史占主要部分；第二遍应固定版本并浅克隆，实际体积需在执行前重新预估。本批当前不触发任何下载。

## 4. Agent 建议：候选清单（未确认，不下载）

| 仓库 | Star | 维护状态 | 许可证 | GitHub 体积代理 | 对应 Skill | 暂不准入原因 |
|---|---:|---|---|---:|---|---|
| [microsoft/TypeScript-Website](https://github.com/microsoft/TypeScript-Website) | 2,542 | 活跃；最后推送 2026-07-16 | CC-BY-4.0 | 约 115.5 MiB | TypeScript/Node.js | 官方在线文档已准入，核心编译器仓库也含版本证据；整站源码目前重复 |
| [nodejs/nodejs.org](https://github.com/nodejs/nodejs.org) | 6,861 | 活跃；最后推送 2026-07-30 | MIT | 约 120.3 MiB | TypeScript/Node.js | 主要是官网与非 API 内容；版本化 API 文档和 `nodejs/node` 已覆盖实现诊断 |
| [microsoft/playwright.dev](https://github.com/microsoft/playwright.dev) | 187 | 活跃；最后推送 2026-07-30 | CC-BY-4.0 | 约 101.6 MiB | Playwright | 官方但与在线文档及 `microsoft/playwright` 文档目录重复；先保留在线来源 |
| [docker/docs](https://github.com/docker/docs) | 4,619 | 活跃；最后推送 2026-07-31 | Apache-2.0 | 约 722.1 MiB | Docker | 在线文档权威且可按页面引用，整站源码体积较大；若第二遍确需离线版本化文档再复审 |
| [nodejs/diagnostics](https://github.com/nodejs/diagnostics) | 550 | 活跃；最后推送 2026-04-15 | MIT | 约 4.6 MiB | TypeScript/Node.js | 官方工作组材料有诊断价值，但成熟 API 和版本化运行时行为仍以 Node 文档/源码为主 |
| [brianc/node-postgres](https://github.com/brianc/node-postgres) | 13,188 | 活跃；最后推送 2026-07-21 | MIT | 约 4.8 MiB | PostgreSQL | 历史草案曾涉及 `pg`，但项目没有 `package.json` 或锁文件；只有真实采用后才可升格并绑定版本 |
| [kysely-org/kysely](https://github.com/kysely-org/kysely) | 14,082 | 活跃；最后推送 2026-07-30 | MIT | 约 53.6 MiB | PostgreSQL、TypeScript/Node.js | 属历史设计候选 ORM/查询构建器，不是当前项目事实；等待依赖清单 |
| [graphile/worker](https://github.com/graphile/worker) | 2,350 | 活跃；最后推送 2026-07-08 | MIT | 约 11.3 MiB | PostgreSQL、TypeScript/Node.js | 属历史设计中的任务队列选择，未被当前项目制品证实；不得提前变成运行时约束 |
| [porsager/postgres](https://github.com/porsager/postgres) | 8,683 | 活跃；最后推送 2026-04-05 | Unlicense | 约 1.5 MiB | PostgreSQL | 是另一 Node.js 驱动实现，但项目未采用；避免为“可能使用”收集多个重叠驱动 |
| [docker/awesome-compose](https://github.com/docker/awesome-compose) | 45,939 | 活跃；最后推送 2026-07-30 | CC0-1.0 | 约 11.3 MiB | Docker | 官方示例丰富，但通用示例不能替代项目 Compose、规范和具体实现证据 |
| [docker-library/official-images](https://github.com/docker-library/official-images) | 6,988 | 活跃；最后推送 2026-07-31 | Apache-2.0 | 约 33.6 MiB | Docker、PostgreSQL | 覆盖全部 Official Images，范围过宽；当前只需小而直接的 `docker-library/postgres` |

## 5. Agent 建议：拒绝清单（未确认，不下载）

| 仓库 | Star | 维护/许可事实 | 对应 Skill | 拒绝理由 |
|---|---:|---|---|---|
| [microsoft/TypeScript-Handbook](https://github.com/microsoft/TypeScript-Handbook) | 4,853 | 已归档；最后推送 2020-08-01；Apache-2.0 | TypeScript/Node.js | 已由当前 TypeScript Website/Handbook 取代，容易把旧文档误当当前行为 |
| [DefinitelyTyped/DefinitelyTyped](https://github.com/DefinitelyTyped/DefinitelyTyped) | 51,351 | 活跃；GitHub 许可证 `NOASSERTION`；约 800.4 MiB | TypeScript/Node.js | 全生态类型定义集合过宽，项目没有依赖清单；不能为未知依赖收集整个仓库 |
| [nodejs/help](https://github.com/nodejs/help) | 1,586 | 主要为支持问题；无明确根许可证；约 0.1 MiB | TypeScript/Node.js | Issue 讨论不是固定版本、稳定且可复制的源码知识底座；个案可在未来按证据在线引用 |
| [docker/for-win](https://github.com/docker/for-win) | 1,949 | 主要为 Docker Desktop Windows 问题跟踪；无明确根许可证；约 37 KiB | Docker | 不是 Docker Desktop 源码或稳定规范，且问题内容随外部上下文变化；使用官方文档和具体已授权诊断证据 |
| [apify/crawlee-python](https://github.com/apify/crawlee-python) | 9,376 | 活跃；Apache-2.0；约 40.0 MiB | Crawlee | 本批 Skill 明确面向 JavaScript/TypeScript Crawlee；Python 实现会引入错误 API 与生命周期类比 |
| [goldbergyoni/nodebestpractices](https://github.com/goldbergyoni/nodebestpractices) | 105,468 | 活跃；CC-BY-SA-4.0；约 68.0 MiB | TypeScript/Node.js | 高质量社区汇编但非 Node.js 官方、非项目版本化实现；官方 API、Release、源码和测试已经覆盖当前最小充分底座 |

## 6. 事实、建议与后续边界

### 当前项目事实

- 项目尚无可核验的语言、框架、容器或数据库锁定版本。
- 本机版本与当前官方 Release 存在差异：全局 TypeScript 为 5.9.3，而官方稳定线已到 6.0.3；Docker CLI/Compose 分别为 29.5.3/5.1.4，而当前 Release 分别为 29.7.0/5.3.1。
- Docker 引擎未运行，`psql` 不可用；这些状态只证明当前环境，不能证明项目缺陷。

### 历史设计草案

- TypeScript 6.0、Node.js 24、Crawlee 3.16、Playwright 1.62、PostgreSQL 18、Docker 29.5.3 仍只作为历史设计输入保留。

### Agent 建议，等待用户核对

- 建议批准第 2 节的权威在线资料、第 3 节的 11 个准入仓库、第 4 节的 11 个候选仓库和第 5 节的 6 个拒绝仓库。
- 即使本批获批，也只确认仓库资格和分类，不确认项目版本，不触发下载。全部第一遍批次完成后，第二遍仍须先获得真实项目版本证据、固定具体 Commit、复核许可与预计浅克隆体积，再写入 E 盘资料区。
- 不启动 Docker、不安装 `psql` 或依赖、不运行第三方示例、不创建 Skill、不进入 `writing-plans`，也不修改爬虫代码。
