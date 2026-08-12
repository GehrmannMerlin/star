# `crawler-use-crawlee` 诊断流程与实现转换规则

> 本文件定义本 Skill 的诊断流程、问题分类规则、实现转换规则与证据卡映射。判断依据与边界以主决策日志与已批准设计规格为准。

## 诊断流程

1. 读取项目上下文、目标、约束与已确认根因。处理 Stellaris 问题时，先读取 `stellaris-crawler-context` 生成的项目上下文包路径。
2. 确定诊断聚焦点（Crawler 选择与生命周期 / `RequestQueue` 与请求调度 / `Dataset` 与数据存储 / `AutoscaledPool` 与资源调节 / `SessionPool` 与会话管理 / 代理与配置），聚焦该点，不做无边界全栈诊断。
3. 检查相关 Crawlee 代码、配置、依赖版本、日志和最小复现证据，定位具体证据位置。
4. 引用匹配版本的证据卡（`crawlee.md`）比对项目行为与规范/实现/工程证据。
5. 分类：代码缺陷 / 配置错误 / 版本兼容 / 设计不足 / 外部条件 / 未知项。
6. 证据不足时只提出最小补充取证（最小 Crawlee 复现、相关测试）；根因未证实前不提出代码修改。
7. 将领域 Skill 已确认的方向转换为适合当前 Crawlee 版本（v3.17.0）的具体实现建议。
8. 输出可追溯问题证据、根因或待验证假设、影响范围、修复方向、测试建议。
9. 获准的修复方向交给 `crawler-writing-plans-bridge`。

## 问题分类规则

- **代码缺陷**：Crawlee 代码未按锁定版本行为处理（如错误 API 用法、生命周期误解、资源调节错误）。
- **配置错误**：Crawlee 配置与锁定版本行为不符（如队列、会话、代理配置错误）。
- **版本兼容**：Crawlee 版本与 API 行为不匹配（如引用已变更或已移除的 API）。
- **设计不足**：缺乏请求调度、会话管理、资源调节等设计层面缺失。
- **外部条件**：运行时环境不可用、外部服务受限等——只能给合规降级/等待/终止结论，不得伪装成已修复（主决策日志 §12/§60）。
- **未知项**：证据不足或冲突，保持候选假设，显式标记，不判定为确定根因。

每条结论必须明确区分：事实、证据、综合推断、待确认项。综合推断必须显式标记为"推断"，不得伪装成资料中的确定结论（主决策日志 §14）。

置信度使用固定枚举：高（证据充分且指向唯一分类）、中（证据充分但多个分类可能）、低（证据不足或冲突，仅候选假设）、不确定（无法判断）。

## 实现转换规则

- 将领域 Skill 已确认的方向转换为适合当前 Crawlee 版本（v3.17.0）的具体实现建议。
- 引用锁定版本（apify/crawlee v3.17.0）的 API 与配置语义；不引用不存在或已变更的 API；不默认采用审查时最新 Release 或历史草案版本（主决策日志 §71/§75）。
- 识别"配置合法但运行行为不符合预期"是验收重点——配置合法不等于运行行为正确；RequestQueue 去重、Dataset 写入、AutoscaledPool 调节等需运行时证据判定。
- 不重复跨框架 Frontier/HTTP/浏览器/队列方法论；相关方向交给对应领域 Skill。

## 证据卡映射

共享证据卡：`docs/superpowers/knowledge/evidence-cards/crawlee.md`；知识视图：`docs/superpowers/knowledge/skill-views/crawler-use-crawlee.md`。

| 诊断聚焦点 | 证据卡 | 固定资料路径 |
|---|---|---|
| Crawler 选择与生命周期 | CL-CRAWL-001、CL-CRAWL-002、CL-CRAWL-003 | Crawlee `packages/*/src/internals/*crawler.ts`；`packages/core/src/configuration.ts` |
| `RequestQueue` 与请求调度 | CL-QUEUE-001、CL-QUEUE-002、CL-QUEUE-003 | Crawlee `packages/core/src/storages/request_queue.ts`、`request.ts`、`enqueue_links/` |
| `Dataset` 与数据存储 | CL-DATA-001、CL-DATA-002 | Crawlee `packages/core/src/storages/dataset.ts`、`key_value_store.ts`、`storage_manager.ts` |
| `AutoscaledPool` 与资源调节 | CL-POOL-001、CL-POOL-002、CL-POOL-003 | Crawlee `packages/core/src/autoscaling/autoscaled_pool.ts`、`snapshotter.ts`、`*_load_signal.ts`、`system_status.ts` |
| `SessionPool` 与代理 | CL-SESS-001、CL-PROXY-001 | Crawlee `packages/core/src/session_pool/session_pool.ts`、`session.ts`；`packages/core/src/proxy_configuration.ts` |

每条依据必须可追溯：从诊断记录追到固定版本资料、证据卡、上下文包条目或决策日志节号。只给仓库首页、模糊文件夹或没有版本的引用不满足要求。

## 只读诊断边界

- 诊断默认只指导只读静态审查、配置审查和锁定版本资料比对。
- 任何最小 Crawlee 复现或相关测试动作须获得明确批准。
- 不安装、构建或运行未经批准的项目或第三方代码。
- 不替代项目爬虫运行时；不发起对目标站点的无授权请求；不绕过访问控制。
- 诊断复现限受控、合规；不得发起新的对外抓取或绕过访问控制。

## 证据不足与冲突

- 证据不足时不得把结论判定为确定根因；保留候选状态并标记未知项。
- 现场证据、项目上下文、已批准要求冲突时并列报告，不静默覆盖任一来源。
- 未解决的声明标记为不确定（非确定性），不得伪装成确定结论。
- 固定版本证据卡与既有诊断记录不得被静默改写；更新只通过新增修订进行。
- 不把"配置合法"误判为"运行行为正确"；"配置合法但运行行为不符合预期"需运行时证据判定。
- 外部条件（运行时环境不可用/外部服务受限）只能给合规降级/等待/终止结论，不得伪装成已修复。
- 不得因新技术更新默认要求升级；是否升级以证据和项目约束为准。
