# Claude Code 启动提示词：单地区、单机构真实纵向闭环实施计划

> 创建日期：2026-08-03  
> 使用方法：将“可复制提示词”一节完整复制到 Claude Code，在 `E:\Stellaris` 项目目录启动  
> 授权范围：只编写和自审实施计划；不修改业务代码、不启动服务、不执行迁移、不抓取真实网站

## 可复制提示词

你现在在 Windows 项目目录 `E:\Stellaris` 工作。

本次任务已经完成需求讨论和详细设计批准。请开始**编写正式实施计划**，但不要实施计划、不要修改业务代码、不要启动 Docker/PostgreSQL、不要执行数据库迁移、不要访问或抓取任何真实网站。

开始时明确声明：

> 我正在使用 writing-plans 工作流创建实施计划。

### 一、必须完整读取的文件

请按以下顺序完整读取，不要只读摘要：

1. `docs/superpowers/brainstorming/2026-08-03-crawler-implementation-decision-log.md`
2. `docs/superpowers/specs/2026-08-03-crawler-vertical-slice-design.md`
3. `docs/superpowers/handoffs/2026-08-03-claude-code-crawler-vertical-slice-planning-entry.md`
4. `skills/stellaris-crawler-context/SKILL.md`
5. `skills/stellaris-crawler-context/references/project-context.md`
6. `skills/stellaris-crawler-context/references/handoff-contract.md`
7. `skills/crawler-writing-plans-bridge/SKILL.md`
8. `skills/crawler-writing-plans-bridge/references/bridge-workflow.md`
9. `skills/crawler-writing-plans-bridge/references/output-contract.md`
10. `docs/superpowers/knowledge/skill-views/crawler-writing-plans-bridge.md`
11. `docs/superpowers/knowledge/evidence-cards/writing-plans-bridge.md`
12. `docs/superpowers/specs/2026-07-30-official-biography-crawler-design.md`
13. `docs/superpowers/brainstorming/2026-07-30-official-biography-crawler-decision-log.md`
14. `docs/superpowers/progress/crawler-knowledge-skills-progress.md`

随后现场只读扫描以下内容：

- 根目录 `package.json`、`pnpm-workspace.yaml`、`pnpm-lock.yaml`、`tsconfig.base.json`；
- `apps/`、`packages/`、`config/`、`infra/`、`tests/` 中的项目文件，排除 `node_modules`、`dist` 和 `third-party` 源码正文；
- 当前依赖精确版本、现有合同、数据库 Schema/迁移/Repository、API、Web、Crawler、Rules、Evidence、Exporter 和测试现状。

### 二、权威和安全边界

- 最新用户明确决议与开发期决策日志优先，其次是已批准纵向闭环设计，再其次是 2026-07-30 冻结总设计。
- 19 个项目 Skill 是 Agent 的知识、诊断、评审和规划层，不是生产运行组件。
- 不得把现有脚手架冒充已完成功能，也不得让现有代码静默覆盖已批准设计。
- 发现冲突时列出“事实、冲突条款、影响、可选处理和推荐”，等待用户决议；不得自行选边。
- 每项新的用户明确决议必须按下一个 `R-xx` 编号追加到开发期决策日志；建议和推断不得写成决议。
- 项目根目录当前不是 Git 仓库。不得初始化 Git，不得在计划中编造可立即执行的 `git commit` 步骤；每个任务改用独立验证检查点，并把 Git 初始化列为需要用户单独授权的外部前提。
- 不安装、构建或运行第三方知识仓库中的任何程序。
- 不登录、不解验证码、不绕过访问控制、WAF、robots 或站点限制。

### 三、规划前核验门

先按照 `stellaris-crawler-context`，根据本次现场只读核验生成：

`docs/superpowers/knowledge/context-packages/2026-08-03-crawler-vertical-slice-planning-context-package.md`

上下文包必须分离当前代码事实、已批准要求、历史设计、冲突与未知项、建议规划重点及修订记录；不得在其中诊断根因或提出未经批准的修复方案。

然后把该上下文包路径交给 `crawler-writing-plans-bridge`，核验：

