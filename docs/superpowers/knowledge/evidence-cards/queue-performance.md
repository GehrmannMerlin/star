# 队列与性能证据卡（共享证据层）

> 本文件是共享可追溯证据层中与队列、并发与性能诊断相关的证据卡集合。每张卡表达一条可验证知识声明，绑定固定版本资料、原始位置与适用边界。
>
> 来源：批次 3 固定源码快照，全部以 `third-party/crawler-knowledge-sources/manifest.md` 记录的 ref 与 Commit 为唯一版本基线。
>
> 证据等级：规范证据（官方规范/文档/Release）＞实现证据（同版本官方源码/测试）＞工程证据（官方运行指南/手册）＞案例证据（事故资料，只用于启发）。
>
> 维护规则：本文件由资料治理 Skill 按既定准入、许可证复核与版本固定流程维护；不得静默改写已固定证据卡，更新只通过新增修订进行。

## 来源身份与版本基线

| 仓库 | 权威 ref | Commit | 本地路径 |
|---|---|---|---|
| celery/celery | `v5.6.3` | `3f4d8d795ad128bd7430cc5dc174a802cded425c` | `third-party/crawler-knowledge-sources/repos/batch-03-crawler-pipeline/celery` |
| reactive-streams/reactive-streams-jvm | `v1.0.4` | `944163a4b2477a2bebaaada86b0ba910b6302f2f` | `third-party/crawler-knowledge-sources/repos/batch-03-crawler-pipeline/reactive-streams-jvm` |
| locustio/locust | `2.46.2` | `5493f2608a10c249233faa5d79955721326a2cb5` | `third-party/crawler-knowledge-sources/repos/batch-03-crawler-pipeline/locust` |
| scrapy/scrapy | `2.17.0` | `feb692f552e3ed4533cf4e3af4809908d84cd763` | `third-party/crawler-knowledge-sources/repos/batch-03-crawler-pipeline/scrapy` |

---

## 任务队列与调度

### TQ-QUEUE-001 任务入队与出队

- **知识声明**：celery `Request` 类封装任务的投递信息（`delivery_info`，含 `exchange`/`routing_key`/`redelivered`），管理 ack/reject 生命周期；任务是否被确认（ack）决定消息是否可能重投。
- **证据类型/等级**：实现证据。
- **来源身份**：celery/celery（`v5.6.3`）。
- **版本/ref/Commit**：`v5.6.3`；`3f4d8d795ad128bd7430cc5dc174a802cded425c`。
- **原始位置**：`celery/worker/request.py`（`Request` 类，67-239 行；`delivery_info` 含 `redelivered`）。
- **支持说明**：`Request` 维护 `acknowledged`、`_on_ack`/`_on_reject` 回调与 `delivery_info`。
- **适用条件**：诊断任务重复投递/丢失、消息重投行为（`redelivered`）时比对。
- **限制**：ack/reject 语义随消息代理与版本变化；本卡是 celery Worker 端实现证据。
- **关联 Skill**：crawler-tune-queues。
- **状态**：有效。

### TQ-QUEUE-002 队列容量与持久化

- **知识声明**：celery `app/amqp.py` 定义队列/交换机/路由配置；队列容量与持久化由消息代理决定，Worker 消费能力不足时队列堆积。
- **证据类型/等级**：实现证据。
- **来源身份**：celery/celery（`v5.6.3`）。
- **版本/ref/Commit**：`v5.6.3`；`3f4d8d795ad128bd7430cc5dc174a802cded425c`。
- **原始位置**：`celery/app/amqp.py`、`celery/app/base.py`。
- **支持说明**：AMQP 配置定义队列/路由；队列堆积反映消费速率低于生产速率。
- **适用条件**：诊断队列任务堆积/容量问题时比对。
- **限制**：队列容量与持久化语义由消息代理（如 RabbitMQ/Redis）决定；本卡是 celery 配置侧证据。
- **关联 Skill**：crawler-tune-queues。
- **状态**：有效。

### TQ-QUEUE-003 爬虫引擎调度循环

- **知识声明**：scrapy `core/engine.py` 实现引擎调度循环，`core/scheduler.py` 维护请求队列；调度循环吞吐受并发设置（如 `CONCURRENT_REQUESTS`）影响。
- **证据类型/等级**：实现证据。
- **来源身份**：scrapy/scrapy（`2.17.0`）。
- **版本/ref/Commit**：`2.17.0`；`feb692f552e3ed4533cf4e3af4809908d84cd763`。
- **原始位置**：`scrapy/core/engine.py`、`scrapy/core/scheduler.py`。
- **支持说明**：引擎协调下载器/调度器/解析，调度器按优先级提供请求。
- **适用条件**：诊断爬虫吞吐下降、调度循环瓶颈时比对。
- **限制**：并发控制具体参数随版本/配置变化；本卡描述引擎循环结构。
- **关联 Skill**：crawler-tune-queues。
- **状态**：有效。

---

## 并发与背压

