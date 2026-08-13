# Server Development Baseline

Recorded: 2026-08-13 (Asia/Shanghai)

## Server

- OS: OpenCloudOS 9.4, Linux 6.6.117-45.oc9.x86_64
- CPU: 4 logical CPUs
- RAM: 7.5 GiB; 13 GiB swap
- Disk: 1000 GiB root filesystem, 743 GiB available at audit time
- Node: 24.19.0 selected for repository work through existing NVM installation
- pnpm: project-managed through Corepack; no system upgrade performed
- Python: 3.11.6
- Docker: 29.4.0
- Docker Compose: 5.1.1
- Chromium: `/usr/bin/google-chrome`

## Production Baseline

- Production repository: `/opt/stellaris-zhengwujianli/repository`
- Production branch: `tencent/zhengwujianli`
- Original audited HEAD: `71015ba2fd36c2f5e832bfa52ffc7fa7131fe656`
- Latest-frontend baseline HEAD after approved Git-only synchronization: `23caf6e9367258f87c56b5d0c09366cd64e39a3f`
- Current production containers: `stellaris-zhengwujianli-db-1`, `stellaris-zhengwujianli-backend-1`, `stellaris-zhengwujianli-web-1`
- Production containers, database and volumes were not changed by this bootstrap.

## Development Baseline

- Development worktree: `/opt/Stellaris-PiAgent-Dev`
- Development branch: `refactor/pi-agent-runtime-server-20260813`
- Development start HEAD: `23caf6e9367258f87c56b5d0c09366cd64e39a3f`

## Skill Dependency

- Name: `official-biography-evidence`
- Version: `3.1.0`
- Upstream: `https://github.com/GehrmannMerlin/china-official-url-evidence-suite.git`
- Submodule path: `third-party/china-official-url-evidence-suite`
- Pinned commit: `40993e24109d26cb576b532223956053fcc4672f`
- Pi discovery: `.pi/settings.json`

No credential, token, API key, cookie or database password is recorded here.
