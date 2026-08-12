"""Deterministically restore production backend and web images."""

from __future__ import annotations

import json
from typing import Mapping

from .contract import ReleaseContract
from .promote import (
    _NGINX_CONFIG,
    _sha256,
    _write_image_environment,
    promotion_compose_command,
    run_regression,
)
from .report import write_report
from .runner import CommandRunner, SubprocessRunner
from .scope import require_path_in_app_root


def validate_rollback_manifest(
    contract: ReleaseContract,
    manifest: Mapping[str, object],
) -> None:
    if manifest.get("project") != contract.production_project:
        raise ValueError("manifest project mismatch")
    required = {
        "commit", "compose_sha256", "nginx_sha256",
        "previous_backend_image", "previous_web_image",
        "database_container_id", "auth_pid",
    }
    if not required.issubset(manifest):
        raise ValueError("rollback manifest is incomplete")


def _load_manifest(contract: ReleaseContract) -> dict[str, object]:
    path = require_path_in_app_root(
        contract,
        contract.state_directory / "manifests" / "promotion.json",
    )
    payload = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(payload, dict):
        raise RuntimeError("promotion manifest must be a JSON object")
    return payload


def rollback(
    contract: ReleaseContract,
    manifest: Mapping[str, object] | None = None,
    *,
    runner: CommandRunner | None = None,
) -> dict[str, object]:
    active_runner = runner or SubprocessRunner()
    payload = dict(manifest) if manifest is not None else _load_manifest(contract)
    validate_rollback_manifest(contract, payload)
    compose = require_path_in_app_root(
        contract,
        contract.repository / contract.production_compose,
    )
    if _sha256(compose) != payload["compose_sha256"]:
        raise RuntimeError("production Compose hash changed")
    if _sha256(_NGINX_CONFIG) != payload["nginx_sha256"]:
        raise RuntimeError("Nginx configuration changed")
    backend = str(payload["previous_backend_image"])
    web = str(payload["previous_web_image"])
    for image in (backend, web):
        active_runner.run(["docker", "image", "inspect", image], timeout=30)
    image_env = _write_image_environment(contract, backend, web)
    production_env = require_path_in_app_root(contract, contract.app_root / ".env")
    active_runner.run(
        promotion_compose_command(contract, production_env, image_env),
        timeout=300,
    )
    regression = run_regression(
        contract,
        runner=active_runner,
        baseline=payload,
        write_evidence=False,
    )
    report = {
        "project": contract.production_project,
        "restored_backend_image": backend,
        "restored_web_image": web,
        "regression": regression,
    }
    if runner is None:
        write_report(
            contract.state_directory / "reports",
            "rollback.json",
            report,
        )
    return report
