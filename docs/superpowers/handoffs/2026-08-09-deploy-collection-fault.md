# Claude Code 启动提示词：线上采集「全部受限」故障诊断（R-36 交接）

> 创建日期：2026-08-09
> 使用方法：将「可复制提示词」一节完整复制到 Claude Code，在 `E:\Stellaris` 项目目录启动
> 目的：让新会话从「线上网页采集全部受限」故障续接，按项目沉淀的 skill 系统诊断并修复

## 可复制提示词

你现在在 Windows 项目目录 `E:\Stellaris` 工作。

本任务从线上故障「网页采集全部受限」续接（R-36）。开始时明确声明：

> 我正在续接线上采集故障诊断任务，先读取交接文档与决策日志核实现状，再按 skill 系统诊断。

### 一、必须完整读取的文件（按顺序）

1. `docs/superpowers/brainstorming/2026-08-03-crawler-implementation-decision-log.md`（重点 R-34/R-35/R-36）
2. `docs/superpowers/progress/crawler-development-progress.md`（进度总账，含部署记录）
3. `docs/superpowers/handoffs/2026-08-09-deploy-collection-fault.md`（本文件）
4. 项目沉淀 skill（按需使用，尤其）：
   - `skills/crawler-debug-http-network/SKILL.md`（HTTP/网络诊断，主用）
   - `skills/crawler-triage-incidents/SKILL.md`（故障分类：内部缺陷/外部限制/未知）
   - `skills/stellaris-crawler-context/SKILL.md`（项目上下文注入）

### 二、现场只读核验（必须做）

- 先看网页表单实际提交的 payload：`apps/web/src/main.tsx` 的 `createTask` 如何构造请求（是否传 `institutionName`/`officialEntryUrl`/`mode`）。
- 核对 `apps/backend/src/contracts/task-routes.ts` 的 R-35 自动补全逻辑（`adapter.declaredInstitutions.find(d => d.officialName === body.institutionName)`）。
- 连接线上服务器 47.238.145.24（SSH：`lumina_ops_ed25519` 密钥，见本机 `~/.ssh/config` 或 `-i ~/.ssh/lumina_ops_ed25519 ecs-user@47.238.145.24`），查 backend 日志 + DB：
  - 网页创建的任务在 `institution_snapshot.official_entry_url` 是否为空；
  - `result_row.result_zh` 是否「官网访问受限」；
  - backend 日志有无驱动启动/报错。
- **关键对比**：先前 API 直连（`officialEntryUrl` 由适配器补全）任务「已完成」成功；网页创建全「受限」。差异点在**网页表单提交链路**。

### 三、已知事实与待验证假设

**已知**：
- R-34 修复了驱动不启动（去掉 fixtureUrl 门槛），API 直连任务可真实采集。
- R-35 加了缺入口自动补全（精确匹配 `declaredInstitutions`）。
- 用户逐一测试适配器 22 个机构，网页上**全部受限**。
- 适配器清单（22）：安徽省人民政府/省政府办公厅/省教育厅/省科技厅/省民政厅/省司法厅/省财政厅/省水利厅/省商务厅/省审计厅/省外办/省国资委/省体育局/省统计局/省林业局/省医保局/省管局/省信访局/省能源局/省中医药局/省疾控局/省药监局。
- 已核验但漏配：省公安厅（gat.ah.gov.cn）、省民宗委、省人社厅、省自然资源厅、省生态环境厅、省住建厅、省交通厅、省农业农村厅、省文旅厅、省卫健委、省应急厅、省市场监管局 等（R-27 Canary 的 21 部门只写了部分）。

**待验证假设**（按 skill 不编造根因，逐项核验）：
1. 网页表单未正确传 `institutionName`（或前端字段与后端 CreateTaskRequest 不一致）；
2. 网页表单未传 `officialEntryUrl` 且 R-35 精确匹配失败（用户输入全名/简称 ≠ 适配器「省教育厅」）；
3. 网页可能未传 `mode`（TARGETED 默认）或表单提交路径有误；
4. 后端 `adapter` 是否注入（`buildApp` 默认 `loadAdapter("anhui-provincial-government")`）——确认生产容器里适配器 JSON 存在。

### 四、授权与边界

- **已授权**：修复内部缺陷（代码 + 重新构建部署镜像 + 更新服务器）；`www.ah.gov.cn`/`*.ah.gov.cn` 真实抓取（R-21/R-27）。
- **未授权**：其他省/机构适配器扩展、真实反爬突破（验证码/WAF/登录墙，禁止绕过）。
- 修复后需：本地全量回归 → 重建 backend 镜像 → 上传服务器 → reload → 网页实测验证。
- `E:\Stellaris` 不是 Git 仓库，不得初始化 Git。

### 五、决议与进度记录协议

- 新用户决议追加开发期决策日志（连续 `R-xx`），记录日期/明确指令/覆盖条款/新基线/影响/边界。
- 状态变化后先更新 `docs/superpowers/progress/crawler-development-progress.md`。
- 不删除、不重排、不静默改写旧决议。

### 六、目标

让网页表单创建的任一已适配机构任务能真实采集并产出结果（领导非空 URL 或「无领导信息」），不再「官网受限」。
