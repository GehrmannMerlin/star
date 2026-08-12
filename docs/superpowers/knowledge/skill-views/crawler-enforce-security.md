# crawler-enforce-security 知识视图

> 本视图是 `crawler-enforce-security` Skill 的独立知识视图，只保留与"爬虫安全与合规审查、修复顾问"职责相关的知识。来源身份、版本与许可证事实由共享证据层统一维护，本视图通过稳定证据卡 ID 引用，不复制原始来源元数据。

## 定位、触发与排除项

- **定位**：面向 Agent 的爬虫安全与合规审查、修复顾问；依托固定版本资料帮助 Agent 检查项目的 SSRF、URL 与 DNS 校验、重定向、私网访问、密钥管理、依赖供应链、隔离执行、证据展示和公开数据访问边界，判断项目动作属于允许、需要额外批准还是明确禁止。
- **不是**：项目中的安全扫描器、监控后端或爬虫运行组件；不替代项目安全体系。
- **触发**：用户要求检查安全与合规相关设计或故障；已确认问题涉及 SSRF、URL 与 DNS 校验、重定向、私网访问、密钥管理、依赖供应链、隔离执行、证据展示或公开数据访问边界。
- **排除**：Docker 具体问题→`crawler-run-docker`；Node.js→`crawler-debug-typescript-node`；HTTP/网络→`crawler-debug-http-network`；PostgreSQL→`crawler-use-postgresql`；不提出绕过登录/验证码/访问权限/WAF 的办法；不攻击外部网站；不把未经审查的第三方示例代码用于项目；不生成 `writing-plans`。

## 最低证据输入

- 项目上下文（处理 Stellaris 问题时为 `stellaris-crawler-context` 项目上下文包路径）。
- 相关代码、配置、依赖清单、密钥处理方式、URL 使用、重定向逻辑、访问控制证据。
- 固定版本资料（批次 3：whatwg/url、scrapy、curl；批次 4：in-toto、slsa、osv-schema）。

## 知识主题与证据卡映射

### URL 与 DNS 校验

- 判断 URL 解析、host 解析/IDNA、私网/环回地址判定是否符合固定版本行为；SSRF、host 混淆、私网访问是常见问题。
- 证据卡：[[EC-URL-001]]（URL 解析语义）、[[EC-URL-002]]（host 解析与 IDNA）、[[EC-URL-003]]（私网与环回地址判定）。
- 依据固定版本：whatwg/url `url.bs`；scrapy `downloadermiddlewares/redirect.py`。

### 重定向安全

- 判断重定向状态码处理、重定向限制是否符合固定版本行为；重定向目标未校验、scheme 绕过、meta-refresh 绕过是常见问题。
- 证据卡：[[EC-REDIR-001]]（重定向状态码处理）、[[EC-REDIR-002]]（重定向限制与 meta-refresh）。
- 依据固定版本：scrapy `downloadermiddlewares/redirect.py`、`scrapy/utils/response.py`。

### 密钥与凭据管理

- 判断密钥硬编码、日志泄露、敏感信息脱敏是否符合纪律；密钥泄露、凭据落盘是常见问题。
- 证据卡：[[EC-SEC-001]]（密钥与凭据处理卫生）、[[EC-SEC-002]]（敏感信息脱敏与隔离保留）。
- 依据固定版本：主决策日志 §36；in-toto `SECURITY.md`。

### 依赖供应链

- 判断依赖漏洞数据、供应链要求、来源证明是否符合固定版本行为；依赖漏洞、来源不明、provenance 缺失是常见问题。
- 证据卡：[[EC-SUPPLY-001]]（OSV 漏洞数据格式）、[[EC-SUPPLY-002]]（供应链安全要求）、[[EC-SUPPLY-003]]（依赖来源与锁文件）。
- 依据固定版本：osv-schema `docs/schema.md`、`proto/vulnerability.proto`；slsa `docs/spec/v1.0/requirements.md`。

### 隔离执行与访问边界

- 判断隔离验证、公开数据访问边界是否符合固定版本行为；第三方内容未校验执行、跳过 robots.txt 是常见问题。
- 证据卡：[[EC-ISOL-001]]（隔离验证流程）、[[EC-ISOL-002]]（robots.txt 与公开数据访问边界）。
- 依据固定版本：in-toto `in_toto/in_toto_verify.py`、`verifylib.py`；scrapy `downloadermiddlewares/robotstxt.py`。

## 动作判定规则

- **允许**：合规且低风险的动作（只读审查、静态扫描、隔离环境安全测试）。
- **需要额外批准**：中等风险或修改性动作（修改配置/代码、执行隔离测试、访问受限资源）——须用户明确批准。
- **明确禁止**：绕过登录/验证码/访问权限/WAF、攻击外部网站、SSRF 到私网、泄露密钥、把未经审查的第三方示例代码用于项目、把外部条件或未知项伪装成已修复。
- 高风险问题或不合规方向必须阻止进入普通修复流程。

## 版本化判断规则

- 每条判断依据必须追溯到固定版本资料（ref＋Commit）、证据卡、上下文包条目或决策日志节号；只给仓库首页或没有版本的引用不满足要求。
- 明确区分事实、证据、综合推断与未知项；综合推断必须显式标记"推断"，不得伪装成资料中的确定结论。
- 不得因新技术更新默认要求升级；是否升级以证据和项目约束为准。
- 案例证据与工程证据不得单独升格为跨项目通用规范或确定根因。

## 输出、交接与禁止越权

- **输出**：可追溯风险证据、严重程度、受影响范围、允许/禁止结论、合规修复方向、安全回归测试建议。
- **交接**：高风险问题或不合规方向必须阻止进入普通修复流程；获准的合规修复方向→`crawler-writing-plans-bridge`；Docker/Node.js/HTTP/PostgreSQL 实现问题→对应 Skill。
- **禁止越权**：不提出绕过登录/验证码/访问权限/WAF、不攻击外部网站、不使用未经审查第三方示例代码、不诊断业务根因、不生成 `writing-plans`、不初始化 Git、不记录敏感信息原件。

## 视图自检

- 全部证据卡 ID（EC-URL-*、EC-REDIR-*、EC-SEC-*、EC-SUPPLY-*、EC-ISOL-*）在 `security-compliance.md` 中存在且被本视图引用。
- 无未标注的推断；每条判断可追溯到证据卡或固定资料。
- 未复制相邻 Skill（`crawler-run-docker`、`crawler-debug-typescript-node`、`crawler-debug-http-network`、`crawler-use-postgresql`）的职责。