1. 根需求和方向是否已批准；
2. 设计、决议、现场事实和必要证据是否齐全；
3. 当前依赖版本与冻结设计是否存在会改变计划的冲突；
4. 当前数据库模型与第一闭环数据不变量是否存在结构性缺口；
5. 当前零测试文件、Docker daemon 未运行和空基础设施目录是否已如实进入计划前置任务。

如果存在会导致计划只能靠猜测完成的阻断项，请停止在“规划准入报告”，向用户提出一个最小、明确的问题，不要写含占位内容的计划。

如果核验通过，继续编写计划。

### 四、计划目标与保存位置

计划目标是交付已批准的“单地区、单机构真实端到端纵向闭环”：

任务输入 → 范围与机构冻结 → URL 意图 → HTTP 优先抓取 → 必要时 Playwright 升级 → 不可变证据入库 → 页面事实抽取 → 完整领导结构 → 两名主要自然人槽位 → 五类页面与九项硬门槛 → Recovery → 隔离 Reviewer → `result_row` → Web 结果/SSE/证据抽屉 → 单 Sheet Excel。

将计划保存为：

`docs/superpowers/plans/2026-08-03-crawler-vertical-slice.md`

### 五、计划编写要求

使用当前可用的 Superpowers `writing-plans` 契约。计划必须：

1. 从规定的 Implementation Plan 标题、Goal、Architecture、Tech Stack 和 Global Constraints 开始。
2. 先给出完整文件结构映射，说明每个新建或修改文件的单一责任。
3. 按纵向可测试交付物拆任务，不按目录横向把所有包先填满。
4. 每个任务明确：
   - 精确创建、修改和测试文件路径；
   - 输入输出接口、函数名、参数和返回类型；
   - 先写失败测试；
   - 运行测试并说明预期失败原因；
   - 最小实现代码；
   - 运行局部与相关全量验证并说明预期通过输出；
   - 独立验证检查点。
5. 计划中的代码步骤必须包含足够的实际代码或 Schema 形状，不能只写“实现某功能”“添加错误处理”“补测试”。
6. 当前 `pnpm test` 因零测试文件失败。第一批任务必须用真实测试建立测试基线，禁止用忽略无测试参数伪造成功。
7. 数据库计划必须覆盖真实 PostgreSQL 18 集成测试、迁移、关键外键、索引、事务、幂等，以及以下不变量：
   - 同任务、机构和槽位只有一个当前结果；
   - 非空最终 URL 必须对应通过的独立 Reviewer 决策；
   - 空 URL 必须有中文终态原因；
   - Reviewer 请求不能复用 Collector 请求唯一键；
   - 网页和 Excel 只读取同一份已复核 `result_row`。
8. 证据存储固定以 `E:\StellarisData\evidence` 为根，导出以 `E:\StellarisData\exports` 为根，PostgreSQL 数据以 `E:\StellarisData\postgres` 为根。
9. 真实网络前必须完成 SSRF、DNS/IP、逐跳重定向、统一出口、资源上限、脱敏和 robots/访问限制测试。
10. 离线固定金标回放属于计划内自动验证；真实官网 Canary 必须单列为需要用户再次明确授权的步骤。
11. 明确本闭环暂缓的能力：多行政区、完整机构库存批量发现、完整暂停/继续/取消、大规模性能和完整管理页面；不得把暂缓写成删除。
12. 每个任务都要给出精确命令。最终验证至少包含：
    - `pnpm typecheck`
    - `pnpm test`
    - `pnpm build`
    - Docker Compose 配置校验
    - PostgreSQL 迁移与集成测试
    - 离线端到端金标回放
13. 不得出现未完成占位项、空壳文件、“类似前一任务”或“稍后补测试”。

### 六、自审与停止门

写完计划后必须自行完成：

1. 逐节对照已批准设计，列出每一节对应的计划任务；
2. 扫描并修复占位内容；
3. 检查跨任务类型、函数名、Schema 和事件名完全一致；
4. 检查任务依赖顺序能形成连续纵向闭环；
5. 检查所有生产行为都有先失败测试和验证命令；
6. 检查没有未经批准的真实抓取、破坏性迁移或 Git 初始化。

完成后只向用户报告：

- 计划文件路径；
- 任务数量和阶段摘要；
- 发现并保留的风险或待决议项；
- 自审结果。

然后停止，等待用户批准计划。不要开始实现任何任务。
