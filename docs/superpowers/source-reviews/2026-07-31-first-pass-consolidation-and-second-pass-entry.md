# 爬虫知识资料库第一遍汇总与第二遍入口审查

> 汇总日期：2026-07-31
>
> 状态：等待用户决定是否进入第二遍
>
> 边界：本文只汇总六个已批准批次、检查重复、容量和版本绑定阻塞，并提出第二遍分阶段方案。未固定新 Commit、未下载或克隆源码、未创建 Skill、未进入 `writing-plans`，也未修改爬虫代码。

## 1. 已确认基础

- 六个一级方向的第一遍资料发现、分类和用户核对已经全部完成，主决策日志第 67 至 72 节分别记录六批批准结果。
- 第二遍只处理已经批准进入下载资格范围的仓库；候选和拒绝来源仍只保留元数据。
- 每个准入仓库在下载前仍须重新核对权威上游、目标版本/Commit、许可证和预计浅克隆体积。
- 第三方源码必须固定到具体 Commit 并浅克隆到 E 盘独立资料区；第三方资料库遵守 50 GB 软上限，并尽量保证 E 盘至少 120 GB 可用。
- 批准第二遍不等于授权安装依赖、构建或运行仓库中的程序、服务、扫描器、代理、测试套件和示例。

## 2. 六批汇总与去重结果

| 批次 | 一级方向 | 准入外部仓库 | GitHub 完整历史体积代理 | 第二遍当前状态 |
|---|---|---:|---:|---|
| 1 | 资料治理 | 5 | 约 1.05 GiB | 可进入固定 Commit 前置核验 |
| 2 | 诊断与规划 | 5 | 约 423 MiB（0.41 GiB） | 可进入固定 Commit 前置核验 |
| 3 | 爬虫流水线 | 12 | 约 294 MiB（0.29 GiB） | 可进入固定 Commit 前置核验 |
| 4 | 平台保障 | 8 | 约 52.8 MiB（0.052 GiB） | 可进入固定 Commit 前置核验 |
| 5 | 当前重点技术栈 | 11 | 约 6,169.4 MiB（6.03 GiB） | 被真实项目版本缺失阻塞 |
| 6 | Stellaris 项目专用层 | 0 | 0 | 无外部仓库需要下载 |
| **合计** |  | **41** | **约 7.83 GiB** | 建议分阶段处理 |

- 从五份含外部仓库的批准报告第 3 节提取到 41 条准入记录，规范化仓库名后仍为 41 个唯一仓库，跨批重复为 0。
- 当前可进入第二遍前置核验的前四批共 30 个仓库，完整历史体积代理约 1.80 GiB。
- 第五批 11 个仓库占全部体积代理约 77%，但完整历史体积代理不等于固定 Commit 后的实际浅克隆大小。

## 3. 建议先进入第二遍的 30 个仓库

### 3.1 资料治理（5）

- `ossf/scorecard`
- `licensee/licensee`
- `aboutcode-org/scancode-toolkit`
- `clearlydefined/service`
- `fsfe/reuse-tool`：以权威 Codeberg 上游为准，并核对 GitHub 镜像 Commit

### 3.2 诊断与规划（5）

- `obra/superpowers`：固定与当前接口契约匹配的 v6.2.0
- `PagerDuty/incident-response-docs`
- `microsoft/code-with-engineering-playbook`
- `adr/madr`
- `arc42/arc42-template`

### 3.3 爬虫流水线（12）

- `scrapy/scrapy`
- `internetarchive/heritrix3`
- `crawler-commons/crawler-commons`
- `google/robotstxt`
- `curl/curl`
- `w3c/webdriver`
- `whatwg/url`
- `jhy/jsoup`
- `mozilla/readability`
- `reactive-streams/reactive-streams-jvm`
- `celery/celery`
- `locustio/locust`

### 3.4 平台保障（8）

- `in-toto/in-toto`
- `open-telemetry/opentelemetry-specification`
- `prometheus/OpenMetrics`
- `ossf/osv-schema`
- `slsa-framework/slsa`
- `json-schema-org/JSON-Schema-Test-Suite`
- `pact-foundation/pact-specification`
- `Shopify/toxiproxy`

这些仓库获准进入的仍只是只读知识资料：第二遍不得安装依赖、运行服务、启动代理、执行安全扫描或向外部站点注入故障。

## 4. 必须暂缓的 11 个重点技术栈仓库

