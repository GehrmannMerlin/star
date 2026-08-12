---
name: crawler-curate-sources
description: Use when an Agent must establish a first crawler-knowledge source baseline, perform an approved incremental update, or fill one named knowledge gap while preserving canonical provenance, fixed versions, licenses, capacity limits, and user approval gates.
---

# crawler-curate-sources

这是一个 **Agent 知识治理 Skill**，用于为爬虫知识资料库建立可追溯的来源清单、固定版本、许可证证据与容量边界。它**不是**运行时下载器、扫描器、爬虫、RAG 服务或项目依赖管理器。它只治理资料与来源，不诊断项目故障，不提出代码修复，也不运行任何第三方程序。

## 触发与模式

只在以下三种模式之一触发：

1. **首次资料基线**：为爬虫知识资料库建立第一份来源清单与基线。
2. **按需增量更新**：因项目依赖版本变化、故障资料不足或重要计划准备而检查并增量更新既有来源。
3. **定向补充**：只补充与一个已命名知识缺口直接相关的来源，不扩展整个资料库。

## 必读输入（顺序固定）

1. 主决策日志：`docs/superpowers/brainstorming/2026-07-31-crawler-knowledge-skills-decision-log.md`
2. 统一知识设计规格：`docs/superpowers/specs/2026-07-31-crawler-knowledge-skills-knowledge-design.md`
3. 来源清单：`third-party/crawler-knowledge-sources/manifest.md`
4. 共享来源治理证据卡：`docs/superpowers/knowledge/evidence-cards/source-governance.md`
5. 本 Skill 独立知识视图：`docs/superpowers/knowledge/skill-views/crawler-curate-sources.md`

详细流程见 `references/workflows.md`，输出契约见 `references/output-contracts.md`。

## 非协商门禁

1. 识别当前模式为“首次资料基线”、“按需增量更新”或“定向补充”之一。
2. 读取主决策日志、清单、来源治理证据卡与本 Skill 知识视图。
3. 分离 `accepted`／`candidate`／`rejected` 三类记录，不混编。
4. 强制执行**两遍式**用户批准门：第一遍只发现与审查，用户批准后第二遍才固定版本并浅克隆。
5. 第二遍克隆前必须固定 canonical ref 与精确 Commit。
6. 以下任一情况立即停止：许可证不明确、canonical 上游不明确、安全边界、**50 GB** 软上限、E 盘可用空间低于 **120 GB**。
7. 绝不安装、构建、运行、扫描、代理、测试、执行示例或爬取外部目标。
8. 输出可追溯产物并更新本地进度总账后才继续。

## 工作流路由

- 首次基线、增量更新、定向补充的完整流程：`references/workflows.md`。
- 准入清单、候选清单、拒绝清单、快照清单、证据卡与停止报告的字段契约：`references/output-contracts.md`。
- 判断依据（证据卡映射）：`docs/superpowers/knowledge/skill-views/crawler-curate-sources.md`。

## 输出

- 第一遍：`accepted`／`candidate`／`rejected` 三份分离清单及合计。
- 第二遍（获准后）：快照记录（canonical URL、ref、40 位 Commit、E 盘路径、浅克隆状态、origin、洁净状态、许可证证据、实际字节、采集时间）。
- 边界触发：停止报告（触发边界、受影响来源、已完成的未受影响工作、所需用户决策）。
- 证据卡新增或更新（通过追加修订，不静默覆盖）。

## 禁止

- 不初始化 Git，不修改 `manifest.md` 或任何第三方仓库。
- 不执行任何第三方仓库程序、服务、扫描器、代理、测试、示例或外部抓取。
- 不诊断项目故障、不提出代码修复、不生成 Superpowers `writing-plans`。
- 不把 Stars、分数、单一检查、检测结果或案例当作充分权威。