### TQ-BACK-001 背压协议（Subscription.request）

- **知识声明**：reactive-streams 定义背压协议：`Subscriber.onSubscribe` 后数据不流动，直到 `Subscription.request(long)` 被调用；`onNext` 最多按请求量发送；`onError`/`onComplete` 后不再发送事件。
- **证据类型/等级**：规范证据。
- **来源身份**：reactive-streams/reactive-streams-jvm（`v1.0.4`）。
- **版本/ref/Commit**：`v1.0.4`；`944163a4b2477a2bebaaada86b0ba910b6302f2f`。
- **原始位置**：`api/src/main/java/org/reactivestreams/Subscriber.java`（10-60 行）、`Subscription.java`、`Publisher.java`、`Processor.java`。
- **支持说明**：`Subscriber` 注释明确"数据流动前必须调用 request(long)"、"onNext 最多按请求量"、"onError/onComplete 终止"。
- **适用条件**：诊断背压失效（消费者被压垮、无界生产）时比对。
- **限制**：不同框架对背压的实现程度不同；本卡是规范语义。
- **关联 Skill**：crawler-tune-queues。
- **状态**：有效。

### TQ-BACK-002 Worker 并发

- **知识声明**：celery Worker 通过并发池（prefork/threads/gevent 等）消费任务；并发数配置决定同时处理的任务量，配置不当导致任务堆积或资源耗尽。
- **证据类型/等级**：实现证据。
- **来源身份**：celery/celery（`v5.6.3`）。
- **版本/ref/Commit**：`v5.6.3`；`3f4d8d795ad128bd7430cc5dc174a802cded425c`。
- **原始位置**：`celery/worker/`（并发池与 Worker 消费）。
- **支持说明**：Worker 用并发池调度任务执行；`Request.execute_using_pool` 相关逻辑。
- **适用条件**：诊断 Worker 并发配置不当导致吞吐下降/资源耗尽时比对。
- **限制**：并发池实现随池类型/版本变化；本卡描述 Worker 并发机制。
- **关联 Skill**：crawler-tune-queues。
- **状态**：有效。

### TQ-BACK-003 引擎并发控制

- **知识声明**：scrapy 引擎通过并发设置（`CONCURRENT_REQUESTS` 等）控制同时进行的下载请求；并发失控会导致目标限流或自身资源耗尽。
- **证据类型/等级**：实现证据。
- **来源身份**：scrapy/scrapy（`2.17.0`）。
- **版本/ref/Commit**：`2.17.0`；`feb692f552e3ed4533cf4e3af4809908d84cd763`。
- **原始位置**：`scrapy/core/engine.py`（引擎并发控制）、`scrapy/core/scheduler.py`。
- **支持说明**：引擎按并发设置调度下载器槽位。
- **适用条件**：诊断爬虫并发配置不当、下载请求堆积时比对。
- **限制**：并发控制参数随版本/配置变化；本卡描述引擎并发机制。
- **关联 Skill**：crawler-tune-queues。
- **状态**：有效。

---

## 优先级与公平性

### TQ-PRIO-001 任务优先级语义

- **知识声明**：scrapy 调度器按 `Request.priority` 维护优先级队列，同优先级请求按顺序处理；优先级配置错误导致高价值请求被延迟或饥饿。
- **证据类型/等级**：实现证据。
- **来源身份**：scrapy/scrapy（`2.17.0`）。
- **版本/ref/Commit**：`2.17.0`；`feb692f552e3ed4533cf4e3af4809908d84cd763`。
- **原始位置**：`scrapy/core/scheduler.py`（`Request.priority` 优先级队列）。
- **支持说明**：`Requests are stored into priority queues` 按 `Request.priority` 排序。
- **适用条件**：诊断优先级配置错误、高优先级请求被延迟时比对。
- **限制**：优先级语义与队列实现随版本/配置变化；本卡描述 scrapy 优先级机制。
- **关联 Skill**：crawler-tune-queues。
- **状态**：有效。

### TQ-PRIO-002 公平调度

- **知识声明**：公平调度保证不同任务源/队列获得合理处理份额；缺少公平性会导致低优先级任务长期饥饿。
- **证据类型/等级**：工程证据（结合实现证据推导）。
- **来源身份**：celery/celery（`v5.6.3`）与 scrapy/scrapy（`2.17.0`）的调度机制。
- **版本/ref/Commit**：`v5.6.3`（`3f4d8d795ad128bd7430cc5dc174a802cded425c`）；`2.17.0`（`feb692f552e3ed4533cf4e3af4809908d84cd763`）。
- **原始位置**：celery `celery/app/amqp.py`（多队列）；scrapy `core/scheduler.py`（优先级队列）。
- **支持说明**：多队列/优先级机制若未平衡消费，低优先级或低权重任务会饥饿。
- **适用条件**：诊断队列饥饿、任务源之间不公平时比对。
- **限制**：本卡是工程推断（`推断`）；具体公平性由队列实现决定。
- **关联 Skill**：crawler-tune-queues。
- **状态**：有效。

