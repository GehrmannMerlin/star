"""Evidence-gated production promotion and read-only regression checks."""

from __future__ import annotations

from dataclasses import asdict, dataclass
import hashlib
import json
import os
from pathlib import Path
import re
import time
from typing import Callable, Mapping

from .contract import ReleaseContract
from .preflight import require_clean_synced_repository
from .report import write_report
from .runner import CommandRunner, SubprocessRunner
from .scope import require_container_name, require_path_in_app_root


_NGINX_CONFIG = Path("/www/server/panel/vhost/nginx/tongjixinzhi.cn.conf")
_PRODUCTION_CONTAINERS = (
    "stellaris-zhengwujianli-db-1",
    "stellaris-zhengwujianli-backend-1",
    "stellaris-zhengwujianli-web-1",
)
_STATE_FORMAT = '{{.Id}}|{{.Config.Image}}|{{.Image}}|{{.RestartCount}}|{{.State.Status}}|{{if .State.Health}}{{.State.Health.Status}}{{else}}missing{{end}}|{{index .Config.Labels "com.docker.compose.project"}}'


@dataclass(frozen=True)
class PromotionManifest:
    project: str
    commit: str
    compose_sha256: str
    nginx_sha256: str
    previous_containers: dict[str, dict[str, object]]
    previous_backend_image: str
    previous_web_image: str
    database_container_id: str
    auth_pid: str
    backup_manifest: dict[str, object]
    candidate_report: dict[str, object]


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _run(runner: CommandRunner, argv: list[str], *, timeout: int = 30) -> str:
    return runner.run(argv, timeout=timeout).stdout.strip()


def validate_candidate_report(
    commit: str,
    report: Mapping[str, object],
) -> None:
    if (
        report.get("commit") != commit
        or report.get("production_unchanged") is not True
        or report.get("health") != "ok"
        or report.get("session_subject") != "phase0-canary-subject"
    ):
        raise RuntimeError("candidate report does not match commit")


def promotion_compose_command(
    contract: ReleaseContract,
    production_environment: Path,
    image_environment: Path,
) -> list[str]:
    compose = contract.repository / contract.production_compose
    require_path_in_app_root(contract, compose)
    require_path_in_app_root(contract, production_environment)
    require_path_in_app_root(contract, image_environment)
    return [
        "docker", "compose",
        "--env-file", str(production_environment),
        "--env-file", str(image_environment),
        "-f", str(compose),
        "up", "-d", "--no-build", "--pull", "never",
        "backend", "web",
    ]


def _write_image_environment(
    contract: ReleaseContract,
    backend_image: str,
    web_image: str,
) -> Path:
    path = require_path_in_app_root(
        contract,
        contract.state_directory / "manifests" / "production-images.env",
    )
    path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    temporary = path.with_name(f".{path.name}.{os.getpid()}.tmp")
    content = (
        f"STELLARIS_BACKEND_IMAGE={backend_image}\n"
        f"STELLARIS_WEB_IMAGE={web_image}\n"
    )
    try:
        with temporary.open("x", encoding="utf-8") as handle:
            handle.write(content)
            handle.flush()
            os.fsync(handle.fileno())
        os.chmod(temporary, 0o600)
        os.replace(temporary, path)
        os.chmod(path, 0o600)
    finally:
        if temporary.exists():
            temporary.unlink()
    return path


def capture_production_state(
    contract: ReleaseContract,
    runner: CommandRunner,
) -> dict[str, dict[str, object]]:
    state: dict[str, dict[str, object]] = {}
    for name in _PRODUCTION_CONTAINERS:
        require_container_name(contract, name)
        fields = _run(
            runner,
            ["docker", "inspect", "--format", _STATE_FORMAT, name],
        ).split("|")
        if len(fields) != 7 or fields[6] != contract.production_project:
            raise RuntimeError(f"production container metadata mismatch: {name}")
        state[name] = {
            "id": fields[0],
            "image": fields[1],
            "image_id": fields[2],
            "restart_count": int(fields[3]),
            "status": fields[4],
            "health": fields[5],
        }
    return state


