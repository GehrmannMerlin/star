# Full Product Acceptance and Production Cutover — Plan

Date: 2026-08-15
Scope: STEP 20 (RELEASE / PRODUCTION CUTOVER — NOT feature development)
Skill: official-biography-evidence v3.1.0 (BIOGRAPHY_URL_ONLY, unchanged)

## writing-plans status
- writing_plans_skill_available: NO
- writing_plans_used: NO_UNAVAILABLE
- writing_plans_contract_fallback: YES

## Production environment map (discovered read-only on 43.142.31.198)
- production_repo: /opt/stellaris-zhengwujianli/repository
- production_branch: tencent/zhengwujianli
- production_head: 23caf6e9367258f87c56b5d0c09366cd64e39a3f
- deployment_method: release-directory build (current) + scripts/tencent_release/ blue-green (formal)
- compose_file: infra/tencent/compose.yml (project stellaris-zhengwujianli)
- backend_service: stellaris-zhengwujianli-backend-1 (127.0.0.1:3217)
- frontend_service: stellaris-zhengwujianli-web-1 (127.0.0.1:3218)
- graphile_worker_service: in-process in backend (STELLARIS_WORKER=1)
- database_service: stellaris-zhengwujianli-db-1 (postgres:17, db stellaris)
- nginx_config: /www/server/panel/vhost/nginx/tongjixinzhi.cn.conf
- domain: tongjixinzhi.cn (HTTPS, subpath /zhengwujianli/)
- artifact_root: /opt/stellaris-zhengwujianli/data/{evidence,exports}
- skill_path: third-party/china-official-url-evidence-suite/skills/official-biography-evidence (git submodule)
- env/config_source: /opt/stellaris-zhengwujianli/.env

## Release / dev branch relationship
- Dev HEAD b7b408f0e8142c84fd9e3b6250a56a6517bb1a07 = full agent pipeline (33 commits ahead).
- tencent/zhengwujianli (23caf6e) is ancestor of dev HEAD → fast-forward safe.

## Blocker fixes (minimal deployment config)
1. Dockerfile: add agent-runtime + agent-tools COPYs.
2. .dockerignore: un-exclude third-party (skill submodule).
3. compose.yml: add AGENT_MODEL_PROVIDER/AGENT_MODEL_ID/WEB_SEARCH_PROVIDER/BOCHA_API_KEY env + /root/.pi mount.
4. Pi model key at /root/.pi/agent/models.json (DeepSeek); Bocha key at /opt/shuangying/.env.

## Migrations
- Production applied: 001, 002, 003. Pending: 004, 005, 006, 007.
- All pending additive (CREATE TABLE / nullable ADD COLUMN / CREATE INDEX); DROPs in down() only.
- Destructive: NO. Applied automatically at backend startup (migrateToLatest).

## Plan (5 tasks)
1. Development acceptance + production discovery (done).
2. Prepare release artifact/config + rollback point (fast-forward, fixes, .env wiring, record rollback).
3. Controlled production deployment (build images, backup DB, recreate backend+web, health).
4. Production HTTP + one-target Agent + Excel acceptance.
5. Final verification + release documentation.

## Self-review
- No new business features; Skill Scope unchanged; reuse existing stack; provider-neutral env config;
  secrets not in git; production repo/compose/db/nginx/domain identified; rollback point recorded;
  additive migrations only; worker in backend; skill shipped in image; SSE/Excel routes verified; PARTIAL valid.