---

## 缓存与暂停恢复

### TQ-CACHE-001 结果缓存

- **知识声明**：celery `backends` 保存任务结果/状态；结果缓存机制影响任务去重与重复执行判断。
- **证据类型/等级**：实现证据。
- **来源身份**：celery/celery（`v5.6.3`）。
- **版本/ref/Commit**：`v5.6.3`；`3f4d8d795ad128bd7430cc5dc174a802cded425c`。
- **原始位置**：`celery/backends/`、`celery/app/backends.py`。
- **支持说明**：结果后端保存任务状态与结果，供查询/去重。
- **适用条件**：诊断任务重复执行、结果状态异常时比对。
- **限制**：结果后端语义随后端类型/版本变化；本卡描述缓存机制。
- **关联 Skill**：crawler-tune-queues。
- **状态**：有效。

### TQ-CACHE-002 暂停/恢复控制

- **知识声明**：celery `Control` 提供 `revoke`/`rate_limit`/`time_limit`/`shutdown`/`broadcast` 等控制命令，用于暂停/恢复/限速任务处理。
- **证据类型/等级**：实现证据。
- **来源身份**：celery/celery（`v5.6.3`）。
- **版本/ref/Commit**：`v5.6.3`；`3f4d8d795ad128bd7430cc5dc174a802cded425c`。
- **原始位置**：`celery/app/control.py`（`Control` 类，424-753 行：`revoke`/`rate_limit`/`time_limit`/`shutdown`/`broadcast`）。
- **支持说明**：`Control.revoke` 撤销任务、`rate_limit` 限速、`time_limit` 设超时、`shutdown` 停止 Worker。
- **适用条件**：诊断暂停/恢复/限速控制失效时比对。
- **限制**：控制命令经广播/目标 Worker 执行，语义随版本变化；本卡描述 Control API。
- **关联 Skill**：crawler-tune-queues。
- **状态**：有效。

### TQ-CACHE-003 Worker 状态

- **知识声明**：celery `worker/state.py` 维护 Worker 的任务状态（执行中/已完成/被撤销）；`worker/control.py` 处理控制命令。
- **证据类型/等级**：实现证据。
- **来源身份**：celery/celery（`v5.6.3`）。
- **版本/ref/Commit**：`v5.6.3`；`3f4d8d795ad128bd7430cc5dc174a802cded425c`。
- **原始位置**：`celery/worker/state.py`、`celery/worker/control.py`。
- **支持说明**：Worker 状态跟踪任务生命周期，控制命令更新状态。
- **适用条件**：诊断任务状态不一致、控制命令未生效时比对。
- **限制**：状态跟踪语义随版本变化；本卡描述 Worker 状态机制。
- **关联 Skill**：crawler-tune-queues。
- **状态**：有效。

---

## 性能基线与故障注入

### TQ-PERF-001 压测基线方法

- **知识声明**：locust 通过 User/Task 定义负载，按权重/并发产生请求并统计延迟/吞吐/RPS，用于建立可比较性能基线。
- **证据类型/等级**：实现证据。
- **来源身份**：locustio/locust（`2.46.2`）。
- **版本/ref/Commit**：`2.46.2`；`5493f2608a10c249233faa5d79955721326a2cb5`。
- **原始位置**：`locust/`（User/Task/统计实现）。
- **支持说明**：locust 定义 User 行为与统计（RPS、响应时间、失败率）。
- **适用条件**：诊断吞吐/延迟基线建立、回归门槛设定时比对。
- **限制**：压测场景配置随版本/场景变化；本卡描述压测基线机制。
- **关联 Skill**：crawler-tune-queues。
- **状态**：有效。

### TQ-PERF-002 故障注入与重试场景

- **知识声明**：celery `app/autoretry.py` 实现自动重试（重试次数/间隔）；重试风暴是跨任务问题，故障注入（模拟失败）可验证重试/恢复行为。
- **证据类型/等级**：实现证据。
- **来源身份**：celery/celery（`v5.6.3`）。
- **版本/ref/Commit**：`v5.6.3`；`3f4d8d795ad128bd7430cc5dc174a802cded425c`。
- **原始位置**：`celery/app/autoretry.py`。
- **支持说明**：autoretry 提供自动重试逻辑（次数/间隔）。
- **适用条件**：诊断重试风暴、重试/恢复行为异常时比对。
- **限制**：重试策略随版本/配置变化；故障注入须受控、合规（不接管生产队列）。
- **关联 Skill**：crawler-tune-queues。
- **状态**：有效。

---

## 汇总

- 证据卡总数：13 张（TQ-QUEUE 3＋TQ-BACK 3＋TQ-PRIO 2＋TQ-CACHE 3＋TQ-PERF 2）。
- 来源：批次 3 固定仓库 4 个（celery、reactive-streams、locust、scrapy）。
- 引用契约：下游 Skill 视图通过稳定 ID 引用本文件；原始证据通过 manifest 固定 Commit 与相对路径可追溯。
