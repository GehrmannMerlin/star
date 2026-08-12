"""Isolated candidate environment startup and verification."""

from __future__ import annotations

from dataclasses import asdict, dataclass
import json
import os
from pathlib import Path
import re
import secrets
import time
from typing import Mapping

from .contract import ReleaseContract
from .preflight import require_clean_synced_repository
from .report import write_report
from .runner import CommandRunner, SubprocessRunner
from .scope import require_container_name, require_path_in_app_root


_COMMIT = re.compile(r"[0-9a-f]{40}")
_PRODUCTION_CONTAINERS = (
    "stellaris-zhengwujianli-db-1",
    "stellaris-zhengwujianli-backend-1",
    "stellaris-zhengwujianli-web-1",
)
_CANDIDATE_CONTAINERS = (
    "stellaris-zhengwujianli-candidate-db-1",
    "stellaris-zhengwujianli-candidate-backend-1",
    "stellaris-zhengwujianli-candidate-web-1",
)
_SNAPSHOT_FORMAT = "{{.Id}}|{{.Image}}|{{.RestartCount}}"
_CANDIDATE_FORMAT = '{{.State.Status}}|{{if .State.Health}}{{.State.Health.Status}}{{else}}missing{{end}}|{{.RestartCount}}|{{index .Config.Labels "com.docker.compose.project"}}|{{.Config.Image}}'


@dataclass(frozen=True)
class CandidateLaunch:
    commit: str
    compose_file: str
    environment_file: str
    production_snapshot: dict[str, dict[str, object]]


def _run(
    runner: CommandRunner,
    argv: list[str],
    *,
    timeout: int = 30,
) -> str:
    return runner.run(argv, timeout=timeout).stdout.strip()


def candidate_environment(
    contract: ReleaseContract,
    commit: str,
) -> dict[str, str]:
    if not _COMMIT.fullmatch(commit):
        raise ValueError("candidate commit must be a full lowercase SHA-1")
    return {
        "COMPOSE_PROJECT_NAME": contract.candidate_project,
        "STELLARIS_BACKEND_IMAGE": f"stellaris-zhengwujianli-backend:{commit}",
        "STELLARIS_WEB_IMAGE": f"stellaris-zhengwujianli-web:{commit}",
        "CANDIDATE_DATABASE": contract.candidate_database,
        "CANDIDATE_DATA_DIRECTORY": str(contract.candidate_data_directory),
        "CANDIDATE_BACKEND_PORT": str(contract.candidate_ports[0]),
        "CANDIDATE_WEB_PORT": str(contract.candidate_ports[1]),
        "PHASE0_CANARY_SUBJECT": "phase0-canary-subject",
    }


def production_snapshot(
    contract: ReleaseContract,
    runner: CommandRunner,
) -> dict[str, dict[str, object]]:
    snapshot: dict[str, dict[str, object]] = {}
    for name in _PRODUCTION_CONTAINERS:
        require_container_name(contract, name)
        raw = _run(
            runner,
            ["docker", "inspect", "--format", _SNAPSHOT_FORMAT, name],
        )
        container_id, separator, remainder = raw.partition("|")
        image_id, second_separator, restart_text = remainder.partition("|")
        if not separator or not second_separator:
            raise RuntimeError(f"invalid production snapshot for {name}")
        snapshot[name] = {
            "id": container_id,
            "image_id": image_id,
            "restart_count": int(restart_text),
        }
    return snapshot


def require_unchanged_production(
    before: Mapping[str, object],
    after: Mapping[str, object],
) -> None:
    if before != after:
        raise RuntimeError("production containers changed during candidate operation")


def _write_candidate_environment(
    contract: ReleaseContract,
    environment: Mapping[str, str],
) -> Path:
    destination = require_path_in_app_root(
        contract,
        contract.candidate_data_directory / "candidate.env",
    )
    destination.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    temporary = destination.with_name(f".{destination.name}.{os.getpid()}.tmp")
    values = dict(environment)
    values["CANDIDATE_POSTGRES_PASSWORD"] = secrets.token_urlsafe(48)
    try:
        with temporary.open("x", encoding="utf-8") as handle:
            for key in sorted(values):
                handle.write(f"{key}={values[key]}\n")
            handle.flush()
            os.fsync(handle.fileno())
        os.chmod(temporary, 0o600)
        os.replace(temporary, destination)
        os.chmod(destination, 0o600)
    finally:
        if temporary.exists():
            temporary.unlink()
    return destination


def candidate_up(
    contract: ReleaseContract,
    commit: str,
    *,
    runner: CommandRunner | None = None,
    write_environment: bool = True,
    write_evidence: bool = True,
) -> CandidateLaunch:
    active_runner = runner or SubprocessRunner()
    verified_commit = require_clean_synced_repository(contract, runner=active_runner)
    if commit != verified_commit:
        raise RuntimeError("candidate commit does not match verified repository")
    environment = candidate_environment(contract, commit)
    compose_file = contract.repository / contract.candidate_compose
    require_path_in_app_root(contract, compose_file)
    env_file = contract.candidate_data_directory / "candidate.env"
    require_path_in_app_root(contract, env_file)
    if write_environment:
        env_file = _write_candidate_environment(contract, environment)

    before = production_snapshot(contract, active_runner)
    launch = CandidateLaunch(
        commit=commit,
        compose_file=str(compose_file),
        environment_file=str(env_file),
        production_snapshot=before,
    )
    if write_evidence:
        write_report(
            contract.state_directory / "manifests",
            "candidate-baseline.json",
            asdict(launch),
        )
    _run(
        active_runner,
        [
            "docker",
            "compose",
            "--env-file",
            str(env_file),
            "-f",
            str(compose_file),
            "up",
            "-d",
            "--no-build",
            "--pull",
            "never",
        ],
        timeout=300,
    )
    return launch


