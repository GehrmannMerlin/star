# Full Inventory Discovery and Freeze Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove the real, no-seed FULL Inventory discovery loop end-to-end on the dev server — Pi + official-biography-evidence Skill + `search_web` → Bocha + `fetch_page`/`render_page` + `inspect_page` + `submit_inventory` → Skill-schema validation → freeze — and close the deferred TARGETED real smoke, with minimal code.

**Architecture:** Reuse the provider-neutral `InventoryAgentRunner` for both FULL and TARGETED (one runner, one `submit_inventory`, one Skill canonical schema). The only production-code change is an optional dev-smoke `abortSignal` budget on the runner; everything else is smoke-runner support for FULL mode (`inventory-smoke.ts`), a FULL-only one-line role-prompt search step, targeted tests, and docs. No provider, API key, model id, or region is hardcoded in business code.

**Tech Stack:** pnpm monorepo (`@stellaris/agent-runtime`, `@stellaris/agent-tools`, `@stellaris/contracts`), Pi SDK 0.84.1, DeepSeek `deepseek-v4-pro` (initial model provider), Bocha Web Search (initial search provider), vitest, tsx.

**Spec:** `docs/agent-runtime/inventory-agent-foundation.md` (Step 8) · `docs/agent-runtime/deepseek-vertical-slice.md` (Step 2B) · `docs/agent-runtime/step4-provider-neutral-search-tool.md` (Step 4) — the Step 8 doc's "Deferred" section explicitly defers the real FULL inventory discovery smoke until the Bocha credential is available; this plan closes it.

## Global Constraints

- Server: `/opt/Stellaris-PiAgent-Dev` on `43.142.31.198`, branch `refactor/pi-agent-runtime-server-20260813`, start HEAD `9cc37e5`. Worktree clean.
- Node `v24.19.0` via `source ~/.nvm/nvm.sh && nvm use 24.19.0`; run package scripts with `corepack pnpm`.
- Secrets live ONLY in `/root/.stellaris-inventory-smoke-secrets` (mode 600): `AGENT_MODEL_PROVIDER=deepseek`, `AGENT_MODEL_ID=deepseek-v4-pro`, `DEEPSEEK_API_KEY`, `WEB_SEARCH_PROVIDER=bocha`, `BOCHA_API_KEY`. Never echoed/committed/logged; delete file and unset env at the end.
- DeepSeek = initial model provider, Bocha = initial search provider. Provider-neutral architecture mandatory — no `if provider === "deepseek"`, no `if searchProvider === "bocha"`, no SDK imports in the inventory domain.
- Skill `official-biography-evidence` 3.1.0 pinned and UNMODIFIED; institution INCLUDE/EXCLUDE rules stay in Skill → Pi, never duplicated in TypeScript.
- No region-specific code or adapters. The smoke region is a CLI argument only.
- INVENTORY tool allowlist exactly: `get_region_context search_web fetch_page render_page inspect_page submit_inventory`. Default coding tools (`read`/`bash`/`edit`/`write`) stay DISABLED.
- `submit_inventory` is the only output boundary; canonical schema from `SkillSchemaRegistry` / `institution-inventory.schema.json`; exactly one freeze per run.
- In-memory sinks only (`InMemoryInventorySubmissionSink`, `MemoryToolEventSink`). No Graphile, no PostgreSQL, no Institution Work Packet, no Investigator, no Leadership/PRIMARY.
- Test policy: TARGETED ONLY. No full workspace / crawler / backend / playwright / deploy suites. New tests ≤ 4–8.
- `devHints.seedUrl` and the smoke budget are dev-smoke-only; NOT part of the production `InventoryAgentRequest`.

---

## Task 1: Close TARGETED Inventory smoke and verify real DeepSeek tool calling

**Files:** none (operational)

- [ ] **Step 1: Create the temporary secrets file**

