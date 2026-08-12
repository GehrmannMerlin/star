# Claude Code 启动提示词：多行政区模块验收与下一阶段推进

> 创建日期：2026-08-03
> 使用方法：将「可复制提示词」一节完整复制到 Claude Code，在 `E:\Stellaris` 项目目录启动
> 目的：让新会话从已完成的「多行政区、下级展开与上传名单」模块续接，先现场核验进度总账，再按用户指示推进下一阶段

## 可复制提示词

你现在在 Windows 项目目录 `E:\Stellaris` 工作。

本任务从已完成的爬虫系统「多行政区、下级展开与上传名单」模块续接。开始时明确声明：

> 我正在续接爬虫系统开发，先现场核验进度总账。

### 一、必须完整读取的文件（按顺序）

1. `docs/superpowers/brainstorming/2026-08-03-crawler-implementation-decision-log.md`（开发期决议 R-01 ~ R-17，权威来源）
2. `docs/superpowers/progress/crawler-development-progress.md`（本进度总账，恢复入口）
3. `docs/superpowers/specs/2026-08-03-crawler-vertical-slice-design.md`
4. `docs/superpowers/specs/2026-08-03-multi-institution-design.md`
5. `docs/superpowers/specs/2026-08-03-multi-region-design.md`
6. `docs/superpowers/plans/2026-08-03-multi-region.md`（最近批准并实施的计划）
7. `docs/superpowers/handoffs/2026-08-03-crawler-multi-region-next-start-prompt.md`（本文件）

### 二、现场只读核验

- 运行 `pnpm typecheck`、`pnpm test`、`pnpm build` 确认全绿（若 Docker daemon 未运行，先启动 Docker Desktop 并等待引擎就绪——Testcontainers 需 PostgreSQL 18）。
- 核对进度总账与代码现状一致：`packages/contracts/src/region.ts`、`apps/backend/src/workers/multi-region-driver.ts`、`packages/crawler/src/discovery/discover.ts` 等关键交付物存在。
- 若任何验证失败或与总账记录不符，先如实报告差异，不静默修复或跳过。

### 三、权威与安全边界

- 最新用户明确决议与开发期决策日志优先；其次是已批准设计；再其次是历史设计。
- `E:\Stellaris` 不是 Git 仓库，不得初始化 Git。
- 真实网络抓取（Canary）、Git 初始化、常驻服务启动均属外部前提，需用户逐项另行授权；不自动执行。
- 不得把现有代码冒充未实现功能，也不得让代码静默覆盖已批准设计。
- 发现冲突时列出「事实、冲突条款、影响、可选处理和推荐」，等待用户决议；不得自行选边。

### 四、下一阶段候选（需用户指示后再推进）

按已批准扩展顺序与进度总账「待决议/下一步」：

1. **真实多行政区 Canary**：用已校准的安徽适配器在真实官网跑多行政区闭环（离线已验证，真实抓取需用户授权追加 `R-xx`）。
2. **暂停/继续/取消与崩溃恢复**（扩展顺序第 3 步）。
3. **全国行政区数据**（当前仅内置安徽）。
4. **行政区级并行、大规模性能、完整管理页面**（暂缓不删除）。

完成核验后，向用户报告当前状态摘要，并请用户指示推进哪一项。不要擅自开始任何实施。

### 五、决议与进度记录协议

- 每次用户作出新决议：追加到开发期决策日志（连续 `R-xx`），记录日期、明确指令、覆盖/澄清条款、新基线、影响和边界；建议/推断不得写成决议。
- 若影响设计或计划，同步修订对应规格/计划并追加修订记录。
- 状态变化后先更新 `docs/superpowers/progress/crawler-development-progress.md`，再继续下一动作。
- 不删除、不重排、不静默改写旧决议。
