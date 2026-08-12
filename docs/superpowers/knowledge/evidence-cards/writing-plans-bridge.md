# 规划衔接（writing-plans-bridge）证据卡（共享证据层）

> 本文件是共享可追溯证据层中与规划衔接（`crawler-writing-plans-bridge`）相关的证据卡集合。每张卡表达一条可验证知识声明，绑定固定版本资料、原始位置与适用边界。
>
> 来源：批次 2 固定源码快照（obra/superpowers v6.2.0），全部以 `third-party/crawler-knowledge-sources/manifest.md` 记录的 ref 与 Commit 为唯一版本基线。
>
> 证据等级：规范证据（官方规范/文档/Release）＞实现证据（同版本官方源码/测试）＞工程证据（官方运行指南/手册）＞案例证据（事故资料，只用于启发）。
>
> 维护规则：本文件由资料治理 Skill 按既定准入、许可证复核与版本固定流程维护；不得静默改写已固定证据卡，更新只通过新增修订进行。

## 来源身份与版本基线

| 仓库 | 权威 ref | Commit | 本地路径 |
|---|---|---|---|
| obra/superpowers | `v6.2.0` | `3dcbd5c4b48e02263fbf4a3c01e3fe4f81d584d9` | `third-party/crawler-knowledge-sources/repos/batch-02-diagnosis-planning/superpowers` |

---

## 交接准入与批准门

### WB-ADMIT-001 只接收已核实输入

- **知识声明**：`crawler-writing-plans-bridge` 只接收具有充分证据支持的根因和用户已经批准的处理方向；未确认猜测不得作为交接输入（主决策日志 §47）。
- **证据类型/等级**：规范证据（官方规范/决策）。
- **来源身份**：主决策日志 §47；obra/superpowers（`v6.2.0`）。
- **版本/ref/Commit**：主决策日志 §47；obra/superpowers `v6.2.0` `3dcbd5c4…`。
- **原始位置**：主决策日志 §47；Superpowers `skills/writing-plans/SKILL.md`（Scope Check、Self-Review）。
- **支持说明**：§47 定义只接收已核实输入；writing-plans 契约定义规划输入要求。
- **适用条件**：诊断规划衔接的交接准入。
- **限制**：以主决策日志 §47 与 obra/superpowers v6.2.0 为准。
- **关联 Skill**：crawler-writing-plans-bridge。
- **状态**：有效。

### WB-ADMIT-002 条件不齐拒绝

- **知识声明**：当根因证据不足、批准状态缺失或必要证据不可追溯时，`crawler-writing-plans-bridge` 拒绝进入规划，列出缺失项（主决策日志 §47）。
- **证据类型/等级**：规范证据（官方决策）。
- **来源身份**：主决策日志 §47。
- **版本/ref/Commit**：主决策日志 §47。
- **原始位置**：主决策日志 §47 核心流程第 2 步。
- **支持说明**：§47 定义条件不齐时拒绝进入规划。
- **适用条件**：诊断规划衔接的拒绝条件。
- **限制**：以主决策日志 §47 为准。
- **关联 Skill**：crawler-writing-plans-bridge。
- **状态**：有效。

### WB-ADMIT-003 拦截未确认猜测

- **知识声明**：未确认猜测（未标注为推断、证据不足以证实）必须被拦截，不得进入规划输入包（主决策日志 §47 验收重点）。
- **证据类型/等级**：规范证据（官方决策）。
- **来源身份**：主决策日志 §47。
- **版本/ref/Commit**：主决策日志 §47。
- **原始位置**：主决策日志 §47 验收重点。
- **支持说明**：§47 定义拦截未确认猜测为验收重点。
- **适用条件**：诊断规划输入包中的猜测拦截。
- **限制**：以主决策日志 §47 为准。
- **关联 Skill**：crawler-writing-plans-bridge。
- **状态**：有效。

---

## 规划输入包内容

### WB-PKG-001 影响范围与技术约束

- **知识声明**：规划输入包整理影响范围与技术约束，供 Superpowers `writing-plans` 使用（主决策日志 §47；obra/superpowers `skills/writing-plans/SKILL.md` Plan Document Header、Global Constraints）。
- **证据类型/等级**：规范证据（官方决策＋官方契约）。
- **来源身份**：主决策日志 §47；obra/superpowers（`v6.2.0`）。
- **版本/ref/Commit**：主决策日志 §47；obra/superpowers `v6.2.0` `3dcbd5c4…`。
- **原始位置**：主决策日志 §47 核心流程第 3 步；Superpowers `skills/writing-plans/SKILL.md` Plan Document Header。
- **支持说明**：§47 定义整理影响范围与技术约束；writing-plans 契约定义规划文档全局约束。
- **适用条件**：诊断规划输入包的影响范围与技术约束。
- **限制**：以主决策日志 §47 与 obra/superpowers v6.2.0 为准。
- **关联 Skill**：crawler-writing-plans-bridge。
- **状态**：有效。

### WB-PKG-002 禁止事项/验证标准/回滚要求

