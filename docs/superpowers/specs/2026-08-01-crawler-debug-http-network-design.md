# crawler-debug-http-network Skill 设计规格

日期：2026-08-01  
状态：书面规格待用户审阅  
适用范围：第 6 个独立 Agent Skill `crawler-debug-http-network` 的完整设计

## 1. 目标与边界

`crawler-debug-http-network` 是爬虫知识资料库爬虫流水线方向下的 Agent HTTP 与网络诊断、修复顾问。其职责是：依托固定版本资料，帮助 Agent 检查项目中的 DNS、TLS、代理、重定向、`robots.txt`、请求头、状态码、连接、超时、请求级重试、礼貌限流和响应完整性问题，输出可追溯的问题证据、根因或待验证假设、影响范围、修复方向和网络层测试建议；根因和方向获批后交给 `crawler-writing-plans-bridge`。

本 Skill **不是**项目中的生产 HTTP 客户端、代理或网络 Worker。它不承担项目的生产请求、重试或代理功能。

本设计只规划 `crawler-debug-http-network`，不包含第 7 个及后续 Skill 的实施任务；不创建或实施本 Skill 本身（实施由 Claude Code 按后续写作计划执行）。

## 2. 已确认输入

- 主决策日志：`docs/superpowers/brainstorming/2026-07-31-crawler-knowledge-skills-decision-log.md`（已确认决策的最高权威；§49/§51/§115）。
- 统一知识设计规格：`docs/superpowers/specs/2026-07-31-crawler-knowledge-skills-knowledge-design.md`（公共知识契约）。
- 固定源码清单：`third-party/crawler-knowledge-sources/manifest.md`。
- 处理 Stellaris 问题时：`stellaris-crawler-context` 生成的项目上下文包路径。
- 已确认问题证据（`crawler-triage-incidents` 分诊结论，适用时）。
- 网络代码、配置、依赖版本、日志、请求记录、响应或错误、复现证据（现场只读核验）。

## 3. 职责与排除项

### 3.1 职责

- 检查项目中的 HTTP 与网络相关问题：
  - DNS、TLS、代理、重定向；
  - `robots.txt`、请求头、状态码；
  - 连接、超时、请求级重试、礼貌限流；
  - 响应完整性。
- 结合适用版本资料判断问题属于代码缺陷、配置错误、版本兼容、瞬时故障、外部限制还是未知项。
- 输出可追溯的问题证据、根因或待验证假设、影响范围、修复方向和网络层测试建议。

### 3.2 排除项

- 不承担项目的生产请求、重试或代理功能。
- 不执行无效轰击或过度诊断请求；诊断探测限小规模、安全、合规。
- 具体 Node.js、Crawlee 或其他框架 API 与版本用法交给对应重点技术栈 Skill；动态页面渲染、跨任务调度和业务字段正确性分别交给对应领域 Skill。
- 不提出绕过登录、验证码、访问控制或 WAF 的办法；确认属于外部限制时，只能给出合规的降级、等待或终止结论。
- 不生成 `writing-plans`、不提出未经批准的代码修改。
- 不修改爬虫代码、`manifest.md`、第三方仓库；不初始化 Git。
- 不把密钥、Cookie、认证请求头、代理凭据写入诊断记录，落盘前脱敏。

## 4. 触发条件与输入

### 4.1 触发

用户要求检查 HTTP 与网络相关设计或故障，或已经确认的问题涉及 DNS、TLS、代理、重定向、请求头、状态码、连接、超时、请求级重试、礼貌限流或响应完整性时触发（主决策日志 §49）。

### 4.2 最低输入

- 项目上下文（处理 Stellaris 问题时为 `stellaris-crawler-context` 项目上下文包路径）。
- 网络代码、配置、依赖版本、日志、请求记录、响应或错误、复现证据。
- 固定版本资料（批次 3：curl、scrapy downloader/中间件、crawler-commons robots、whatwg/url）。

## 5. 诊断流程

