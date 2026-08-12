# Crawlee 专项实现证据卡（共享证据层）

> 本文件是共享可追溯证据层中与 Crawlee 专项实现诊断相关的证据卡集合。每张卡表达一条可验证知识声明，绑定固定版本资料、原始位置与适用边界。
>
> 来源：批次 5 固定源码快照（apify/crawlee），全部以 `third-party/crawler-knowledge-sources/manifest.md` 记录的 ref 与 Commit 为唯一版本基线。
>
> 证据等级：规范证据（官方规范/文档/Release）＞实现证据（同版本官方源码/测试）＞工程证据（官方运行指南/手册）＞案例证据（事故资料，只用于启发）。
>
> 维护规则：本文件由资料治理 Skill 按既定准入、许可证复核与版本固定流程维护；不得静默改写已固定证据卡，更新只通过新增修订进行。

## 来源身份与版本基线

| 仓库 | 权威 ref | Commit | 本地路径 |
|---|---|---|---|
| apify/crawlee | `v3.17.0` | `cacad22ea8cfbdceccdbd9fa31d9caa59719cf3b` | `third-party/crawler-knowledge-sources/repos/batch-05-core-stack/crawlee` |

---

## Crawler 选择与生命周期

### CL-CRAWL-001 Crawler 类型与选择

- **知识声明**：Crawlee 提供多种 Crawler（BasicCrawler、CheerioCrawler、PlaywrightCrawler、PuppeteerCrawler 等），分别适配不同的抓取场景（纯 HTTP、HTML 解析、浏览器渲染）；错误选择 Crawler 会导致资源浪费或功能不匹配。
- **证据类型/等级**：实现证据（同版本官方源码）。
- **来源身份**：apify/crawlee（`v3.17.0`）。
- **版本/ref/Commit**：`v3.17.0`；`cacad22ea8cfbdceccdbd9fa31d9caa59719cf3b`。
- **原始位置**：`packages/basic-crawler/src/internals/basic-crawler.ts`、`packages/cheerio-crawler/src/internals/cheerio-crawler.ts`、`packages/playwright-crawler/src/internals/playwright-crawler.ts`、`packages/puppeteer-crawler/src/internals/puppeteer-crawler.ts`。
- **支持说明**：各 Crawler 在专项包中实现，选择决定请求处理方式（纯 HTTP 或浏览器渲染）。
- **适用条件**：诊断 Crawler 选择错误、静态页面误用浏览器 Crawler、功能不匹配。
- **限制**：Crawler 行为以 apify/crawlee v3.17.0 为准；不得用历史草案版本假设。
- **关联 Skill**：crawler-use-crawlee。
- **状态**：有效。

### CL-CRAWL-002 Crawler 生命周期

- **知识声明**：Crawler 通过 Configuration（`configuration.ts`）管理生命周期配置（启动、关闭、钩子）；生命周期误解会导致资源泄漏或爬取不完整。
- **证据类型/等级**：实现证据（同版本官方源码）。
- **来源身份**：apify/crawlee（`v3.17.0`）。
- **版本/ref/Commit**：`v3.17.0`；`cacad22ea8cfbdceccdbd9fa31d9caa59719cf3b`。
- **原始位置**：`packages/core/src/configuration.ts`；`packages/core/src/crawlers/crawler_utils.ts`。
- **支持说明**：Configuration 管理 Crawler 生命周期配置；生命周期钩子影响启动/关闭行为。
- **适用条件**：诊断生命周期误解、启动/关闭配置错误、资源泄漏。
- **限制**：生命周期行为以 apify/crawlee v3.17.0 为准。
- **关联 Skill**：crawler-use-crawlee。
- **状态**：有效。

### CL-CRAWL-003 Configuration 语义

- **知识声明**：Crawlee Configuration 定义全局配置（存储、日志、并发、代理等）；配置错误会导致"配置合法但运行行为不符合预期"。
- **证据类型/等级**：实现证据（同版本官方源码）。
- **来源身份**：apify/crawlee（`v3.17.0`）。
- **版本/ref/Commit**：`v3.17.0`；`cacad22ea8cfbdceccdbd9fa31d9caa59719cf3b`。
- **原始位置**：`packages/core/src/configuration.ts`。
- **支持说明**：Configuration 集中管理 Crawlee 全局配置；配置项语义决定运行行为。
- **适用条件**：诊断 Configuration 配置错误、"配置合法但运行行为不符合预期"。
- **限制**：本卡描述 Crawlee v3.17.0 的 Configuration 语义。
- **关联 Skill**：crawler-use-crawlee。
- **状态**：有效。

---

## RequestQueue 与请求调度

### CL-QUEUE-001 RequestQueue 语义

