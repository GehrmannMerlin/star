# crawler-use-crawlee 知识视图

> 本视图是 `crawler-use-crawlee` Skill 的独立知识视图，只保留与"Crawlee 专项实现诊断、修复顾问"职责相关的知识。来源身份、版本与许可证事实由共享证据层统一维护，本视图通过稳定证据卡 ID 引用，不复制原始来源元数据。

## 定位、触发与排除项

- **定位**：面向 Agent 的 Crawlee 专项实现诊断、修复顾问；依托项目锁定 Crawlee 版本（v3.17.0）对应的官方文档、发布说明、故障案例和源码，帮助 Agent 检查 Crawler 选择、`RequestQueue`、`Dataset`、`AutoscaledPool`、`SessionPool`、代理、生命周期和配置，识别错误 API 用法、版本差异、生命周期误解、队列或会话配置错误和资源调节问题。
- **不是**：项目爬虫运行时的替代品。
- **触发**：用户要求检查 Crawlee 专项实现相关设计或故障；已确认问题涉及 Crawler 选择、`RequestQueue`、`Dataset`、`AutoscaledPool`、`SessionPool`、代理、生命周期或配置。
- **排除**：不重复跨框架 Frontier/HTTP/浏览器/队列方法论（交给对应领域 Skill）；跨领域根因由对应领域 Skill 判断；Docker→`crawler-run-docker`；不越过批准边界/不跳过 `crawler-writing-plans-bridge`；不生成 `writing-plans`。

## 最低证据输入

- 项目上下文（处理 Stellaris 问题时为 `stellaris-crawler-context` 项目上下文包路径）。
- 已确认根因与方向（`crawler-triage-incidents` 分诊结论，适用时）。
- 相关 Crawlee 代码、配置、依赖版本、日志和最小复现证据。
- 固定版本资料（批次 5：apify/crawlee v3.17.0）。

## 知识主题与证据卡映射

### Crawler 选择与生命周期

- 判断 Crawler 类型选择、生命周期、Configuration 是否符合锁定版本行为；Crawler 选择错误、生命周期误解、配置错误是常见问题。
- 证据卡：[[CL-CRAWL-001]]（Crawler 类型与选择）、[[CL-CRAWL-002]]（Crawler 生命周期）、[[CL-CRAWL-003]]（Configuration 语义）。
- 依据固定版本：Crawlee `packages/*/src/internals/*crawler.ts`；`packages/core/src/configuration.ts`。

### RequestQueue 与请求调度

- 判断 RequestQueue 语义、请求调度、去重/优先级/重试是否符合锁定版本行为；去重失败、入队错误、重试风暴是常见问题。
- 证据卡：[[CL-QUEUE-001]]（RequestQueue 语义）、[[CL-QUEUE-002]]（请求调度与入队）、[[CL-QUEUE-003]]（去重、优先级与重试）。
- 依据固定版本：Crawlee `packages/core/src/storages/request_queue.ts`、`request.ts`、`enqueue_links/`。

### Dataset 与数据存储

- 判断 Dataset 语义、KeyValueStore/存储管理是否符合锁定版本行为；数据未写入、存储隔离错误是常见问题。
- 证据卡：[[CL-DATA-001]]（Dataset 语义）、[[CL-DATA-002]]（KeyValueStore 与存储管理）。
- 依据固定版本：Crawlee `packages/core/src/storages/dataset.ts`、`key_value_store.ts`、`storage_manager.ts`。

### AutoscaledPool 与资源调节

- 判断 AutoscaledPool、Snapshotter/负载信号、资源调节是否符合锁定版本行为；并发失控、资源调节未生效是常见问题。
- 证据卡：[[CL-POOL-001]]（AutoscaledPool 语义）、[[CL-POOL-002]]（Snapshotter 与负载信号）、[[CL-POOL-003]]（资源调节）。
- 依据固定版本：Crawlee `packages/core/src/autoscaling/autoscaled_pool.ts`、`snapshotter.ts`、`*_load_signal.ts`、`system_status.ts`。

### SessionPool 与代理

- 判断 SessionPool 语义、代理配置是否符合锁定版本行为；会话串用、Cookie 隔离失败、代理配置错误是常见问题。
- 证据卡：[[CL-SESS-001]]（SessionPool 语义）、[[CL-PROXY-001]]（代理配置）。
- 依据固定版本：Crawlee `packages/core/src/session_pool/session_pool.ts`、`session.ts`；`packages/core/src/proxy_configuration.ts`。

## 实现转换规则

- 将领域 Skill 已确认的修复方向转换为适合当前 Crawlee 版本（v3.17.0）的具体实现建议。
- 引用锁定版本（apify/crawlee v3.17.0）的 API 与配置语义；不引用不存在或已变更的 API；不默认采用最新 Release 或历史草案版本。
- 识别"配置合法但运行行为不符合预期"是验收重点——配置合法不等于运行行为正确。

## 版本化判断规则

- 每条判断依据必须追溯到固定版本资料（ref＋Commit）、证据卡、上下文包条目或决策日志节号；只给仓库首页或没有版本的引用不满足要求。
- 明确区分事实、证据、综合推断与未知项；综合推断必须显式标记"推断"，不得伪装成资料中的确定结论。
- 不得因新技术更新默认要求升级；是否升级以证据和项目约束为准。
- 案例证据与工程证据不得单独升格为跨项目通用规范或确定根因。

## 输出、交接与禁止越权

- **输出**：可追溯问题证据、根因或待验证假设、影响范围、修复方向（Crawlee 实现建议）、测试建议。
- **交接**：将领域确认方向转换为 Crawlee 实现建议，不越过批准边界/不跳过 `crawler-writing-plans-bridge`；获准修复方向→`crawler-writing-plans-bridge`；跨领域根因→对应领域 Skill；Docker→`crawler-run-docker`。
- **禁止越权**：不替代项目爬虫运行时、不重复跨框架方法论、不把配置合法误判为运行行为正确、不生成 `writing-plans`、不初始化 Git、不记录敏感信息原件。

## 视图自检

- 全部证据卡 ID（CL-CRAWL-*、CL-QUEUE-*、CL-DATA-*、CL-POOL-*、CL-SESS-*、CL-PROXY-*）在 `crawlee.md` 中存在且被本视图引用。
- 无未标注的推断；每条判断可追溯到证据卡或固定资料。
- 未复制相邻 Skill（`crawler-debug-http-network`、`crawler-automate-browsers`、`crawler-discover-frontier`、`crawler-tune-queues`、`crawler-run-docker`）的职责。
