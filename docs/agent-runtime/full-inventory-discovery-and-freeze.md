# Step 8B — Real FULL Inventory Discovery and Freeze

Phase: Step 8B of the Stellaris Pi Agent refactor. First complete proof of the
no-seed, production-like FULL Inventory discovery loop, plus the real TARGETED
Inventory smoke and the real Bocha search smoke that were previously deferred
pending credentials.

## TARGETED real closure

`agent:smoke:inventory --region-code 310000 --institution 上海市人民政府 --seed-url https://www.sh.gov.cn/`
passes with real DeepSeek tool calling: Pi session → Skill loaded →
get_region_context / fetch_page / inspect_page → submit_inventory → Skill-schema
valid → frozen → agent completed. `--seed-url` remains a dev-smoke hint only; it
is never a business field.

## Bocha real search closure

`agent:smoke:search --query <public query>` passes: `search_web` → ToolGateway →
SearchProviderRegistry → BochaSearchProvider made a real HTTP request and
returned results with title + url. Closes the Step 4 deferred real search smoke.

## FULL discovery semantics

A FULL request is `{ regionCode, mode: "FULL" }` — no seed URL, no query, no
provider, no model, no API key. The Agent discovers the region institution
inventory through the Skill: get_region_context → search_web (locate candidate
official pages) → fetch_page / render_page → inspect_page (structure the page
into observations) → submit_inventory. Search results are navigation candidates
only; they are never the formal basis for the inventory.

## No-seed production-like smoke

`agent:smoke:inventory --mode full --region-code 320106 --budget-ms 360000`
(南京市鼓楼区) passed with `seed_url_used: NO`: search_web called through the
real Bocha provider, fetch_page + inspect_page called, submit_inventory called,
Skill-schema valid, inventory frozen with item_count > 1, agent completed. The
dev-only `--budget-ms` aborts the Pi session on timeout; it is not part of the
production request.

SMOKE_REGION_IS_NOT_AN_ADAPTER — the chosen region is a CLI smoke argument
only; no region-specific code or adapter was added.

## Provider abstraction

DeepSeek and Bocha are the INITIAL providers only. The inventory domain stays
provider-neutral: the runner never imports a provider SDK, never branches on a
provider name, and never reads an API key. Model wiring flows through
RuntimeModelConfig → ModelPolicy → PiModelResolver → AgentSessionFactory; search
flows through search_web → SearchProviderRegistry → (initial) Bocha.

## Output boundary

`submit_inventory` is the only formal output. Payloads validate against the
canonical Skill schema (SkillSchemaRegistry / institution-inventory.schema.json,
title "Frozen Institution Inventory Record") via ajv 2020. The first accepted
submission is frozen; a later submission is rejected
(INVENTORY_ALREADY_SUBMITTED). FULL and TARGETED share the same runner, the same
submit_inventory, the same canonical schema, and the same freeze boundary.