- **知识声明**：Crawlee RequestQueue（`request_queue.ts`）实现请求队列语义（入队、状态、去重）；`REQUEST_QUEUE_HEAD_MAX_LIMIT` 等常量约束队列行为。
- **证据类型/等级**：实现证据（同版本官方源码）。
- **来源身份**：apify/crawlee（`v3.17.0`）。
- **版本/ref/Commit**：`v3.17.0`；`cacad22ea8cfbdceccdbd9fa31d9caa59719cf3b`。
- **原始位置**：`packages/core/src/storages/request_queue.ts`、`request_queue_v2.ts`、`request_provider.ts`。
- **支持说明**：RequestQueue 基于 RequestProvider 实现请求队列；去重与状态管理影响抓取行为。
- **适用条件**：诊断 RequestQueue 去重失败、入队错误、队列状态异常。
- **限制**：队列语义以 apify/crawlee v3.17.0 为准；"配置合法但运行行为不符合预期"常源于此。
- **关联 Skill**：crawler-use-crawlee。
- **状态**：有效。

### CL-QUEUE-002 请求调度与入队

- **知识声明**：Crawlee 通过 `enqueue_links/` 与 `request.ts` 管理请求入队与调度（AddRequestsBatchedOptions、EnqueueLinksOptions）；调度错误会导致重复抓取或漏抓。
- **证据类型/等级**：实现证据（同版本官方源码）。
- **来源身份**：apify/crawlee（`v3.17.0`）。
- **版本/ref/Commit**：`v3.17.0`；`cacad22ea8cfbdceccdbd9fa31d9caa59719cf3b`。
- **原始位置**：`packages/core/src/request.ts`、`packages/core/src/enqueue_links/`、`packages/basic-crawler/src/internals/basic-crawler.ts`（AddRequestsBatchedOptions）。
- **支持说明**：请求入队与调度选项（批量、链接入队）决定抓取路径。
- **适用条件**：诊断请求入队错误、重复抓取、漏抓。
- **限制**：调度语义以 apify/crawlee v3.17.0 为准。
- **关联 Skill**：crawler-use-crawlee。
- **状态**：有效。

### CL-QUEUE-003 去重、优先级与重试

- **知识声明**：Crawlee RequestQueue 支持请求去重、优先级与重试（getRequestId、队列状态、重试语义）；去重/重试配置错误会导致重复执行或重试风暴。
- **证据类型/等级**：实现证据（同版本官方源码）。
- **来源身份**：apify/crawlee（`v3.17.0`）。
- **版本/ref/Commit**：`v3.17.0`；`cacad22ea8cfbdceccdbd9fa31d9caa59719cf3b`。
- **原始位置**：`packages/core/src/storages/request_queue.ts`（getRequestId、去重）、`packages/core/src/request.ts`。
- **支持说明**：getRequestId 实现请求去重标识；重试与优先级影响调度。
- **适用条件**：诊断去重失败、优先级错误、重试风暴。
- **限制**：去重/重试语义以 apify/crawlee v3.17.0 为准。
- **关联 Skill**：crawler-use-crawlee。
- **状态**：有效。

---

## Dataset 与数据存储

### CL-DATA-001 Dataset 语义

- **知识声明**：Crawlee Dataset（`dataset.ts`）实现结果数据集语义（数据写入、导出、生命周期）；Dataset 数据未按预期写入常源于配置或生命周期误解。
- **证据类型/等级**：实现证据（同版本官方源码）。
- **来源身份**：apify/crawlee（`v3.17.0`）。
- **版本/ref/Commit**：`v3.17.0`；`cacad22ea8cfbdceccdbd9fa31d9caa59719cf3b`。
- **原始位置**：`packages/core/src/storages/dataset.ts`。
- **支持说明**：Dataset 实现结果数据存储与导出；写入语义影响数据完整性。
- **适用条件**：诊断 Dataset 数据未写入、导出错误、数据不一致。
- **限制**：本卡描述 Crawlee v3.17.0 的 Dataset 语义。
- **关联 Skill**：crawler-use-crawlee。
- **状态**：有效。

### CL-DATA-002 KeyValueStore 与存储管理

- **知识声明**：Crawlee KeyValueStore（`key_value_store.ts`）与 StorageManager（`storage_manager.ts`）管理键值存储与存储生命周期；存储配置错误会导致数据丢失或隔离错误。
- **证据类型/等级**：实现证据（同版本官方源码）。
- **来源身份**：apify/crawlee（`v3.17.0`）。
- **版本/ref/Commit**：`v3.17.0`；`cacad22ea8cfbdceccdbd9fa31d9caa59719cf3b`。
- **原始位置**：`packages/core/src/storages/key_value_store.ts`、`storage_manager.ts`。
- **支持说明**：KeyValueStore 实现键值存储；StorageManager 管理存储生命周期。
- **适用条件**：诊断键值存储错误、存储隔离错误、数据丢失。
- **限制**：存储语义以 apify/crawlee v3.17.0 为准。
- **关联 Skill**：crawler-use-crawlee。
- **状态**：有效。

---

## AutoscaledPool 与资源调节

### CL-POOL-001 AutoscaledPool 语义

