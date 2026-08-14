# Biography URL Result and Persistent Work Packet Implementation Plan

**Date:** 2026-08-14
**STEP:** 15 — BIOGRAPHY URL RESULT AND PERSISTENT WORK PACKET FOUNDATION
**Execution mode:** INLINE_FAST (pre-authorized by user)
**writing-plans skill:** NOT AVAILABLE → contract fallback used

---

## Goal

把已经跑通的单机构链路（Institution → PRIMARY_1 / PRIMARY_2 → Biography URL Candidate → Reviewer → Recovery → Final Review Decision）沉淀为三类正式 Runtime 基础设施：

1. **Persistent Institution Work Packet Store** — 把当前 InMemory packet 状态做成 PostgreSQL 可持久化、可恢复的实现（保留 InMemory 实现）。
2. **Biography URL Final Result Read Model** — 从 Latest Frozen APPROVED Review Decision 纯确定性投影出「个人简历 URL 采集结果」（每包两个 PRIMARY 独立输出，未决不伪造 URL）。
3. **Multi-Institution Biography Workflow Orchestration Foundation** — Frozen Inventory → 多个 InstitutionWorkPacket → bounded concurrency → per-packet result 的编排骨架。

本轮 **不** 新增任何 Evidence Type，**不** 触碰任前公示 / 代理任命 / 选举任命 / 离任业务，**不** 接 Frontend / Excel / Graphile / Production DB。

## Architecture

```
Frozen Inventory (InventorySubmissionPayload)
        │
        ▼
MultiInstitutionBiographyCoordinator ──createFromFrozenInventory──► PostgresInstitutionWorkPacketStore
        │  bounded concurrency (default 2)                                 │  (institution_work_packet 表)
        │  per packet: runPacket(packet) [injected workflow boundary]      ▼
        │                                                         durable packet state (create/get/list/updateState/setPrimaryPersons)
        ▼
PacketRunResult[]  (per-packet SUCCESS/FAILED, failure isolated)
        │
        ▼  (after review decision frozen, offline)
BiographyUrlResultReader ──► Packet Store + Review Reader + Candidate Pool
        │                       │                │                │
        ▼                       ▼                ▼                ▼
   BiographyUrlResult     latest APPROVED    review payload    selected_candidate_id
   (per PRIMARY slot)     review decision    (target reviews)  → candidate pool url
        │
        ▼
   RESOLVED (biographyUrl present) | UNRESOLVED (no fake URL)
```

关键边界：
- **Biography Result 是 Read Model**，不是新的 Final Decision SSoT。最终事实仍是 `review_decision_submission` 中 latest `round_outcome='APPROVED'` 的那条记录。
- **Packet 表只存编排/状态 identity**：packet id、inventory hash、region、institution identity、state、attempt、failure code、两个 PRIMARY 人员的身份（target/person id/person name）。不存 Leadership JSON、Candidate Pool、Review payload、Recovery payload。
- **Coordinator 不含业务语义决策**：不 search / fetch / inspect / 选人 / 选 URL / review / recovery；只调用注入的 `runPacket` boundary。
- **Result 投影纯确定性**：不需要 DeepSeek / Bocha / Pi / Agent Session。

## Tech Stack

- TypeScript 5.x, Node 24.19.0（服务器 nvm 已确认）
- Kysely 0.29.x + pg 8.22.x（`@stellaris/db`）
- Kysely Migrator（`migration-provider.ts`，下一条编号 006）
- Testcontainers PostgreSQL 18（`@stellaris/db/testing/pg.js`）
- Vitest（targeted tests only）
- 不新增 Prisma / Drizzle / Knex / Sequelize 等第二套 ORM

## Global Constraints

- Skill `official-biography-evidence` **3.1.0 完全不动**。
- Skill 硬边界：只做「个人简历信息（岗位信息 URL）采集」。禁止任前公示、代理任命、选举任命、离任等 Event Evidence。
- Skill 最终业务 Artifact 术语：`final_url_decisions.jsonl` 的 `selected_url`（个人简历/岗位信息 URL）。新 Result API 使用 **Biography URL** 语义。
- 历史 Runtime `position` 命名（`POSITION_DECIDED`、`FinalPositionDecision`、`position_url`）**兼容保留**，不做大规模 rename；新结果层使用 `biographyUrl` / `BiographyUrlResult`。
- 不重新计算 Leadership；不重新选择 PRIMARY；不重新实现 Candidate Ranking / Reviewer / Recovery。
- Multi-Institution Coordinator 无地区-specific code，无全国行政区 Adapter，无 Scheduler / Retry / Queue / Lock。
- 不 hardcode DeepSeek / Bocha。
- Production DB 完全不碰；所有 migration 只在 disposable Testcontainers PostgreSQL 上验证。
- 只跑 targeted tests + affected package typecheck + 一次 disposable smoke。