- `microsoft/TypeScript`
- `nodejs/node`
- `apify/crawlee`
- `microsoft/playwright`
- `moby/moby`
- `docker/cli`
- `docker/compose`
- `compose-spec/compose-spec`
- `microsoft/WSL`
- `postgres/postgres`
- `docker-library/postgres`

暂缓原因不是容量或质量，而是版本证据不足：

- 项目没有 `package.json`、锁文件、`tsconfig.json`、Dockerfile、Compose 文件、镜像标签、PostgreSQL 服务端版本、驱动或迁移工具版本。
- 本机 Node.js、全局 TypeScript、Docker CLI 和 Compose 版本只属于环境事实，不能证明未来项目实际锁定版本。
- 主决策日志第 71 节已经确认：第二遍固定 Commit 前必须依据真实项目制品重新绑定这些技术栈版本，不得默认采用审查时最新 Release 或历史设计草案。

因此，在项目实现制品出现之前，对这 11 个仓库固定任何“项目适用 Commit”都会违反已确认版本策略。

## 5. 容量与存储检查

- E 盘当前可用空间约 243.1 GiB。
- 若按前四批完整历史体积代理 1.80 GiB 进行极保守扣减，E 盘仍约有 241.3 GiB 可用。
- 即使把全部 41 个仓库的完整历史体积代理 7.83 GiB 一并扣减，E 盘仍约有 235.3 GiB 可用，高于 120 GB 保留线，且低于第三方资料库 50 GB 软上限。
- 上述只证明当前容量不构成阻塞；实际下载前仍必须按固定 Commit 和浅克隆参数重新预估，且不得把 Docker、数据库或爬虫证据空间让位给低价值历史。
- 资料区必须位于 E 盘。具体目录结构和清单格式应在用户批准进入第二遍后再按资料治理既定约束确定，不在本入口决策中扩展低优先级细节。

## 6. 第二遍仍需执行的前置核验

对每个获准进入当前阶段的仓库逐一执行，未通过则停止该仓库，不影响其他仓库：

1. 解析权威上游和重定向，特别处理 `fsfe/reuse-tool` 的 Codeberg 上游与 GitHub 镜像对应关系。
2. 选择与批准报告相符的稳定 Release/规范版本；没有 Release 的滚动规范固定到明确审查 Commit。
3. 重新核对仓库未归档、维护状态没有发生实质变化。
4. 在目标 Commit 核对根许可证及必要的多许可证边界；许可证不明确或与第一遍结论冲突时停止。
5. 记录远程 URL、标签/分支、Commit、采集时间、适用版本、许可证和对应 Skill。
6. 估算浅克隆大小并检查第三方资料库累计容量和 E 盘余量。
7. 只执行固定 Commit 的浅克隆与只读文件保存；不安装、构建或运行第三方代码。
8. 下载后核验实际 HEAD、远程地址、浅克隆状态、许可证文件和资料清单一致性。

## 7. 可选推进方式与建议

### 方案一：分阶段第二遍（Agent 推荐）

- 现在只对前四批 30 个不受项目版本阻塞的仓库执行逐仓前置核验、固定 Commit 和浅克隆。
- 第五批 11 个重点技术栈仓库继续保留批准资格，但等真实项目清单、锁文件、镜像和数据库版本出现后再执行第二遍。
- 优点：不让缺失项目实现阻塞 30 个通用资料仓库，同时严格遵守版本匹配规则。
- 代价：第二遍分两次完成，后续需要再次提交重点技术栈版本绑定结果。

### 方案二：等待后一次性处理 41 个仓库

- 暂不下载任何仓库，等项目实现制品与版本锁出现后一次处理全部 41 个。
- 优点：第二遍只有一个统一快照批次。
- 代价：30 个与项目版本无关的通用资料也被无限期推迟，当前资料收集阶段无法继续形成实际本地底座。

### 方案三：为第五批采用临时版本基线

- 依据本机版本、历史设计草案或审查日最新 Release 临时固定第五批 Commit。
- 表面上可一次处理全部仓库，但会把环境事实、历史草案或最新版本冒充项目版本。
- 该方案与主决策日志第 71 节冲突，**不建议且当前不得采用**。

## 8. 待用户确认的唯一决策

是否批准采用方案一：先对前四批 30 个仓库进入第二遍逐仓前置核验、固定 Commit 和 E 盘浅克隆，同时继续暂缓第五批 11 个重点技术栈仓库？