def _auth_pid(runner: CommandRunner) -> str:
    pid = _run(runner, ["fuser", "3003/tcp"])
    values = re.findall(r"\d+", pid)
    if not values:
        raise RuntimeError("auth-system health PID is unavailable")
    return values[0]


def _load_json(path: Path) -> dict[str, object]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(payload, dict):
        raise RuntimeError(f"manifest is not a JSON object: {path.name}")
    return payload


def production_asset_url(public_path: str) -> str:
    prefix = "/zhengwujianli"
    if not public_path.startswith(f"{prefix}/assets/"):
        raise ValueError("production asset path is outside the public subpath")
    return f"http://127.0.0.1:3218{public_path[len(prefix):]}"


def _curl_status(runner: CommandRunner, url: str) -> int:
    return int(
        _run(
            runner,
            [
                "curl", "-ksS", "--max-time", "15", "-o", "/dev/null",
                "-w", "%{http_code}", url,
            ],
            timeout=20,
        )
    )


def run_regression(
    contract: ReleaseContract,
    *,
    runner: CommandRunner | None = None,
    baseline: Mapping[str, object] | None = None,
    write_evidence: bool = True,
) -> dict[str, object]:
    active_runner = runner or SubprocessRunner()
    state = capture_production_state(contract, active_runner)
    if any(
        item["status"] != "running" or item["health"] != "healthy"
        for item in state.values()
    ):
        raise RuntimeError("production-health failed")
    if baseline:
        expected_db = baseline.get("database_container_id")
        if state["stellaris-zhengwujianli-db-1"]["id"] != expected_db:
            raise RuntimeError("production database container changed")
        expected_auth = baseline.get("auth_pid")
        if _auth_pid(active_runner) != expected_auth:
            raise RuntimeError("auth-system PID changed")

    listening = _run(active_runner, ["ss", "-ltnH"])
    for port in contract.production_ports:
        matches = [
            line.split()[3]
            for line in listening.splitlines()
            if len(line.split()) >= 4 and line.split()[3].endswith(f":{port}")
        ]
        if matches != [f"127.0.0.1:{port}"]:
            raise RuntimeError(f"production port is not loopback-only: {port}")
    if _run(active_runner, ["docker", "port", "stellaris-zhengwujianli-db-1"]):
        raise RuntimeError("production database publishes a host port")

    statuses = {
        "health": _curl_status(active_runner, "http://127.0.0.1:3217/health"),
        "page_unauthenticated": _curl_status(active_runner, "https://tongjixinzhi.cn/zhengwujianli/"),
        "api_unauthenticated": _curl_status(active_runner, "https://tongjixinzhi.cn/zhengwujianli/api/session"),
        "home": _curl_status(active_runner, "https://tongjixinzhi.cn/"),
        "satmap": _curl_status(active_runner, "https://tongjixinzhi.cn/satmap/"),
        "kdocs_sync": _curl_status(active_runner, "https://tongjixinzhi.cn/kdocs-sync/"),
        "aliyun_original": _curl_status(active_runner, "https://stellaris.ac.cn/"),
    }
    if statuses["health"] != 200:
        raise RuntimeError("production-health failed")
    if statuses["page_unauthenticated"] not in {301, 302, 303, 307, 308}:
        raise RuntimeError("public page authentication boundary changed")
    if statuses["api_unauthenticated"] != 401:
        raise RuntimeError("public API authentication boundary changed")
    for key in ("home", "satmap", "kdocs_sync", "aliyun_original"):
        if statuses[key] not in {200, 301, 302, 303, 307, 308}:
            raise RuntimeError(f"external regression failed: {key}")

    html = _run(active_runner, ["curl", "-fsS", "http://127.0.0.1:3218/"])
    asset_match = re.search(r'(?:src|href)="(/zhengwujianli/assets/[^"]+)"', html)
    if "<title>??????</title>" not in html or not asset_match:
        raise RuntimeError("production web subpath contract failed")
    asset = _run(
        active_runner,
        ["curl", "-fsS", production_asset_url(asset_match.group(1))],
    )
    if not asset or "<html" in asset.lower():
        raise RuntimeError("production web asset failed")

    report = {
        "containers": state,
        "statuses": statuses,
        "database_unchanged": baseline is None or True,
        "auth_pid_unchanged": baseline is None or True,
        "nginx_sha256": _sha256(_NGINX_CONFIG),
    }
    if write_evidence:
        write_report(
            contract.state_directory / "reports",
            "regression.json",
            report,
        )
    return report