## File Structure

新增/修改（server worktree: `refactor/pi-agent-runtime-server-20260813`）：

```
packages/db/src/
├─ migration-006-work-packet-persistence.ts        [NEW]  institution_work_packet 表
├─ migration-provider.ts                            [EDIT] 注册 006
├─ schema.ts                                        [EDIT] Database 接口 + TABLE_NAMES
├─ types.ts                                         [EDIT] InstitutionWorkPacketRow
└─ repos/
   ├─ institution-work-packet.ts                    [NEW]  InstitutionWorkPacketRepository
   └─ index.ts                                      [EDIT] 注册

packages/agent-runtime/src/
├─ work-packet/
│  ├─ institution-work-packet.ts                    [EDIT] 扩展 primaryPersons；新增 StorePort + Postgres store
│  └─ institution-work-packet-persistence.test.ts   [NEW]  Postgres packet store tests
├─ results/
│  ├─ biography-url-result.ts                       [NEW]  Read Model + projector + reader
│  ├─ biography-url-result.test.ts                  [NEW]  projection tests
│  └─ biography-url-result-rehydrate.test.ts        [NEW]  rehydrate test
├─ coordination/
│  ├─ multi-institution-biography-coordinator.ts    [NEW]  bounded orchestrator
│  └─ multi-institution-biography-coordinator.test.ts [NEW]  coordinator tests
├─ persistence/
│  ├─ review-decision-reader.ts                     [EDIT] HistoryRow 增加 sourceReviewId（additive）
│  ├─ index.ts                                      [EDIT] 导出新模块
│  ├─ work-packet-result-smoke.ts                   [NEW]  disposable PG smoke
│  └─ work-packet-result-smoke.test.ts              [NEW]  运行 smoke 的 test

docs/agent-runtime/
└─ biography-url-result-persistent-work-packet.md   [NEW]  文档
docs/superpowers/plans/
└─ 2026-08-14-biography-url-result-persistent-work-packet.md  [NEW]  本计划
```

## Task 列表

### Task 1 — Inspect actual Skill biography URL contracts + current packet/result persistence boundaries

**状态：已完成**（planning 期间已执行，见下方 Findings）。

Files:
- `third-party/china-official-url-evidence-suite/skills/official-biography-evidence/SKILL.md`
- `.../schemas/final-url-decision.schema.json`、`person-decision.schema.json`、`url-candidate-pool.schema.json`
- `packages/agent-runtime/src/work-packet/institution-work-packet.ts`
- `packages/agent-runtime/src/persistence/review-decision-reader.ts`、`evidence-reader.ts`、`composite-candidate-rehydration.ts`
- `packages/db/src/migration-005-*.ts`、`schema.ts`、`repos/review-decision-submission.ts`

Findings:
- Skill 最终 Artifact = `final_url_decisions[].selected_url`（个人简历 URL）。`person_decision.primary_slot` 为 `PRIMARY_1 | PRIMARY_2`，含 `target_id / person_id / person_name`。Candidate Pool row 含 `candidate_id / target_id / url`。
- Runtime `ReviewerSubmissionPayload.reviews[]` 每条有 `target_id + selected_candidate_id`；`finalPositionDecisionsFromReview` 已实现 `selected_candidate_id → pool.url` 的机械映射。
- Packet 类型已含 `packetId/inventoryHash/regionCode/institutionId/institutionName/administrativeLevel/institutionType/state/attemptNo/investigatorSessionId/failureCode/createdAt/updatedAt`；状态机 `ALLOWED_TRANSITIONS` 已冻结。
- db latest migration = 005（`2026-08-14-recovery-rereview-persistence`），下一编号 006。
- 现无 person name 的持久化来源（person decisions 只在 reviewer frozenInput / Skill workspace）；Biography Result 需要 person identity → 放入 packet 编排 identity。

Commit: N/A（inspection 阶段）。

---

### Task 2 — Implement persistent InstitutionWorkPacket store

