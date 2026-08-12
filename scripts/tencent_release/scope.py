"""Reject release targets outside the dedicated government application."""

from __future__ import annotations

from pathlib import Path

from .contract import ReleaseContract


def require_path_in_app_root(contract: ReleaseContract, path: Path) -> Path:
    app_root = contract.app_root.resolve(strict=False)
    resolved = path.resolve(strict=False)
    if resolved != app_root and not resolved.is_relative_to(app_root):
        raise ValueError(f"path is outside application root: {resolved}")
    return resolved


def require_container_name(contract: ReleaseContract, name: str) -> str:
    if not isinstance(name, str) or not any(
        name.startswith(prefix) and len(name) > len(prefix)
        for prefix in contract.allowed_container_prefixes
    ):
        raise ValueError(f"container is not allowlisted: {name}")
    return name


def require_database_target(
    contract: ReleaseContract,
    container: str,
    database: str,
) -> None:
    require_container_name(contract, container)
    normalized = database.lower()
    if normalized in {
        forbidden.lower() for forbidden in contract.forbidden_database_names
    }:
        raise ValueError(f"database target is forbidden: {database}")