Run:
```bash
umask 077
cat > /root/.stellaris-inventory-smoke-secrets <<'EOF'
export DEEPSEEK_API_KEY=<user-authorized DeepSeek key>
export BOCHA_API_KEY=<user-authorized Bocha key>
export AGENT_MODEL_PROVIDER=deepseek
export AGENT_MODEL_ID=deepseek-v4-pro
export WEB_SEARCH_PROVIDER=bocha
EOF
chmod 600 /root/.stellaris-inventory-smoke-secrets
test -s /root/.stellaris-inventory-smoke-secrets && echo INVENTORY_SMOKE_SECRETS_READY
```
Expected: file created mode 600; output `INVENTORY_SMOKE_SECRETS_READY`. Never print the values.

- [ ] **Step 2: Verify keys are set without printing values**

Run:
```bash
source /root/.stellaris-inventory-smoke-secrets
test -n "$DEEPSEEK_API_KEY" && test -n "$BOCHA_API_KEY" && echo DEEPSEEK_KEY=SET && echo BOCHA_KEY=SET
```
Expected: `DEEPSEEK_KEY=SET` / `BOCHA_KEY=SET`.

- [ ] **Step 3: Run the runtime doctor once**

Run:
```bash
source /root/.stellaris-inventory-smoke-secrets
corepack pnpm agent:runtime:doctor
```
Expected: `pi_sdk: OK`, `pi_version: 0.84.1`, skill `official-biography-evidence` `3.1.0`, `model.status: READY` (`provider: deepseek`, `model_id: deepseek-v4-pro`), `search.provider: bocha`, `search.status: READY`, tool list contains the six INVENTORY tools, `default_coding_tools.enabled: NO`, `runtime.status: FOUNDATION_READY`. If any gate fails, stop and fix before proceeding.

- [ ] **Step 4: Run the TARGETED Inventory real smoke (STEP 8 closure)**

Run:
```bash
source /root/.stellaris-inventory-smoke-secrets
corepack pnpm agent:smoke:inventory --region-code 310000 --institution 上海市人民政府 --seed-url https://www.sh.gov.cn/
```
Expected output:
```
INVENTORY_SMOKE
status: OK
...
get_region_context_called: YES
fetch_page_called: YES        (or render_page_called: YES)
inspect_page_called: YES
submit_inventory_called: YES
schema_valid: YES
inventory_frozen: YES
agent_completed: YES
```
Proves the real DeepSeek tool-calling loop: Pi session → Skill loaded → role tools → `submit_inventory` → schema pass → freeze.

- [ ] **Step 5: Failure gate**

If `status: INVENTORY_SMOKE_FAILED` with no submit (e.g. `tool_calls = 0`): debug ONLY the Inventory role prompt, tool allowlist, Pi adapter, DeepSeek tool calling, or `submit_inventory` exposure. Do NOT touch crawler/search/browser/Skill, and do NOT proceed to FULL.

## Task 2: Verify real Bocha search_web provider path

**Files:** none (operational)

- [ ] **Step 1: Run the real Bocha search smoke**

Run:
```bash
source /root/.stellaris-inventory-smoke-secrets
corepack pnpm agent:smoke:search --query 安徽省人民政府
```
Expected output:
```
SEARCH_SMOKE
status: OK
tool_status: SUCCESS
provider: bocha
results: N          (N > 0)
first_title: ...     (non-empty)
first_url: ...       (non-empty)
```
Gate: `search_web` through `ToolGateway` → `SearchProviderRegistry` → `BochaSearchProvider` made a real HTTP request; `results.length > 0`; first result has `title` + `url`. `MemoryToolEventSink`: start=1, success=1. No human quality evaluation needed.

- [ ] **Step 2: Failure gate**

If Bocha fails, do NOT proceed to FULL Inventory. Diagnose only SearchProvider / Bocha API / credential / HTTP status. Return `STEP_8B_BLOCKED_AT_BOCHA_SEARCH`.

## Task 3: FULL Inventory discovery orchestration (minimal code)