Files:
- `packages/db/src/migration-006-work-packet-persistence.ts`（NEW）
- `packages/db/src/schema.ts`（EDIT）
- `packages/db/src/types.ts`（EDIT）
- `packages/db/src/migration-provider.ts`（EDIT）
- `packages/db/src/repos/institution-work-packet.ts`（NEW）
- `packages/db/src/repos/index.ts`（EDIT）
- `packages/agent-runtime/src/work-packet/institution-work-packet.ts`（EDIT）

Interfaces:
```ts
// agent-runtime work-packet
export type PrimaryPersonIdentity = {
  targetId: string;
  personId: string | null;
  personName: string | null;
};

export type InstitutionWorkPacket = {
  // …现有字段不变…
  primaryPersons?: { primary1: PrimaryPersonIdentity | null; primary2: PrimaryPersonIdentity | null };
};

export interface InstitutionWorkPacketStorePort {
  createFromFrozenInventory(frozen: InventorySubmissionPayload, opts?: { regionCode?: string }): Promise<InstitutionWorkPacket[]>;
  get(packetId: string): Promise<InstitutionWorkPacket | undefined>;
  list(): Promise<InstitutionWorkPacket[]>;
  updateState(packetId: string, to: InstitutionWorkPacketState, meta?: PacketStateMeta): Promise<InstitutionWorkPacket>;
  setPrimaryPersons(packetId: string, persons: { primary1: PrimaryPersonIdentity | null; primary2: PrimaryPersonIdentity | null }): Promise<InstitutionWorkPacket>;
}

export class PostgresInstitutionWorkPacketStore implements InstitutionWorkPacketStorePort { … }
```

DB 表 `institution_work_packet`（列：packet_id PK text, inventory_hash, region_code, institution_id, institution_name, administrative_level, institution_type, state, attempt_no int, investigator_session_id, failure_code, primary1_target_id, primary1_person_id, primary1_person_name, primary2_target_id, primary2_person_id, primary2_person_name, created_at, updated_at）。

Repository：`InstitutionWorkPacketRepository`（insert / getByPacketId / list / updateState / setPrimaryPersons；upsert-free，PK 冲突抛 23505）。

Postgres store 行为：
- `createFromFrozenInventory`：与 InMemory 完全相同的机械过滤（只 INCLUDE record 建包）+ 持久化 + 返回包。
- `updateState`：先读 DB packet → 用**同一份** `ALLOWED_TRANSITIONS` 校验合法 transition → 持久化。非法 transition 仍抛 `PacketStateError`（Store 只是存储，状态机语义不变）。
- `setPrimaryPersons`：附加两个 PRIMARY 人员身份（不改变 state）。

明确步骤：
1. migration-006 创建表 + 索引（packet_id PK；created_at/updated_at）。
2. schema.ts 加 `institution_work_packet: InstitutionWorkPacketTable` 接口 + `TABLE_NAMES` 追加。
3. types.ts 加 `InstitutionWorkPacketRow = Selectable<InstitutionWorkPacketTable>`。
4. migration-provider.ts 注册 006（追加到 MIGRATIONS 尾部）。
5. repos/institution-work-packet.ts：Repository 实现。
6. repos/index.ts：注册 `institutionWorkPacket` + export。
7. agent-runtime work-packet：扩展类型 + StorePort + Postgres store 实现；InMemory store 保留并补 `setPrimaryPersons`。

Targeted Verification：
- `pnpm --filter @stellaris/db typecheck`
- `pnpm --filter @stellaris/agent-runtime typecheck`
- Postgres store 单测（create+reload / state update+reload / illegal transition rejected / 状态隔离）

Commit: 并入最终代码 commit（Task 5 统一提交）。

---

### Task 3 — Implement derived BiographyUrlResult read model from frozen approved review decisions

Files:
- `packages/agent-runtime/src/results/biography-url-result.ts`（NEW）
- `packages/agent-runtime/src/persistence/review-decision-reader.ts`（EDIT，additive `sourceReviewId`）
- `packages/agent-runtime/src/persistence/index.ts`（EDIT，导出）

