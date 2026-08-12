"""Create or validate the dedicated Tencent server Git workspace."""

from __future__ import annotations

import os
from pathlib import Path

from .contract import ReleaseContract
from .preflight import require_clean_synced_repository
from .runner import CommandRunner, SubprocessRunner
from .scope import require_path_in_app_root


_ORIGIN_URLS = {
    "https://github.com/GehrmannMerlin/star.git",
    "git@github-star:GehrmannMerlin/star.git",
}
_DIRECTORIES = (
    "state/reports",
    "state/manifests",
    "state/backups",
    "candidate-data/postgres",
    "candidate-data/evidence",
    "candidate-data/exports",
)


def _run(
    runner: CommandRunner,
    argv: list[str],
    *,
    timeout: int = 30,
) -> str:
    return runner.run(argv, timeout=timeout).stdout.strip()


def validate_existing_repository(
    contract: ReleaseContract,
    *,
    runner: CommandRunner | None = None,
) -> str:
    return require_clean_synced_repository(contract, runner=runner)


def bootstrap(
    contract: ReleaseContract,
    *,
    runner: CommandRunner | None = None,
) -> dict[str, object]:
    active_runner = runner or SubprocessRunner()
    app_root = require_path_in_app_root(contract, contract.app_root)
    if not app_root.is_dir() or app_root.is_symlink():
        raise RuntimeError("application root must be an existing ordinary directory")

    for relative in _DIRECTORIES:
        target = require_path_in_app_root(contract, app_root / relative)
        target.mkdir(parents=True, exist_ok=True, mode=0o700)
        os.chmod(target, 0o700)

    repository = require_path_in_app_root(contract, contract.repository)
    if not (repository / ".git").is_dir():
        if repository.exists() and any(repository.iterdir()):
            raise RuntimeError("repository target exists and is not empty")
        _run(
            active_runner,
            [
                "git",
                "clone",
                "--branch",
                contract.branch,
                "--single-branch",
                "https://github.com/GehrmannMerlin/star.git",
                str(repository),
            ],
            timeout=180,
        )

    origin = _run(
        active_runner,
        ["git", "-C", str(repository), "remote", "get-url", "origin"],
    )
    if origin not in _ORIGIN_URLS:
        raise RuntimeError("repository origin does not match the approved GitHub repository")
    _run(
        active_runner,
        ["git", "-C", str(repository), "fetch", "origin", contract.branch],
        timeout=120,
    )
    validate_existing_repository(contract, runner=active_runner)
    _run(
        active_runner,
        [
            "git",
            "-C",
            str(repository),
            "push",
            "--dry-run",
            "origin",
            f"HEAD:{contract.branch}",
        ],
        timeout=60,
    )
    return {
        "repository": str(repository),
        "branch": contract.branch,
        "created_directories": [str(app_root / relative) for relative in _DIRECTORIES],
    }