**Files:**
- Modify: `packages/agent-runtime/src/inventory/inventory-agent-runner.ts` — optional `abortSignal` dev-smoke budget on `InventoryAgentRunnerDeps`.
- Modify: `packages/agent-runtime/src/inventory/inventory-role-prompt.ts` — FULL-only search step line.
- Modify: `packages/agent-runtime/src/smoke/inventory-smoke.ts` — `--mode full`, FULL smoke gate, `--budget-ms`, report fields (`mode`, `region_name`, `seed_url_used`, `item_count`); reject `--seed-url` for FULL.
- Create: `packages/agent-runtime/src/smoke/inventory-smoke.test.ts` — arg parsing + FULL gate.
- Modify: `packages/agent-runtime/src/inventory/inventory-agent-runner.test.ts` — two FULL-mode runner tests.

**Interfaces:**
- Consumes: existing `InventoryAgentRunner`, `InventoryAgentRequest`, `buildInventoryRolePrompt`, `createRuntimeConfig`, `PiModelResolver`, `ModelPolicy`, `SkillRuntime`, `listRegions`.
- Produces: `InventorySmokeMode = "targeted" | "full"`; `inventorySmokePassed(mode, report): boolean`; CLI `--mode full [--budget-ms <n>]`; `abortSignal?: AbortSignal` on `InventoryAgentRunnerDeps`.

- [ ] **Step 1: Add the optional dev-smoke abort budget to the runner**

In `InventoryAgentRunnerDeps` add `abortSignal?: AbortSignal;`. In `run()`, replace the single `await session.prompt(...)` with:

```ts
const promptText = buildInventoryRolePrompt(request, region.name, this.deps.devHints);
if (this.deps.abortSignal) {
  const onAbort = () => {
    void session.abort();
  };
  this.deps.abortSignal.addEventListener("abort", onAbort, { once: true });
  try {
    await session.prompt(promptText);
  } catch (error) {
    // A dev-smoke budget abort is not a runner failure: fall through to the
    // freeze check (INVENTORY_NOT_SUBMITTED unless a submission landed first).
    if (!this.deps.abortSignal.aborted) throw error;
  } finally {
    this.deps.abortSignal.removeEventListener("abort", onAbort);
  }
} else {
  await session.prompt(promptText);
}
```
Provider-neutral, optional, defaults off; the production request type is unchanged.

- [ ] **Step 2: Add FULL-mode search guidance to the role prompt**

In `buildInventoryRolePrompt`, make the discovery line mode-aware:

```ts
if (request.mode === "FULL") {
  lines.push(
    "先从 search_web 检索本行政区的候选官方页面（机构官网 / 机构目录），",
    "再 fetch_page / render_page 获取页面，用 inspect_page 解析为结构化观察。",
  );
} else {
  lines.push("通过 fetch_page / render_page 获取官方页面，用 inspect_page 解析为结构化观察。");
}
```

- [ ] **Step 3: Extend the smoke runner for FULL mode**

Add `mode` and `budgetMs` to `InventorySmokeArgs`; parse `--mode` (default `"targeted"`) and `--budget-ms`. Require `--institution` only for targeted. Reject `--seed-url` when `mode=full`. Build the request per mode and wire the abort controller (timer cleared in `finally` so the CLI exits promptly):

```ts
const controller = budgetMs ? new AbortController() : undefined;
const timer = controller ? setTimeout(() => controller.abort(), budgetMs) : undefined;
try {
  const runner = new InventoryAgentRunner({
    skillRuntime,
    modelPolicy: new ModelPolicy(),
    modelResolver: await PiModelResolver.create(),
    ...(mode === "targeted" && seedUrl ? { devHints: { seedUrl } } : {}),
    ...(controller ? { abortSignal: controller.signal } : {}),
  });
  const result = await runner.run(
    mode === "full"
      ? { regionCode, mode: "FULL" }
      : { regionCode, mode: "TARGETED", specifiedInstitutions: [institution] },
  );
  // build report ...
} finally {
  if (timer) clearTimeout(timer);
}
```

Add `mode`, `region_name` (from `listRegions()`), `seed_url_used` (`"NO"` for full), and `item_count` to the report. Extract the gate as a pure function:

