# Institution Work Packet and Investigator Agent Foundation

**STEP 9** — the first real per-institution investigation loop in the Pi Agent runtime.

## Purpose

This phase builds a minimal but real closed loop on the dev server:

```text
Frozen Inventory
→ InstitutionWorkPacket (runtime scheduling object)
→ Investigator Agent (role INVESTIGATOR, Skill official-biography-evidence 3.1.0)
→ get_region_context / search_web (Bocha) / fetch_page|render_page / inspect_page
→ complete Leadership Structure
→ Skill-selected PRIMARY_1 + PRIMARY_2
→ submit_investigation
→ canonical Skill schema validation + runtime Observation Gate
→ in-memory freeze
→ packet READY_FOR_REVIEW
```

Exactly one Institution Packet is investigated per run. No Reviewer, no Recovery, no
PostgreSQL, no Graphile in this phase.

## Frozen Inventory → Work Packet

`InMemoryInstitutionWorkPacketStore.createFromFrozenInventory(payload, opts)` generates a
work packet for **every** frozen-inventory record whose `decision === "INCLUDE"`. EXCLUDE /
DUPLICATE_ENTRY / MERGE_ALIAS records are honored mechanically — no INCLUDE/EXCLUDE
semantics are re-judged in TypeScript. Each packet carries:

- `packetId` (`randomUUID`) and `inventoryHash` (sha256 of the frozen payload)
- `regionCode`, `institutionId`, `institutionName`, `administrativeLevel`, optional `institutionType`
- `state`, `attemptNo`, optional `investigatorSessionId` / `failureCode`
- `createdAt` / `updatedAt`

The packet is a **runtime scheduling object only**. It deliberately does NOT replicate the
Skill's own workspace `institution-work-packet.schema.json` (source routes, expected leader
section names, Skill `status` enum) — business semantics stay in Skill → Pi.

## Packet State Machine

```text
PENDING
  ↓ (Investigator session ready)
INVESTIGATING
  ↓ (valid submit + Observation Gate PASS + schema PASS)
READY_FOR_REVIEW
```

Failures keep the packet (never deleted):

```text
INVESTIGATING → FAILED  (failureCode INVESTIGATION_NOT_SUBMITTED | INVESTIGATION_OBSERVATION_REQUIRED)
PENDING       → CANCELLED
INVESTIGATING → CANCELLED
```

Transitions are fail-closed (`PacketStateError` on any other move). Starting a run on a
packet that is not `PENDING` returns `PACKET_ALREADY_STARTED` — two Investigator sessions on
one packet are impossible.

`READY_FOR_REVIEW` means the **Investigator phase** is complete — NOT final business
completion. Evidence, Recovery, Reviewer and the final decision gate still follow.

## Investigator Role

`AgentRole.INVESTIGATOR` (already present in `@stellaris/contracts`). The
`InvestigatorAgentRunner` wires one `AgentSessionFactory` `INVESTIGATOR` session per packet
and loads the pinned Skill through Pi's `ResourceLoader`.

## Tool Policy

```text
INVESTIGATOR: get_region_context, search_web, fetch_page, render_page, inspect_page, submit_investigation
```

`submit_inventory` is NOT granted to the Investigator. Default Pi coding tools
(`read`/`bash`/`edit`/`write`) stay DISABLED for production sessions.

## Leadership-before-PRIMARY boundary

The role prompt states the Skill workflow boundary: build the **complete** Leadership
Structure first (official-site discovery → current-leader section → complete
`all_visible_leaders` / `official_order` / `party_head` / `administrative_head`,
`structure_complete: true`), and only then select `PRIMARY_1` / `PRIMARY_2`. The exact
"complete" semantics and the PRIMARY ranking stay in the Skill → Pi; TypeScript never counts
leaders or ranks people.

## submit_investigation

`submit_investigation` is the Investigator's only structured output boundary (no free-text /
regex parsing). It is a light **Runtime Envelope**:

```json
{
  "leadership": { "…canonical leadership-structure artifact…" },
  "selectedOfficials": [ "…person-decision artifact PRIMARY_1…", "…person-decision artifact PRIMARY_2…" ]
}
```

The envelope is transport only and does not duplicate Skill fields. It routes through the
same `ToolGateway` as every other agent tool (`Pi custom tool → ToolGateway →
submit_investigation → Skill schema validation → sink`).

## Skill Schema Validation

Each envelope part is validated separately through `SkillSchemaRegistry` (pinned Skill
schemas only):

- `leadership-structure.schema.json` — `structure_complete` must be `true`, at least one
  visible leader, `official_order` present, etc.
- `person-decision.schema.json` — `primary_slot` must be `PRIMARY_1` / `PRIMARY_2`,
  `person_status` / `currentness_quality` enums, `selection_basis` non-empty, etc.

A deterministic mechanical gate additionally rejects `PRIMARY_1` and `PRIMARY_2` when they
resolve to the same natural person (same `person_id`, else same `person_name`) — a
uniqueness check, not a ranking rule. PRIMARY selection itself is Skill → Pi.

## Observation Gate

The runner does not trust the Agent's claim that pages were opened. On completion it checks
`MemoryToolEventSink` for real tool events:

- at least one SUCCESS `fetch_page` **or** `render_page`, **and**
- at least one SUCCESS `inspect_page`.

A search snippet alone never forms a PRIMARY. If `submit_investigation` was called but the
gate fails, the runner returns `FAILED` / `INVESTIGATION_OBSERVATION_REQUIRED` (packet stays
`FAILED`); the packet only reaches `READY_FOR_REVIEW` with the gate PASS.

## In-memory Freeze

`InMemoryInvestigationSubmissionSink` accepts exactly one submission per packet; a later
submission is rejected (`INVESTIGATION_ALREADY_SUBMITTED`). No persistence in this phase —
the submission and tool events live only in memory for the run's lifetime.

## Deferred

- Position URL Candidate pipeline (`url_candidate_pool` / final URL decision)
- Persistent Evidence / persistent tool events
- Recovery Agent
- Reviewer Agent
- PostgreSQL packet / submission store
- Graphile packet scheduling

These are planned separately (STEP 10+). The Skill itself is unchanged (3.1.0).