- **知识声明**：Crawlee AutoscaledPool（`autoscaled_pool.ts`）实现自动并发调节（基于负载信号调整并发）；AutoscaledPool 配置错误会导致并发失控或吞吐下降。
- **证据类型/等级**：实现证据（同版本官方源码）。
- **来源身份**：apify/crawlee（`v3.17.0`）。
- **版本/ref/Commit**：`v3.17.0`；`cacad22ea8cfbdceccdbd9fa31d9caa59719cf3b`。
- **原始位置**：`packages/core/src/autoscaling/autoscaled_pool.ts`。
- **支持说明**：AutoscaledPool 基于负载信号动态调节并发；配置决定调节行为。
- **适用条件**：诊断并发失控、吞吐下降、资源调节未生效。
- **限制**：调节语义以 apify/crawlee v3.17.0 为准；"配置合法但运行行为不符合预期"常源于此。
- **关联 Skill**：crawler-use-crawlee。
- **状态**：有效。

### CL-POOL-002 Snapshotter 与负载信号

- **知识声明**：Crawlee Snapshotter（`snapshotter.ts`）采集 CPU、内存、事件循环负载信号（cpu_load_signal.ts、memory_load_signal.ts、event_loop_load_signal.ts）；负载信号用于 AutoscaledPool 调节。
- **证据类型/等级**：实现证据（同版本官方源码）。
- **来源身份**：apify/crawlee（`v3.17.0`）。
- **版本/ref/Commit**：`v3.17.0`；`cacad22ea8cfbdceccdbd9fa31d9caa59719cf3b`。
- **原始位置**：`packages/core/src/autoscaling/snapshotter.ts`、`cpu_load_signal.ts`、`memory_load_signal.ts`、`event_loop_load_signal.ts`。
- **支持说明**：Snapshotter 采集并聚合各负载信号；负载信号驱动并发调节。
- **适用条件**：诊断资源调节未生效、负载信号异常、内存/CPU 监控。
- **限制**：负载信号语义以 apify/crawlee v3.17.0 为准。
- **关联 Skill**：crawler-use-crawlee。
- **状态**：有效。

### CL-POOL-003 资源调节

- **知识声明**：Crawlee 资源调节（AutoscaledPool＋Snapshotter＋SystemStatus）根据系统状态动态调整并发与资源使用；资源调节配置错误会导致内存耗尽或性能退化。
- **证据类型/等级**：实现证据（同版本官方源码）。
- **来源身份**：apify/crawlee（`v3.17.0`）。
- **版本/ref/Commit**：`v3.17.0`；`cacad22ea8cfbdceccdbd9fa31d9caa59719cf3b`。
- **原始位置**：`packages/core/src/autoscaling/system_status.ts`、`autoscaled_pool.ts`。
- **支持说明**：SystemStatus 聚合系统状态；AutoscaledPool 据此调节并发。
- **适用条件**：诊断内存耗尽、性能退化、资源调节配置错误。
- **限制**：资源调节语义以 apify/crawlee v3.17.0 为准。
- **关联 Skill**：crawler-use-crawlee。
- **状态**：有效。

---

## SessionPool 与代理

### CL-SESS-001 SessionPool 语义

- **知识声明**：Crawlee SessionPool（`session_pool.ts`、`session.ts`）管理会话复用、轮换与失效（Cookie 隔离、session 生命周期）；会话配置错误会导致被目标站点封禁或会话串用。
- **证据类型/等级**：实现证据（同版本官方源码）。
- **来源身份**：apify/crawlee（`v3.17.0`）。
- **版本/ref/Commit**：`v3.17.0`；`cacad22ea8cfbdceccdbd9fa31d9caa59719cf3b`。
- **原始位置**：`packages/core/src/session_pool/session_pool.ts`、`session.ts`。
- **支持说明**：SessionPool 管理会话生命周期与复用；会话轮换/失效影响抓取稳定性。
- **适用条件**：诊断会话串用、Cookie 隔离失败、会话未轮换、封禁风险。
- **限制**：会话语义以 apify/crawlee v3.17.0 为准。
- **关联 Skill**：crawler-use-crawlee。
- **状态**：有效。

### CL-PROXY-001 代理配置

- **知识声明**：Crawlee ProxyConfiguration（`proxy_configuration.ts`）管理代理配置（代理 URL、轮换、tier）；代理配置错误会导致请求失败或绕过访问控制风险。
- **证据类型/等级**：实现证据（同版本官方源码）。
- **来源身份**：apify/crawlee（`v3.17.0`）。
- **版本/ref/Commit**：`v3.17.0`；`cacad22ea8cfbdceccdbd9fa31d9caa59719cf3b`。
- **原始位置**：`packages/core/src/proxy_configuration.ts`。
- **支持说明**：ProxyConfiguration 管理代理轮换与配置；代理凭据属敏感信息，落盘前脱敏（主决策日志 §36）。
- **适用条件**：诊断代理配置错误、请求失败、代理轮换失效。
- **限制**：代理语义以 apify/crawlee v3.17.0 为准；不提出绕过访问控制方案。
- **关联 Skill**：crawler-use-crawlee。
- **状态**：有效。
