## Official Biography Agent Refactor Constraints

### Upstream Skill

Canonical project Skill dependency:

`third-party/china-official-url-evidence-suite/skills/official-biography-evidence`

The upstream Skill is read-only from this repository.

Do not modify files inside the Skill submodule as part of Web application tasks.

Skill changes must be made in the upstream Skill repository first and then consumed by updating the pinned submodule commit.

### Architecture Boundary

The Skill defines domain workflow and semantic contracts.

The Web repository remains responsible for runtime infrastructure, task orchestration, persistence, crawler tools, browser/search execution, evidence persistence and Web delivery.

Do not copy Skill semantics into ad-hoc hardcoded regional crawler rules without an explicit architecture decision.

### Generic Agent Principle

Do not add province-specific, city-specific or county-specific crawler implementations merely to support a new region.

Region-specific site profiles may be used as optional acceleration hints, but correctness must not depend on a manually maintained nationwide adapter catalog.

Prefer improving generic Search, HTTP, Browser, DOM extraction, Agent workflow, Skill instructions and Site Profile learning.

### Production Safety

`tencent/zhengwujianli` is the Tencent deployment baseline.

Agent refactor development must occur on `refactor/pi-agent-runtime` or a later explicitly approved development branch.

Do not deploy, restart Tencent production containers, migrate production databases or mutate production volumes unless the user explicitly requests a deployment operation.
