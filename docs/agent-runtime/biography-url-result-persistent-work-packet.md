# Biography URL Result and Persistent Work Packet

**STEP 15 — 2026-08-14**
**Runtime:** `@stellaris/agent-runtime` + `@stellaris/db`

## Purpose

把已经跑通的单机构链路（Institution → PRIMARY_1 / PRIMARY_2 → Biography URL
Candidate → Reviewer → Recovery → Final Review Decision）沉淀为三类正式 Runtime
基础设施：

1. **Persistent Institution Work Packet Store**（PostgreSQL，保留 InMemory 实现）；
2. **Biography URL Final Result Read Model**（从 Latest Frozen APPROVED Review
   Decision 纯确定性投影，每包两个 PRIMARY 独立输出）；
3. **Multi-Institution Biography Workflow Orchestration Foundation**
   （Frozen Inventory → 多 Packet → bounded concurrency → per-packet result）。

## Skill Scope

**Biography URL Collection Only.**

本阶段业务范围严格跟随 `official-biography-evidence` 3.1.0：

- 官员**个人简历 URL / 个人信息页面 URL** 的发现、核验、候选、审核与最终决策；
- 最终业务 Artifact 是 Skill 的 `final_url_decisions[].selected_url`（个人简历 URL）。

Skill 的硬边界（不得采集或填写）：

- 任前公示
- 代理任命
- 选举 / 任命事件
- 离任事件
- 其它事件型 Evidence

这些**不属于**当前 Skill Workflow。不得创建 `PRE_APPOINTMENT` / `ACTING_APPOINTMENT`
/ `ELECTION_APPOINTMENT` / `DEPARTURE` 等 Evidence Type。

## Persistent InstitutionWorkPacket

- `institution_work_packet` 表（migration `2026-08-14-institution-work-packet-persistence`）。
- `PostgresInstitutionWorkPacketStore` 实现 `InstitutionWorkPacketStorePort`（异步），
  `InMemoryInstitutionWorkPacketStore` 保留不变（Reviewer Runner 仍使用同步内存实现）。
- Packet 表**只存编排 / 状态 identity**：packet id、inventory hash、region、
  institution identity、state、attempt、failure code、两个 PRIMARY 人员身份。
  Leadership JSON / Candidate Pool / Review payload / Recovery payload 各自已有
  SSoT（`tool_event` / `investigator_evidence_submission` /
  `review_decision_submission` / `recovery_submission`），Packet 表**不重复存储**。
- 两个 PRIMARY 人员身份（`target_id` / `person_id` / `person_name`）由
  `setPrimaryPersons` 写入，供 Result 投影在无 Agent 情况下确定 slot → 人员映射。

## Packet State Durability

- Packet 可 `create + reload`（新实例读取同一数据源恢复相同 Packet）。
- State 更新后 reload 恢复最新状态。
- **合法 transition gate 不变**：`PostgresInstitutionWorkPacketStore` 复用与
  InMemory 相同的 `ALLOWED_TRANSITIONS`，非法 transition 仍抛 `PacketStateError`。
  Store 只是存储，不重新判断语义、不重选 PRIMARY、不重新 rank。

## Biography URL Final Result Read Model

- `BiographyUrlResultReader`（`results/biography-url-result.ts`）从
  **Packet + Latest Frozen APPROVED Review Decision + Candidate Pool** 纯确定性投影。
- `sourceOfTruth` 恒为 `LATEST_FROZEN_APPROVED_REVIEW`。
- **不创建** `biography_final_decision` 第二张事实表；最终 URL 永远来自
  `review_decision_submission` 中 latest `round_outcome='APPROVED'` 的那条记录。

## Latest Approved Review as SSoT

- `ReviewDecisionHistoryRow` 增加 `sourceReviewId`（`review_decision_submission.id`），
  Result 直接引用来源 Review 的持久化身份。
- Round 2 覆盖 Round 1 **只发生在投影**（`latestByPacket` 取最高 round）；
  DB 历史 append-only，Round 1 行不被覆盖。

## Two PRIMARY Results

一个 Institution Packet 对应 `PRIMARY_1` 与 `PRIMARY_2` 两个人员，Result 分别输出：

```ts
BiographyUrlResult = {
  packetId; regionCode; institutionId; institutionName;
  status: "RESOLVED" | "PARTIAL" | "UNRESOLVED";
  sourceOfTruth: "LATEST_FROZEN_APPROVED_REVIEW";
  primary1: BiographyUrlSlotResult;   // biographyUrl / personName / decisionStatus ...
  primary2: BiographyUrlSlotResult;
}
```

两 slot 独立：仅一 slot 已决时 `status = "PARTIAL"`，另一 slot 为 UNRESOLVED。

## Unresolved Result Semantics

- latest review 不存在，或 `roundOutcome !== 'APPROVED'`（如 packet 处于
  `RECOVERY_REQUIRED` / `READY_FOR_REVIEW` / `FAILED`），Result **不伪造 Final URL**，
  对应 slot 为 `UNRESOLVED`、`biographyUrl = null`。
- **读取 Result 不需要任何 Agent / DeepSeek / Bocha / Pi**：Review Decision 一旦
  Freeze，即可离线纯确定性重建。

## Multi-Institution Coordinator

- `MultiInstitutionBiographyCoordinator`（`coordination/multi-institution-biography-coordinator.ts`）：
  Frozen Inventory → `packetStore.createFromFrozenInventory` 机械生成多 Packet →
  逐 Packet 调用注入的 `runPacket`（已有 Workflow Boundary）→ per-packet result。
- Coordinator **自身不做**任何 search / fetch / inspect / 选人 / 选 URL / Review /
  Recovery；无地区-specific code、无全国行政区 Adapter、无 Scheduler / Retry /
  Queue / Priority / Distributed Lock。
- 大部分 coordinator 测试使用 Fake / Stub Packet Workflow，只验证调度、状态隔离、
  失败隔离与聚合结果。

## Bounded Concurrency

- in-process bounded pool，默认并发 2（server 4 vCPU 的开发值）。
- 一个行政区能否跑取决于 Pi + Skill + Generic Tools，不在此做地区适配。

## Failure Isolation

- 单个 Packet 失败 → `{ status: "FAILED", error }`，不 crash、不覆盖其它 Packet
  的成功结果；返回 per-packet result。

## Deferred

- **Retry / Resume**：Coordinator 第一版不自动无限 retry；失败 Packet 保留失败状态。
- **Production Graphile Integration**：后续把 Coordinator 接生产 Worker。
- **Frontend Task Integration**：本轮 Frontend 完全不动。
- **Excel Biography Result Mapping**：Excel Renderer 不动；下一阶段再做
  Biography Result → Excel mapping。
- **Batch Real Agent Execution**：本轮不做两个 Packet 的真实 LLM 全链 Smoke。

## Out of Scope

以下业务**明确不属于**本阶段、也不属于当前 Skill：

- **Pre-appointment publicity**（任前公示）
- **Acting appointment**（代理任命）
- **Election / appointment events**（选举 / 任命事件）
- **Departure events**（离任事件）
- **Other personnel event evidence**（其它人事事件 Evidence）

任何后续 Agent 不得据此文档扩展 `official-biography-evidence` 的 Skill Scope。