- **知识声明**：规划输入包整理禁止事项、验证标准和回滚要求，使修复失败有恢复路径与数据保全措施（主决策日志 §47）。
- **证据类型/等级**：规范证据（官方决策）。
- **来源身份**：主决策日志 §47。
- **版本/ref/Commit**：主决策日志 §47。
- **原始位置**：主决策日志 §47 核心流程第 3 步。
- **支持说明**：§47 定义整理禁止事项、验证标准和回滚要求。
- **适用条件**：诊断规划输入包的禁止/验证/回滚项。
- **限制**：以主决策日志 §47 为准。
- **关联 Skill**：crawler-writing-plans-bridge。
- **状态**：有效。

### WB-PKG-003 根因依据与批准边界

- **知识声明**：规划输入包保留根因依据（证据卡 ID、固定资料路径、上下文包条目、决策日志节号）与批准边界（根因和方向的用户批准记录；进入 `writing-plans` 需用户再次明确授权）（主决策日志 §47 验收重点）。
- **证据类型/等级**：规范证据（官方决策）。
- **来源身份**：主决策日志 §47。
- **版本/ref/Commit**：主决策日志 §47。
- **原始位置**：主决策日志 §47 验收重点。
- **支持说明**：§47 定义完整保留根因依据与批准边界为验收重点。
- **适用条件**：诊断规划输入包的根因依据与批准边界。
- **限制**：以主决策日志 §47 为准。
- **关联 Skill**：crawler-writing-plans-bridge。
- **状态**：有效。

---

## Superpowers writing-plans 接口契约

### WB-IF-001 计划文档头与无占位符

- **知识声明**：Superpowers `writing-plans` 要求计划文档以固定 Plan Document Header 开头，且无占位符（TBD/TODO/待填充）；每步必须包含工程师所需的实际内容（obra/superpowers `skills/writing-plans/SKILL.md` Plan Document Header、No Placeholders）。
- **证据类型/等级**：实现证据（同版本官方源码/文档）。
- **来源身份**：obra/superpowers（`v6.2.0`）。
- **版本/ref/Commit**：`v6.2.0`；`3dcbd5c4b48e02263fbf4a3c01e3fe4f81d584d9`。
- **原始位置**：`skills/writing-plans/SKILL.md` Plan Document Header、No Placeholders。
- **支持说明**：writing-plans 契约定义计划文档头与无占位符要求。
- **适用条件**：诊断规划输入包遵循 Superpowers 契约。
- **限制**：以 obra/superpowers v6.2.0 为准；其他规划框架不得覆盖该契约（主决策日志 §68）。
- **关联 Skill**：crawler-writing-plans-bridge。
- **状态**：有效。

### WB-IF-002 任务粒度与执行交接

- **知识声明**：Superpowers `writing-plans` 要求任务粒度最小化（每步 2-5 分钟）与执行交接（Execution Handoff：subagent-driven-development 或 executing-plans，REQUIRED SUB-SKILL）（obra/superpowers `skills/writing-plans/SKILL.md` Task Right-Sizing、Execution Handoff）。
- **证据类型/等级**：实现证据（同版本官方源码/文档）。
- **来源身份**：obra/superpowers（`v6.2.0`）。
- **版本/ref/Commit**：`v6.2.0`；`3dcbd5c4b48e02263fbf4a3c01e3fe4f81d584d9`。
- **原始位置**：`skills/writing-plans/SKILL.md` Task Right-Sizing、Execution Handoff。
- **支持说明**：writing-plans 契约定义任务粒度与执行交接。
- **适用条件**：诊断规划输入包的任务粒度与执行交接。
- **限制**：以 obra/superpowers v6.2.0 为准。
- **关联 Skill**：crawler-writing-plans-bridge。
- **状态**：有效。

---

## 验收与防猜测

### WB-ACC-001 四维验收

- **知识声明**：Superpowers `plan-document-reviewer-prompt` 定义计划文档四维验收：Completeness、Spec Alignment、Task Decomposition、Buildability；只标记会造成实现阶段真正问题的缺陷（obra/superpowers `skills/writing-plans/plan-document-reviewer-prompt.md`）。
- **证据类型/等级**：实现证据（同版本官方源码/文档）。
- **来源身份**：obra/superpowers（`v6.2.0`）。
- **版本/ref/Commit**：`v6.2.0`；`3dcbd5c4b48e02263fbf4a3c01e3fe4f81d584d9`。
- **原始位置**：`skills/writing-plans/plan-document-reviewer-prompt.md` What to Check。
- **支持说明**：reviewer 契约定义四维验收。
- **适用条件**：诊断规划输入包的验收标准。
- **限制**：以 obra/superpowers v6.2.0 为准。
- **关联 Skill**：crawler-writing-plans-bridge。
- **状态**：有效。

### WB-ACC-002 防猜测与验收重点

- **知识声明**：`crawler-writing-plans-bridge` 的验收重点是能够拦截未确认猜测，并完整保留根因依据、用户批准边界、验证要求和回滚要求（主决策日志 §47 验收重点）。
- **证据类型/等级**：规范证据（官方决策）。
- **来源身份**：主决策日志 §47。
- **版本/ref/Commit**：主决策日志 §47。
- **原始位置**：主决策日志 §47 验收重点。
- **支持说明**：§47 定义拦截猜测与保留关键项为验收重点。
- **适用条件**：诊断规划衔接的验收。
- **限制**：以主决策日志 §47 为准。
- **关联 Skill**：crawler-writing-plans-bridge。
- **状态**：有效。