```ts
export function inventorySmokePassed(
  mode: InventorySmokeMode,
  report: Record<string, unknown>,
): boolean {
  const called = (name: string) => report[`${name}_called`] === true;
  if (mode === "full") {
    return (
      report.inventory_frozen === true &&
      called("get_region_context") &&
      called("search_web") &&
      (called("fetch_page") || called("render_page")) &&
      called("inspect_page") &&
      called("submit_inventory") &&
      report.schema_valid === true &&
      typeof report.item_count === "number" &&
      report.item_count > 1
    );
  }
  return (
    report.inventory_frozen === true &&
    called("get_region_context") &&
    (called("fetch_page") || called("render_page")) &&
    called("inspect_page") &&
    called("submit_inventory") &&
    report.schema_valid === true
  );
}
```

- [ ] **Step 4: Add FULL-mode runner tests**

Append two tests to `inventory-agent-runner.test.ts` (exact code in Task 4 Step 1): a FULL request with only `regionCode` that submits → `COMPLETED`/frozen; a FULL request whose session never submits → `INVENTORY_NOT_SUBMITTED`.

- [ ] **Step 5: Add smoke arg/gate tests**

Create `packages/agent-runtime/src/smoke/inventory-smoke.test.ts` covering: parse `--mode full --region-code ... --budget-ms ...`; FULL gate requires `search_web_called` and `item_count > 1`; targeted gate stays strict about fetch/render + inspect.

## Task 4: Run targeted tests + real no-seed FULL Inventory smoke

**Files:** none (operational)

- [ ] **Step 1: Add and run the new FULL runner + smoke tests**

Append to `inventory-agent-runner.test.ts`:

```ts
it("runs a FULL request (regionCode only) and freezes a submitted inventory", async () => {
  const sink = new InMemoryInventorySubmissionSink();
  const runner = new InventoryAgentRunner({
    skillRuntime: stubSkillRuntime,
    modelPolicy: new ModelPolicy(() => ({ provider: "deepseek", model: "deepseek-v4-pro" })),
    modelResolver: await PiModelResolver.create(),
    sink,
    validator: stubValidator,
    createSession: async () => ({
      session: fakeSession(async () => {
        await sink.submit(VALID_INVENTORY);
      }) as never,
      extensionsResult: {} as never,
    }),
  });
  const result = await runner.run({ regionCode: "320106", mode: "FULL" });
  expect(result.status).toBe("COMPLETED");
  if (result.status !== "COMPLETED") return;
  expect(result.mode).toBe("FULL");
  expect(result.regionCode).toBe("320106");
  expect(result.frozen).toBe(true);
  expect(result.inventory).toHaveLength(1);
  expect(result.receipt.itemCount).toBe(1);
});

it("returns INVENTORY_NOT_SUBMITTED for a FULL request when the session never submits", async () => {
  const runner = new InventoryAgentRunner({
    skillRuntime: stubSkillRuntime,
    modelPolicy: new ModelPolicy(() => ({ provider: "deepseek", model: "deepseek-v4-pro" })),
    modelResolver: await PiModelResolver.create(),
    sink: new InMemoryInventorySubmissionSink(),
    validator: stubValidator,
    createSession: async () => ({
      session: fakeSession(async () => {}) as never,
      extensionsResult: {} as never,
    }),
  });
  const result = await runner.run({ regionCode: "320106", mode: "FULL" });
  expect(result.status).toBe("INVENTORY_NOT_SUBMITTED");
});
```

Run:
```bash
cd /opt/Stellaris-PiAgent-Dev && source ~/.nvm/nvm.sh && nvm use 24.19.0 >/dev/null
corepack pnpm --filter @stellaris/agent-runtime exec vitest run src/inventory/inventory-agent-runner.test.ts src/smoke/inventory-smoke.test.ts
```
Expected: all pass.

- [ ] **Step 2: Run the FULL-mode typecheck**

Run:
```bash
corepack pnpm --filter @stellaris/agent-runtime typecheck
```
Expected: no errors.

- [ ] **Step 3: Run the real no-seed FULL Inventory smoke on a small county-level region**

Pick a small non-Anhui county-level region from the real region tree with a public government site — `320106` 南京市鼓楼区 (county level under `320100`). CLI argument only, never a runtime constant.