def _load_launch(contract: ReleaseContract) -> CandidateLaunch:
    path = require_path_in_app_root(
        contract,
        contract.state_directory / "manifests" / "candidate-baseline.json",
    )
    payload = json.loads(path.read_text(encoding="utf-8"))
    return CandidateLaunch(
        commit=payload["commit"],
        compose_file=payload["compose_file"],
        environment_file=payload["environment_file"],
        production_snapshot=payload["production_snapshot"],
    )


def candidate_verify(
    contract: ReleaseContract,
    *,
    runner: CommandRunner | None = None,
    launch: CandidateLaunch | None = None,
) -> dict[str, object]:
    active_runner = runner or SubprocessRunner()
    baseline = launch or _load_launch(contract)
    commit = require_clean_synced_repository(contract, runner=active_runner)
    if baseline.commit != commit:
        raise RuntimeError("candidate baseline does not match verified repository")
    expected_images = {
        "stellaris-zhengwujianli-candidate-backend-1": f"stellaris-zhengwujianli-backend:{commit}",
        "stellaris-zhengwujianli-candidate-web-1": f"stellaris-zhengwujianli-web:{commit}",
    }

    deadline = time.monotonic() + 180
    states: dict[str, dict[str, object]] = {}
    while True:
        states = {}
        ready = True
        for name in _CANDIDATE_CONTAINERS:
            require_container_name(contract, name)
            try:
                fields = _run(
                    active_runner,
                    ["docker", "inspect", "--format", _CANDIDATE_FORMAT, name],
                ).split("|")
            except RuntimeError:
                ready = False
                continue
            if len(fields) != 5:
                raise RuntimeError(f"invalid candidate container metadata: {name}")
            states[name] = {
                "status": fields[0],
                "health": fields[1],
                "restart_count": int(fields[2]),
                "project": fields[3],
                "image": fields[4],
            }
            if (
                fields[0] != "running"
                or fields[1] != "healthy"
                or int(fields[2]) != 0
                or fields[3] != contract.candidate_project
                or (name in expected_images and fields[4] != expected_images[name])
            ):
                ready = False
        if ready and len(states) == len(_CANDIDATE_CONTAINERS):
            break
        if time.monotonic() >= deadline:
            raise RuntimeError("candidate containers did not become healthy")
        time.sleep(3)

    listening = _run(active_runner, ["ss", "-ltnH"])
    for port in contract.candidate_ports:
        matches = [
            line.split()[3]
            for line in listening.splitlines()
            if len(line.split()) >= 4 and line.split()[3].endswith(f":{port}")
        ]
        if matches != [f"127.0.0.1:{port}"]:
            raise RuntimeError(f"candidate port is not loopback-only: {port}")
    if _run(active_runner, ["docker", "port", _CANDIDATE_CONTAINERS[0]]):
        raise RuntimeError("candidate database publishes a host port")

    health = json.loads(
        _run(active_runner, ["curl", "-fsS", "http://127.0.0.1:3227/health"])
    )
    if health.get("status") != "ok":
        raise RuntimeError("candidate health endpoint did not return ok")
    session = json.loads(
        _run(
            active_runner,
            [
                "curl",
                "-fsS",
                "-H",
                "X-IFC-User-ID: phase0-canary-subject",
                "http://127.0.0.1:3227/api/session",
            ],
        )
    )
    if session != {"authenticated": True, "userId": "phase0-canary-subject"}:
        raise RuntimeError("candidate session boundary is invalid")
    html = _run(active_runner, ["curl", "-fsS", "http://127.0.0.1:3228/"])
    if "<title>??????</title>" not in html:
        raise RuntimeError("candidate web title is invalid")
    asset_match = re.search(r'(?:src|href)="(/zhengwujianli/assets/[^"]+)"', html)
    if not asset_match:
        raise RuntimeError("candidate web has no subpath asset")
    asset = _run(
        active_runner,
        ["curl", "-fsS", f"http://127.0.0.1:3228{asset_match.group(1)}"],
    )
    if not asset or "<html" in asset.lower():
        raise RuntimeError("candidate web asset did not load")

    after = production_snapshot(contract, active_runner)
    require_unchanged_production(baseline.production_snapshot, after)
    report = {
        "commit": commit,
        "containers": states,
        "ports": list(contract.candidate_ports),
        "database_host_port": False,
        "health": "ok",
        "session_subject": "phase0-canary-subject",
        "web_title": "??????",
        "production_unchanged": True,
    }
    if runner is None:
        write_report(
            contract.state_directory / "reports",
            "candidate-verify.json",
            report,
        )
    return report
