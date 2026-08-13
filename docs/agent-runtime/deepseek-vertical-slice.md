# DeepSeek Pi Vertical Slice (Step 2B)

A short record of the first real LLM vertical slice. This phase proved the main
agent axis end to end: **DeepSeek → Pi AgentSession → Skill → Generic Tool →
Tool Result → marker output**.

## Architecture

- **Initial provider:** DeepSeek
- **Provider-neutral architecture:** YES — the workflow never reads a provider
  name. Provider, model, and credential all come from the server runtime.
- **Configured through:** `AGENT_MODEL_PROVIDER`, `AGENT_MODEL_ID`
- **Credential:** `DEEPSEEK_API_KEY` (env only; never committed, never logged)

Resolution chain (unchanged when switching to Claude / OpenAI / Gemini):

```
Environment
  -> RuntimeModelConfig        (AGENT_MODEL_PROVIDER / AGENT_MODEL_ID)
  -> ModelPolicy               (fail closed: MODEL_NOT_CONFIGURED)
  -> PiModelResolver           (fail closed: MODEL_NOT_FOUND)
  -> Pi Model Registry
  -> AgentSessionFactory       (createAgentSession)
```

- `deepseek` / `deepseek-v4-pro` are **not** hardcoded in business code — they
  are the server-side values for this phase only.
- Pi ships a native `deepseek` provider that reads `DEEPSEEK_API_KEY` from the
  environment; no OpenAI SDK or DeepSeek SDK adapter was added.

## Session

- Pi SDK `createAgentSession()` with:
  - `model` resolved via `PiModelResolver`
  - `resourceLoader` from `SkillRuntime` (Skill enters through Pi's loader)
  - in-memory `SessionManager` (no persistence this phase)
  - `tools: ["get_region_context"]` — the allowlist is the custom-tool registry,
    so default coding tools (`read`/`bash`/`edit`/`write`) stay disabled while
    the custom tool stays callable.

## Skill & Tool

- **Skill:** `official-biography-evidence` 3.1.0, loaded into the session
  through the Pi `ResourceLoader`.
- **Tool:** `get_region_context` — invoked via Pi Custom Tool Adapter →
  `ToolGateway` → existing region data; result returns through the same chain.

## Smoke

- Dev runner: `pnpm agent:smoke:deepseek --region-code <code>`
  (missing `--region-code` → `REGION_CODE_REQUIRED`).
- Tool-call evidence comes from `MemoryToolEventSink`: `get_region_context`
  recorded as `SUCCESS`.
- Success marker in agent output: `REGION_CONTEXT_OK`.
- Credential failures map to `AUTHENTICATION_FAILED`; never print the key.