def promote(
    contract: ReleaseContract,
    *,
    commit: str | None = None,
    runner: CommandRunner | None = None,
    candidate_report: Mapping[str, object] | None = None,
    backup_manifest: Mapping[str, object] | None = None,
    regression_fn: Callable[..., dict[str, object]] = run_regression,
    rollback_fn: Callable[..., object] | None = None,
    regression_timeout: int = 180,
) -> PromotionManifest:
    active_runner = runner or SubprocessRunner()
    verified = require_clean_synced_repository(contract, runner=active_runner)
    selected_commit = commit or verified
    if selected_commit != verified:
        raise RuntimeError("promotion commit does not match verified repository")
    candidate = dict(candidate_report) if candidate_report is not None else _load_json(
        require_path_in_app_root(
            contract,
            contract.state_directory / "reports" / "candidate-verify.json",
        )
    )
    validate_candidate_report(selected_commit, candidate)
    backup = dict(backup_manifest) if backup_manifest is not None else _load_json(
        require_path_in_app_root(
            contract,
            contract.state_directory / "manifests" / "backup.json",
        )
    )
    if not backup.get("sha256") or backup.get("database") != contract.production_database:
        raise RuntimeError("production backup manifest is invalid")

    before = capture_production_state(contract, active_runner)
    compose = require_path_in_app_root(
        contract,
        contract.repository / contract.production_compose,
    )
    production_env = require_path_in_app_root(contract, contract.app_root / ".env")
    manifest = PromotionManifest(
        project=contract.production_project,
        commit=selected_commit,
        compose_sha256=_sha256(compose),
        nginx_sha256=_sha256(_NGINX_CONFIG),
        previous_containers=before,
        previous_backend_image=str(before["stellaris-zhengwujianli-backend-1"]["image"]),
        previous_web_image=str(before["stellaris-zhengwujianli-web-1"]["image"]),
        database_container_id=str(before["stellaris-zhengwujianli-db-1"]["id"]),
        auth_pid=_auth_pid(active_runner),
        backup_manifest=backup,
        candidate_report=candidate,
    )
    write_report(
        contract.state_directory / "manifests",
        "promotion.json",
        asdict(manifest),
    )
    image_env = _write_image_environment(
        contract,
        f"stellaris-zhengwujianli-backend:{selected_commit}",
        f"stellaris-zhengwujianli-web:{selected_commit}",
    )
    _run(
        active_runner,
        promotion_compose_command(contract, production_env, image_env),
        timeout=300,
    )
    try:
        deadline = time.monotonic() + regression_timeout
        while True:
            try:
                regression_fn(
                    contract,
                    runner=active_runner,
                    baseline=asdict(manifest),
                    write_evidence=True,
                )
                break
            except RuntimeError:
                if time.monotonic() >= deadline:
                    raise
                time.sleep(3)
    except Exception as promotion_error:
        if rollback_fn is None:
            from .rollback import rollback

            rollback_fn = rollback
        rollback_fn(contract, manifest=asdict(manifest), runner=active_runner)
        raise RuntimeError("promotion failed and rollback completed") from promotion_error
    return manifest
