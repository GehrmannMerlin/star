# Full Product Acceptance and Production Cutover — Report

Date: 2026-08-15 (STEP 20)

## Release
- release_head: ec9291c3614994db2187b8f2cb11caa8f3d3ba8e (chore(deploy): prepare biography agent production runtime)
- production_head_before: 23caf6e9367258f87c56b5d0c09366cd64e39a3f
- deployment_method: fast-forward dev branch + docker compose recreate backend/web (images a497cb3)
- rollback_point: previous images stellaris-zhengwujianli-backend / -web (ids ba13ea32 / 1a58871d)

## Production Environment
- production_repo: /opt/stellaris-zhengwujianli/repository
- production_branch: tencent/zhengwujianli
- compose_file: infra/tencent/compose.yml (project stellaris-zhengwujianli)
- backend_service: stellaris-zhengwujianli-backend-1 (127.0.0.1:3217)
- frontend_service: stellaris-zhengwujianli-web-1 (127.0.0.1:3218)
- graphile_worker_service: in-process backend (STELLARIS_WORKER=1)
- database_service: stellaris-zhengwujianli-db-1 (postgres:17)
- nginx_config: /www/server/panel/vhost/nginx/tongjixinzhi.cn.conf
- domain: tongjixinzhi.cn (HTTPS subpath /zhengwujianli/)
- artifact_root: /opt/stellaris-zhengwujianli/data/{evidence,exports}
- skill_path: third-party/china-official-url-evidence-suite/skills/official-biography-evidence

## Blocker fixes applied (deployment config only, no business code)
1. Dockerfile: package agent-runtime + agent-tools (dist/package.json/node_modules) + third-party skill + .pi settings.
2. .dockerignore: ship third-party skill submodule.
3. compose.yml: AGENT_MODEL_PROVIDER/AGENT_MODEL_ID/WEB_SEARCH_PROVIDER/BOCHA_API_KEY env + STELLARIS_TASK_RUNTIME=biography + /root/.pi rw mount.
4. .env: provider config + keys (DeepSeek from /root/.pi/agent/models.json, Bocha from /opt/shuangying/.env) — never in git.

## Database
- backup: state/backups/20260815T093003Z-stellaris.dump (84580 bytes, sha256 bfc8f2ce…)
- migrations applied: 001→007 (004-agent-persistence, 005-recovery-rereview, 006-work-packet, 007-task-runtime-result)
- destructive migration: NO (all additive; DROP in down() only)

## Skill / Providers
- skill: official-biography-evidence v3.1.0 (loaded, PI_RESOURCE_LOADER)
- model: deepseek / deepseek-v4-flash (READY)
- search: bocha (READY)
- browser: /usr/bin/chromium (READY)
- credential in repo/logs: NO

## Development release gate
- typecheck: PASS (all packages)
- build: PASS (pnpm build + vite build)
- targeted tests: PASS (agent-runtime 188, agent-tools 73, web 49, backend + exporter)

## Production acceptance
- Stage A (no-agent): frontend 200 (政务简历采集), session, regions, health 200, worker up — PASS
- Stage B (real agent TARGETED): task created → Graphile consumed → Pi session → DeepSeek called → Bocha called → fetch/render active (~25 min)
- terminal_status: FAILED (INVESTIGATION_NOT_SUBMITTED) — the investigator agent runs but the model does not submit an investigation; reproduced identically for 鼓楼区人民政府 (site 403) and 上海市人民政府 (site 200).
- history: PASS (4 tasks listed)
- SSE: PASS (state_changed events replayed)
- export route: PASS (409 on FAILED task — correct; XLSX generation requires a resolved terminal)

## Known Deferred (POST-LAUNCH STABILIZATION)
- investigator submission reliability (INVESTIGATION_NOT_SUBMITTED) — model does not complete submit_investigation within a single session
- retry_resume framework
- full-region production acceptance
- advanced monitoring/alerts
