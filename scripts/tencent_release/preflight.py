"""Read-only Tencent production boundary and host preflight checks."""

from __future__ import annotations

import os
from pathlib import Path
import re
from typing import Callable

from .contract import ReleaseContract
from .report import write_report
from .runner import CommandRunner, SubprocessRunner
from .scope import require_container_name, require_path_in_app_root


_PRODUCTION_CONTAINERS = (
    "stellaris-zhengwujianli-db-1",
    "stellaris-zhengwujianli-backend-1",
    "stellaris-zhengwujianli-web-1",
)


def _run(
    runner: CommandRunner,
    argv: list[str],
    *,
    timeout: int = 30,
) -> str:
    return runner.run(argv, timeout=timeout).stdout.strip()


def require_clean_synced_repository(
    contract: ReleaseContract,
    *,
    runner: CommandRunner | None = None,
) -> str:
    active_runner = runner or SubprocessRunner()
    prefix = ["git", "-C", str(contract.repository)] if runner is None else ["git"]
    if _run(active_runner, prefix + ["status", "--porcelain"]):
        raise RuntimeError("working tree is not clean")
    branch = _run(active_runner, prefix + ["branch", "--show-current"])
    if branch != contract.branch:
        raise RuntimeError(f"repository branch mismatch: {branch}")
    head = _run(active_runner, prefix + ["rev-parse", "HEAD"])
    remote = _run(
        active_runner,
        prefix + ["rev-parse", f"origin/{contract.branch}"],
    )
    if head != remote:
        raise RuntimeError("local commit does not match origin")
    if not re.fullmatch(r"[0-9a-f]{40}", head):
        raise RuntimeError("repository commit must be a full lowercase SHA-1")
    return head


def _major(version: str) -> int:
    match = re.search(r"(\d+)", version)
    if not match:
        raise RuntimeError(f"cannot parse version: {version}")
    return int(match.group(1))


def _runtime_command(name: str) -> str:
    if name in {"node", "pnpm", "corepack"}:
        nvm_root = Path("/root/.nvm/versions/node")
        matches = sorted(nvm_root.glob(f"v24.*/bin/{name}"), reverse=True)
        if matches:
            return str(matches[0])
    return name


def preflight(
    contract: ReleaseContract,
    *,
    runner: CommandRunner | None = None,
    dry_run: bool = False,
) -> dict[str, object]:
    resources = [
        *(_PRODUCTION_CONTAINERS),
        *map(str, contract.production_ports),
        *map(str, contract.candidate_ports),
        str(contract.app_root),
        str(contract.repository),
        "/opt/stellaris-zhengwujianli/.env",
        "http://127.0.0.1:3003/health",
    ]
    if dry_run:
        return {"dry_run": True, "resources": resources}

    active_runner = runner or SubprocessRunner()
    require_path_in_app_root(contract, contract.repository)
    require_path_in_app_root(contract, contract.state_directory)
    require_path_in_app_root(contract, contract.candidate_data_directory)
    commit = require_clean_synced_repository(contract, runner=active_runner)

    node_version = _run(active_runner, [_runtime_command("node"), "--version"])
    pnpm_version = _run(active_runner, [_runtime_command("pnpm"), "--version"])
    python_version = _run(active_runner, ["python3", "--version"])
    docker_version = _run(active_runner, ["docker", "--version"])
    compose_version = _run(active_runner, ["docker", "compose", "version"])
    if _major(node_version) < 24 or _major(pnpm_version) < 10 or _major(python_version) < 3:
        raise RuntimeError("required runtime version is unavailable")

    container_states: dict[str, dict[str, object]] = {}
    for name in _PRODUCTION_CONTAINERS:
        require_container_name(contract, name)
        fields = _run(
            active_runner,
            [
                "docker",
                "inspect",
                "--format",
                "{{.State.Status}}|{{if .State.Health}}{{.State.Health.Status}}{{else}}missing{{end}}|{{.RestartCount}}|{{index .Config.Labels \"com.docker.compose.project\"}}",
                name,
            ],
        ).split("|")
        if len(fields) != 4 or fields[0] != "running" or fields[1] != "healthy":
            raise RuntimeError(f"production container is not healthy: {name}")
        if fields[3] != contract.production_project:
            raise RuntimeError(f"production container project mismatch: {name}")
        container_states[name] = {
            "status": fields[0],
            "health": fields[1],
            "restart_count": int(fields[2]),
        }

    listening = _run(active_runner, ["ss", "-ltnH"])
    for port in contract.production_ports:
        matches = [line.split()[3] for line in listening.splitlines() if line.split()[3].endswith(f":{port}")]
        if matches != [f"127.0.0.1:{port}"]:
            raise RuntimeError(f"production port is not loopback-only: {port}")
    db_ports = _run(
        active_runner,
        ["docker", "port", "stellaris-zhengwujianli-db-1"],
    )
    if db_ports:
        raise RuntimeError("production database publishes a host port")

    free_bytes = os.statvfs(contract.app_root).f_bavail * os.statvfs(contract.app_root).f_frsize
    if free_bytes < 10 * 1024**3:
        raise RuntimeError("application root has less than 10 GiB free")
    env_path = contract.app_root / ".env"
    if not env_path.is_file() or env_path.stat().st_mode & 0o077:
        raise RuntimeError("environment file is missing or group/world readable")
    _run(active_runner, ["curl", "-fsS", "--max-time", "5", "http://127.0.0.1:3003/health"])

    payload = {
        "commit": commit,
        "branch": contract.branch,
        "resources": resources,
        "runtime": {
            "node": node_version,
            "pnpm": pnpm_version,
            "python": python_version,
            "docker": docker_version,
            "compose": compose_version,
        },
        "containers": container_states,
        "ports": {"production": list(contract.production_ports), "candidate": list(contract.candidate_ports)},
        "free_bytes": free_bytes,
        "environment_file_mode": oct(env_path.stat().st_mode & 0o777),
        "auth_health": "ok",
    }
    write_report(contract.state_directory / "reports", "preflight.json", payload)
    return payload