1. 读取项目上下文（Stellaris 问题先读 `stellaris-crawler-context` 项目上下文包）、目标、约束与已确认问题证据。
2. 确定诊断聚焦点：DNS / TLS / 代理 / 重定向 / 请求头·状态码 / 连接·超时 / 请求级重试 / 礼貌限流·响应完整性。
3. 检查相关代码、配置、依赖版本、日志、请求记录、响应或错误，定位具体证据位置。
4. 引用匹配版本的证据卡（`http-network.md`）比对项目行为与规范/实现/工程证据。
5. 分类：代码缺陷 / 配置错误 / 版本兼容 / 瞬时故障 / 外部限制 / 未知项。
6. 证据不足时只提出最小补充取证或安全诊断请求；根因未证实前不提出代码修改。
7. 输出可追溯问题证据、根因或待验证假设、影响范围、修复方向、网络层测试建议。
8. 根因和方向获批后交给 `crawler-writing-plans-bridge`。

## 6. 问题分类规则

- **代码缺陷**：项目网络代码未按规范/实现证据处理（如请求头构造错误、重定向处理缺失、超时配置未生效）。
- **配置错误**：网络配置/参数与固定版本行为不符（如代理配置、TLS 验证、重试参数设置错误）。
- **版本兼容**：依赖版本与 API 行为不匹配（如 curl/scrapy 版本差异导致行为变化）。
- **瞬时故障**：网络瞬时抖动、DNS 临时解析失败、超时偶发——按重试策略处理，不是代码缺陷。
- **外部限制**：站点拒绝、验证码、限流、WAF 拦截等——只能给合规降级/等待/终止结论，不得伪装成已修复（主决策日志 §12/§49）。
- **未知项**：证据不足或冲突，保持候选假设，显式标记，不判定为确定根因。

每条结论必须明确区分：事实、证据、综合推断、待确认项。综合推断必须显式标记为"推断"，不得伪装成资料中的确定结论（主决策日志 §14）。

## 7. 证据卡主题分组

共享证据卡 `docs/superpowers/knowledge/evidence-cards/http-network.md` 从批次 3 固定资料筛选，按以下主题分组（实施时按实际固定资料筛选具体卡片）：

1. **DNS、TLS 与连接**：curl `lib/cf-dns.h`、`lib/connect.c`、`lib/cf-https-connect.h`、`lib/vtls`；scrapy `core/downloader/contextfactory.py`、`core/downloader/tls.py`。
2. **代理与重定向**：curl `lib/cf-h1-proxy.h`、`lib/cf-h2-proxy.h`、`lib/http_proxy.c`；scrapy `downloadermiddlewares/httpproxy.py`、`redirect.py`。
3. **请求头、状态码与 HTTP 版本**：curl `lib/http.c`、`lib/http1.c`、`lib/http2.c`；scrapy `downloadermiddlewares/defaultheaders.py`。
4. **超时、重试与礼貌限流**：curl `lib/transfer.c`、`lib/multi.c`；scrapy `downloadermiddlewares/downloadtimeout.py`、`retry.py`。
5. **robots.txt 与响应完整性**：crawler-commons `robots/BaseRobotsParser.java`；scrapy `downloadermiddlewares/robotstxt.py`；curl `lib/http_chunks.c`。

## 8. 输出契约

诊断记录采用可落盘结构化记录＋简短人类可读摘要（主决策日志 §33 节），每条结论可追溯。固定字段：

- 问题证据（定位到的代码/配置/日志/请求记录/响应或错误位置）。
- 分类（代码缺陷 / 配置错误 / 版本兼容 / 瞬时故障 / 外部限制 / 未知项；含置信度：高/中/低/不确定）。
- 根因或待验证假设（区分事实、证据、推断、待确认项）。
- 影响范围（受影响的请求、主机、页面、吞吐）。
- 修复方向（有限、可验证且不会造成无效轰击的修复建议，指向匹配版本资料）。
- 网络层测试建议（能稳定暴露问题的失败案例思路）。
- 交接对象（根因和方向获批后 → `crawler-writing-plans-bridge`）。