Run:
```bash
source /root/.stellaris-inventory-smoke-secrets
corepack pnpm agent:smoke:inventory --mode full --region-code 320106 --budget-ms 360000
```
Expected output (key fields):
```
INVENTORY_SMOKE
status: OK
mode: full
region_name: 南京市鼓楼区
seed_url_used: NO
search_web_called: YES
fetch_page_called: YES        (or render_page_called: YES)
inspect_page_called: YES
submit_inventory_called: YES
schema_valid: YES
inventory_frozen: YES
agent_completed: YES
item_count: > 1
```
Proves the real no-seed product-like loop: region → Pi → get_region_context → search_web → Bocha HTTP → fetch/render → inspect_page → institution discovery → submit_inventory → canonical schema → freeze.

- [ ] **Step 4: Failure gate**

If the chosen region's site fails externally (timeout/WAF), switch to a similar small district (e.g. `310101` 黄浦区) and retry once. Never add a region adapter or region-conditional code. If `submit_inventory` was never called (non-frozen), debug the role prompt / tool policy / submit exposure only.

## Task 5: Self-review, docs, secret cleanup and commit

**Files:**
- Create: `docs/agent-runtime/full-inventory-discovery-and-freeze.md`
- Modify: `docs/agent-runtime/inventory-agent-foundation.md` (mark FULL smoke deferred → closed)

- [ ] **Step 1: Run the smoke-local targeted tests**

Run:
```bash
corepack pnpm --filter @stellaris/agent-runtime typecheck
corepack pnpm --filter @stellaris/agent-runtime exec vitest run src/inventory src/session/role-tool-policy.test.ts
```
Expected: pass.

- [ ] **Step 2: Write the documentation**

Create `docs/agent-runtime/full-inventory-discovery-and-freeze.md` recording: TARGETED real closure; FULL discovery semantics; no-seed production-like smoke; SearchProvider abstraction (Bocha = initial provider only); DeepSeek = initial model provider only; search result = navigation candidate only; `submit_inventory` as the only output; Skill canonical schema; freeze; the smoke region with `SMOKE_REGION_IS_NOT_AN_ADAPTER`. Update the foundation doc's Deferred note.

- [ ] **Step 3: Remove the temporary secrets**

Run:
```bash
rm -f /root/.stellaris-inventory-smoke-secrets
test ! -e /root/.stellaris-inventory-smoke-secrets && echo STELLARIS_TEMP_SECRETS_REMOVED
unset DEEPSEEK_API_KEY BOCHA_API_KEY AGENT_MODEL_PROVIDER AGENT_MODEL_ID WEB_SEARCH_PROVIDER
```
Expected: `STELLARIS_TEMP_SECRETS_REMOVED`.

- [ ] **Step 4: Secret scan**

Scan only the repo's tracked/modified files for the two key values and the `sk-` prefixes used this session. Confirm neither key is in git, source, or docs. (Do not scan the whole server.)

- [ ] **Step 5: Commit**

```bash
git add -A
git status --short
git commit -m "feat(agent): complete real full inventory discovery"
```
Expected: worktree clean after commit. No push, no merge.

---

## Self-Review (writing-plans + user gates)

- **Spec coverage:** FULL no-seed smoke ✔ (Task 4), Bocha real search ✔ (Task 2), TARGETED closure ✔ (Task 1), provider-neutral ✔ (constraints + Task 3), canonical schema / freeze ✔ (existing runner + Task 4 gate), targeted tests only ✔ (Tasks 3–5), secret hygiene ✔ (Tasks 1, 5).
- **Placeholder scan:** no TBD/TODO; every code/command step is concrete.
- **Type consistency:** `InventorySmokeMode`, `inventorySmokePassed(mode, report)`, `InventorySmokeArgs` fields match across Task 3; `abortSignal` on deps matches smoke wiring.

SELF_REVIEW: PASS
ARCHITECTURE_CONFLICT: NONE
EXECUTION_PREAUTHORIZED_BY_USER: YES
EXECUTION_MODE: INLINE_FAST
TEST_POLICY: TARGETED_ONLY