Interfaces:
```ts
export type BiographyUrlSlotStatus = "RESOLVED" | "UNRESOLVED";

export type BiographyUrlSlotResult = {
  primarySlot: "PRIMARY_1" | "PRIMARY_2";
  targetId: string | null;
  personId: string | null;
  personName: string | null;
  biographyUrl: string | null;   // Skill 语义：final_url_decisions.selected_url
  decisionStatus: BiographyUrlSlotStatus;
  reviewRound: number | null;
  sourceReviewId: string | null; // review_decision_submission.id
};

export type BiographyUrlResultStatus = "RESOLVED" | "PARTIAL" | "UNRESOLVED";

export type BiographyUrlResult = {
  packetId: string;
  regionCode: string | null;
  institutionId: string;
  institutionName: string;
  status: BiographyUrlResultStatus;
  sourceOfTruth: "LATEST_FROZEN_APPROVED_REVIEW";
  primary1: BiographyUrlSlotResult;
  primary2: BiographyUrlSlotResult;
};

export type ReviewReaderPort = { latestByPacket(packetId: string): Promise<ReviewDecisionHistoryRow | null> };
export type BiographyUrlResultReaderDeps = {
  packetStore: InstitutionWorkPacketStorePort;
  reviewReader: ReviewReaderPort;
  loadCandidatePool: (packetId: string) => Promise<UrlCandidatePoolRow[]>;
};
export class BiographyUrlResultReader { async read(packetId: string): Promise<BiographyUrlResult | null> }
export function projectBiographyUrlResult(packet, latestApproved, pool): BiographyUrlResult  // pure, deterministic
```

投影规则：
- latest review 不存在 或 `roundOutcome !== "APPROVED"` → 两 slot 均 `UNRESOLVED`（`biographyUrl: null`），packet `status: "UNRESOLVED"`。绝不伪造 URL（§44/§97）。
- latest review APPROVED → 逐 `review.target_id` 匹配 primary slot（优先 packet.primaryPersons 的 targetId 映射；无则按 review 数组顺序 PRIMARY_1/PRIMARY_2，与 Reviewer 契约一致）→ `selected_candidate_id` 在 pool 中查 URL → RESOLVED。仅一 slot 有 URL → packet `status: "PARTIAL"`。
- `sourceReviewId` 来自 review history row 的 DB `id`（reader `toHistoryRow` 增加 `sourceReviewId: row.id`）。
- **Round 2 覆盖 Round 1 只发生在投影**：`latestByPacket` 取最高 round；DB append-only 历史不变（不覆盖 Round 1 行）。

明确步骤：
1. `review-decision-reader.ts`：`ReviewDecisionHistoryRow` 增加 `sourceReviewId: string`；`toHistoryRow` 填 `row.id`。
2. `biography-url-result.ts`：类型 + 纯投影函数 `projectBiographyUrlResult` + `BiographyUrlResultReader` 容器。
3. `persistence/index.ts` 导出。

Targeted Verification：
- `pnpm --filter @stellaris/agent-runtime typecheck`
- 投影单测（两 PRIMARY 输出 / unresolved 不伪造 / round2 覆盖投影不覆盖历史 / 单 PRIMARY 决 → PARTIAL）
- rehydrate 单测（new Packet Store + new Review Reader → same result）

---

### Task 4 — Implement lightweight multi-institution biography workflow coordinator

Files:
- `packages/agent-runtime/src/coordination/multi-institution-biography-coordinator.ts`（NEW）
- `packages/agent-runtime/src/persistence/index.ts`（EDIT，导出）

Interfaces:
```ts
export type PacketRunResult = {
  packetId: string;
  status: "SUCCESS" | "FAILED";
  state: InstitutionWorkPacketState;
  error?: string;
};

export type PacketWorkflowRunner = (packet: InstitutionWorkPacket) => Promise<PacketRunResult>;

export type MultiInstitutionBiographyCoordinatorDeps = {
  packetStore: InstitutionWorkPacketStorePort;
  runPacket: PacketWorkflowRunner;       // 注入的已有 Workflow Boundary（真实 runner 或测试 Fake）
  concurrency?: number;                  // bounded; default 2（server 4 vCPU）
};

export class MultiInstitutionBiographyCoordinator {
  constructor(deps: …);
  async run(frozen: InventorySubmissionPayload, opts?: { regionCode?: string }): Promise<{
    packets: InstitutionWorkPacket[];
    results: PacketRunResult[];
  }>;
}
```

行为：
- `createFromFrozenInventory` 生成全部 packets（机械过滤 INCLUDE）。
- 用 in-process bounded pool 执行每个 packet 的 `runPacket`（默认并发 2；无需队列/分布式锁）。
- **Failure isolation**：单个 packet 抛错 → 记 `{ status: "FAILED", error }`，不影响其它 packet；返回 per-packet result。
- Coordinator 自身**不做**任何 search/fetch/inspect/选人/选 URL/review/recovery；无 retry；无地区分支。