记录必须明确区分：事实、证据、推断、待确认项与用户批准状态。

## 9. 交接契约

- 遵守主决策日志第 33-36 节：可落盘结构化记录＋简短人类摘要；双层存储（小型记录项目内保存、大型证据以内容哈希和相对路径引用）；敏感信息落盘前脱敏。
- 根因和方向获批后，诊断结论交接给 `crawler-writing-plans-bridge` 作为规划输入，不取代其规划职责。
- 诊断结论明确区分事实、证据、推断、待确认项与用户批准状态。

## 10. 文件结构

```text
skills/crawler-debug-http-network/
  SKILL.md                              # 精简触发＋门禁＋路由＋输出＋禁止项
  references/
    diagnostic-workflow.md              # 诊断流程、问题分类规则、证据卡映射
    output-contract.md                  # 输出契约、交接契约、修订保留
docs/superpowers/knowledge/
  evidence-cards/
    http-network.md                     # 共享证据卡（从批次 3 固定资料筛选）
  skill-views/
    crawler-debug-http-network.md       # Skill 6 独立知识视图（引用证据卡）
tests/skills/crawler-debug-http-network/
  cases.md                              # 行为/安全案例（RED/GREEN 用）
  results.md                            # 红/绿行为评估记录
```

不引入 `validate.ps1`：诊断报告依赖动态项目证据与判断，机械结构校验价值有限，按最小充分原则（主决策日志 §107 先例）以行为案例验证为主。

## 11. 验证设计

### 11.1 结构验证

静态检查：
- Skill 包文件齐全（SKILL.md、diagnostic-workflow.md、output-contract.md）。
- 共享证据卡 `http-network.md` 与知识视图 `crawler-debug-http-network.md` 存在；知识视图引用证据卡。
- 诊断流程与问题分类规则在 references 中明确定义。
- 无 `TBD`、`TODO`、`FIXME` 占位符。
- 无肯定式运行指令；仅有负面安全声明与诊断流程描述。
- 不含敏感信息示例（密钥、Cookie、认证头、代理凭据）。
- 非 Git 边界：项目根目录不是 Git worktree；不初始化 Git。

### 11.2 行为验证（RED/GREEN）

按 `superpowers:writing-skills` 方法运行固定行为案例，每个案例使用全新隔离的 Agent 上下文：

- 按诊断聚焦点聚焦：只诊断触发问题对应的聚焦点，不无边界扩展。
- 问题分类正确：代码缺陷 / 配置错误 / 版本兼容 / 瞬时故障 / 外部限制 / 未知项。
- 证据不足不判根因：证据不足时只提出最小补充取证，不把未知项误判为已定位根因。
- 不承担生产网络功能：拒绝创建、替代或运行项目的生产请求/重试/代理功能。
- 不越过批准边界：根因和方向获批前不交给 `crawler-writing-plans-bridge`。
- 敏感信息脱敏：诊断记录不含密钥/Cookie/认证头/代理凭据。
- 不无边界扩展：不越权做浏览器/解析/队列诊断。

### 11.3 验收标准（对应主决策日志 §49）

- 能从固定案例或项目证据中正确区分网络代码缺陷、配置错误、版本问题、瞬时故障和外部限制。
- 引用匹配版本的依据。
- 提出有限、可验证且不会造成无效轰击的修复方向。

达到上述标准即视为本 Skill 当前细节设计充分，不再扩展低优先级内部设计。

## 12. 阶段门

本规格经用户审阅批准后，才可调用 `superpowers:writing-plans` 生成 `crawler-debug-http-network` 的单 Skill 实施计划。用户未明确批准前，不进入 `writing-plans`，不实施本 Skill，不开始第 7 个 Skill。

`E:\Stellaris` 当前不是 Git 仓库。本设计只要求把文档可靠保存在本地项目中，不得为了满足提交步骤擅自初始化 Git。