明确步骤：
1. 新建 coordinator 类型 + 实现（并发池为简单 Promise 计数信号量）。
2. 导出。
3. 单测：2-packet 调度、bounded concurrency（验证并发上限）、失败隔离（A FAILED、B SUCCESS，各自状态独立、B 结果不被覆盖）、聚合结果。

Targeted Verification：
- `pnpm --filter @stellaris/agent-runtime typecheck`
- coordinator 单测（全部 Fake workflow，不调真实 LLM）

---

### Task 5 — Targeted tests + persistence/orchestration smoke + docs + commit

Files:
- `packages/agent-runtime/src/work-packet/institution-work-packet-persistence.test.ts`（NEW）
- `packages/agent-runtime/src/results/biography-url-result.test.ts`（NEW）
- `packages/agent-runtime/src/results/biography-url-result-rehydrate.test.ts`（NEW）
- `packages/agent-runtime/src/coordination/multi-institution-biography-coordinator.test.ts`（NEW）
- `packages/agent-runtime/src/persistence/work-packet-result-smoke.ts`（NEW）
- `packages/agent-runtime/src/persistence/work-packet-result-smoke.test.ts`（NEW）
- `docs/agent-runtime/biography-url-result-persistent-work-packet.md`（NEW）

测试清单（7–11 个用例，targeted only）：
1. Packet Postgres Store：create + reload（新实例）
2. Packet Postgres Store：state update + reload
3. Packet Postgres Store：illegal transition 仍被拒绝（PacketStateError）
4. Packet Postgres Store：两个 packet 状态隔离
5. Biography Result 投影：latest approved review → 两 PRIMARY 各自 URL
6. Biography Result 投影：unresolved review → 无伪造 final URL
7. Biography Result 投影：review round 2 overrides round 1 in projection（不覆盖历史）
8. Biography Result 投影：仅一 PRIMARY 已决 → PARTIAL + 另一 UNRESOLVED
9. Rehydrate：new Packet Store + new Review Reader → same Biography Result
10. Coordinator：2-packet 调度 + 聚合结果
11. Coordinator：bounded concurrency + failure isolation

Disposable PostgreSQL smoke（`work-packet-result-smoke.ts`）流程（§60）：
```
apply new migration (001..006)
→ create Packet A（含 primaryPersons, state POSITION_DECIDED）
→ create Packet B（state READY_FOR_REVIEW 或未决）
→ persist 合法 Review Decision fixture（latest APPROVED，选中候选指向 pool）
→ destroy repository instances
→ new Postgres Packet Store
→ new Postgres Review Reader + Evidence Reader（original pool）
→ reload Packet A/B
→ derive Biography Results
→ Packet A: primary1 + primary2 biographyUrl present（RESOLVED）
→ Packet B: UNRESOLVED（不错误生成 URL）
→ PASS
```

文档 `docs/agent-runtime/biography-url-result-persistent-work-packet.md`：
Purpose / Skill Scope (Biography URL Collection Only) / Persistent InstitutionWorkPacket / Packet State Durability / Biography URL Final Result Read Model / Latest Approved Review as SSoT / Two PRIMARY Results / Unresolved Result Semantics / Multi-Institution Coordinator / Bounded Concurrency / Failure Isolation / Deferred (Retry-Resume, Production Graphile Integration, Frontend Task Integration, Excel Biography Result Mapping) / **Out of Scope**（Pre-appointment publicity、Acting appointment、Election/appointment events、Departure events、Other personnel event evidence）。

Verification（§74，最终只跑这些）：
- A. `packages/agent-runtime` packet persistence tests
- B. biography result projection tests
- C. rehydrate test
- D. coordinator tests
- E. migration targeted validation（随 smoke 全量 001..006 应用）
- F. typecheck: `@stellaris/db`、`@stellaris/agent-runtime`（`@stellaris/agent-tools` NOT_MODIFIED）
- G. 一次 disposable PostgreSQL Packet + Result smoke

Build：无 exports/entrypoint 变化 → NOT_REQUIRED（新增模块由既有 `tsc` typecheck 覆盖）。

Commit（最多两个自然 commit）：
1. `feat(agent): persist work packets and expose biography url results`（代码）
2. `docs(agent): record biography workflow foundation`（文档）

禁止：push / merge production / deploy。
